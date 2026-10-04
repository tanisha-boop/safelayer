const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../../src/config/database");
const fieldLedgerService = require("../../src/services/fieldLedgerService");

const ORGANIZATION_ID = 1;
const ACTOR_ID = 1;
const COLLECTOR_ID = 4;
const ACTIVITY_ID = 4;

const currentUser = {
  id: ACTOR_ID,
  organizationId: ORGANIZATION_ID,
  roles: ["OWNER"],
};

const TEST_REFERENCE = `AUTO-MATCHED-${Date.now()}`;

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
        ACTIVITY_ID,
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
        VALUES (?, ?, ?, ?, ?, 'SUBMITTED')
      `,
      [
        ORGANIZATION_ID,
        COLLECTOR_ID,
        TEST_REFERENCE,
        5000,
        5000,
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

test(
  "verifyRemittance verifies a matched remittance",
  async () => {
    const result = await fieldLedgerService.verifyRemittance(
      ORGANIZATION_ID,
      currentUser,
      remittanceId
    );

    assert.equal(result.remittance.status, "VERIFIED");

    assert.equal(
      Number(result.reconciliation.expectedAmount),
      5000
    );

    assert.equal(
      Number(result.reconciliation.actualAmount),
      5000
    );

    assert.equal(
      Number(result.reconciliation.variance),
      0
    );

    assert.equal(
      result.reconciliation.status,
      "MATCHED"
    );

    const [remittanceRows] = await pool.execute(
      `
        SELECT
          status,
          expected_amount,
          actual_amount,
          variance_amount,
          verified_by,
          verified_at
        FROM remittances
        WHERE id = ?
          AND organization_id = ?
      `,
      [remittanceId, ORGANIZATION_ID]
    );

    assert.equal(remittanceRows.length, 1);
    assert.equal(remittanceRows[0].status, "VERIFIED");

    assert.equal(
      Number(remittanceRows[0].expected_amount),
      5000
    );

    assert.equal(
      Number(remittanceRows[0].actual_amount),
      5000
    );

    assert.equal(
      Number(remittanceRows[0].variance_amount),
      0
    );

    assert.equal(
      Number(remittanceRows[0].verified_by),
      ACTOR_ID
    );

    assert.ok(remittanceRows[0].verified_at);

    const [reconciliationRows] = await pool.execute(
      `
        SELECT
          expected_amount,
          actual_amount,
          variance_amount,
          status
        FROM reconciliations
        WHERE remittance_id = ?
          AND organization_id = ?
      `,
      [remittanceId, ORGANIZATION_ID]
    );

    assert.equal(reconciliationRows.length, 1);

    assert.equal(
      Number(reconciliationRows[0].expected_amount),
      5000
    );

    assert.equal(
      Number(reconciliationRows[0].actual_amount),
      5000
    );

    assert.equal(
      Number(reconciliationRows[0].variance_amount),
      0
    );

    assert.equal(
      reconciliationRows[0].status,
      "MATCHED"
    );

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
        SELECT action
        FROM audit_events
        WHERE organization_id = ?
          AND entity_type = 'REMITTANCE'
          AND entity_id = ?
          AND action = 'REMITTANCE_VERIFIED'
      `,
      [ORGANIZATION_ID, remittanceId]
    );

    assert.equal(auditRows.length, 1);

    assert.equal(
      auditRows[0].action,
      "REMITTANCE_VERIFIED"
    );
  }
);

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
        DELETE FROM reconciliations
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
        DELETE FROM remittance_items
        WHERE organization_id = ?
          AND remittance_id = ?
      `,
      [ORGANIZATION_ID, remittanceId]
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

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
});
