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
const requirementIds = [];
const tempDirectories = [];

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

function dateOnly(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createTestPdf(tempDirectory, filename) {
  const pdfPath = path.join(
    tempDirectory,
    filename
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

  return pdfPath;
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

async function request(pathname, options = {}) {
  const response = await fetch(
    `${baseUrl}${pathname}`,
    options
  );

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

async function createRequirement(
  ownerCookie,
  name,
  expiryDate
) {
  const { response, body } = await request(
    "/api/compliance/requirements",
    {
      method: "POST",
      headers: {
        Cookie: ownerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        requirementType: "Permit",
        description:
          "Automated Compliance expiry-status test requirement",
        responsibleUserId: OWNER_ID,
        expiryDate,
      }),
    }
  );

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data);
  assert.ok(body.data.id);

  return body.data;
}

async function uploadAndVerifyEvidence({
  ownerCookie,
  requirementId,
  expiryDate,
  filename,
}) {
  const tempDirectory = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "safelayer-compliance-expiry-"
    )
  );

  tempDirectories.push(tempDirectory);

  const pdfPath = createTestPdf(
    tempDirectory,
    filename
  );

  const form = new FormData();

  form.append(
    "evidence",
    new Blob(
      [fs.readFileSync(pdfPath)],
      {
        type: "application/pdf",
      }
    ),
    filename
  );

  form.append(
    "documentDate",
    dateOnly(-7)
  );

  form.append(
    "expiryDate",
    expiryDate
  );

  const uploadResult = await request(
    `/api/compliance/requirements/${requirementId}/evidence`,
    {
      method: "POST",
      headers: {
        Cookie: ownerCookie,
      },
      body: form,
    }
  );

  assert.equal(
    uploadResult.response.status,
    201
  );
  assert.equal(
    uploadResult.body.success,
    true
  );
  assert.ok(uploadResult.body.data);
  assert.equal(
    uploadResult.body.data.verificationStatus,
    "PENDING"
  );

  const evidenceId =
    uploadResult.body.data.id;

  const verifyResult = await request(
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
          "Automated expiry-status verification test",
      }),
    }
  );

  assert.equal(
    verifyResult.response.status,
    200
  );
  assert.equal(
    verifyResult.body.success,
    true
  );
  assert.equal(
    verifyResult.body.data.verificationStatus,
    "VERIFIED"
  );

  return {
    evidenceId,
    pdfPath,
  };
}

async function cleanup() {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const requirementId of requirementIds) {
      const [evidenceRows] =
        await connection.execute(
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

        const absolutePath =
          path.resolve(
            process.cwd(),
            row.file_path
          );

        await fs.promises
          .unlink(absolutePath)
          .catch(() => {});
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

  for (const directory of tempDirectories) {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  }

  requirementIds.length = 0;
  tempDirectories.length = 0;
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
  "Compliance requirement status reflects verified evidence expiry",
  async () => {
    const ownerCookie =
      await createAuthCookie(
        OWNER_ID,
        ORGANIZATION_ID,
        ["OWNER"]
      );

    const farFutureRequirementExpiry =
      dateOnly(365);

    /*
     * CASE 1:
     * Verified evidence expires tomorrow.
     *
     * Requirement itself expires far in the future.
     * Therefore the evidence expiry must drive the
     * requirement to EXPIRING_SOON.
     */
    {
      const evidenceExpiry =
        dateOnly(1);

      const requirement =
        await createRequirement(
          ownerCookie,
          "Compliance Expiring Soon Test",
          farFutureRequirementExpiry
        );

      requirementIds.push(
        requirement.id
      );

      assert.equal(
        requirement.status,
        "PENDING"
      );

      await uploadAndVerifyEvidence({
        ownerCookie,
        requirementId:
          requirement.id,
        expiryDate: evidenceExpiry,
        filename:
          "expiring-soon-test.pdf",
      });

      const result = await request(
        `/api/compliance/requirements/${requirement.id}`,
        {
          headers: {
            Cookie: ownerCookie,
          },
        }
      );

      assert.equal(
        result.response.status,
        200
      );
      assert.equal(
        result.body.success,
        true
      );

      assert.equal(
        result.body.data.verifiedEvidenceCount,
        1
      );

      assert.equal(
        result.body.data.status,
        "EXPIRING_SOON"
      );
    }

    /*
     * CASE 2:
     * Verified evidence expired yesterday.
     *
     * Requirement itself expires far in the future.
     * Therefore the expired verified evidence must drive
     * the requirement to EXPIRED.
     */
    {
      const evidenceExpiry =
        dateOnly(-1);

      const requirement =
        await createRequirement(
          ownerCookie,
          "Compliance Expired Test",
          farFutureRequirementExpiry
        );

      requirementIds.push(
        requirement.id
      );

      assert.equal(
        requirement.status,
        "PENDING"
      );

      await uploadAndVerifyEvidence({
        ownerCookie,
        requirementId:
          requirement.id,
        expiryDate: evidenceExpiry,
        filename:
          "expired-test.pdf",
      });

      const result = await request(
        `/api/compliance/requirements/${requirement.id}`,
        {
          headers: {
            Cookie: ownerCookie,
          },
        }
      );

      assert.equal(
        result.response.status,
        200
      );
      assert.equal(
        result.body.success,
        true
      );

      assert.equal(
        result.body.data.verifiedEvidenceCount,
        1
      );

      assert.equal(
        result.body.data.status,
        "EXPIRED"
      );
    }
  }
);
