function createSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

async function createOrganization(connection, name) {
  const baseSlug = createSlug(name);

  let slug = baseSlug || `organization-${Date.now()}`;

  let counter = 1;

  while (true) {
    const [existing] = await connection.execute(
      `
        SELECT id
        FROM organizations
        WHERE slug = ?
        LIMIT 1
      `,
      [slug]
    );

    if (existing.length === 0) {
      break;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const [result] = await connection.execute(
    `
      INSERT INTO organizations (name, slug)
      VALUES (?, ?)
    `,
    [name, slug]
  );

  return {
    id: result.insertId,
    name,
    slug
  };
}

module.exports = {
  createOrganization
};
