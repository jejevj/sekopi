import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api-sekopi.ourtestcloud.my.id/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

// Pastikan setiap URL selalu diakhiri slash agar tidak kena 307 redirect
// yang akan menghilangkan Authorization header
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Tambah trailing slash jika belum ada dan bukan request dengan query params
  if (config.url && !config.url.endsWith('/')) {
    const hasQuery = config.url.includes('?');
    if (!hasQuery) {
      config.url = config.url + '/';
    } else {
      // Pisah path dan query, tambah slash ke path
      const [path, query] = config.url.split('?');
      if (!path.endsWith('/')) {
        config.url = path + '/?' + query;
      }
    }
  }

  return config;
});

// Hanya reject error — JANGAN auto clearAuth() pada 401
// karena akan menyebabkan logout paksa saat redirect 307 kehilangan token
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
