const pool = require("../config/database");

async function findUserForAssignment(
  organizationId,
  userId
) {
  const [rows] = await pool.execute(
    `SELECT
      id,
      organization_id,
      first_name,
      last_name,
      email,
      role,
      is_active
     FROM users
     WHERE id = ?
       AND organization_id = ?
       AND is_active = 1
     LIMIT 1`,
    [userId, organizationId]
  );

  return rows[0] || null;
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
  const [result] = await pool.execute(
    `INSERT INTO field_activities (
      organization_id,
      assigned_to,
      activity_type,
      title,
      description,
      scheduled_at,
      latitude,
      longitude
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      assignedTo,
      activityType,
      title,
      description ?? null,
      scheduledAt ?? null,
      latitude ?? null,
      longitude ?? null,
    ]
  );

  return findActivityById(
    organizationId,
    result.insertId
  );
}

async function findActivities(
  organizationId,
  filters = {}
) {
  let query = `
    SELECT
      fa.*,
      u.first_name,
      u.last_name,
      u.email,
      u.role AS user_role
    FROM field_activities fa
    INNER JOIN users u
      ON u.id = fa.assigned_to
    WHERE fa.organization_id = ?
  `;

  const params = [organizationId];

  if (filters.status) {
    query += ` AND fa.status = ?`;
    params.push(filters.status);
  }

  if (filters.assignedTo) {
    query += ` AND fa.assigned_to = ?`;
    params.push(filters.assignedTo);
  }

  query += ` ORDER BY fa.created_at DESC`;

  const [rows] = await pool.execute(
    query,
    params
  );

  return rows;
}

async function findActivityById(
  organizationId,
  activityId,
  connection = pool
) {
  const [rows] = await connection.execute(
    `SELECT
      fa.*,
      u.first_name,
      u.last_name,
      u.email,
      u.role AS user_role
     FROM field_activities fa
     INNER JOIN users u
       ON u.id = fa.assigned_to
     WHERE fa.organization_id = ?
       AND fa.id = ?
     LIMIT 1`,
    [organizationId, activityId]
  );

  return rows[0] || null;
}

async function updateActivity(
  organizationId,
  activityId,
  updates
) {
  const allowedFields = {
    assignedTo: "assigned_to",
    activityType: "activity_type",
    title: "title",
    description: "description",
    scheduledAt: "scheduled_at",
    latitude: "latitude",
    longitude: "longitude",
  };

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields[key] !== undefined) {
      fields.push(`${allowedFields[key]} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    return findActivityById(
      organizationId,
      activityId
    );
  }

  values.push(organizationId);
  values.push(activityId);

  await pool.execute(
    `UPDATE field_activities
     SET ${fields.join(", ")}
     WHERE organization_id = ?
       AND id = ?`,
    values
  );

  return findActivityById(
    organizationId,
    activityId
  );
}

async function updateStatus(
  organizationId,
  activityId,
  status,
  connection = pool
) {
  let query = `
    UPDATE field_activities
    SET status = ?
  `;

  const params = [status];

  if (status === "IN_PROGRESS") {
    query += `, completed_at = NULL`;
  }

  if (status === "COMPLETED") {
    query += `, completed_at = NOW()`;
  }

  query += `
    WHERE organization_id = ?
      AND id = ?
  `;

  params.push(
    organizationId,
    activityId
  );

  await connection.execute(
    query,
    params
  );

  return findActivityById(
    organizationId,
    activityId,
    connection
  );
}

async function completeActivity(
  organizationId,
  activityId,
  latitude,
  longitude,
  connection = pool
) {
  await connection.execute(
    `UPDATE field_activities
     SET
       status = 'COMPLETED',
       completed_at = NOW(),
       latitude = ?,
       longitude = ?
     WHERE organization_id = ?
       AND id = ?`,
    [
      latitude,
      longitude,
      organizationId,
      activityId,
    ]
  );

  return findActivityById(
    organizationId,
    activityId,
    connection
  );
}
module.exports = {
  findUserForAssignment,
  createActivity,
  findActivities,
  findActivityById,
  updateActivity,
  updateStatus,
  completeActivity,
};
