import { apiRequest, clearSessionToken, saveSessionToken } from './http.js';

async function saveAuthResponse(path, payload) {
  const result = await apiRequest(path, { method: 'POST', body: payload });
  saveSessionToken(result.token);
  return result;
}

export function signup(payload) {
  return saveAuthResponse('/auth/signup', payload);
}

export function login(payload) {
  return saveAuthResponse('/auth/login', payload);
}

export function getCurrentUser() {
  return apiRequest('/auth/me');
}

export function signOut() {
  clearSessionToken();
}