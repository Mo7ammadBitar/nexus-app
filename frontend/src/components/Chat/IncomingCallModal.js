import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native-web';
import { Phone, PhoneOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFriendsStore } from '../../store/friendsStore';
import { useVoiceStore } from '../../store/voiceStore';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { declineDMCall, acceptDMCall } from '../../services/socket';
import { resolveAssetUrl } from '../../config';

// A simple modern ringtone using base64 audio
// A classic electronic ringtone loop
const RING_AUDIO = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

const IncomingCallModal = () => {
    const { t } = useTranslation();
    const { openDMById } = useFriendsStore();
    const { incomingCall, setIncomingCall } = useVoiceStore();
    const { setAudioBlocked } = useUIStore();
    const audioRef = useRef(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (incomingCall) {
            // Start pumping animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Try to play ringtone
            try {
                // If they provided a custom ringtone in public folder it will play that, otherwise fallback to local mp3 audio context. We'll use a public folder reference assuming standard react setup.
                audioRef.current = new Audio('/Soft Orbit Ping.mp3');
                audioRef.current.loop = true;

                // Browsers often block autoplay, so we catch the promise
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        if (error.name === 'NotAllowedError') {
                            console.warn('Autoplay prevented. User must interact first.', error);
                            setAudioBlocked(true);
                        }
                    });
                }
            } catch (err) {
                console.error("Audio error", err);
            }
        }

        return () => {
            // Cleanup audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, [incomingCall, pulseAnim]);

    if (!incomingCall) return null;

    const handleAccept = async () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        // Ensure DM is open with this user
        await openDMById(incomingCall.caller_id);

        useVoiceStore.getState().setAcceptedCall(incomingCall.caller_id);

        // Notify the caller that we accepted so their UI transitions from "Ringing..." to active
        acceptDMCall(incomingCall.caller_id);

        // Close modal, let DM area handle the actual peer connection answering locally
        setIncomingCall(null);
    };

    const handleDecline = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        declineDMCall(incomingCall.caller_id);
        setIncomingCall(null);
    };

    return (
        <View style={styles.overlay}>
            <Animated.View style={[styles.modalCard, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.avatarContainer}>
                    {incomingCall.caller_avatar ? (
                        <img
                            src={resolveAssetUrl(incomingCall.caller_avatar)}
                            style={styles.avatarImage}
                            alt="Avatar"
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>
                                {incomingCall.caller_username?.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                <Text style={styles.callerName}>{incomingCall.caller_username}</Text>
                <Text style={styles.incomingText}>{t('call.incoming', 'Incoming Voice Call...')}</Text>

                <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleDecline}>
                        <PhoneOff size={24} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAccept}>
                        <Phone size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, // Needs to be on top of everything globally
        backdropFilter: 'blur(5px)',
    },
    modalCard: {
        backgroundColor: '#16213e',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: 320,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
        padding: 4,
        backgroundColor: '#1a1a2e',
        border: '2px solid #7c3aed',
        boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        objectFit: 'cover',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        backgroundColor: '#7c3aed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
    },
    callerName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    incomingText: {
        color: '#94a3b8',
        fontSize: 16,
        marginBottom: 32,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 32,
        justifyContent: 'center',
        width: '100%',
    },
    actionBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
        transition: 'transform 0.2s, box-shadow 0.2s',
    },
    acceptBtn: {
        backgroundColor: '#10b981', // Emerald green
    },
    declineBtn: {
        backgroundColor: '#ef4444', // Red
    },
});

export default IncomingCallModal;
