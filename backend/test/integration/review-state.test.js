const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../../src/config/database");
const reviewService = require("../../src/services/reviewService");

const TEST_ORG_ID = 1;
const TEST_ACTOR_ID = 1;
const TEST_ACTIVITY_ID = 4;

async function createTransactionFixture(connection, suffix) {
  const reference =
    `AUTO-REVIEW-TEST-${suffix}-${Date.now()}`;

  const [result] = await connection.execute(
    `
      INSERT INTO transactions (
        organization_id,
        activity_id,
        transaction_reference,
        transaction_type,
        amount,
        currency,
        status,
        transaction_date,
        created_by
      )
      VALUES (?, ?, ?, 'COLLECTION', ?, 'PHP', 'REQUIRES_REVIEW', NOW(), ?)
    `,
    [
      TEST_ORG_ID,
      TEST_ACTIVITY_ID,
      reference,
      1000,
      TEST_ACTOR_ID,
    ]
  );

  return {
    id: result.insertId,
    reference,
  };
}

async function createReviewFixture(connection, transactionId, suffix) {
  return reviewService.createReview({
    organizationId: TEST_ORG_ID,
    actorId: TEST_ACTOR_ID,
    transactionId,
    priority: "HIGH",
    reason: `Automated integration test ${suffix}`,
    connection,
  });
}

async function getTransaction(connection, transactionId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        transaction_reference,
        transaction_type,
        amount,
        status
      FROM transactions
      WHERE organization_id = ?
        AND id = ?
      LIMIT 1
    `,
    [TEST_ORG_ID, transactionId]
  );

  return rows[0] || null;
}

async function getReview(connection, reviewId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        transaction_id,
        status,
        priority,
        reason,
        resolution
      FROM reviews
      WHERE organization_id = ?
        AND id = ?
      LIMIT 1
    `,
    [TEST_ORG_ID, reviewId]
  );

  return rows[0] || null;
}

async function getReviewAudits(connection, reviewId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
      FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'REVIEW'
        AND entity_id = ?
        AND action IN ('REVIEW_CREATED', 'REVIEW_UPDATED')
      ORDER BY id ASC
    `,
    [TEST_ORG_ID, reviewId]
  );

  return rows;
}

async function countReviewAudits(connection, reviewId) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS count
      FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'REVIEW'
        AND entity_id = ?
        AND action IN ('REVIEW_CREATED', 'REVIEW_UPDATED')
    `,
    [TEST_ORG_ID, reviewId]
  );

  return Number(rows[0].count);
}

async function cleanup(connection, transactionId, reviewId) {
  if (reviewId) {
    await connection.execute(
      `
        DELETE FROM audit_events
        WHERE organization_id = ?
          AND entity_type = 'REVIEW'
          AND entity_id = ?
      `,
      [TEST_ORG_ID, reviewId]
    );

    await connection.execute(
      `
        DELETE FROM reviews
        WHERE organization_id = ?
          AND id = ?
      `,
      [TEST_ORG_ID, reviewId]
    );
  }

  if (transactionId) {
    await connection.execute(
      `
        DELETE FROM transactions
        WHERE organization_id = ?
          AND id = ?
      `,
      [TEST_ORG_ID, transactionId]
    );
  }
}

test.after(async () => {
  await pool.end();
});

test(
  "OPEN → APPROVED synchronizes transaction to CONFIRMED",
  async () => {
    const connection = await pool.getConnection();

    let transactionId;
    let reviewId;

    try {
      const transaction =
        await createTransactionFixture(
          connection,
          "APPROVE"
        );

      transactionId = transaction.id;

      const review =
        await createReviewFixture(
          connection,
          transactionId,
          "APPROVE"
        );

      reviewId = review.id;

      const updated =
        await reviewService.updateReview({
          organizationId: TEST_ORG_ID,
          reviewId,
          actorId: TEST_ACTOR_ID,
          status: "APPROVED",
          resolution:
            "Automated test approved transaction.",
        });

      assert.equal(updated.status, "APPROVED");
      assert.equal(
        updated.entity.status,
        "CONFIRMED"
      );

      const transactionAfter =
        await getTransaction(
          connection,
          transactionId
        );

      assert.equal(
        transactionAfter.status,
        "CONFIRMED"
      );

      const reviewAfter =
        await getReview(
          connection,
          reviewId
        );

      assert.equal(
        reviewAfter.status,
        "APPROVED"
      );

      assert.equal(
        reviewAfter.resolution,
        "Automated test approved transaction."
      );

      assert.equal(
        await countReviewAudits(
          connection,
          reviewId
        ),
        2
      );
    } finally {
      await cleanup(
        connection,
        transactionId,
        reviewId
      );

      connection.release();
    }
  }
);

test(
  "OPEN → REJECTED synchronizes transaction to VOIDED",
  async () => {
    const connection = await pool.getConnection();

    let transactionId;
    let reviewId;

    try {
      const transaction =
        await createTransactionFixture(
          connection,
          "REJECT"
        );

      transactionId = transaction.id;

      const review =
        await createReviewFixture(
          connection,
          transactionId,
          "REJECT"
        );

      reviewId = review.id;

      const updated =
        await reviewService.updateReview({
          organizationId: TEST_ORG_ID,
          reviewId,
          actorId: TEST_ACTOR_ID,
          status: "REJECTED",
          resolution:
            "Automated test rejected transaction.",
        });

      assert.equal(updated.status, "REJECTED");
      assert.equal(
        updated.entity.status,
        "VOIDED"
      );

      const transactionAfter =
        await getTransaction(
          connection,
          transactionId
        );

      assert.equal(
        transactionAfter.status,
        "VOIDED"
      );

      const reviewAfter =
        await getReview(
          connection,
          reviewId
        );

      assert.equal(
        reviewAfter.status,
        "REJECTED"
      );

      assert.equal(
        reviewAfter.resolution,
        "Automated test rejected transaction."
      );

      assert.equal(
        await countReviewAudits(
          connection,
          reviewId
        ),
        2
      );
    } finally {
      await cleanup(
        connection,
        transactionId,
        reviewId
      );

      connection.release();
    }
  }
);

test(
  "OPEN → ESCALATED keeps transaction at REQUIRES_REVIEW",
  async () => {
    const connection = await pool.getConnection();

    let transactionId;
    let reviewId;

    try {
      const transaction =
        await createTransactionFixture(
          connection,
          "ESCALATE"
        );

      transactionId = transaction.id;

      const review =
        await createReviewFixture(
          connection,
          transactionId,
          "ESCALATE"
        );

      reviewId = review.id;

      const updated =
        await reviewService.updateReview({
          organizationId: TEST_ORG_ID,
          reviewId,
          actorId: TEST_ACTOR_ID,
          status: "ESCALATED",
          resolution:
            "Automated test escalated transaction.",
        });

      assert.equal(
        updated.status,
        "ESCALATED"
      );

      assert.equal(
        updated.entity.status,
        "REQUIRES_REVIEW"
      );

      const transactionAfter =
        await getTransaction(
          connection,
          transactionId
        );

      assert.equal(
        transactionAfter.status,
        "REQUIRES_REVIEW"
      );

      const reviewAfter =
        await getReview(
          connection,
          reviewId
        );

      assert.equal(
        reviewAfter.status,
        "ESCALATED"
      );

      assert.equal(
        reviewAfter.resolution,
        "Automated test escalated transaction."
      );

      assert.equal(
        await countReviewAudits(
          connection,
          reviewId
        ),
        2
      );
    } finally {
      await cleanup(
        connection,
        transactionId,
        reviewId
      );

      connection.release();
    }
  }
);

test(
  "Resolved review cannot be changed",
  async () => {
    const connection = await pool.getConnection();

    let transactionId;
    let reviewId;

    try {
      const transaction =
        await createTransactionFixture(
          connection,
          "LOCKED"
        );

      transactionId = transaction.id;

      const review =
        await createReviewFixture(
          connection,
          transactionId,
          "LOCKED"
        );

      reviewId = review.id;

      await reviewService.updateReview({
        organizationId: TEST_ORG_ID,
        reviewId,
        actorId: TEST_ACTOR_ID,
        status: "APPROVED",
        resolution:
          "First decision in automated test.",
      });

      await assert.rejects(
        () =>
          reviewService.updateReview({
            organizationId: TEST_ORG_ID,
            reviewId,
            actorId: TEST_ACTOR_ID,
            status: "REJECTED",
            resolution:
              "Invalid second decision.",
          }),
        (error) => {
          assert.equal(
            error.message,
            "This review has already been resolved."
          );

          assert.equal(
            error.statusCode,
            409
          );

          return true;
        }
      );

      const transactionAfter =
        await getTransaction(
          connection,
          transactionId
        );

      assert.equal(
        transactionAfter.status,
        "CONFIRMED"
      );

      const reviewAfter =
        await getReview(
          connection,
          reviewId
        );

      assert.equal(
        reviewAfter.status,
        "APPROVED"
      );

      assert.equal(
        reviewAfter.resolution,
        "First decision in automated test."
      );

      assert.equal(
        await countReviewAudits(
          connection,
          reviewId
        ),
        2
      );
    } finally {
      await cleanup(
        connection,
        transactionId,
        reviewId
      );

      connection.release();
    }
  }
);

test(
  "Review cannot be accessed through another organization",
  async () => {
    const connection = await pool.getConnection();

    let transactionId;
    let reviewId;

    try {
      const transaction =
        await createTransactionFixture(
          connection,
          "ORG-SCOPE"
        );

      transactionId = transaction.id;

      const review =
        await createReviewFixture(
          connection,
          transactionId,
          "ORG-SCOPE"
        );

      reviewId = review.id;

      await assert.rejects(
        () =>
          reviewService.updateReview({
            organizationId: 4,
            reviewId,
            actorId: TEST_ACTOR_ID,
            status: "APPROVED",
            resolution:
              "This should not be allowed.",
          }),
        (error) => {
          assert.equal(
            error.message,
            "Review not found"
          );

          assert.equal(
            error.statusCode,
            404
          );

          return true;
        }
      );

      const transactionAfter =
        await getTransaction(
          connection,
          transactionId
        );

      assert.equal(
        transactionAfter.status,
        "REQUIRES_REVIEW"
      );

      const reviewAfter =
        await getReview(
          connection,
          reviewId
        );

      assert.equal(
        reviewAfter.status,
        "OPEN"
      );

      assert.equal(
        await countReviewAudits(
          connection,
          reviewId
        ),
        1
      );
    } finally {
      await cleanup(
        connection,
        transactionId,
        reviewId
      );

      connection.release();
    }
  }
);

test(
  "review audit events preserve actor, entity, and state transition data",
  async () => {
    const connection = await pool.getConnection();

    let transactionId;
    let reviewId;

    try {
      const transaction =
        await createTransactionFixture(
          connection,
          "AUDIT-PAYLOAD"
        );

      transactionId = transaction.id;

      const review =
        await createReviewFixture(
          connection,
          transactionId,
          "AUDIT-PAYLOAD"
        );

      reviewId = review.id;

      const createdAudits =
        await getReviewAudits(
          connection,
          reviewId
        );

      assert.equal(createdAudits.length, 1);

      const createdAudit = createdAudits[0];

      assert.equal(
        createdAudit.organization_id,
        TEST_ORG_ID
      );

      assert.equal(
        createdAudit.actor_id,
        TEST_ACTOR_ID
      );

      assert.equal(
        createdAudit.action,
        "REVIEW_CREATED"
      );

      assert.equal(
        createdAudit.entity_type,
        "REVIEW"
      );

      assert.equal(
        Number(createdAudit.entity_id),
        Number(reviewId)
      );

      assert.equal(
        createdAudit.old_values,
        null
      );

      const createdNewValues =
        typeof createdAudit.new_values === "string"
          ? JSON.parse(createdAudit.new_values)
          : createdAudit.new_values;

      assert.equal(
        createdNewValues.status,
        "OPEN"
      );

      assert.equal(
        createdNewValues.priority,
        "HIGH"
      );

      assert.equal(
        createdNewValues.transactionId,
        transactionId
      );

      assert.equal(
        createdNewValues.activityId,
        null
      );

      assert.equal(
        createdNewValues.invoiceId,
        null
      );

      assert.equal(
        createdNewValues.riskAssessmentId,
        null
      );

      assert.equal(
        createdNewValues.reason,
        "Automated integration test AUDIT-PAYLOAD"
      );

      await reviewService.updateReview({
        organizationId: TEST_ORG_ID,
        reviewId,
        actorId: TEST_ACTOR_ID,
        status: "APPROVED",
        resolution:
          "Audit payload approval test.",
      });

      const updatedAudits =
        await getReviewAudits(
          connection,
          reviewId
        );

      assert.equal(updatedAudits.length, 2);

      const updatedAudit = updatedAudits[1];

      assert.equal(
        updatedAudit.organization_id,
        TEST_ORG_ID
      );

      assert.equal(
        updatedAudit.actor_id,
        TEST_ACTOR_ID
      );

      assert.equal(
        updatedAudit.action,
        "REVIEW_UPDATED"
      );

      assert.equal(
        updatedAudit.entity_type,
        "REVIEW"
      );

      assert.equal(
        Number(updatedAudit.entity_id),
        Number(reviewId)
      );

      const oldValues =
        typeof updatedAudit.old_values === "string"
          ? JSON.parse(updatedAudit.old_values)
          : updatedAudit.old_values;

      const newValues =
        typeof updatedAudit.new_values === "string"
          ? JSON.parse(updatedAudit.new_values)
          : updatedAudit.new_values;

      assert.equal(
        oldValues.status,
        "OPEN"
      );

      assert.equal(
        oldValues.assignedTo,
        null
      );

      assert.equal(
        oldValues.resolution,
        null
      );

      assert.equal(
        newValues.status,
        "APPROVED"
      );

      assert.equal(
        newValues.assignedTo,
        null
      );

      assert.equal(
        newValues.resolution,
        "Audit payload approval test."
      );
    } finally {
      await cleanup(
        connection,
        transactionId,
        reviewId
      );

      connection.release();
    }
  }
);
