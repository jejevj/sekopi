import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api-sekopi.ourtestcloud.my.id/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Inject Bearer token otomatis dari authStore
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 global — auto logout jika token expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);

export default api;
