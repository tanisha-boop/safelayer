const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const evidenceRepository =
  require("../repositories/evidenceRepository");

const activityRepository =
  require("../repositories/activityRepository");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const mimeToEvidenceType = {
  "image/jpeg": "PHOTO",
  "image/png": "PHOTO",
  "image/webp": "PHOTO",
  "application/pdf": "DOCUMENT",
};

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

  return evidenceRepository.createEvidence({
    activityId,
    uploadedBy,
    evidenceType,
    fileName: file.originalname,
    filePath: path.relative(
      process.cwd(),
      file.path
    ),
    mimeType: file.mimetype,
    fileSize: file.size,
    fileHash,
  });
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

  return evidence;
}

async function getActivityEvidence(
  organizationId,
  activityId
) {
  await getActivity(
    organizationId,
    activityId
  );

  return evidenceRepository.findByActivity(
    activityId
  );
}

async function verifyEvidence(
  organizationId,
  evidenceId,
  status,
  notes
) {
  await getEvidence(
    organizationId,
    evidenceId
  );

  return evidenceRepository.updateVerification(
    evidenceId,
    status,
    notes
  );
}

module.exports = {
  createEvidence,
  getEvidence,
  getActivityEvidence,
  verifyEvidence,
};
