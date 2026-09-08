const routeProofService =
  require("../services/routeProofService");

async function checkIn(req, res, next) {
  try {
    const event =
      await routeProofService.checkIn({
        organizationId:
          req.user.organizationId,

        activityId:
          req.validated.params.activityId,

        userId:
          req.user.id,

        ...req.validated.body,
      });

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

async function gpsUpdate(req, res, next) {
  try {
    const event =
      await routeProofService.gpsUpdate({
        organizationId:
          req.user.organizationId,

        activityId:
          req.validated.params.activityId,

        userId:
          req.user.id,

        ...req.validated.body,
      });

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

async function checkOut(req, res, next) {
  try {
    const event =
      await routeProofService.checkOut({
        organizationId:
          req.user.organizationId,

        activityId:
          req.validated.params.activityId,

        userId:
          req.user.id,

        ...req.validated.body,
      });

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

async function getActivityRouteProof(
  req,
  res,
  next
) {
  try {
    const events =
      await routeProofService
        .getActivityRouteProof(
          req.user.organizationId,
          req.validated.params.activityId
        );

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkIn,
  gpsUpdate,
  checkOut,
  getActivityRouteProof,
};
