const pool = require("../config/database");

const userRepository = require("../repositories/userRepository");
const organizationRepository = require("../repositories/organizationRepository");

const {
  hashPassword,
  comparePassword,
} = require("../utils/password");

const {
  generateAccessToken,
} = require("../utils/jwt");

function createSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function register({
  organizationName,
  firstName,
  lastName,
  email,
  password,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check whether the email is already registered.
    const existingUser = await userRepository.findUserByEmail(email);

    if (existingUser) {
      const error = new Error("Email already exists");
      error.statusCode = 409;
      throw error;
    }

    // Generate a URL-safe organization slug.
    const baseSlug = createSlug(organizationName);

    let slug = baseSlug;
    let counter = 2;

    while (
      await organizationRepository.findOrganizationBySlug(slug)
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create the organization inside the same transaction.
    const organization =
      await organizationRepository.createOrganization(
        connection,
        {
          name: organizationName,
          slug,
        }
      );

    const passwordHash = await hashPassword(password);

    // Create the organization's first user.
    const [userResult] = await connection.execute(
      `
        INSERT INTO users
          (
            organization_id,
            first_name,
            last_name,
            email,
            password_hash,
            role
          )
        VALUES
          (?, ?, ?, ?, ?, ?)
      `,
      [
        organization.id,
        firstName,
        lastName,
        email,
        passwordHash,
        "OWNER",
      ]
    );

    // Find the OWNER RBAC role.
    const ownerRole =
      await userRepository.findRoleByName("OWNER");

    if (!ownerRole) {
      const error = new Error(
        "OWNER role is not configured."
      );

      error.statusCode = 500;
      throw error;
    }

    // Connect the new user to the OWNER role.
    await connection.execute(
      `
        INSERT INTO user_roles
          (user_id, role_id)
        VALUES
          (?, ?)
      `,
      [userResult.insertId, ownerRole.id]
    );

    await connection.commit();

    // Load the complete user after the transaction succeeds.
    const user =
      await userRepository.findUserById(
        userResult.insertId
      );

    const roles =
      await userRepository.findUserRoles(
        userResult.insertId
      );

    const permissions =
      await userRepository.findUserPermissions(
        userResult.insertId
      );

    const token = generateAccessToken({
      id: user.id,
      organization_id: user.organization_id,
      roles: roles.map((role) => role.name),
    });

    return {
      token,
      user,
      roles,
      permissions,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function login(email, password) {
  const user =
    await userRepository.findUserByEmail(email);

  if (!user) {
    const error = new Error(
      "Invalid email or password."
    );

    error.statusCode = 401;
    throw error;
  }

  const passwordMatches =
    await comparePassword(
      password,
      user.password_hash
    );

  if (!passwordMatches) {
    const error = new Error(
      "Invalid email or password."
    );

    error.statusCode = 401;
    throw error;
  }

  if (!user.is_active) {
    const error = new Error(
      "Account is inactive."
    );

    error.statusCode = 403;
    throw error;
  }

  const roles =
    await userRepository.findUserRoles(user.id);

  const permissions =
    await userRepository.findUserPermissions(user.id);

  const token = generateAccessToken({
    id: user.id,
    organization_id: user.organization_id,
    roles: roles.map((role) => role.name),
  });

  return {
    token,
    user: await userRepository.findUserById(
      user.id
    ),
    roles,
    permissions,
  };
}

async function getCurrentUser(userId) {
  const user =
    await userRepository.findUserById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (!user.is_active) {
    const error = new Error(
      "Account is inactive"
    );

    error.statusCode = 403;
    throw error;
  }

  const roles =
    await userRepository.findUserRoles(user.id);

  const permissions =
    await userRepository.findUserPermissions(user.id);

  return {
    id: user.id,
    organizationId: user.organization_id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
    roles,
    permissions,
  };
}

module.exports = {
  register,
  login,
  getCurrentUser,
};
