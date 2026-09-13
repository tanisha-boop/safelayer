const activityService = require("../services/activityService");

async function create(req, res, next) {
  try {
    const activity =
      await activityService.createActivity({
        organizationId: req.user.organizationId,
        ...req.validated.body,
      });

    res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const activities = await activityService.getActivities(
      req.user.organizationId
    );

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const activity =
      await activityService.getActivity(
        req.user.organizationId,
        req.validated.params.id
      );

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const activity =
      await activityService.updateActivity(
        req.user.organizationId,
        req.validated.params.id,
        req.user.id,
        req.user.roles,
        req.validated.body
      );

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
}

async function start(req, res, next) {
  try {
    const activity =
      await activityService.startActivity(
        req.user.organizationId,
        req.validated.params.id,
        req.user.id,
        req.user.roles
      );

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
}

async function complete(req, res, next) {
  try {
    const activity =
      await activityService.completeActivity(
        req.user.organizationId,
        req.validated.params.id,
        req.user.id,
        req.user.roles,
        req.validated.body.latitude,
        req.validated.body.longitude
      );

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const activity =
      await activityService.cancelActivity(
        req.user.organizationId,
        req.validated.params.id,
        req.user.id,
        req.user.roles
      );

    res.json({
      success: true,
      data: activity,
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
  start,
  complete,
  cancel,
};