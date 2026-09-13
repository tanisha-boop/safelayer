const pool = require("../config/database");

async function createCollection({
  organizationId,
  activityId,
  collectorId,
  referenceNumber,
  expectedAmount,
  notes,
}) {
  const [result] = await pool.execute(
    `INSERT INTO collection_records (
      organization_id,
      activity_id,
      collector_id,
      reference_number,
      expected_amount,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      activityId,
      collectorId,
      referenceNumber,
      expectedAmount,
      notes || null,
    ]
  );

  return findCollectionById(
    organizationId,
    result.insertId
  );
}

async function findCollectionById(
  organizationId,
  collectionId
) {
  const [rows] = await pool.execute(
    `SELECT
      cr.*,
      fa.title AS activity_title,
      fa.activity_type,
      fa.status AS activity_status,
      u.first_name,
      u.last_name,
      u.email AS collector_email
     FROM collection_records cr
     INNER JOIN field_activities fa
       ON fa.id = cr.activity_id
     INNER JOIN users u
       ON u.id = cr.collector_id
     WHERE cr.organization_id = ?
       AND cr.id = ?
     LIMIT 1`,
    [
      organizationId,
      collectionId,
    ]
  );

  return rows[0] || null;
}

async function findCollections(
  organizationId,
  filters = {}
) {
  let query = `
    SELECT
      cr.*,
      fa.title AS activity_title,
      fa.activity_type,
      fa.status AS activity_status,
      u.first_name,
      u.last_name,
      u.email AS collector_email,
      ri.remittance_id AS remittance_id
    FROM collection_records cr
    INNER JOIN field_activities fa
      ON fa.id = cr.activity_id
    INNER JOIN users u
      ON u.id = cr.collector_id
    LEFT JOIN remittance_items ri
      ON ri.collection_id = cr.id
      AND ri.organization_id = cr.organization_id
    WHERE cr.organization_id = ?
  `;

  const params = [organizationId];

  if (filters.status) {
    query += ` AND cr.collection_status = ?`;
    params.push(filters.status);
  }

  if (filters.collectorId) {
    query += ` AND cr.collector_id = ?`;
    params.push(filters.collectorId);
  }

  query += ` ORDER BY cr.created_at DESC`;

  const [rows] = await pool.execute(
    query,
    params
  );

  return rows;
}

async function findCollectionForUpdate(
  connection,
  organizationId,
  collectionId
) {
  const [rows] = await connection.execute(
    `SELECT *
     FROM collection_records
     WHERE organization_id = ?
       AND id = ?
     FOR UPDATE`,
    [
      organizationId,
      collectionId,
    ]
  );

  return rows[0] || null;
}

async function updateCollectionAmount(
  connection,
  organizationId,
  collectionId,
  collectedAmount,
  status,
  collectedAt,
  notes
) {
  await connection.execute(
    `UPDATE collection_records
     SET
       collected_amount = ?,
       collection_status = ?,
       collected_at = ?,
       notes = COALESCE(?, notes)
     WHERE organization_id = ?
       AND id = ?`,
    [
      collectedAmount,
      status,
      collectedAt,
      notes || null,
      organizationId,
      collectionId,
    ]
  );

  return findCollectionById(
    organizationId,
    collectionId
  );
}

async function createTransaction(
  connection,
  {
    organizationId,
    activityId,
    transactionReference,
    amount,
    transactionDate,
    createdBy,
    status,
  }
) {
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
    VALUES (?, ?, ?, 'COLLECTION', ?, 'PHP', ?, ?, ?)`,
    [
      organizationId,
      activityId,
      transactionReference,
      amount,
      status,
      transactionDate,
      createdBy,
    ]
  );

  return result.insertId;
}

async function findTransactionByActivity(
  connection,
  organizationId,
  activityId
) {
  const [rows] = await connection.execute(
    `SELECT *
     FROM transactions
     WHERE organization_id = ?
       AND activity_id = ?
       AND transaction_type = 'COLLECTION'
     ORDER BY id DESC
     LIMIT 1`,
    [
      organizationId,
      activityId,
    ]
  );

  return rows[0] || null;
}


async function findTransactionByReference(
  connection,
  organizationId,
  transactionReference
) {
  const [rows] = await connection.execute(
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
        transaction_date,
        created_by,
        created_at,
        updated_at
      FROM transactions
      WHERE organization_id = ?
        AND transaction_reference = ?
      LIMIT 1
    `,
    [organizationId, transactionReference]
  );

  return rows[0] || null;
}

async function updateTransaction(
  connection,
  organizationId,
  transactionId,
  {
    amount,
    transactionDate,
    status,
  }
) {
  const fields = [];
  const values = [];

  if (amount !== undefined) {
    fields.push("amount = ?");
    values.push(amount);
  }

  if (transactionDate !== undefined) {
    fields.push("transaction_date = ?");
    values.push(transactionDate);
  }

  if (status !== undefined) {
    fields.push("status = ?");
    values.push(status);
  }

  if (fields.length === 0) {
    throw new Error("No transaction fields provided for update.");
  }

  values.push(
    organizationId,
    transactionId
  );

  await connection.execute(
    `UPDATE transactions
     SET ${fields.join(", ")}
     WHERE organization_id = ?
       AND id = ?
       AND transaction_type = 'COLLECTION'`,
    values
  );
}

async function createRemittance(
  connection,
  {
    organizationId,
    collectorId,
    remittanceReference,
    expectedAmount,
    actualAmount,
  }
) {
  const [result] = await connection.execute(
    `INSERT INTO remittances (
      organization_id,
      collector_id,
      remittance_reference,
      expected_amount,
      actual_amount,
      status
    )
    VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [
      organizationId,
      collectorId,
      remittanceReference,
      expectedAmount,
      actualAmount,
    ]
  );

  return result.insertId;
}

async function findCollectionRemittance(
  connection,
  organizationId,
  collectionId
) {
  const [rows] = await connection.execute(
    `SELECT
       ri.id AS remittance_item_id,
       ri.remittance_id,
       ri.amount,
       r.status AS remittance_status
     FROM remittance_items ri
     INNER JOIN remittances r
       ON r.id = ri.remittance_id
     WHERE ri.organization_id = ?
       AND ri.collection_id = ?
     ORDER BY ri.id DESC
     LIMIT 1`,
    [
      organizationId,
      collectionId,
    ]
  );

  return rows[0] || null;
}

async function linkRemittanceTransaction(
  connection,
  remittanceId,
  transactionId
) {
  await connection.execute(
    `INSERT INTO remittance_transactions (
      remittance_id,
      transaction_id
    )
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      transaction_id = VALUES(transaction_id)`,
    [
      remittanceId,
      transactionId,
    ]
  );
}

async function addRemittanceItem(
  connection,
  {
    organizationId,
    remittanceId,
    collectionId,
    amount,
  }
) {
  const [result] = await connection.execute(
    `INSERT INTO remittance_items (
      organization_id,
      remittance_id,
      collection_id,
      amount
    )
    VALUES (?, ?, ?, ?)`,
    [
      organizationId,
      remittanceId,
      collectionId,
      amount,
    ]
  );

  return result.insertId;
}


async function findRemittances(
  organizationId
) {
  const [rows] = await pool.execute(
    `SELECT
      r.*,
      u.first_name,
      u.last_name,
      u.email AS collector_email
     FROM remittances r
     INNER JOIN users u
       ON u.id = r.collector_id
     WHERE r.organization_id = ?
     ORDER BY r.created_at DESC`,
    [
      organizationId,
    ]
  );

  return rows;
}

async function findRemittanceById(
  organizationId,
  remittanceId
) {
  const [rows] = await pool.execute(
    `SELECT
      r.*,
      u.first_name,
      u.last_name,
      u.email AS collector_email,
      v.first_name AS verifier_first_name,
      v.last_name AS verifier_last_name
     FROM remittances r
     INNER JOIN users u
       ON u.id = r.collector_id
     LEFT JOIN users v
       ON v.id = r.verified_by
     WHERE r.organization_id = ?
       AND r.id = ?
     LIMIT 1`,
    [
      organizationId,
      remittanceId,
    ]
  );

  return rows[0] || null;
}

async function findRemittanceItems(
  organizationId,
  remittanceId
) {
  const [rows] = await pool.execute(
    `SELECT
      ri.*,
      cr.reference_number,
      cr.expected_amount,
      cr.collected_amount,
      cr.collection_status
     FROM remittance_items ri
     INNER JOIN collection_records cr
       ON cr.id = ri.collection_id
     WHERE ri.organization_id = ?
       AND ri.remittance_id = ?
     ORDER BY ri.id ASC`,
    [
      organizationId,
      remittanceId,
    ]
  );

  return rows;
}

async function findRemittanceForUpdate(
  connection,
  organizationId,
  remittanceId
) {
  const [rows] = await connection.execute(
    `SELECT *
     FROM remittances
     WHERE organization_id = ?
       AND id = ?
     FOR UPDATE`,
    [
      organizationId,
      remittanceId,
    ]
  );

  return rows[0] || null;
}

async function getRemittanceTotal(
  connection,
  organizationId,
  remittanceId
) {
  const [rows] = await connection.execute(
    `SELECT
       COALESCE(SUM(amount), 0) AS total
     FROM remittance_items
     WHERE organization_id = ?
       AND remittance_id = ?`,
    [
      organizationId,
      remittanceId,
    ]
  );

  return Number(rows[0].total);
}

async function updateRemittanceExpectedAmount(
  connection,
  organizationId,
  remittanceId,
  expectedAmount
) {
  await connection.execute(
    `UPDATE remittances
     SET expected_amount = ?
     WHERE organization_id = ?
       AND id = ?`,
    [
      expectedAmount,
      organizationId,
      remittanceId,
    ]
  );
}

async function submitRemittance(
  connection,
  organizationId,
  remittanceId
) {
  await connection.execute(
    `UPDATE remittances
     SET
       status = 'SUBMITTED',
       submitted_at = NOW()
     WHERE organization_id = ?
       AND id = ?`,
    [
      organizationId,
      remittanceId,
    ]
  );
}

async function verifyRemittance(
  connection,
  organizationId,
  remittanceId,
  verifiedBy,
  status
) {
  await connection.execute(
    `UPDATE remittances
     SET
       status = ?,
       verified_by = ?,
       verified_at = NOW()
     WHERE organization_id = ?
       AND id = ?`,
    [
      status,
      verifiedBy,
      organizationId,
      remittanceId,
    ]
  );
}

async function createReconciliation(
  connection,
  {
    organizationId,
    remittanceId,
    expectedAmount,
    actualAmount,
    status,
    notes,
  }
) {
  const [result] = await connection.execute(
    `INSERT INTO reconciliations (
      organization_id,
      remittance_id,
      expected_amount,
      actual_amount,
      status,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      remittanceId,
      expectedAmount,
      actualAmount,
      status,
      notes || null,
    ]
  );

  return result.insertId;
}

async function createAuditEvent(
  connection,
  {
    organizationId,
    actorId,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
  }
) {
  await connection.execute(
    `INSERT INTO audit_events (
      organization_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      actorId,
      action,
      entityType,
      entityId,
      oldValues
        ? JSON.stringify(oldValues)
        : null,
      newValues
        ? JSON.stringify(newValues)
        : null,
    ]
  );
}

async function markCollectionsReconciled(
  connection,
  organizationId,
  remittanceId
) {
  await connection.execute(
    `UPDATE collection_records cr
     INNER JOIN remittance_items ri
       ON ri.collection_id = cr.id
     SET cr.collection_status = 'RECONCILED'
     WHERE ri.organization_id = ?
       AND ri.remittance_id = ?
       AND cr.organization_id = ?`,
    [
      organizationId,
      remittanceId,
      organizationId,
    ]
  );
}

module.exports = {
  createCollection,
  findCollectionById,
  findCollections,
  findCollectionForUpdate,
  updateCollectionAmount,
  createTransaction,
  findTransactionByActivity,
  findTransactionByReference,
  updateTransaction,
  createRemittance,
  findCollectionRemittance,
  linkRemittanceTransaction,
  addRemittanceItem,
  findRemittances,
  findRemittanceById,
  findRemittanceItems,
  findRemittanceForUpdate,
  getRemittanceTotal,
  updateRemittanceExpectedAmount,
  submitRemittance,
  verifyRemittance,
  createReconciliation,
  createAuditEvent,
  markCollectionsReconciled,
};
