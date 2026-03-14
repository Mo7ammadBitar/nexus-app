import { io } from 'socket.io-client';
import { useTypingStore } from '../store/typingStore';

const SOCKET_URL = 'http://localhost:8000';

// Chat Socket
let chatSocket = null;
// Voice Socket
let voiceSocket = null;
// Current handlers for dynamic updates
let currentMessageHandler = null;
let currentTypingHandler = null;
let currentStopTypingHandler = null;

// Get user auth data
const getAuthData = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (user) {
        const userData = JSON.parse(user);
        return {
            user_id: userData._id,
            username: userData.username,
            token
        };
    }
    return null;
};

// Chat Socket Connection
export const connectChatSocket = (onMessage, onTyping, onStopTyping) => {
    // Update current handlers
    currentMessageHandler = onMessage;
    currentTypingHandler = onTyping;
    currentStopTypingHandler = onStopTyping;

    if (chatSocket?.connected) {
        return chatSocket;
    }

    const auth = getAuthData();
    if (!auth) return null;

    chatSocket = io(`${SOCKET_URL}/chat`, {
        auth,
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });

    chatSocket.on('connect', () => {
        console.log('🔌 Chat connected');
    });

    chatSocket.on('disconnect', () => {
        console.log('🔌 Chat disconnected');
    });

    chatSocket.on('new_message', (message) => {
        if (currentMessageHandler) currentMessageHandler(message);
    });

    chatSocket.on('user_typing', (data) => {
        if (currentTypingHandler) currentTypingHandler(data);
    });

    chatSocket.on('user_stopped_typing', (data) => {
        if (currentStopTypingHandler) currentStopTypingHandler(data);
    });

    return chatSocket;
};

export const disconnectChatSocket = () => {
    if (chatSocket && chatSocket.connected) {
        chatSocket.disconnect();
        chatSocket = null;
    }
};

// Initialize presence socket connection (auto-connect for online tracking)
export const initPresence = () => {
    if (chatSocket?.connected) return chatSocket;

    const auth = getAuthData();
    if (!auth) return null;

    chatSocket = io(`${SOCKET_URL}/chat`, {
        auth,
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });

    chatSocket.on('connect', () => {
        console.log('🔌 Presence connected - user is now online');
    });

    chatSocket.on('disconnect', () => {
        console.log('🔌 Presence disconnected - user is now offline');
    });

    // DM typing listeners
    chatSocket.on('dm_user_typing', (data) => {
        useTypingStore.getState().setDMTyping(data.sender_id, data.sender_username);
    });

    chatSocket.on('dm_user_stopped_typing', (data) => {
        useTypingStore.getState().clearDMTyping(data.sender_id);
    });

    return chatSocket;
};

export const joinChannel = (channelId) => {
    return new Promise((resolve, reject) => {
        if (!chatSocket) {
            reject(new Error('Not connected'));
            return;
        }
        chatSocket.emit('join_channel', { channel_id: channelId }, (response) => {
            if (response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response);
            }
        });
    });
};

export const leaveChannel = (channelId) => {
    if (chatSocket) {
        chatSocket.emit('leave_channel', { channel_id: channelId });
    }
};

export const sendMessage = (channelId, content) => {
    return new Promise((resolve, reject) => {
        if (!chatSocket) {
            reject(new Error('Not connected'));
            return;
        }
        chatSocket.emit('send_message', { channel_id: channelId, content }, (response) => {
            if (response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response);
            }
        });
    });
};

export const startTyping = (channelId) => {
    if (chatSocket) {
        chatSocket.emit('typing_start', { channel_id: channelId });
    }
};

export const stopTyping = (channelId) => {
    if (chatSocket) {
        chatSocket.emit('typing_stop', { channel_id: channelId });
    }
};

// DM Typing functions
export const startDMTyping = (receiverId) => {
    if (chatSocket) {
        chatSocket.emit('dm_typing_start', { receiver_id: receiverId });
    }
};

export const stopDMTyping = (receiverId) => {
    if (chatSocket) {
        chatSocket.emit('dm_typing_stop', { receiver_id: receiverId });
    }
};

// ==========================================
// DM CALL GLOBALS
// ==========================================

export const initiateDMCall = (receiverId) => {
    if (chatSocket?.connected) {
        chatSocket.emit('initiate_dm_call', { receiver_id: receiverId });
    }
};

export const declineDMCall = (callerId) => {
    if (chatSocket?.connected) {
        chatSocket.emit('decline_dm_call', { caller_id: callerId });
    }
};

export const cancelDMCall = (receiverId) => {
    if (chatSocket?.connected) {
        chatSocket.emit('cancel_dm_call', { receiver_id: receiverId });
    }
};

export const acceptDMCall = (callerId) => {
    if (chatSocket?.connected) {
        chatSocket.emit('accept_dm_call', { caller_id: callerId });
    }
};

// Voice Socket Connection
// Current voice handlers
let currentVoiceHandlers = null;

export const connectVoiceSocket = (handlers) => {
    console.log('🎤 Connecting voice socket...');
    currentVoiceHandlers = handlers;

    if (voiceSocket?.connected) {
        console.log('🎤 Voice socket already connected');
        return voiceSocket;
    }

    const auth = getAuthData();
    if (!auth) {
        console.error('❌ No auth data found');
        return null;
    }

    voiceSocket = io(`${SOCKET_URL}/voice`, {
        auth,
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });

    voiceSocket.on('connect', () => {
        console.log('✅ Voice socket connected, ID:', voiceSocket.id);
    });

    voiceSocket.on('disconnect', (reason) => {
        console.log('🔌 Voice disconnected, reason:', reason);
        if (currentVoiceHandlers?.onDisconnect) {
            currentVoiceHandlers.onDisconnect();
        }
    });

    voiceSocket.on('connect_error', (error) => {
        console.error('❌ Voice connection error:', error);
    });

    // List of users in room (triggers creating initiator peers)
    voiceSocket.on('all_users', (users) => {
        console.log('📥 Received all_users:', users);
        if (currentVoiceHandlers?.onAllUsers) {
            currentVoiceHandlers.onAllUsers(users);
        }
    });

    // A user joined (signals incoming call)
    voiceSocket.on('user_joined', (payload) => {
        console.log('📥 Received user_joined:', payload);
        if (currentVoiceHandlers?.onUserJoined) {
            currentVoiceHandlers.onUserJoined(payload);
        }
    });

    // Received returned signal (answer)
    voiceSocket.on('receiving_returned_signal', (payload) => {
        console.log('📥 Received receiving_returned_signal:', payload);
        if (currentVoiceHandlers?.onReceivingReturnedSignal) {
            currentVoiceHandlers.onReceivingReturnedSignal(payload);
        }
    });

    // User left - Handle both string and object formats
    voiceSocket.on('user_left', (data) => {
        console.log('📥 Received user_left:', data, 'Type:', typeof data);
        if (currentVoiceHandlers?.onUserLeft) {
            // If data is a string (just socket ID), pass it directly
            // If data is an object, extract the ID
            const userId = typeof data === 'string' ? data : (data.id || data.sid || data.socket_id);
            console.log('Processing user_left for ID:', userId);
            currentVoiceHandlers.onUserLeft(userId);
        }
    });

    // Mute sync
    voiceSocket.on('user_muted', (data) => {
        console.log('📥 Received user_muted:', data);
        if (currentVoiceHandlers?.onUserMuted) {
            currentVoiceHandlers.onUserMuted(data);
        }
    });

    // ==========================================
    // DM Specific Voice Events
    // ==========================================
    voiceSocket.on('dm_all_users', (users) => {
        console.log('📥 Received dm_all_users:', users);
        if (currentVoiceHandlers?.onDMAllUsers) {
            currentVoiceHandlers.onDMAllUsers(users);
        }
    });

    voiceSocket.on('dm_user_joined', (payload) => {
        console.log('📥 Received dm_user_joined:', payload);
        if (currentVoiceHandlers?.onDMUserJoined) {
            currentVoiceHandlers.onDMUserJoined(payload);
        }
    });

    voiceSocket.on('dm_receiving_returned_signal', (payload) => {
        console.log('📥 Received dm_receiving_returned_signal:', payload);
        if (currentVoiceHandlers?.onDMReceivingReturnedSignal) {
            currentVoiceHandlers.onDMReceivingReturnedSignal(payload);
        }
    });

    voiceSocket.on('dm_user_left', (data) => {
        console.log('📥 Received dm_user_left:', data);
        if (currentVoiceHandlers?.onDMUserLeft) {
            const userId = typeof data === 'string' ? data : (data.id || data.sid || data.socket_id);
            currentVoiceHandlers.onDMUserLeft(userId);
        }
    });

    voiceSocket.on('dm_user_muted', (data) => {
        console.log('📥 Received dm_user_muted:', data);
        if (currentVoiceHandlers?.onDMUserMuted) {
            currentVoiceHandlers.onDMUserMuted(data);
        }
    });

    return voiceSocket;
};

export const disconnectVoiceSocket = () => {
    console.log('🔌 Disconnecting voice socket...');
    if (voiceSocket) {
        voiceSocket.removeAllListeners(); // Clean up all event listeners
        if (voiceSocket.connected) voiceSocket.disconnect();
        voiceSocket = null;
        currentVoiceHandlers = null;
    }
};

export const joinVoiceChannel = (channelId) => {
    return new Promise((resolve, reject) => {
        if (!voiceSocket || !voiceSocket.connected) {
            console.error('❌ Voice socket not connected');
            reject(new Error('Not connected'));
            return;
        }

        const auth = getAuthData();
        if (!auth) {
            reject(new Error('No auth data'));
            return;
        }

        console.log('📤 Emitting join_voice for channel:', channelId);

        voiceSocket.emit('join_voice', {
            room_id: channelId,
            user_id: auth.user_id,
            username: auth.username
        });

        resolve();
    });
};

export const leaveVoiceChannel = (channelId) => {
    if (voiceSocket && voiceSocket.connected) {
        console.log('📤 Emitting leave_voice for channel:', channelId);

        // Emit with room_id to help server identify which room to leave
        voiceSocket.emit('leave_voice', { room_id: channelId });
    } else {
        console.warn('⚠️ Cannot leave voice - socket not connected');
    }
};

export const sendingSignal = (payload) => {
    if (voiceSocket && voiceSocket.connected) {
        console.log('📤 Sending signal to:', payload.userToSignal);
        voiceSocket.emit('sending_signal', payload);
    } else {
        console.warn('⚠️ Cannot send signal - socket not connected');
    }
};

export const returningSignal = (payload) => {
    if (voiceSocket && voiceSocket.connected) {
        console.log('📤 Returning signal to:', payload.callerID);
        voiceSocket.emit('returning_signal', payload);
    } else {
        console.warn('⚠️ Cannot return signal - socket not connected');
    }
};

export const emitToggleMute = (payload) => {
    if (voiceSocket && voiceSocket.connected) {
        console.log('📤 Toggling mute:', payload);
        voiceSocket.emit('toggle_mute', payload);
    } else {
        console.warn('⚠️ Cannot toggle mute - socket not connected');
    }
};

// =========================================================================
// DIRECT MESSAGE (DM) VOICE CALL TARGETS
// =========================================================================

export const joinDMVoiceCall = (targetUserId) => {
    return new Promise((resolve, reject) => {
        if (!voiceSocket || !voiceSocket.connected) {
            console.error('❌ Voice socket not connected');
            reject(new Error('Not connected'));
            return;
        }

        const auth = getAuthData();
        if (!auth) {
            reject(new Error('No auth data'));
            return;
        }

        console.log('📤 Emitting join_dm_call with target:', targetUserId);

        voiceSocket.emit('join_dm_call', {
            target_user_id: targetUserId,
            user_id: auth.user_id,
            username: auth.username
        });

        resolve();
    });
};

export const leaveDMVoiceCall = () => {
    if (voiceSocket && voiceSocket.connected) {
        console.log('📤 Emitting leave_dm_call');
        voiceSocket.emit('leave_dm_call');
    } else {
        console.warn('⚠️ Cannot leave DM voice - socket not connected');
    }
};

export const sendingDMSignal = (payload) => {
    if (voiceSocket && voiceSocket.connected) {
        console.log('📤 Sending DM signal to:', payload.userToSignal);
        voiceSocket.emit('sending_dm_signal', payload);
    } else {
        console.warn('⚠️ Cannot send DM signal - socket not connected');
    }
};

export const returningDMSignal = (payload) => {
    if (voiceSocket && voiceSocket.connected) {
        console.log('📤 Returning DM signal to:', payload.callerID);
        voiceSocket.emit('returning_dm_signal', payload);
    } else {
        console.warn('⚠️ Cannot return DM signal - socket not connected');
    }
};

export const emitToggleDMMute = (payload) => {
    if (voiceSocket && voiceSocket.connected) {
        console.log('📤 Toggling DM mute:', payload);
        voiceSocket.emit('toggle_dm_mute', payload);
    } else {
        console.warn('⚠️ Cannot toggle DM mute - socket not connected');
    }
};

export { chatSocket, voiceSocket };