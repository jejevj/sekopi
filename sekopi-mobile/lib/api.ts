import axios from 'axios';

// Ganti dengan IP lokal kamu saat development
// Contoh: http://192.168.1.10:8000
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.1:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// Inject token otomatis di setiap request
api.interceptors.request.use((config) => {
  // Token diambil dari store secara manual saat dibutuhkan
  return config;
});

export default api;
