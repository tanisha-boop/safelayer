const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const pool = require("../config/database");

const complianceRepository =
  require("../repositories/complianceRepository");

const notificationEventService =
  require("./notificationEventService");

const {
  allowedMimeTypes,
  validateFileContent,
} = require("../utils/fileValidation");

function createError(
  message,
  statusCode = 400
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function calculateFileHash(filePath) {
  const buffer = await fs.readFile(filePath);

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function normalizeDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const normalized = new Date(value);
    normalized.setHours(0, 0, 0, 0);

    return Number.isNaN(normalized.getTime())
      ? null
      : normalized;
  }

  const valueString = String(value).trim();

  if (!valueString) {
    return null;
  }

  const dateOnlyMatch =
    /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(valueString);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;

    const normalized = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    normalized.setHours(0, 0, 0, 0);

    return Number.isNaN(normalized.getTime())
      ? null
      : normalized;
  }

  const parsed = new Date(valueString);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);

  return parsed;
}

function calculateRequirementStatus(
  requirement
) {
  const verifiedEvidenceCount =
    Number(
      requirement.verified_evidence_count || 0
    );

  if (verifiedEvidenceCount === 0) {
    return "PENDING";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDates = [];

  const requirementExpiry =
    normalizeDateOnly(
      requirement.expiry_date
    );

  if (requirementExpiry) {
    expiryDates.push(requirementExpiry);
  }

  const evidenceExpiry =
    normalizeDateOnly(
      requirement.latest_verified_evidence_expiry
    );

  if (evidenceExpiry) {
    expiryDates.push(evidenceExpiry);
  }

  if (expiryDates.length === 0) {
    return "ACTIVE";
  }

  const earliestExpiry = new Date(
    Math.min(
      ...expiryDates.map(
        (date) => date.getTime()
      )
    )
  );

  if (earliestExpiry < today) {
    return "EXPIRED";
  }

  const expiringThreshold =
    new Date(today);

  expiringThreshold.setDate(
    expiringThreshold.getDate() + 30
  );

  if (earliestExpiry <= expiringThreshold) {
    return "EXPIRING_SOON";
  }

  return "ACTIVE";
}

function serializeRequirement(
  requirement
) {
  if (!requirement) {
    return null;
  }

  return {
    id: requirement.id,
    organizationId: requirement.organization_id,
    name: requirement.name,
    requirementType:
      requirement.requirement_type,
    description: requirement.description,
    responsibleUserId:
      requirement.responsible_user_id,
    expiryDate: requirement.expiry_date,
    createdBy: requirement.created_by,
    createdAt: requirement.created_at,
    updatedAt: requirement.updated_at,

    responsibleUser: requirement.responsible_first_name
      ? {
          firstName:
            requirement.responsible_first_name,
          lastName:
            requirement.responsible_last_name,
          email:
            requirement.responsible_email,
        }
      : null,

    creator: requirement.creator_first_name
      ? {
          firstName:
            requirement.creator_first_name,
          lastName:
            requirement.creator_last_name,
          email:
            requirement.creator_email,
        }
      : null,

    evidenceCount:
      Number(requirement.evidence_count || 0),

    verifiedEvidenceCount:
      Number(
        requirement.verified_evidence_count || 0
      ),

    pendingEvidenceCount:
      Number(
        requirement.pending_evidence_count || 0
      ),

    status:
      calculateRequirementStatus(
        requirement
      ),
  };
}
function serializeComplianceEvidence(
  evidence
) {
  if (!evidence) {
    return null;
  }

  return {
    id: evidence.id,
    requirementId: evidence.requirement_id,
    uploadedBy: evidence.uploaded_by,

    fileName: evidence.file_name,
    filePath: evidence.file_path,
    mimeType: evidence.mime_type,
    fileSize: Number(evidence.file_size || 0),
    fileHash: evidence.file_hash,

    verificationStatus:
      evidence.verification_status,

    verificationNotes:
      evidence.verification_notes,

    documentDate:
      evidence.document_date,

    expiryDate:
      evidence.expiry_date,

    createdAt:
      evidence.created_at,

    organizationId:
      evidence.organization_id,

    requirementName:
      evidence.requirement_name,

    uploader: evidence.uploader_first_name
      ? {
          firstName:
            evidence.uploader_first_name,
          lastName:
            evidence.uploader_last_name,
          email:
            evidence.uploader_email,
        }
      : null,
  };
}
async function validateResponsibleUser(
  organizationId,
  responsibleUserId
) {
  if (
    responsibleUserId === undefined ||
    responsibleUserId === null
  ) {
    return;
  }

  const user =
    await complianceRepository.findResponsibleUser(
      organizationId,
      responsibleUserId
    );

  if (!user) {
    throw createError(
      "Responsible user not found in this organization",
      400
    );
  }
}

async function createRequirement({
  organizationId,
  createdBy,
  name,
  requirementType,
  description,
  responsibleUserId,
  expiryDate,
}) {
  await validateResponsibleUser(
    organizationId,
    responsibleUserId
  );

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requirement =
      await complianceRepository.createRequirement({
        organizationId,
        name,
        requirementType,
        description,
        responsibleUserId,
        expiryDate,
        createdBy,
        connection,
      });

    await complianceRepository.createAuditEvent({
      organizationId,
      actorId: createdBy,
      action:
        "COMPLIANCE_REQUIREMENT_CREATED",
      entityType:
        "COMPLIANCE_REQUIREMENT",
      entityId: requirement.id,
      newValues: {
        name,
        requirementType,
        description: description || null,
        responsibleUserId:
          responsibleUserId || null,
        expiryDate: expiryDate || null,
      },
      connection,
    });

    await connection.commit();

    return serializeRequirement(
      requirement
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listRequirements({
  organizationId,
  status,
  requirementType,
  search,
}) {
  const requirements =
    await complianceRepository.listRequirements({
      organizationId,
      requirementType,
      search,
    });

  const serialized =
    requirements.map(
      serializeRequirement
    );

  if (!status) {
    return serialized;
  }

  return serialized.filter(
    (requirement) =>
      requirement.status === status
  );
}

async function getRequirement({
  organizationId,
  id,
}) {
  const requirement =
    await complianceRepository.findRequirementById(
      organizationId,
      id
    );

  if (!requirement) {
    throw createError(
      "Compliance requirement not found",
      404
    );
  }

  return serializeRequirement(
    requirement
  );
}

async function updateRequirement({
  organizationId,
  id,
  actorId,
  updates,
}) {
  const existing =
    await complianceRepository.findRequirementById(
      organizationId,
      id
    );

  if (!existing) {
    throw createError(
      "Compliance requirement not found",
      404
    );
  }

  if (
    updates.responsibleUserId !== undefined
  ) {
    await validateResponsibleUser(
      organizationId,
      updates.responsibleUserId
    );
  }

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const updated =
      await complianceRepository.updateRequirement({
        organizationId,
        id,
        name: updates.name,
        requirementType:
          updates.requirementType,
        description: updates.description,
        responsibleUserId:
          updates.responsibleUserId,
        expiryDate: updates.expiryDate,
        connection,
      });

    if (!updated) {
      throw createError(
        "Compliance requirement could not be updated",
        409
      );
    }

    await complianceRepository.createAuditEvent({
      organizationId,
      actorId,
      action:
        "COMPLIANCE_REQUIREMENT_UPDATED",
      entityType:
        "COMPLIANCE_REQUIREMENT",
      entityId: id,
      oldValues: {
        name: existing.name,
        requirementType:
          existing.requirement_type,
        description: existing.description,
        responsibleUserId:
          existing.responsible_user_id,
        expiryDate:
          existing.expiry_date,
      },
      newValues: {
        name: updated.name,
        requirementType:
          updated.requirement_type,
        description: updated.description,
        responsibleUserId:
          updated.responsible_user_id,
        expiryDate:
          updated.expiry_date,
      },
      connection,
    });

    await connection.commit();

    return serializeRequirement(
      updated
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function uploadEvidence({
  organizationId,
  requirementId,
  uploadedBy,
  file,
  documentDate,
  expiryDate,
}) {
  if (!file) {
    throw createError(
      "Compliance evidence file is required",
      400
    );
  }

  const requirement =
    await complianceRepository.findRequirementById(
      organizationId,
      requirementId
    );

  if (!requirement) {
    await fs.unlink(file.path).catch(() => {});

    throw createError(
      "Compliance requirement not found",
      404
    );
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    await fs.unlink(file.path).catch(() => {});

    throw createError(
      "Only JPEG, PNG, WEBP, and PDF files are allowed",
      400
    );
  }

  const validContent =
    await validateFileContent(
      file.path,
      file.mimetype
    );

  if (!validContent) {
    await fs.unlink(file.path).catch(() => {});

    throw createError(
      "The uploaded file content does not match its declared file type",
      400
    );
  }

  let fileHash;

  try {
    fileHash = await calculateFileHash(
      file.path
    );
  } catch (error) {
    await fs.unlink(file.path).catch(() => {});
    throw error;
  }

  const filePath = path.relative(
    process.cwd(),
    file.path
  );

  const existingDuplicate =
    await complianceRepository.findEvidenceByHash({
      requirementId,
      fileHash,
    });

  if (existingDuplicate) {
    await fs.unlink(file.path).catch(() => {});

    throw createError(
      "This evidence file has already been uploaded for this requirement",
      409
    );
  }

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const evidence =
      await complianceRepository.createEvidence({
        requirementId,
        uploadedBy,
        fileName: file.originalname,
        filePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash,
        documentDate,
        expiryDate,
        connection,
      });

    await complianceRepository.createAuditEvent({
      organizationId,
      actorId: uploadedBy,
      action:
        "COMPLIANCE_EVIDENCE_UPLOADED",
      entityType:
        "COMPLIANCE_EVIDENCE",
      entityId: evidence.id,
      newValues: {
        requirementId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash,
        documentDate:
          documentDate || null,
        expiryDate:
          expiryDate || null,
        verificationStatus:
          evidence.verification_status,
      },
      connection,
    });

    await notificationEventService.notifyManagers({
      organizationId,
      type:
        "COMPLIANCE_EVIDENCE_UPLOADED",
      title:
        "Compliance evidence uploaded",
      message:
        `New compliance evidence was uploaded for "${requirement.name}".`,
      entityType:
        "COMPLIANCE_EVIDENCE",
      entityId: evidence.id,
      connection,
    });

    await connection.commit();

    return serializeComplianceEvidence(evidence);
  } catch (error) {
    await connection.rollback();

    await fs.unlink(file.path).catch(() => {});

    if (error.code === "ER_DUP_ENTRY") {
      throw createError(
        "This evidence file has already been uploaded for this requirement",
        409
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function getRequirementEvidence({
  organizationId,
  requirementId,
}) {
  const requirement =
    await complianceRepository.findRequirementById(
      organizationId,
      requirementId
    );

  if (!requirement) {
    throw createError(
      "Compliance requirement not found",
      404
    );
  }

const evidence =
  await complianceRepository.findEvidenceForRequirement({
    organizationId,
    requirementId,
  });

return evidence.map(
  serializeComplianceEvidence
);
}

async function getEvidence({
  organizationId,
  evidenceId,
}) {
  const evidence =
    await complianceRepository.findEvidenceById(
      evidenceId
    );

  if (
    !evidence ||
    Number(evidence.organization_id) !==
      Number(organizationId)
  ) {
    throw createError(
      "Compliance evidence not found",
      404
    );
  }

  return serializeComplianceEvidence(evidence);
}

async function getEvidenceFile({
  organizationId,
  evidenceId,
}) {
  const evidence =
    await complianceRepository.findEvidenceById(
      evidenceId
    );

  if (
    !evidence ||
    Number(evidence.organization_id) !==
      Number(organizationId)
  ) {
    throw createError(
      "Compliance evidence not found",
      404
    );
  }

  const storedPath = path.resolve(
    process.cwd(),
    evidence.file_path
  );

  const uploadsDirectory = path.resolve(
    process.cwd(),
    "uploads"
  );

  if (
    storedPath !== uploadsDirectory &&
    !storedPath.startsWith(
      `${uploadsDirectory}${path.sep}`
    )
  ) {
    throw createError(
      "Invalid evidence file path",
      400
    );
  }

  try {
    await fs.access(storedPath);
  } catch {
    throw createError(
      "Evidence file is no longer available",
      404
    );
  }

  return {
    filePath: storedPath,
    fileName: evidence.file_name,
    mimeType: evidence.mime_type,
  };
}

async function verifyEvidence({
  organizationId,
  evidenceId,
  verificationStatus,
  verificationNotes,
  actorId,
}) {
  const existing =
    await complianceRepository.findEvidenceById(
      evidenceId
    );

  if (
    !existing ||
    Number(existing.organization_id) !==
      Number(organizationId)
  ) {
    throw createError(
      "Compliance evidence not found",
      404
    );
  }

  if (existing.verification_status !== "PENDING") {
    throw createError(
      "Only pending compliance evidence can be verified or rejected",
      409
    );
  }

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const updated =
      await complianceRepository.updateEvidenceVerification({
        id: evidenceId,
        verificationStatus,
        verificationNotes,
        connection,
      });

    if (!updated) {
      throw createError(
        "Only pending compliance evidence can be verified or rejected",
        409
      );
    }

    const action =
      verificationStatus === "VERIFIED"
        ? "COMPLIANCE_EVIDENCE_VERIFIED"
        : "COMPLIANCE_EVIDENCE_REJECTED";

    await complianceRepository.createAuditEvent({
      organizationId,
      actorId,
      action,
      entityType:
        "COMPLIANCE_EVIDENCE",
      entityId: evidenceId,
      oldValues: {
        verificationStatus:
          existing.verification_status,
        verificationNotes:
          existing.verification_notes,
      },
      newValues: {
        verificationStatus:
          updated.verification_status,
        verificationNotes:
          updated.verification_notes,
      },
      connection,
    });

    await notificationEventService.notifyUser({
      userId: existing.uploaded_by,
      organizationId,
      type:
        verificationStatus === "VERIFIED"
          ? "COMPLIANCE_EVIDENCE_VERIFIED"
          : "COMPLIANCE_EVIDENCE_REJECTED",
      title:
        verificationStatus === "VERIFIED"
          ? "Compliance evidence verified"
          : "Compliance evidence rejected",
      message:
        verificationStatus === "VERIFIED"
          ? `Your compliance evidence for "${existing.requirement_name}" was verified.`
          : `Your compliance evidence for "${existing.requirement_name}" was rejected.`,
      entityType:
        "COMPLIANCE_EVIDENCE",
      entityId: evidenceId,
      connection,
    });

    await connection.commit();

    return serializeComplianceEvidence(updated);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createRequirement,
  listRequirements,
  getRequirement,
  updateRequirement,
  uploadEvidence,
  getRequirementEvidence,
  getEvidence,
  getEvidenceFile,
  verifyEvidence,
};