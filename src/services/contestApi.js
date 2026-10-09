const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function handleResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.ok && data?.success !== false) {
    return data;
  }
  const error = new Error(data?.message || 'API Error');
  error.status = response.status;
  throw error;
}

export async function getContests(params = {}, token) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.platform && params.platform !== 'All') query.append('platform', params.platform);

  const url = `${API_BASE_URL}/api/contests${query.toString() ? `?${query.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return handleResponse(response);
}

export async function getContest(id, token) {
  const response = await fetch(`${API_BASE_URL}/api/contests/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return handleResponse(response);
}
