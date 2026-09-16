const pool = require("../config/database");

async function createEvidence({
  activityId,
  uploadedBy,
  evidenceType,
  fileName,
  filePath,
  mimeType,
  fileSize,
  fileHash,
  latitude,
  longitude,
  capturedAt,
  connection = pool,
}) {
  const [result] = await connection.execute(
    `
      INSERT INTO evidence (
        activity_id,
        uploaded_by,
        evidence_type,
        file_name,
        file_path,
        mime_type,
        file_size,
        file_hash,
        latitude,
        longitude,
        captured_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      activityId,
      uploadedBy,
      evidenceType,
      fileName,
      filePath,
      mimeType,
      fileSize,
      fileHash,
      latitude ?? null,
      longitude ?? null,
      capturedAt ?? null,
    ]
  );

  return findById(result.insertId, connection);
}

async function findById(evidenceId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        e.id,
        e.activity_id,
        e.uploaded_by,
        e.evidence_type,
        e.file_name,
        e.file_path,
        e.mime_type,
        e.file_size,
        e.file_hash,
        e.verification_status,
        e.verification_notes,
        e.latitude,
        e.longitude,
        e.captured_at,
        e.created_at,

        u.first_name,
        u.last_name,
        u.email,

        fa.title AS activity_title,
        fa.activity_type,
        fa.status AS activity_status

      FROM evidence e

      INNER JOIN users u
        ON u.id = e.uploaded_by

      INNER JOIN field_activities fa
        ON fa.id = e.activity_id

      WHERE e.id = ?

      LIMIT 1
    `,
    [evidenceId]
  );

  return rows[0] || null;
}

async function findByActivity(activityId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        e.id,
        e.activity_id,
        e.uploaded_by,
        e.evidence_type,
        e.file_name,
        e.file_path,
        e.mime_type,
        e.file_size,
        e.file_hash,
        e.verification_status,
        e.verification_notes,
        e.latitude,
        e.longitude,
        e.captured_at,
        e.created_at,

        u.first_name,
        u.last_name,
        u.email

      FROM evidence e

      INNER JOIN users u
        ON u.id = e.uploaded_by

      WHERE e.activity_id = ?

      ORDER BY e.created_at DESC
    `,
    [activityId]
  );

  return rows;
}

async function updateVerification(
  evidenceId,
  verificationStatus,
  verificationNotes,
  connection = pool
) {
  await connection.execute(
    `
      UPDATE evidence
      SET
        verification_status = ?,
        verification_notes = ?
      WHERE id = ?
    `,
    [
      verificationStatus,
      verificationNotes || null,
      evidenceId,
    ]
  );

  return findById(evidenceId, connection);
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
      entityId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ]
  );
}

module.exports = {
  createEvidence,
  findById,
  findByActivity,
  updateVerification,
  createAuditEvent,
};
