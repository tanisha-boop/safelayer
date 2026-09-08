const activityRepository = require("../repositories/activityRepository");

function toMySQLDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const error = new Error("Invalid scheduledAt date");
    error.statusCode = 400;
    throw error;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function createActivity({
  organizationId,
  assignedTo,
  activityType,
  title,
  description,
  scheduledAt,
  latitude,
  longitude,
}) {
  const user = await activityRepository.findUserForAssignment(
    organizationId,
    assignedTo
  );

  if (!user) {
    const error = new Error(
      "Assigned user does not exist, is inactive, or belongs to another organization"
    );
    error.statusCode = 400;
    throw error;
  }

  const mysqlScheduledAt = toMySQLDateTime(scheduledAt);

  return activityRepository.createActivity({
    organizationId,
    assignedTo,
    activityType,
    title,
    description,
    scheduledAt: mysqlScheduledAt,
    latitude,
    longitude,
  });
}

async function getActivities(organizationId, filters) {
  return activityRepository.findActivities(
    organizationId,
    filters
  );
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
  updates
) {
  const activity = await activityRepository.findActivityById(
    organizationId,
    activityId
  );

  if (!activity) {
    const error = new Error("Activity not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    activity.status === "COMPLETED" ||
    activity.status === "CANCELLED"
  ) {
    const error = new Error(
      "Completed or cancelled activities cannot be edited"
    );
    error.statusCode = 400;
    throw error;
  }

  if (updates.assignedTo !== undefined) {
    const user = await activityRepository.findUserForAssignment(
      organizationId,
      updates.assignedTo
    );

    if (!user) {
      const error = new Error(
        "Assigned user does not exist, is inactive, or belongs to another organization"
      );
      error.statusCode = 400;
      throw error;
    }
  }

  if (updates.scheduledAt !== undefined) {
    updates.scheduledAt = toMySQLDateTime(
      updates.scheduledAt
    );
  }

  return activityRepository.updateActivity(
    organizationId,
    activityId,
    updates
  );
}

async function startActivity(
  organizationId,
  activityId,
  userId,
  roles
) {
  const activity = await activityRepository.findActivityById(
    organizationId,
    activityId
  );

  if (!activity) {
    const error = new Error("Activity not found");
    error.statusCode = 404;
    throw error;
  }

  const isAssignedWorker =
    Number(activity.assigned_to) === Number(userId);

  const isManager = roles.some((role) =>
    ["OWNER", "ADMIN", "MANAGER"].includes(role)
  );

  if (!isAssignedWorker && !isManager) {
    const error = new Error(
      "You are not allowed to start this activity"
    );
    error.statusCode = 403;
    throw error;
  }

  if (activity.status !== "PENDING") {
    const error = new Error(
      `Activity cannot be started from ${activity.status} status`
    );
    error.statusCode = 400;
    throw error;
  }

  return activityRepository.updateStatus(
    organizationId,
    activityId,
    "IN_PROGRESS"
  );
}

async function completeActivity(
  organizationId,
  activityId,
  userId,
  roles
) {
  const activity = await activityRepository.findActivityById(
    organizationId,
    activityId
  );

  if (!activity) {
    const error = new Error("Activity not found");
    error.statusCode = 404;
    throw error;
  }

  const isAssignedWorker =
    Number(activity.assigned_to) === Number(userId);

  const isManager = roles.some((role) =>
    ["OWNER", "ADMIN", "MANAGER"].includes(role)
  );

  if (!isAssignedWorker && !isManager) {
    const error = new Error(
      "You are not allowed to complete this activity"
    );
    error.statusCode = 403;
    throw error;
  }

  if (activity.status !== "IN_PROGRESS") {
    const error = new Error(
      `Activity cannot be completed from ${activity.status} status`
    );
    error.statusCode = 400;
    throw error;
  }

  return activityRepository.updateStatus(
    organizationId,
    activityId,
    "COMPLETED"
  );
}

async function cancelActivity(
  organizationId,
  activityId
) {
  const activity = await activityRepository.findActivityById(
    organizationId,
    activityId
  );

  if (!activity) {
    const error = new Error("Activity not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    activity.status === "COMPLETED" ||
    activity.status === "CANCELLED"
  ) {
    const error = new Error(
      `Activity cannot be cancelled from ${activity.status} status`
    );
    error.statusCode = 400;
    throw error;
  }

  return activityRepository.updateStatus(
    organizationId,
    activityId,
    "CANCELLED"
  );
}

module.exports = {
  createActivity,
  getActivities,
  getActivity,
  updateActivity,
  startActivity,
  completeActivity,
  cancelActivity,
};