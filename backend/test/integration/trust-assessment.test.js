const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const pool = require("../../src/config/database");
const { generateAccessToken } = require("../../src/utils/jwt");

const OWNER_ID = 1;
const FIELD_WORKER_ID = 4;
const CROSS_ORG_OWNER_ID = 3;

const ORGANIZATION_ID = 1;
const CROSS_ORG_ORGANIZATION_ID = 4;

let server;
let baseUrl;

async function createAuthCookie(userId, organizationId, role) {
  const [rows] = await pool.execute(
    `
      SELECT token_version
      FROM users
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
    `,
    [userId, organizationId]
  );

  assert.equal(
    rows.length,
    1,
    `Test user ${userId} was not found in organization ${organizationId}`
  );

  const token = generateAccessToken({
    id: userId,
    organization_id: organizationId,
    roles: [role],
    token_version: rows[0].token_version,
  });

  return `access_token=${token}`;
}

async function startServer() {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });
  });

  const address = server.address();

  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function stopServer() {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = null;
}

async function createActivity(connection, suffix, options = {}) {
  const {
    organizationId = ORGANIZATION_ID,
    assignedTo = FIELD_WORKER_ID,
    latitude = 10.72020000,
    longitude = 122.56210000,
    scheduledAt = "2026-09-13 09:00:00",
    status = "PENDING",
  } = options;

  const title =
    `Trust Integration Test ${suffix} ${Date.now()}`;

  const [result] = await connection.execute(
    `
      INSERT INTO field_activities (
        organization_id,
        assigned_to,
        activity_type,
        title,
        description,
        status,
        scheduled_at,
        latitude,
        longitude
      )
      VALUES (
        ?, ?, 'VISIT', ?, ?, ?, ?, ?, ?
      )
    `,
    [
      organizationId,
      assignedTo,
      title,
      "Created by Trust integration test.",
      status,
      scheduledAt,
      latitude,
      longitude,
    ]
  );

  return result.insertId;
}

async function createRouteEvent(
  connection,
  activityId,
  eventType,
  latitude = 10.72020000,
  longitude = 122.56210000,
  userId = FIELD_WORKER_ID
) {
  const [result] = await connection.execute(
    `
      INSERT INTO route_proof_events (
        organization_id,
        activity_id,
        user_id,
        event_type,
        latitude,
        longitude,
        accuracy_meters,
        recorded_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ORGANIZATION_ID,
      activityId,
      userId,
      eventType,
      latitude,
      longitude,
      10,
      eventType === "CHECK_IN"
        ? "2026-09-13 09:00:00"
        : "2026-09-13 09:30:00",
    ]
  );

  return result.insertId;
}

async function createEvidence(
  connection,
  activityId,
  verificationStatus = "VERIFIED"
) {
  const [result] = await connection.execute(
    `
      INSERT INTO evidence (
        activity_id,
        uploaded_by,
        evidence_type,
        file_name,
        file_path,
        mime_type,
        file_size,
        file_hash,
        verification_status,
        latitude,
        longitude,
        captured_at
      )
      VALUES (?, ?, 'PHOTO', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      activityId,
      OWNER_ID,
      `trust-test-${Date.now()}.jpg`,
      `/test/trust-test-${Date.now()}.jpg`,
      "image/jpeg",
      100,
      null,
      verificationStatus,
      10.72020000,
      122.56210000,
      "2026-09-13 09:15:00",
    ]
  );

  return result.insertId;
}

async function getActivity(connection, activityId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        assigned_to,
        status
      FROM field_activities
      WHERE id = ?
      LIMIT 1
    `,
    [activityId]
  );

  return rows[0] || null;
}

async function getLatestAssessment(
  connection,
  activityId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        activity_id,
        assessment_type,
        trust_score,
        risk_level,
        location_verified,
        timestamp_verified,
        duplicate_detected,
        document_verified,
        requires_review,
        explanation
      FROM risk_assessments
      WHERE activity_id = ?
        AND assessment_type = 'ACTIVITY'
      ORDER BY id DESC
      LIMIT 1
    `,
    [activityId]
  );

  return rows[0] || null;
}

async function countActivityReviews(
  connection,
  activityId
) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS count
      FROM reviews
      WHERE organization_id = ?
        AND activity_id = ?
    `,
    [ORGANIZATION_ID, activityId]
  );

  return Number(rows[0].count);
}

async function getOpenActivityReview(
  connection,
  activityId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        activity_id,
        status,
        priority,
        reason,
        risk_assessment_id
      FROM reviews
      WHERE organization_id = ?
        AND activity_id = ?
        AND status IN ('OPEN', 'IN_REVIEW')
      ORDER BY id DESC
      LIMIT 1
    `,
    [ORGANIZATION_ID, activityId]
  );

  return rows[0] || null;
}

async function countAuditEvents(
  connection,
  activityId,
  action
) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS count
      FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'FIELD_ACTIVITY'
        AND entity_id = ?
        AND action = ?
    `,
    [
      ORGANIZATION_ID,
      activityId,
      action,
    ]
  );

  return Number(rows[0].count);
}

async function countReviewCreatedAudits(
  connection,
  reviewId
) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS count
      FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'REVIEW'
        AND entity_id = ?
        AND action = 'REVIEW_CREATED'
    `,
    [
      ORGANIZATION_ID,
      reviewId,
    ]
  );

  return Number(rows[0].count);
}

async function cleanupActivity(
  connection,
  activityId
) {
  if (!activityId) {
    return;
  }

  await connection.execute(
    `
      DELETE FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'FIELD_ACTIVITY'
        AND entity_id = ?
    `,
    [
      ORGANIZATION_ID,
      activityId,
    ]
  );

  await connection.execute(
    `
      DELETE FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'REVIEW'
        AND entity_id IN (
          SELECT id
          FROM reviews
          WHERE organization_id = ?
            AND activity_id = ?
        )
    `,
    [
      ORGANIZATION_ID,
      ORGANIZATION_ID,
      activityId,
    ]
  );

  await connection.execute(
    `
      DELETE FROM reviews
      WHERE organization_id = ?
        AND activity_id = ?
    `,
    [
      ORGANIZATION_ID,
      activityId,
    ]
  );

  await connection.execute(
    `
      DELETE FROM risk_assessments
      WHERE activity_id = ?
    `,
    [activityId]
  );

  await connection.execute(
    `
      DELETE FROM evidence
      WHERE activity_id = ?
    `,
    [activityId]
  );

  await connection.execute(
    `
      DELETE FROM route_proof_events
      WHERE organization_id = ?
        AND activity_id = ?
    `,
    [
      ORGANIZATION_ID,
      activityId,
    ]
  );

  await connection.execute(
    `
      DELETE FROM field_activities
      WHERE organization_id = ?
        AND id = ?
    `,
    [
      ORGANIZATION_ID,
      activityId,
    ]
  );
}

test.before(async () => {
  await startServer();
});

test.after(async () => {
  await stopServer();
  await pool.end();
});

test(
  "GET trust assessment requires authentication",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/trust/activity/4`
    );

    assert.equal(response.status, 401);
  }
);

test(
  "POST trust assessment requires authentication",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/trust/activity/4/assess`,
      {
        method: "POST",
      }
    );

    assert.equal(response.status, 401);
  }
);

test(
  "FIELD_WORKER cannot create a trust assessment",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/trust/activity/4/assess`,
      {
        method: "POST",
        headers: {
          Cookie: await createAuthCookie(
            FIELD_WORKER_ID,
            ORGANIZATION_ID,
            "FIELD_WORKER"
          ),
        },
      }
    );

    assert.equal(response.status, 403);
  }
);

test(
  "FIELD_WORKER can read a trust assessment",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/trust/activity/4`,
      {
        headers: {
          Cookie: await createAuthCookie(
            FIELD_WORKER_ID,
            ORGANIZATION_ID,
            "FIELD_WORKER"
          ),
        },
      }
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.success, true);
    assert.equal(body.data.activityId, 4);
  }
);

test(
  "cross-organization trust assessment access is rejected",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/trust/activity/4`,
      {
        headers: {
          Cookie: await createAuthCookie(
            CROSS_ORG_OWNER_ID,
            CROSS_ORG_ORGANIZATION_ID,
            "OWNER"
          ),
        },
      }
    );

    assert.equal(response.status, 404);
  }
);

test(
  "invalid activity ID is rejected by validation",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/trust/activity/not-a-number`,
      {
        headers: {
          Cookie: await createAuthCookie(
            OWNER_ID,
            ORGANIZATION_ID,
            "OWNER"
          ),
        },
      }
    );

    assert.equal(response.status, 400);
  }
);

test(
  "POST creates a controlled low-risk trust assessment",
  async () => {
    const connection = await pool.getConnection();

    let activityId;

    try {
      activityId = await createActivity(
        connection,
        "SUCCESS"
      );

      await createRouteEvent(
        connection,
        activityId,
        "CHECK_IN"
      );

      await createRouteEvent(
        connection,
        activityId,
        "CHECK_OUT"
      );

      await createEvidence(
        connection,
        activityId,
        "VERIFIED"
      );

      const response = await fetch(
        `${baseUrl}/api/trust/activity/${activityId}/assess`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              "OWNER"
            ),
          },
        }
      );

      assert.equal(response.status, 201);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.equal(
        body.message,
        "Trust assessment created"
      );

      assert.equal(
        body.data.activityId,
        activityId
      );

      assert.equal(
        typeof body.data.riskAssessmentId,
        "number"
      );

      assert.equal(
        body.data.trustScore >= 0 &&
          body.data.trustScore <= 100,
        true
      );

      assert.equal(
        ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(
          body.data.riskLevel
        ),
        true
      );

      const assessment =
        await getLatestAssessment(
          connection,
          activityId
        );

      assert.ok(assessment);

      assert.equal(
        assessment.activity_id,
        activityId
      );

      assert.equal(
        assessment.assessment_type,
        "ACTIVITY"
      );

      assert.equal(
        Number(assessment.trust_score),
        body.data.trustScore
      );

      assert.equal(
        assessment.location_verified,
        1
      );

      assert.equal(
        assessment.timestamp_verified,
        1
      );

      assert.equal(
        assessment.document_verified,
        1
      );

      assert.equal(
        assessment.requires_review,
        0
      );

      assert.equal(
        await countActivityReviews(
          connection,
          activityId
        ),
        0
      );

      assert.equal(
        await countAuditEvents(
          connection,
          activityId,
          "TRUST_ASSESSMENT_CREATED"
        ),
        1
      );
    } finally {
      await cleanupActivity(
        connection,
        activityId
      );

      connection.release();
    }
  }
);

test(
  "POST creates a review when trust assessment requires review",
  async () => {
    const connection = await pool.getConnection();

    let activityId;

    try {
      activityId = await createActivity(
        connection,
        "REVIEW"
      );

      const response = await fetch(
        `${baseUrl}/api/trust/activity/${activityId}/assess`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              "OWNER"
            ),
          },
        }
      );

      assert.equal(response.status, 201);

      const body = await response.json();

      assert.equal(
        body.data.activityId,
        activityId
      );

      assert.equal(
        body.data.requiresReview,
        true
      );

      assert.equal(
        body.data.reviewId !== null,
        true
      );

      const review =
        await getOpenActivityReview(
          connection,
          activityId
        );

      assert.ok(review);

      assert.equal(
        review.activity_id,
        activityId
      );

      assert.equal(
        review.status,
        "OPEN"
      );

      assert.equal(
        Number(review.risk_assessment_id),
        Number(body.data.riskAssessmentId)
      );

      assert.equal(
        await countAuditEvents(
          connection,
          activityId,
          "TRUST_ASSESSMENT_CREATED"
        ),
        1
      );
    } finally {
      await cleanupActivity(
        connection,
        activityId
      );

      connection.release();
    }
  }
);

test(
  "second assessment reuses the existing open activity review",
  async () => {
    const connection = await pool.getConnection();

    let activityId;

    try {
      activityId = await createActivity(
        connection,
        "REUSE"
      );

      const firstResponse = await fetch(
        `${baseUrl}/api/trust/activity/${activityId}/assess`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              "OWNER"
            ),
          },
        }
      );

      assert.equal(
        firstResponse.status,
        201
      );

      const firstBody =
        await firstResponse.json();

      const secondResponse = await fetch(
        `${baseUrl}/api/trust/activity/${activityId}/assess`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              "OWNER"
            ),
          },
        }
      );

      assert.equal(
        secondResponse.status,
        201
      );

      const secondBody =
        await secondResponse.json();

      assert.equal(
        firstBody.data.reviewId,
        secondBody.data.reviewId
      );

      assert.equal(
        await countActivityReviews(
          connection,
          activityId
        ),
        1
      );

      assert.equal(
        await countAuditEvents(
          connection,
          activityId,
          "TRUST_ASSESSMENT_CREATED"
        ),
        2
      );
    } finally {
      await cleanupActivity(
        connection,
        activityId
      );

      connection.release();
    }
  }
);

test(
  "Trust-created activity review creates a centralized REVIEW_CREATED audit",
  async () => {
    const connection = await pool.getConnection();

    let activityId;

    try {
      activityId = await createActivity(
        connection,
        "AUDIT-CENTRALIZED"
      );

      const response = await fetch(
        `${baseUrl}/api/trust/activity/${activityId}/assess`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              "OWNER"
            ),
          },
        }
      );

      assert.equal(response.status, 201);

      const body = await response.json();

      assert.equal(
        body.data.reviewId !== null,
        true
      );

      const reviewId =
        body.data.reviewId;

      assert.equal(
        await countReviewCreatedAudits(
          connection,
          reviewId
        ),
        1
      );

      const [rows] = await connection.execute(
        `
          SELECT
            actor_id,
            organization_id,
            action,
            entity_type,
            entity_id,
            new_values
          FROM audit_events
          WHERE action = 'REVIEW_CREATED'
            AND entity_type = 'REVIEW'
            AND entity_id = ?
          ORDER BY id DESC
          LIMIT 1
        `,
        [reviewId]
      );

      assert.equal(rows.length, 1);

      assert.equal(
        rows[0].actor_id,
        OWNER_ID
      );

      assert.equal(
        rows[0].organization_id,
        ORGANIZATION_ID
      );

      assert.equal(
        rows[0].action,
        "REVIEW_CREATED"
      );

      assert.equal(
        rows[0].entity_type,
        "REVIEW"
      );

      assert.equal(
        Number(rows[0].entity_id),
        Number(reviewId)
      );

      const auditPayload =
        JSON.parse(rows[0].new_values);

      assert.equal(
        auditPayload.status,
        "OPEN"
      );

      assert.equal(
        auditPayload.activityId,
        activityId
      );

      assert.equal(
        auditPayload.riskAssessmentId,
        body.data.riskAssessmentId
      );
    } finally {
      await cleanupActivity(
        connection,
        activityId
      );

      connection.release();
    }
  }
);


async function countOpenActivityReviews(
  connection,
  activityId
) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS count
      FROM reviews
      WHERE organization_id = ?
        AND activity_id = ?
        AND status IN ('OPEN', 'IN_REVIEW')
    `,
    [
      ORGANIZATION_ID,
      activityId,
    ]
  );

  return Number(rows[0].count);
}

async function countActivityRiskAssessments(
  connection,
  activityId
) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS count
      FROM risk_assessments
      WHERE activity_id = ?
        AND assessment_type = 'ACTIVITY'
    `,
    [activityId]
  );

  return Number(rows[0].count);
}

async function getTrustNotifications(
  connection,
  activityId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        user_id,
        organization_id,
        type,
        title,
        message,
        entity_type,
        entity_id
      FROM notifications
      WHERE organization_id = ?
        AND entity_type = 'FIELD_ACTIVITY'
        AND entity_id = ?
        AND type = 'TRUST_ASSESSMENT_REQUIRES_REVIEW'
      ORDER BY id ASC
    `,
    [
      ORGANIZATION_ID,
      activityId,
    ]
  );

  return rows;
}

async function getExpectedTrustNotificationRecipients(
  connection
) {
  const [rows] = await connection.execute(
    `
      SELECT DISTINCT
        u.id
      FROM users u
      INNER JOIN user_roles ur
        ON ur.user_id = u.id
      INNER JOIN roles r
        ON r.id = ur.role_id
      WHERE u.organization_id = ?
        AND u.is_active = 1
        AND r.name IN (
          'OWNER',
          'ADMIN',
          'MANAGER',
          'FINANCE'
        )
      ORDER BY u.id
    `,
    [ORGANIZATION_ID]
  );

  return rows.map((user) => Number(user.id));
}

async function cleanupTrustNotifications(
  connection,
  activityId
) {
  await connection.execute(
    `
      DELETE FROM notifications
      WHERE organization_id = ?
        AND entity_type = 'FIELD_ACTIVITY'
        AND entity_id = ?
        AND type = 'TRUST_ASSESSMENT_REQUIRES_REVIEW'
    `,
    [
      ORGANIZATION_ID,
      activityId,
    ]
  );
}


test(
  "concurrent trust assessments create one review and one notification per recipient",
  async () => {
    const connection = await pool.getConnection();

    let activityId;

    try {
      activityId = await createActivity(
        connection,
        "CONCURRENT"
      );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const headers = {
        Cookie: cookie,
      };

      const [first, second] = await Promise.all([
        fetch(
          `${baseUrl}/api/trust/activity/${activityId}/assess`,
          {
            method: "POST",
            headers,
          }
        ),
        fetch(
          `${baseUrl}/api/trust/activity/${activityId}/assess`,
          {
            method: "POST",
            headers,
          }
        ),
      ]);

      assert.equal(
        first.status,
        201,
        "First concurrent Trust assessment must succeed"
      );

      assert.equal(
        second.status,
        201,
        "Second concurrent Trust assessment must succeed"
      );

      const firstBody =
        await first.json();

      const secondBody =
        await second.json();

      assert.equal(
        firstBody.success,
        true
      );

      assert.equal(
        secondBody.success,
        true
      );

      assert.equal(
        firstBody.data.requiresReview,
        true
      );

      assert.equal(
        secondBody.data.requiresReview,
        true
      );

      assert.equal(
        firstBody.data.reviewId,
        secondBody.data.reviewId,
        "Concurrent assessments must reuse the same open review"
      );

      const checkConnection =
        await pool.getConnection();

      try {
        const openReviewCount =
          await countOpenActivityReviews(
            checkConnection,
            activityId
          );

        assert.equal(
          openReviewCount,
          1,
          "Concurrent Trust assessments must create exactly one open review"
        );

        const assessmentCount =
          await countActivityRiskAssessments(
            checkConnection,
            activityId
          );

        assert.equal(
          assessmentCount,
          2,
          "Both concurrent assessments should be persisted"
        );

        const reviewCreatedAuditCount =
          await countReviewCreatedAudits(
            checkConnection,
            firstBody.data.reviewId
          );

        assert.equal(
          reviewCreatedAuditCount,
          1,
          "Concurrent Trust assessments must create exactly one REVIEW_CREATED audit"
        );

        const notifications =
          await getTrustNotifications(
            checkConnection,
            activityId
          );

        const expectedRecipients =
          await getExpectedTrustNotificationRecipients(
            checkConnection
          );

        const actualRecipients =
          notifications
            .map((notification) =>
              Number(notification.user_id)
            )
            .sort((a, b) => a - b);

        assert.deepEqual(
          actualRecipients,
          expectedRecipients,
          "Exactly one notification must exist for each eligible management/finance recipient"
        );

        assert.equal(
          notifications.length,
          expectedRecipients.length,
          "Concurrent Trust assessments must not duplicate notifications"
        );

        for (const notification of notifications) {
          assert.equal(
            notification.organization_id,
            ORGANIZATION_ID
          );

          assert.equal(
            notification.type,
            "TRUST_ASSESSMENT_REQUIRES_REVIEW"
          );

          assert.equal(
            notification.entity_type,
            "FIELD_ACTIVITY"
          );

          assert.equal(
            Number(notification.entity_id),
            Number(activityId)
          );
        }
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupTrustNotifications(
          cleanupConnection,
          activityId
        );

        await cleanupActivity(
          cleanupConnection,
          activityId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);
