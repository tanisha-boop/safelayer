const userRepository = require("../repositories/userRepository");

const MANAGEMENT_ROLES = ["OWNER", "ADMIN", "MANAGER"];
const FINANCE_ROLES = ["OWNER", "ADMIN", "FINANCE"];
const AUDIT_ROLES = ["OWNER", "ADMIN", "AUDITOR"];

async function getUsersByRoles(organizationId, roles) {
  const users = await userRepository.findUsersByOrganization(
    organizationId
  );

  const normalizedRoles = new Set(
    roles.map((role) => String(role).toUpperCase())
  );

  return users
    .filter((user) => {
      if (!user.is_active) {
        return false;
      }

      const rbacRoles = String(user.rbac_roles || "")
        .split(",")
        .map((role) => role.trim().toUpperCase())
        .filter(Boolean);

      const legacyRole = String(user.role || "").toUpperCase();

      return (
        rbacRoles.some((role) => normalizedRoles.has(role)) ||
        normalizedRoles.has(legacyRole)
      );
    })
    .map((user) => user.id);
}

async function getManagers(organizationId) {
  return getUsersByRoles(
    organizationId,
    MANAGEMENT_ROLES
  );
}

async function getFinanceUsers(organizationId) {
  return getUsersByRoles(
    organizationId,
    FINANCE_ROLES
  );
}

async function getAuditors(organizationId) {
  return getUsersByRoles(
    organizationId,
    AUDIT_ROLES
  );
}

async function getUserIfActiveInOrganization(
  userId,
  organizationId
) {
  if (!userId) {
    return null;
  }

  const user =
    await userRepository.findUserByIdAndOrganization(
      userId,
      organizationId
    );

  if (!user || !user.is_active) {
    return null;
  }

  return user.id;
}

async function uniqueUserIds(userIds) {
  return [...new Set(
    userIds
      .filter((id) => id !== null && id !== undefined)
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

module.exports = {
  getManagers,
  getFinanceUsers,
  getAuditors,
  getUserIfActiveInOrganization,
  uniqueUserIds,
};
