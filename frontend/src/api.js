import { Capacitor } from '@capacitor/core';

// For native mobile builds, use the absolute server URL.
// Set VITE_API_BASE_URL in your .env or at build time for native targets.
// Web builds behind a reverse proxy can keep the default relative path.
const BASE = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_API_BASE_URL || 'https://pawpalja.com/api/v1')
  : (import.meta.env.VITE_API_BASE_URL || '/api/v1');

// --- Token helpers ---
function getAccessToken() {
  return localStorage.getItem('pawpalja_access_token');
}
function getRefreshToken() {
  return localStorage.getItem('pawpalja_refresh_token');
}
function setTokens(access, refresh) {
  localStorage.setItem('pawpalja_access_token', access);
  localStorage.setItem('pawpalja_refresh_token', refresh);
}
export function clearTokens() {
  localStorage.removeItem('pawpalja_access_token');
  localStorage.removeItem('pawpalja_refresh_token');
}

// --- Core request with auto-refresh ---
let _refreshPromise = null;

async function refreshTokens() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('No refresh token');
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

async function request(path, options = {}, _retry = true) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && _retry) {
    // Try refresh once
    try {
      if (!_refreshPromise) {
        _refreshPromise = refreshTokens();
      }
      await _refreshPromise;
      _refreshPromise = null;
      return request(path, options, false);
    } catch {
      _refreshPromise = null;
      clearTokens();
      window.dispatchEvent(new Event('auth:logout'));
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  // --- Auth (no token needed) ---
  signup: async (data) => {
    const result = await request('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
    setTokens(result.access_token, result.refresh_token);
    return result.user;
  },
  login: async (data) => {
    const result = await request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
    setTokens(result.access_token, result.refresh_token);
    return result.user;
  },
  checkId: (id) => request(`/auth/check-id/${id}`),
  logout: async () => {
    try { await request('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearTokens();
  },

  // --- User (token auto-attached) ---
  getUser: () => request('/user/me'),
  updateUser: (dog, diaryTime) =>
    request('/user/me', {
      method: 'PUT',
      body: JSON.stringify({
        ...(dog && { dog }),
        ...(diaryTime && { diary_time: diaryTime }),
      }),
    }),

  // --- Diary (token auto-attached) ---
  generateDiary: (logs) =>
    request('/diary/generate', { method: 'POST', body: JSON.stringify(logs) }),
  checkDiaryJob: (jobId) => request(`/diary/job/${jobId}`),
  listDiaries: () => request('/diary/list'),
  getDiary: (entryId) => request(`/diary/entry/${entryId}`),
  editDiary: (entryId, data) =>
    request(`/diary/edit/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDiary: (entryId) =>
    request(`/diary/${entryId}`, { method: 'DELETE' }),

  // --- Comments ---
  generateComments: (data) =>
    request('/comments/generate', { method: 'POST', body: JSON.stringify(data) }),

  streamComments: (entryId, onComment, onDone, mode = 'new') => {
    const token = getAccessToken();
    const es = new EventSource(
      `${BASE}/comments/stream/${entryId}?mode=${mode}&token=${encodeURIComponent(token)}`
    );
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

  // --- Hospitals ---
  nearbyHospitals: (lat, lng) => request(`/hospitals/nearby?lat=${lat}&lng=${lng}`),

  // --- Admin (token auto-attached, admin check server-side) ---
  adminStats: () => request('/admin/stats'),
  adminSystem: () => request('/admin/system'),

  // --- Analytics (admin only) ---
  analyticsOverview: () => request('/admin/analytics/overview'),
  analyticsEngagement: () => request('/admin/analytics/engagement'),
  analyticsAgents: () => request('/admin/analytics/agents'),

  // --- Analysis ---
  analyze: (data) => request('/analyze', { method: 'POST', body: JSON.stringify(data) }),

  // --- Social / Sharing ---
  shareDiary: (entryId) =>
    request(`/diary/${entryId}/share`, { method: 'POST' }),
  unshareDiary: (entryId) =>
    request(`/diary/${entryId}/share`, { method: 'DELETE' }),
  getSharedDiary: (shareToken) => {
    // Public endpoint — no auth token needed
    return fetch(`${BASE}/share/${shareToken}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      });
  },
  getPublicProfile: (userId) => {
    return fetch(`${BASE}/profile/${userId}/public`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      });
  },
  updateVisibility: (isPublic, bio) =>
    request('/profile/me/visibility', {
      method: 'PUT',
      body: JSON.stringify({ is_profile_public: isPublic, bio }),
    }),

  // --- Push Notifications ---
  getVapidPublicKey: () => request('/push/vapid-public-key'),
  pushSubscribe: (data) =>
    request('/push/subscribe', { method: 'POST', body: JSON.stringify(data) }),
  pushUnsubscribe: () =>
    request('/push/unsubscribe', { method: 'DELETE' }),
  pushTest: () =>
    request('/push/test', { method: 'POST' }),
};
