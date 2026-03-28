import { create } from 'zustand';
import { authAPI } from '../services/api';
import i18n from '../i18n';

// Load initial state from localStorage
const getInitialState = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    return {
        token: token || null,
        user: user ? JSON.parse(user) : null,
        isAuthenticated: !!token,
        isLoading: false,
        error: null,
    };
};

export const useAuthStore = create((set, get) => ({
    ...getInitialState(),

    // Login
    login: async (email, password) => {
        set({ isLoading: true, error: null });

        try {
            console.log('🔄 Attempting login...');
            const response = await authAPI.login(email, password);
            console.log('✅ Login response:', response.data);

            const { access_token } = response.data;

            // Save to localStorage
            localStorage.setItem('token', access_token);

            // Fetch full user data
            console.log('🔄 Fetching user data...');
            const userResponse = await authAPI.getMe();
            console.log('✅ User data:', userResponse.data);

            const user = userResponse.data;

            localStorage.setItem('user', JSON.stringify(user));

            set({
                token: access_token,
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            return { success: true };
        } catch (error) {
            // Only log unexpected errors (not 401/404)
            if (error.response?.status !== 401 && error.response?.status !== 404) {
                console.error('❌ Login error:', error);
            }

            let message = i18n.t('store.login_failed', 'Login failed');
            if (error.response?.data?.detail) {
                message = error.response.data.detail;
            } else if (error.message) {
                message = error.message;
            }

            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },

    // Register
    register: async (username, email, password, inviteCode = null) => {
        set({ isLoading: true, error: null });

        try {
            await authAPI.register(username, email, password, inviteCode);
            set({ isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.detail || i18n.t('store.registration_failed', 'Registration failed');
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },

    // Verify Email
    verifyEmail: async (email, otp) => {
        set({ isLoading: true, error: null });

        try {
            await authAPI.verifyEmail(email, otp);
            set({ isLoading: false });
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.detail || i18n.t('store.verification_failed', 'Verification failed');
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },

    // Logout
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({
            token: null,
            user: null,
            isAuthenticated: false,
            error: null,
        });
    },

    // Update user data
    updateUser: (userData) => {
        const updatedUser = { ...get().user, ...userData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        set({ user: updatedUser });
    },

    // Refresh user data from server
    refreshUser: async () => {
        try {
            const response = await authAPI.getMe();
            const user = response.data;
            localStorage.setItem('user', JSON.stringify(user));
            set({ user });
        } catch (error) {
            // Token might be invalid
            if (error.response?.status === 401) {
                get().logout();
            }
        }
    },

    // Clear error
    clearError: () => set({ error: null }),
}));
