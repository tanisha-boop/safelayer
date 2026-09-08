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
}) {
  const [result] = await pool.execute(
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

  return findById(result.insertId);
}

async function findById(evidenceId) {
  const [rows] = await pool.execute(
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

async function findByActivity(activityId) {
  const [rows] = await pool.execute(
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
  verificationNotes
) {
  await pool.execute(
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

  return findById(evidenceId);
}

module.exports = {
  createEvidence,
  findById,
  findByActivity,
  updateVerification,
};
