const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const pool = require("../../src/config/database");
const { generateAccessToken } = require("../../src/utils/jwt");

const OWNER_ID = 1;
const FIELD_WORKER_ID = 4;
const CROSS_ORG_OWNER_ID = 3;

const ORGANIZATION_ID = 1;
const CROSS_ORG_ORGANIZATION_ID = 4;

let server;
let baseUrl;

async function createAuthCookie(
  userId,
  organizationId,
  roles
) {
  const [rows] = await pool.execute(
    `
      SELECT token_version
      FROM users
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
    `,
    [userId, organizationId]
  );

  assert.equal(rows.length, 1);

  const token = generateAccessToken({
    id: userId,
    organization_id: organizationId,
    roles,
    token_version: rows[0].token_version,
  });

  return `access_token=${token}`;
}

async function createAuditFixture() {
  const [result] = await pool.execute(
    `
      INSERT INTO audit_events (
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ORGANIZATION_ID,
      OWNER_ID,
      "AUDIT_READ_TEST",
      "TEST_ENTITY",
      999999,
      JSON.stringify({
        status: "BEFORE",
        amount: 1000,
      }),
      JSON.stringify({
        status: "AFTER",
        amount: 1500,
      }),
      "127.0.0.1",
      "SafeLayer integration test",
    ]
  );

  return result.insertId;
}

async function assertAuditRowUnchanged(auditId, expected) {
  const row = await getAuditRow(auditId);

  assert.ok(row);
  assert.equal(row.id, expected.id);
  assert.equal(row.organization_id, expected.organization_id);
  assert.equal(row.actor_id, expected.actor_id);
  assert.equal(row.action, expected.action);
  assert.equal(row.entity_type, expected.entity_type);
  assert.equal(Number(row.entity_id), Number(expected.entity_id));
}

async function getAuditRow(auditId) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id
      FROM audit_events
      WHERE id = ?
      LIMIT 1
    `,
    [auditId]
  );

  return rows[0] || null;
}

async function createAuditFixtureSet() {
  const auditIds = [];

  const fixtures = [
    {
      action: "AUDIT_FILTER_ACTION_A",
      entityType: "FILTER_ENTITY_A",
      entityId: 111111,
      actorId: OWNER_ID,
    },
    {
      action: "AUDIT_FILTER_ACTION_A",
      entityType: "FILTER_ENTITY_B",
      entityId: 222222,
      actorId: OWNER_ID,
    },
    {
      action: "AUDIT_FILTER_ACTION_B",
      entityType: "FILTER_ENTITY_A",
      entityId: 111111,
      actorId: OWNER_ID,
    },
    {
      action: "AUDIT_FILTER_ACTION_C",
      entityType: "FILTER_ENTITY_C",
      entityId: 333333,
      actorId: FIELD_WORKER_ID,
    },
  ];

  for (const fixture of fixtures) {
    const [result] = await pool.execute(
      `
        INSERT INTO audit_events (
          organization_id,
          actor_id,
          action,
          entity_type,
          entity_id,
          old_values,
          new_values,
          ip_address,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        ORGANIZATION_ID,
        fixture.actorId,
        fixture.action,
        fixture.entityType,
        fixture.entityId,
        JSON.stringify({
          test: "before",
        }),
        JSON.stringify({
          test: "after",
        }),
        "127.0.0.1",
        "SafeLayer filter integration test",
      ]
    );

    auditIds.push(result.insertId);
  }

  return auditIds;
}

async function cleanupAuditFixtureSet() {
  await pool.execute(
    `
      DELETE FROM audit_events
      WHERE organization_id = ?
        AND action LIKE 'AUDIT_FILTER_ACTION_%'
    `,
    [ORGANIZATION_ID]
  );
}

async function cleanupAuditFixture(auditId) {
  if (!auditId) {
    return;
  }

  await pool.execute(
    `
      DELETE FROM audit_events
      WHERE id = ?
        AND organization_id = ?
        AND action = 'AUDIT_READ_TEST'
    `,
    [auditId, ORGANIZATION_ID]
  );
}

test.before(async () => {
  server = app.listen(0);

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const address = server.address();

  baseUrl = `http://127.0.0.1:${address.port}`;
});


test(
  "audit events are read-only through the API",
  async () => {
    const auditId = await createAuditFixture();

    try {
      const expected = await getAuditRow(auditId);

      assert.ok(expected);

      const mutationRequests = [
        {
          method: "POST",
          body: {
            action: "AUDIT_MUTATION_TEST",
            entityType: "TEST_ENTITY",
            entityId: 999999,
          },
        },
        {
          method: "PATCH",
          body: {
            action: "AUDIT_MUTATION_TEST",
          },
        },
        {
          method: "DELETE",
        },
      ];

      for (const request of mutationRequests) {
        const response = await fetch(
          `${baseUrl}/api/audit-events${
            request.method === "POST"
              ? ""
              : `/${auditId}`
          }`,
          {
            method: request.method,
            headers: {
              Cookie: await createAuthCookie(
                OWNER_ID,
                ORGANIZATION_ID,
                ["OWNER"]
              ),
              ...(request.body
                ? {
                    "Content-Type": "application/json",
                  }
                : {}),
            },
            ...(request.body
              ? {
                  body: JSON.stringify(request.body),
                }
              : {}),
          }
        );

        assert.equal(
          response.status,
          404,
          `${request.method} audit mutation should not be exposed`
        );
      }

      await assertAuditRowUnchanged(
        auditId,
        expected
      );
    } finally {
      await pool.execute(
        `
          DELETE FROM audit_events
          WHERE id = ?
            AND organization_id = ?
        `,
        [auditId, ORGANIZATION_ID]
      );
    }
  }
);

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  await pool.end();
});

test(
  "unauthenticated user cannot list audit events",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/audit-events`
    );

    assert.equal(response.status, 401);

    const body = await response.json();

    assert.equal(body.success, false);
    assert.equal(
      body.message,
      "Authentication required"
    );
  }
);

test(
  "authenticated user without audit:read cannot list audit events",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/audit-events`,
      {
        headers: {
          Cookie: await createAuthCookie(
            FIELD_WORKER_ID,
            ORGANIZATION_ID,
            ["FIELD_WORKER"]
          ),
        },
      }
    );

    assert.equal(response.status, 403);

    const body = await response.json();

    assert.equal(body.success, false);
    assert.equal(
      body.message,
      "You do not have permission to perform this action"
    );
  }
);

test(
  "authorized owner can list and retrieve an audit event from their organization",
  async () => {
    let auditId;

    try {
      auditId = await createAuditFixture();

      const listResponse = await fetch(
        `${baseUrl}/api/audit-events?action=AUDIT_READ_TEST`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(listResponse.status, 200);

      const listBody = await listResponse.json();

      assert.equal(listBody.success, true);
      assert.ok(Array.isArray(listBody.data));
      assert.equal(typeof listBody.pagination.total, "number");

      const listedEvent = listBody.data.find(
        (event) => event.id === auditId
      );

      assert.ok(listedEvent);

      assert.equal(
        listedEvent.organizationId,
        ORGANIZATION_ID
      );

      assert.equal(
        listedEvent.actorId,
        OWNER_ID
      );

      assert.equal(
        listedEvent.action,
        "AUDIT_READ_TEST"
      );

      assert.equal(
        listedEvent.entityType,
        "TEST_ENTITY"
      );

      assert.equal(
        listedEvent.entityId,
        999999
      );

      assert.deepEqual(
        listedEvent.oldValues,
        {
          status: "BEFORE",
          amount: 1000,
        }
      );

      assert.deepEqual(
        listedEvent.newValues,
        {
          status: "AFTER",
          amount: 1500,
        }
      );

      assert.equal(
        listedEvent.ipAddress,
        "127.0.0.1"
      );

      assert.equal(
        listedEvent.userAgent,
        "SafeLayer integration test"
      );

      const getResponse = await fetch(
        `${baseUrl}/api/audit-events/${auditId}`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(getResponse.status, 200);

      const getBody = await getResponse.json();

      assert.equal(getBody.success, true);
      assert.equal(
        getBody.data.id,
        auditId
      );

      assert.equal(
        getBody.data.organizationId,
        ORGANIZATION_ID
      );

      assert.equal(
        getBody.data.action,
        "AUDIT_READ_TEST"
      );

      assert.deepEqual(
        getBody.data.oldValues,
        {
          status: "BEFORE",
          amount: 1000,
        }
      );

      assert.deepEqual(
        getBody.data.newValues,
        {
          status: "AFTER",
          amount: 1500,
        }
      );
    } finally {
      await cleanupAuditFixture(auditId);
    }
  }
);

test(
  "owner from another organization cannot retrieve the audit event",
  async () => {
    let auditId;

    try {
      auditId = await createAuditFixture();

      const response = await fetch(
        `${baseUrl}/api/audit-events/${auditId}`,
        {
          headers: {
            Cookie: await createAuthCookie(
              CROSS_ORG_OWNER_ID,
              CROSS_ORG_ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 404);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "Audit event not found"
      );
    } finally {
      await cleanupAuditFixture(auditId);
    }
  }
);

test(
  "owner from another organization cannot list another organization's audit events",
  async () => {
    let auditId;

    try {
      auditId = await createAuditFixture();

      const response = await fetch(
        `${baseUrl}/api/audit-events?action=AUDIT_READ_TEST`,
        {
          headers: {
            Cookie: await createAuthCookie(
              CROSS_ORG_OWNER_ID,
              CROSS_ORG_ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));

      const leakedEvent = body.data.find(
        (event) => event.id === auditId
      );

      assert.equal(
        leakedEvent,
        undefined
      );

      for (const event of body.data) {
        assert.equal(
          event.organizationId,
          CROSS_ORG_ORGANIZATION_ID
        );
      }
    } finally {
      await cleanupAuditFixture(auditId);
    }
  }
);

test(
  "audit fixture cleanup leaves no test event behind",
  async () => {
    const [rows] = await pool.execute(
      `
        SELECT COUNT(*) AS count
        FROM audit_events
        WHERE organization_id = ?
          AND action = 'AUDIT_READ_TEST'
      `,
      [ORGANIZATION_ID]
    );

    assert.equal(
      Number(rows[0].count),
      0
    );
  }
);

test(
  "audit list filters by action",
  async () => {
    let auditIds = [];

    try {
      auditIds = await createAuditFixtureSet();

      const response = await fetch(
        `${baseUrl}/api/audit-events?action=AUDIT_FILTER_ACTION_A`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.equal(body.pagination.total, 2);

      for (const event of body.data) {
        assert.equal(
          event.action,
          "AUDIT_FILTER_ACTION_A"
        );
      }

      const returnedIds = body.data.map(
        (event) => event.id
      );

      assert.deepEqual(
        returnedIds.sort((a, b) => a - b),
        [auditIds[0], auditIds[1]].sort(
          (a, b) => a - b
        )
      );
    } finally {
      await cleanupAuditFixtureSet();
    }
  }
);

test(
  "audit list filters by entity type",
  async () => {
    let auditIds = [];

    try {
      auditIds = await createAuditFixtureSet();

      const response = await fetch(
        `${baseUrl}/api/audit-events?entityType=FILTER_ENTITY_A`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.equal(body.pagination.total, 2);

      for (const event of body.data) {
        assert.equal(
          event.entityType,
          "FILTER_ENTITY_A"
        );
      }

      const returnedIds = body.data.map(
        (event) => event.id
      );

      assert.deepEqual(
        returnedIds.sort((a, b) => a - b),
        [auditIds[0], auditIds[2]].sort(
          (a, b) => a - b
        )
      );
    } finally {
      await cleanupAuditFixtureSet();
    }
  }
);

test(
  "audit list filters by entity ID",
  async () => {
    let auditIds = [];

    try {
      auditIds = await createAuditFixtureSet();

      const response = await fetch(
        `${baseUrl}/api/audit-events?entityId=111111`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.equal(body.pagination.total, 2);

      for (const event of body.data) {
        assert.equal(event.entityId, 111111);
      }

      const returnedIds = body.data.map(
        (event) => event.id
      );

      assert.deepEqual(
        returnedIds.sort((a, b) => a - b),
        [auditIds[0], auditIds[2]].sort(
          (a, b) => a - b
        )
      );
    } finally {
      await cleanupAuditFixtureSet();
    }
  }
);

test(
  "audit list combines multiple filters",
  async () => {
    let auditIds = [];

    try {
      auditIds = await createAuditFixtureSet();

      const response = await fetch(
        `${baseUrl}/api/audit-events?action=AUDIT_FILTER_ACTION_A&entityType=FILTER_ENTITY_B`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.equal(body.pagination.total, 1);
      assert.equal(body.data.length, 1);

      assert.equal(
        body.data[0].id,
        auditIds[1]
      );

      assert.equal(
        body.data[0].action,
        "AUDIT_FILTER_ACTION_A"
      );

      assert.equal(
        body.data[0].entityType,
        "FILTER_ENTITY_B"
      );
    } finally {
      await cleanupAuditFixtureSet();
    }
  }
);

test(
  "audit list supports pagination",
  async () => {
    let auditIds = [];

    try {
      auditIds = await createAuditFixtureSet();

      const response = await fetch(
        `${baseUrl}/api/audit-events?action=AUDIT_FILTER_ACTION_A&limit=1&page=1`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.equal(body.pagination.page, 1);
      assert.equal(body.pagination.limit, 1);
      assert.equal(body.pagination.total, 2);
      assert.equal(body.pagination.totalPages, 2);
      assert.equal(body.data.length, 1);

      assert.equal(
        body.data[0].id,
        auditIds[1]
      );

      const secondResponse = await fetch(
        `${baseUrl}/api/audit-events?action=AUDIT_FILTER_ACTION_A&limit=1&page=2`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(secondResponse.status, 200);

      const secondBody =
        await secondResponse.json();

      assert.equal(
        secondBody.pagination.page,
        2
      );

      assert.equal(
        secondBody.pagination.total,
        2
      );

      assert.equal(
        secondBody.pagination.totalPages,
        2
      );

      assert.equal(
        secondBody.data.length,
        1
      );

      assert.equal(
        secondBody.data[0].id,
        auditIds[0]
      );

      assert.notEqual(
        body.data[0].id,
        secondBody.data[0].id
      );
    } finally {
      await cleanupAuditFixtureSet();
    }
  }
);

test(
  "audit list rejects an invalid page",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/audit-events?page=0`,
      {
        headers: {
          Cookie: await createAuthCookie(
            OWNER_ID,
            ORGANIZATION_ID,
            ["OWNER"]
          ),
        },
      }
    );

    assert.equal(response.status, 400);

    const body = await response.json();

    assert.equal(body.success, false);
  }
);

test(
  "audit list rejects a limit greater than 100",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/audit-events?limit=101`,
      {
        headers: {
          Cookie: await createAuthCookie(
            OWNER_ID,
            ORGANIZATION_ID,
            ["OWNER"]
          ),
        },
      }
    );

    assert.equal(response.status, 400);

    const body = await response.json();

    assert.equal(body.success, false);
  }
);

test(
  "audit filter fixture cleanup leaves no test events behind",
  async () => {
    const [rows] = await pool.execute(
      `
        SELECT COUNT(*) AS count
        FROM audit_events
        WHERE organization_id = ?
          AND action LIKE 'AUDIT_FILTER_ACTION_%'
      `,
      [ORGANIZATION_ID]
    );

    assert.equal(
      Number(rows[0].count),
      0
    );
  }
);

test(
  "audit list filters by actor ID",
  async () => {
    let auditIds = [];

    try {
      auditIds = await createAuditFixtureSet();

      const response = await fetch(
        `${baseUrl}/api/audit-events?actorId=${FIELD_WORKER_ID}`,
        {
          headers: {
            Cookie: await createAuthCookie(
              OWNER_ID,
              ORGANIZATION_ID,
              ["OWNER"]
            ),
          },
        }
      );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.equal(body.pagination.total, 1);
      assert.equal(body.data.length, 1);

      assert.equal(
        body.data[0].id,
        auditIds[3]
      );

      assert.equal(
        body.data[0].actorId,
        FIELD_WORKER_ID
      );

      assert.equal(
        body.data[0].action,
        "AUDIT_FILTER_ACTION_C"
      );
    } finally {
      await cleanupAuditFixtureSet();
    }
  }
);
