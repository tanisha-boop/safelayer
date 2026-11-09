const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../../src/config/database");
const fieldLedgerService = require("../../src/services/fieldLedgerService");

const ORGANIZATION_ID = 1;
const COLLECTOR_ID = 4;
const ACTIVITY_ID = 4;

async function createTransaction(connection, reference, amount) {
  const [result] = await connection.execute(
    `INSERT INTO transactions (
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
    VALUES (?, ?, ?, 'COLLECTION', ?, 'PHP', 'CONFIRMED', NOW(), ?)`,
    [
      ORGANIZATION_ID,
      ACTIVITY_ID,
      reference,
      amount,
      COLLECTOR_ID,
    ]
  );

  return result.insertId;
}

async function createCollection(connection, reference, amount) {
  const [result] = await connection.execute(
    `INSERT INTO collection_records (
      organization_id,
      activity_id,
      collector_id,
      reference_number,
      expected_amount,
      collected_amount,
      collection_status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'COLLECTED')`,
    [
      ORGANIZATION_ID,
      ACTIVITY_ID,
      COLLECTOR_ID,
      reference,
      amount,
      amount,
    ]
  );

  return result.insertId;
}

async function createRemittance(connection, reference) {
  const [result] = await connection.execute(
    `INSERT INTO remittances (
      organization_id,
      collector_id,
      remittance_reference,
      expected_amount,
      actual_amount,
      status
    )
    VALUES (?, ?, ?, 0.00, 1000.00, 'PENDING')`,
    [
      ORGANIZATION_ID,
      COLLECTOR_ID,
      reference,
    ]
  );

  return result.insertId;
}

test("concurrent remittances cannot both claim the same collection", async () => {
  const connection = await pool.getConnection();

  let transactionId;
  let collectionId;
  let remittanceA;
  let remittanceB;

  try {
    await connection.beginTransaction();

    const reference = `INTEGRITY-CONC-${Date.now()}`;

    transactionId = await createTransaction(
      connection,
      reference,
      1000
    );

    collectionId = await createCollection(
      connection,
      reference,
      1000
    );

    remittanceA = await createRemittance(
      connection,
      `REMIT-A-${Date.now()}`
    );

    remittanceB = await createRemittance(
      connection,
      `REMIT-B-${Date.now()}`
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }

  connection.release();

  const currentUser = {
    id: COLLECTOR_ID,
    roles: ["FIELD_WORKER"],
  };

  const attempts = await Promise.allSettled([
    fieldLedgerService.addRemittanceItem(
      ORGANIZATION_ID,
      currentUser,
      remittanceA,
      {
        collectionId,
        amount: 1000,
      }
    ),
    fieldLedgerService.addRemittanceItem(
      ORGANIZATION_ID,
      currentUser,
      remittanceB,
      {
        collectionId,
        amount: 1000,
      }
    ),
  ]);

  const fulfilled = attempts.filter(
    (result) => result.status === "fulfilled"
  );

  const rejected = attempts.filter(
    (result) => result.status === "rejected"
  );

  assert.equal(
    fulfilled.length,
    1,
    "Exactly one remittance should successfully claim the collection"
  );

  assert.equal(
    rejected.length,
    1,
    "Exactly one remittance should be rejected"
  );

  assert.equal(
    rejected[0].reason.statusCode,
    409
  );

  assert.match(
    rejected[0].reason.message,
    /already been included in a remittance/i
  );

  const [items] = await pool.execute(
    `SELECT
       id,
       remittance_id,
       collection_id
     FROM remittance_items
     WHERE organization_id = ?
       AND collection_id = ?`,
    [
      ORGANIZATION_ID,
      collectionId,
    ]
  );

  assert.equal(
    items.length,
    1,
    "The collection must exist in exactly one remittance"
  );

  const [links] = await pool.execute(
    `SELECT
       remittance_id,
       transaction_id
     FROM remittance_transactions
     WHERE transaction_id = ?`,
    [transactionId]
  );

  assert.equal(
    links.length,
    1,
    "The transaction must be linked to exactly one remittance"
  );

  const [remittanceRows] = await pool.execute(
    `SELECT
       id,
       expected_amount
     FROM remittances
     WHERE id IN (?, ?)
     ORDER BY id`,
    [
      remittanceA,
      remittanceB,
    ]
  );

  assert.equal(remittanceRows.length, 2);

  const expectedAmounts = remittanceRows.map(
    (row) => Number(row.expected_amount)
  );

  assert.equal(
    expectedAmounts.filter((amount) => amount === 1000).length,
    1,
    "Exactly one remittance should receive the collection amount"
  );

  assert.equal(
    expectedAmounts.filter((amount) => amount === 0).length,
    1,
    "The losing remittance must remain at zero expected amount"
  );

  const cleanup = await pool.getConnection();

  try {
    await cleanup.beginTransaction();

    await cleanup.execute(
      `DELETE FROM remittance_transactions
       WHERE remittance_id IN (?, ?)`,
      [remittanceA, remittanceB]
    );

    await cleanup.execute(
      `DELETE FROM remittance_items
       WHERE remittance_id IN (?, ?)`,
      [remittanceA, remittanceB]
    );

    await cleanup.execute(
      `DELETE FROM remittances
       WHERE id IN (?, ?)`,
      [remittanceA, remittanceB]
    );

    await cleanup.execute(
      `DELETE FROM transactions
       WHERE id = ?`,
      [transactionId]
    );

    await cleanup.execute(
      `DELETE FROM collection_records
       WHERE id = ?`,
      [collectionId]
    );

    await cleanup.commit();
  } catch (error) {
    await cleanup.rollback();
    throw error;
  } finally {
    cleanup.release();
  }
});

test("a reconciled collection cannot be added to a new remittance", async () => {
  const connection = await pool.getConnection();

  let transactionId;
  let collectionId;
  let remittanceId;

  try {
    await connection.beginTransaction();

    const reference = `INTEGRITY-RECON-${Date.now()}`;

    transactionId = await createTransaction(
      connection,
      reference,
      1000
    );

    const [collectionResult] = await connection.execute(
      `INSERT INTO collection_records (
        organization_id,
        activity_id,
        collector_id,
        reference_number,
        expected_amount,
        collected_amount,
        collection_status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'RECONCILED')`,
      [
        ORGANIZATION_ID,
        ACTIVITY_ID,
        COLLECTOR_ID,
        reference,
        1000,
        1000,
      ]
    );

    collectionId = collectionResult.insertId;

    remittanceId = await createRemittance(
      connection,
      `REMIT-RECON-${Date.now()}`
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }

  connection.release();

  const currentUser = {
    id: COLLECTOR_ID,
    roles: ["FIELD_WORKER"],
  };

  await assert.rejects(
    fieldLedgerService.addRemittanceItem(
      ORGANIZATION_ID,
      currentUser,
      remittanceId,
      {
        collectionId,
        amount: 1000,
      }
    ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(
        error.message,
        /cancelled or reconciled collections cannot be remitted/i
      );
      return true;
    }
  );

  const cleanup = await pool.getConnection();

  try {
    await cleanup.beginTransaction();

    await cleanup.execute(
      `DELETE FROM remittance_transactions
       WHERE remittance_id = ?`,
      [remittanceId]
    );

    await cleanup.execute(
      `DELETE FROM remittance_items
       WHERE remittance_id = ?`,
      [remittanceId]
    );

    await cleanup.execute(
      `DELETE FROM remittances
       WHERE id = ?`,
      [remittanceId]
    );

    await cleanup.execute(
      `DELETE FROM transactions
       WHERE id = ?`,
      [transactionId]
    );

    await cleanup.execute(
      `DELETE FROM collection_records
       WHERE id = ?`,
      [collectionId]
    );

    await cleanup.commit();
  } catch (error) {
    await cleanup.rollback();
    throw error;
  } finally {
    cleanup.release();
  }
});

test.after(async () => {
  await pool.end();
});
