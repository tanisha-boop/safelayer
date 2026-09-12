const pool = require("../config/database");

async function findReviews({
  organizationId,
  status,
  priority,
  entityType,
  page,
  limit,
}) {
  const offset = (page - 1) * limit;

  const conditions = ["r.organization_id = ?"];
  const params = [organizationId];

  if (status) {
    conditions.push("r.status = ?");
    params.push(status);
  }

  if (priority) {
    conditions.push("r.priority = ?");
    params.push(priority);
  }

  if (entityType === "ACTIVITY") {
    conditions.push(
      "r.activity_id IS NOT NULL AND r.invoice_id IS NULL AND r.transaction_id IS NULL"
    );
  }

  if (entityType === "INVOICE") {
    conditions.push(
      "r.invoice_id IS NOT NULL AND r.activity_id IS NULL AND r.transaction_id IS NULL"
    );
  }

  if (entityType === "TRANSACTION") {
    conditions.push(
      "r.transaction_id IS NOT NULL AND r.activity_id IS NULL AND r.invoice_id IS NULL"
    );
  }

  const whereClause = conditions.join(" AND ");

  const [rows] = await pool.execute(
    `
      SELECT
        r.id,
        r.organization_id,
        r.activity_id,
        r.transaction_id,
        r.invoice_id,
        r.risk_assessment_id,
        r.assigned_to,
        r.status,
        r.priority,
        r.reason,
        r.resolution,
        r.created_at,
        r.resolved_at,

        assignee.first_name AS assignee_first_name,
        assignee.last_name AS assignee_last_name,
        assignee.email AS assignee_email,

        fa.title AS activity_title,
        fa.activity_type,
        fa.status AS activity_status,

        i.vendor_name,
        i.invoice_number,
        i.amount AS invoice_amount,
        i.status AS invoice_status,

        t.transaction_reference,
        t.amount AS transaction_amount,
        t.transaction_type,
        t.status AS transaction_status

      FROM reviews r

      LEFT JOIN users assignee
        ON assignee.id = r.assigned_to

      LEFT JOIN field_activities fa
        ON fa.id = r.activity_id

      LEFT JOIN invoices i
        ON i.id = r.invoice_id

      LEFT JOIN transactions t
        ON t.id = r.transaction_id

      WHERE ${whereClause}

      ORDER BY
        CASE r.priority
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END,
        r.created_at DESC

      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [countRows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM reviews r
      WHERE ${whereClause}
    `,
    params
  );

  return {
    rows,
    total: Number(countRows[0].total),
  };
}

async function findById(
  organizationId,
  reviewId,
  connection = pool
) {
  const [rows] = await connection.execute(
    `
      SELECT
        r.id,
        r.organization_id,
        r.activity_id,
        r.transaction_id,
        r.invoice_id,
        r.risk_assessment_id,
        r.assigned_to,
        r.status,
        r.priority,
        r.reason,
        r.resolution,
        r.created_at,
        r.resolved_at,

        assignee.first_name AS assignee_first_name,
        assignee.last_name AS assignee_last_name,
        assignee.email AS assignee_email,

        fa.title AS activity_title,
        fa.activity_type,
        fa.status AS activity_status,

        i.vendor_name,
        i.invoice_number,
        i.amount AS invoice_amount,
        i.status AS invoice_status,

        t.transaction_reference,
        t.amount AS transaction_amount,
        t.transaction_type,
        t.status AS transaction_status

      FROM reviews r

      LEFT JOIN users assignee
        ON assignee.id = r.assigned_to

      LEFT JOIN field_activities fa
        ON fa.id = r.activity_id

      LEFT JOIN invoices i
        ON i.id = r.invoice_id

      LEFT JOIN transactions t
        ON t.id = r.transaction_id

      WHERE r.organization_id = ?
        AND r.id = ?
      LIMIT 1
    `,
    [organizationId, reviewId]
  );

  return rows[0] || null;
}


async function findOpenReviewByEntity({
  organizationId,
  activityId,
  invoiceId,
  transactionId,
  connection = pool,
}) {
  const entityIds = [
    activityId,
    invoiceId,
    transactionId,
  ].filter(
    (value) => value !== undefined && value !== null
  );

  if (entityIds.length !== 1) {
    throw new Error(
      "Exactly one review entity must be supplied."
    );
  }

  const conditions = [
    "organization_id = ?",
    "status IN ('OPEN', 'IN_REVIEW')",
  ];

  const values = [organizationId];

  if (activityId !== undefined && activityId !== null) {
    conditions.push("activity_id = ?");
    values.push(activityId);
  }

  if (invoiceId !== undefined && invoiceId !== null) {
    conditions.push("invoice_id = ?");
    values.push(invoiceId);
  }

  if (
    transactionId !== undefined &&
    transactionId !== null
  ) {
    conditions.push("transaction_id = ?");
    values.push(transactionId);
  }

  const [rows] = await connection.execute(
    `
      SELECT
        r.id,
        r.organization_id,
        r.activity_id,
        r.transaction_id,
        r.invoice_id,
        r.risk_assessment_id,
        r.assigned_to,
        r.status,
        r.priority,
        r.reason,
        r.resolution,
        r.created_at,
        r.resolved_at
      FROM reviews r
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.created_at DESC
      LIMIT 1
    `,
    values
  );

  return rows[0] || null;
}

async function updateReview({
  organizationId,
  reviewId,
  status,
  assignedTo,
  resolution,
  connection = pool,
}) {
  const fields = [];
  const values = [];

  if (status !== undefined) {
    fields.push("status = ?");
    values.push(status);
  }

  if (assignedTo !== undefined) {
    fields.push("assigned_to = ?");
    values.push(assignedTo);
  }

  if (resolution !== undefined) {
    fields.push("resolution = ?");
    values.push(resolution);
  }

  if (
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "ESCALATED" ||
    status === "RESOLVED"
  ) {
    fields.push("resolved_at = NOW()");
  }

  if (!fields.length) {
    return 0;
  }

  values.push(organizationId, reviewId);

  const [result] = await connection.execute(
    `
      UPDATE reviews
      SET ${fields.join(", ")}
      WHERE organization_id = ?
        AND id = ?
        AND status IN ('OPEN', 'IN_REVIEW')
    `,
    values
  );

  return result.affectedRows;
}

module.exports = {
  findReviews,
  findById,
  findOpenReviewByEntity,
  updateReview,
};
