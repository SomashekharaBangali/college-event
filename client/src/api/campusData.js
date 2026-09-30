import { apiRequest } from './http.js';

export function getCampusData() {
  return apiRequest('/data');
}

export async function createCampusRecord(sheet, values) {
  const result = await apiRequest(`/data/${sheet}`, { method: 'POST', body: values });
  return result.record;
}

export async function updateCampusRecord(sheet, id, values) {
  const result = await apiRequest(`/data/${sheet}/${id}`, { method: 'PATCH', body: values });
  return result.record;
}

export function deleteCampusRecord(sheet, id) {
  return apiRequest(`/data/${sheet}/${id}`, { method: 'DELETE' });
}

export async function requestClubMembership(clubId) {
  const result = await apiRequest(`/data/clubs/${clubId}/join`, { method: 'POST', body: {} });
  return result.record;
}

export function bookCampusEvent(eventId, guests) {
  return apiRequest(`/data/events/${eventId}/book`, { method: 'POST', body: { guests } });
}