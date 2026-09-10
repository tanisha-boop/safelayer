const auditRepository = require("../repositories/auditRepository");

function parseJsonValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatAuditEvent(event) {
  return {
    id: event.id,
    organizationId: event.organization_id,
    actorId: event.actor_id,
    actor: event.actor_id
      ? {
          firstName: event.first_name,
          lastName: event.last_name,
          email: event.email,
        }
      : null,
    action: event.action,
    entityType: event.entity_type,
    entityId: event.entity_id,
    oldValues: parseJsonValue(event.old_values),
    newValues: parseJsonValue(event.new_values),
    ipAddress: event.ip_address,
    userAgent: event.user_agent,
    createdAt: event.created_at,
  };
}

async function listAuditEvents({
  organizationId,
  page,
  limit,
  action,
  entityType,
  entityId,
  actorId,
}) {
  const result = await auditRepository.listAuditEvents({
    organizationId,
    page,
    limit,
    action,
    entityType,
    entityId,
    actorId,
  });

  const totalPages = Math.ceil(result.total / limit);

  return {
    data: result.rows.map(formatAuditEvent),
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages,
    },
  };
}

async function getAuditEvent({
  organizationId,
  id,
}) {
  const event = await auditRepository.findAuditEventById({
    organizationId,
    id,
  });

  if (!event) {
    const error = new Error("Audit event not found");
    error.statusCode = 404;
    throw error;
  }

  return formatAuditEvent(event);
}

module.exports = {
  listAuditEvents,
  getAuditEvent,
};
