import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native-web';
import { Play, Pause } from 'lucide-react';

const VoiceMessagePlayer = ({ url, duration }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    // استخدام المدة القادمة من الباك إند كقيمة افتراضية
    const [durationSecs, setDurationSecs] = useState(duration || 0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [isLoading, setIsLoading] = useState(true);

    // Check if the URL is absolute or requires the local API fallback
    const audioUrl = url?.startsWith('http') ? url : `http://localhost:8000${url}`;

    // استخدام HTML5 Audio المباشر بدلاً من expo-av
    const audioRef = useRef(new Audio(audioUrl));

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const audio = audioRef.current;
        const currentAudioUrl = url?.startsWith('http') ? url : `http://localhost:8000${url}`;
        audio.src = currentAudioUrl; // التأكد من الرابط

        // تجهيز الإيفنتات (Events)
        const onLoadedMetadata = () => {
            if (audio.duration && isFinite(audio.duration)) {
                setDurationSecs(audio.duration);
            }
            setIsLoading(false);
        };

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        const onError = (e) => {
            console.error("Audio Error:", e);
            setIsLoading(false);
        };

        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        // تنظيف الذاكرة عند الخروج
        return () => {
            audio.pause();
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
        };
    }, [url]);

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(e => console.error("Play error:", e));
        }
        setIsPlaying(!isPlaying);
    };

    const changeSpeed = () => {
        const speeds = [1.0, 1.5, 2.0];
        const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
        const newSpeed = speeds[nextIndex];

        setPlaybackSpeed(newSpeed);
        // تغيير سرعة الصوت في المتصفح
        audioRef.current.playbackRate = newSpeed;
    };

    const handleSeek = (e) => {
        // حساب مكان الضغطة في الشريط للتقديم/الترجيع
        // ملاحظة: دي بتحتاج View فيه onLayout أو شغل web specific
        // للتبسيط، الكود ده للعرض، لو عايز Seek دقيق محتاجين Slider
    };

    const progressPercent = durationSecs > 0 ? (currentTime / durationSecs) * 100 : 0;

    return (
        <View style={styles.container}>
            {/* زر التشغيل */}
            <TouchableOpacity
                style={styles.playButton}
                onPress={togglePlayPause}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : isPlaying ? (
                    <Pause size={18} color="#fff" fill="#fff" />
                ) : (
                    <Play size={18} color="#fff" fill="#fff" />
                )}
            </TouchableOpacity>

            {/* شريط التقدم */}
            <View style={styles.progressSection}>
                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                        <View style={[styles.progressKnob, { left: `${progressPercent}%` }]} />
                    </View>
                </View>

                {/* التوقيت */}
                <View style={styles.timerContainer}>
                    <Text style={styles.timerText}>
                        {formatTime(currentTime)} / {formatTime(durationSecs)}
                    </Text>
                </View>
            </View>

            {/* زر السرعة */}
            <TouchableOpacity style={styles.speedButton} onPress={changeSpeed}>
                <Text style={styles.speedText}>{playbackSpeed}x</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    errorContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginInlineEnd: 10,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderRadius: 20,
        padding: 8,
        paddingHorizontal: 12,
        marginTop: 4,
        minWidth: 220,
        maxWidth: 300,
    },
    playButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#7c3aed',
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 10,
        cursor: 'pointer',
    },
    progressSection: {
        flex: 1,
        marginInlineEnd: 10,
        justifyContent: 'center',
    },
    progressBarContainer: {
        height: 14,
        justifyContent: 'center',
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        position: 'relative',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 2,
    },
    progressKnob: {
        position: 'absolute',
        top: -4,
        marginInlineStart: -6,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#fff',
        boxShadow: "0px 1px 1px rgba(0,0,0,0.3)",
    },
    timerContainer: {
        marginTop: 2,
    },
    timerText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: '500',
    },
    speedButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        cursor: 'pointer',
    },
    speedText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
});

export default VoiceMessagePlayer;