const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.message
        ? data.message
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export const api = {
  getDashboardOverview: () => request("/dashboard/overview"),
  getReportsOverview: () => request("/reports/overview"),
  search: (query) => {
    const params = new URLSearchParams({ q: query });
    return request(`/search?${params.toString()}`);
  },


  getMe: () => request("/auth/me"),

  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request("/auth/logout", {
      method: "POST",
    }),

  getActivities: () => request("/activities"),

  getUsers: () => request("/users"),

  getEvidenceForActivity: (activityId) => request("/evidence/activity/" + activityId),

  getEvidence: (id) => request("/evidence/" + id),

  uploadEvidence: (activityId, file) => {
    const formData = new FormData();
    formData.append("evidence", file);
    return request("/evidence/activity/" + activityId, {
      method: "POST",
      body: formData,
    });
  },

  verifyEvidence: (id, verificationStatus, verificationNotes = "") =>
    request("/evidence/" + id + "/verify", {
      method: "PATCH",
      body: JSON.stringify({ verificationStatus, verificationNotes }),
    }),

  getRouteProof: (activityId) =>
    request("/route-proof/activity/" + activityId),

  routeProofCheckIn: (activityId, location) =>
    request("/route-proof/activity/" + activityId + "/check-in", {
      method: "POST",
      body: JSON.stringify(location),
    }),

  routeProofGps: (activityId, location) =>
    request("/route-proof/activity/" + activityId + "/gps", {
      method: "POST",
      body: JSON.stringify(location),
    }),

  routeProofCheckOut: (activityId, location) =>
    request("/route-proof/activity/" + activityId + "/check-out", {
      method: "POST",
      body: JSON.stringify(location),
    }),

  createActivity: (activity) =>
    request("/activities", {
      method: "POST",
      body: JSON.stringify(activity),
    }),

  startActivity: (id) =>
    request(`/activities/${id}/start`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  completeActivity: (id, location = {}) =>
    request(`/activities/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(location),
    }),

  cancelActivity: (id) =>
    request(`/activities/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getCollections: (status, collectorId) => {
    const params = new URLSearchParams();

    if (status) {
      params.set("status", status);
    }

    if (collectorId) {
      params.set("collectorId", collectorId);
    }

    const query = params.toString();

    return request(`/field-ledger/collections${query ? `?${query}` : ""}`);
  },

  getCollection: (id) =>
    request(`/field-ledger/collections/${id}`),

  createCollection: (collection) =>
    request("/field-ledger/collections", {
      method: "POST",
      body: JSON.stringify(collection),
    }),

  collectPayment: (id, payment) =>
    request(`/field-ledger/collections/${id}/collect`, {
      method: "PATCH",
      body: JSON.stringify(payment),
    }),

  createRemittance: (remittance) =>
    request("/field-ledger/remittances", {
      method: "POST",
      body: JSON.stringify(remittance),
    }),

  getRemittances: () => request("/field-ledger/remittances"),

  getRemittance: (id) =>
    request(`/field-ledger/remittances/${id}`),

  addRemittanceItem: (id, item) =>
    request(`/field-ledger/remittances/${id}/items`, {
      method: "POST",
      body: JSON.stringify(item),
    }),

  verifyRemittance: (id) =>
    request(`/field-ledger/remittances/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getInvoices: (status, vendorName) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (vendorName) params.set("vendorName", vendorName);
    const query = params.toString();
    return request(`/invoices${query ? `?${query}` : ""}`);
  },

  getInvoice: (id) =>
    request(`/invoices/${id}`),

  createInvoice: (invoice) =>
    request("/invoices", {
      method: "POST",
      body: JSON.stringify(invoice),
    }),

  verifyInvoice: (id) =>
    request(`/invoices/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  reviewInvoice: (id, decision, resolution = "") =>
    request(`/invoices/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, resolution }),
    }),

  getNotifications: (page = 1, limit = 20) =>
    request(`/notifications?page=${page}&limit=${limit}`),

  getUnreadNotificationCount: () =>
    request("/notifications/unread-count"),

  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, {
      method: "PATCH",
      body: JSON.stringify({}),
    }),

  markAllNotificationsRead: () =>
    request("/notifications/read-all", {
      method: "PATCH",
      body: JSON.stringify({}),
    }),

  getReviews: (filters = {}) => {
    const params = new URLSearchParams();

    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.page) params.set("page", filters.page);
    if (filters.limit) params.set("limit", filters.limit);

    const query = params.toString();

    return request(`/reviews${query ? `?${query}` : ""}`);
  },

  getReview: (id) =>
    request(`/reviews/${id}`),

  updateReview: (id, changes) =>
    request(`/reviews/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),

  getTrustAssessment: (activityId) =>
    request(`/trust/activity/${activityId}`),

  assessTrust: (activityId) =>
    request(`/trust/activity/${activityId}/assess`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
