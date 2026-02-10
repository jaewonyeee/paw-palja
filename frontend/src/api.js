const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  checkId: (id) => request(`/auth/check-id/${id}`),
  getUser: (id) => request(`/user/${id}`),

  generateDiary: (userId, logs) =>
    request(`/diary/generate/${userId}`, { method: 'POST', body: JSON.stringify(logs) }),
  listDiaries: (userId) => request(`/diary/list/${userId}`),
  getDiary: (userId, entryId) => request(`/diary/entry/${userId}/${entryId}`),
  editDiary: (userId, entryId, data) =>
    request(`/diary/edit/${userId}/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDiary: (userId, entryId) =>
    request(`/diary/${userId}/${entryId}`, { method: 'DELETE' }),

  generateComments: (data) =>
    request('/comments/generate', { method: 'POST', body: JSON.stringify(data) }),

  streamComments: (userId, entryId, onComment, onDone, mode = 'new') => {
    const es = new EventSource(`${BASE}/comments/stream/${userId}/${entryId}?mode=${mode}`);
    es.onmessage = (event) => {
      if (event.data === '[DONE]') {
        es.close();
        onDone?.();
        return;
      }
      try {
        const comment = JSON.parse(event.data);
        onComment(comment);
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      es.close();
      onDone?.();
    };
    return es;
  },

  nearbyHospitals: (lat, lng) => request(`/hospitals/nearby?lat=${lat}&lng=${lng}`),

  adminStats: () => request('/admin/stats', { headers: { 'x-user-id': 'admin' } }),
  adminSystem: () => request('/admin/system', { headers: { 'x-user-id': 'admin' } }),

  analyze: (data) => request('/analyze', { method: 'POST', body: JSON.stringify(data) }),
};
