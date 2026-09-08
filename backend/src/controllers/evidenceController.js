const evidenceService =
  require("../services/evidenceService");

async function upload(req, res, next) {
  try {
    const evidence =
      await evidenceService.createEvidence({
        organizationId:
          req.user.organizationId,

        activityId:
          req.validated.params.activityId,

        uploadedBy:
          req.user.id,

        userRoles:
          req.user.roles || [],

        file: req.file,
      });

    res.status(201).json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const evidence =
      await evidenceService.getEvidence(
        req.user.organizationId,
        req.validated.params.id
      );

    res.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
}

async function getForActivity(req, res, next) {
  try {
    const evidence =
      await evidenceService.getActivityEvidence(
        req.user.organizationId,
        req.validated.params.activityId
      );

    res.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
}

async function verify(req, res, next) {
  try {
    const evidence =
      await evidenceService.verifyEvidence(
        req.user.organizationId,
        req.validated.params.id,
        req.validated.body.verificationStatus,
        req.validated.body.verificationNotes
      );

    res.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  upload,
  getOne,
  getForActivity,
  verify,
};
