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
};
