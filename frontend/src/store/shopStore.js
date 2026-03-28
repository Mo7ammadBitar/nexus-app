import { create } from 'zustand';
import { shopAPI } from '../services/api';
import { useAuthStore } from './authStore';
import i18n from '../i18n';

export const useShopStore = create((set, get) => ({
    shards: 0,
    ownedRelics: [],
    equippedRelics: {},
    relicsCatalog: [],
    isLoading: false,
    error: null,

    // Fetch the full shop catalog
    fetchShop: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await shopAPI.getRelics();
            set({
                relicsCatalog: response.data.relics,
                shards: response.data.aether_shards,
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false, error: error.response?.data?.detail || i18n.t('store.failed_load_shop', 'Failed to load shop') });
        }
    },

    // Buy a relic
    buyRelic: async (relicId) => {
        try {
            const response = await shopAPI.buyRelic(relicId);
            set({
                shards: response.data.new_balance,
                ownedRelics: response.data.owned_relics,
            });
            // Refresh catalog to update owned flags
            get().fetchShop();
            return { success: true, message: response.data.message };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || i18n.t('store.purchase_failed', 'Purchase failed') };
        }
    },

    // Equip a relic
    equipRelic: async (relicId) => {
        try {
            const response = await shopAPI.equipRelic(relicId);
            set({ equippedRelics: response.data.equipped_relics });
            // Sync with auth store so DM/chat rendering sees updated relics
            useAuthStore.getState().updateUser({ equipped_relics: response.data.equipped_relics });
            get().fetchShop();
            return { success: true, message: response.data.message };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || i18n.t('store.equip_failed', 'Equip failed') };
        }
    },

    // Unequip a slot
    unequipRelic: async (slot) => {
        try {
            const response = await shopAPI.unequipRelic(slot);
            set({ equippedRelics: response.data.equipped_relics });
            // Sync with auth store so DM/chat rendering sees updated relics
            useAuthStore.getState().updateUser({ equipped_relics: response.data.equipped_relics });
            get().fetchShop();
            return { success: true, message: response.data.message };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || i18n.t('store.unequip_failed', 'Unequip failed') };
        }
    },

    // Fetch user inventory
    fetchInventory: async () => {
        try {
            const response = await shopAPI.getInventory();
            set({
                ownedRelics: response.data.owned_relics,
                equippedRelics: response.data.equipped_relics,
                shards: response.data.aether_shards,
            });
        } catch (error) {
            console.error('Failed to fetch inventory:', error);
        }
    },
}));
