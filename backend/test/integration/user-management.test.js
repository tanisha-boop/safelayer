const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const pool = require("../../src/config/database");
const userRepository = require("../../src/repositories/userRepository");
const {
  generateAccessToken,
} = require("../../src/utils/jwt");
const { hashPassword } = require("../../src/utils/password");

const OWNER_ID = 1;
const FIELD_WORKER_ID = 4;
const CROSS_ORG_OWNER_ID = 3;
const ORGANIZATION_ID = 1;
const CROSS_ORG_ORGANIZATION_ID = 4;

let server;
let baseUrl;

let adminId;
let managerId;
let createdUserId;
let crossOrgUserId;

async function createRoleUser({
  organizationId,
  email,
  role,
  isActive = 1,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const passwordHash =
      await hashPassword("TestPassword123!");

    const [userResult] =
      await connection.execute(
        `
          INSERT INTO users (
            organization_id,
            first_name,
            last_name,
            email,
            password_hash,
            role,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          organizationId,
          "Security",
          "Test",
          email,
          passwordHash,
          role,
          isActive,
        ]
      );

    const [roleRows] =
      await connection.execute(
        `
          SELECT id
          FROM roles
          WHERE name = ?
          LIMIT 1
        `,
        [role]
      );

    assert.equal(
      roleRows.length,
      1,
      `Role ${role} must exist`
    );

    await connection.execute(
      `
        INSERT INTO user_roles (
          user_id,
          role_id
        )
        VALUES (?, ?)
      `,
      [
        userResult.insertId,
        roleRows[0].id,
      ]
    );

    await connection.commit();

    return userResult.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function tokenFor(userId, organizationId, roles) {
  return generateAccessToken({
    id: userId,
    organization_id: organizationId,
    roles,
    token_version: 1,
  });
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const authorization = headers.Authorization;

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length);

    headers.Cookie = `access_token=${token}`;

    delete headers.Authorization;
  }

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
}

async function getUserRow(userId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        email,
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

async function getUserRoleRows(userId) {
  const [rows] = await pool.execute(
    `
      SELECT
        r.name
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

async function cleanupUser(userId) {
  if (!userId) {
    return;
  }

  await pool.execute(
    `
      DELETE FROM users
      WHERE id = ?
    `,
    [userId]
  );
}

test.before(async () => {
  server = app.listen(0);

  const address = server.address();

  baseUrl = `http://127.0.0.1:${address.port}`;

  adminId = await createRoleUser({
    organizationId: ORGANIZATION_ID,
    email: `security-admin-${Date.now()}@safelayer.test`,
    role: "ADMIN",
  });

  managerId = await createRoleUser({
    organizationId: ORGANIZATION_ID,
    email: `security-manager-${Date.now()}@safelayer.test`,
    role: "MANAGER",
  });

  crossOrgUserId = await createRoleUser({
    organizationId: CROSS_ORG_ORGANIZATION_ID,
    email: `security-cross-org-${Date.now()}@northstar.test`,
    role: "FIELD_WORKER",
  });
});

test.after(async () => {
  await cleanupUser(createdUserId);
  await cleanupUser(adminId);
  await cleanupUser(managerId);
  await cleanupUser(crossOrgUserId);

  await new Promise((resolve) => {
    server.close(resolve);
  });

  await pool.end();
});

test("unauthenticated user cannot access user management", async () => {
  const response = await request("/api/users");

  assert.equal(response.status, 401);
});

test("FIELD_WORKER cannot create users", async () => {
  const token = tokenFor(
    FIELD_WORKER_ID,
    ORGANIZATION_ID,
    ["FIELD_WORKER"]
  );

  const response = await request(
    "/api/users",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: "Blocked",
        lastName: "Worker",
        email: `blocked-${Date.now()}@safelayer.test`,
        password: "TestPassword123!",
        role: "FIELD_WORKER",
      }),
    }
  );

  assert.equal(response.status, 403);
});

test("MANAGER cannot create users", async () => {
  const token = tokenFor(
    managerId,
    ORGANIZATION_ID,
    ["MANAGER"]
  );

  const response = await request(
    "/api/users",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: "Blocked",
        lastName: "Manager",
        email: `blocked-manager-${Date.now()}@safelayer.test`,
        password: "TestPassword123!",
        role: "FIELD_WORKER",
      }),
    }
  );

  assert.equal(response.status, 403);
});

test("ADMIN can create a normal user", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const email =
    `created-${Date.now()}@safelayer.test`;

  const response = await request(
    "/api/users",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: "Created",
        lastName: "User",
        email,
        password: "TestPassword123!",
        role: "FIELD_WORKER",
      }),
    }
  );

  assert.equal(response.status, 201);

  const body = await response.json();

  createdUserId = body.data.id;

  assert.equal(
    body.data.role,
    "FIELD_WORKER"
  );

  const roles =
    await getUserRoleRows(createdUserId);

  assert.deepEqual(
    roles.map((row) => row.name),
    ["FIELD_WORKER"]
  );
});

test("ADMIN cannot create an OWNER", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const response = await request(
    "/api/users",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: "Attempted",
        lastName: "Owner",
        email: `attempted-owner-${Date.now()}@safelayer.test`,
        password: "TestPassword123!",
        role: "OWNER",
      }),
    }
  );

  assert.equal(response.status, 400);
});

test("ADMIN cannot promote a user to OWNER", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const targetId =
    createdUserId ||
    await createRoleUser({
      organizationId: ORGANIZATION_ID,
      email: `promotion-target-${Date.now()}@safelayer.test`,
      role: "FIELD_WORKER",
    });

  if (!createdUserId) {
    createdUserId = targetId;
  }

  const response = await request(
    `/api/users/${targetId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "OWNER",
      }),
    }
  );

  assert.equal(response.status, 400);

  const user = await getUserRow(targetId);
  const roles = await getUserRoleRows(targetId);

  assert.equal(
    user.role,
    "FIELD_WORKER"
  );

  assert.deepEqual(
    roles.map((row) => row.name),
    ["FIELD_WORKER"]
  );
});

test("OWNER cannot be demoted", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const response = await request(
    `/api/users/${OWNER_ID}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "MANAGER",
      }),
    }
  );

  assert.equal(response.status, 403);

  const user = await getUserRow(OWNER_ID);
  const roles = await getUserRoleRows(OWNER_ID);

  assert.equal(user.role, "OWNER");

  assert.deepEqual(
    roles.map((row) => row.name),
    ["OWNER"]
  );
});

test("OWNER cannot be deactivated", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const response = await request(
    `/api/users/${OWNER_ID}/deactivate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  assert.equal(response.status, 403);

  const user = await getUserRow(OWNER_ID);

  assert.equal(user.is_active, 1);
});

test("user cannot deactivate their own account", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const response = await request(
    `/api/users/${adminId}/deactivate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  assert.equal(response.status, 400);

  const user = await getUserRow(adminId);

  assert.equal(user.is_active, 1);
});

test("cross-organization user cannot be updated", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const response = await request(
    `/api/users/${crossOrgUserId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "FINANCE",
      }),
    }
  );

  assert.equal(response.status, 404);

  const user =
    await getUserRow(crossOrgUserId);

  assert.equal(
    user.role,
    "FIELD_WORKER"
  );
});

test("normal role update synchronizes users.role and user_roles", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const targetId =
    createdUserId;

  const before =
    await getUserRow(targetId);

  const oldTokenVersion =
    before.token_version;

  const response = await request(
    `/api/users/${targetId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "FINANCE",
      }),
    }
  );

  assert.equal(response.status, 200);

  const user =
    await getUserRow(targetId);

  const roles =
    await getUserRoleRows(targetId);

  assert.equal(
    user.role,
    "FINANCE"
  );

  assert.equal(
    user.token_version,
    oldTokenVersion + 1
  );

  assert.deepEqual(
    roles.map((row) => row.name),
    ["FINANCE"]
  );
});

test("failed role replacement rolls back the entire user update", async () => {
  const targetId =
    await createRoleUser({
      organizationId: ORGANIZATION_ID,
      email: `rollback-${Date.now()}@safelayer.test`,
      role: "FIELD_WORKER",
    });

  const originalRepositoryMethod =
    userRepository.replaceUserRole;

  userRepository.replaceUserRole =
    async () => {
      throw new Error(
        "Injected role replacement failure"
      );
    };

  try {
    await assert.rejects(
      () =>
        require("../../src/services/userManagementService")
          .updateUser(
            targetId,
            ORGANIZATION_ID,
            {
              role: "FINANCE",
            }
          ),
      /Injected role replacement failure/
    );
  } finally {
    userRepository.replaceUserRole =
      originalRepositoryMethod;
  }

  const user =
    await getUserRow(targetId);

  const roles =
    await getUserRoleRows(targetId);

  assert.equal(
    user.role,
    "FIELD_WORKER"
  );

  assert.deepEqual(
    roles.map((row) => row.name),
    ["FIELD_WORKER"]
  );

  await cleanupUser(targetId);
});

test("failed role replacement rolls back user creation", async () => {
  const originalRepositoryMethod =
    userRepository.replaceUserRole;

  userRepository.replaceUserRole =
    async () => {
      throw new Error(
        "Injected role creation failure"
      );
    };

  const email =
    `rollback-create-${Date.now()}@safelayer.test`;

  try {
    await assert.rejects(
      () =>
        require("../../src/services/userManagementService")
          .createUser(
            ORGANIZATION_ID,
            {
              firstName: "Rollback",
              lastName: "Create",
              email,
              password: "TestPassword123!",
              role: "FIELD_WORKER",
            }
          ),
      /Injected role creation failure/
    );
  } finally {
    userRepository.replaceUserRole =
      originalRepositoryMethod;
  }

  const [rows] = await pool.execute(
    `
      SELECT id
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  assert.equal(rows.length, 0);
});

test("duplicate email is rejected", async () => {
  const token = tokenFor(
    adminId,
    ORGANIZATION_ID,
    ["ADMIN"]
  );

  const existing =
    await getUserRow(createdUserId);

  const response = await request(
    "/api/users",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: "Duplicate",
        lastName: "Email",
        email: existing.email,
        password: "TestPassword123!",
        role: "FIELD_WORKER",
      }),
    }
  );

  assert.equal(response.status, 409);
});
