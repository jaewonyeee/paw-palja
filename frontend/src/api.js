// Capacitor may not be available in plain browser builds (dev/PWA).
// Guard the import so that web-only builds never crash.
let _isNative = false;
try {
  const { Capacitor } = await import('@capacitor/core');
  _isNative = Capacitor.isNativePlatform();
} catch {
  // @capacitor/core not resolvable — running as a plain web app
}

// For native mobile builds, use the absolute server URL.
// Set VITE_API_BASE_URL in your .env or at build time for native targets.
// Web builds behind a reverse proxy can keep the default relative path.
const BASE = _isNative
  ? (import.meta.env.VITE_API_BASE_URL || 'https://pawpalja.com/api/v1')
  : (import.meta.env.VITE_API_BASE_URL || '/api/v1');

// SSE must bypass Cloudflare proxy (which buffers streaming responses).
// Use the direct backend URL for EventSource connections.
const SSE_BASE = import.meta.env.VITE_SSE_BASE_URL
  || import.meta.env.VITE_API_BASE_URL
  || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://api.pawpalja.com/api/v1'
      : BASE);

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

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (fetchErr) {
    // Network error (offline, DNS failure, CORS, connection refused)
    console.error('[API] Network error:', path, fetchErr);
    throw new Error('네트워크 연결을 확인해주세요.');
  }

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
      throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
    }
  }

  if (res.status === 413) {
    throw new Error('파일 크기가 너무 큽니다. 더 작은 이미지를 사용해주세요.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || '요청에 실패했습니다.');
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
  updateUser: (dog, diaryTime, email) =>
    request('/user/me', {
      method: 'PUT',
      body: JSON.stringify({
        ...(dog && { dog }),
        ...(diaryTime && { diary_time: diaryTime }),
        ...(email !== undefined && { email }),
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
      `${SSE_BASE}/comments/stream/${entryId}?mode=${mode}&token=${encodeURIComponent(token)}`
    );
    es.onmessage = (event) => {
      if (event.data === '[DONE]') {
        es.close();
        onDone?.();
        return;
      }
      try {
        const comment = JSON.parse(event.data);
        if (comment.error) {
          console.error('Comment stream error from server:', comment.error);
          es.close();
          onDone?.();
          return;
        }
        onComment(comment);
      } catch (err) {
        console.error('Failed to parse comment SSE data:', event.data, err);
      }
    };
    es.onerror = (err) => {
      console.error('Comment SSE connection error:', err);
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

  // --- Admin Extended ---
  adminUsers: (q = '', page = 1, limit = 20) =>
    request(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
  adminUserDetail: (userId) => request(`/admin/users/${userId}/detail`),
  adminDeleteUser: (userId) =>
    request(`/admin/users/${userId}`, { method: 'DELETE' }),
  adminDiaries: ({ q = '', user_id = '', date_from = '', date_to = '', page = 1, limit = 20 } = {}) =>
    request(`/admin/diaries?q=${encodeURIComponent(q)}&user_id=${encodeURIComponent(user_id)}&date_from=${date_from}&date_to=${date_to}&page=${page}&limit=${limit}`),
  adminDiaryDetail: (entryId) => request(`/admin/diaries/${entryId}`),
  adminDbStatus: () => request('/admin/db-status'),
  adminApiUsage: (period = 'today') => request(`/admin/api-usage?period=${period}`),

  // --- Admin Command Center ---
  adminKpiSummary: () => request('/admin/kpi-summary'),
  adminAgentPerformance: (period = 'today') => request(`/admin/agent-performance?period=${period}`),
  adminMcpStats: () => request('/admin/mcp-stats'),
  adminPrompts: () => request('/admin/prompts'),
  adminUpdatePrompt: (key, data) =>
    request(`/admin/prompts/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminResetPrompt: (key) =>
    request(`/admin/prompts/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  adminRagStatus: () => request('/admin/rag-status'),
  adminRagReindex: () => request('/admin/rag-reindex', { method: 'POST' }),
  adminImageStats: () => request('/admin/image-stats'),

  // --- Analytics (admin only) ---
  analyticsOverview: () => request('/admin/analytics/overview'),
  analyticsEngagement: () => request('/admin/analytics/engagement'),
  analyticsAgents: () => request('/admin/analytics/agents'),

  // --- Analysis ---
  analyze: (data) => request('/analyze', { method: 'POST', body: JSON.stringify(data) }),

  // --- Social Feed ---
  socialFeed: (limit = 20, offset = 0, q = '') =>
    request(`/social/feed?limit=${limit}&offset=${offset}&include_mine=true&q=${encodeURIComponent(q)}`),

  // --- Social / Sharing ---
  shareDiary: (entryId) =>
    request(`/diary/${entryId}/share`, { method: 'POST' }),
  unshareDiary: (entryId) =>
    request(`/diary/${entryId}/share`, { method: 'DELETE' }),
  getSharedDiary: (shareToken) => request(`/share/${shareToken}`),
  getPublicProfile: (userId) => {
    return fetch(`${BASE}/profile/${userId}/public`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      });
  },
  updateVisibility: (isPublic, bio, autoShareSocial) =>
    request('/profile/me/visibility', {
      method: 'PUT',
      body: JSON.stringify({
        is_profile_public: isPublic,
        bio,
        ...(autoShareSocial !== undefined && { auto_share_social: autoShareSocial }),
      }),
    }),

  // --- Social Interactions ---
  likeDiary: (entryId) => request(`/social/like/${entryId}`, { method: 'POST' }),
  addSocialComment: (entryId, text) =>
    request(`/social/comment/${entryId}`, { method: 'POST', body: JSON.stringify({ text }) }),

  // --- Voice (Whisper) ---
  transcribeVoice: async (audioBlob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    const token = getAccessToken();
    const res = await fetch(`${BASE}/voice/transcribe`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Voice transcription failed');
    }
    return res.json();
  },

  // --- TTS ---
  generateTTS: async (text, voice = 'nova') => {
    const token = getAccessToken();
    const res = await fetch(`${BASE}/tts/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'TTS generation failed');
    }
    return res.blob();
  },

  // --- Subscription ---
  getSubscriptionTiers: () => request('/subscription/tiers'),
  getMySubscription: () => request('/subscription/me'),
  adminUpdateSubscription: (userId, tier, durationDays = 30) =>
    request('/subscription/admin/update', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, tier, duration_days: durationDays }),
    }),

  // --- Stripe Payment ---
  createCheckoutSession: () =>
    request('/subscription/create-checkout-session', { method: 'POST' }),
  createPortalSession: () =>
    request('/subscription/create-portal-session', { method: 'POST' }),

  // --- Push Notifications ---
  getVapidPublicKey: () => request('/push/vapid-public-key'),
  pushSubscribe: (data) =>
    request('/push/subscribe', { method: 'POST', body: JSON.stringify(data) }),
  pushUnsubscribe: () =>
    request('/push/unsubscribe', { method: 'DELETE' }),
  pushTest: () =>
    request('/push/test', { method: 'POST' }),
};
