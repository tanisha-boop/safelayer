const dashboardRepository = require("../repositories/dashboardRepository");

async function getOverview(organizationId) {
  const data = await dashboardRepository.getOverview(organizationId);

  const riskExposure =
    Number(data.transactions.review_amount || 0);

  return {
    activities: {
      total: Number(data.activities.total || 0),
      active: Number(data.activities.active || 0),
      pending: Number(data.activities.pending || 0),
      inProgress: Number(data.activities.in_progress || 0),
      completed: Number(data.activities.completed || 0),
      cancelled: Number(data.activities.cancelled || 0),
    },

    evidence: {
      total: Number(data.evidence.total || 0),
      verified: Number(data.evidence.verified || 0),
      pending: Number(data.evidence.pending || 0),
      rejected: Number(data.evidence.rejected || 0),
    },

    reviews: {
      total: Number(data.reviews.total || 0),
      open: Number(data.reviews.open_reviews || 0),
      highRiskOpen: Number(data.reviews.high_risk_open || 0),
      escalated: Number(data.reviews.escalated || 0),
    },

    invoices: {
      total: Number(data.invoices.total || 0),
      verified: Number(data.invoices.verified || 0),
      requiresReview: Number(data.invoices.requires_review || 0),
      rejected: Number(data.invoices.rejected || 0),
    },

    transactions: {
      total: Number(data.transactions.total || 0),
      confirmed: Number(data.transactions.confirmed || 0),
      confirmedAmount: Number(data.transactions.confirmed_amount || 0),
      requiresReview: Number(data.transactions.requires_review || 0),
      reviewAmount: riskExposure,
      voided: Number(data.transactions.voided || 0),
    },

    risk: {
      total: Number(data.risk.total || 0),
      low: Number(data.risk.low || 0),
      medium: Number(data.risk.medium || 0),
      high: Number(data.risk.high || 0),
      critical: Number(data.risk.critical || 0),
      requiresReview: Number(data.risk.requires_review || 0),
      averageTrustScore: Number(
        Number(data.risk.average_trust_score || 0).toFixed(2)
      ),
      exposure: riskExposure,
    },

    recentEvents: data.recentEvents.map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entity_type,
      entityId: event.entity_id,
      createdAt: event.created_at,
      actorName:
        [event.first_name, event.last_name]
          .filter(Boolean)
          .join(" ") || "System",
    })),
  };
}

module.exports = {
  getOverview,
};
