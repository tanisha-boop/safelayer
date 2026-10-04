const pool = require("../config/database");

async function getConnection() {
  return pool.getConnection();
}

async function findById(
  organizationId,
  invoiceId,
  connection = pool,
  { forUpdate = false } = {}
) {
  const lockClause = forUpdate
    ? "FOR UPDATE"
    : "";

  const [rows] = await connection.execute(
    `
      SELECT
        i.id,
        i.organization_id,
        i.activity_id,
        i.vendor_name,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.amount,
        i.currency,
        i.status,
        i.submitted_by,
        i.created_at,
        i.updated_at,

        u.first_name,
        u.last_name,
        u.email

      FROM invoices i

      INNER JOIN users u
        ON u.id = i.submitted_by

      WHERE i.organization_id = ?
        AND i.id = ?

      LIMIT 1

      ${lockClause}
    `,
    [organizationId, invoiceId]
  );

  return rows[0] || null;
}

async function findByInvoiceNumber(
  organizationId,
  invoiceNumber
) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        activity_id,
        vendor_name,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        currency,
        status,
        submitted_by,
        created_at,
        updated_at

      FROM invoices

      WHERE organization_id = ?
        AND invoice_number = ?

      LIMIT 1
    `,
    [organizationId, invoiceNumber]
  );

  return rows[0] || null;
}

async function createInvoice({
  organizationId,
  vendorName,
  invoiceNumber,
  invoiceDate,
  dueDate,
  amount,
  currency,
  submittedBy,
  activityId,
}) {
  const [result] = await pool.execute(
    `
      INSERT INTO invoices (
        organization_id,
        activity_id,
        vendor_name,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        currency,
        submitted_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      organizationId,
      activityId || null,
      vendorName,
      invoiceNumber,
      invoiceDate || null,
      dueDate || null,
      amount,
      currency,
      submittedBy,
    ]
  );

  return findById(
    organizationId,
    result.insertId
  );
}

async function listInvoices(
  organizationId,
  { status, vendorName }
) {
  let sql = `
    SELECT
      i.id,
      i.organization_id,
      i.vendor_name,
      i.invoice_number,
      i.invoice_date,
      i.due_date,
      i.amount,
      i.currency,
      i.status,
      i.submitted_by,
      i.created_at,
      i.updated_at,

      u.first_name,
      u.last_name,
      u.email

    FROM invoices i

    INNER JOIN users u
      ON u.id = i.submitted_by

    WHERE i.organization_id = ?
  `;

  const params = [organizationId];

  if (status) {
    sql += ` AND i.status = ?`;
    params.push(status);
  }

  if (vendorName) {
    sql += ` AND i.vendor_name LIKE ?`;
    params.push(`%${vendorName}%`);
  }

  sql += `
    ORDER BY i.created_at DESC
  `;

  const [rows] = await pool.execute(
    sql,
    params
  );

  return rows;
}

async function updateStatus(
  organizationId,
  invoiceId,
  status,
  connection = pool
) {
  await connection.execute(
    `
      UPDATE invoices

      SET status = ?

      WHERE organization_id = ?
        AND id = ?
    `,
    [
      status,
      organizationId,
      invoiceId,
    ]
  );

  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        activity_id,
        vendor_name,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        currency,
        status,
        submitted_by,
        created_at,
        updated_at
      FROM invoices
      WHERE organization_id = ?
        AND id = ?
      LIMIT 1
    `,
    [
      organizationId,
      invoiceId,
    ]
  );

  return rows[0] || null;
}

async function findDuplicateCandidates(
  organizationId,
  invoice,
  connection = pool
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        vendor_name,
        invoice_number,
        invoice_date,
        amount,
        currency,
        status
      FROM invoices
      WHERE organization_id = ?
        AND id <> ?
        AND (
          invoice_number = ?
          OR (
            vendor_name = ?
            AND amount = ?
            AND (
              invoice_date = ?
              OR invoice_date IS NULL
              OR ? IS NULL
            )
          )
        )
      ORDER BY created_at DESC
      LIMIT 20
    `,
    [
      organizationId,
      invoice.id,
      invoice.invoice_number,
      invoice.vendor_name,
      invoice.amount,
      invoice.invoice_date,
      invoice.invoice_date,
    ]
  );

  return rows;
}

async function createRiskAssessment({
  activityId,
  invoiceId,
  trustScore,
  riskLevel,
  locationVerified,
  timestampVerified,
  duplicateDetected,
  documentVerified,
  requiresReview,
  explanation,
  connection = pool,
}) {
  const [result] = await connection.execute(
    `
      INSERT INTO risk_assessments (
        activity_id,
        invoice_id,
        assessment_type,
        trust_score,
        risk_level,
        location_verified,
        timestamp_verified,
        duplicate_detected,
        document_verified,
        requires_review,
        explanation
      )
      VALUES (?, ?, 'INVOICE', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      activityId ?? null,
      invoiceId ?? null,
      trustScore,
      riskLevel,
      locationVerified ? 1 : 0,
      timestampVerified ? 1 : 0,
      duplicateDetected ? 1 : 0,
      documentVerified ? 1 : 0,
      requiresReview ? 1 : 0,
      JSON.stringify(explanation),
    ]
  );

  return result.insertId;
}

async function findLatestRiskAssessment(
  organizationId,
  invoiceId,
  connection = pool
) {
  const [rows] = await connection.execute(
    `
      SELECT
        ra.*
      FROM risk_assessments ra
      INNER JOIN invoices i
        ON i.id = ra.invoice_id
      WHERE i.organization_id = ?
        AND ra.invoice_id = ?
        AND ra.assessment_type = 'INVOICE'
      ORDER BY ra.created_at DESC
      LIMIT 1
    `,
    [organizationId, invoiceId]
  );

  return rows[0] || null;
}

async function createAuditEvent({
  organizationId,
  actorId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  connection = pool,
}) {
  await connection.execute(
    `
      INSERT INTO audit_events (
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      organizationId,
      actorId || null,
      action,
      entityType,
      entityId || null,
      oldValues
        ? JSON.stringify(oldValues)
        : null,
      newValues
        ? JSON.stringify(newValues)
        : null,
    ]
  );
}

async function findEvidenceForInvoice(
  organizationId,
  invoiceId,
  connection = pool
) {
  const [rows] = await connection.execute(
    `
      SELECT
        e.id,
        e.activity_id,
        e.uploaded_by,
        e.evidence_type,
        e.file_name,
        e.mime_type,
        e.file_size,
        e.file_hash,
        e.verification_status,
        e.verification_notes,
        e.latitude,
        e.longitude,
        e.captured_at,
        e.created_at

      FROM invoice_evidence ie

      INNER JOIN invoices i
        ON i.id = ie.invoice_id

      INNER JOIN evidence e
        ON e.id = ie.evidence_id

      WHERE i.organization_id = ?
        AND ie.invoice_id = ?

      ORDER BY e.created_at DESC
    `,
    [
      organizationId,
      invoiceId,
    ]
  );

  return rows;
}

async function linkEvidence(
  invoiceId,
  evidenceId,
  connection = pool
) {
  await connection.execute(
    `
      INSERT INTO invoice_evidence (
        invoice_id,
        evidence_id
      )
      VALUES (?, ?)
    `,
    [
      invoiceId,
      evidenceId,
    ]
  );
}

module.exports = {
  getConnection,
  findById,
  findByInvoiceNumber,
  createInvoice,
  listInvoices,
  updateStatus,
  findDuplicateCandidates,
  createRiskAssessment,
  findLatestRiskAssessment,
  createAuditEvent,
  findEvidenceForInvoice,
  linkEvidence,
};
