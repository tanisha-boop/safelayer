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

const TEST_REFERENCE = `AUTO-VERIFY-${Date.now()}`;

let remittanceId;
let transactionId;
let collectionId;


async function createTestCollection(connection, reference) {
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
      VALUES (
        ?, ?, ?, ?, 5000, 5000,
        'COLLECTED', NOW(), ?
      )
    `,
    [
      ORGANIZATION_ID,
      ACTIVITY_ID,
      COLLECTOR_ID,
      `${reference}-COLL`,
      "Remittance verification integration test",
    ]
  );

  return collectionResult.insertId;
}


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

    collectionId = await createTestCollection(
      connection,
      TEST_REFERENCE
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
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

test(
  "verifyRemittance creates an atomic variance review workflow",
  async () => {
    const result = await fieldLedgerService.verifyRemittance(
      ORGANIZATION_ID,
      currentUser,
      remittanceId
    );

    assert.equal(result.remittance.status, "DISPUTED");
    assert.equal(Number(result.reconciliation.expectedAmount), 5000);
    assert.equal(Number(result.reconciliation.actualAmount), 4000);
    assert.equal(Number(result.reconciliation.variance), -1000);
    assert.equal(
      result.reconciliation.status,
      "INVESTIGATION"
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
    assert.equal(remittanceRows[0].status, "DISPUTED");
    assert.equal(
      Number(remittanceRows[0].expected_amount),
      5000
    );
    assert.equal(
      Number(remittanceRows[0].actual_amount),
      4000
    );
    assert.equal(
      Number(remittanceRows[0].variance_amount),
      -1000
    );
    assert.equal(
      Number(remittanceRows[0].verified_by),
      ACTOR_ID
    );
    assert.ok(remittanceRows[0].verified_at);

    const [transactionRows] = await pool.execute(
      `
        SELECT status
        FROM transactions
        WHERE id = ?
          AND organization_id = ?
      `,
      [transactionId, ORGANIZATION_ID]
    );

    assert.equal(transactionRows.length, 1);
    assert.equal(
      transactionRows[0].status,
      "REQUIRES_REVIEW"
    );

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
      4000
    );
    assert.equal(
      Number(reconciliationRows[0].variance_amount),
      -1000
    );
    assert.equal(
      reconciliationRows[0].status,
      "INVESTIGATION"
    );

    const [reviewRows] = await pool.execute(
      `
        SELECT
          organization_id,
          transaction_id,
          status,
          priority,
          reason
        FROM reviews
        WHERE transaction_id = ?
          AND organization_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [transactionId, ORGANIZATION_ID]
    );

    assert.equal(reviewRows.length, 1);
    assert.equal(
      Number(reviewRows[0].organization_id),
      ORGANIZATION_ID
    );
    assert.equal(
      Number(reviewRows[0].transaction_id),
      transactionId
    );
    assert.equal(reviewRows[0].status, "OPEN");
    assert.equal(reviewRows[0].priority, "CRITICAL");
    assert.match(
      reviewRows[0].reason,
      /Remittance variance detected/
    );

    const [expectedRecipientRows] =
      await pool.execute(
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

    const expectedRecipients =
      expectedRecipientRows.map((user) => Number(user.id));

    const [notificationRows] =
      await pool.execute(
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
            AND entity_type = 'REMITTANCE'
            AND entity_id = ?
            AND type = 'REMITTANCE_REQUIRES_REVIEW'
          ORDER BY id ASC
        `,
        [ORGANIZATION_ID, remittanceId]
      );

    const actualRecipients =
      notificationRows
        .map((notification) =>
          Number(notification.user_id)
        )
        .sort((a, b) => a - b);

    assert.deepEqual(
      actualRecipients,
      expectedRecipients,
      "Exactly one remittance notification must exist for each eligible management/finance recipient"
    );

    assert.equal(
      notificationRows.length,
      expectedRecipients.length,
      "Remittance verification must not duplicate notifications"
    );

    for (const notification of notificationRows) {
      assert.equal(
        Number(notification.organization_id),
        ORGANIZATION_ID
      );

      assert.equal(
        notification.type,
        "REMITTANCE_REQUIRES_REVIEW"
      );

      assert.equal(
        notification.entity_type,
        "REMITTANCE"
      );

      assert.equal(
        Number(notification.entity_id),
        Number(remittanceId)
      );

      assert.equal(
        notification.title,
        "Remittance variance requires review"
      );
    }

    const [auditRows] = await pool.execute(
      `
        SELECT action
        FROM audit_events
        WHERE organization_id = ?
          AND entity_type = 'REMITTANCE'
          AND entity_id = ?
          AND action = 'REMITTANCE_DISPUTED'
      `,
      [ORGANIZATION_ID, remittanceId]
    );

    assert.equal(auditRows.length, 1);
    assert.equal(
      auditRows[0].action,
      "REMITTANCE_DISPUTED"
    );
  }
);

test.after(async () => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        DELETE FROM notifications
        WHERE organization_id = ?
          AND entity_type = 'REMITTANCE'
          AND entity_id = ?
          AND type = 'REMITTANCE_REQUIRES_REVIEW'
      `,
      [ORGANIZATION_ID, remittanceId]
    );

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
        DELETE FROM collection_records
        WHERE organization_id = ?
          AND id = ?
      `,
      [ORGANIZATION_ID, collectionId]
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
