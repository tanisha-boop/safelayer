const pool = require("../config/database");

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
  const [result] = await pool.execute(
    `
      INSERT INTO field_activities
      (
        organization_id,
        assigned_to,
        activity_type,
        title,
        description,
        scheduled_at,
        latitude,
        longitude
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      organizationId,
      assignedTo,
      activityType,
      title,
      description || null,
      scheduledAt || null,
      latitude ?? null,
      longitude ?? null,
    ]
  );

  return findActivityById(organizationId, result.insertId);
}

async function findActivities(organizationId) {
  const [rows] = await pool.execute(
    `
      SELECT
        fa.*,
        u.first_name,
        u.last_name,
        u.email
      FROM field_activities fa
      INNER JOIN users u
        ON u.id = fa.assigned_to
      WHERE fa.organization_id = ?
      ORDER BY fa.created_at DESC
    `,
    [organizationId]
  );

  return rows;
}

async function findActivityById(organizationId, activityId) {
  const [rows] = await pool.execute(
    `
      SELECT
        fa.*,
        u.first_name,
        u.last_name,
        u.email
      FROM field_activities fa
      INNER JOIN users u
        ON u.id = fa.assigned_to
      WHERE fa.organization_id = ?
        AND fa.id = ?
      LIMIT 1
    `,
    [organizationId, activityId]
  );

  return rows[0] || null;
}

async function updateActivity(
  organizationId,
  activityId,
  updates
) {
  const fields = [];
  const values = [];

  const allowedFields = {
    assignedTo: "assigned_to",
    activityType: "activity_type",
    title: "title",
    description: "description",
    scheduledAt: "scheduled_at",
    latitude: "latitude",
    longitude: "longitude",
  };

  for (const [key, column] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) {
    return findActivityById(organizationId, activityId);
  }

  values.push(organizationId, activityId);

  await pool.execute(
    `
      UPDATE field_activities
      SET ${fields.join(", ")}
      WHERE organization_id = ?
        AND id = ?
    `,
    values
  );

  return findActivityById(organizationId, activityId);
}

async function updateActivityStatus(
  organizationId,
  activityId,
  status
) {
  const [result] = await pool.execute(
    `
      UPDATE field_activities
      SET status = ?
      WHERE organization_id = ?
        AND id = ?
    `,
    [status, organizationId, activityId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findActivityById(organizationId, activityId);
}

async function completeActivity(
  organizationId,
  activityId,
  latitude,
  longitude
) {
  const [result] = await pool.execute(
    `
      UPDATE field_activities
      SET
        status = 'COMPLETED',
        completed_at = NOW(),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude)
      WHERE organization_id = ?
        AND id = ?
    `,
    [
      latitude ?? null,
      longitude ?? null,
      organizationId,
      activityId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findActivityById(organizationId, activityId);
}

module.exports = {
  createActivity,
  findActivities,
  findActivityById,
  updateActivity,
  updateActivityStatus,
  completeActivity,
};