const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

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
let requirementId;
let evidenceId;
let tempDirectory;

function createAuthCookie(userId, organizationId, roles) {
  return pool
    .execute(
      `
        SELECT token_version
        FROM users
        WHERE id = ?
          AND organization_id = ?
        LIMIT 1
      `,
      [userId, organizationId]
    )
    .then(([rows]) => {
      assert.equal(rows.length, 1);

      const token = generateAccessToken({
        id: userId,
        organization_id: organizationId,
        roles,
        token_version: rows[0].token_version,
      });

      return `access_token=${token}`;
    });
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

test.before(async () => {
  await startServer();
});

test.after(async () => {
  await cleanup();
  await stopServer();
  await pool.end();
});

test(
  "Compliance module: create, read, update, evidence, verification, audit, notifications, RBAC, and org isolation",
  async () => {
    const ownerCookie = await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      ["OWNER"]
    );

    const crossOrgOwnerCookie = await createAuthCookie(
      CROSS_ORG_OWNER_ID,
      CROSS_ORG_ORGANIZATION_ID,
      ["OWNER"]
    );

    /*
     * 1. LIST
     */
    {
      const { response, body } = await request(
        "/api/compliance/requirements",
        {
          headers: {
            Cookie: ownerCookie,
          },
        }
      );

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
    }

    /*
     * 2. CREATE REQUIREMENT
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
            name: "Compliance Integration Test Requirement",
            requirementType: "Permit",
            description: "Created by automated Compliance integration test",
            responsibleUserId: OWNER_ID,
            expiryDate: "2099-12-31",
          }),
        }
      );

      assert.equal(response.status, 201);
      assert.equal(body.success, true);
      assert.ok(body.data);
      assert.ok(body.data.id);

      requirementId = body.data.id;

      assert.equal(
        body.data.name,
        "Compliance Integration Test Requirement"
      );
      assert.equal(body.data.requirementType, "Permit");
      assert.equal(body.data.status, "PENDING");
    }

    /*
     * 3. READ REQUIREMENT
     */
    {
      const { response, body } = await request(
        `/api/compliance/requirements/${requirementId}`,
        {
          headers: {
            Cookie: ownerCookie,
          },
        }
      );

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.id, requirementId);
    }

    /*
     * 4. UPDATE REQUIREMENT
     */
    {
      const { response, body } = await request(
        `/api/compliance/requirements/${requirementId}`,
        {
          method: "PATCH",
          headers: {
            Cookie: ownerCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: "Updated Compliance integration test requirement",
          }),
        }
      );

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(
        body.data.description,
        "Updated Compliance integration test requirement"
      );
    }

    /*
     * 5. CREATE REAL PDF FILE FOR MULTIPART UPLOAD
     */
    tempDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "safelayer-compliance-")
    );

    const pdfPath = path.join(
      tempDirectory,
      "compliance-test.pdf"
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
     * 6. UPLOAD EVIDENCE
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
        "compliance-test.pdf"
      );

      form.append("documentDate", "2026-09-16");
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
      assert.ok(body.data);
      assert.ok(body.data.id);

      evidenceId = body.data.id;

      assert.equal(
        body.data.verificationStatus,
        "PENDING"
      );
    }

    /*
     * 7. DUPLICATE EVIDENCE MUST BE REJECTED
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
        "duplicate-compliance-test.pdf"
      );

      form.append("documentDate", "2026-09-16");
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

      assert.equal(response.status, 409);
      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "This evidence file has already been uploaded for this requirement"
      );
    }

    /*
     * 8. READ EVIDENCE
     */
    {
      const { response, body } = await request(
        `/api/compliance/requirements/${requirementId}/evidence`,
        {
          headers: {
            Cookie: ownerCookie,
          },
        }
      );

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(
        body.data.some(
          (item) => item.id === evidenceId
        )
      );
    }

    /*
     * 9. OPEN EVIDENCE FILE
     */
    {
      const response = await fetch(
        `${baseUrl}/api/compliance/evidence/${evidenceId}/file`,
        {
          headers: {
            Cookie: ownerCookie,
          },
        }
      );

      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("content-type"),
        "application/pdf"
      );

      assert.match(
        response.headers.get("content-disposition") || "",
        /inline;/
      );

      const fileBuffer = Buffer.from(
        await response.arrayBuffer()
      );

      assert.ok(fileBuffer.length > 0);
      assert.equal(
        fileBuffer.subarray(0, 8).toString(),
        "%PDF-1.4"
      );
    }

    /*
     * 10. CROSS-ORGANIZATION EVIDENCE FILE MUST FAIL
     */
    {
      const response = await fetch(
        `${baseUrl}/api/compliance/evidence/${evidenceId}/file`,
        {
          headers: {
            Cookie: crossOrgOwnerCookie,
          },
        }
      );

      assert.equal(response.status, 404);
    }

    /*
     * 11. UNAUTHENTICATED EVIDENCE FILE MUST FAIL
     */
    {
      const response = await fetch(
        `${baseUrl}/api/compliance/evidence/${evidenceId}/file`
      );

      assert.equal(response.status, 401);
    }

    /*
     * 12. VERIFY EVIDENCE
     */
    {
      const { response, body } = await request(
        `/api/compliance/evidence/${evidenceId}/verify`,
        {
          method: "PATCH",
          headers: {
            Cookie: ownerCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            verificationStatus: "VERIFIED",
            verificationNotes:
              "Verified by automated Compliance integration test",
          }),
        }
      );

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(
        body.data.verificationStatus,
        "VERIFIED"
      );
    }


    /*
     * 13. ALREADY-VERIFIED EVIDENCE MUST BE REJECTED
     */
    {
      const { response, body } = await request(
        `/api/compliance/evidence/${evidenceId}/verify`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: ownerCookie,
          },
          body: JSON.stringify({
            verificationStatus: "REJECTED",
            verificationNotes: "Attempted invalid state transition",
          }),
        }
      );

      assert.equal(response.status, 409);
      assert.equal(body.success, false);
      assert.equal(
        body.message,
        "Only pending compliance evidence can be verified or rejected"
      );
    }

    /*
     * 12. REQUIREMENT SHOULD NOW BE ACTIVE
     */
    {
      const { response, body } = await request(
        `/api/compliance/requirements/${requirementId}`,
        {
          headers: {
            Cookie: ownerCookie,
          },
        }
      );

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.status, "ACTIVE");
    }

    /*
     * 13. CROSS-ORGANIZATION READ MUST FAIL
     */
    {
      const { response } = await request(
        `/api/compliance/requirements/${requirementId}`,
        {
          headers: {
            Cookie: crossOrgOwnerCookie,
          },
        }
      );

      assert.equal(response.status, 404);
    }

    /*
     * 14. CROSS-ORGANIZATION EVIDENCE READ MUST FAIL
     */
    {
      const { response } = await request(
        `/api/compliance/requirements/${requirementId}/evidence`,
        {
          headers: {
            Cookie: crossOrgOwnerCookie,
          },
        }
      );

      assert.equal(response.status, 404);
    }

    /*
     * 15. FIELD WORKER CANNOT CREATE REQUIREMENT
     */
    {
      const fieldWorkerCookie = await createAuthCookie(
        FIELD_WORKER_ID,
        ORGANIZATION_ID,
        ["FIELD_WORKER"]
      );

      const { response } = await request(
        "/api/compliance/requirements",
        {
          method: "POST",
          headers: {
            Cookie: fieldWorkerCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Unauthorized Compliance Requirement",
            requirementType: "Permit",
          }),
        }
      );

      assert.equal(response.status, 403);
    }

    /*
     * 16. DATABASE VERIFICATION
     */
    {
      const [rows] = await pool.execute(
        `
          SELECT
            cr.id,
            cr.organization_id,
            cr.name,
            cr.requirement_type,
            cr.description,
            cr.expiry_date,
            cre.id AS evidence_id,
            cre.verification_status,
            cre.file_hash
          FROM compliance_requirements cr
          LEFT JOIN compliance_requirement_evidence cre
            ON cre.requirement_id = cr.id
          WHERE cr.id = ?
        `,
        [requirementId]
      );

      assert.equal(rows.length, 1);
      assert.equal(rows[0].organization_id, ORGANIZATION_ID);
      assert.equal(rows[0].evidence_id, evidenceId);
      assert.equal(rows[0].verification_status, "VERIFIED");
      assert.ok(rows[0].file_hash);
      assert.equal(rows[0].file_hash.length, 64);
    }

    /*
     * 17. AUDIT VERIFICATION
     */
    {
      const [rows] = await pool.execute(
        `
          SELECT action, entity_type, entity_id
          FROM audit_events
          WHERE organization_id = ?
            AND (
              entity_id = ?
              OR entity_id = ?
            )
            AND action LIKE "COMPLIANCE_%"
          ORDER BY id ASC
        `,
        [
          ORGANIZATION_ID,
          requirementId,
          evidenceId,
        ]
      );

      const actions = rows.map(
        (row) => row.action
      );

      assert.ok(
        actions.includes(
          "COMPLIANCE_REQUIREMENT_CREATED"
        )
      );

      assert.ok(
        actions.includes(
          "COMPLIANCE_REQUIREMENT_UPDATED"
        )
      );

      assert.ok(
        actions.includes(
          "COMPLIANCE_EVIDENCE_UPLOADED"
        )
      );

      assert.ok(
        actions.includes(
          "COMPLIANCE_EVIDENCE_VERIFIED"
        )
      );
    }

    /*
     * 15. NOTIFICATION VERIFICATION
     */
    {
      const [rows] = await pool.execute(
        `
          SELECT type, title, entity_type, entity_id
          FROM notifications
          WHERE organization_id = ?
            AND entity_type = "COMPLIANCE_EVIDENCE"
            AND entity_id = ?
          ORDER BY id ASC
        `,
        [ORGANIZATION_ID, evidenceId]
      );

      assert.ok(rows.length >= 2);

      const types = rows.map(
        (row) => row.type
      );

      assert.ok(
        types.includes(
          "COMPLIANCE_EVIDENCE_UPLOADED"
        )
      );

      assert.ok(
        types.includes(
          "COMPLIANCE_EVIDENCE_VERIFIED"
        )
      );
    }
  }
);