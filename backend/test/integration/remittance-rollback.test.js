const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../../src/config/database");
const fieldLedgerService = require("../../src/services/fieldLedgerService");
const reviewService = require("../../src/services/reviewService");

const ORGANIZATION_ID = 1;
const ACTOR_ID = 1;
const COLLECTOR_ID = 4;

const currentUser = {
  id: ACTOR_ID,
  organizationId: ORGANIZATION_ID,
  roles: ["OWNER"],
};

const TEST_REFERENCE = `AUTO-ROLLBACK-${Date.now()}`;

let remittanceId;
let transactionId;

test.before(async () => {
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
        4,
        TEST_REFERENCE,
        5000,
        ACTOR_ID,
      ]
    );

    transactionId = transactionResult.insertId;

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
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `,
      [
        ORGANIZATION_ID,
        COLLECTOR_ID,
        TEST_REFERENCE,
        5000,
        4000,
      ]
    );

    remittanceId = remittanceResult.insertId;

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
        2,
        5000,
      ]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

test("verifyRemittance rolls back all changes when review creation fails", async () => {
  const originalCreateReview = reviewService.createReview;

  reviewService.createReview = async () => {
    throw new Error("Forced review creation failure for rollback test.");
  };

  try {
    await assert.rejects(
      fieldLedgerService.verifyRemittance(
        ORGANIZATION_ID,
        currentUser,
        remittanceId
      ),
      {
        message:
          "Forced review creation failure for rollback test.",
      }
    );
  } finally {
    reviewService.createReview = originalCreateReview;
  }

  const [remittanceRows] = await pool.execute(
    `
      SELECT
        status,
        expected_amount,
        actual_amount,
        variance_amount,
        verified_by
      FROM remittances
      WHERE id = ?
        AND organization_id = ?
    `,
    [remittanceId, ORGANIZATION_ID]
  );

  assert.equal(remittanceRows.length, 1);

  const remittance = remittanceRows[0];

  assert.equal(remittance.status, "PENDING");
  assert.equal(Number(remittance.expected_amount), 5000);
  assert.equal(Number(remittance.actual_amount), 4000);
  assert.equal(remittance.variance_amount, "-1000.00");
  assert.equal(remittance.verified_by, null);

  const [reconciliationRows] = await pool.execute(
    `
      SELECT id
      FROM reconciliations
      WHERE remittance_id = ?
    `,
    [remittanceId]
  );

  assert.equal(reconciliationRows.length, 0);

  const [transactionRows] = await pool.execute(
    `
      SELECT
        status,
        amount
      FROM transactions
      WHERE id = ?
        AND organization_id = ?
    `,
    [transactionId, ORGANIZATION_ID]
  );

  assert.equal(transactionRows.length, 1);
  assert.equal(transactionRows[0].status, "CONFIRMED");
  assert.equal(Number(transactionRows[0].amount), 5000);

  const [reviewRows] = await pool.execute(
    `
      SELECT id
      FROM reviews
      WHERE organization_id = ?
        AND transaction_id = ?
    `,
    [ORGANIZATION_ID, transactionId]
  );

  assert.equal(reviewRows.length, 0);

  const [auditRows] = await pool.execute(
    `
      SELECT id
      FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'REMITTANCE'
        AND entity_id = ?
        AND action IN (
          'REMITTANCE_VERIFIED',
          'REMITTANCE_DISPUTED'
        )
    `,
    [ORGANIZATION_ID, remittanceId]
  );

  assert.equal(auditRows.length, 0);
});

test.after(async () => {
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
        DELETE FROM reviews
        WHERE organization_id = ?
          AND transaction_id = ?
      `,
      [ORGANIZATION_ID, transactionId]
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
        DELETE FROM remittance_items
        WHERE remittance_id = ?
      `,
      [remittanceId]
    );

    await connection.execute(
      `
        DELETE FROM reconciliations
        WHERE remittance_id = ?
      `,
      [remittanceId]
    );

    await connection.execute(
      `
        DELETE FROM remittances
        WHERE id = ?
          AND organization_id = ?
      `,
      [remittanceId, ORGANIZATION_ID]
    );

    await connection.execute(
      `
        DELETE FROM transactions
        WHERE id = ?
          AND organization_id = ?
      `,
      [transactionId, ORGANIZATION_ID]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
});
