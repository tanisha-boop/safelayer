const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const pool = require("../config/database");

const evidenceRepository =
  require("../repositories/evidenceRepository");

const activityRepository =
  require("../repositories/activityRepository");

const notificationEventService =
  require("./notificationEventService");

const {
  allowedMimeTypes,
  validateFileContent,
} = require("../utils/fileValidation");

const mimeToEvidenceType = {
  "image/jpeg": "PHOTO",
  "image/png": "PHOTO",
  "image/webp": "PHOTO",
  "application/pdf": "DOCUMENT",
};

function serializeEvidence(evidence) {
  if (!evidence) {
    return null;
  }

  const serialized = { ...evidence };
  delete serialized.file_path;

  return serialized;
}

async function getActivity(
  organizationId,
  activityId
) {
  const activity =
    await activityRepository.findActivityById(
      organizationId,
      activityId
    );

  if (!activity) {
    const error = new Error("Activity not found");
    error.statusCode = 404;
    throw error;
  }

  return activity;
}

async function calculateFileHash(filePath) {
  const buffer = await fs.readFile(filePath);

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

async function createEvidence({
  organizationId,
  activityId,
  uploadedBy,
  userRoles,
  file,
}) {
  if (!file) {
    const error = new Error(
      "Evidence file is required"
    );
    error.statusCode = 400;
    throw error;
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    await fs.unlink(file.path).catch(() => {});

    const error = new Error(
      "Only JPEG, PNG, WEBP, and PDF files are allowed"
    );
    error.statusCode = 400;
    throw error;
  }

  const fileContentValid = await validateFileContent(
    file.path,
    file.mimetype
  );

  if (!fileContentValid) {
    await fs.unlink(file.path).catch(() => {});

    const error = new Error(
      "The uploaded file content does not match its declared file type"
    );
    error.statusCode = 400;
    throw error;
  }

  const activity = await getActivity(
    organizationId,
    activityId
  );

  const elevatedRoles = [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ];

  const isElevated =
    userRoles.some((role) =>
      elevatedRoles.includes(role)
    );

  const isAssignedWorker =
    Number(activity.assigned_to) ===
    Number(uploadedBy);

  if (!isAssignedWorker && !isElevated) {
    await fs.unlink(file.path).catch(() => {});

    const error = new Error(
      "You are not authorized to upload evidence for this activity"
    );
    error.statusCode = 403;
    throw error;
  }

  const fileHash =
    await calculateFileHash(file.path);

  const evidenceType =
    mimeToEvidenceType[file.mimetype] ||
    "OTHER";

  const filePath = path.relative(
    process.cwd(),
    file.path
  );

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const evidence =
      await evidenceRepository.createEvidence({
        activityId,
        uploadedBy,
        evidenceType,
        fileName: file.originalname,
        filePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash,
        connection,
      });

    await evidenceRepository.createAuditEvent({
      organizationId,
      actorId: uploadedBy,
      action: "EVIDENCE_CREATED",
      entityType: "EVIDENCE",
      entityId: evidence.id,
      newValues: {
        activityId,
        uploadedBy,
        evidenceType,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash,
        verificationStatus:
          evidence.verification_status,
      },
      connection,
    });

    await notificationEventService.notifyManagers({
      organizationId,
      type: "EVIDENCE_UPLOADED",
      title: "New evidence uploaded",
      message:
        `New evidence was uploaded for activity: ${activity.title}`,
      entityType: "EVIDENCE",
      entityId: evidence.id,
      connection,
    });

    await connection.commit();

    return serializeEvidence(evidence);
  } catch (error) {
    await connection.rollback();

    await fs.unlink(file.path).catch(() => {});

    throw error;
  } finally {
    connection.release();
  }
}

async function getEvidence(
  organizationId,
  evidenceId
) {
  const evidence =
    await evidenceRepository.findById(
      evidenceId
    );

  if (!evidence) {
    const error = new Error(
      "Evidence not found"
    );
    error.statusCode = 404;
    throw error;
  }

  const activity =
    await getActivity(
      organizationId,
      evidence.activity_id
    );

  if (!activity) {
    const error = new Error(
      "Evidence not found"
    );
    error.statusCode = 404;
    throw error;
  }

  return serializeEvidence(evidence);
}

async function getActivityEvidence(
  organizationId,
  activityId
) {
  await getActivity(
    organizationId,
    activityId
  );

  const evidence =
    await evidenceRepository.findByActivity(
      activityId
    );

  return evidence.map(serializeEvidence);
}

async function verifyEvidence(
  organizationId,
  evidenceId,
  status,
  notes,
  actorId
) {
  const evidence =
    await getEvidence(
      organizationId,
      evidenceId
    );

  const allowedStatuses = [
    "VERIFIED",
    "REJECTED",
  ];

  if (!allowedStatuses.includes(status)) {
    const error = new Error(
      "Invalid evidence verification status"
    );
    error.statusCode = 400;
    throw error;
  }

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const updated =
      await evidenceRepository.updateVerification(
        evidenceId,
        status,
        notes,
        connection
      );

    if (!updated) {
      const error = new Error(
        "Evidence could not be updated"
      );
      error.statusCode = 409;
      throw error;
    }

    const action =
      status === "VERIFIED"
        ? "EVIDENCE_VERIFIED"
        : "EVIDENCE_REJECTED";

    await evidenceRepository.createAuditEvent({
      organizationId,
      actorId,
      action,
      entityType: "EVIDENCE",
      entityId: evidenceId,
      oldValues: {
        verificationStatus:
          evidence.verification_status,
        verificationNotes:
          evidence.verification_notes,
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
      userId: evidence.uploaded_by,
      organizationId,
      type:
        status === "VERIFIED"
          ? "EVIDENCE_VERIFIED"
          : "EVIDENCE_REJECTED",
      title:
        status === "VERIFIED"
          ? "Evidence verified"
          : "Evidence rejected",
      message:
        status === "VERIFIED"
          ? `Your evidence for "${evidence.activity_title}" was verified.`
          : `Your evidence for "${evidence.activity_title}" was rejected.`,
      entityType: "EVIDENCE",
      entityId: evidenceId,
      connection,
    });

    await connection.commit();

    return serializeEvidence(updated);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createEvidence,
  getEvidence,
  getActivityEvidence,
  verifyEvidence,
};
