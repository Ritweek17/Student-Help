const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class AdminIngestionApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'AdminIngestionApiError';
    this.status = status;
  }
}

async function handleResponse(response, defaultErrorMessage) {
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.ok && data?.success !== false) {
    return data;
  }

  const status = response.status;
  let message = data?.message;

  if (status === 401) {
    message = 'Your session has expired. Please sign in again.';
  } else if (status === 403) {
    message = data?.message || 'Access denied. Administrator privileges required.';
  }

  throw new AdminIngestionApiError(message || defaultErrorMessage || 'An error occurred.', status);
}

export async function getSources(token, signal) {
  const url = `${API_BASE_URL}/api/admin/sources`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal,
  });
  return await handleResponse(response, 'Failed to fetch sources.');
}

export async function updateSource(id, payload, token, signal) {
  const url = `${API_BASE_URL}/api/admin/sources/${id}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });
  return await handleResponse(response, 'Failed to update source.');
}

export async function getIngestionRuns(params = {}, token, signal) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) queryParams.append(key, value);
  });

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/api/admin/ingestion-runs${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal,
  });
  return await handleResponse(response, 'Failed to fetch ingestion runs.');
}

export async function getIngestionRunById(id, token, signal) {
  const url = `${API_BASE_URL}/api/admin/ingestion-runs/${id}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal,
  });
  return await handleResponse(response, 'Failed to fetch run details.');
}

export async function bulkCurateOpportunities(action, ids, token, signal) {
  const url = `${API_BASE_URL}/api/admin/opportunities/bulk`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ids }),
    signal,
  });
  return await handleResponse(response, 'Failed to execute bulk action.');
}
