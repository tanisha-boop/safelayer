const trustService =
  require("../services/trustService");

async function assessActivity(
  req,
  res,
  next
) {
  try {
    const {
      activityId,
    } = req.validated.params;

    const result =
      await trustService.assessActivity({
        organizationId:
          req.user.organizationId,
        activityId,
        actorId: req.user.id,
      });

    res.status(201).json({
      success: true,
      message:
        "Trust assessment created",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getLatestAssessment(
  req,
  res,
  next
) {
  try {
    const {
      activityId,
    } = req.validated.params;

    const result =
      await trustService.getLatestAssessment({
        organizationId:
          req.user.organizationId,
        activityId,
      });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  assessActivity,
  getLatestAssessment,
};
