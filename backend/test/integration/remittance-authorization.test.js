const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const pool = require("../../src/config/database");
const { generateAccessToken } = require("../../src/utils/jwt");

const OWNER_ID = 1;
const FIELD_WORKER_ID = 4;
const ORGANIZATION_ID = 1;
const ACTIVITY_ID = 4;

let server;
let baseUrl;

async function createTestRemittance(reference, status) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [transactionResult] = await connection.execute(
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
        VALUES (?, ?, ?, 'COLLECTION', ?, 'PHP', 'CONFIRMED', NOW(), ?)
      `,
      [
        ORGANIZATION_ID,
        ACTIVITY_ID,
        `${reference}-TX`,
        5000,
        FIELD_WORKER_ID,
      ]
    );

    const transactionId = transactionResult.insertId;

    const [collectionResult] = await connection.execute(
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
        VALUES (?, ?, ?, ?, ?, ?, 'COLLECTED', NOW(), ?)
      `,
      [
        ORGANIZATION_ID,
        ACTIVITY_ID,
        FIELD_WORKER_ID,
        `${reference}-COLL`,
        5000,
        5000,
        "Authorization/state test collection",
      ]
    );

    const collectionId = collectionResult.insertId;

    const [remittanceResult] = await connection.execute(
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
        FIELD_WORKER_ID,
        reference,
        5000,
        5000,
        status,
      ]
    );

    const remittanceId = remittanceResult.insertId;

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
        status,
        expected_amount,
        actual_amount,
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

async function countReconciliations(remittanceId) {
  const [rows] = await pool.execute(
    `
      SELECT COUNT(*) AS count
      FROM reconciliations
      WHERE organization_id = ?
        AND remittance_id = ?
    `,
    [ORGANIZATION_ID, remittanceId]
  );

  return Number(rows[0].count);
}

async function countReviewsForTransaction(transactionId) {
  const [rows] = await pool.execute(
    `
      SELECT COUNT(*) AS count
      FROM reviews
      WHERE organization_id = ?
        AND transaction_id = ?
    `,
    [ORGANIZATION_ID, transactionId]
  );

  return Number(rows[0].count);
}

async function deleteTestRemittance(
  remittanceId,
  transactionId,
  collectionId
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        DELETE FROM audit_events
        WHERE organization_id = ?
          AND (
            entity_id = ?
            OR entity_id = ?
          )
          AND entity_type IN ('REMITTANCE', 'TRANSACTION')
      `,
      [
        ORGANIZATION_ID,
        remittanceId,
        transactionId,
      ]
    );

    await connection.execute(
      `
        DELETE FROM reviews
        WHERE organization_id = ?
          AND transaction_id = ?
      `,
      [ORGANIZATION_ID, transactionId]
    );

    await connection.execute(
      `
        DELETE FROM reconciliations
        WHERE organization_id = ?
          AND remittance_id = ?
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
          AND transaction_id = ?
      `,
      [remittanceId, transactionId]
    );

    await connection.execute(
      `
        DELETE FROM remittances
        WHERE organization_id = ?
          AND id = ?
      `,
      [ORGANIZATION_ID, remittanceId]
    );

    await connection.execute(
      `
        DELETE FROM transactions
        WHERE organization_id = ?
          AND id = ?
      `,
      [ORGANIZATION_ID, transactionId]
    );

    await connection.execute(
      `
        DELETE FROM collection_records
        WHERE organization_id = ?
          AND id = ?
      `,
      [ORGANIZATION_ID, collectionId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function createAuthCookie(userId, roles) {
  const token = generateAccessToken({
    id: userId,
    organization_id: ORGANIZATION_ID,
    roles,
  });

  return `access_token=${token}`;
}

test.before(async () => {
  server = app.listen(0);

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});


test(
  "unauthenticated user cannot verify a remittance",
  async () => {
    const reference = `AUTO-AUTH-UNAUTH-${Date.now()}`;

    const {
      remittanceId,
      transactionId,
      collectionId,
    } = await createTestRemittance(
      reference,
      "PENDING"
    );

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${remittanceId}/verify`,
        {
          method: "POST",
        }
      );

      assert.equal(response.status, 401);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(body.message, "Authentication required");

      const remittance =
        await getRemittance(remittanceId);

      assert.equal(
        remittance.status,
        "PENDING"
      );

      assert.equal(
        await countReconciliations(remittanceId),
        0
      );

      assert.equal(
        await countReviewsForTransaction(transactionId),
        0
      );
    } finally {
      await deleteTestRemittance(
        remittanceId,
        transactionId,
        collectionId
      );
    }
  }
);

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
  "FIELD_WORKER cannot verify a remittance and no database changes occur",
  async () => {
    const reference = `AUTO-AUTH-FIELD-${Date.now()}`;

    const {
      remittanceId,
      transactionId,
      collectionId,
    } = await createTestRemittance(
      reference,
      "PENDING"
    );

    try {
      const beforeRemittance =
        await getRemittance(remittanceId);

      const beforeReconciliations =
        await countReconciliations(remittanceId);

      const beforeReviews =
        await countReviewsForTransaction(transactionId);

      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${remittanceId}/verify`,
        {
          method: "POST",
          headers: {
            Cookie: createAuthCookie(
              FIELD_WORKER_ID,
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
        "You do not have permission to perform this action"
      );

      const afterRemittance =
        await getRemittance(remittanceId);

      const afterReconciliations =
        await countReconciliations(remittanceId);

      const afterReviews =
        await countReviewsForTransaction(transactionId);

      assert.deepEqual(
        afterRemittance,
        beforeRemittance
      );

      assert.equal(
        afterReconciliations,
        beforeReconciliations
      );

      assert.equal(
        afterReviews,
        beforeReviews
      );
    } finally {
      await deleteTestRemittance(
        remittanceId,
        transactionId,
        collectionId
      );
    }
  }
);

test(
  "authorized user cannot verify an already DISPUTED remittance",
  async () => {
    const reference = `AUTO-AUTH-DISPUTED-${Date.now()}`;

    const {
      remittanceId,
      transactionId,
      collectionId,
    } = await createTestRemittance(
      reference,
      "DISPUTED"
    );

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${remittanceId}/verify`,
        {
          method: "POST",
          headers: {
            Cookie: createAuthCookie(
              OWNER_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 409);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "This remittance has already been processed"
      );

      const remittance =
        await getRemittance(remittanceId);

      assert.equal(
        remittance.status,
        "DISPUTED"
      );

      assert.equal(
        await countReconciliations(remittanceId),
        0
      );

      assert.equal(
        await countReviewsForTransaction(transactionId),
        0
      );
    } finally {
      await deleteTestRemittance(
        remittanceId,
        transactionId,
        collectionId
      );
    }
  }
);

test(
  "authorized user cannot verify an already VERIFIED remittance",
  async () => {
    const reference = `AUTO-AUTH-VERIFIED-${Date.now()}`;

    const {
      remittanceId,
      transactionId,
      collectionId,
    } = await createTestRemittance(
      reference,
      "VERIFIED"
    );

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/remittances/${remittanceId}/verify`,
        {
          method: "POST",
          headers: {
            Cookie: createAuthCookie(
              OWNER_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 409);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "This remittance has already been processed"
      );

      const remittance =
        await getRemittance(remittanceId);

      assert.equal(
        remittance.status,
        "VERIFIED"
      );

      assert.equal(
        await countReconciliations(remittanceId),
        0
      );

      assert.equal(
        await countReviewsForTransaction(transactionId),
        0
      );
    } finally {
      await deleteTestRemittance(
        remittanceId,
        transactionId,
        collectionId
      );
    }
  }
);
