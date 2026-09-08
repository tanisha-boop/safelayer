const pool =
  require("../config/database");

async function createEvent(
  {
    organizationId,
    activityId,
    userId,
    eventType,
    latitude,
    longitude,
    accuracyMeters,
  },
  connection = pool
) {
  const [result] =
    await connection.execute(
      `
      INSERT INTO route_proof_events
      (
        organization_id,
        activity_id,
        user_id,
        event_type,
        latitude,
        longitude,
        accuracy_meters
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        organizationId,
        activityId,
        userId,
        eventType,
        latitude,
        longitude,
        accuracyMeters ?? null,
      ]
    );

  return findById(
    organizationId,
    result.insertId,
    connection
  );
}

async function findById(
  organizationId,
  eventId,
  connection = pool
) {
  const [rows] =
    await connection.execute(
      `
      SELECT
        r.id,
        r.organization_id,
        r.activity_id,
        r.user_id,
        r.event_type,
        r.latitude,
        r.longitude,
        r.accuracy_meters,
        r.recorded_at,
        u.first_name,
        u.last_name,
        u.email,
        a.title AS activity_title,
        a.activity_type
      FROM route_proof_events r
      JOIN users u
        ON u.id = r.user_id
      JOIN field_activities a
        ON a.id = r.activity_id
      WHERE r.organization_id = ?
        AND r.id = ?
      `,
      [
        organizationId,
        eventId,
      ]
    );

  return rows[0] || null;
}

async function findByActivity(
  organizationId,
  activityId
) {
  const [rows] =
    await pool.execute(
      `
      SELECT
        r.id,
        r.organization_id,
        r.activity_id,
        r.user_id,
        r.event_type,
        r.latitude,
        r.longitude,
        r.accuracy_meters,
        r.recorded_at,
        u.first_name,
        u.last_name,
        u.email
      FROM route_proof_events r
      JOIN users u
        ON u.id = r.user_id
      WHERE r.organization_id = ?
        AND r.activity_id = ?
      ORDER BY r.recorded_at ASC
      `,
      [
        organizationId,
        activityId,
      ]
    );

  return rows;
}

async function findLatestEvent(
  organizationId,
  activityId,
  eventType
) {
  const [rows] =
    await pool.execute(
      `
      SELECT
        id,
        organization_id,
        activity_id,
        user_id,
        event_type,
        latitude,
        longitude,
        accuracy_meters,
        recorded_at
      FROM route_proof_events
      WHERE organization_id = ?
        AND activity_id = ?
        AND event_type = ?
      ORDER BY recorded_at DESC, id DESC
      LIMIT 1
      `,
      [
        organizationId,
        activityId,
        eventType,
      ]
    );

  return rows[0] || null;
}

module.exports = {
  createEvent,
  findById,
  findByActivity,
  findLatestEvent,
};