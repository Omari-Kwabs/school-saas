import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
});

let isRefreshing = false;
let refreshQueue = [];

function drainQueue(error) {
  refreshQueue.forEach(cb => cb(error));
  refreshQueue = [];
}

client.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    // Don't retry auth endpoints to avoid infinite loops
    if (original.url?.includes('/auth/')) {
      return Promise.reject(err);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push(refreshErr => {
          if (refreshErr) return reject(refreshErr);
          resolve(client(original));
        });
      });
    }

    isRefreshing = true;
    try {
      await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      drainQueue(null);
      return client(original);
    } catch (refreshErr) {
      drainQueue(refreshErr);
      // Only redirect if not already on a login page; use the right portal
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/admin/login') {
        window.location.href = path.startsWith('/admin') ? '/admin/login' : '/login';
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default client;
