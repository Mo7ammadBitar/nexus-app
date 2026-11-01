import { create } from 'zustand';

export const useVoiceStore = create((set) => ({
    // Global Call UI State
    incomingCall: null, // { caller_id, caller_username, caller_avatar, receiver_id }
    callDeclinedBy: null, // target_id if they declined our call
    acceptedCall: null,   // caller_id if we accepted their call
    callAnsweredBy: null, // target_id if they answered our call

    // Active Call Device State
    isMuted: false,
    isDeafened: false,

    setIncomingCall: (callData) => set({ incomingCall: callData }),
    setCallDeclinedBy: (userId) => set({ callDeclinedBy: userId }),
    setAcceptedCall: (callerId) => set({ acceptedCall: callerId }),
    setCallAnsweredBy: (userId) => set({ callAnsweredBy: userId }),

    toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
    toggleDeafen: () => set((state) => ({ isDeafened: !state.isDeafened })),

    // Setup socket listeners for DM Calls on the main chat socket
    setupVoiceSocketListeners: (socket) => {
        if (!socket) return;

        socket.off('incoming_dm_call', handleIncomingDMCall);
        socket.on('incoming_dm_call', handleIncomingDMCall);

        socket.off('dm_call_declined', handleDMCallDeclined);
        socket.on('dm_call_declined', handleDMCallDeclined);

        socket.off('dm_call_accepted', handleDMCallAccepted);
        socket.on('dm_call_accepted', handleDMCallAccepted);

        socket.off('dm_call_cancelled', handleDMCallCancelled);
        socket.on('dm_call_cancelled', handleDMCallCancelled);
    }
}));

// Stable named handlers for voiceStore socket events
const handleIncomingDMCall = (callerData) => {
    useVoiceStore.setState({ incomingCall: callerData });
};

const handleDMCallDeclined = (data) => {
    useVoiceStore.setState({ callDeclinedBy: data.declined_by });
};

const handleDMCallAccepted = (data) => {
    useVoiceStore.setState({ callAnsweredBy: data.accepted_by });
};

const handleDMCallCancelled = () => {
    useVoiceStore.setState({ incomingCall: null });
};

