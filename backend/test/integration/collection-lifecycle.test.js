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

async function createAuthCookie(userId, organizationId, roles) {
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

async function createCollectionActivity({
  organizationId = ORGANIZATION_ID,
  assignedTo = FIELD_WORKER_ID,
}) {
  const [result] = await pool.execute(
    `
      INSERT INTO field_activities (
        organization_id,
        assigned_to,
        activity_type,
        title,
        description,
        status,
        scheduled_at
      )
      VALUES (?, ?, 'COLLECTION', ?, ?, 'PENDING', NOW())
    `,
    [
      organizationId,
      assignedTo,
      `Collection Test ${Date.now()}`,
      "Collection lifecycle integration test",
    ]
  );

  return result.insertId;
}

async function getCollection(collectionId, organizationId = ORGANIZATION_ID) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        activity_id,
        collector_id,
        reference_number,
        expected_amount,
        collected_amount,
        collection_status,
        collected_at,
        notes
      FROM collection_records
      WHERE organization_id = ?
        AND id = ?
      LIMIT 1
    `,
    [organizationId, collectionId]
  );

  return rows[0] || null;
}

async function getTransactionByReference(
  reference,
  organizationId = ORGANIZATION_ID
) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        activity_id,
        transaction_reference,
        transaction_type,
        amount,
        currency,
        status,
        created_by
      FROM transactions
      WHERE organization_id = ?
        AND transaction_reference = ?
      LIMIT 1
    `,
    [organizationId, reference]
  );

  return rows[0] || null;
}

async function countCollectionAuditEvents(collectionId) {
  const [rows] = await pool.execute(
    `
      SELECT COUNT(*) AS count
      FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'COLLECTION'
        AND entity_id = ?
        AND action = 'COLLECTION_RECORDED'
    `,
    [ORGANIZATION_ID, collectionId]
  );

  return Number(rows[0].count);
}

async function deleteCollectionFixture({
  activityId,
  collectionId = null,
  transactionReference = null,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (collectionId) {
      await connection.execute(
        `
          DELETE FROM audit_events
          WHERE organization_id = ?
            AND entity_type = 'COLLECTION'
            AND entity_id = ?
        `,
        [ORGANIZATION_ID, collectionId]
      );

      await connection.execute(
        `
          DELETE FROM collection_records
          WHERE organization_id = ?
            AND id = ?
        `,
        [ORGANIZATION_ID, collectionId]
      );
    }

    if (transactionReference) {
      await connection.execute(
        `
          DELETE FROM transactions
          WHERE organization_id = ?
            AND transaction_reference = ?
        `,
        [ORGANIZATION_ID, transactionReference]
      );
    }

    if (activityId) {
      await connection.execute(
        `
          DELETE FROM field_activities
          WHERE organization_id = ?
            AND id = ?
        `,
        [ORGANIZATION_ID, activityId]
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
  "OWNER can create a collection for a COLLECTION activity",
  async () => {
    const activityId = await createCollectionActivity({
      assignedTo: FIELD_WORKER_ID,
    });

    const reference = `COLL-CREATE-${Date.now()}`;

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
          body: JSON.stringify({
            activityId,
            collectorId: FIELD_WORKER_ID,
            referenceNumber: reference,
            expectedAmount: 5000,
            notes: "Collection creation integration test",
          }),
        }
      );

      assert.equal(response.status, 201);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.ok(body.data);
      assert.ok(body.data.id);

      const collection = await getCollection(body.data.id);

      assert.equal(collection.organization_id, ORGANIZATION_ID);
      assert.equal(collection.activity_id, activityId);
      assert.equal(collection.collector_id, FIELD_WORKER_ID);
      assert.equal(collection.reference_number, reference);
      assert.equal(Number(collection.expected_amount), 5000);
      assert.equal(Number(collection.collected_amount), 0);
      assert.equal(collection.collection_status, "EXPECTED");
    } finally {
      const [rows] = await pool.execute(
        `
          SELECT id
          FROM collection_records
          WHERE organization_id = ?
            AND reference_number = ?
          LIMIT 1
        `,
        [ORGANIZATION_ID, reference]
      );

      await deleteCollectionFixture({
        activityId,
        collectionId: rows[0]?.id || null,
      });
    }
  }
);

test(
  "FIELD_WORKER cannot create a collection record",
  async () => {
    const activityId = await createCollectionActivity({
      assignedTo: FIELD_WORKER_ID,
    });

    const reference = `COLL-FORBIDDEN-${Date.now()}`;

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              FIELD_WORKER_ID,
              ORGANIZATION_ID,
              ["FIELD_WORKER"]
            ),
          },
          body: JSON.stringify({
            activityId,
            collectorId: FIELD_WORKER_ID,
            referenceNumber: reference,
            expectedAmount: 5000,
          }),
        }
      );

      assert.equal(response.status, 403);

      const body = await response.json();

      assert.equal(body.success, false);

      const [rows] = await pool.execute(
        `
          SELECT id
          FROM collection_records
          WHERE organization_id = ?
            AND reference_number = ?
          LIMIT 1
        `,
        [ORGANIZATION_ID, reference]
      );

      assert.equal(rows.length, 0);
    } finally {
      await deleteCollectionFixture({
        activityId,
      });
    }
  }
);

test(
  "OWNER cannot create a collection for an activity assigned to another organization",
  async () => {
    const crossOrgActivityId = await createCollectionActivity({
      organizationId: CROSS_ORG_ORGANIZATION_ID,
      assignedTo: CROSS_ORG_OWNER_ID,
    });

    const reference = `COLL-CROSS-ORG-${Date.now()}`;

    try {
      const response = await fetch(
        `${baseUrl}/api/field-ledger/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
          body: JSON.stringify({
            activityId: crossOrgActivityId,
            collectorId: CROSS_ORG_OWNER_ID,
            referenceNumber: reference,
            expectedAmount: 5000,
          }),
        }
      );

      assert.equal(response.status, 404);

      const body = await response.json();

      assert.equal(body.success, false);

      const [rows] = await pool.execute(
        `
          SELECT id
          FROM collection_records
          WHERE organization_id = ?
            AND reference_number = ?
          LIMIT 1
        `,
        [ORGANIZATION_ID, reference]
      );

      assert.equal(rows.length, 0);
    } finally {
      await pool.execute(
        `
          DELETE FROM field_activities
          WHERE organization_id = ?
            AND id = ?
        `,
        [CROSS_ORG_ORGANIZATION_ID, crossOrgActivityId]
      );
    }
  }
);

test(
  "FIELD_WORKER can collect the expected amount and creates a confirmed transaction",
  async () => {
    const activityId = await createCollectionActivity({
      assignedTo: FIELD_WORKER_ID,
    });

    const collectionReference = `COLL-COLLECT-${Date.now()}`;
    const transactionReference = collectionReference;

    let collectionId = null;

    try {
      const createResponse = await fetch(
        `${baseUrl}/api/field-ledger/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
          body: JSON.stringify({
            activityId,
            collectorId: FIELD_WORKER_ID,
            referenceNumber: collectionReference,
            expectedAmount: 5000,
          }),
        }
      );

      assert.equal(createResponse.status, 201);

      const createBody = await createResponse.json();
      collectionId = createBody.data.id;

      const collectResponse = await fetch(
        `${baseUrl}/api/field-ledger/collections/${collectionId}/collect`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              FIELD_WORKER_ID,
              ORGANIZATION_ID,
              ["FIELD_WORKER"]
            ),
          },
          body: JSON.stringify({
            collectedAmount: 5000,
            notes: "Full payment collected",
          }),
        }
      );

      assert.equal(collectResponse.status, 200);

      const collectBody = await collectResponse.json();

      assert.equal(collectBody.success, true);

      const collection = await getCollection(collectionId);

      assert.equal(Number(collection.collected_amount), 5000);
      assert.equal(collection.collection_status, "COLLECTED");
      assert.ok(collection.collected_at);

      const transaction =
        await getTransactionByReference(transactionReference);

      assert.ok(transaction);
      assert.equal(transaction.transaction_type, "COLLECTION");
      assert.equal(Number(transaction.amount), 5000);
      assert.equal(transaction.status, "CONFIRMED");
      assert.equal(transaction.organization_id, ORGANIZATION_ID);
      assert.equal(transaction.created_by, FIELD_WORKER_ID);

      assert.equal(
        await countCollectionAuditEvents(collectionId),
        1
      );
    } finally {
      await deleteCollectionFixture({
        activityId,
        collectionId,
        transactionReference,
      });
    }
  }
);

test(
  "FIELD_WORKER collecting less than expected creates a PARTIAL collection",
  async () => {
    const activityId = await createCollectionActivity({
      assignedTo: FIELD_WORKER_ID,
    });

    const collectionReference = `COLL-PARTIAL-${Date.now()}`;
    const transactionReference = collectionReference;

    let collectionId = null;

    try {
      const createResponse = await fetch(
        `${baseUrl}/api/field-ledger/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
          body: JSON.stringify({
            activityId,
            collectorId: FIELD_WORKER_ID,
            referenceNumber: collectionReference,
            expectedAmount: 5000,
          }),
        }
      );

      assert.equal(createResponse.status, 201);

      collectionId = (await createResponse.json()).data.id;

      const response = await fetch(
        `${baseUrl}/api/field-ledger/collections/${collectionId}/collect`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              FIELD_WORKER_ID,
              ORGANIZATION_ID,
              ["FIELD_WORKER"]
            ),
          },
          body: JSON.stringify({
            collectedAmount: 3000,
          }),
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);

      const collection = await getCollection(collectionId);

      assert.equal(Number(collection.collected_amount), 3000);
      assert.equal(collection.collection_status, "PARTIAL");

      const transaction =
        await getTransactionByReference(transactionReference);

      assert.ok(transaction);
      assert.equal(Number(transaction.amount), 3000);
      assert.equal(transaction.status, "CONFIRMED");
    } finally {
      await deleteCollectionFixture({
        activityId,
        collectionId,
        transactionReference,
      });
    }
  }
);

test(
  "FIELD_WORKER collecting more than expected creates a DISPUTED collection and review transaction",
  async () => {
    const activityId = await createCollectionActivity({
      assignedTo: FIELD_WORKER_ID,
    });

    const collectionReference = `COLL-DISPUTED-${Date.now()}`;
    const transactionReference = collectionReference;

    let collectionId = null;

    try {
      const createResponse = await fetch(
        `${baseUrl}/api/field-ledger/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
          body: JSON.stringify({
            activityId,
            collectorId: FIELD_WORKER_ID,
            referenceNumber: collectionReference,
            expectedAmount: 5000,
          }),
        }
      );

      assert.equal(createResponse.status, 201);

      collectionId = (await createResponse.json()).data.id;

      const response = await fetch(
        `${baseUrl}/api/field-ledger/collections/${collectionId}/collect`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: await createAuthCookie(
              FIELD_WORKER_ID,
              ORGANIZATION_ID,
              ["FIELD_WORKER"]
            ),
          },
          body: JSON.stringify({
            collectedAmount: 6000,
          }),
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);

      const collection = await getCollection(collectionId);

      assert.equal(Number(collection.collected_amount), 6000);
      assert.equal(collection.collection_status, "DISPUTED");

      const transaction =
        await getTransactionByReference(transactionReference);

      assert.ok(transaction);
      assert.equal(Number(transaction.amount), 6000);
      assert.equal(transaction.status, "REQUIRES_REVIEW");
    } finally {
      await deleteCollectionFixture({
        activityId,
        collectionId,
        transactionReference,
      });
    }
  }
);
