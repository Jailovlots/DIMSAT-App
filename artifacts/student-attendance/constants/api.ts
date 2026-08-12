// API base URL – update this to match your server's address
// On web (Expo Web): the admin console API runs on port 5000
// On Android/iOS physical device: replace with your server's LAN IP, e.g. http://192.168.1.100:5000
const DEV_API_BASE =
  typeof window !== 'undefined' && window.location?.hostname
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : 'http://localhost:5000';

export const API_BASE_URL = DEV_API_BASE;
export const API_URL = `${API_BASE_URL}/api`;
