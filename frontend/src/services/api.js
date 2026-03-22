import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthRequest = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
        if (error.response?.status === 401 && !isAuthRequest) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (email, password) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        return api.post('/auth/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
    },
    register: (username, email, password) =>
        api.post('/auth/register', { username, email, password }),
    getMe: () => api.get('/auth/me'),
    verifyEmail: async (email, otp) => {
        const response = await api.post('/auth/verify-email', { email, otp });
        return response.data;
    },
    forgotPassword: async (email) => {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },
    resetPassword: async (email, otp, newPassword) => {
        const response = await api.post('/auth/reset-password', {
            email,
            otp,
            new_password: newPassword
        });
        return response.data;
    },
};

// Users API
export const usersAPI = {
    updateProfile: (data) => api.put('/users/profile', data),
    uploadAvatar: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/users/avatar', formData, {
            headers: { 'Content-Type': undefined }
        });
    },
    uploadBanner: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/users/banner', formData, {
            headers: { 'Content-Type': undefined }
        });
    },
    searchUsers: (username) => api.get(`/users/search?username=${username}`),
    getUser: (userId) => api.get(`/users/${userId}`),
    updateStatus: (status) => api.put(`/users/status?status_value=${status}`),
    applyServerBoost: (serverId) => api.post('/users/me/apply-boost', { server_id: serverId }),
};

// Servers API
export const serversAPI = {
    getMyServers: () => api.get('/servers'),
    getServer: (serverId) => api.get(`/servers/${serverId}`),
    createServer: (name) => api.post('/servers', { name }),
    updateServer: (serverId, data) => api.put(`/servers/${serverId}`, data),
    deleteServer: (serverId) => api.delete(`/servers/${serverId}`),
    joinServer: (inviteCode) => api.post('/servers/join', { invite_code: inviteCode }),
    leaveServer: (serverId) => api.post(`/servers/${serverId}/leave`),

    // Members
    getMembers: (serverId) => api.get(`/servers/${serverId}/members`),
    promoteMember: (serverId, userId) => api.post(`/servers/${serverId}/members/${userId}/promote`),
    demoteMember: (serverId, userId) => api.post(`/servers/${serverId}/members/${userId}/demote`),
    muteMember: (serverId, userId, reason, durationHours) =>
        api.post(`/servers/${serverId}/members/${userId}/mute`, { reason, duration_hours: durationHours }),
    unmuteMember: (serverId, userId) => api.post(`/servers/${serverId}/members/${userId}/unmute`),
    kickMember: (serverId, userId) => api.post(`/servers/${serverId}/members/${userId}/kick`),

    // Channels
    getChannels: (serverId) => api.get(`/servers/${serverId}/channels`),
    createChannel: (serverId, name, type) => api.post(`/servers/${serverId}/channels`, { name, type }),
    updateChannel: (serverId, channelId, data) => api.put(`/servers/${serverId}/channels/${channelId}`, data),
    deleteChannel: (serverId, channelId) => api.delete(`/servers/${serverId}/channels/${channelId}`),

    // Server Assets
    uploadIcon: (serverId, formData) => api.post(`/servers/${serverId}/icon`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    uploadBanner: (serverId, formData) => api.post(`/servers/${serverId}/banner`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Messages API
export const messagesAPI = {
    getMessages: (channelId, limit = 50, beforeId = null) => {
        let url = `/messages/${channelId}?limit=${limit}`;
        if (beforeId) url += `&before_id=${beforeId}`;
        return api.get(url);
    },
    sendMessage: (channelId, data) => {
        let payload = data;
        if (!(data instanceof FormData)) {
            payload = new FormData();
            if (typeof data === 'string') {
                payload.append('content', data);
            } else if (data && data.content) {
                payload.append('content', data.content);
            }
        }
        return api.post(`/messages/${channelId}`, payload, {
            headers: { 'Content-Type': undefined }
        });
    },
    deleteMessage: (channelId, messageId) => api.delete(`/messages/${channelId}/${messageId}`),
    editMessage: (channelId, messageId, content) => {
        const formData = new FormData();
        formData.append('content', content);
        return api.put(`/messages/${channelId}/${messageId}`, formData, {
            headers: { 'Content-Type': undefined }
        });
    },
    addReaction: (messageId, emoji) => {
        const formData = new FormData();
        formData.append('emoji', emoji);
        return api.post(`/messages/${messageId}/react`, formData, {
            headers: { 'Content-Type': undefined }
        });
    },
    removeReaction: (messageId, emoji) => api.delete(`/messages/${messageId}/react?emoji=${encodeURIComponent(emoji)}`),
    forwardMessage: (targetChannelId, sourceMessageId) => {
        const formData = new FormData();
        formData.append('source_message_id', sourceMessageId);
        return api.post(`/messages/forward/${targetChannelId}`, formData, {
            headers: { 'Content-Type': undefined }
        });
    },
    // Pass body with is_pinned boolean for FastAPI validation
    pinMessage: (messageId) => api.put(`/messages/${messageId}/pin`, { is_pinned: true }),
    unpinMessage: (messageId) => api.put(`/messages/${messageId}/unpin`, { is_pinned: false }),

    getPinnedMessages: (channelId) => api.get(`/messages/channel/${channelId}/pins`),
};

// Friends API
export const friendsAPI = {
    getFriends: () => api.get('/friends'),
    getPendingRequests: () => api.get('/friends/requests/pending'),
    getSentRequests: () => api.get('/friends/requests/sent'),
    sendRequest: (username) => api.post(`/friends/request/${username}`),
    acceptRequest: (requestId) => api.post(`/friends/accept/${requestId}`),
    rejectRequest: (requestId) => api.post(`/friends/reject/${requestId}`),
    cancelRequest: (requestId) => api.delete(`/friends/cancel/${requestId}`),
    removeFriend: (friendId) => api.delete(`/friends/${friendId}`),
    getStatus: (userId) => api.get(`/friends/status/${userId}`),
};

// DM API
export const dmAPI = {
    getConversations: () => api.get('/dm'),
    getMessages: (friendId, limit = 50, beforeId = null) => {
        let url = `/dm/${friendId}?limit=${limit}`;
        if (beforeId) url += `&before_id=${beforeId}`;
        return api.get(url);
    },
    sendMessage: (friendId, data) => {
        let payload = data;
        if (!(data instanceof FormData)) {
            payload = new FormData();
            if (typeof data === 'string') {
                payload.append('content', data);
            } else if (data && data.content) {
                payload.append('content', data.content);
            }
        }
        return api.post(`/dm/${friendId}`, payload, {
            headers: { 'Content-Type': undefined }
        });
    },
    editMessage: (messageId, content) => api.put(`/dm/message/${messageId}`, { content }),
    deleteMessage: (messageId) => api.delete(`/dm/message/${messageId}`),
    getUnreadCounts: () => api.get('/dm/unread/counts'),
    markAsRead: (friendId) => api.post(`/dm/${friendId}/read`),
    addReaction: (messageId, emoji) => api.post(`/dm/message/${messageId}/react?emoji=${encodeURIComponent(emoji)}`),
    removeReaction: (messageId, emoji) => api.delete(`/dm/message/${messageId}/react?emoji=${encodeURIComponent(emoji)}`),
    forwardMessage: (friendId, sourceMessageId, sourceType) => {
        const formData = new FormData();
        formData.append('source_message_id', sourceMessageId);
        formData.append('source_type', sourceType);
        return api.post(`/dm/${friendId}/forward`, formData, {
            headers: { 'Content-Type': undefined }
        });
    },
    // Pass body with is_pinned boolean for FastAPI validation
    pinMessage: (messageId) => api.put(`/dm/message/${messageId}/pin`, { is_pinned: true }),
    unpinMessage: (messageId) => api.put(`/dm/message/${messageId}/unpin`, { is_pinned: false }),

    getPinnedMessages: (friendId) => api.get(`/dm/${friendId}/pins`),
};

// Starred Messages API
export const starredAPI = {
    starMessage: (messageType, messageId) => api.post(`/starred/${messageType}/${messageId}`),
    unstarMessage: (messageId) => api.delete(`/starred/${messageId}`),
    getStarredMessages: () => api.get('/starred'),
    checkStarred: (messageId) => api.get(`/starred/check/${messageId}`),
};

// Preview API
export const previewAPI = {
    getMessagePreview: (serverId, channelId, messageId) =>
        api.get(`/preview/message/${serverId}/${channelId}/${messageId}`),
};

// Search API
export const searchAPI = {
    searchMessages: (query, limit = 20) => api.get(`/search?q=${encodeURIComponent(query)}&limit=${limit}`),
};

// Economy API
export const economyAPI = {
    claimReward: () => api.post('/economy/claim-reward'),
};

// Shop API
export const shopAPI = {
    getRelics: () => api.get('/shop/relics'),
    buyRelic: (relicId) => api.post(`/shop/buy/${relicId}`),
    equipRelic: (relicId) => api.post(`/shop/equip/${relicId}`),
    unequipRelic: (slot) => api.post(`/shop/unequip/${slot}`),
    getInventory: () => api.get('/shop/inventory'),
    buyServerBoost: () => api.post('/shop/buy-server-boost'),
};

// The Oracle - System Bot
export const ORACLE_ID = '000000000000000000000001';

export const oracleAPI = {
    summarize: (content) => api.post('/oracle/summarize', { content }),
    explain: (content) => api.post('/oracle/explain', { content }),
};

// Payments API (Server-Side Verified)
export const paymentsAPI = {
    verifyShards: (orderId, packId) =>
        api.post('/payments/verify-shards', { order_id: orderId, pack_id: packId }),
    verifyElite: (orderId, plan) =>
        api.post('/payments/verify-elite', { order_id: orderId, plan }),
};

export default api;