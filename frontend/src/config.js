/**
 * Centralized environment configuration for API and WebSocket URLs.
 * Switches between dev (localhost) and production (Azure) based on NODE_ENV.
 */

const isDev = process.env.NODE_ENV === 'development';

// --- Base URLs ---
export const API_BASE_URL = isDev
    ? 'http://localhost:8000'
    : 'https://nexus-backend-api-1-e8dabjgja2gqfdh2.spaincentral-01.azurewebsites.net';

export const SOCKET_BASE_URL = isDev
    ? 'http://localhost:8000'
    : 'https://nexus-backend-api-1-e8dabjgja2gqfdh2.spaincentral-01.azurewebsites.net';

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
