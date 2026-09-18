// In production on Vercel, leave VITE_API_URL empty and use vercel.json rewrite → Render.
// Set VITE_API_URL only if the browser calls the API host directly (no proxy).
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

export async function apiRaw(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export { API_BASE, apiUrl };
