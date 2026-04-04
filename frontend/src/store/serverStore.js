import { create } from 'zustand';
import { serversAPI, messagesAPI } from '../services/api';
import i18n from '../i18n';

// Import friendsStore to close DM when selecting a server
const getFriendsStore = () => require('./friendsStore').useFriendsStore;

export const useServerStore = create((set, get) => ({
    servers: [],
    currentServer: null,
    currentChannel: null,
    channels: [],
    members: [],
    messages: [],
    pinnedMessages: [],
    isLoading: false,
    error: null,

    // Fetch user's servers
    fetchServers: async () => {
        set({ isLoading: true });
        try {
            const response = await serversAPI.getMyServers();
            set({ servers: response.data.servers, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    // Select a server
    selectServer: async (serverId) => {
        // Close any open DM conversation when selecting a server
        try {
            const friendsStore = getFriendsStore();
            friendsStore.getState().closeDM();
        } catch (e) {
            // Ignore if friendsStore not available
        }

        // Reset UI overlays so the main content area shows the chat
        try {
            const { useUIStore } = require('./uiStore');
            useUIStore.getState().setShowPrimeScreen(false);
            useUIStore.getState().setShowFriendsPanel(false);
        } catch (e) {
            // Ignore if uiStore not available
        }

        set({ isLoading: true, currentChannel: null, messages: [] });
        try {
            const response = await serversAPI.getServer(serverId);
            const server = response.data;

            set({
                currentServer: server,
                channels: server.channels || [],
                isLoading: false,
            });

            // Auto-select first text channel
            const textChannel = server.channels?.find(c => c.type === 'text');
            if (textChannel) {
                get().selectChannel(textChannel._id);
            }

            // Fetch members
            get().fetchMembers(serverId);
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    // Select a channel
    selectChannel: async (channelId) => {
        const channel = get().channels.find(c => c._id === channelId);
        set({ currentChannel: channel, messages: [] });

        if (channel?.type === 'text') {
            get().fetchMessages(channelId);
        }
    },

    // Fetch messages for a channel
    fetchMessages: async (channelId, beforeId = null) => {
        try {
            const response = await messagesAPI.getMessages(channelId, 50, beforeId);

            if (beforeId) {
                // Append older messages
                set(state => ({
                    messages: [...response.data.messages, ...state.messages]
                }));
            } else {
                set({ messages: response.data.messages });
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    },

    // Fetch members
    fetchMembers: async (serverId) => {
        try {
            const response = await serversAPI.getMembers(serverId);
            set({ members: response.data.members });
        } catch (error) {
            console.error('Failed to fetch members:', error);
        }
    },

    // Update member status (real-time)
    updateMemberStatus: (userId, status) => {
        set(state => ({
            members: state.members.map(m =>
                m.user_id === userId ? { ...m, status: status } : m
            )
        }));
    },

    // Add new message (from socket)
    addMessage: (message) => {
        const state = get();
        // Check if message already exists to prevent duplicates
        const alreadyExists = state.messages.some(msg => msg._id === message._id);
        if (alreadyExists) {
            console.log("Duplicate server message prevented:", message._id);
            return;
        }

        set(state => ({
            messages: [...state.messages, message]
        }));
    },

    // Update a message (for edits and pins)
    updateMessage: (messageId, updatedData) => {
        set(state => {
            const updatedMessages = state.messages.map(m =>
                m._id === messageId ? { ...m, ...updatedData } : m
            );

            // Also update pinnedMessages if needed
            let updatedPinned = state.pinnedMessages;
            const messageInPinned = state.pinnedMessages.find(m => m._id === messageId);

            if (messageInPinned) {
                // If already in pinned list, update it
                updatedPinned = state.pinnedMessages.map(m =>
                    m._id === messageId ? { ...m, ...updatedData } : m
                );
                // If it was unpinned, remove it
                if (updatedData.is_pinned === false) {
                    updatedPinned = updatedPinned.filter(m => m._id !== messageId);
                }
            } else if (updatedData.is_pinned === true) {
                // If newly pinned, we might want to add it. 
                // But normally we fetchPinnedMessages on component mount.
                // However for real-time update we can try to add it.
                // We need the full message object. If updatedData is partial, this might be tricky.
                // But usually socket sends full updated message.
                const fullMessage = updatedMessages.find(m => m._id === messageId);
                if (fullMessage) {
                    updatedPinned = [...state.pinnedMessages, fullMessage];
                }
            }

            return {
                messages: updatedMessages,
                pinnedMessages: updatedPinned,
            };
        });
    },

    // Remove a message (for deletes)
    removeMessage: (messageId) => {
        set(state => ({
            messages: state.messages.filter(m => m._id !== messageId),
            pinnedMessages: state.pinnedMessages.filter(m => m._id !== messageId)
        }));
    },

    // Pinning Actions
    pinMessage: async (messageId) => {
        try {
            await messagesAPI.pinMessage(messageId);
            // Optimistically update local state
            get().updateMessage(messageId, { is_pinned: true });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    unpinMessage: async (messageId) => {
        try {
            await messagesAPI.unpinMessage(messageId);
            // Optimistically update local state
            get().updateMessage(messageId, { is_pinned: false });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    fetchPinnedMessages: async (channelId) => {
        try {
            const response = await messagesAPI.getPinnedMessages(channelId);
            set({ pinnedMessages: response.data.messages });
        } catch (error) {
            console.error('Failed to fetch pinned messages:', error);
        }
    },


    // Create server
    createServer: async (name) => {
        try {
            const response = await serversAPI.createServer(name);
            const newServer = response.data.server;
            set(state => ({
                servers: [...state.servers, newServer]
            }));
            return { success: true, server: newServer };
        } catch (error) {
            const detail = error.response?.data?.detail;
            // Handle Pydantic validation errors which can be an array of objects
            let errorMessage = i18n.t('store.error_occurred', 'An error occurred');
            if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (Array.isArray(detail) && detail.length > 0) {
                errorMessage = detail.map(err => err.msg || err.message || JSON.stringify(err)).join(', ');
            } else if (detail && typeof detail === 'object') {
                errorMessage = detail.msg || detail.message || JSON.stringify(detail);
            }
            return { success: false, error: errorMessage };
        }
    },

    // Join server
    joinServer: async (inviteCode) => {
        try {
            const response = await serversAPI.joinServer(inviteCode);
            get().fetchServers(); // Refresh server list
            return { success: true, server: response.data.server };
        } catch (error) {
            const detail = error.response?.data?.detail;
            let errorMessage = i18n.t('store.error_occurred', 'An error occurred');
            if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (Array.isArray(detail) && detail.length > 0) {
                errorMessage = detail.map(err => err.msg || err.message || JSON.stringify(err)).join(', ');
            } else if (detail && typeof detail === 'object') {
                errorMessage = detail.msg || detail.message || JSON.stringify(detail);
            }
            return { success: false, error: errorMessage };
        }
    },

    // Leave server
    leaveServer: async (serverId) => {
        try {
            await serversAPI.leaveServer(serverId);
            set(state => ({
                servers: state.servers.filter(s => s._id !== serverId),
                currentServer: state.currentServer?._id === serverId ? null : state.currentServer,
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Create channel
    createChannel: async (serverId, name, type) => {
        try {
            const response = await serversAPI.createChannel(serverId, name, type);
            set(state => ({
                channels: [...state.channels, response.data.channel]
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Update channel
    updateChannel: async (serverId, channelId, data) => {
        try {
            const response = await serversAPI.updateChannel(serverId, channelId, data);
            set(state => ({
                channels: state.channels.map(c =>
                    c._id === channelId ? { ...c, ...response.data.channel } : c
                ),
                currentChannel: state.currentChannel?._id === channelId
                    ? { ...state.currentChannel, ...response.data.channel }
                    : state.currentChannel
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Delete channel
    deleteChannel: async (serverId, channelId) => {
        try {
            await serversAPI.deleteChannel(serverId, channelId);
            set(state => ({
                channels: state.channels.filter(c => c._id !== channelId),
                currentChannel: state.currentChannel?._id === channelId ? null : state.currentChannel
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    promoteMember: async (serverId, userId) => {
        try {
            await serversAPI.promoteMember(serverId, userId);
            // Update local state
            set(state => ({
                members: state.members.map(m =>
                    m.user_id === userId ? { ...m, role: 'moderator' } : m
                )
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    demoteMember: async (serverId, userId) => {
        try {
            await serversAPI.demoteMember(serverId, userId);
            set(state => ({
                members: state.members.map(m =>
                    m.user_id === userId ? { ...m, role: 'member' } : m
                )
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    muteMember: async (serverId, userId, reason, durationHours) => {
        try {
            await serversAPI.muteMember(serverId, userId, reason, durationHours);
            set(state => ({
                members: state.members.map(m =>
                    m.user_id === userId ? { ...m, is_muted: true, mute_reason: reason } : m
                )
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    unmuteMember: async (serverId, userId) => {
        try {
            await serversAPI.unmuteMember(serverId, userId);
            set(state => ({
                members: state.members.map(m =>
                    m.user_id === userId ? { ...m, is_muted: false, mute_reason: null } : m
                )
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    kickMember: async (serverId, userId) => {
        try {
            await serversAPI.kickMember(serverId, userId);
            set(state => ({
                members: state.members.filter(m => m.user_id !== userId)
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Clear current server
    clearServer: () => {
        set({
            currentServer: null,
            currentChannel: null,
            channels: [],
            members: [],
            messages: [],
            pinnedMessages: [],
        });
    },
}));
