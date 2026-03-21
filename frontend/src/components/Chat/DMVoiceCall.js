import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native-web';
import SimplePeer from 'simple-peer';
import { Mic, MicOff, PhoneOff, User, Volume2, VolumeX, Play } from 'lucide-react';
import {
    connectVoiceSocket,
    disconnectVoiceSocket,
    joinDMVoiceCall,
    leaveDMVoiceCall,
    sendingDMSignal,
    returningDMSignal,
    emitToggleDMMute
} from '../../services/socket';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useTranslation } from 'react-i18next';
import { resolveAssetUrl } from '../../config';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
];

// Audio visualizer for speaking detection
const useAudioLevel = (stream, isMuted) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        if (!stream || isMuted) {
            setIsSpeaking(false);
            return;
        }

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);

            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;

            microphone.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const detectSpeaking = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

                setIsSpeaking(average > 15);

                animationFrameRef.current = requestAnimationFrame(detectSpeaking);
            };

            detectSpeaking();

            return () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
            };
        } catch (err) {
            console.error('Audio level detection error:', err);
        }
    }, [stream, isMuted]);

    return isSpeaking;
};

const DMVoiceCall = ({ currentDMFriend, onEndCall }) => {
    const { t } = useTranslation();
    const [peers, setPeers] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [joined, setJoined] = useState(false);
    const { audioBlocked, setAudioBlocked } = useUIStore();
    const user = useAuthStore(state => state.user);

    const socketRef = useRef(null);
    const peersRef = useRef(new Map());
    const streamRef = useRef(null);
    const isJoiningRef = useRef(false);
    const blockedAudioRefs = useRef(new Set());

    // Speaking detection for local user
    const isSpeaking = useAudioLevel(streamRef.current, isMuted);

    const createPeer = (targetSocketID, targetUserID, targetUsername, remoteMuted, localStream) => {
        console.log(`🔵 Creating INITIATOR peer for ${targetUsername} (${targetSocketID})`);

        const peer = new SimplePeer({
            initiator: true,
            trickle: true,
            stream: localStream,
            config: { iceServers: ICE_SERVERS }
        });

        peer.on("signal", signal => {
            console.log(`📤 Sending signal to ${targetUsername}`);
            sendingDMSignal({
                userToSignal: targetSocketID,
                callerID: socketRef.current?.id,
                signal
            });
        });

        peer.on("connect", () => {
            console.log(`✅ Connected to ${targetUsername}`);
        });

        peer.on("error", err => {
            if (err.message?.includes('User-Initiated Abort')) return;
            console.error(`❌ Peer Error (Initiator) for ${targetUsername}:`, err.message);
        });

        peer.on("close", () => {
            console.log(`🔴 Peer closed for ${targetUsername}`);
            removePeer(targetSocketID);
        });

        return peer;
    };

    const addPeer = (incomingSignal, callerSocketID, localStream) => {
        console.log(`🔵 Creating RECEIVER peer for ${callerSocketID}`);

        const peer = new SimplePeer({
            initiator: false,
            trickle: true,
            stream: localStream,
            config: { iceServers: ICE_SERVERS }
        });

        peer.on("signal", signal => {
            console.log(`📤 Returning signal to ${callerSocketID}`);
            returningDMSignal({
                signal,
                callerID: callerSocketID
            });
        });

        peer.on("connect", () => {
            console.log(`✅ Connected (receiver) to ${callerSocketID}`);
        });

        peer.on("error", err => {
            if (err.message?.includes('User-Initiated Abort')) return;
            console.error(`❌ Peer Error (Receiver) for ${callerSocketID}:`, err.message);
        });

        peer.on("close", () => {
            console.log(`🔴 Peer closed (receiver) for ${callerSocketID}`);
            removePeer(callerSocketID);
        });

        peer.signal(incomingSignal);

        return peer;
    };

    const resumeAllAudio = async () => {
        console.log("🔊 Resuming all blocked audio...");

        for (const [peerID, peerObj] of peersRef.current.entries()) {
            if (peerObj.audioRef?.current && blockedAudioRefs.current.has(peerID)) {
                try {
                    await peerObj.audioRef.current.play();
                    console.log(`✅ Resumed audio for ${peerObj.username}`);
                    blockedAudioRefs.current.delete(peerID);
                } catch (err) {
                    if (err.name === 'NotAllowedError') {
                        console.warn(`⚠️ Still blocked: ${peerObj.username}`, err.message);
                    }
                }
            }
        }

        setAudioBlocked(blockedAudioRefs.current.size > 0);
    };

    const updatePeersState = () => {
        const peerArray = Array.from(peersRef.current.values());
        console.log(`📊 Updating UI with ${peerArray.length} peers:`, peerArray.map(p => p.username));
        setPeers(peerArray);
    };

    const removePeer = (peerID) => {
        console.log(`🗑️ Removing peer: ${peerID}`);

        const peerObj = peersRef.current.get(peerID);
        if (!peerObj) {
            console.warn(`⚠️ Peer ${peerID} not found in Map`);
            return;
        }

        console.log(`🗑️ Cleaning up peer: ${peerObj.username}`);

        // Stop and clean audio
        if (peerObj.audioRef?.current) {
            try {
                const audioEl = peerObj.audioRef.current;
                audioEl.pause();
                audioEl.srcObject = null;
                console.log(`✅ Audio cleaned for ${peerObj.username}`);
            } catch (e) {
                console.error(`❌ Error cleaning audio for ${peerID}:`, e);
            }
        }

        // Destroy peer connection
        try {
            peerObj.peer.destroy();
            console.log(`✅ Peer destroyed for ${peerObj.username}`);
        } catch (e) {
            console.error(`❌ Error destroying peer ${peerID}:`, e);
        }

        // Remove from Map
        peersRef.current.delete(peerID);
        blockedAudioRefs.current.delete(peerID);

        console.log(`✅ Peer ${peerID} removed. Remaining peers:`, peersRef.current.size);

        // Update UI
        updatePeersState();
        setAudioBlocked(blockedAudioRefs.current.size > 0);
    };

    // Initialize socket connection
    useEffect(() => {
        console.log('🚀 Initializing DM voice socket...');

        socketRef.current = connectVoiceSocket({
            onDMAllUsers: (users) => {
                console.log('📥 DM_ALL_USERS received:', users);

                if (!streamRef.current) {
                    console.log('⏳ Stream not ready, ignoring dm_all_users');
                    return;
                }

                // Filter out ourselves and duplicates
                const filteredUsers = users.filter(u => {
                    const isDuplicate = peersRef.current.has(u.sid);
                    const isSelf = u.sid === socketRef.current?.id;
                    return !isSelf && !isDuplicate;
                });

                console.log(`Creating ${filteredUsers.length} initiator peers`);

                filteredUsers.forEach(u => {
                    const peer = createPeer(u.sid, u.user_id, u.username, u.is_muted, streamRef.current);

                    const peerObj = {
                        peerID: u.sid,
                        peer,
                        userID: u.user_id,
                        username: u.username,
                        isMuted: u.is_muted || false,
                        audioRef: React.createRef(),
                        streamRef: null,
                        isSpeaking: false,
                    };

                    peersRef.current.set(u.sid, peerObj);
                    console.log(`✅ Added peer to Map: ${u.username} (${u.sid})`);
                });

                updatePeersState();
            },

            onDMUserJoined: (payload) => {
                console.log('📥 DM_USER_JOINED received:', payload);

                // Check if it's ourselves
                if (payload.callerID === socketRef.current?.id) return;

                // Check for duplicate
                if (peersRef.current.has(payload.callerID)) return;

                if (!streamRef.current) return;

                const peer = addPeer(payload.signal, payload.callerID, streamRef.current);

                const peerObj = {
                    peerID: payload.callerID,
                    peer,
                    userID: payload.user_id,
                    username: payload.username || 'Unknown',
                    isMuted: payload.is_muted || false,
                    audioRef: React.createRef(),
                    streamRef: null,
                    isSpeaking: false,
                };

                peersRef.current.set(payload.callerID, peerObj);
                updatePeersState();
            },

            onDMReceivingReturnedSignal: (payload) => {
                console.log('📥 DM_RECEIVING_RETURNED_SIGNAL:', payload.id);

                const peerObj = peersRef.current.get(payload.id);
                if (peerObj && peerObj.peer) {
                    peerObj.peer.signal(payload.signal);
                }
            },

            onDMUserLeft: (socketId) => {
                console.log('📥 DM_USER_LEFT received:', socketId);
                removePeer(socketId);
            },

            onDMUserMuted: (data) => {
                console.log('📥 DM_USER_MUTED:', data);
                const peerObj = peersRef.current.get(data.sid);
                if (peerObj) {
                    const updatedPeerObj = { ...peerObj, isMuted: data.is_muted };
                    peersRef.current.set(data.sid, updatedPeerObj);
                    if (updatedPeerObj.audioRef?.current) {
                        updatedPeerObj.audioRef.current.volume = data.is_muted ? 0 : 1.0;
                    }
                    updatePeersState();
                }
            },

            onDisconnect: () => {
                console.warn('🔌 DM voice socket disconnected');
            }
        });

        // Auto-join upon mounting
        handleJoinVoice();

        return () => {
            console.log('🧹 Cleanup: Destroying DM peers and disconnecting...');
            handleLeaveVoice(true); // pass true for "silent" clean up (without triggering onEndCall prop again)
        };
        // eslint-disable-next-line
    }, [currentDMFriend]);

    const handleJoinVoice = async () => {
        if (isJoiningRef.current) return;
        isJoiningRef.current = true;

        try {
            console.log('🎤 Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            console.log('✅ Microphone access granted');
            streamRef.current = stream;

            const targetUserId = currentDMFriend.id || currentDMFriend._id;
            console.log('📡 Joining DM voice channel with user:', targetUserId);
            await joinDMVoiceCall(targetUserId);

            setJoined(true);
        } catch (err) {
            console.error('❌ Error joining voice:', err);
            // alert(`${t('voice.failed_to_join', 'Failed to join voice channel:')} ${err.message}`);
            // If we fail to get permissions or join, auto-end the call:
            if (onEndCall) onEndCall();
        } finally {
            isJoiningRef.current = false;
        }
    };

    const handleLeaveVoice = (isUnmounting = false) => {
        console.log('👋 Leaving DM voice channel...');

        // Notify server
        leaveDMVoiceCall();

        // Clean up locally
        peersRef.current.forEach((peerObj, id) => {
            try { peerObj.peer.destroy(); } catch (e) { }
            if (peerObj.audioRef?.current) {
                try {
                    peerObj.audioRef.current.srcObject = null;
                    peerObj.audioRef.current.pause();
                } catch (e) { }
            }
        });

        peersRef.current.clear();
        blockedAudioRefs.current.clear();
        setPeers([]);
        setAudioBlocked(false);

        // Stop microphone
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        setJoined(false);
        setIsMuted(false);

        if (!isUnmounting && onEndCall) {
            onEndCall();
        }
    };

    const toggleMute = () => {
        const newMute = !isMuted;
        setIsMuted(newMute);

        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !newMute;
            });
        }

        emitToggleDMMute({ is_muted: newMute });
    };

    const SpeakingIndicator = ({ isSpeaking }) => {
        const pulseAnim = useRef(new Animated.Value(1)).current;

        useEffect(() => {
            if (isSpeaking) {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, { toValue: 1.3, duration: 300, useNativeDriver: false }),
                        Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
                    ])
                ).start();
            } else {
                pulseAnim.setValue(1);
            }
        }, [isSpeaking, pulseAnim]);

        if (!isSpeaking) return null;
        return (
            <Animated.View style={[styles.speakingRing, { transform: [{ scale: pulseAnim }] }]} />
        );
    };

    const AudioPeer = ({ peerObj }) => {
        const [remoteSpeaking, setRemoteSpeaking] = useState(false);
        const audioContextRef = useRef(null);
        const animationFrameRef = useRef(null);
        const audioRef = useRef(null);
        const playPromiseRef = useRef(null);

        useEffect(() => {
            const peer = peerObj.peer;

            const handleStream = async (stream) => {
                peerObj.streamRef = stream;

                if (audioRef.current) {
                    audioRef.current.srcObject = stream;
                    audioRef.current.muted = false;

                    try {
                        playPromiseRef.current = audioRef.current.play();
                        await playPromiseRef.current;
                    } catch (e) {
                        if (e.name === 'NotAllowedError') {
                            console.warn("Autoplay prevented:", e);
                            setAudioBlocked(true);
                            blockedAudioRefs.current.add(peerObj.peerID);
                        } else if (e.name !== 'AbortError') {
                            console.warn("Autoplay prevented (other):", e);
                        }
                    }
                }

                if (!peerObj.isMuted) {
                    try {
                        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                            await audioContextRef.current.close();
                        }

                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const analyser = audioContext.createAnalyser();
                        const source = audioContext.createMediaStreamSource(stream);

                        analyser.smoothingTimeConstant = 0.8;
                        analyser.fftSize = 1024;
                        source.connect(analyser);

                        audioContextRef.current = audioContext;
                        const dataArray = new Uint8Array(analyser.frequencyBinCount);

                        const detectSpeaking = () => {
                            analyser.getByteFrequencyData(dataArray);
                            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
                            setRemoteSpeaking(average > 15);
                            animationFrameRef.current = requestAnimationFrame(detectSpeaking);
                        };
                        detectSpeaking();
                    } catch (err) { }
                } else {
                    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                        audioContextRef.current.close().catch(() => { });
                    }
                }
            };

            if (peerObj.streamRef) {
                handleStream(peerObj.streamRef);
            } else if (peer._remoteStreams && peer._remoteStreams.length > 0) {
                handleStream(peer._remoteStreams[0]);
            }

            peer.on("stream", handleStream);

            return () => {
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                    audioContextRef.current.close().catch(() => { });
                }
                peer.off("stream", handleStream);
            };
        }, [peerObj, peerObj.isMuted]);

        useEffect(() => {
            peerObj.isSpeaking = remoteSpeaking && !peerObj.isMuted;
        }, [remoteSpeaking, peerObj.isMuted, peerObj]);

        return <audio playsInline autoPlay ref={audioRef} />;
    };

    if (!joined && isJoiningRef.current) {
        return (
            <View style={styles.bannerContainer}>
                <Text style={styles.connectingText}>{t('voice.attuning', 'Starting Voice Call...')}</Text>
            </View>
        );
    } else if (!joined) {
        return null;
    }

    return (
        <View style={styles.bannerContainer}>
            {audioBlocked && (
                <View style={styles.audioBlockedBanner}>
                    <VolumeX size={16} color="#f59e0b" />
                    <Text style={styles.audioBlockedText}>
                        {t('voice.audio_blocked', 'Audio blocked by browser.')}
                    </Text>
                    <TouchableOpacity style={styles.enableAudioBtn} onPress={resumeAllAudio}>
                        <Play size={14} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.bannerContent}>
                <View style={styles.avatarsRow}>
                    {/* Local User */}
                    <View style={styles.avatarWrapper}>
                        {isSpeaking && !isMuted && <SpeakingIndicator isSpeaking={true} />}
                        <View style={[styles.avatarSmall, isMuted && styles.avatarMuted, isSpeaking && !isMuted && styles.avatarSpeaking]}>
                            {user?.avatar_url ? (
                                <img
                                    src={resolveAssetUrl(user.avatar_url)}
                                    style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                    alt=""
                                />
                            ) : (
                                <User size={20} color="#d1d5db" />
                            )}
                        </View>
                        {isMuted && (
                            <View style={styles.muteBadge}>
                                <MicOff size={10} color="#ef4444" />
                            </View>
                        )}
                    </View>

                    {/* Remote Peer(s) - Should practically be just 1 in DM */}
                    {peers.map((p) => (
                        <View key={p.peerID} style={styles.avatarWrapper}>
                            {p.isSpeaking && !p.isMuted && <SpeakingIndicator isSpeaking={true} />}
                            <View style={[styles.avatarSmall, p.isMuted && styles.avatarMuted, p.isSpeaking && !p.isMuted && styles.avatarSpeaking]}>
                                {currentDMFriend?.avatar_url ? (
                                    <img
                                        src={resolveAssetUrl(currentDMFriend.avatar_url)}
                                        style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                        alt=""
                                    />
                                ) : (
                                    <User size={20} color="#d1d5db" />
                                )}
                            </View>
                            {p.isMuted && (
                                <View style={styles.muteBadge}>
                                    <MicOff size={10} color="#ef4444" />
                                </View>
                            )}
                            <AudioPeer peerObj={p} />
                        </View>
                    ))}

                    {peers.length === 0 && (
                        <View style={styles.avatarWrapper}>
                            <View style={[styles.avatarSmall, styles.avatarWaiting]}>
                                <User size={20} color="#64748b" />
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.callInfo}>
                    <Text style={styles.callText}>
                        {peers.length > 0 ? t('voice.call_active', 'Voice Call Active') : t('voice.waiting', 'Waiting for user...')}
                    </Text>
                </View>

                <View style={styles.controlsRow}>
                    <TouchableOpacity
                        style={[styles.smallControlBtn, isMuted && styles.mutedBtn]}
                        onPress={toggleMute}
                    >
                        {isMuted ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#fff" />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.smallControlBtn, styles.leaveBtn]}
                        onPress={() => handleLeaveVoice(false)}
                    >
                        <PhoneOff size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    bannerContainer: {
        backgroundColor: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: '#0f172a',
        paddingVertical: 12,
        paddingHorizontal: 16,
        zIndex: 10,
    },
    connectingText: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    audioBlockedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#78350f',
        padding: 8,
        borderRadius: 8,
        marginBottom: 8,
        gap: 8,
    },
    audioBlockedText: {
        flex: 1,
        color: '#fbbf24',
        fontSize: 12,
    },
    enableAudioBtn: {
        backgroundColor: '#f59e0b',
        padding: 6,
        borderRadius: 6,
    },
    avatarsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: -8, // slight overlap
    },
    avatarWrapper: {
        position: 'relative',
        marginRight: 16,
    },
    avatarSmall: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#1e293b',
    },
    avatarWaiting: {
        opacity: 0.5,
        borderStyle: 'dashed',
    },
    avatarSpeaking: {
        borderColor: '#10b981',
    },
    avatarMuted: {
        borderColor: '#64748b',
        opacity: 0.7,
    },
    speakingRing: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#10b981',
        top: -2,
        left: -2,
    },
    muteBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        padding: 2,
    },
    callInfo: {
        flex: 1,
        marginLeft: 8,
    },
    callText: {
        color: '#f1f5f9',
        fontSize: 14,
        fontWeight: '600',
    },
    controlsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    smallControlBtn: {
        backgroundColor: '#334155',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    mutedBtn: {
        backgroundColor: '#991b1b',
    },
    leaveBtn: {
        backgroundColor: '#991b1b',
    },
});

export default DMVoiceCall;
