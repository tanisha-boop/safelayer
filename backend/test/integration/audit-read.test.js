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

function createAuthCookie(
  userId,
  organizationId,
  roles
) {
  const token = generateAccessToken({
    id: userId,
    organization_id: organizationId,
    roles,
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
          Cookie: createAuthCookie(
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
            Cookie: createAuthCookie(
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
            Cookie: createAuthCookie(
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
            Cookie: createAuthCookie(
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
            Cookie: createAuthCookie(
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
