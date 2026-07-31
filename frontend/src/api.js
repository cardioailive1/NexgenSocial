const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function authHeaders() {
  const token = localStorage.getItem("ngs_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (path) => fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } }).then(handle),

  post: (path, body) =>
    fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body || {}),
    }).then(handle),

  patch: (path, body) =>
    fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body || {}),
    }).then(handle),

  // Was missing entirely -- the interests endpoint on the backend is a PUT
  // (it replaces the whole set rather than patching it), so saving a profile
  // threw "api.put is not a function" before this existed.
  put: (path, body) =>
    fetch(`${API_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body || {}),
    }).then(handle),

  delete: (path) =>
    fetch(`${API_URL}${path}`, { method: "DELETE", headers: { ...authHeaders() } }).then(handle),

  upload: (path, formData) =>
    fetch(`${API_URL}${path}`, { method: "POST", headers: { ...authHeaders() }, body: formData }).then(handle),

  mediaUrl: (relativeUrl) => (relativeUrl?.startsWith("/") ? `${API_URL}${relativeUrl}` : relativeUrl),
};

export { API_URL };

export function wsSignalingUrl() {
  return API_URL.replace(/^http/, "ws") + "/ws/live";
}
