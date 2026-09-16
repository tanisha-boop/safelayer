const pool = require("../config/database");

async function getOverview(organizationId) {
  const [
    [activityRows],
    [evidenceRows],
    [reviewRows],
    [invoiceRows],
    [transactionRows],
    [riskRows],
    [recentEvents],
  ] = await Promise.all([
    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(status IN ('PENDING', 'IN_PROGRESS')) AS active,
          SUM(status = 'PENDING') AS pending,
          SUM(status = 'IN_PROGRESS') AS in_progress,
          SUM(status = 'COMPLETED') AS completed,
          SUM(status = 'CANCELLED') AS cancelled
       FROM field_activities
       WHERE organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(verification_status = 'VERIFIED') AS verified,
          SUM(verification_status = 'PENDING') AS pending,
          SUM(verification_status = 'REJECTED') AS rejected
       FROM evidence e
       INNER JOIN field_activities fa
         ON fa.id = e.activity_id
       WHERE fa.organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(status IN ('OPEN', 'IN_REVIEW')) AS open_reviews,
          SUM(
            status IN ('OPEN', 'IN_REVIEW')
            AND priority IN ('HIGH', 'CRITICAL')
          ) AS high_risk_open,
          SUM(status = 'ESCALATED') AS escalated
       FROM reviews
       WHERE organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(status = 'VERIFIED') AS verified,
          SUM(status = 'REQUIRES_REVIEW') AS requires_review,
          SUM(status = 'REJECTED') AS rejected
       FROM invoices
       WHERE organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(status = 'CONFIRMED') AS confirmed,
          COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN amount ELSE 0 END), 0) AS confirmed_amount,
          SUM(status = 'REQUIRES_REVIEW') AS requires_review,
          COALESCE(SUM(CASE WHEN status = 'REQUIRES_REVIEW' THEN amount ELSE 0 END), 0) AS review_amount,
          SUM(status = 'VOIDED') AS voided
       FROM transactions
       WHERE organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(current_risk.risk_level = 'LOW') AS low,
          SUM(current_risk.risk_level = 'MEDIUM') AS medium,
          SUM(current_risk.risk_level = 'HIGH') AS high,
          SUM(current_risk.risk_level = 'CRITICAL') AS critical,
          SUM(current_risk.requires_review = 1) AS requires_review,
          COALESCE(AVG(current_risk.trust_score), 0) AS average_trust_score
       FROM (
         SELECT
           ra.id,
           ra.trust_score,
           ra.risk_level,
           ra.requires_review
         FROM risk_assessments ra
         INNER JOIN field_activities fa
           ON fa.id = ra.activity_id
         WHERE ra.assessment_type = 'ACTIVITY'
           AND fa.organization_id = ?
           AND ra.id = (
             SELECT MAX(ra2.id)
             FROM risk_assessments ra2
             WHERE ra2.activity_id = ra.activity_id
               AND ra2.assessment_type = 'ACTIVITY'
           )

         UNION ALL

         SELECT
           ra.id,
           ra.trust_score,
           ra.risk_level,
           ra.requires_review
         FROM risk_assessments ra
         INNER JOIN invoices i
           ON i.id = ra.invoice_id
         WHERE ra.assessment_type = 'INVOICE'
           AND ra.invoice_id IS NOT NULL
           AND i.organization_id = ?
           AND ra.id = (
             SELECT MAX(ra2.id)
             FROM risk_assessments ra2
             WHERE ra2.invoice_id = ra.invoice_id
               AND ra2.assessment_type = 'INVOICE'
           )
       ) AS current_risk`,
      [organizationId, organizationId]
    ),

    pool.execute(
      `SELECT
          ae.id,
          ae.action,
          ae.entity_type,
          ae.entity_id,
          ae.created_at,
          u.first_name,
          u.last_name
       FROM audit_events ae
       LEFT JOIN users u
         ON u.id = ae.actor_id
       WHERE ae.organization_id = ?
       ORDER BY ae.id DESC
       LIMIT 8`,
      [organizationId]
    ),
  ]);

  return {
    activities: activityRows[0],
    evidence: evidenceRows[0],
    reviews: reviewRows[0],
    invoices: invoiceRows[0],
    transactions: transactionRows[0],
    risk: riskRows[0],
    recentEvents,
  };
}

module.exports = {
  getOverview,
};
