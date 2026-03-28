import { create } from 'zustand';
import { questsAPI } from '../services/api';

export const useQuestStore = create((set, get) => ({
    quests: [],
    isLoading: false,
    error: null,
    claimingQuestId: null,

    fetchQuests: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await questsAPI.getQuests();
            set({ quests: response.data.quests, isLoading: false });
        } catch (error) {
            console.error('❌ Failed to fetch quests:', error);
            set({
                error: error.response?.data?.detail || 'Failed to load quests',
                isLoading: false,
            });
        }
    },

    claimQuest: async (questId) => {
        set({ claimingQuestId: questId });
        try {
            const response = await questsAPI.claimQuest(questId);
            const { new_balance, shards_earned } = response.data;

            // Update quest as claimed locally
            const quests = get().quests.map(q =>
                q.id === questId ? { ...q, claimed: true } : q
            );
            set({ quests, claimingQuestId: null });

            // Sync new shard balance to BOTH stores so UI updates instantly
            try {
                const { useAuthStore } = await import('./authStore');
                useAuthStore.getState().updateUser({ aether_shards: new_balance });
            } catch (e) {
                console.warn('Could not update auth store:', e);
            }
            try {
                const { useShopStore } = await import('./shopStore');
                useShopStore.setState({ shards: new_balance });
            } catch (e) {
                console.warn('Could not update shop store:', e);
            }

            return { success: true, shards_earned, new_balance };
        } catch (error) {
            const message = error.response?.data?.detail || 'Failed to claim quest reward';
            set({ claimingQuestId: null });
            return { success: false, error: message };
        }
    },
}));
