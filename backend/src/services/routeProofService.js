const routeProofRepository =
  require("../repositories/routeProofRepository");

const activityRepository =
  require("../repositories/activityRepository");

const pool =
  require("../config/database");

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
    const error =
      new Error("Activity not found");

    error.statusCode = 404;

    throw error;
  }

  return activity;
}

function ensureAssignedWorker(
  activity,
  userId
) {
  if (activity.assigned_to !== userId) {
    const error = new Error(
      "Only the assigned worker can record route proof"
    );

    error.statusCode = 403;

    throw error;
  }
}

async function checkIn({
  organizationId,
  activityId,
  userId,
  latitude,
  longitude,
  accuracyMeters,
}) {
  const activity =
    await getActivity(
      organizationId,
      activityId
    );

  ensureAssignedWorker(
    activity,
    userId
  );

  if (activity.status !== "PENDING") {
    const error = new Error(
      "Activity must be PENDING before check-in"
    );

    error.statusCode = 409;

    throw error;
  }

  const existing =
    await routeProofRepository.findLatestEvent(
      organizationId,
      activityId,
      "CHECK_IN"
    );

  if (existing) {
    const error = new Error(
      "Activity has already been checked in"
    );

    error.statusCode = 409;

    throw error;
  }

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const event =
      await routeProofRepository.createEvent(
        {
          organizationId,
          activityId,
          userId,
          eventType: "CHECK_IN",
          latitude,
          longitude,
          accuracyMeters,
        },
        connection
      );

    await activityRepository.updateStatus(
      organizationId,
      activityId,
      "IN_PROGRESS",
      connection
    );

    await connection.commit();

    return event;
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}

async function gpsUpdate({
  organizationId,
  activityId,
  userId,
  latitude,
  longitude,
  accuracyMeters,
}) {
  const activity =
    await getActivity(
      organizationId,
      activityId
    );

  ensureAssignedWorker(
    activity,
    userId
  );

  if (activity.status !== "IN_PROGRESS") {
    const error = new Error(
      "Activity must be IN_PROGRESS for GPS updates"
    );

    error.statusCode = 409;

    throw error;
  }

  return routeProofRepository.createEvent({
    organizationId,
    activityId,
    userId,
    eventType: "GPS_UPDATE",
    latitude,
    longitude,
    accuracyMeters,
  });
}

async function checkOut({
  organizationId,
  activityId,
  userId,
  latitude,
  longitude,
  accuracyMeters,
}) {
  const activity =
    await getActivity(
      organizationId,
      activityId
    );

  ensureAssignedWorker(
    activity,
    userId
  );

  if (activity.status !== "IN_PROGRESS") {
    const error = new Error(
      "Activity must be IN_PROGRESS before check-out"
    );

    error.statusCode = 409;

    throw error;
  }

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const event =
      await routeProofRepository.createEvent(
        {
          organizationId,
          activityId,
          userId,
          eventType: "CHECK_OUT",
          latitude,
          longitude,
          accuracyMeters,
        },
        connection
      );

    await activityRepository.completeActivity(
      organizationId,
      activityId,
      latitude,
      longitude,
      connection
    );

    await connection.commit();

    return event;
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}

async function getActivityRouteProof(
  organizationId,
  activityId
) {
  await getActivity(
    organizationId,
    activityId
  );

  return routeProofRepository.findByActivity(
    organizationId,
    activityId
  );
}

module.exports = {
  checkIn,
  gpsUpdate,
  checkOut,
  getActivityRouteProof,
};