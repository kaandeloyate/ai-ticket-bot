import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

export const authApi = {
  login: (password: string, guildId: string) =>
    api.post('/auth/login', { password, guildId }),
  verify: () => api.post('/auth/verify'),
};

export const ticketApi = {
  list: (params?: Record<string, string>) =>
    api.get('/tickets', { params }),
  get: (id: string) => api.get(`/tickets/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/tickets/${id}`, data),
  stats: () => api.get('/tickets/stats'),
  userHistory: (userId: string) => api.get(`/tickets/user/${userId}`),
};
