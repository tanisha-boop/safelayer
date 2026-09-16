const searchRepository = require("../repositories/searchRepository");

const MAX_RESULTS_PER_TYPE = 5;

async function search({ organizationId, query, permissions = [] }) {
  const term = query.trim();

  if (!term) {
    return {
      query: "",
      total: 0,
      results: [],
    };
  }

  const permissionNames = new Set(
    permissions.map((permission) => permission.name)
  );

  const results = [];

  if (permissionNames.has("activities:read")) {
    const rows = await searchRepository.searchActivities(
      organizationId,
      term,
      MAX_RESULTS_PER_TYPE
    );

    results.push(
      ...rows.map((row) => ({
        type: "activity",
        id: row.id,
        title: row.title,
        subtitle: `${row.activity_type} • ${row.status}`,
        page: "field-operations",
        metadata: row,
      }))
    );
  }

  if (permissionNames.has("evidence:read")) {
    const rows = await searchRepository.searchEvidence(
      organizationId,
      term,
      MAX_RESULTS_PER_TYPE
    );

    results.push(
      ...rows.map((row) => ({
        type: "evidence",
        id: row.id,
        title: row.file_name,
        subtitle: `${row.evidence_type} • ${row.verification_status}`,
        page: "evidence",
        metadata: row,
      }))
    );
  }

  if (permissionNames.has("invoices:read")) {
    const rows = await searchRepository.searchInvoices(
      organizationId,
      term,
      MAX_RESULTS_PER_TYPE
    );

    results.push(
      ...rows.map((row) => ({
        type: "invoice",
        id: row.id,
        title: row.invoice_number,
        subtitle: `${row.vendor_name} • ${row.status}`,
        page: "invoice-guard",
        metadata: row,
      }))
    );
  }

  if (permissionNames.has("reviews:read")) {
    const rows = await searchRepository.searchReviews(
      organizationId,
      term,
      MAX_RESULTS_PER_TYPE
    );

    results.push(
      ...rows.map((row) => ({
        type: "review",
        id: row.id,
        title:
          row.activity_title ||
          row.invoice_number ||
          row.transaction_reference ||
          `Review #${row.id}`,
        subtitle: `${row.priority} • ${row.status}`,
        page: "reviews",
        metadata: row,
      }))
    );
  }

  if (permissionNames.has("transactions:read")) {
    const rows = await searchRepository.searchTransactions(
      organizationId,
      term,
      MAX_RESULTS_PER_TYPE
    );

    results.push(
      ...rows.map((row) => ({
        type: "transaction",
        id: row.id,
        title: row.transaction_reference,
        subtitle: `${row.transaction_type} • ${row.status}`,
        page: "risk-trust",
        metadata: row,
      }))
    );
  }

  if (permissionNames.has("activities:read")) {
    const rows = await searchRepository.searchRouteProof(
      organizationId,
      term,
      MAX_RESULTS_PER_TYPE
    );

    results.push(
      ...rows.map((row) => ({
        type: "route-proof",
        id: row.id,
        title:
          row.activity_title ||
          `RouteProof event #${row.id}`,
        subtitle: `${row.event_type} • ${row.first_name} ${row.last_name}`,
        page: "route-proof",
        metadata: row,
      }))
    );
  }

  return {
    query: term,
    total: results.length,
    results: results.slice(0, 30),
  };
}

module.exports = {
  search,
};
