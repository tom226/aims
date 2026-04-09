import axios from 'axios';

const baseURL = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || '/api')
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aims_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('aims_token');
      localStorage.removeItem('aims_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
