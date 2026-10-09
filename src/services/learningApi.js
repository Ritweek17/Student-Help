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

export async function getLearningTracks(token) {
  const response = await fetch(`${API_BASE_URL}/api/learning/tracks`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await handleResponse(response);
  return data.data;
}

export async function getLearningTrackById(id, token) {
  const response = await fetch(`${API_BASE_URL}/api/learning/tracks/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await handleResponse(response);
  return data.data;
}

export async function getLearningItems(trackId, token) {
  const response = await fetch(`${API_BASE_URL}/api/learning/tracks/${trackId}/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await handleResponse(response);
  return data.data;
}

export async function getLearningResources(trackId, token) {
  const url = trackId 
    ? `${API_BASE_URL}/api/learning/resources?trackId=${trackId}`
    : `${API_BASE_URL}/api/learning/resources`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await handleResponse(response);
  return data.data;
}

export async function getRecommendedNext(token) {
  const response = await fetch(`${API_BASE_URL}/api/learning/recommended`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await handleResponse(response);
  return data.data;
}

export async function updateProgress(trackId, itemId, status, token) {
  const response = await fetch(`${API_BASE_URL}/api/learning/progress`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ trackId, itemId, status })
  });
  const data = await handleResponse(response);
  return data.data;
}
