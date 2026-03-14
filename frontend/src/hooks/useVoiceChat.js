import { useState, useRef, useCallback, useEffect } from 'react';
import {
    connectVoiceSocket,
    disconnectVoiceSocket,
    joinVoiceChannel,
    leaveVoiceChannel,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    toggleMute as socketToggleMute,
} from '../services/socket';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

const AUDIO_CONSTRAINTS = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    video: false
};

export const useVoiceChat = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [currentChannel, setCurrentChannel] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [error, setError] = useState(null);

    // Refs for peer connections and streams
    const localStream = useRef(null);
    const peerConnections = useRef({}); // { [userId]: RTCPeerConnection }
    const remoteAudios = useRef({}); // { [userId]: HTMLAudioElement }

    // Initialize Socket handlers
    useEffect(() => {
        const handlers = {
            onUserJoined: handleUserJoined,
            onUserLeft: handleUserLeft,
            onOffer: handleOffer,
            onAnswer: handleAnswer,
            onIceCandidate: handleIceCandidate,
            onMuteChanged: handleMuteChanged,
        };

        connectVoiceSocket(handlers);

        return () => {
            cleanup();
        };
    }, []);

    // Cleanup function
    const cleanup = useCallback(() => {
        // Stop local stream
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
            localStream.current = null;
        }

        // Close all peer connections
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};

        // Remove audio elements
        Object.values(remoteAudios.current).forEach(audio => {
            audio.srcObject = null;
        });
        remoteAudios.current = {};
    }, []);

    // Join voice channel
    const joinChannel = useCallback(async (channelId) => {
        try {
            setError(null);

            // Get local audio stream
            localStream.current = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);

            // Join via socket
            const response = await joinVoiceChannel(channelId);

            setIsConnected(true);
            setCurrentChannel(channelId);
            setParticipants(response.participants || []);

            // Create peer connections for existing participants
            for (const participant of response.participants || []) {
                await createPeerConnection(participant.user_id, true);
            }

        } catch (err) {
            setError(err.message);
            cleanup();
        }
    }, [cleanup]);

    // Leave voice channel
    const leaveChannel = useCallback(async () => {
        try {
            await leaveVoiceChannel();
        } catch (err) {
            console.error('Leave error:', err);
        } finally {
            cleanup();
            setIsConnected(false);
            setCurrentChannel(null);
            setParticipants([]);
        }
    }, [cleanup]);

    // Create peer connection
    const createPeerConnection = useCallback(async (userId, isInitiator) => {
        if (peerConnections.current[userId]) {
            console.log(`PC already exists for ${userId}`);
            return peerConnections.current[userId];
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[userId] = pc;

        // Add local stream tracks
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => {
                pc.addTrack(track, localStream.current);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendIceCandidate(userId, event.candidate);
            }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
            console.log(`Received track from ${userId}`);

            if (!remoteAudios.current[userId]) {
                const audio = new Audio();
                audio.autoplay = true;
                remoteAudios.current[userId] = audio;
            }

            remoteAudios.current[userId].srcObject = event.streams[0];
        };

        // Handle connection state
        pc.onconnectionstatechange = () => {
            console.log(`PC ${userId} state: ${pc.connectionState}`);
        };

        // Create offer if initiator
        if (isInitiator) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendOffer(userId, offer);
        }

        return pc;
    }, []);

    // Handle new user joined
    const handleUserJoined = useCallback(async (data) => {
        console.log('User joined:', data);
        setParticipants(prev => [...prev, data]);

        // Create offer for new user
        await createPeerConnection(data.user_id, true);
    }, [createPeerConnection]);

    // Handle user left
    const handleUserLeft = useCallback((data) => {
        console.log('User left:', data);
        setParticipants(prev => prev.filter(p => p.user_id !== data.user_id));

        // Cleanup peer connection
        if (peerConnections.current[data.user_id]) {
            peerConnections.current[data.user_id].close();
            delete peerConnections.current[data.user_id];
        }

        // Cleanup audio
        if (remoteAudios.current[data.user_id]) {
            remoteAudios.current[data.user_id].srcObject = null;
            delete remoteAudios.current[data.user_id];
        }
    }, []);

    // Handle incoming offer
    const handleOffer = useCallback(async (data) => {
        console.log('Received offer from:', data.from_user_id);

        const pc = await createPeerConnection(data.from_user_id, false);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendAnswer(data.from_user_id, answer);
    }, [createPeerConnection]);

    // Handle incoming answer
    const handleAnswer = useCallback(async (data) => {
        console.log('Received answer from:', data.from_user_id);

        const pc = peerConnections.current[data.from_user_id];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    }, []);

    // Handle ICE candidate
    const handleIceCandidate = useCallback(async (data) => {
        const pc = peerConnections.current[data.from_user_id];
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }, []);

    // Handle mute changed
    const handleMuteChanged = useCallback((data) => {
        setParticipants(prev => prev.map(p =>
            p.user_id === data.user_id
                ? { ...p, is_muted: data.is_muted }
                : p
        ));
    }, []);

    // Toggle mute
    const toggleMute = useCallback(async () => {
        try {
            const response = await socketToggleMute();
            setIsMuted(response.is_muted);

            // Mute/unmute local audio track
            if (localStream.current) {
                localStream.current.getAudioTracks().forEach(track => {
                    track.enabled = !response.is_muted;
                });
            }
        } catch (err) {
            setError(err.message);
        }
    }, []);

    return {
        isConnected,
        isMuted,
        isDeafened,
        currentChannel,
        participants,
        error,
        joinChannel,
        leaveChannel,
        toggleMute,
    };
};
