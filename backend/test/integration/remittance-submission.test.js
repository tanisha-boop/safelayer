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
const ACTIVITY_ID = 4;

let server;
let baseUrl;

async function createAuthCookie(
  userId,
  organizationId,
  roles
) {
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

  assert.equal(rows.length, 1);

  const token = generateAccessToken({
    id: userId,
    organization_id: organizationId,
    roles,
    token_version: rows[0].token_version,
  });

  return `access_token=${token}`;
}

async function createRemittance({
  reference,
  collectorId = FIELD_WORKER_ID,
  includeItem = true,
  status = "PENDING",
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let transactionId = null;
    let collectionId = null;

    if (includeItem) {
      const [transactionResult] =
        await connection.execute(
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
            VALUES (
              ?, ?, ?, 'COLLECTION',
              5000, 'PHP', 'CONFIRMED',
              NOW(), ?
            )
          `,
          [
            ORGANIZATION_ID,
            ACTIVITY_ID,
            `${reference}-TX`,
            collectorId,
          ]
        );

      transactionId = transactionResult.insertId;

      const [collectionResult] =
        await connection.execute(
          `
            INSERT INTO collection_records (
              organization_id,
              activity_id,
              collector_id,
              reference_number,
              expected_amount,
              collected_amount,
              collection_status,
              collected_at,
              notes
            )
            VALUES (
              ?, ?, ?, ?, 5000, 5000,
              'COLLECTED', NOW(), ?
            )
          `,
          [
            ORGANIZATION_ID,
            ACTIVITY_ID,
            collectorId,
            `${reference}-COLL`,
            "Remittance submission integration test",
          ]
        );

      collectionId = collectionResult.insertId;
    }

    const [remittanceResult] =
      await connection.execute(
        `
          INSERT INTO remittances (
            organization_id,
            collector_id,
            remittance_reference,
            expected_amount,
            actual_amount,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          ORGANIZATION_ID,
          collectorId,
          reference,
          includeItem ? 5000 : 0,
          includeItem ? 5000 : 0,
          status,
        ]
      );

    const remittanceId = remittanceResult.insertId;

    if (includeItem) {
      await connection.execute(
        `
          INSERT INTO remittance_transactions (
            remittance_id,
            transaction_id
          )
          VALUES (?, ?)
        `,
        [remittanceId, transactionId]
      );

      await connection.execute(
        `
          INSERT INTO remittance_items (
            organization_id,
            remittance_id,
            collection_id,
            amount
          )
          VALUES (?, ?, ?, ?)
        `,
        [
          ORGANIZATION_ID,
          remittanceId,
          collectionId,
          5000,
        ]
      );
    }

    await connection.commit();

    return {
      remittanceId,
      transactionId,
      collectionId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getRemittance(remittanceId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        collector_id,
        status,
        expected_amount,
        actual_amount,
        submitted_at,
        verified_by,
        verified_at
      FROM remittances
      WHERE organization_id = ?
        AND id = ?
      LIMIT 1
    `,
    [ORGANIZATION_ID, remittanceId]
  );

  return rows[0] || null;
}

async function countSubmissionAuditEvents(remittanceId) {
  const [rows] = await pool.execute(
    `
      SELECT COUNT(*) AS count
      FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'REMITTANCE'
        AND entity_id = ?
        AND action = 'REMITTANCE_SUBMITTED'
    `,
    [ORGANIZATION_ID, remittanceId]
  );

  return Number(rows[0].count);
}

async function deleteRemittance({
  remittanceId,
  transactionId,
  collectionId,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        DELETE FROM audit_events
        WHERE organization_id = ?
          AND entity_type = 'REMITTANCE'
          AND entity_id = ?
      `,
      [ORGANIZATION_ID, remittanceId]
    );

    await connection.execute(
      `
        DELETE FROM remittance_items
        WHERE organization_id = ?
          AND remittance_id = ?
      `,
      [ORGANIZATION_ID, remittanceId]
    );

    await connection.execute(
      `
        DELETE FROM remittance_transactions
        WHERE remittance_id = ?
      `,
      [remittanceId]
    );

    await connection.execute(
      `
        DELETE FROM remittances
        WHERE organization_id = ?
          AND id = ?
      `,
      [ORGANIZATION_ID, remittanceId]
    );

    if (transactionId) {
      await connection.execute(
        `
          DELETE FROM transactions
          WHERE organization_id = ?
            AND id = ?
        `,
        [ORGANIZATION_ID, transactionId]
      );
    }

    if (collectionId) {
      await connection.execute(
        `
          DELETE FROM collection_records
          WHERE organization_id = ?
            AND id = ?
        `,
        [ORGANIZATION_ID, collectionId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

test.before(async () => {
  server = app.listen(0);

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  await pool.end();
});

test(
  "FIELD_WORKER can submit their own pending remittance",
  async () => {
    const reference = `AUTO-SUBMIT-WORKER-${Date.now()}`;

    const fixture = await createRemittance({
      reference,
      collectorId: FIELD_WORKER_ID,
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${fixture.remittanceId}/submit`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              FIELD_WORKER_ID,
              ORGANIZATION_ID,
              ["FIELD_WORKER"]
            ),
          },
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);

      const remittance =
        await getRemittance(fixture.remittanceId);

      assert.equal(
        remittance.status,
        "SUBMITTED"
      );

      assert.ok(remittance.submitted_at);

      assert.equal(
        await countSubmissionAuditEvents(
          fixture.remittanceId
        ),
        1
      );
    } finally {
      await deleteRemittance(fixture);
    }
  }
);

test(
  "FIELD_WORKER cannot submit another worker's remittance",
  async () => {
    const reference = `AUTO-SUBMIT-FORBIDDEN-${Date.now()}`;

    const fixture = await createRemittance({
      reference,
      collectorId: OWNER_ID,
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${fixture.remittanceId}/submit`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              FIELD_WORKER_ID,
              ORGANIZATION_ID,
              ["FIELD_WORKER"]
            ),
          },
        }
      );

      assert.equal(response.status, 403);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "You are not authorized to submit this remittance"
      );

      const remittance =
        await getRemittance(fixture.remittanceId);

      assert.equal(
        remittance.status,
        "PENDING"
      );

      assert.equal(
        await countSubmissionAuditEvents(
          fixture.remittanceId
        ),
        0
      );
    } finally {
      await deleteRemittance(fixture);
    }
  }
);

test(
  "FIELD_WORKER cannot submit an empty remittance",
  async () => {
    const reference = `AUTO-SUBMIT-EMPTY-${Date.now()}`;

    const fixture = await createRemittance({
      reference,
      collectorId: FIELD_WORKER_ID,
      includeItem: false,
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${fixture.remittanceId}/submit`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              FIELD_WORKER_ID,
              ORGANIZATION_ID,
              ["FIELD_WORKER"]
            ),
          },
        }
      );

      assert.equal(response.status, 400);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "A remittance must contain at least one collected record before submission"
      );

      const remittance =
        await getRemittance(fixture.remittanceId);

      assert.equal(
        remittance.status,
        "PENDING"
      );
    } finally {
      await deleteRemittance(fixture);
    }
  }
);

test(
  "FIELD_WORKER cannot submit an already submitted remittance",
  async () => {
    const reference = `AUTO-SUBMIT-DUPLICATE-${Date.now()}`;

    const fixture = await createRemittance({
      reference,
      collectorId: FIELD_WORKER_ID,
      status: "SUBMITTED",
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${fixture.remittanceId}/submit`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              FIELD_WORKER_ID,
              ORGANIZATION_ID,
              ["FIELD_WORKER"]
            ),
          },
        }
      );

      assert.equal(response.status, 409);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "Only pending remittances can be submitted"
      );

      const remittance =
        await getRemittance(fixture.remittanceId);

      assert.equal(
        remittance.status,
        "SUBMITTED"
      );

      assert.equal(
        await countSubmissionAuditEvents(
          fixture.remittanceId
        ),
        0
      );
    } finally {
      await deleteRemittance(fixture);
    }
  }
);

test(
  "cross-organization owner cannot submit another organization's remittance",
  async () => {
    const reference = `AUTO-SUBMIT-CROSS-ORG-${Date.now()}`;

    const fixture = await createRemittance({
      reference,
      collectorId: FIELD_WORKER_ID,
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${fixture.remittanceId}/submit`,
        {
          method: "POST",
          headers: {
            Cookie: await createAuthCookie(
              CROSS_ORG_OWNER_ID,
              CROSS_ORG_ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 404);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "Remittance not found"
      );

      const remittance =
        await getRemittance(fixture.remittanceId);

      assert.equal(
        remittance.status,
        "PENDING"
      );
    } finally {
      await deleteRemittance(fixture);
    }
  }
);
