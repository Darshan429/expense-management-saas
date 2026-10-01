import axios from 'axios';

// Base instance — all API calls go through this
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Automatically attaches access token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ──────────────────────────────────────────────────────
// Automatically refreshes access token when it expires (401 + TOKEN_EXPIRED)
// Then retries the original request with the new token
let isRefreshing  = false;
let failedQueue   = [];   // holds requests that arrived during refresh

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,   // pass through successful responses unchanged

  async (error) => {
    const original = error.config;

    // Only attempt refresh on 401 TOKEN_EXPIRED — not on other 401s (wrong password etc.)
    const isExpired = error.response?.status === 401 &&
                      error.response?.data?.code === 'TOKEN_EXPIRED';

    if (isExpired && !original._retry) {
      original._retry = true;   // prevent infinite retry loop

      if (isRefreshing) {
        // Another request is already refreshing — queue this one
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
          { refreshToken }
        );

        // Store new tokens
        localStorage.setItem('accessToken',  data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Retry all queued requests with new token
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);

      } catch (refreshError) {
        // Refresh failed — clear everything and force re-login
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);

      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;