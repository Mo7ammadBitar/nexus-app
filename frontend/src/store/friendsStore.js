import { create } from 'zustand';
import { friendsAPI, dmAPI } from '../services/api';
import { showNativeNotification, updateBadgeCount } from '../services/notificationService';

export const useFriendsStore = create((set, get) => ({
    friends: [],
    pendingRequests: [],
    sentRequests: [],
    currentDMFriend: null,
    dmMessages: [],
    pinnedMessages: [],
    isLoading: false,
    error: null,
    // Unread message counts
    unreadCounts: {},  // { friendId: count }
    totalUnread: 0,

    // Game challenge state
    gameChallenges: [],  // array of challenge objects in the current DM
    addGameChallenge: (challenge) => set(state => {
        const exists = state.gameChallenges.some(c => c._id === challenge._id);
        if (exists) return {};
        return { gameChallenges: [...state.gameChallenges, challenge] };
    }),
    updateGameChallenge: (challengeId, updates) => set(state => ({
        gameChallenges: state.gameChallenges.map(c =>
            c._id === challengeId ? { ...c, ...updates } : c
        ),
    })),
    clearGameChallenges: () => set({ gameChallenges: [] }),

    // Fetch all friends
    fetchFriends: async () => {
        set({ isLoading: true });
        try {
            const response = await friendsAPI.getFriends();

            const friendsList = response.data.friends;

            set({ friends: friendsList, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    // Fetch pending friend requests
    fetchPendingRequests: async () => {
        try {
            const response = await friendsAPI.getPendingRequests();
            set({ pendingRequests: response.data.requests });
        } catch (error) {
            console.error('Failed to fetch pending requests:', error);
        }
    },

    // Fetch sent requests
    fetchSentRequests: async () => {
        try {
            const response = await friendsAPI.getSentRequests();
            set({ sentRequests: response.data.requests });
        } catch (error) {
            console.error('Failed to fetch sent requests:', error);
        }
    },

    // Accept friend request
    acceptRequest: async (requestId) => {
        try {
            await friendsAPI.acceptRequest(requestId);
            // Refresh lists
            get().fetchPendingRequests();
            get().fetchFriends();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Reject friend request
    rejectRequest: async (requestId) => {
        try {
            await friendsAPI.rejectRequest(requestId);
            // Remove from pending
            set(state => ({
                pendingRequests: state.pendingRequests.filter(r => r._id !== requestId)
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Cancel sent request
    cancelRequest: async (requestId) => {
        try {
            await friendsAPI.cancelRequest(requestId);
            set(state => ({
                sentRequests: state.sentRequests.filter(r => r._id !== requestId)
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Remove friend
    removeFriend: async (friendId) => {
        try {
            await friendsAPI.removeFriend(friendId);
            set(state => ({
                friends: state.friends.filter(f => f._id !== friendId)
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Update friend status (real-time)
    updateFriendStatus: (friendId, status) => {
        set(state => ({
            friends: state.friends.map(f =>
                (f._id === friendId || f.id === friendId) ? { ...f, status: status } : f
            )
        }));
    },

    // Open DM with a friend
    openDM: async (friend) => {
        set({ currentDMFriend: friend, dmMessages: [], showFriendsPanel: false });
        // Fetch DM messages - use id or _id
        const friendId = friend.id || friend._id;
        try {
            const response = await dmAPI.getMessages(friendId);
            set({ dmMessages: response.data.messages || [] });

            // Mark messages as read
            await dmAPI.markAsRead(friendId);
            // Clear unread count for this friend
            set(state => {
                const newCounts = { ...state.unreadCounts };
                const clearedCount = newCounts[friendId] || 0;
                delete newCounts[friendId];
                const newTotal = Math.max(0, state.totalUnread - clearedCount);
                // Sync OS badge
                updateBadgeCount(newTotal);
                return {
                    unreadCounts: newCounts,
                    totalUnread: newTotal
                };
            });

            // Refresh friends list in background to get latest equipped_relics etc.
            await get().fetchFriends();
            // Update currentDMFriend with the refreshed data
            const refreshed = get().friends.find(f => (f._id || f.id) === friendId);
            if (refreshed) {
                set({ currentDMFriend: refreshed });
            }
        } catch (error) {
            console.error('Failed to fetch DM messages:', error);
        }
    },

    // Open DM by ID (for navigation)
    openDMById: async (friendId) => {
        let friend = get().friends.find(f => f._id === friendId || f.id === friendId);

        if (!friend) {
            // Ensure friends are fetched
            await get().fetchFriends();
            friend = get().friends.find(f => f._id === friendId || f.id === friendId);
        }

        if (friend) {
            await get().openDM(friend);
            return true;
        }
        return false;
    },

    // Send DM message
    sendDMMessage: async (content) => {
        const friend = get().currentDMFriend;
        if (!friend) return { success: false };

        const friendId = friend.id || friend._id;
        try {
            const response = await dmAPI.sendMessage(friendId, content);
            // Add message to local state - API returns 'dm' not 'message'
            if (response.data.dm) {
                // Use the guarded addDMMessage function
                get().addDMMessage(response.data.dm);
            }
            return { success: true };
        } catch (error) {
            console.error('Failed to send DM:', error);
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Add DM message (from socket or API)
    // ✅ FIX: Added de-duplication logic here
    addDMMessage: (message) => {
        set(state => {
            // Check if message with same ID already exists
            const exists = state.dmMessages.some(m => m._id === message._id);
            if (exists) {
                // Message already added (by socket or API race), do nothing
                return {};
            }
            return {
                dmMessages: [...state.dmMessages, message]
            };
        });
    },

    // Edit DM message
    editDMMessage: async (messageId, content) => {
        try {
            const response = await dmAPI.editMessage(messageId, content);
            set(state => ({
                dmMessages: state.dmMessages.map(msg =>
                    msg._id === messageId ? { ...msg, content: content } : msg
                )
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Delete DM message
    deleteDMMessage: async (messageId) => {
        try {
            await dmAPI.deleteMessage(messageId);
            set(state => ({
                dmMessages: state.dmMessages.filter(msg => msg._id !== messageId)
            }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    // Update DM message (for reactions, etc.)
    updateDMMessage: (messageId, updates) => {
        set(state => {
            const updatedMessages = state.dmMessages.map(msg =>
                msg._id === messageId ? { ...msg, ...updates } : msg
            );

            // Also update pinnedMessages if needed
            let updatedPinned = state.pinnedMessages;
            const messageInPinned = state.pinnedMessages.find(m => m._id === messageId);

            if (messageInPinned) {
                updatedPinned = state.pinnedMessages.map(m =>
                    m._id === messageId ? { ...m, ...updates } : m
                );
                if (updates.is_pinned === false) {
                    updatedPinned = updatedPinned.filter(m => m._id !== messageId);
                }
            } else if (updates.is_pinned === true) {
                const fullMessage = updatedMessages.find(m => m._id === messageId);
                if (fullMessage) {
                    updatedPinned = [...state.pinnedMessages, fullMessage];
                }
            }

            return {
                dmMessages: updatedMessages,
                pinnedMessages: updatedPinned
            };
        });
    },

    // Pinning Actions
    pinMessage: async (messageId) => {
        try {
            await dmAPI.pinMessage(messageId);
            // Optimistically update local state
            get().updateDMMessage(messageId, { is_pinned: true });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    unpinMessage: async (messageId) => {
        try {
            await dmAPI.unpinMessage(messageId);
            // Optimistically update local state
            get().updateDMMessage(messageId, { is_pinned: false });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail };
        }
    },

    fetchPinnedMessages: async (friendId) => {
        try {
            const response = await dmAPI.getPinnedMessages(friendId);
            set({ pinnedMessages: response.data.messages });
        } catch (error) {
            console.error('Failed to fetch pinned messages:', error);
        }
    },

    // Close DM
    closeDM: () => {
        set({ currentDMFriend: null, dmMessages: [], pinnedMessages: [], gameChallenges: [] });
    },

    // Clear friends panel state
    clearFriendsPanel: () => {
        set({
            currentDMFriend: null,
            dmMessages: [],
            pinnedMessages: [],
        });
    },

    // Fetch unread message counts
    fetchUnreadCounts: async () => {
        try {
            const response = await dmAPI.getUnreadCounts();
            set({
                unreadCounts: response.data.counts || {},
                totalUnread: response.data.total || 0
            });
        } catch (error) {
            console.error('Failed to fetch unread counts:', error);
        }
    },

    // Setup socket listeners for DMs
    // Setup socket listeners for DMs and Friend Requests
    setupSocketListeners: (socket) => {
        if (!socket) return;

        // 1. LISTENER FOR DIRECT MESSAGES
        socket.off('dm_new_message'); // Remove existing to avoid duplicates
        socket.on('dm_new_message', (newMessage) => {
            console.log("📩 Received DM via Socket:", newMessage);
            const state = get();
            const currentUserId = JSON.parse(localStorage.getItem('user') || '{}')._id;

            // Ignore own messages (sent from this client, synced back)
            if (newMessage.sender_id === currentUserId) {
                // Still add to current chat if applicable
                const isCurrentChat = state.currentDMFriend &&
                    (state.currentDMFriend._id === newMessage.receiver_id ||
                        state.currentDMFriend.id === newMessage.receiver_id);
                if (isCurrentChat) get().addDMMessage(newMessage);
                return;
            }

            // Check if this message belongs to the currently open chat
            const isCurrentChat = state.currentDMFriend &&
                (state.currentDMFriend._id === newMessage.sender_id ||
                    state.currentDMFriend.id === newMessage.sender_id);

            const appHasFocus = document.hasFocus();

            if (isCurrentChat && appHasFocus) {
                // Active chat + focused window → just add the message, no notification
                get().addDMMessage(newMessage);
            } else if (isCurrentChat && !appHasFocus) {
                // Active chat but app is minimized/unfocused → add message + notify
                get().addDMMessage(newMessage);
                const senderName = newMessage.sender_name || newMessage.sender_username || 'Someone';
                showNativeNotification(
                    `New message from ${senderName}`,
                    newMessage.content || '(attachment)',
                    { skipFocusCheck: true }
                );
                // Brief badge flash (don't increment unread since chat is open)
                updateBadgeCount(state.totalUnread > 0 ? state.totalUnread : 1);
            } else {
                // Different chat → increment unread + notify + badge
                get().incrementUnread(newMessage.sender_id);
                const newTotal = get().totalUnread;
                const senderName = newMessage.sender_name || newMessage.sender_username || 'Someone';
                showNativeNotification(
                    `New message from ${senderName}`,
                    newMessage.content || '(attachment)',
                    { skipFocusCheck: true }
                );
                updateBadgeCount(newTotal);
            }
        });

        // 2. LISTENER FOR NEW FRIEND REQUESTS (NEW!)
        socket.off('friend_request_received'); // Remove existing to avoid duplicates
        socket.on('friend_request_received', (data) => {
            console.log("🤝 Real-time Friend Request Received:", data);

            // Fetch the new pending request from API to update the list and trigger badge
            get().fetchPendingRequests();

            // Show a toast/system notification for the new friend request
            showNativeNotification(
                "New Friend Request",
                "Someone wants to connect with you on Nexus!",
                { skipFocusCheck: true }
            );
        });

        // 3. LISTENER FOR GAME CHALLENGES
        socket.off('game:challenge_received');
        socket.on('game:challenge_received', (challenge) => {
            console.log('🎮 Game challenge received:', challenge);
            const state = get();
            // If DM with challenger is open, inject into challenges
            const isCurrentChat = state.currentDMFriend &&
                (state.currentDMFriend._id === challenge.challenger_id ||
                    state.currentDMFriend.id === challenge.challenger_id);
            if (isCurrentChat) {
                get().addGameChallenge(challenge);
            }
            // Show notification
            const gameLabel = challenge.game_type === 'tic-tac-toe' ? 'Tic-Tac-Toe' : 'Rock Paper Scissors';
            showNativeNotification(
                `Game Challenge from ${challenge.challenger_name}`,
                `${challenge.challenger_name} challenged you to ${gameLabel}!`,
                { skipFocusCheck: true }
            );
        });

        socket.off('game:challenge_accepted');
        socket.on('game:challenge_accepted', (challenge) => {
            console.log('🎮 Challenge accepted:', challenge);
            get().updateGameChallenge(challenge._id, { status: 'accepted' });
            showNativeNotification(
                'Challenge Accepted!',
                `${challenge.opponent_name} accepted your challenge!`,
                { skipFocusCheck: true }
            );
        });

        socket.off('game:challenge_declined');
        socket.on('game:challenge_declined', (challenge) => {
            console.log('🎮 Challenge declined:', challenge);
            get().updateGameChallenge(challenge._id, { status: 'declined' });
            showNativeNotification(
                'Challenge Declined',
                `${challenge.opponent_name} declined your challenge.`,
                { skipFocusCheck: true }
            );
        });
    },

    // Increment unread count (for incoming messages via socket)
    incrementUnread: (friendId) => {
        set(state => {
            const newCounts = { ...state.unreadCounts };
            newCounts[friendId] = (newCounts[friendId] || 0) + 1;
            return {
                unreadCounts: newCounts,
                totalUnread: state.totalUnread + 1
            };
        });
    },
}));