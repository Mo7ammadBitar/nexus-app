/**
 * Centralized environment configuration for API and WebSocket URLs.
 * 
 * Priority:
 *   1. REACT_APP_BACKEND_URL env variable (if set in .env or .env.local)
 *   2. Auto-detect based on NODE_ENV (production vs development)
 */

const PROD_URL = 'https://nexus-backend-api-1-e8dabjgja2gqfdh2.spaincentral-01.azurewebsites.net';
const DEV_URL = 'http://localhost:8000';

const isDev = process.env.NODE_ENV === 'development';

// Allow manual override via .env / .env.local
const BASE = process.env.REACT_APP_BACKEND_URL || (isDev ? DEV_URL : PROD_URL);

// --- Base URLs ---
export const API_BASE_URL = BASE;
export const SOCKET_BASE_URL = BASE;

/**
 * Resolves a relative asset path (e.g., /static/2.jpg, /uploads/avatar.png)
 * into a full URL pointing to the correct backend.
 * If the URL is already absolute (starts with http), it is returned as-is.
 */
export const resolveAssetUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
};
