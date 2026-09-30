const sessionKey = 'campus-connect.session-token';

export function getSessionToken() {
  return window.localStorage.getItem(sessionKey);
}

export function saveSessionToken(token) {
  window.localStorage.setItem(sessionKey, token);
}

export function clearSessionToken() {
  window.localStorage.removeItem(sessionKey);
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error('Campus Connect server is not reachable. Start the project with npm run dev.');
  }

  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) clearSessionToken();
    throw new Error(result?.message || 'The request could not be completed.');
  }
  return result;
}