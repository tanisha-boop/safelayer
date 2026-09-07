const userRepository = require("../repositories/userRepository");
const { hashPassword } = require("../utils/password");

const VALID_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "FIELD_WORKER",
  "FINANCE",
  "AUDITOR",
];

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
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return user;
}

async function createUser(organizationId, data) {
  if (!VALID_ROLES.includes(data.role)) {
    const error = new Error("Invalid role");
    error.statusCode = 400;
    throw error;
  }

  const existingUser =
    await userRepository.findUserByEmail(data.email);

  if (existingUser) {
    const error = new Error("Email already exists");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash =
    await hashPassword(data.password);

  const user = await userRepository.createUser({
    organizationId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    passwordHash,
    role: data.role,
  });

  const role =
    await userRepository.findRoleByName(data.role);

  if (!role) {
    const error = new Error("Role not found");
    error.statusCode = 500;
    throw error;
  }

  await userRepository.assignRole(
    user.id,
    role.id
  );

  return userRepository.findUserByIdAndOrganization(
    user.id,
    organizationId
  );
}

async function updateUser(
  userId,
  organizationId,
  data
) {
  const user = await getUser(
    userId,
    organizationId
  );

  if (
    user.role === "OWNER" &&
    data.role &&
    data.role !== "OWNER"
  ) {
    const error = new Error(
      "The organization owner role cannot be changed"
    );
    error.statusCode = 403;
    throw error;
  }

  const updatedUser =
    await userRepository.updateUser(
      userId,
      organizationId,
      data
    );

  if (data.role) {
    const role =
      await userRepository.findRoleByName(
        data.role
      );

    if (!role) {
      const error = new Error("Role not found");
      error.statusCode = 500;
      throw error;
    }

    await userRepository.assignRole(
      userId,
      role.id
    );
  }

  return updatedUser;
}

async function deactivateUser(
  userId,
  organizationId,
  requestingUserId
) {
  const user = await getUser(
    userId,
    organizationId
  );

  if (user.id === requestingUserId) {
    const error = new Error(
      "You cannot deactivate your own account"
    );
    error.statusCode = 400;
    throw error;
  }

  if (user.role === "OWNER") {
    const error = new Error(
      "The organization owner cannot be deactivated"
    );
    error.statusCode = 403;
    throw error;
  }

  await userRepository.deactivateUser(
    userId,
    organizationId
  );

  return userRepository.findUserByIdAndOrganization(
    userId,
    organizationId
  );
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
};
