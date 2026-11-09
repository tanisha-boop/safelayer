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

async function createNotification({
  userId,
  organizationId,
  type,
  title,
  message,
  entityType = "TEST_NOTIFICATION",
  entityId = null,
  isRead = 0,
}) {
  const [result] = await pool.execute(
    `
      INSERT INTO notifications (
        user_id,
        organization_id,
        type,
        title,
        message,
        entity_type,
        entity_id,
        is_read,
        read_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      organizationId,
      type,
      title,
      message,
      entityType,
      entityId,
      isRead,
      isRead ? new Date() : null,
    ]
  );

  return result.insertId;
}

async function getNotification(id) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        user_id,
        organization_id,
        type,
        title,
        message,
        entity_type,
        entity_id,
        is_read,
        read_at
      FROM notifications
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function deleteNotifications(ids) {
  const uniqueIds = [
    ...new Set(
      ids
        .map(Number)
        .filter(
          (id) => Number.isInteger(id) && id > 0
        )
    ),
  ];

  if (!uniqueIds.length) {
    return;
  }

  const placeholders = uniqueIds.map(() => "?").join(",");

  await pool.execute(
    `
      DELETE FROM notifications
      WHERE id IN (${placeholders})
    `,
    uniqueIds
  );
}

async function startServer() {
  server = await new Promise((resolve) => {
    const instance = app.listen(
      0,
      "127.0.0.1",
      () => resolve(instance)
    );
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function stopServer() {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = null;
}

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

test.before(async () => {
  await startServer();
});

test.after(async () => {
  await stopServer();
  await pool.end();
});

test("unauthenticated notification API requests are rejected", async () => {
  const listResponse =
    await request("/api/notifications");

  assert.equal(listResponse.status, 401);

  const unreadResponse =
    await request("/api/notifications/unread-count");

  assert.equal(unreadResponse.status, 401);

  const markReadResponse =
    await request("/api/notifications/1/read", {
      method: "PATCH",
    });

  assert.equal(markReadResponse.status, 401);

  const markAllResponse =
    await request("/api/notifications/read-all", {
      method: "PATCH",
    });

  assert.equal(markAllResponse.status, 401);
});

test("notification list is isolated by authenticated user and organization", async () => {
  const testIds = [];

  try {
    const ownerNotification =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_OWNER_ONLY",
        title: "Owner-only test notification",
        message: "Visible only to owner 1.",
      });

    const fieldWorkerNotification =
      await createNotification({
        userId: FIELD_WORKER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_FIELD_ONLY",
        title: "Field-worker test notification",
        message: "Visible only to field worker 4.",
      });

    const crossOrgNotification =
      await createNotification({
        userId: CROSS_ORG_OWNER_ID,
        organizationId: CROSS_ORG_ORGANIZATION_ID,
        type: "TEST_CROSS_ORG",
        title: "Cross-org test notification",
        message: "Visible only to organization 4 owner.",
      });

    testIds.push(
      ownerNotification,
      fieldWorkerNotification,
      crossOrgNotification
    );

    const ownerCookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      ["OWNER"]
    );

    const fieldWorkerCookie =
      await createAuthCookie(
        FIELD_WORKER_ID,
        ORGANIZATION_ID,
        ["FIELD_WORKER"]
      );

    const crossOrgCookie =
      await createAuthCookie(
        CROSS_ORG_OWNER_ID,
        CROSS_ORG_ORGANIZATION_ID,
        ["OWNER"]
      );

    const ownerResponse = await request(
      "/api/notifications?limit=50",
      {
        headers: {
          Cookie: ownerCookie,
        },
      }
    );

    assert.equal(ownerResponse.status, 200);

    const ownerBody = await ownerResponse.json();
    const ownerIds =
      ownerBody.data.notifications.map(
        (notification) => notification.id
      );

    assert.ok(
      ownerIds.includes(ownerNotification),
      "Owner should see their own notification"
    );

    assert.ok(
      !ownerIds.includes(fieldWorkerNotification),
      "Owner must not see another user's notification"
    );

    assert.ok(
      !ownerIds.includes(crossOrgNotification),
      "Owner must not see another organization's notification"
    );

    const fieldWorkerResponse = await request(
      "/api/notifications?limit=50",
      {
        headers: {
          Cookie: fieldWorkerCookie,
        },
      }
    );

    assert.equal(fieldWorkerResponse.status, 200);

    const fieldWorkerBody =
      await fieldWorkerResponse.json();

    const fieldWorkerIds =
      fieldWorkerBody.data.notifications.map(
        (notification) => notification.id
      );

    assert.ok(
      fieldWorkerIds.includes(fieldWorkerNotification),
      "Field worker should see their own notification"
    );

    assert.ok(
      !fieldWorkerIds.includes(ownerNotification),
      "Field worker must not see owner's notification"
    );

    assert.ok(
      !fieldWorkerIds.includes(crossOrgNotification),
      "Field worker must not see another organization's notification"
    );

    const crossOrgResponse = await request(
      "/api/notifications?limit=50",
      {
        headers: {
          Cookie: crossOrgCookie,
        },
      }
    );

    assert.equal(crossOrgResponse.status, 200);

    const crossOrgBody =
      await crossOrgResponse.json();

    const crossOrgIds =
      crossOrgBody.data.notifications.map(
        (notification) => notification.id
      );

    assert.ok(
      crossOrgIds.includes(crossOrgNotification),
      "Cross-org owner should see their own notification"
    );

    assert.ok(
      !crossOrgIds.includes(ownerNotification),
      "Cross-org owner must not see organization 1 notification"
    );
  } finally {
    await deleteNotifications(testIds);
  }
});

test("unread count is isolated by authenticated user and organization", async () => {
  const testIds = [];

  try {
    const ownerUnread =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_UNREAD_OWNER",
        title: "Owner unread",
        message: "Owner unread notification.",
      });

    const fieldWorkerUnread =
      await createNotification({
        userId: FIELD_WORKER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_UNREAD_FIELD",
        title: "Field unread",
        message: "Field worker unread notification.",
      });

    const crossOrgUnread =
      await createNotification({
        userId: CROSS_ORG_OWNER_ID,
        organizationId: CROSS_ORG_ORGANIZATION_ID,
        type: "TEST_UNREAD_CROSS_ORG",
        title: "Cross-org unread",
        message: "Cross-org unread notification.",
      });

    testIds.push(
      ownerUnread,
      fieldWorkerUnread,
      crossOrgUnread
    );

    const ownerCookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      ["OWNER"]
    );

    const response = await request(
      "/api/notifications/unread-count",
      {
        headers: {
          Cookie: ownerCookie,
        },
      }
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(
      typeof body.data.unreadCount,
      "number"
    );

    assert.ok(
      body.data.unreadCount >= 1,
      "Owner should have at least the notification created by this test"
    );

    const [rows] = await pool.execute(
      `
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id = ?
          AND organization_id = ?
          AND is_read = 0
      `,
      [OWNER_ID, ORGANIZATION_ID]
    );

    assert.equal(
      body.data.unreadCount,
      Number(rows[0].count)
    );
  } finally {
    await deleteNotifications(testIds);
  }
});

test("user cannot mark another user's notification as read", async () => {
  const testIds = [];

  try {
    const ownerNotification =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_CROSS_USER_READ",
        title: "Protected notification",
        message: "Must remain unread.",
      });

    testIds.push(ownerNotification);

    const fieldWorkerCookie =
      await createAuthCookie(
        FIELD_WORKER_ID,
        ORGANIZATION_ID,
        ["FIELD_WORKER"]
      );

    const response = await request(
      `/api/notifications/${ownerNotification}/read`,
      {
        method: "PATCH",
        headers: {
          Cookie: fieldWorkerCookie,
        },
      }
    );

    assert.equal(response.status, 404);

    const notification =
      await getNotification(ownerNotification);

    assert.ok(notification);
    assert.equal(notification.is_read, 0);
    assert.equal(notification.read_at, null);
  } finally {
    await deleteNotifications(testIds);
  }
});

test("user cannot mark another organization's notification as read", async () => {
  const testIds = [];

  try {
    const crossOrgNotification =
      await createNotification({
        userId: CROSS_ORG_OWNER_ID,
        organizationId: CROSS_ORG_ORGANIZATION_ID,
        type: "TEST_CROSS_ORG_READ",
        title: "Cross-org protected notification",
        message: "Must remain unread.",
      });

    testIds.push(crossOrgNotification);

    const ownerCookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      ["OWNER"]
    );

    const response = await request(
      `/api/notifications/${crossOrgNotification}/read`,
      {
        method: "PATCH",
        headers: {
          Cookie: ownerCookie,
        },
      }
    );

    assert.equal(response.status, 404);

    const notification =
      await getNotification(crossOrgNotification);

    assert.ok(notification);
    assert.equal(notification.is_read, 0);
    assert.equal(notification.read_at, null);
  } finally {
    await deleteNotifications(testIds);
  }
});

test("user can mark their own notification as read", async () => {
  const testIds = [];

  try {
    const notificationId =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_OWN_READ",
        title: "Own notification",
        message: "Should become read.",
      });

    testIds.push(notificationId);

    const ownerCookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      ["OWNER"]
    );

    const response = await request(
      `/api/notifications/${notificationId}/read`,
      {
        method: "PATCH",
        headers: {
          Cookie: ownerCookie,
        },
      }
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.success, true);

    const notification =
      await getNotification(notificationId);

    assert.ok(notification);
    assert.equal(notification.is_read, 1);
    assert.notEqual(notification.read_at, null);
  } finally {
    await deleteNotifications(testIds);
  }
});

test("marking an already-read notification does not expose notification existence", async () => {
  const testIds = [];

  try {
    const notificationId =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_ALREADY_READ",
        title: "Already read",
        message: "Already read notification.",
        isRead: 1,
      });

    testIds.push(notificationId);

    const ownerCookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      ["OWNER"]
    );

    const response = await request(
      `/api/notifications/${notificationId}/read`,
      {
        method: "PATCH",
        headers: {
          Cookie: ownerCookie,
        },
      }
    );

    assert.equal(response.status, 404);

    const notification =
      await getNotification(notificationId);

    assert.ok(notification);
    assert.equal(notification.is_read, 1);
  } finally {
    await deleteNotifications(testIds);
  }
});

test("mark-all-read only changes notifications belonging to the authenticated user", async () => {
  const testIds = [];

  const ownerPreExistingUnread = [];

  try {
    const [existingRows] = await pool.execute(
      `
        SELECT
          id,
          is_read,
          read_at
        FROM notifications
        WHERE user_id = ?
          AND organization_id = ?
          AND is_read = 0
      `,
      [FIELD_WORKER_ID, ORGANIZATION_ID]
    );

    ownerPreExistingUnread.push(
      ...existingRows
    );

    const ownerNotification =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_MARK_ALL_OWNER",
        title: "Owner mark-all notification",
        message: "Should become read.",
      });

    const fieldWorkerNotification =
      await createNotification({
        userId: FIELD_WORKER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_MARK_ALL_FIELD",
        title: "Field-worker notification",
        message: "Must remain unread.",
      });

    const crossOrgNotification =
      await createNotification({
        userId: CROSS_ORG_OWNER_ID,
        organizationId: CROSS_ORG_ORGANIZATION_ID,
        type: "TEST_MARK_ALL_CROSS_ORG",
        title: "Cross-org notification",
        message: "Must remain unread.",
      });

    testIds.push(
      ownerNotification,
      fieldWorkerNotification,
      crossOrgNotification
    );

    const ownerCookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      ["OWNER"]
    );

    const response = await request(
      "/api/notifications/read-all",
      {
        method: "PATCH",
        headers: {
          Cookie: ownerCookie,
        },
      }
    );

    assert.equal(response.status, 200);

    const ownerResult =
      await getNotification(ownerNotification);

    const fieldWorkerResult =
      await getNotification(fieldWorkerNotification);

    const crossOrgResult =
      await getNotification(crossOrgNotification);

    assert.ok(ownerResult);
    assert.ok(fieldWorkerResult);
    assert.ok(crossOrgResult);

    assert.equal(
      ownerResult.is_read,
      1,
      "Authenticated owner's notification should be marked read"
    );

    assert.notEqual(
      ownerResult.read_at,
      null,
      "Authenticated owner's read_at should be populated"
    );

    assert.equal(
      fieldWorkerResult.is_read,
      0,
      "Another user's notification must remain unread"
    );

    assert.equal(
      crossOrgResult.is_read,
      0,
      "Another organization's notification must remain unread"
    );
  } finally {
    await deleteNotifications(testIds);

    /*
     * This test intentionally uses mark-all-read, which can touch
     * pre-existing unread notifications belonging to the authenticated
     * user. Restore the FIELD_WORKER snapshot defensively if needed.
     */
    for (const row of ownerPreExistingUnread) {
      await pool.execute(
        `
          UPDATE notifications
          SET is_read = ?,
              read_at = ?
          WHERE id = ?
            AND user_id = ?
            AND organization_id = ?
        `,
        [
          row.is_read,
          row.read_at,
          row.id,
          FIELD_WORKER_ID,
          ORGANIZATION_ID,
        ]
      );
    }
  }
});

test("invalid notification ID is rejected before database update", async () => {
  const ownerCookie = await createAuthCookie(
    OWNER_ID,
    ORGANIZATION_ID,
    ["OWNER"]
  );

  const response = await request(
    "/api/notifications/not-a-number/read",
    {
      method: "PATCH",
      headers: {
        Cookie: ownerCookie,
      },
    }
  );

  assert.equal(response.status, 400);

  const body = await response.json();

  assert.equal(body.success, false);
  assert.equal(
    body.message,
    "Invalid notification ID"
  );
});

test("notification pagination uses deterministic created_at and id ordering", async () => {
  const testIds = [];

  try {
    const first =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_PAGINATION_1",
        title: "Pagination 1",
        message: "Pagination test 1.",
      });

    const second =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_PAGINATION_2",
        title: "Pagination 2",
        message: "Pagination test 2.",
      });

    const third =
      await createNotification({
        userId: OWNER_ID,
        organizationId: ORGANIZATION_ID,
        type: "TEST_PAGINATION_3",
        title: "Pagination 3",
        message: "Pagination test 3.",
      });

    testIds.push(first, second, third);

    /*
     * Force identical timestamps so id DESC becomes the
     * deterministic tie-breaker being tested.
     */
    await pool.execute(
      `
        UPDATE notifications
        SET created_at = '2037-01-01 00:00:00'
        WHERE id IN (?, ?, ?)
      `,
      [first, second, third]
    );

    const ownerCookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      ["OWNER"]
    );

    const pageOneResponse = await request(
      "/api/notifications?limit=2&page=1",
      {
        headers: {
          Cookie: ownerCookie,
        },
      }
    );

    assert.equal(pageOneResponse.status, 200);

    const pageOne =
      await pageOneResponse.json();

    const pageOneTestIds =
      pageOne.data.notifications
        .filter((notification) =>
          testIds.includes(notification.id)
        )
        .map((notification) => notification.id);

    assert.deepEqual(
      pageOneTestIds,
      [third, second]
    );

    const pageTwoResponse = await request(
      "/api/notifications?limit=2&page=2",
      {
        headers: {
          Cookie: ownerCookie,
        },
      }
    );

    assert.equal(pageTwoResponse.status, 200);

    const pageTwo =
      await pageTwoResponse.json();

    const pageTwoTestIds =
      pageTwo.data.notifications
        .filter((notification) =>
          testIds.includes(notification.id)
        )
        .map((notification) => notification.id);

    assert.ok(
      pageTwoTestIds.includes(first),
      "The oldest test notification should eventually appear on page 2"
    );
  } finally {
    await deleteNotifications(testIds);
  }
});
