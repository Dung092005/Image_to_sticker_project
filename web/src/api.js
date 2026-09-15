// Small fetch helpers — always send cookies so session works through the Vite proxy.
export async function api(path, options = {}) {
  const response = await fetch(path, {
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
  const response = await fetch(path, {
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
