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
        is_active
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
      SELECT id, name, description
      FROM roles
      WHERE name = ?
      LIMIT 1
    `,
    [roleName]
  );

  return rows[0] || null;
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserRoles,
  findUserPermissions,
  findRoleByName
};
