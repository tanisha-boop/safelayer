const reportsRepository = require("../repositories/reportsRepository");

function percentage(value, total) {
  if (!total) {
    return 0;
  }

  return Number(((Number(value || 0) / Number(total)) * 100).toFixed(1));
}

async function getOverview(organizationId) {
  const data = await reportsRepository.getOverview(organizationId);

  const activities = data.activities;
  const evidence = data.evidence;
  const reviews = data.reviews;
  const invoices = data.invoices;
  const transactions = data.transactions;
  const risk = data.risk;

  return {
    activities: {
      total: Number(activities.total || 0),
      pending: Number(activities.pending || 0),
      inProgress: Number(activities.in_progress || 0),
      completed: Number(activities.completed || 0),
      cancelled: Number(activities.cancelled || 0),
      completionRate: percentage(activities.completed, activities.total),
    },

    evidence: {
      total: Number(evidence.total || 0),
      verified: Number(evidence.verified || 0),
      pending: Number(evidence.pending || 0),
      rejected: Number(evidence.rejected || 0),
      verificationRate: percentage(evidence.verified, evidence.total),
    },

    reviews: {
      total: Number(reviews.total || 0),
      open: Number(reviews.open_reviews || 0),
      inReview: Number(reviews.in_review || 0),
      approved: Number(reviews.approved || 0),
      rejected: Number(reviews.rejected || 0),
      escalated: Number(reviews.escalated || 0),
      resolved: Number(reviews.resolved || 0),
      highCritical: Number(reviews.high_critical || 0),
    },

    invoices: {
      total: Number(invoices.total || 0),
      verified: Number(invoices.verified || 0),
      requiresReview: Number(invoices.requires_review || 0),
      rejected: Number(invoices.rejected || 0),
      paid: Number(invoices.paid || 0),
    },

    transactions: {
      total: Number(transactions.total || 0),
      confirmed: Number(transactions.confirmed || 0),
      requiresReview: Number(transactions.requires_review || 0),
      voided: Number(transactions.voided || 0),
      confirmedAmount: Number(transactions.confirmed_amount || 0),
      reviewAmount: Number(transactions.review_amount || 0),
    },

    risk: {
      total: Number(risk.total || 0),
      low: Number(risk.low || 0),
      medium: Number(risk.medium || 0),
      high: Number(risk.high || 0),
      critical: Number(risk.critical || 0),
      requiresReview: Number(risk.requires_review || 0),
      averageTrustScore: Number(
        Number(risk.average_trust_score || 0).toFixed(2)
      ),
    },

    trend: data.trend.map((item) => ({
      date: item.report_date,
      total: Number(item.total || 0),
      completed: Number(item.completed || 0),
    })),
  };
}

module.exports = {
  getOverview,
};
