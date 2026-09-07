const pool = require("../config/database");

async function createOrganization(connection, { name, slug }) {
  const [result] = await connection.execute(
    `INSERT INTO organizations (name, slug)
     VALUES (?, ?)`,
    [name, slug]
  );

  return {
    id: result.insertId,
    name,
    slug,
  };
}

async function findById(organizationId) {
  const [rows] = await pool.execute(
    `SELECT
        id,
        name,
        slug,
        created_at,
        updated_at
     FROM organizations
     WHERE id = ?
     LIMIT 1`,
    [organizationId]
  );

  return rows[0] || null;
}

async function findBySlug(slug) {
  const [rows] = await pool.execute(
    `SELECT
        id,
        name,
        slug,
        created_at,
        updated_at
     FROM organizations
     WHERE slug = ?
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

async function updateOrganization(organizationId, { name }) {
  await pool.execute(
    `UPDATE organizations
     SET name = ?
     WHERE id = ?`,
    [name, organizationId]
  );

  return findById(organizationId);
}

module.exports = {
  createOrganization,
  findById,
  findBySlug,
  updateOrganization,
};
