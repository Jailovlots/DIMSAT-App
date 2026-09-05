// API base URL configuration
// Deployed server: https://dimsat-app-y0pq.onrender.com
const getApiBase = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:5000`;
    }
    // Deployed environment on Render / production
    return origin || 'https://dimsat-app-y0pq.onrender.com';
  }
  return 'https://dimsat-app-y0pq.onrender.com';
};

export const API_BASE_URL = getApiBase();
export const API_URL = `${API_BASE_URL}/api`;
