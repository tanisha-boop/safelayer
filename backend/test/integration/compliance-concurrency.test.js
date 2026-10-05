const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = require("../../src/app");
const pool = require("../../src/config/database");
const { generateAccessToken } = require("../../src/utils/jwt");

const OWNER_ID = 1;
const ORGANIZATION_ID = 1;

let server;
let baseUrl;
let requirementId;
let evidenceId;
let tempDirectory;

async function createAuthCookie() {
  const [rows] = await pool.execute(
    `
      SELECT token_version
      FROM users
      WHERE id = ?
        AND organization_id = ?
      LIMIT 1
    `,
    [OWNER_ID, ORGANIZATION_ID]
  );

  assert.equal(rows.length, 1);

  const token = generateAccessToken({
    id: OWNER_ID,
    organization_id: ORGANIZATION_ID,
    roles: ["OWNER"],
    token_version: rows[0].token_version,
  });

  return `access_token=${token}`;
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);

  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    response,
    body,
  };
}

async function cleanup() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (requirementId) {
      const [evidenceRows] = await connection.execute(
        `
          SELECT file_path
          FROM compliance_requirement_evidence
          WHERE requirement_id = ?
        `,
        [requirementId]
      );

      for (const row of evidenceRows) {
        if (!row.file_path) {
          continue;
        }

        const absolutePath = path.resolve(
          process.cwd(),
          row.file_path
        );

        await fs.promises.unlink(absolutePath).catch(() => {});
      }

      await connection.execute(
        `
          DELETE FROM compliance_requirements
          WHERE id = ?
        `,
        [requirementId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  requirementId = null;
  evidenceId = null;

  if (tempDirectory) {
    fs.rmSync(tempDirectory, {
      recursive: true,
      force: true,
    });

    tempDirectory = null;
  }
}

test.before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await cleanup();

  if (server) {
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

  await pool.end();
});

test(
  "Compliance evidence verification is atomic under concurrent requests",
  async () => {
    const ownerCookie = await createAuthCookie();

    /*
     * 1. CREATE A DEDICATED REQUIREMENT
     */
    {
      const { response, body } = await request(
        "/api/compliance/requirements",
        {
          method: "POST",
          headers: {
            Cookie: ownerCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Concurrent Verification Test Requirement",
            requirementType: "Permit",
            description:
              "Dedicated fixture for concurrent evidence verification testing",
            responsibleUserId: OWNER_ID,
            expiryDate: "2099-12-31",
          }),
        }
      );

      assert.equal(response.status, 201);
      assert.equal(body.success, true);
      assert.ok(body.data?.id);

      requirementId = body.data.id;
    }

    /*
     * 2. CREATE A REAL PDF FIXTURE
     */
    tempDirectory = fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "safelayer-compliance-concurrency-"
      )
    );

    const pdfPath = path.join(
      tempDirectory,
      "concurrent-verification.pdf"
    );

    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;

    fs.writeFileSync(pdfPath, pdfContent);

    /*
     * 3. UPLOAD PENDING EVIDENCE
     */
    {
      const form = new FormData();

      form.append(
        "evidence",
        new Blob(
          [fs.readFileSync(pdfPath)],
          {
            type: "application/pdf",
          }
        ),
        "concurrent-verification.pdf"
      );

      form.append("documentDate", "2026-10-01");
      form.append("expiryDate", "2099-12-31");

      const { response, body } = await request(
        `/api/compliance/requirements/${requirementId}/evidence`,
        {
          method: "POST",
          headers: {
            Cookie: ownerCookie,
          },
          body: form,
        }
      );

      assert.equal(response.status, 201);
      assert.equal(body.success, true);
      assert.ok(body.data?.id);
      assert.equal(
        body.data.verificationStatus,
        "PENDING"
      );

      evidenceId = body.data.id;
    }

    /*
     * 4. CONFIRM THE FIXTURE IS PENDING
     */
    {
      const [rows] = await pool.execute(
        `
          SELECT verification_status
          FROM compliance_requirement_evidence
          WHERE id = ?
            AND requirement_id = ?
        `,
        [evidenceId, requirementId]
      );

      assert.equal(rows.length, 1);
      assert.equal(
        rows[0].verification_status,
        "PENDING"
      );
    }

    /*
     * 5. FIRE TWO VERIFICATIONS AT THE SAME TIME
     */
    const verificationPayload = JSON.stringify({
      verificationStatus: "VERIFIED",
      verificationNotes:
        "Concurrent verification race-condition test",
    });

    const [first, second] = await Promise.all([
      request(
        `/api/compliance/evidence/${evidenceId}/verify`,
        {
          method: "PATCH",
          headers: {
            Cookie: ownerCookie,
            "Content-Type": "application/json",
          },
          body: verificationPayload,
        }
      ),
      request(
        `/api/compliance/evidence/${evidenceId}/verify`,
        {
          method: "PATCH",
          headers: {
            Cookie: ownerCookie,
            "Content-Type": "application/json",
          },
          body: verificationPayload,
        }
      ),
    ]);

    /*
     * 6. EXACTLY ONE REQUEST MUST WIN
     */
    const statuses = [
      first.response.status,
      second.response.status,
    ].sort((a, b) => a - b);

    assert.deepEqual(
      statuses,
      [200, 409],
      "Exactly one concurrent verification must succeed and the other must be rejected"
    );

    const successfulResponse =
      first.response.status === 200
        ? first
        : second;

    const rejectedResponse =
      first.response.status === 409
        ? first
        : second;

    assert.equal(
      successfulResponse.body.success,
      true
    );

    assert.equal(
      successfulResponse.body.data.verificationStatus,
      "VERIFIED"
    );

    assert.equal(
      rejectedResponse.body.success,
      false
    );

    assert.equal(
      rejectedResponse.body.message,
      "Only pending compliance evidence can be verified or rejected"
    );

    /*
     * 7. DATABASE MUST CONTAIN EXACTLY ONE FINAL VERIFIED STATE
     */
    {
      const [rows] = await pool.execute(
        `
          SELECT verification_status
          FROM compliance_requirement_evidence
          WHERE id = ?
            AND requirement_id = ?
        `,
        [evidenceId, requirementId]
      );

      assert.equal(rows.length, 1);
      assert.equal(
        rows[0].verification_status,
        "VERIFIED"
      );
    }

    /*
     * 8. EXACTLY ONE VERIFICATION AUDIT EVENT
     */
    {
      const [rows] = await pool.execute(
        `
          SELECT id, actor_id, entity_type, entity_id
          FROM audit_events
          WHERE organization_id = ?
            AND action = "COMPLIANCE_EVIDENCE_VERIFIED"
            AND entity_type = "COMPLIANCE_EVIDENCE"
            AND entity_id = ?
        `,
        [ORGANIZATION_ID, evidenceId]
      );

      assert.equal(
        rows.length,
        1,
        "Concurrent verification must create exactly one verification audit event"
      );

      assert.equal(rows[0].actor_id, OWNER_ID);
      assert.equal(
        rows[0].entity_type,
        "COMPLIANCE_EVIDENCE"
      );
      assert.equal(
        Number(rows[0].entity_id),
        Number(evidenceId)
      );
    }

    /*
     * 9. EXACTLY ONE VERIFICATION NOTIFICATION
     *
     * Upload notification and verification notification
     * are both attached to this evidence. Filter specifically
     * for the verification event.
     */
    {
      const [rows] = await pool.execute(
        `
          SELECT
            id,
            user_id,
            type,
            entity_type,
            entity_id
          FROM notifications
          WHERE organization_id = ?
            AND type = "COMPLIANCE_EVIDENCE_VERIFIED"
            AND entity_type = "COMPLIANCE_EVIDENCE"
            AND entity_id = ?
        `,
        [ORGANIZATION_ID, evidenceId]
      );

      assert.equal(
        rows.length,
        1,
        "Concurrent verification must create exactly one verification notification"
      );

      assert.equal(rows[0].user_id, OWNER_ID);
      assert.equal(
        rows[0].type,
        "COMPLIANCE_EVIDENCE_VERIFIED"
      );
      assert.equal(
        rows[0].entity_type,
        "COMPLIANCE_EVIDENCE"
      );
      assert.equal(
        Number(rows[0].entity_id),
        Number(evidenceId)
      );
    }
  }
);
