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
        const set = useVoiceStore.setState;

        socket.off('incoming_dm_call');
        socket.on('incoming_dm_call', (callerData) => {
            set({ incomingCall: callerData });
        });

        socket.off('dm_call_declined');
        socket.on('dm_call_declined', (data) => {
            set({ callDeclinedBy: data.declined_by });
        });

        socket.off('dm_call_accepted');
        socket.on('dm_call_accepted', (data) => {
            set({ callAnsweredBy: data.accepted_by });
        });

        socket.off('dm_call_cancelled');
        socket.on('dm_call_cancelled', () => {
            set({ incomingCall: null });
        });
    }
}));
