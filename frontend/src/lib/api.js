const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let result = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const error = new Error(
      result?.message || `Request failed with status ${response.status}`
    );

    error.status = response.status;
    error.data = result;

    throw error;
  }

  return result;
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request("/auth/logout", {
    method: "POST",
  });
}

export function getCurrentUser() {
  return request("/auth/me");
}

export function getActivities() {
  return request("/activities");
}

export function createActivity(data) {
  return request("/activities", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateActivity(id, data) {
  return request(`/activities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function startActivity(id) {
  return request(`/activities/${id}/start`, {
    method: "POST",
  });
}

export function completeActivity(id, data = {}) {
  return request(`/activities/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cancelActivity(id) {
  return request(`/activities/${id}/cancel`, {
    method: "POST",
  });
}
