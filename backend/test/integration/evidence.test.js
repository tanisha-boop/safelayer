const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = require("../../src/app");
const pool = require("../../src/config/database");
const { generateAccessToken } = require("../../src/utils/jwt");

const OWNER_ID = 1;
const FIELD_WORKER_ID = 4;
const CROSS_ORG_OWNER_ID = 3;

const ORGANIZATION_ID = 1;
const CROSS_ORG_ORGANIZATION_ID = 4;

const uploadsDirectory = path.resolve(
  process.cwd(),
  "uploads"
);

let server;
let baseUrl;

let assignedActivityId;
let unassignedActivityId;
let crossOrgActivityId;

const createdEvidenceIds = [];
const createdActivityIds = [];

function uniqueSuffix() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

async function createAuthCookie(
  userId,
  organizationId,
  role
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

async function createActivity(
  connection,
  suffix,
  {
    organizationId = ORGANIZATION_ID,
    assignedTo = FIELD_WORKER_ID,
  } = {}
) {
  const title =
    `Evidence Integration Test ${suffix}`;

  const [result] = await connection.execute(
    `
      INSERT INTO field_activities (
        organization_id,
        assigned_to,
        activity_type,
        title,
        description,
        status,
        scheduled_at,
        latitude,
        longitude
      )
      VALUES (
        ?, ?, 'VISIT', ?, ?, 'PENDING',
        '2026-10-01 09:00:00',
        10.72020000,
        122.56210000
      )
    `,
    [
      organizationId,
      assignedTo,
      title,
      "Created by Evidence integration test.",
    ]
  );

  createdActivityIds.push(result.insertId);

  return result.insertId;
}

function makePdfBuffer() {
  return Buffer.from(`%PDF-1.4
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
`);
}

function makePngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ]);
}

function makeForm(
  buffer,
  mimeType,
  filename = "evidence-test.pdf"
) {
  const form = new FormData();

  form.append(
    "evidence",
    new Blob([buffer], {
      type: mimeType,
    }),
    filename
  );

  return form;
}

async function uploadEvidence({
  activityId,
  cookie,
  buffer = makePdfBuffer(),
  mimeType = "application/pdf",
  filename = "evidence-test.pdf",
  fieldName = "evidence",
}) {
  const form = new FormData();

  form.append(
    fieldName,
    new Blob([buffer], {
      type: mimeType,
    }),
    filename
  );

  return fetch(
    `${baseUrl}/api/evidence/activity/${activityId}`,
    {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: form,
    }
  );
}

async function cleanupEvidence() {
  for (const evidenceId of createdEvidenceIds) {
    const [rows] = await pool.execute(
      `
        SELECT file_path
        FROM evidence
        WHERE id = ?
      `,
      [evidenceId]
    );

    for (const row of rows) {
      if (!row.file_path) continue;

      const absolutePath = path.resolve(
        process.cwd(),
        row.file_path
      );

      await fsp.unlink(absolutePath).catch(() => {});
    }

    await pool.execute(
      `
        DELETE FROM notifications
        WHERE organization_id = ?
          AND entity_type = 'EVIDENCE'
          AND entity_id = ?
      `,
      [ORGANIZATION_ID, evidenceId]
    );

    await pool.execute(
      `
        DELETE FROM audit_events
        WHERE organization_id = ?
          AND entity_type = 'EVIDENCE'
          AND entity_id = ?
      `,
      [ORGANIZATION_ID, evidenceId]
    );

    await pool.execute(
      `
        DELETE FROM evidence
        WHERE id = ?
      `,
      [evidenceId]
    );
  }

  createdEvidenceIds.length = 0;

  for (const activityId of createdActivityIds) {
    await pool.execute(
      `
        DELETE FROM field_activities
        WHERE id = ?
      `,
      [activityId]
    );
  }

  createdActivityIds.length = 0;
}

test.before(async () => {
  await fsp.mkdir(
    uploadsDirectory,
    { recursive: true }
  );

  const connection =
    await pool.getConnection();

  try {
    assignedActivityId =
      await createActivity(
        connection,
        "assigned",
        {
          assignedTo: FIELD_WORKER_ID,
        }
      );

    unassignedActivityId =
      await createActivity(
        connection,
        "unassigned",
        {
          assignedTo: OWNER_ID,
        }
      );

    crossOrgActivityId =
      await createActivity(
        connection,
        "cross-org",
        {
          organizationId:
            CROSS_ORG_ORGANIZATION_ID,
          assignedTo: CROSS_ORG_OWNER_ID,
        }
      );
  } finally {
    connection.release();
  }

  await new Promise((resolve) => {
    server = app.listen(
      0,
      "127.0.0.1",
      () => resolve()
    );
  });

  const address =
    server.address();

  baseUrl =
    `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await cleanupEvidence();

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await pool.end();
});

test("unauthenticated evidence upload is rejected", async () => {
  const response =
    await uploadEvidence({
      activityId: assignedActivityId,
      cookie: "",
    });

  assert.equal(response.status, 401);
});

test("assigned field worker can upload valid PDF evidence", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const buffer =
    makePdfBuffer();

  const response =
    await uploadEvidence({
      activityId: assignedActivityId,
      cookie,
      buffer,
    });

  assert.equal(response.status, 201);

  const body =
    await response.json();

  assert.equal(body.success, true);
  assert.ok(body.data.id);

  createdEvidenceIds.push(
    body.data.id
  );

  assert.equal(
    body.data.mime_type,
    "application/pdf"
  );

  assert.equal(
    body.data.evidence_type,
    "DOCUMENT"
  );

  assert.equal(
    body.data.file_size,
    buffer.length
  );

  assert.match(
    body.data.file_hash,
    /^[a-f0-9]{64}$/
  );

  const expectedHash =
    crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

  assert.equal(
    body.data.file_hash,
    expectedHash
  );

  assert.equal(
    body.data.verification_status,
    "PENDING"
  );

  const storedPath =
    path.resolve(
      process.cwd(),
      body.data.file_path
    );

  assert.ok(
    storedPath.startsWith(
      `${uploadsDirectory}${path.sep}`
    )
  );

  assert.equal(
    fs.existsSync(storedPath),
    true,
    "Uploaded evidence file must physically exist"
  );
});

test("unassigned field worker cannot upload evidence", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const response =
    await uploadEvidence({
      activityId: unassignedActivityId,
      cookie,
    });

  assert.equal(response.status, 403);
});

test("owner can upload evidence for an activity", async () => {
  const cookie =
    await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

  const response =
    await uploadEvidence({
      activityId: unassignedActivityId,
      cookie,
    });

  assert.equal(response.status, 201);

  const body =
    await response.json();

  createdEvidenceIds.push(
    body.data.id
  );

  assert.equal(
    body.data.verification_status,
    "PENDING"
  );
});

test("cross-organization evidence upload is rejected", async () => {
  const cookie =
    await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

  const response =
    await uploadEvidence({
      activityId: crossOrgActivityId,
      cookie,
    });

  assert.equal(response.status, 404);
});

test("unsupported MIME type is rejected", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const response =
    await uploadEvidence({
      activityId: assignedActivityId,
      cookie,
      buffer: Buffer.from("plain text"),
      mimeType: "text/plain",
      filename: "bad.txt",
    });

  assert.equal(response.status, 400);
});

test("MIME/content mismatch is rejected", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const response =
    await uploadEvidence({
      activityId: assignedActivityId,
      cookie,
      buffer: Buffer.from("this is not a PDF"),
      mimeType: "application/pdf",
      filename: "fake.pdf",
    });

  assert.equal(response.status, 400);

  const body =
    await response.json();

  assert.match(
    body.message,
    /content does not match/i
  );
});

test("unexpected multipart field is rejected", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const response =
    await uploadEvidence({
      activityId: assignedActivityId,
      cookie,
      fieldName: "wrongField",
    });

  assert.equal(response.status, 400);
});

test("missing evidence file is rejected", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const form =
    new FormData();

  const response =
    await fetch(
      `${baseUrl}/api/evidence/activity/${assignedActivityId}`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
        body: form,
      }
    );

  assert.equal(response.status, 400);
});

test("evidence can be listed for a same-organization activity", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const response =
    await fetch(
      `${baseUrl}/api/evidence/activity/${assignedActivityId}`,
      {
        headers: {
          Cookie: cookie,
        },
      }
    );

  assert.equal(response.status, 200);

  const body =
    await response.json();

  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 1);
});

test("cross-organization activity evidence list is rejected", async () => {
  const cookie =
    await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

  const response =
    await fetch(
      `${baseUrl}/api/evidence/activity/${crossOrgActivityId}`,
      {
        headers: {
          Cookie: cookie,
        },
      }
    );

  assert.equal(response.status, 404);
});

test("same-organization evidence can be retrieved", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const [rows] =
    await pool.execute(
      `
        SELECT id
        FROM evidence
        WHERE activity_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [assignedActivityId]
    );

  assert.equal(rows.length, 1);

  const evidenceId =
    rows[0].id;

  const response =
    await fetch(
      `${baseUrl}/api/evidence/${evidenceId}`,
      {
        headers: {
          Cookie: cookie,
        },
      }
    );

  assert.equal(response.status, 200);

  const body =
    await response.json();

  assert.equal(body.success, true);
  assert.equal(
    Number(body.data.id),
    Number(evidenceId)
  );
});

test("cross-organization evidence retrieval is rejected", async () => {
  const ownerCookie =
    await createAuthCookie(
      CROSS_ORG_OWNER_ID,
      CROSS_ORG_ORGANIZATION_ID,
      "OWNER"
    );

  const uploadResponse =
    await uploadEvidence({
      activityId: crossOrgActivityId,
      cookie: ownerCookie,
    });

  assert.equal(uploadResponse.status, 201);

  const uploadBody =
    await uploadResponse.json();

  const crossOrgEvidenceId =
    uploadBody.data.id;

  createdEvidenceIds.push(
    crossOrgEvidenceId
  );

  const otherOrgCookie =
    await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

  const response =
    await fetch(
      `${baseUrl}/api/evidence/${crossOrgEvidenceId}`,
      {
        headers: {
          Cookie: otherOrgCookie,
        },
      }
    );

  assert.equal(response.status, 404);
});

test("cross-organization evidence verification is rejected", async () => {
  const ownerCookie =
    await createAuthCookie(
      CROSS_ORG_OWNER_ID,
      CROSS_ORG_ORGANIZATION_ID,
      "OWNER"
    );

  const uploadResponse =
    await uploadEvidence({
      activityId: crossOrgActivityId,
      cookie: ownerCookie,
    });

  assert.equal(uploadResponse.status, 201);

  const uploadBody =
    await uploadResponse.json();

  const crossOrgEvidenceId =
    uploadBody.data.id;

  createdEvidenceIds.push(
    crossOrgEvidenceId
  );

  const otherOrgCookie =
    await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

  const response =
    await fetch(
      `${baseUrl}/api/evidence/${crossOrgEvidenceId}/verify`,
      {
        method: "PATCH",
        headers: {
          Cookie: otherOrgCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verificationStatus: "VERIFIED",
        }),
      }
    );

  assert.equal(response.status, 404);
});

test("invalid verification status is rejected", async () => {
  const cookie =
    await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

  const [rows] =
    await pool.execute(
      `
        SELECT id
        FROM evidence
        WHERE activity_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [assignedActivityId]
    );

  assert.equal(rows.length, 1);

  const response =
    await fetch(
      `${baseUrl}/api/evidence/${rows[0].id}/verify`,
      {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verificationStatus: "APPROVED",
        }),
      }
    );

  assert.equal(response.status, 400);
});

test("owner can verify evidence and verification state is persisted", async () => {
  const cookie =
    await createAuthCookie(
      OWNER_ID,
      ORGANIZATION_ID,
      "OWNER"
    );

  const [rows] =
    await pool.execute(
      `
        SELECT id
        FROM evidence
        WHERE activity_id = ?
          AND verification_status = 'PENDING'
        ORDER BY id DESC
        LIMIT 1
      `,
      [assignedActivityId]
    );

  assert.equal(rows.length, 1);

  const evidenceId =
    rows[0].id;

  const response =
    await fetch(
      `${baseUrl}/api/evidence/${evidenceId}/verify`,
      {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verificationStatus: "VERIFIED",
          verificationNotes:
            "Evidence integration test verification.",
        }),
      }
    );

  assert.equal(response.status, 200);

  const body =
    await response.json();

  assert.equal(body.success, true);
  assert.equal(
    body.data.verification_status,
    "VERIFIED"
  );

  assert.equal(
    body.data.verification_notes,
    "Evidence integration test verification."
  );
});

test("field worker cannot verify evidence without review permission", async () => {
  const cookie =
    await createAuthCookie(
      FIELD_WORKER_ID,
      ORGANIZATION_ID,
      "FIELD_WORKER"
    );

  const [rows] =
    await pool.execute(
      `
        SELECT id
        FROM evidence
        WHERE activity_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [assignedActivityId]
    );

  assert.equal(rows.length, 1);

  const response =
    await fetch(
      `${baseUrl}/api/evidence/${rows[0].id}/verify`,
      {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verificationStatus: "REJECTED",
        }),
      }
    );

  assert.equal(response.status, 403);
});

test("evidence creation creates an audit event", async () => {
  const [rows] =
    await pool.execute(
      `
        SELECT id
        FROM evidence
        WHERE activity_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [assignedActivityId]
    );

  assert.equal(rows.length, 1);

  const evidenceId =
    rows[0].id;

  const [auditRows] =
    await pool.execute(
      `
        SELECT action, entity_type, entity_id
        FROM audit_events
        WHERE organization_id = ?
          AND entity_type = 'EVIDENCE'
          AND entity_id = ?
          AND action = 'EVIDENCE_CREATED'
      `,
      [
        ORGANIZATION_ID,
        evidenceId,
      ]
    );

  assert.equal(
    auditRows.length,
    1
  );

  assert.equal(
    auditRows[0].action,
    "EVIDENCE_CREATED"
  );

  assert.equal(
    auditRows[0].entity_type,
    "EVIDENCE"
  );

  assert.equal(
    Number(auditRows[0].entity_id),
    Number(evidenceId)
  );
});

test("evidence upload creates manager notification", async () => {
  const [rows] =
    await pool.execute(
      `
        SELECT id
        FROM evidence
        WHERE activity_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [assignedActivityId]
    );

  assert.equal(rows.length, 1);

  const evidenceId =
    rows[0].id;

  const [notificationRows] =
    await pool.execute(
      `
        SELECT
          id,
          user_id,
          type,
          entity_type,
          entity_id
        FROM notifications
        WHERE organization_id = ?
          AND type = 'EVIDENCE_UPLOADED'
          AND entity_type = 'EVIDENCE'
          AND entity_id = ?
      `,
      [
        ORGANIZATION_ID,
        evidenceId,
      ]
    );

  assert.ok(
    notificationRows.length >= 1,
    "Evidence upload must notify at least one manager"
  );

  for (const row of notificationRows) {
    assert.equal(
      row.type,
      "EVIDENCE_UPLOADED"
    );

    assert.equal(
      row.entity_type,
      "EVIDENCE"
    );

    assert.equal(
      Number(row.entity_id),
      Number(evidenceId)
    );
  }
});
