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

    showPrimeScreen: false,
    setShowPrimeScreen: (show) => set({ showPrimeScreen: show }),

    showGamingHub: false,
    setShowGamingHub: (show) => set({ showGamingHub: show }),

    // Global Error State (fallback for general app errors without boundaries)
    globalError: null,
    setGlobalError: (error) => set({ globalError: error }),

    // Autoplay Policy State
    audioBlocked: false,
    setAudioBlocked: (isBlocked) => set({ audioBlocked: isBlocked }),

    // Mobile View State ('nav' | 'chat')
    mobileView: 'nav',
    setMobileView: (view) => {
        set({ mobileView: view });
        // Handle hardware back pushState interception exclusively if running in a browser
        if (typeof window !== 'undefined' && view === 'chat') {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                window.history.pushState({ mobileView: 'chat' }, '');
            }
        }
    },
}));
