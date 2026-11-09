const pool = require("../config/database");
const userRepository = require("../repositories/userRepository");
const { hashPassword } = require("../utils/password");

const MANAGED_ROLES = [
  "ADMIN",
  "MANAGER",
  "FIELD_WORKER",
  "FINANCE",
  "AUDITOR",
];

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertManagedRole(role) {
  if (!MANAGED_ROLES.includes(role)) {
    throw createHttpError(
      "OWNER is not assignable through user management.",
      403
    );
  }
}

async function listUsers(organizationId) {
  return userRepository.findUsersByOrganization(
    organizationId
  );
}

async function getUser(userId, organizationId) {
  const user =
    await userRepository.findUserByIdAndOrganization(
      userId,
      organizationId
    );

  if (!user) {
    throw createHttpError("User not found", 404);
  }

  return user;
}

async function createUser(organizationId, data) {
  assertManagedRole(data.role);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existingUser =
      await userRepository.findUserByEmail(
        data.email,
        connection
      );

    if (existingUser) {
      throw createHttpError(
        "Email already exists",
        409
      );
    }

    const passwordHash =
      await hashPassword(data.password);

    const user =
      await userRepository.createUser(
        connection,
        {
          organizationId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          passwordHash,
          role: data.role,
        }
      );

    const role =
      await userRepository.findRoleByName(
        data.role,
        connection
      );

    if (!role) {
      throw createHttpError(
        "Role not found",
        500
      );
    }

    await userRepository.replaceUserRole(
      connection,
      user.id,
      role.id
    );

    const createdUser =
      await userRepository.findUserByIdAndOrganization(
        user.id,
        organizationId,
        connection
      );

    await connection.commit();

    return createdUser;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateUser(
  userId,
  organizationId,
  data
) {
  if (
    data.role !== undefined &&
    data.role === "OWNER"
  ) {
    throw createHttpError(
      "OWNER cannot be assigned through user management.",
      403
    );
  }

  if (data.role !== undefined) {
    assertManagedRole(data.role);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const user =
      await userRepository.findUserByIdAndOrganizationForUpdate(
        userId,
        organizationId,
        connection
      );

    if (!user) {
      throw createHttpError(
        "User not found",
        404
      );
    }

    if (
      user.role === "OWNER" &&
      data.role !== undefined &&
      data.role !== "OWNER"
    ) {
      throw createHttpError(
        "The organization owner role cannot be changed.",
        403
      );
    }

    let role = null;

    if (data.role !== undefined) {
      role =
        await userRepository.findRoleByName(
          data.role,
          connection
        );

      if (!role) {
        throw createHttpError(
          "Role not found",
          500
        );
      }
    }

    await userRepository.updateUser(
      connection,
      userId,
      organizationId,
      data
    );

    if (role) {
      await userRepository.replaceUserRole(
        connection,
        userId,
        role.id
      );
    }

    const updatedUser =
      await userRepository.findUserByIdAndOrganization(
        userId,
        organizationId,
        connection
      );

    await connection.commit();

    return updatedUser;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deactivateUser(
  userId,
  organizationId,
  requestingUserId
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const user =
      await userRepository.findUserByIdAndOrganizationForUpdate(
        userId,
        organizationId,
        connection
      );

    if (!user) {
      throw createHttpError(
        "User not found",
        404
      );
    }

    if (user.id === requestingUserId) {
      throw createHttpError(
        "You cannot deactivate your own account",
        400
      );
    }

    if (user.role === "OWNER") {
      throw createHttpError(
        "The organization owner cannot be deactivated.",
        403
      );
    }

    await userRepository.deactivateUser(
      connection,
      userId,
      organizationId
    );

    const deactivatedUser =
      await userRepository.findUserByIdAndOrganization(
        userId,
        organizationId,
        connection
      );

    await connection.commit();

    return deactivatedUser;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
};
