import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native-web';
import SimplePeer from 'simple-peer';
import { Mic, MicOff, PhoneOff, User, Volume2, VolumeX, Play } from 'lucide-react';
import {
    connectVoiceSocket,
    disconnectVoiceSocket,
    joinVoiceChannel,
    leaveVoiceChannel,
    sendingSignal,
    returningSignal,
    emitToggleMute
} from '../../services/socket';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
];

// Speaking indicator component with animation
const SpeakingIndicator = ({ isSpeaking }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isSpeaking) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.3,
                        duration: 300,
                        useNativeDriver: false, // <--- CHANGED THIS
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: false, // <--- CHANGED THIS
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isSpeaking]);

    if (!isSpeaking) return null;

    return (
        <Animated.View
            style={[
                styles.speakingRing,
                { transform: [{ scale: pulseAnim }] },
            ]}
        />
    );
};

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

const VoiceChannel = ({ channelId }) => {
    const { t } = useTranslation();
    const [peers, setPeers] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [joined, setJoined] = useState(false);
    const [audioBlocked, setAudioBlocked] = useState(false);
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
            sendingSignal({
                userToSignal: targetSocketID,
                callerID: socketRef.current?.id,
                signal
            });
        });

        peer.on("connect", () => {
            console.log(`✅ Connected to ${targetUsername}`);
        });

        peer.on("error", err => {
            // Ignore abort errors - these happen during normal cleanup
            if (err.message?.includes('User-Initiated Abort')) return;
            console.error(`❌ Peer Error (Initiator) for ${targetUsername}:`, err.message);
        });

        peer.on("close", () => {
            console.log(`🔴 Peer closed for ${targetUsername}`);
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
            returningSignal({
                signal,
                callerID: callerSocketID
            });
        });

        peer.on("connect", () => {
            console.log(`✅ Connected (receiver) to ${callerSocketID}`);
        });

        peer.on("error", err => {
            // Ignore abort errors - these happen during normal cleanup
            if (err.message?.includes('User-Initiated Abort')) return;
            console.error(`❌ Peer Error (Receiver) for ${callerSocketID}:`, err.message);
        });

        peer.on("close", () => {
            console.log(`🔴 Peer closed (receiver) for ${callerSocketID}`);
        });

        peer.signal(incomingSignal);

        return peer;
    };

    const attachStreamToAudio = async (audioEl, stream, muted, peerID) => {
        if (!audioEl || !stream) return;

        try {
            audioEl.srcObject = stream;
            audioEl.muted = false;
            audioEl.volume = muted ? 0 : 1.0;

            console.log(`🔊 Attempting to play audio for peer ${peerID}`);

            try {
                await audioEl.play();
                console.log(`✅ Audio playing for peer ${peerID}`);
                blockedAudioRefs.current.delete(peerID);
                setAudioBlocked(blockedAudioRefs.current.size > 0);
            } catch (playErr) {
                console.warn(`⚠️ Autoplay blocked for peer ${peerID}:`, playErr.message);
                blockedAudioRefs.current.add(peerID);
                setAudioBlocked(true);
            }
        } catch (e) {
            console.error("attachStreamToAudio error:", e);
        }
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
                    console.warn(`⚠️ Still blocked: ${peerObj.username}`, err.message);
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
        console.log('🚀 Initializing voice socket...');

        socketRef.current = connectVoiceSocket({
            onAllUsers: (users) => {
                console.log('📥 ALL_USERS received:', users);
                console.log('Socket ID:', socketRef.current?.id);
                console.log('Stream ready:', !!streamRef.current);

                if (!streamRef.current) {
                    console.log('⏳ Stream not ready, ignoring all_users');
                    return;
                }

                // Filter out ourselves and duplicates
                const filteredUsers = users.filter(u => {
                    const isDuplicate = peersRef.current.has(u.sid);
                    const isSelf = u.sid === socketRef.current?.id;

                    if (isSelf) console.log('⏭️ Skipping self:', u.username);
                    if (isDuplicate) console.log('⏭️ Skipping duplicate:', u.username);

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

            onUserJoined: (payload) => {
                console.log('📥 USER_JOINED received:', payload);
                console.log('My socket ID:', socketRef.current?.id);

                // Check if it's ourselves
                if (payload.callerID === socketRef.current?.id) {
                    console.log('⏭️ Ignoring self join');
                    return;
                }

                // Check for duplicate
                if (peersRef.current.has(payload.callerID)) {
                    console.log('⏭️ User already exists:', payload.callerID);
                    return;
                }

                if (!streamRef.current) {
                    console.log('⏳ Stream not ready, ignoring user_joined');
                    return;
                }

                console.log(`Creating receiver peer for ${payload.username || payload.callerID}`);

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
                console.log(`✅ Added receiver peer: ${peerObj.username} (${payload.callerID})`);

                updatePeersState();
            },

            onReceivingReturnedSignal: (payload) => {
                console.log('📥 RECEIVING_RETURNED_SIGNAL:', payload.id);

                const peerObj = peersRef.current.get(payload.id);
                if (peerObj && peerObj.peer) {
                    console.log(`Signaling peer: ${peerObj.username}`);
                    peerObj.peer.signal(payload.signal);
                } else {
                    console.warn('⚠️ No peer found for returned signal:', payload.id);
                    console.log('Current peers:', Array.from(peersRef.current.keys()));
                }
            },

            onUserLeft: (socketId) => {
                console.log('📥 USER_LEFT received:', socketId);
                console.log('Current peers before removal:', Array.from(peersRef.current.keys()));

                removePeer(socketId);
            },

            onUserMuted: (data) => {
                console.log('📥 USER_MUTED:', data);

                const peerObj = peersRef.current.get(data.sid);
                if (peerObj) {
                    // --- FIX: Create a NEW object to force React re-render ---
                    // بدل ما نعدل في الكائن القديم، بنعمل واحد جديد بنفس البيانات
                    const updatedPeerObj = {
                        ...peerObj,
                        isMuted: data.is_muted
                    };

                    // نحدث الـ Map بالكائن الجديد
                    peersRef.current.set(data.sid, updatedPeerObj);

                    // نتحكم في الصوت الفعلي (نوطيه خالص لو ميوت)
                    if (updatedPeerObj.audioRef?.current) {
                        updatedPeerObj.audioRef.current.volume = data.is_muted ? 0 : 1.0;
                    }

                    // تحديث الـ State عشان الواجهة تتحدث
                    updatePeersState();
                } else {
                    console.warn('⚠️ Peer not found for mute event:', data.sid);
                }
            },

            onDisconnect: () => {
                console.warn('🔌 Voice socket disconnected');
            }
        });

        return () => {
            console.log('🧹 Cleanup: Destroying all peers and disconnecting...');

            peersRef.current.forEach((peerObj, id) => {
                try {
                    if (peerObj.audioRef?.current) {
                        peerObj.audioRef.current.srcObject = null;
                        peerObj.audioRef.current.pause();
                    }
                    peerObj.peer.destroy();
                } catch (e) {
                    console.error(`Error cleaning peer ${id}:`, e);
                }
            });

            peersRef.current.clear();
            blockedAudioRefs.current.clear();

            disconnectVoiceSocket();
        };
    }, []);

    const handleJoinVoice = async () => {
        if (isJoiningRef.current) {
            console.log('⏳ Already joining...');
            return;
        }

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

            console.log('📡 Joining voice channel:', channelId);
            await joinVoiceChannel(channelId);

            console.log('✅ Joined voice channel');
            setJoined(true);
        } catch (err) {
            console.error('❌ Error joining voice:', err);
            alert(`${t('voice.failed_to_join', 'Failed to join voice channel:')} ${err.message}`);
        } finally {
            isJoiningRef.current = false;
        }
    };

    const handleLeaveVoice = () => {
        console.log('👋 Leaving voice channel...');

        // Notify server FIRST
        leaveVoiceChannel(channelId);

        // Then clean up locally
        peersRef.current.forEach((peerObj, id) => {
            console.log(`Cleaning peer: ${peerObj.username}`);

            try {
                peerObj.peer.destroy();
            } catch (e) {
                console.error(`Error destroying peer ${id}:`, e);
            }

            if (peerObj.audioRef?.current) {
                try {
                    peerObj.audioRef.current.srcObject = null;
                    peerObj.audioRef.current.pause();
                } catch (e) {
                    console.error(`Error cleaning audio for ${id}:`, e);
                }
            }
        });

        peersRef.current.clear();
        blockedAudioRefs.current.clear();
        setPeers([]);
        setAudioBlocked(false);

        // Stop microphone
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log('🔴 Stopped track:', track.kind);
            });
            streamRef.current = null;
        }

        setJoined(false);
        setIsMuted(false);

        console.log('✅ Left voice channel');
    };

    const toggleMute = () => {
        const newMute = !isMuted;
        console.log(`${newMute ? '🔇 Muting' : '🔊 Unmuting'} microphone`);
        setIsMuted(newMute);

        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !newMute;
            });
        }

        emitToggleMute({ room_id: channelId, is_muted: newMute });
    };

    // Audio peer component
    // Fix 1: Disable Native Driver for Web
    const SpeakingIndicator = ({ isSpeaking }) => {
        const pulseAnim = useRef(new Animated.Value(1)).current;

        useEffect(() => {
            if (isSpeaking) {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.3,
                            duration: 300,
                            useNativeDriver: false, // <--- CHANGED THIS
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 300,
                            useNativeDriver: false, // <--- CHANGED THIS
                        }),
                    ])
                ).start();
            } else {
                pulseAnim.setValue(1);
            }
        }, [isSpeaking]);

        if (!isSpeaking) return null;

        return (
            <Animated.View
                style={[
                    styles.speakingRing,
                    { transform: [{ scale: pulseAnim }] },
                ]}
            />
        );
    };

    // ... (keep useAudioLevel as is) ...

    // Fix 2: AudioPeer with Safe Cleanup
    const AudioPeer = ({ peerObj }) => {
        const [remoteSpeaking, setRemoteSpeaking] = useState(false);
        const audioContextRef = useRef(null);
        const animationFrameRef = useRef(null);
        const audioRef = useRef(null);
        const playPromiseRef = useRef(null); // عشان نتابع حالة التشغيل

        useEffect(() => {
            const peer = peerObj.peer;

            const handleStream = async (stream) => {
                peerObj.streamRef = stream;

                if (audioRef.current) {
                    audioRef.current.srcObject = stream;
                    audioRef.current.muted = false;

                    // --- FIX: Prevent AbortError ---
                    try {
                        // لو في طلب تشغيل سابق لسه مخلصش، ممكن نتجاهله أو ننتظره
                        // بس الحل الأبسط هنا هو الـ catch للخطأ المحدد
                        playPromiseRef.current = audioRef.current.play();
                        await playPromiseRef.current;
                    } catch (e) {
                        // تجاهل خطأ الـ Abort لأنه بيحصل لما الستريم يتبدل بسرعة
                        if (e.name !== 'AbortError') {
                            console.warn("Autoplay prevented:", e);
                        }
                    }
                }

                // Setup speaking detection
                if (!peerObj.isMuted) {
                    try {
                        // Safe cleanup first
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
                    } catch (err) {
                        console.error('Audio detection error:', err);
                    }
                } else {
                    // Close context if muted
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
        }, [peerObj, peerObj.isMuted]); // Re-run on mute change

        useEffect(() => {
            peerObj.isSpeaking = remoteSpeaking && !peerObj.isMuted;
        }, [remoteSpeaking, peerObj.isMuted]);

        return <audio playsInline autoPlay ref={audioRef} />;
    };

    if (!joined) {
        return (
            <View style={styles.container}>
                <View style={styles.joinContainer}>
                    <View style={styles.iconWrapper}>
                        <Volume2 size={48} color="#10b981" />
                    </View>
                    <Text style={styles.joinTitle}>{t('voice.crystal_channel', 'Voice Channel Channel')}</Text>
                    <Text style={styles.joinSubtitle}>{t('voice.click_to_attune', 'Click to connect and speak')}</Text>
                    <TouchableOpacity
                        style={styles.joinButton}
                        onPress={handleJoinVoice}
                        disabled={isJoiningRef.current}
                    >
                        <Mic size={20} color="#fff" />
                        <Text style={styles.joinText}>
                            {isJoiningRef.current ? t('voice.attuning', 'Attuning...') : t('voice.attune_to_crystal', 'Connect to Voice Channel')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.activeContainer}>
            {audioBlocked && (
                <View style={styles.audioBlockedBanner}>
                    <VolumeX size={20} color="#f59e0b" />
                    <Text style={styles.audioBlockedText}>
                        {t('voice.audio_blocked', 'Audio is blocked by your browser. Click to enable sound:')}
                    </Text>
                    <TouchableOpacity style={styles.enableAudioBtn} onPress={resumeAllAudio}>
                        <Play size={16} color="#fff" />
                        <Text style={styles.enableAudioText}>{t('voice.enable_audio', 'Enable Audio')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.header}>
                <View style={styles.headerInfo}>
                    <Volume2 size={20} color="#10b981" />
                    <Text style={styles.headerText}>
                        {t('voice.crystal_attuned', 'Voice Channel • {{count}} attuned', { count: peers.length + 1 })}
                    </Text>
                </View>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.controlBtn, isMuted && styles.mutedBtn]}
                    onPress={toggleMute}
                >
                    {isMuted ? <MicOff size={24} color="#fff" /> : <Mic size={24} color="#fff" />}
                    <Text style={styles.controlLabel}>{isMuted ? t('voice.btn_unmute', 'Unmute') : t('voice.btn_mute', 'Mute')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlBtn, styles.leaveBtn]}
                    onPress={handleLeaveVoice}
                >
                    <PhoneOff size={24} color="#fff" />
                    <Text style={styles.controlLabel}>{t('voice.btn_sever', 'Sever')}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.grid}>
                {/* Local user */}
                <View style={styles.userCard}>
                    <View style={styles.avatarContainer}>
                        {isSpeaking && !isMuted && <SpeakingIndicator isSpeaking={true} />}
                        <View style={[
                            styles.avatar,
                            isMuted && styles.avatarMuted,
                            isSpeaking && !isMuted && styles.avatarSpeaking
                        ]}>
                            <User size={40} color="#d1d5db" />
                        </View>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.username} numberOfLines={1}>
                            {user?.username || t('common.me', 'Me')}
                        </Text>
                        {isSpeaking && !isMuted && (
                            <Text style={styles.speakingText}>{t('voice.speaking', 'Speaking...')}</Text>
                        )}
                    </View>
                    {isMuted && (
                        <View style={styles.muteIconContainer}>
                            <MicOff size={16} color="#ef4444" />
                        </View>
                    )}
                </View>

                {/* Remote peers */}
                {peers.map((p) => (
                    <View key={p.peerID} style={styles.userCard}>
                        <View style={styles.avatarContainer}>
                            {p.isSpeaking && !p.isMuted && <SpeakingIndicator isSpeaking={true} />}
                            <View style={[
                                styles.avatar,
                                p.isMuted && styles.avatarMuted,
                                p.isSpeaking && !p.isMuted && styles.avatarSpeaking
                            ]}>
                                <User size={40} color="#d1d5db" />
                            </View>
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.username} numberOfLines={1}>
                                {p.username}
                            </Text>
                            {p.isSpeaking && !p.isMuted && (
                                <Text style={styles.speakingText}>{t('voice.speaking', 'Speaking...')}</Text>
                            )}
                        </View>
                        {p.isMuted && (
                            <View style={styles.muteIconContainer}>
                                <MicOff size={16} color="#ef4444" />
                            </View>
                        )}
                        <AudioPeer peerObj={p} />
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
    joinContainer: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#1e293b',
        borderRadius: 16,
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    iconWrapper: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#10b98120',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    joinTitle: {
        color: '#f1f5f9',
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
    },
    joinSubtitle: {
        color: '#94a3b8',
        fontSize: 16,
        marginBottom: 32,
        textAlign: 'center',
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        gap: 12,
        cursor: 'pointer',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    joinText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    activeContainer: {
        flex: 1,
        backgroundColor: '#0f172a',
        padding: 24,
    },
    audioBlockedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#78350f',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        gap: 12,
    },
    audioBlockedText: {
        flex: 1,
        color: '#fbbf24',
        fontSize: 14,
        fontWeight: '500',
    },
    enableAudioBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f59e0b',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
        cursor: 'pointer',
    },
    enableAudioText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    header: {
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    headerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerText: {
        color: '#f1f5f9',
        fontSize: 18,
        fontWeight: '600',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        marginBottom: 32,
    },
    controlBtn: {
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
        cursor: 'pointer',
        minWidth: 120,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    controlLabel: {
        color: '#f1f5f9',
        fontSize: 14,
        fontWeight: '500',
    },
    mutedBtn: {
        backgroundColor: '#991b1b',
    },
    leaveBtn: {
        backgroundColor: '#991b1b',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
        justifyContent: 'flex-start',
    },
    userCard: {
        width: 160,
        alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 20,
        borderRadius: 16,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    speakingRing: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        borderColor: '#10b981',
        top: -8,
        left: -8,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#475569',
    },
    avatarSpeaking: {
        borderColor: '#10b981',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
    },
    avatarMuted: {
        borderColor: '#64748b',
        opacity: 0.7,
    },
    userInfo: {
        alignItems: 'center',
        width: '100%',
    },
    username: {
        color: '#f1f5f9',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4,
    },
    speakingText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '500',
    },
    muteIconContainer: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 6,
        borderWidth: 2,
        borderColor: '#ef4444',
    },
});

export default VoiceChannel;