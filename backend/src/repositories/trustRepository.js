const pool = require("../config/database");

async function findActivityContext(
  organizationId,
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT
        fa.id,
        fa.organization_id,
        fa.assigned_to,
        fa.activity_type,
        fa.title,
        fa.status,
        fa.scheduled_at,
        fa.completed_at,
        fa.latitude,
        fa.longitude,

        u.id AS worker_id,
        u.first_name AS worker_first_name,
        u.last_name AS worker_last_name,
        u.email AS worker_email,
        u.is_active AS worker_active

      FROM field_activities fa

      INNER JOIN users u
        ON u.id = fa.assigned_to

      WHERE fa.organization_id = ?
        AND fa.id = ?

      LIMIT 1
    `,
    [organizationId, activityId]
  );

  return rows[0] || null;
}

async function findRouteProofEvents(
  organizationId,
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        user_id,
        event_type,
        latitude,
        longitude,
        accuracy_meters,
        recorded_at
      FROM route_proof_events
      WHERE organization_id = ?
        AND activity_id = ?
      ORDER BY recorded_at ASC, id ASC
    `,
    [organizationId, activityId]
  );

  return rows;
}

async function findEvidence(
  organizationId,
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT
        e.id,
        e.uploaded_by,
        e.evidence_type,
        e.file_name,
        e.mime_type,
        e.file_size,
        e.file_hash,
        e.verification_status,
        e.latitude,
        e.longitude,
        e.captured_at,
        e.created_at

      FROM evidence e

      INNER JOIN field_activities fa
        ON fa.id = e.activity_id

      WHERE fa.organization_id = ?
        AND e.activity_id = ?

      ORDER BY e.created_at ASC, e.id ASC
    `,
    [organizationId, activityId]
  );

  return rows;
}

async function findCollections(
  organizationId,
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        collector_id,
        reference_number,
        expected_amount,
        collected_amount,
        collection_status,
        collected_at
      FROM collection_records
      WHERE organization_id = ?
        AND activity_id = ?
      ORDER BY id ASC
    `,
    [organizationId, activityId]
  );

  return rows;
}

async function findTransactions(
  organizationId,
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        transaction_reference,
        transaction_type,
        amount,
        currency,
        status,
        transaction_date,
        created_by,
        created_at
      FROM transactions
      WHERE organization_id = ?
        AND activity_id = ?
      ORDER BY id ASC
    `,
    [organizationId, activityId]
  );

  return rows;
}

async function findRemittances(
  organizationId,
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT
        r.id,
        r.collector_id,
        r.remittance_reference,
        r.expected_amount,
        r.actual_amount,
        r.variance_amount,
        r.status,
        r.submitted_at,
        r.verified_at

      FROM remittances r

      INNER JOIN remittance_items ri
        ON ri.remittance_id = r.id

      INNER JOIN collection_records cr
        ON cr.id = ri.collection_id

      WHERE r.organization_id = ?
        AND cr.activity_id = ?

      GROUP BY
        r.id,
        r.collector_id,
        r.remittance_reference,
        r.expected_amount,
        r.actual_amount,
        r.variance_amount,
        r.status,
        r.submitted_at,
        r.verified_at

      ORDER BY r.id ASC
    `,
    [organizationId, activityId]
  );

  return rows;
}

async function findInvoices(
  organizationId,
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
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
        AND activity_id = ?
      ORDER BY id ASC
    `,
    [organizationId, activityId]
  );

  return rows;
}

async function findLatestRiskAssessment(
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT *
      FROM risk_assessments
      WHERE activity_id = ?
        AND assessment_type = 'ACTIVITY'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [activityId]
  );

  return rows[0] || null;
}

async function createRiskAssessment({
  activityId,
  trustScore,
  riskLevel,
  locationVerified,
  timestampVerified,
  duplicateDetected,
  documentVerified,
  requiresReview,
  explanation,
}) {
  const [result] = await pool.execute(
    `
      INSERT INTO risk_assessments (
        activity_id,
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
      VALUES (?, 'ACTIVITY', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      activityId,
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

async function findOpenActivityReview(
  organizationId,
  activityId
) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        activity_id,
        transaction_id,
        invoice_id,
        risk_assessment_id,
        status,
        priority,
        reason,
        resolution,
        created_at,
        resolved_at
      FROM reviews
      WHERE organization_id = ?
        AND activity_id = ?
        AND status IN ('OPEN', 'IN_REVIEW')
      ORDER BY id DESC
      LIMIT 1
    `,
    [organizationId, activityId]
  );

  return rows[0] || null;
}

async function createReview({
  organizationId,
  activityId,
  priority,
  reason,
}) {
  const [result] = await pool.execute(
    `
      INSERT INTO reviews (
        organization_id,
        activity_id,
        status,
        priority,
        reason
      )
      VALUES (?, ?, 'OPEN', ?, ?)
    `,
    [
      organizationId,
      activityId,
      priority,
      reason,
    ]
  );

  return result.insertId;
}

async function createAuditEvent({
  organizationId,
  actorId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
}) {
  await pool.execute(
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

module.exports = {
  findActivityContext,
  findRouteProofEvents,
  findEvidence,
  findCollections,
  findTransactions,
  findRemittances,
  findInvoices,
  findLatestRiskAssessment,
  createRiskAssessment,
  findOpenActivityReview,
  createReview,
  createAuditEvent,
};
