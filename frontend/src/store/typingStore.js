import { create } from 'zustand';

export const useTypingStore = create((set, get) => ({
    // Channel typing: { channelId: [{ user_id, username }] }
    channelTyping: {},

    // DM typing: { friendId: { username, timestamp } }
    dmTyping: {},

    // Add a user typing in a channel
    addChannelTypingUser: (channelId, user) => {
        set(state => {
            const currentTypers = state.channelTyping[channelId] || [];
            // Avoid duplicates
            if (currentTypers.find(u => u.user_id === user.user_id)) {
                return state;
            }
            return {
                channelTyping: {
                    ...state.channelTyping,
                    [channelId]: [...currentTypers, user]
                }
            };
        });
    },

    // Remove a user from channel typing
    removeChannelTypingUser: (channelId, userId) => {
        set(state => {
            const currentTypers = state.channelTyping[channelId] || [];
            return {
                channelTyping: {
                    ...state.channelTyping,
                    [channelId]: currentTypers.filter(u => u.user_id !== userId)
                }
            };
        });
    },

    // Clear all typing users for a channel
    clearChannelTyping: (channelId) => {
        set(state => {
            const newTyping = { ...state.channelTyping };
            delete newTyping[channelId];
            return { channelTyping: newTyping };
        });
    },

    // Set a friend as typing in DM
    setDMTyping: (friendId, username) => {
        set(state => ({
            dmTyping: {
                ...state.dmTyping,
                [friendId]: { username, timestamp: Date.now() }
            }
        }));
    },

    // Clear a friend from DM typing
    clearDMTyping: (friendId) => {
        set(state => {
            const newTyping = { ...state.dmTyping };
            delete newTyping[friendId];
            return { dmTyping: newTyping };
        });
    },

    // Get typing users for a channel
    getChannelTypingUsers: (channelId) => {
        return get().channelTyping[channelId] || [];
    },

    // Check if a friend is typing
    isFriendTyping: (friendId) => {
        return !!get().dmTyping[friendId];
    },

    // Get DM typing info for a friend
    getDMTypingInfo: (friendId) => {
        return get().dmTyping[friendId] || null;
    }
}));
