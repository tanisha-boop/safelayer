const pool = require("../config/database");
const activityRepository = require("../repositories/activityRepository");
const notificationEventService = require("./notificationEventService");

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
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const user =
      await activityRepository.findUserForAssignment(
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

    const mysqlScheduledAt =
      toMySQLDateTime(scheduledAt);

    const activity =
      await activityRepository.createActivity({
        organizationId,
        assignedTo,
        activityType,
        title,
        description,
        scheduledAt: mysqlScheduledAt,
        latitude,
        longitude,
        connection,
      });

    await notificationEventService.notifyUser({
      userId: assignedTo,
      organizationId,
      type: "ACTIVITY_ASSIGNED",
      title: "New activity assigned",
      message: `You have been assigned: ${activity.title}`,
      entityType: "FIELD_ACTIVITY",
      entityId: activity.id,
      connection,
    });

    await connection.commit();

    return activity;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  userId,
  roles,
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

  const isAssignedWorker =
    Number(activity.assigned_to) === Number(userId);

  const isManager = roles.some((role) =>
    ["OWNER", "ADMIN", "MANAGER"].includes(role)
  );

  if (!isAssignedWorker && !isManager) {
    const error = new Error(
      "You are not allowed to update this activity"
    );
    error.statusCode = 403;
    throw error;
  }

  if (
    updates.assignedTo !== undefined &&
    !isManager
  ) {
    const error = new Error(
      "Only managers can reassign activities"
    );
    error.statusCode = 403;
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
  roles,
  latitude,
  longitude
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

  return activityRepository.completeActivity(
    organizationId,
    activityId,
    latitude,
    longitude
  );
}

async function cancelActivity(
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
      "You are not allowed to cancel this activity"
    );
    error.statusCode = 403;
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