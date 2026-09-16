const pool = require("../config/database");

async function getOverview(organizationId) {
  const [
    [activityRows],
    [evidenceRows],
    [reviewRows],
    [invoiceRows],
    [transactionRows],
    [riskRows],
    [trendRows],
  ] = await Promise.all([
    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(status = "PENDING") AS pending,
          SUM(status = "IN_PROGRESS") AS in_progress,
          SUM(status = "COMPLETED") AS completed,
          SUM(status = "CANCELLED") AS cancelled
       FROM field_activities
       WHERE organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(e.verification_status = "VERIFIED") AS verified,
          SUM(e.verification_status = "PENDING") AS pending,
          SUM(e.verification_status = "REJECTED") AS rejected
       FROM evidence e
       INNER JOIN field_activities fa
         ON fa.id = e.activity_id
       WHERE fa.organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(status = "OPEN") AS open_reviews,
          SUM(status = "IN_REVIEW") AS in_review,
          SUM(status = "APPROVED") AS approved,
          SUM(status = "REJECTED") AS rejected,
          SUM(status = "ESCALATED") AS escalated,
          SUM(status = "RESOLVED") AS resolved,
          SUM(priority IN ("HIGH", "CRITICAL")) AS high_critical
       FROM reviews
       WHERE organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(status = "VERIFIED") AS verified,
          SUM(status = "REQUIRES_REVIEW") AS requires_review,
          SUM(status = "REJECTED") AS rejected,
          SUM(status = "PAID") AS paid
       FROM invoices
       WHERE organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(status = "CONFIRMED") AS confirmed,
          SUM(status = "REQUIRES_REVIEW") AS requires_review,
          SUM(status = "VOIDED") AS voided,
          COALESCE(
            SUM(CASE WHEN status = "CONFIRMED" THEN amount ELSE 0 END),
            0
          ) AS confirmed_amount,
          COALESCE(
            SUM(CASE WHEN status = "REQUIRES_REVIEW" THEN amount ELSE 0 END),
            0
          ) AS review_amount
       FROM transactions
       WHERE organization_id = ?`,
      [organizationId]
    ),

    pool.execute(
      `SELECT
          COUNT(*) AS total,
          SUM(current_risk.risk_level = "LOW") AS low,
          SUM(current_risk.risk_level = "MEDIUM") AS medium,
          SUM(current_risk.risk_level = "HIGH") AS high,
          SUM(current_risk.risk_level = "CRITICAL") AS critical,
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
         WHERE ra.assessment_type = "ACTIVITY"
           AND fa.organization_id = ?
           AND ra.id = (
             SELECT MAX(ra2.id)
             FROM risk_assessments ra2
             WHERE ra2.activity_id = ra.activity_id
               AND ra2.assessment_type = "ACTIVITY"
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
         WHERE ra.assessment_type = "INVOICE"
           AND ra.invoice_id IS NOT NULL
           AND i.organization_id = ?
           AND ra.id = (
             SELECT MAX(ra2.id)
             FROM risk_assessments ra2
             WHERE ra2.invoice_id = ra.invoice_id
               AND ra2.assessment_type = "INVOICE"
           )
       ) AS current_risk`,
      [organizationId, organizationId]
    ),

    pool.execute(
      `SELECT
          DATE(created_at) AS report_date,
          COUNT(*) AS total,
          SUM(status = "COMPLETED") AS completed
       FROM field_activities
       WHERE organization_id = ?
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at)
       ORDER BY report_date ASC`,
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
    trend: trendRows,
  };
}

module.exports = {
  getOverview,
};
