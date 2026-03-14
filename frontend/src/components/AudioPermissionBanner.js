import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native-web';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { VolumeX } from 'lucide-react';
import { useUIStore } from '../store/uiStore';

const AudioPermissionBanner = () => {
    const { t } = useTranslation();
    const { audioBlocked, setAudioBlocked } = useUIStore();
    const slideAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (audioBlocked) {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [audioBlocked, slideAnim]);

    const handleUnlockAudio = () => {
        // Initialize an empty audio context to unlock the browser's autoplay policy for this session
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const context = new AudioContext();
            context.resume().then(() => {
                console.log('Audio context unlocked via user gesture.');
                setAudioBlocked(false);
            });
        } catch (e) {
            console.error('Failed to unlock audio context:', e);
            // Fallback: just dismiss if context fails
            setAudioBlocked(false);
        }
    };

    if (!audioBlocked) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity style={styles.content} onPress={handleUnlockAudio} activeOpacity={0.8}>
                <View style={styles.iconContainer}>
                    <VolumeX size={20} color="#fff" style={styles.icon} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>{t('audio.blocked_title', 'Audio is Muted')}</Text>
                    <Text style={styles.subtitle}>{t('audio.blocked_subtitle', 'Click here to allow Nexus to play notification and call sounds.')}</Text>
                </View>
                <View style={styles.actionBtn}>
                    <Text style={styles.actionText}>{t('audio.btn_allow', 'Allow Audio')}</Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999, // Extremely high z-index to sit over EVERYTHING including modals
        alignItems: 'center',
        paddingTop: 16,
        pointerEvents: 'box-none',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ef4444', // Red to indicate a blocked action
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        maxWidth: '90%',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
        cursor: 'pointer',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 12,
    },
    icon: {
        animation: 'pulse 1.5s infinite',
    },
    textContainer: {
        flex: 1,
        marginInlineEnd: 16,
    },
    title: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 13,
    },
    actionBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    actionText: {
        color: '#ef4444',
        fontSize: 13,
        fontWeight: 'bold',
    },
});

export default AudioPermissionBanner;
