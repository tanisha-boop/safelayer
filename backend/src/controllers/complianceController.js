const complianceService =
  require("../services/complianceService");

async function create(req, res, next) {
  try {
    const requirement =
      await complianceService.createRequirement({
        organizationId:
          req.user.organizationId,
        createdBy: req.user.id,
        ...req.validated.body,
      });

    res.status(201).json({
      success: true,
      data: requirement,
    });
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const requirements =
      await complianceService.listRequirements({
        organizationId:
          req.user.organizationId,
        ...req.validated.query,
      });

    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const requirement =
      await complianceService.getRequirement({
        organizationId:
          req.user.organizationId,
        id: req.validated.params.id,
      });

    res.json({
      success: true,
      data: requirement,
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const requirement =
      await complianceService.updateRequirement({
        organizationId:
          req.user.organizationId,
        id: req.validated.params.id,
        actorId: req.user.id,
        updates: req.validated.body,
      });

    res.json({
      success: true,
      data: requirement,
    });
  } catch (error) {
    next(error);
  }
}

async function uploadEvidence(
  req,
  res,
  next
) {
  try {
    const evidence =
      await complianceService.uploadEvidence({
        organizationId:
          req.user.organizationId,
        requirementId:
          req.validated.params.id,
        uploadedBy: req.user.id,
        file: req.file,
        ...req.validated.body,
      });

    res.status(201).json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
}

async function getEvidence(
  req,
  res,
  next
) {
  try {
    const evidence =
      await complianceService.getRequirementEvidence({
        organizationId:
          req.user.organizationId,
        requirementId:
          req.validated.params.id,
      });

    res.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
}

async function getEvidenceById(
  req,
  res,
  next
) {
  try {
    const evidence =
      await complianceService.getEvidence({
        organizationId:
          req.user.organizationId,
        evidenceId:
          req.validated.params.id,
      });

    res.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
}

async function getEvidenceFile(
  req,
  res,
  next
) {
  try {
    const file =
      await complianceService.getEvidenceFile({
        organizationId:
          req.user.organizationId,
        evidenceId:
          req.validated.params.id,
      });

    res.type(file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.fileName.replace(/"/g, "")}"`
    );

    res.sendFile(file.filePath);
  } catch (error) {
    next(error);
  }
}

async function verifyEvidence(
  req,
  res,
  next
) {
  try {
    const evidence =
      await complianceService.verifyEvidence({
        organizationId:
          req.user.organizationId,
        evidenceId:
          req.validated.params.id,
        actorId: req.user.id,
        ...req.validated.body,
      });

    res.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  list,
  getOne,
  update,
  uploadEvidence,
  getEvidence,
  getEvidenceById,
  getEvidenceFile,
  verifyEvidence,
};