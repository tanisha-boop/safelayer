const pool = require("../config/database");

async function listAuditEvents({
  organizationId,
  page,
  limit,
  action,
  entityType,
  entityId,
  actorId,
}) {
  const offset = (page - 1) * limit;

  const conditions = ["a.organization_id = ?"];
  const values = [organizationId];

  if (action) {
    conditions.push("a.action = ?");
    values.push(action);
  }

  if (entityType) {
    conditions.push("a.entity_type = ?");
    values.push(entityType);
  }

  if (entityId) {
    conditions.push("a.entity_id = ?");
    values.push(entityId);
  }

  if (actorId) {
    conditions.push("a.actor_id = ?");
    values.push(actorId);
  }

  const whereClause = conditions.join(" AND ");

  const [rows] = await pool.execute(
    `
      SELECT
        a.id,
        a.organization_id,
        a.actor_id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.old_values,
        a.new_values,
        a.ip_address,
        a.user_agent,
        a.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM audit_events a
      LEFT JOIN users u
        ON u.id = a.actor_id
      WHERE ${whereClause}
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const [countRows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM audit_events a
      WHERE ${whereClause}
    `,
    values
  );

  return {
    rows,
    total: Number(countRows[0].total),
  };
}

async function findAuditEventById({
  organizationId,
  id,
}) {
  const [rows] = await pool.execute(
    `
      SELECT
        a.id,
        a.organization_id,
        a.actor_id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.old_values,
        a.new_values,
        a.ip_address,
        a.user_agent,
        a.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM audit_events a
      LEFT JOIN users u
        ON u.id = a.actor_id
      WHERE a.id = ?
        AND a.organization_id = ?
      LIMIT 1
    `,
    [id, organizationId]
  );

  return rows[0] || null;
}

module.exports = {
  listAuditEvents,
  findAuditEventById,
};
