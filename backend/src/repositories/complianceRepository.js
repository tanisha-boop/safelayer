const pool = require("../config/database");

async function getConnection() {
  return pool.getConnection();
}

async function findResponsibleUser(
  organizationId,
  userId
) {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM users
      WHERE id = ?
        AND organization_id = ?
        AND is_active = 1
      LIMIT 1
    `,
    [userId, organizationId]
  );

  return rows[0] || null;
}

async function createRequirement({
  organizationId,
  name,
  requirementType,
  description,
  responsibleUserId,
  expiryDate,
  createdBy,
  connection = pool,
}) {
  const [result] = await connection.execute(
    `
      INSERT INTO compliance_requirements (
        organization_id,
        name,
        requirement_type,
        description,
        responsible_user_id,
        expiry_date,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      organizationId,
      name,
      requirementType,
      description || null,
      responsibleUserId || null,
      expiryDate || null,
      createdBy,
    ]
  );

  return findRequirementById(
    organizationId,
    result.insertId,
    connection
  );
}

async function findRequirementById(
  organizationId,
  id,
  connection = pool
) {
  const [rows] = await connection.execute(
    `
      SELECT
        cr.id,
        cr.organization_id,
        cr.name,
        cr.requirement_type,
        cr.description,
        cr.responsible_user_id,
        cr.expiry_date,
        cr.created_by,
        cr.created_at,
        cr.updated_at,

        ru.first_name AS responsible_first_name,
        ru.last_name AS responsible_last_name,
        ru.email AS responsible_email,

        cu.first_name AS creator_first_name,
        cu.last_name AS creator_last_name,
        cu.email AS creator_email,

        COUNT(cre.id) AS evidence_count,

        SUM(
          CASE
            WHEN cre.verification_status = 'VERIFIED'
            THEN 1
            ELSE 0
          END
        ) AS verified_evidence_count,

        SUM(
          CASE
            WHEN cre.verification_status = 'PENDING'
            THEN 1
            ELSE 0
          END
        ) AS pending_evidence_count,

        MAX(
          CASE
            WHEN cre.verification_status = 'VERIFIED'
            THEN cre.expiry_date
            ELSE NULL
          END
        ) AS latest_verified_evidence_expiry

      FROM compliance_requirements cr

      LEFT JOIN users ru
        ON ru.id = cr.responsible_user_id

      LEFT JOIN users cu
        ON cu.id = cr.created_by

      LEFT JOIN compliance_requirement_evidence cre
        ON cre.requirement_id = cr.id

      WHERE cr.id = ?
        AND cr.organization_id = ?

      GROUP BY
        cr.id,
        ru.first_name,
        ru.last_name,
        ru.email,
        cu.first_name,
        cu.last_name,
        cu.email

      LIMIT 1
    `,
    [id, organizationId]
  );

  return rows[0] || null;
}

async function listRequirements({
  organizationId,
  requirementType,
  search,
}) {
  const conditions = [
    "cr.organization_id = ?",
  ];

  const values = [organizationId];

  if (requirementType) {
    conditions.push(
      "cr.requirement_type = ?"
    );
    values.push(requirementType);
  }

  if (search) {
    conditions.push(
      "(cr.name LIKE ? OR cr.description LIKE ?)"
    );

    const pattern = `%${search}%`;

    values.push(pattern, pattern);
  }

  const whereClause =
    conditions.join(" AND ");

  const [rows] = await pool.execute(
    `
      SELECT
        cr.id,
        cr.organization_id,
        cr.name,
        cr.requirement_type,
        cr.description,
        cr.responsible_user_id,
        cr.expiry_date,
        cr.created_by,
        cr.created_at,
        cr.updated_at,

        ru.first_name AS responsible_first_name,
        ru.last_name AS responsible_last_name,
        ru.email AS responsible_email,

        COUNT(cre.id) AS evidence_count,

        SUM(
          CASE
            WHEN cre.verification_status = 'VERIFIED'
            THEN 1
            ELSE 0
          END
        ) AS verified_evidence_count,

        SUM(
          CASE
            WHEN cre.verification_status = 'PENDING'
            THEN 1
            ELSE 0
          END
        ) AS pending_evidence_count,

        MAX(
          CASE
            WHEN cre.verification_status = 'VERIFIED'
            THEN cre.expiry_date
            ELSE NULL
          END
        ) AS latest_verified_evidence_expiry

      FROM compliance_requirements cr

      LEFT JOIN users ru
        ON ru.id = cr.responsible_user_id

      LEFT JOIN compliance_requirement_evidence cre
        ON cre.requirement_id = cr.id

      WHERE ${whereClause}

      GROUP BY
        cr.id,
        ru.first_name,
        ru.last_name,
        ru.email

      ORDER BY
        cr.expiry_date IS NULL,
        cr.expiry_date ASC,
        cr.id DESC
    `,
    values
  );

  return rows;
}

async function updateRequirement({
  organizationId,
  id,
  name,
  requirementType,
  description,
  responsibleUserId,
  expiryDate,
  connection = pool,
}) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push("name = ?");
    values.push(name);
  }

  if (requirementType !== undefined) {
    fields.push("requirement_type = ?");
    values.push(requirementType);
  }

  if (description !== undefined) {
    fields.push("description = ?");
    values.push(description);
  }

  if (responsibleUserId !== undefined) {
    fields.push("responsible_user_id = ?");
    values.push(responsibleUserId);
  }

  if (expiryDate !== undefined) {
    fields.push("expiry_date = ?");
    values.push(expiryDate);
  }

  if (!fields.length) {
    return findRequirementById(
      organizationId,
      id
    );
  }

  values.push(id, organizationId);

  const [result] = await connection.execute(
    `
      UPDATE compliance_requirements
      SET ${fields.join(", ")}
      WHERE id = ?
        AND organization_id = ?
    `,
    values
  );

  if (!result.affectedRows) {
    return null;
  }

  return findRequirementById(
    organizationId,
    id,
    connection
  );
}

async function createEvidence({
  requirementId,
  uploadedBy,
  fileName,
  filePath,
  mimeType,
  fileSize,
  fileHash,
  documentDate,
  expiryDate,
  connection = pool,
}) {
  const [result] = await connection.execute(
    `
      INSERT INTO compliance_requirement_evidence (
        requirement_id,
        uploaded_by,
        file_name,
        file_path,
        mime_type,
        file_size,
        file_hash,
        document_date,
        expiry_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      requirementId,
      uploadedBy,
      fileName,
      filePath,
      mimeType,
      fileSize,
      fileHash,
      documentDate || null,
      expiryDate || null,
    ]
  );

  return findEvidenceById(
    result.insertId,
    connection
  );
}

async function findEvidenceByHash({
  requirementId,
  fileHash,
  connection = pool,
}) {
  const [rows] = await connection.execute(
    `
      SELECT
        cre.id,
        cre.requirement_id,
        cre.file_hash,
        cre.file_name
      FROM compliance_requirement_evidence cre
      WHERE cre.requirement_id = ?
        AND cre.file_hash = ?
      LIMIT 1
    `,
    [requirementId, fileHash]
  );

  return rows[0] || null;
}

async function findEvidenceById(
  id,
  connection = pool
) {
  const [rows] = await connection.execute(
    `
      SELECT
        cre.id,
        cre.requirement_id,
        cre.uploaded_by,
        cre.file_name,
        cre.file_path,
        cre.mime_type,
        cre.file_size,
        cre.file_hash,
        cre.verification_status,
        cre.verification_notes,
        cre.document_date,
        cre.expiry_date,
        cre.created_at,

        cr.organization_id,
        cr.name AS requirement_name,

        u.first_name AS uploader_first_name,
        u.last_name AS uploader_last_name,
        u.email AS uploader_email

      FROM compliance_requirement_evidence cre

      INNER JOIN compliance_requirements cr
        ON cr.id = cre.requirement_id

      INNER JOIN users u
        ON u.id = cre.uploaded_by

      WHERE cre.id = ?

      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function findEvidenceForRequirement({
  organizationId,
  requirementId,
}) {
  const [rows] = await pool.execute(
    `
      SELECT
        cre.id,
        cre.requirement_id,
        cre.uploaded_by,
        cre.file_name,
        cre.file_path,
        cre.mime_type,
        cre.file_size,
        cre.file_hash,
        cre.verification_status,
        cre.verification_notes,
        cre.document_date,
        cre.expiry_date,
        cre.created_at,

        u.first_name AS uploader_first_name,
        u.last_name AS uploader_last_name,
        u.email AS uploader_email

      FROM compliance_requirement_evidence cre

      INNER JOIN compliance_requirements cr
        ON cr.id = cre.requirement_id

      INNER JOIN users u
        ON u.id = cre.uploaded_by

      WHERE cre.requirement_id = ?
        AND cr.organization_id = ?

      ORDER BY cre.id DESC
    `,
    [requirementId, organizationId]
  );

  return rows;
}

async function updateEvidenceVerification({
  id,
  verificationStatus,
  verificationNotes,
  connection,
}) {
  const [result] = await connection.execute(
    `
      UPDATE compliance_requirement_evidence
      SET
        verification_status = ?,
        verification_notes = ?
      WHERE id = ?
        AND verification_status = 'PENDING'
    `,
    [
      verificationStatus,
      verificationNotes || null,
      id,
    ]
  );

  if (!result.affectedRows) {
    return null;
  }

  return findEvidenceById(
    id,
    connection
  );
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

module.exports = {
  findEvidenceByHash,
  getConnection,
  findResponsibleUser,
  createRequirement,
  findRequirementById,
  listRequirements,
  updateRequirement,
  createEvidence,
  findEvidenceById,
  findEvidenceForRequirement,
  updateEvidenceVerification,
  createAuditEvent,
};