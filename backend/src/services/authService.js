const bcrypt = require("bcrypt");
const pool = require("../config/database");
const { findUserByEmail, findUserById, findUserRoles, findUserPermissions, findRoleByName } = require("../repositories/userRepository");
const { createOrganization } = require("../repositories/organizationRepository");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateAccessToken } = require("../utils/jwt");

async function register({
  organizationName,
  firstName,
  lastName,
  email,
  password
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      const error = new Error("An account with this email already exists.");
      error.statusCode = 409;
      throw error;
    }

    const organization = await createOrganization(
      connection,
      organizationName
    );

    const passwordHash = await hashPassword(password);

    const [userResult] = await connection.execute(
    `INSERT INTO users
    (organization_id, first_name, last_name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
        organizationId,
        firstName,
        lastName,
        email,
        passwordHash,
        "OWNER"
    ]
    );

    const ownerRole = await findRoleByName("OWNER");

    if (!ownerRole) {
      const error = new Error("OWNER role is not configured.");
      error.statusCode = 500;
      throw error;
    }

    await connection.execute(
      `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
      `,
      [userResult.insertId, ownerRole.id]
    );

    await connection.commit();

    const user = await findUserById(userResult.insertId);
    const roles = await findUserRoles(userResult.insertId);
    const permissions = await findUserPermissions(userResult.insertId);

    const token = generateAccessToken({
      id: user.id,
      organization_id: user.organization_id,
      roles: roles.map((role) => role.name)
    });

    return {
      token,
      user,
      roles,
      permissions
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function login(email, password) {
  const user = await findUserByEmail(email);

  if (!user || !user.is_active) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await comparePassword(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const roles = await findUserRoles(user.id);
  const permissions = await findUserPermissions(user.id);

  const token = generateAccessToken({
    id: user.id,
    organization_id: user.organization_id,
    roles: roles.map((role) => role.name)
  });

  return {
    token,
    user: await findUserById(user.id),
    roles,
    permissions
  };
}

async function getCurrentUser(userId) {
  const user = await findUserById(userId);

  if (!user || !user.is_active) {
    const error = new Error("User account is inactive or unavailable.");
    error.statusCode = 401;
    throw error;
  }

  const roles = await findUserRoles(user.id);
  const permissions = await findUserPermissions(user.id);

  return {
    user,
    roles,
    permissions
  };
}

module.exports = {
  register,
  login,
  getCurrentUser
};