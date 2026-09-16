const pool = require("../config/database");

async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        first_name,
        last_name,
        email,
        password_hash,
        role,
        is_active,
        token_version
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}

async function findUserById(userId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        first_name,
        last_name,
        email,
        role,
        is_active,
        token_version,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function findUserAuthState(userId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        role,
        is_active,
        token_version
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function findUsersByOrganization(organizationId) {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id,
        u.organization_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(
          DISTINCT r.name
          ORDER BY r.name
          SEPARATOR ','
        ) AS rbac_roles
      FROM users u
      LEFT JOIN user_roles ur
        ON ur.user_id = u.id
      LEFT JOIN roles r
        ON r.id = ur.role_id
      WHERE u.organization_id = ?
      GROUP BY
        u.id,
        u.organization_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at
      ORDER BY u.created_at DESC
    `,
    [organizationId]
  );

  return rows;
}

async function findUserByIdAndOrganization(userId, organizationId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        first_name,
        last_name,
        email,
        role,
        is_active,
        token_version,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
    `,
    [userId, organizationId]
  );

  return rows[0] || null;
}

async function createUser({
  organizationId,
  firstName,
  lastName,
  email,
  passwordHash,
  role,
}) {
  const [result] = await pool.execute(
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
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      organizationId,
      firstName,
      lastName,
      email,
      passwordHash,
      role,
    ]
  );

  return findUserByIdAndOrganization(
    result.insertId,
    organizationId
  );
}

async function updateUser(
  userId,
  organizationId,
  { firstName, lastName, role }
) {
  const fields = [];
  const values = [];

  if (firstName !== undefined) {
    fields.push("first_name = ?");
    values.push(firstName);
  }

  if (lastName !== undefined) {
    fields.push("last_name = ?");
    values.push(lastName);
  }

  if (role !== undefined) {
    fields.push("role = ?");
    values.push(role);
    fields.push("token_version = token_version + 1");
  }

  if (fields.length === 0) {
    return findUserByIdAndOrganization(
      userId,
      organizationId
    );
  }

  values.push(userId, organizationId);

  await pool.execute(
    `
      UPDATE users
      SET ${fields.join(", ")}
      WHERE id = ?
        AND organization_id = ?
    `,
    values
  );

  return findUserByIdAndOrganization(
    userId,
    organizationId
  );
}

async function deactivateUser(userId, organizationId) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET
        is_active = 0,
        token_version = token_version + 1
      WHERE id = ?
        AND organization_id = ?
    `,
    [userId, organizationId]
  );

  return result.affectedRows > 0;
}

async function findUserRoles(userId) {
  const [rows] = await pool.execute(
    `
      SELECT
        r.id,
        r.name,
        r.description
      FROM user_roles ur
      INNER JOIN roles r
        ON r.id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.name
    `,
    [userId]
  );

  return rows;
}

async function findUserPermissions(userId) {
  const [rows] = await pool.execute(
    `
      SELECT DISTINCT
        p.id,
        p.name,
        p.description
      FROM user_roles ur
      INNER JOIN role_permissions rp
        ON rp.role_id = ur.role_id
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE ur.user_id = ?
      ORDER BY p.name
    `,
    [userId]
  );

  return rows;
}

async function findRoleByName(roleName) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        name,
        description
      FROM roles
      WHERE name = ?
      LIMIT 1
    `,
    [roleName]
  );

  return rows[0] || null;
}

async function assignRole(userId, roleId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        DELETE FROM user_roles
        WHERE user_id = ?
      `,
      [userId]
    );

    await connection.execute(
      `
        INSERT INTO user_roles
          (user_id, role_id)
        VALUES (?, ?)
      `,
      [userId, roleId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function replaceUserRole(userId, roleId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        DELETE FROM user_roles
        WHERE user_id = ?
      `,
      [userId]
    );

    await connection.execute(
      `
        INSERT INTO user_roles
          (user_id, role_id)
        VALUES (?, ?)
      `,
      [userId, roleId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserAuthState,
  findUsersByOrganization,
  findUserByIdAndOrganization,
  createUser,
  updateUser,
  deactivateUser,
  findUserRoles,
  findUserPermissions,
  findRoleByName,
  assignRole,
  replaceUserRole,
};
