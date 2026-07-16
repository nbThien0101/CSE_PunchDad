const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Base fetch wrapper with auth token
 */
const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('accessToken');

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE}${url}`, config);

  // Token expired → try refresh
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      config.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
      return fetch(`${API_BASE}${url}`, config);
    }
    // Refresh failed → logout
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    return response;
  }

  return response;
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
};

// ==========================================
// Auth API
// ==========================================
export const authAPI = {
  register: async (data) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  login: async (data) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getMe: async () => {
    const res = await fetchWithAuth('/auth/me');
    return res.json();
  },
};

// ==========================================
// Sessions API
// ==========================================
export const sessionsAPI = {
  getAll: async (status) => {
    const query = status ? `?status=${status}` : '';
    const res = await fetchWithAuth(`/sessions${query}`);
    return res.json();
  },

  getById: async (id) => {
    const res = await fetchWithAuth(`/sessions/${id}`);
    return res.json();
  },

  create: async (data) => {
    const res = await fetchWithAuth('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetchWithAuth(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (id) => {
    const res = await fetchWithAuth(`/sessions/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
};

// ==========================================
// Votes API
// ==========================================
export const votesAPI = {
  cast: async (data) => {
    const res = await fetchWithAuth('/votes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetchWithAuth(`/votes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getBySession: async (sessionId) => {
    const res = await fetchWithAuth(`/votes/session/${sessionId}`);
    return res.json();
  },
};

// ==========================================
// Payments API
// ==========================================
export const paymentsAPI = {
  getBySession: async (sessionId) => {
    const res = await fetchWithAuth(`/payments/session/${sessionId}`);
    return res.json();
  },

  markAsPaid: async (id) => {
    const res = await fetchWithAuth(`/payments/${id}/mark-paid`, {
      method: 'PUT',
    });
    return res.json();
  },

  confirm: async (id) => {
    const res = await fetchWithAuth(`/payments/${id}/confirm`, {
      method: 'PUT',
    });
    return res.json();
  },
};
