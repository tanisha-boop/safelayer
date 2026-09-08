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
      u.first_name,
      u.last_name,
      u.email AS collector_email
    FROM collection_records cr
    INNER JOIN field_activities fa
      ON fa.id = cr.activity_id
    INNER JOIN users u
      ON u.id = cr.collector_id
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

async function updateCollectionAmount(
  organizationId,
  collectionId,
  collectedAmount,
  status,
  collectedAt,
  notes
) {
  await pool.execute(
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

async function createRemittance(
  connection,
  {
    organizationId,
    collectorId,
    remittanceReference,
    declaredAmount,
    remittedAt,
    notes,
  }
) {
  const [result] = await connection.execute(
    `INSERT INTO remittances (
      organization_id,
      collector_id,
      remittance_reference,
      declared_amount,
      remitted_at,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      collectorId,
      remittanceReference,
      declaredAmount,
      remittedAt,
      notes || null,
    ]
  );

  return result.insertId;
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

async function verifyRemittance(
  connection,
  organizationId,
  remittanceId,
  verifiedBy,
  verifiedAmount,
  discrepancyAmount,
  status
) {
  await connection.execute(
    `UPDATE remittances
     SET
       verified_amount = ?,
       discrepancy_amount = ?,
       status = ?,
       verified_by = ?,
       verified_at = NOW()
     WHERE organization_id = ?
       AND id = ?`,
    [
      verifiedAmount,
      discrepancyAmount,
      status,
      verifiedBy,
      organizationId,
      remittanceId,
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
  updateCollectionAmount,
  createRemittance,
  addRemittanceItem,
  findRemittanceById,
  findRemittanceItems,
  findCollectionForUpdate,
  findRemittanceForUpdate,
  getRemittanceTotal,
  verifyRemittance,
  markCollectionsReconciled,
};
