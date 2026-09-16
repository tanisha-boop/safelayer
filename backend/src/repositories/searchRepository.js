const pool = require("../config/database");

async function searchActivities(organizationId, term, limit) {
  const like = `%${term}%`;

  const [rows] = await pool.execute(
    `
      SELECT
        fa.id,
        fa.title,
        fa.activity_type,
        fa.status,
        fa.scheduled_at,
        fa.created_at,
        u.first_name,
        u.last_name
      FROM field_activities fa
      INNER JOIN users u
        ON u.id = fa.assigned_to
      WHERE fa.organization_id = ?
        AND (
          fa.title LIKE ?
          OR fa.description LIKE ?
          OR fa.activity_type LIKE ?
          OR fa.status LIKE ?
          OR u.first_name LIKE ?
          OR u.last_name LIKE ?
          OR u.email LIKE ?
        )
      ORDER BY fa.created_at DESC
      LIMIT ?
    `,
    [
      organizationId,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      limit,
    ]
  );

  return rows;
}

async function searchEvidence(organizationId, term, limit) {
  const like = `%${term}%`;

  const [rows] = await pool.execute(
    `
      SELECT
        e.id,
        e.activity_id,
        e.evidence_type,
        e.file_name,
        e.verification_status,
        e.captured_at,
        e.created_at,
        fa.title AS activity_title
      FROM evidence e
      INNER JOIN field_activities fa
        ON fa.id = e.activity_id
      WHERE fa.organization_id = ?
        AND (
          e.file_name LIKE ?
          OR e.evidence_type LIKE ?
          OR e.verification_status LIKE ?
          OR e.verification_notes LIKE ?
          OR fa.title LIKE ?
        )
      ORDER BY e.created_at DESC
      LIMIT ?
    `,
    [
      organizationId,
      like,
      like,
      like,
      like,
      like,
      limit,
    ]
  );

  return rows;
}

async function searchInvoices(organizationId, term, limit) {
  const like = `%${term}%`;

  const [rows] = await pool.execute(
    `
      SELECT
        i.id,
        i.activity_id,
        i.vendor_name,
        i.invoice_number,
        i.amount,
        i.currency,
        i.status,
        i.invoice_date,
        i.due_date,
        i.created_at
      FROM invoices i
      WHERE i.organization_id = ?
        AND (
          i.vendor_name LIKE ?
          OR i.invoice_number LIKE ?
          OR i.status LIKE ?
          OR i.currency LIKE ?
        )
      ORDER BY i.created_at DESC
      LIMIT ?
    `,
    [
      organizationId,
      like,
      like,
      like,
      like,
      limit,
    ]
  );

  return rows;
}

async function searchReviews(organizationId, term, limit) {
  const like = `%${term}%`;

  const [rows] = await pool.execute(
    `
      SELECT
        r.id,
        r.activity_id,
        r.invoice_id,
        r.transaction_id,
        r.status,
        r.priority,
        r.reason,
        r.created_at,
        fa.title AS activity_title,
        i.vendor_name,
        i.invoice_number,
        t.transaction_reference
      FROM reviews r
      LEFT JOIN field_activities fa
        ON fa.id = r.activity_id
      LEFT JOIN invoices i
        ON i.id = r.invoice_id
      LEFT JOIN transactions t
        ON t.id = r.transaction_id
      WHERE r.organization_id = ?
        AND (
          r.status LIKE ?
          OR r.priority LIKE ?
          OR r.reason LIKE ?
          OR r.resolution LIKE ?
          OR fa.title LIKE ?
          OR i.vendor_name LIKE ?
          OR i.invoice_number LIKE ?
          OR t.transaction_reference LIKE ?
        )
      ORDER BY r.created_at DESC
      LIMIT ?
    `,
    [
      organizationId,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      limit,
    ]
  );

  return rows;
}

async function searchTransactions(organizationId, term, limit) {
  const like = `%${term}%`;

  const [rows] = await pool.execute(
    `
      SELECT
        t.id,
        t.activity_id,
        t.transaction_reference,
        t.transaction_type,
        t.amount,
        t.currency,
        t.status,
        t.transaction_date,
        t.created_at
      FROM transactions t
      WHERE t.organization_id = ?
        AND (
          t.transaction_reference LIKE ?
          OR t.transaction_type LIKE ?
          OR t.status LIKE ?
          OR t.currency LIKE ?
        )
      ORDER BY t.created_at DESC
      LIMIT ?
    `,
    [
      organizationId,
      like,
      like,
      like,
      like,
      limit,
    ]
  );

  return rows;
}

async function searchRouteProof(organizationId, term, limit) {
  const like = `%${term}%`;

  const [rows] = await pool.execute(
    `
      SELECT
        r.id,
        r.activity_id,
        r.user_id,
        r.event_type,
        r.latitude,
        r.longitude,
        r.accuracy_meters,
        r.recorded_at,
        a.title AS activity_title,
        u.first_name,
        u.last_name
      FROM route_proof_events r
      INNER JOIN field_activities a
        ON a.id = r.activity_id
      INNER JOIN users u
        ON u.id = r.user_id
      WHERE r.organization_id = ?
        AND (
          r.event_type LIKE ?
          OR a.title LIKE ?
          OR u.first_name LIKE ?
          OR u.last_name LIKE ?
          OR u.email LIKE ?
        )
      ORDER BY r.recorded_at DESC
      LIMIT ?
    `,
    [
      organizationId,
      like,
      like,
      like,
      like,
      like,
      limit,
    ]
  );

  return rows;
}

module.exports = {
  searchActivities,
  searchEvidence,
  searchInvoices,
  searchReviews,
  searchTransactions,
  searchRouteProof,
};
