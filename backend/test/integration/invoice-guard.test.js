const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const pool = require("../../src/config/database");
const { generateAccessToken } = require("../../src/utils/jwt");
const invoiceRepository =
  require("../../src/repositories/invoiceRepository");
const reviewService =
  require("../../src/services/reviewService");

const OWNER_ID = 1;
const FIELD_WORKER_ID = 4;
const CROSS_ORG_OWNER_ID = 3;

const ORGANIZATION_ID = 1;
const CROSS_ORG_ORGANIZATION_ID = 4;

let server;
let baseUrl;

async function createAuthCookie(userId, organizationId, role) {
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

  assert.equal(
    rows.length,
    1,
    `Test user ${userId} was not found in organization ${organizationId}`
  );

  const token = generateAccessToken({
    id: userId,
    organization_id: organizationId,
    roles: [role],
    token_version: rows[0].token_version,
  });

  return `access_token=${token}`;
}

async function startServer() {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });
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

async function createInvoiceFixture(connection, options = {}) {
  const {
    organizationId = ORGANIZATION_ID,
    submittedBy = OWNER_ID,
    activityId = null,
    vendorName = "Invoice Guard Test Vendor",
    invoiceNumber =
      `IG-TEST-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    invoiceDate = "2026-09-13",
    dueDate = "2026-09-30",
    amount = 12500,
    currency = "PHP",
    status = "PENDING",
  } = options;

  const [result] = await connection.execute(
    `
      INSERT INTO invoices (
        organization_id,
        activity_id,
        vendor_name,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        currency,
        status,
        submitted_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      organizationId,
      activityId,
      vendorName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      amount,
      currency,
      status,
      submittedBy,
    ]
  );

  return result.insertId;
}

async function getInvoice(connection, invoiceId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        activity_id,
        vendor_name,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        currency,
        status,
        submitted_by
      FROM invoices
      WHERE id = ?
      LIMIT 1
    `,
    [invoiceId]
  );

  return rows[0] || null;
}

async function getLatestInvoiceRiskAssessment(
  connection,
  invoiceId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        activity_id,
        invoice_id,
        assessment_type,
        trust_score,
        risk_level,
        duplicate_detected,
        document_verified,
        requires_review,
        explanation
      FROM risk_assessments
      WHERE invoice_id = ?
        AND assessment_type = 'INVOICE'
      ORDER BY id DESC
      LIMIT 1
    `,
    [invoiceId]
  );

  return rows[0] || null;
}

async function countInvoiceRiskAssessments(
  connection,
  invoiceId
) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS count
      FROM risk_assessments
      WHERE invoice_id = ?
        AND assessment_type = 'INVOICE'
    `,
    [invoiceId]
  );

  return Number(rows[0].count);
}

async function getInvoiceReview(
  connection,
  invoiceId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        invoice_id,
        activity_id,
        transaction_id,
        risk_assessment_id,
        status,
        priority,
        reason,
        resolution
      FROM reviews
      WHERE organization_id = ?
        AND invoice_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [ORGANIZATION_ID, invoiceId]
  );

  return rows[0] || null;
}

async function getInvoiceNotifications(
  connection,
  invoiceId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        user_id,
        organization_id,
        type,
        title,
        message,
        entity_type,
        entity_id
      FROM notifications
      WHERE organization_id = ?
        AND entity_type = 'INVOICE'
        AND entity_id = ?
        AND type = 'INVOICE_REQUIRES_REVIEW'
      ORDER BY id ASC
    `,
    [ORGANIZATION_ID, invoiceId]
  );

  return rows;
}

async function getExpectedInvoiceNotificationRecipients(
  connection
) {
  const [rows] = await connection.execute(
    `
      SELECT DISTINCT
        u.id
      FROM users u
      INNER JOIN user_roles ur
        ON ur.user_id = u.id
      INNER JOIN roles r
        ON r.id = ur.role_id
      WHERE u.organization_id = ?
        AND u.is_active = 1
        AND r.name IN (
          'OWNER',
          'ADMIN',
          'MANAGER',
          'FINANCE'
        )
      ORDER BY u.id
    `,
    [ORGANIZATION_ID]
  );

  return rows.map((user) => Number(user.id));
}

async function countOpenInvoiceReviews(
  connection,
  invoiceId
) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS count
      FROM reviews
      WHERE organization_id = ?
        AND invoice_id = ?
        AND status IN ('OPEN', 'IN_REVIEW')
    `,
    [ORGANIZATION_ID, invoiceId]
  );

  return Number(rows[0].count);
}

async function getInvoiceAudits(
  connection,
  invoiceId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
      FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'INVOICE'
        AND entity_id = ?
      ORDER BY id ASC
    `,
    [ORGANIZATION_ID, invoiceId]
  );

  return rows;
}

async function cleanupInvoice(
  connection,
  invoiceId
) {
  if (!invoiceId) {
    return;
  }

  await connection.execute(
    `
      DELETE FROM notifications
      WHERE organization_id = ?
        AND entity_type = 'INVOICE'
        AND entity_id = ?
    `,
    [ORGANIZATION_ID, invoiceId]
  );

  await connection.execute(
    `
      DELETE FROM audit_events
      WHERE organization_id = ?
        AND entity_type = 'INVOICE'
        AND entity_id = ?
    `,
    [ORGANIZATION_ID, invoiceId]
  );

  await connection.execute(
    `
      DELETE FROM reviews
      WHERE organization_id = ?
        AND invoice_id = ?
    `,
    [ORGANIZATION_ID, invoiceId]
  );

  await connection.execute(
    `
      DELETE FROM risk_assessments
      WHERE invoice_id = ?
        AND assessment_type = 'INVOICE'
    `,
    [invoiceId]
  );

  await connection.execute(
    `
      DELETE FROM invoices
      WHERE organization_id = ?
        AND id = ?
    `,
    [ORGANIZATION_ID, invoiceId]
  );
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

test.before(async () => {
  await startServer();
});

test.after(async () => {
  await stopServer();
  await pool.end();
});

test(
  "unauthenticated invoice list is rejected",
  async () => {
    const response = await request("/api/invoices");

    assert.equal(response.status, 401);
  }
);

test(
  "unauthenticated invoice verification is rejected",
  async () => {
    const response =
      await request("/api/invoices/1/verify", {
        method: "POST",
      });

    assert.equal(response.status, 401);
  }
);

test(
  "FIELD_WORKER cannot verify an invoice",
  async () => {
    const cookie = await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

    const response =
      await request("/api/invoices/1/verify", {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
      });

    assert.equal(response.status, 403);
  }
);

test(
  "invalid invoice id is rejected by validation",
  async () => {
    const cookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

    const response =
      await request("/api/invoices/not-a-number/verify", {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
      });

    assert.equal(response.status, 400);
  }
);

test(
  "cross-organization invoice access is rejected",
  async () => {
    const connection = await pool.getConnection();

    let invoiceId;

    try {
      invoiceId = await createInvoiceFixture(
        connection,
        {
          organizationId:
            CROSS_ORG_ORGANIZATION_ID,
          submittedBy:
            CROSS_ORG_OWNER_ID,
          vendorName:
            "Cross Organization Invoice",
        }
      );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const response =
        await request(
          `/api/invoices/${invoiceId}`,
          {
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(response.status, 404);
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupConnection.execute(
          `
            DELETE FROM audit_events
            WHERE entity_type = 'INVOICE'
              AND entity_id = ?
          `,
          [invoiceId]
        );

        await cleanupConnection.execute(
          `
            DELETE FROM reviews
            WHERE invoice_id = ?
          `,
          [invoiceId]
        );

        await cleanupConnection.execute(
          `
            DELETE FROM risk_assessments
            WHERE invoice_id = ?
          `,
          [invoiceId]
        );

        await cleanupConnection.execute(
          `
            DELETE FROM invoices
            WHERE id = ?
          `,
          [invoiceId]
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "authorized invoice creation works",
  async () => {
    const cookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

    const invoiceNumber =
      `IG-CREATE-${Date.now()}`;

    const response =
      await request("/api/invoices", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendorName:
            "Invoice Creation Test Vendor",
          invoiceNumber,
          invoiceDate:
            "2026-09-13",
          dueDate:
            "2026-09-30",
          amount: 12500,
          currency: "PHP",
        }),
      });

    assert.equal(response.status, 201);

    const body = await response.json();

    assert.equal(body.success, true);
    assert.equal(
      body.data.invoice_number,
      invoiceNumber
    );

    const connection = await pool.getConnection();

    try {
      await cleanupInvoice(
        connection,
        body.data.id
      );
    } finally {
      connection.release();
    }
  }
);

test(
  "verification creates an invoice-specific risk assessment",
  async () => {
    const connection = await pool.getConnection();

    let invoiceId;

    try {
      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Invoice Risk Assessment Vendor",
            amount: 7777,
          }
        );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const response =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.success, true);
      assert.equal(
        body.data.riskAssessmentId > 0,
        true
      );

      const checkConnection =
        await pool.getConnection();

      try {
        const assessment =
          await getLatestInvoiceRiskAssessment(
            checkConnection,
            invoiceId
          );

        assert.ok(assessment);
        assert.equal(
          assessment.invoice_id,
          invoiceId
        );
        assert.equal(
          assessment.assessment_type,
          "INVOICE"
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );

      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "invoice without activity can still be verified",
  async () => {
    const connection = await pool.getConnection();

    let invoiceId;

    try {
      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            activityId: null,
            vendorName:
              "Standalone Invoice Vendor",
            amount: 8888,
          }
        );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const response =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(response.status, 200);

      const checkConnection =
        await pool.getConnection();

      try {
        const invoice =
          await getInvoice(
            checkConnection,
            invoiceId
          );

        const assessment =
          await getLatestInvoiceRiskAssessment(
            checkConnection,
            invoiceId
          );

        assert.ok(invoice);
        assert.equal(
          invoice.activity_id,
          null
        );

        assert.ok(assessment);
        assert.equal(
          assessment.invoice_id,
          invoiceId
        );
        assert.equal(
          assessment.activity_id,
          null
        );
        assert.equal(
          assessment.assessment_type,
          "INVOICE"
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "high-risk invoice creates exactly one open review",
  async () => {
    const connection = await pool.getConnection();

    let existingInvoiceId;
    let invoiceId;

    try {
      const invoiceDate =
        "2026-09-13";

      existingInvoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Duplicate Pattern Vendor",
            invoiceDate,
            amount: 9999,
          }
        );

      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Duplicate Pattern Vendor",
            invoiceDate,
            amount: 9999,
          }
        );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const response =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(response.status, 200);

      const checkConnection =
        await pool.getConnection();

      try {
        const invoice =
          await getInvoice(
            checkConnection,
            invoiceId
          );

        const assessment =
          await getLatestInvoiceRiskAssessment(
            checkConnection,
            invoiceId
          );

        const review =
          await getInvoiceReview(
            checkConnection,
            invoiceId
          );

        const openCount =
          await countOpenInvoiceReviews(
            checkConnection,
            invoiceId
          );

        assert.equal(
          invoice.status,
          "REQUIRES_REVIEW"
        );

        assert.ok(assessment);
        assert.equal(
          assessment.invoice_id,
          invoiceId
        );
        assert.equal(
          assessment.requires_review,
          1
        );

        assert.ok(review);
        assert.equal(
          review.invoice_id,
          invoiceId
        );
        assert.equal(
          review.risk_assessment_id,
          assessment.id
        );
        assert.equal(
          review.status,
          "OPEN"
        );

        assert.equal(
          openCount,
          1
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );

        await cleanupInvoice(
          cleanupConnection,
          existingInvoiceId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "second verification reuses the existing open invoice review",
  async () => {
    const connection = await pool.getConnection();

    let existingInvoiceId;
    let invoiceId;

    try {
      existingInvoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Review Reuse Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 5432,
          }
        );

      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Review Reuse Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 5432,
          }
        );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const first =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(first.status, 200);

      const firstBody =
        await first.json();

      const firstReviewId =
        firstBody.data.reviewId;

      const second =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(second.status, 200);

      const secondBody =
        await second.json();

      assert.equal(
        secondBody.data.reviewId,
        firstReviewId
      );

      const checkConnection =
        await pool.getConnection();

      try {
        const openCount =
          await countOpenInvoiceReviews(
            checkConnection,
            invoiceId
          );

        const assessmentCount =
          await countInvoiceRiskAssessments(
            checkConnection,
            invoiceId
          );

        assert.equal(
          openCount,
          1
        );

        assert.equal(
          assessmentCount,
          2
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );

        await cleanupInvoice(
          cleanupConnection,
          existingInvoiceId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "concurrent high-risk invoice verification creates one review and one notification per recipient",
  async () => {
    const connection = await pool.getConnection();

    let invoiceId;
    let duplicateInvoiceId;

    try {
      duplicateInvoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Concurrent Verification Vendor",
            invoiceNumber:
              `IG-CONCURRENT-DUP-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            invoiceDate: "2026-09-01",
            dueDate: "2026-09-30",
            amount: 7777,
          }
        );

      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Concurrent Verification Vendor",
            invoiceNumber:
              `IG-CONCURRENT-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            invoiceDate: null,
            dueDate: null,
            amount: 7777,
          }
        );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const headers = {
        Cookie: cookie,
      };

      const [first, second] =
        await Promise.all([
          request(
            `/api/invoices/${invoiceId}/verify`,
            {
              method: "POST",
              headers,
            }
          ),
          request(
            `/api/invoices/${invoiceId}/verify`,
            {
              method: "POST",
              headers,
            }
          ),
        ]);

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);

      const checkConnection =
        await pool.getConnection();

      try {
        const openReviewCount =
          await countOpenInvoiceReviews(
            checkConnection,
            invoiceId
          );

        assert.equal(
          openReviewCount,
          1,
          "Concurrent verification must create exactly one open review"
        );

        const notifications =
          await getInvoiceNotifications(
            checkConnection,
            invoiceId
          );

        const expectedRecipients =
          await getExpectedInvoiceNotificationRecipients(
            checkConnection
          );

        const actualRecipients =
          notifications
            .map((notification) =>
              Number(notification.user_id)
            )
            .sort((a, b) => a - b);

        assert.deepEqual(
          actualRecipients,
          expectedRecipients,
          "Exactly one notification must exist for each eligible management/finance recipient"
        );

        assert.equal(
          notifications.length,
          expectedRecipients.length,
          "Concurrent verification must not duplicate notifications"
        );

        for (const notification of notifications) {
          assert.equal(
            notification.organization_id,
            ORGANIZATION_ID
          );

          assert.equal(
            notification.type,
            "INVOICE_REQUIRES_REVIEW"
          );

          assert.equal(
            notification.entity_type,
            "INVOICE"
          );

          assert.equal(
            Number(notification.entity_id),
            Number(invoiceId)
          );
        }

        const invoice =
          await getInvoice(
            checkConnection,
            invoiceId
          );

        assert.equal(
          invoice.status,
          "REQUIRES_REVIEW"
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "invoice review APPROVE changes invoice to VERIFIED",
  async () => {
    const connection = await pool.getConnection();

    let existingInvoiceId;
    let invoiceId;

    try {
      existingInvoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Approve Workflow Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 4321,
          }
        );

      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Approve Workflow Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 4321,
          }
        );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const verify =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(verify.status, 200);

      const review =
        await request(
          `/api/invoices/${invoiceId}/review`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              decision: "APPROVE",
              resolution:
                "Invoice evidence reviewed and accepted.",
            }),
          }
        );

      assert.equal(review.status, 200);

      const checkConnection =
        await pool.getConnection();

      try {
        const invoice =
          await getInvoice(
            checkConnection,
            invoiceId
          );

        const invoiceReview =
          await getInvoiceReview(
            checkConnection,
            invoiceId
          );

        assert.equal(
          invoice.status,
          "VERIFIED"
        );

        assert.equal(
          invoiceReview.status,
          "APPROVED"
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );

        await cleanupInvoice(
          cleanupConnection,
          existingInvoiceId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "invoice review REJECT changes invoice to REJECTED",
  async () => {
    const connection = await pool.getConnection();

    let existingInvoiceId;
    let invoiceId;

    try {
      existingInvoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Reject Workflow Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 3210,
          }
        );

      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Reject Workflow Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 3210,
          }
        );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const verify =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(verify.status, 200);

      const review =
        await request(
          `/api/invoices/${invoiceId}/review`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              decision: "REJECT",
              resolution:
                "Invoice failed manual review.",
            }),
          }
        );

      assert.equal(review.status, 200);

      const checkConnection =
        await pool.getConnection();

      try {
        const invoice =
          await getInvoice(
            checkConnection,
            invoiceId
          );

        const invoiceReview =
          await getInvoiceReview(
            checkConnection,
            invoiceId
          );

        assert.equal(
          invoice.status,
          "REJECTED"
        );

        assert.equal(
          invoiceReview.status,
          "REJECTED"
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );

        await cleanupInvoice(
          cleanupConnection,
          existingInvoiceId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "invoice review ESCALATE keeps invoice in REQUIRES_REVIEW",
  async () => {
    const connection = await pool.getConnection();

    let existingInvoiceId;
    let invoiceId;

    try {
      existingInvoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Escalate Workflow Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 6543,
          }
        );

      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Escalate Workflow Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 6543,
          }
        );
    } finally {
      connection.release();
    }

    try {
      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const verify =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(verify.status, 200);

      const review =
        await request(
          `/api/invoices/${invoiceId}/review`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              decision: "ESCALATE",
              resolution:
                "Requires senior compliance review.",
            }),
          }
        );

      assert.equal(review.status, 200);

      const checkConnection =
        await pool.getConnection();

      try {
        const invoice =
          await getInvoice(
            checkConnection,
            invoiceId
          );

        const invoiceReview =
          await getInvoiceReview(
            checkConnection,
            invoiceId
          );

        assert.equal(
          invoice.status,
          "REQUIRES_REVIEW"
        );

        assert.equal(
          invoiceReview.status,
          "ESCALATED"
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );

        await cleanupInvoice(
          cleanupConnection,
          existingInvoiceId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);

test(
  "verification is atomic when review creation fails",
  async () => {
    const connection = await pool.getConnection();

    let existingInvoiceId;
    let invoiceId;

    try {
      existingInvoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Atomic Rollback Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 7654,
          }
        );

      invoiceId =
        await createInvoiceFixture(
          connection,
          {
            vendorName:
              "Atomic Rollback Vendor",
            invoiceDate:
              "2026-09-13",
            amount: 7654,
          }
        );
    } finally {
      connection.release();
    }

    const originalCreateReview =
      reviewService.createReview;

    try {
      reviewService.createReview =
        async () => {
          throw new Error(
            "Injected review creation failure"
          );
        };

      const cookie = await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        "OWNER"
      );

      const response =
        await request(
          `/api/invoices/${invoiceId}/verify`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          }
        );

      assert.equal(
        response.status,
        500
      );

      const checkConnection =
        await pool.getConnection();

      try {
        const invoice =
          await getInvoice(
            checkConnection,
            invoiceId
          );

        const assessmentCount =
          await countInvoiceRiskAssessments(
            checkConnection,
            invoiceId
          );

        const review =
          await getInvoiceReview(
            checkConnection,
            invoiceId
          );

        const audits =
          await getInvoiceAudits(
            checkConnection,
            invoiceId
          );

        assert.equal(
          invoice.status,
          "PENDING"
        );

        assert.equal(
          assessmentCount,
          0
        );

        assert.equal(
          review,
          null
        );

        assert.equal(
          audits.length,
          0
        );
      } finally {
        checkConnection.release();
      }
    } finally {
      reviewService.createReview =
        originalCreateReview;

      const cleanupConnection =
        await pool.getConnection();

      try {
        await cleanupInvoice(
          cleanupConnection,
          invoiceId
        );

        await cleanupInvoice(
          cleanupConnection,
          existingInvoiceId
        );
      } finally {
        cleanupConnection.release();
      }
    }
  }
);
