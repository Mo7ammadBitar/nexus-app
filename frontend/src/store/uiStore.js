import { create } from 'zustand';

export const useUIStore = create((set) => ({
    // Global UI Layout Flags
    showFriendsPanel: false,
    setShowFriendsPanel: (show) => set({ showFriendsPanel: show }),

    // Settings & Modals
    activeTheme: 'ethereal',
    setActiveTheme: (theme) => set({ activeTheme: theme }),

    isProfileModalOpen: false,
    setProfileModalOpen: (isOpen) => set({ isProfileModalOpen: isOpen }),

    isShopOpen: false,
    setShopOpen: (isOpen) => set({ isShopOpen: isOpen }),

    // Global Error State (fallback for general app errors without boundaries)
    globalError: null,
    setGlobalError: (error) => set({ globalError: error }),

    // Autoplay Policy State
    audioBlocked: false,
    setAudioBlocked: (isBlocked) => set({ audioBlocked: isBlocked }),
}));
