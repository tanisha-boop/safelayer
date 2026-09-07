const activityRepository = require("../repositories/activityRepository");
const userRepository = require("../repositories/userRepository");

async function createActivity(organizationId, data) {
  const user = await userRepository.findUserById(data.assignedTo);

  if (!user) {
    const error = new Error("Assigned user not found");
    error.statusCode = 404;
    throw error;
  }

  if (user.organization_id !== organizationId) {
    const error = new Error(
      "Assigned user does not belong to this organization"
    );
    error.statusCode = 403;
    throw error;
  }

  return activityRepository.createActivity({
    organizationId,
    ...data,
  });
}

async function listActivities(organizationId) {
  return activityRepository.findActivities(organizationId);
}

async function getActivity(organizationId, activityId) {
  const activity = await activityRepository.findActivityById(
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

async function updateActivity(
  organizationId,
  activityId,
  data
) {
  const activity = await getActivity(
    organizationId,
    activityId
  );

  if (
    data.assignedTo &&
    data.assignedTo !== activity.assigned_to
  ) {
    const user = await userRepository.findUserById(
      data.assignedTo
    );

    if (!user) {
      const error = new Error("Assigned user not found");
      error.statusCode = 404;
      throw error;
    }

    if (user.organization_id !== organizationId) {
      const error = new Error(
        "Assigned user does not belong to this organization"
      );
      error.statusCode = 403;
      throw error;
    }
  }

  if (
    activity.status === "COMPLETED" ||
    activity.status === "CANCELLED"
  ) {
    const error = new Error(
      "Completed or cancelled activities cannot be edited"
    );
    error.statusCode = 409;
    throw error;
  }

  return activityRepository.updateActivity(
    organizationId,
    activityId,
    data
  );
}

async function startActivity(
  organizationId,
  activityId,
  userId
) {
  const activity = await getActivity(
    organizationId,
    activityId
  );

  if (activity.assigned_to !== userId) {
    const error = new Error(
      "Only the assigned worker can start this activity"
    );
    error.statusCode = 403;
    throw error;
  }

  if (activity.status !== "PENDING") {
    const error = new Error(
      `Activity cannot be started from ${activity.status} status`
    );
    error.statusCode = 409;
    throw error;
  }

  return activityRepository.updateActivityStatus(
    organizationId,
    activityId,
    "IN_PROGRESS"
  );
}

async function completeActivity(
  organizationId,
  activityId,
  userId,
  latitude,
  longitude
) {
  const activity = await getActivity(
    organizationId,
    activityId
  );

  if (activity.assigned_to !== userId) {
    const error = new Error(
      "Only the assigned worker can complete this activity"
    );
    error.statusCode = 403;
    throw error;
  }

  if (activity.status !== "IN_PROGRESS") {
    const error = new Error(
      "Only an in-progress activity can be completed"
    );
    error.statusCode = 409;
    throw error;
  }

  return activityRepository.completeActivity(
    organizationId,
    activityId,
    latitude,
    longitude
  );
}

async function cancelActivity(
  organizationId,
  activityId
) {
  const activity = await getActivity(
    organizationId,
    activityId
  );

  if (activity.status === "COMPLETED") {
    const error = new Error(
      "Completed activities cannot be cancelled"
    );
    error.statusCode = 409;
    throw error;
  }

  return activityRepository.updateActivityStatus(
    organizationId,
    activityId,
    "CANCELLED"
  );
}

module.exports = {
  createActivity,
  listActivities,
  getActivity,
  updateActivity,
  startActivity,
  completeActivity,
  cancelActivity,
};