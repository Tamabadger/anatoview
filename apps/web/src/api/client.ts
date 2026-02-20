import axios from 'axios';

/**
 * In-memory token storage (never persisted to localStorage for security).
 * Tokens arrive via URL hash fragment from LTI launch or manual login.
 */
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}

/**
 * Axios instance for all API calls.
 *
 * In Docker dev, nginx reverse-proxies /api/* to the Express API container,
 * so we just use relative URLs starting with /api/.
 */
const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ─── Request Interceptor: attach JWT ─────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: handle 401 + token refresh ────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we have a refresh token, try to refresh
    if (
      error.response?.status === 401 &&
      refreshToken &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post('/api/auth/refresh', {
          refreshToken,
        });

        accessToken = data.accessToken;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — clear everything and redirect
        clearTokens();
        window.location.href = '/unauthorized';
        return Promise.reject(error);
      }
    }

    // 401 with no refresh token — redirect to unauthorized
    if (error.response?.status === 401) {
      clearTokens();
      window.location.href = '/unauthorized';
    }

    return Promise.reject(error);
  }
);

export default apiClient;
