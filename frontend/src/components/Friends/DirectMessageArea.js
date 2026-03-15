import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { useSearchParams } from 'react-router-dom';
import { useFriendsStore } from '../../store/friendsStore';
import { useVoiceStore } from '../../store/voiceStore';
import { useTypingStore } from '../../store/typingStore';
import { useAuthStore } from '../../store/authStore';
import { dmAPI, starredAPI, oracleAPI, ORACLE_ID } from '../../services/api';
import { startDMTyping, stopDMTyping } from '../../services/socket';
import MarkdownText from '../Chat/MarkdownText';
import VoiceMessagePlayer from '../Chat/VoiceMessagePlayer';
import Loader from '../Loader';

// Lazy loaded heavy components
const ForwardModal = lazy(() => import('../Chat/ForwardModal'));
const PinnedMessagesPanel = lazy(() => import('../Chat/PinnedMessagesPanel'));
const DMVoiceCall = lazy(() => import('../Chat/DMVoiceCall'));
const MemberProfile = lazy(() => import('../Profile/MemberProfile'));
import { copyToClipboard } from '../../utils/messageLinkUtils';
import { initiateDMCall, cancelDMCall } from '../../services/socket';
import { Smile, Star, Reply, Share, Link, Edit2, Trash2, Check, Mic, Send, Square, Sparkles, Eye, X, Pin, Phone, PhoneOff } from 'lucide-react';
import { getAuraRingStyle, getAuraNameStyle, injectAuraAnimations } from '../../utils/PremiumAura';
import { RELIC_CSS_MAP } from '../Shop/EtherealShop';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { resolveAssetUrl } from '../../config';

// Inline styles for bubble relics — works even without CSS className support
const BUBBLE_INLINE_STYLES = {
    'relic-bubble-ethereal': {
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(124, 58, 237, 0.04))',
        borderInlineStart: '2px solid rgba(139, 92, 246, 0.4)',
        borderRadius: '6px',
        paddingInlineStart: '10px',
    },
    'relic-bubble-shadow': {
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.3), rgba(0, 0, 0, 0.15))',
        borderInlineStart: '2px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '6px',
        paddingInlineStart: '10px',
    },
    'relic-bubble-golden': {
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.04))',
        borderInlineStart: '2px solid rgba(245, 158, 11, 0.4)',
        borderRadius: '6px',
        paddingInlineStart: '10px',
    },
    'relic-bubble-aurora': {
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(16, 185, 129, 0.04))',
        borderInlineStart: '2px solid rgba(6, 182, 212, 0.4)',
        borderRadius: '6px',
        paddingInlineStart: '10px',
    },
};

// Inline styles for frame relics — applied directly to the frame div
const FRAME_INLINE_STYLES = {
    'relic-frame-celestial': {
        border: '2px solid #7c3aed',
        boxShadow: '0 0 8px rgba(124, 58, 237, 0.6), inset 0 0 4px rgba(124, 58, 237, 0.3)',
    },
    'relic-frame-infernal': {
        border: '2px solid #ef4444',
        boxShadow: '0 0 8px rgba(239, 68, 68, 0.6), inset 0 0 4px rgba(239, 68, 68, 0.3)',
    },
    'relic-frame-frost': {
        border: '2px solid #06b6d4',
        boxShadow: '0 0 8px rgba(6, 182, 212, 0.6), inset 0 0 4px rgba(6, 182, 212, 0.3)',
    },
    'relic-frame-verdant': {
        border: '2px solid #10b981',
        boxShadow: '0 0 8px rgba(16, 185, 129, 0.5), inset 0 0 4px rgba(16, 185, 129, 0.25)',
    },
};

const DirectMessageArea = () => {
    const {
        currentDMFriend,
        dmMessages,
        sendDMMessage,
        editDMMessage,
        deleteDMMessage,
        pinMessage,
        unpinMessage,
        closeDM
    } = useFriendsStore();
    const { user } = useAuthStore();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();
    const scrollViewRef = useRef();
    const messageRefs = useRef({});
    const fileInputRef = useRef();

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);

    // Typing indicator
    const typingTimeoutRef = useRef(null);
    const friendId = currentDMFriend?.id || currentDMFriend?._id;
    const typingInfo = useTypingStore(state => state.dmTyping[friendId]);

    const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

    // Starred messages state
    const [starredMessages, setStarredMessages] = useState(new Set());

    // Reply state
    const [replyingTo, setReplyingTo] = useState(null);

    // Forward modal state
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [messageToForward, setMessageToForward] = useState(null);

    // Pinned messages state
    const [showPinnedMessages, setShowPinnedMessages] = useState(false);

    // Call state
    const { callDeclinedBy, setCallDeclinedBy, callAnsweredBy, setCallAnsweredBy } = useVoiceStore();
    const [isCallActive, setIsCallActive] = useState(false);
    const [callStatus, setCallStatus] = useState(null); // 'calling', 'active', 'declined'

    // User profile popup state
    const [selectedUserProfile, setSelectedUserProfile] = useState(null);
    const [copyLinkFeedback, setCopyLinkFeedback] = useState(null);

    // Oracle State
    const [oracleTyping, setOracleTyping] = useState(false);
    const [systemWhisper, setSystemWhisper] = useState(null); // { title, content }

    // Inject Aura animations on mount + refresh user data for latest relics
    useEffect(() => {
        injectAuraAnimations();
        // Refresh auth user to get latest equipped_relics
        useAuthStore.getState().refreshUser();
    }, []);

    // Watch for incoming call acceptance from this user
    const { acceptedCall, setAcceptedCall } = useVoiceStore();
    useEffect(() => {
        const receiverId = currentDMFriend?.id || currentDMFriend?._id;
        if (acceptedCall === receiverId) {
            // We accepted their call via the global modal, open the banner!
            setIsCallActive(true);
            setCallStatus('active');
            setAcceptedCall(null);
        }
    }, [acceptedCall, currentDMFriend, setAcceptedCall]);

    // Watch for declines from the target user
    useEffect(() => {
        const receiverId = currentDMFriend?.id || currentDMFriend?._id;
        if (isCallActive && callStatus === 'calling' && callDeclinedBy === receiverId) {
            setCallStatus('declined');
            toast.error(t('dm.call_declined', `${currentDMFriend?.username || 'User'} declined your call.`));

            // Hangup banner after short delay
            setTimeout(() => {
                setIsCallActive(false);
                setCallStatus(null);
                setCallDeclinedBy(null);
            }, 3000);
        }
    }, [callDeclinedBy, isCallActive, callStatus, currentDMFriend, t, setCallDeclinedBy]);

    // Watch for the target answering our outgoing call
    useEffect(() => {
        const receiverId = currentDMFriend?.id || currentDMFriend?._id;
        if (isCallActive && callStatus === 'calling' && callAnsweredBy === receiverId) {
            setCallStatus('active');
            setCallAnsweredBy(null);
        }
    }, [callAnsweredBy, isCallActive, callStatus, currentDMFriend, setCallAnsweredBy]);

    useEffect(() => {
        // Channel to bottom when messages change, unless we are jumping to a highlighted message
        const highlightId = searchParams.get('highlightMessage');
        if (!highlightId && scrollViewRef.current && !highlightedMessageId) {
            scrollViewRef.current.scrollToEnd?.({ animated: true });
        }
    }, [dmMessages, highlightedMessageId]);

    useEffect(() => {
        const highlightId = searchParams.get('highlightMessage');
        if (highlightId && dmMessages.length > 0) {
            setHighlightedMessageId(highlightId);

            // Wait for render then channel
            setTimeout(() => {
                const element = messageRefs.current[highlightId];
                if (element) {
                    element.measureLayout(
                        scrollViewRef.current.getScrollableNode(),
                        (x, y) => {
                            scrollViewRef.current.scrollTo({ y: y, animated: true });
                        }
                    );

                    // Remove param after jump
                    searchParams.delete('highlightMessage');
                    setSearchParams(searchParams, { replace: true });

                    // Remove highlight after a delay
                    setTimeout(() => setHighlightedMessageId(null), 3000);
                }
            }, 500);
        }
    }, [searchParams, dmMessages]);

    if (!currentDMFriend) return null;

    // Debounced typing handler
    const handleInputChange = useCallback((text) => {
        setMessage(text);

        const receiverId = currentDMFriend?.id || currentDMFriend?._id;
        if (receiverId && text.trim()) {
            startDMTyping(receiverId);

            // Clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Stop typing after 2 seconds of no input
            typingTimeoutRef.current = setTimeout(() => {
                stopDMTyping(receiverId);
            }, 2000);
        }
    }, [currentDMFriend]);

    // Voice recording functions
    const formatRecordingTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(100);
            setIsRecording(true);
            setRecordingTime(0);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Failed to start recording:', error);
            toast.error('Microphone access is required to record voice messages.');
        }
    };

    const stopRecording = () => {
        return new Promise((resolve) => {
            const mediaRecorder = mediaRecorderRef.current;
            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, {
                    type: mediaRecorder.mimeType
                });
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                resolve({ blob: audioBlob, duration: recordingTime });
            };

            mediaRecorder.stop();
            clearInterval(recordingIntervalRef.current);
            setIsRecording(false);
        });
    };

    const cancelRecording = async () => {
        const mediaRecorder = mediaRecorderRef.current;
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            mediaRecorder.stop();
        }
        clearInterval(recordingIntervalRef.current);
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingTime(0);
    };

    const sendVoiceMessage = async () => {
        // 1. إيقاف التسجيل والحصول على النتيجة
        const result = await stopRecording();
        if (!result || !result.blob) return;

        // 2. التحقق من وجود الصديق
        const friendId = currentDMFriend?._id || currentDMFriend?.id;
        if (!friendId) {
            console.error('No friend selected for voice message');
            toast.error(t('dm.error_no_friend', 'Cannot send voice message: No friend selected.'));
            return;
        }

        // 3. استخراج الـ Blob والمدة من النتيجة (هنا كان الخطأ عندك غالباً)
        const { blob, duration } = result;

        // 4. تحديد النوع والامتداد بشكل نظيف
        const isWebm = blob.type.includes('webm');
        const ext = isWebm ? 'webm' : 'm4a';
        const mimeType = isWebm ? 'audio/webm' : 'audio/mp4';

        // 5. إنشاء الملف
        const audioFile = new File([blob], `voice_message.${ext}`, { type: mimeType });

        setSending(true);
        try {
            const formData = new FormData();
            // إضافة مسافة فارغة عشان الباك إند ميعترضش على المحتوى الفاضي
            formData.append('content', ' ');

            // الملف
            formData.append('file', audioFile);

            // الميتاداتا
            formData.append('message_type', 'voice');
            formData.append('duration', Math.round(duration));

            await dmAPI.sendMessage(friendId, formData);

            // تصفير العداد بعد الإرسال
            setRecordingTime(0);
        } catch (error) {
            console.error('Failed to send voice message:', error);
            const errorMessage = error.response?.data?.detail || t('dm.error_voice_send', 'Failed to send voice message. Please try again.');
            toast.error(errorMessage);
        } finally {
            setSending(false);
        }
    };

    const ALLOWED_EXTENSIONS = ['docx', 'pdf', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'zip', 'rar'];

    const handleSend = async () => {
        if ((!message.trim() && selectedFiles.length === 0) || sending) return;

        setSending(true);
        const content = message.trim() || ' '; // API requires content, send space if empty
        const fileToSend = selectedFiles[0] || null; // Get first file if exists
        const replyToId = replyingTo?._id || null;
        setMessage('');
        setSelectedFiles([]);
        setReplyingTo(null);

        // Stop typing indicator
        const receiverId = currentDMFriend.id || currentDMFriend._id;
        if (receiverId) {
            stopDMTyping(receiverId);
        }

        // Oracle Typing Indicator
        if (receiverId === ORACLE_ID) {
            setOracleTyping(true);
            setTimeout(() => setOracleTyping(false), 2000);
        }

        // Build FormData for multipart/form-data request
        const formData = new FormData();
        formData.append('content', content);
        if (fileToSend) {
            formData.append('file', fileToSend);
        }
        if (replyToId) {
            formData.append('reply_to_id', replyToId);
        }

        try {
            const friendId = currentDMFriend.id || currentDMFriend._id;
            const response = await dmAPI.sendMessage(friendId, formData);
            if (response.data.dm) {
                useFriendsStore.getState().addDMMessage(response.data.dm);
            }
        } catch (error) {
            console.error('Failed to send DM:', error);
            const errorMessage = error.response?.data?.detail || "Failed to send DM. Please try again.";
            toast.error(errorMessage);

            // Restore text and files so the user doesn't lose their draft
            setMessage(content === ' ' ? '' : content);
            if (fileToSend) setSelectedFiles([fileToSend]);
        }
        setSending(false);
    };

    // Handle reply
    const handleReply = (msg) => {
        setReplyingTo(msg);
    };

    const cancelReply = () => {
        setReplyingTo(null);
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return ALLOWED_EXTENSIONS.includes(ext);
        });
        setSelectedFiles(prev => [...prev, ...validFiles]);
        e.target.value = ''; // Reset input
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleStartEdit = (msg) => {
        setEditingMessageId(msg._id);
        setEditContent(msg.content);
        setHoveredMessageId(null);
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    const handleSaveEdit = async (messageId) => {
        if (!editContent.trim()) return;

        await editDMMessage(messageId, editContent);
        setEditingMessageId(null);
        setEditContent('');
    };

    const handleEditKeyPress = (e, messageId) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit(messageId);
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const handleDelete = async (messageId) => {
        if (window.confirm(t('dm.confirm_delete', 'Are you sure you want to delete this message?'))) {
            await deleteDMMessage(messageId);
        }
    };

    const formatTime = (dateString) => {
        return new Date(dateString).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Reaction handlers
    const handleReaction = async (messageId, emoji) => {
        try {
            const msg = dmMessages.find(m => m._id === messageId);
            const reactions = msg?.reactions || {};
            const hasReacted = reactions[emoji]?.includes(user?._id);

            if (hasReacted) {
                const response = await dmAPI.removeReaction(messageId, emoji);
                // Update message in store
                useFriendsStore.getState().updateDMMessage(messageId, { reactions: response.data.reactions });
            } else {
                const response = await dmAPI.addReaction(messageId, emoji);
                useFriendsStore.getState().updateDMMessage(messageId, { reactions: response.data.reactions });
            }
            setShowEmojiPicker(null);
        } catch (error) {
            console.error('Failed to update reaction:', error);
        }
    };

    // Star message handler
    const handleStarMessage = async (messageId) => {
        try {
            if (starredMessages.has(messageId)) {
                await starredAPI.unstarMessage(messageId);
                setStarredMessages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(messageId);
                    return newSet;
                });
            } else {
                await starredAPI.starMessage('dm', messageId);
                setStarredMessages(prev => new Set(prev).add(messageId));
            }
        } catch (error) {
            console.error('Failed to star/unstar message:', error);
        }
    };

    // Forward message handler
    const handleForward = (msg) => {
        setMessageToForward(msg);
        setForwardModalOpen(true);
        setHoveredMessageId(null);
    };

    // Copy message link handler (for DMs we copy the message ID)
    const handleCopyLink = async (msg) => {
        const dmLink = `DM Message ID: ${msg._id}`;
        const success = await copyToClipboard(dmLink);
        if (success) {
            setCopyLinkFeedback(msg._id);
            setTimeout(() => setCopyLinkFeedback(null), 2000);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return t('dm.date_today', 'Today');
        } else if (date.toDateString() === yesterday.toDateString()) {
            return t('dm.date_yesterday', 'Yesterday');
        }
        return date.toLocaleDateString();
    };

    // Group messages by date
    const groupedMessages = dmMessages.reduce((groups, msg) => {
        const date = formatDate(msg.timestamp || msg.created_at);
        if (!groups[date]) groups[date] = [];
        groups[date].push(msg);
        return groups;
    }, {});

    return (
        <View style={styles.container}>
            {/* Typing Indicator CSS Animation */}
            <style>{`
                @keyframes dmBounce {
                    0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
                .dm-typing-indicator-container {
                    display: flex;
                    align-items: center;
                    padding: 4px 16px 8px 16px;
                    gap: 8px;
                }
                .dm-typing-dots-container {
                    display: flex;
                    align-items: center;
                    height: 10px;
                }
                .dm-typing-dot {
                    width: 6px;
                    height: 6px;
                    background-color: #b9bbbe;
                    border-radius: 50%;
                    display: inline-block;
                    margin: 0 2px;
                    animation: dmBounce 1.4s infinite ease-in-out both;
                }
                .dm-typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .dm-typing-dot:nth-child(2) { animation-delay: -0.16s; }
                .dm-typing-dot:nth-child(3) { animation-delay: 0s; }
                .dm-typing-text {
                    color: #b9bbbe;
                    font-size: 12px;
                    font-weight: 600;
                }
            `}</style>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={closeDM}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, cursor: 'pointer' }}
                    onPress={() => setSelectedUserProfile({ userId: currentDMFriend.id || currentDMFriend._id })}
                >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginInlineEnd: 12, overflow: 'hidden' }}>
                        {currentDMFriend.avatar_url ? (
                            <img
                                src={resolveAssetUrl(currentDMFriend.avatar_url)}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                alt=""
                            />
                        ) : (
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                                {currentDMFriend.username?.charAt(0).toUpperCase()}
                            </Text>
                        )}
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>
                            {currentDMFriend.display_name || currentDMFriend.username}
                        </Text>
                        <Text style={styles.headerSubtitle}>@{currentDMFriend.username}</Text>
                    </View>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        style={{ padding: 8, marginInlineEnd: 8 }}
                        onPress={() => {
                            if (!isCallActive) {
                                setIsCallActive(true);
                                setCallStatus('calling');
                                initiateDMCall(currentDMFriend?.id || currentDMFriend?._id);
                            } else {
                                // Hang up / Cancel
                                setIsCallActive(false);
                                setCallStatus(null);
                                cancelDMCall(currentDMFriend?.id || currentDMFriend?._id);
                            }
                        }}
                        title={t('dm.btn_call', 'Voice Call')}
                    >
                        {isCallActive ? (
                            <PhoneOff size={24} color="#ef4444" />
                        ) : (
                            <Phone size={24} color="#b9bbbe" />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ padding: 8, marginInlineEnd: 16 }}
                        onPress={() => setShowPinnedMessages(!showPinnedMessages)}
                        title={t('dm.btn_pinned', 'Pinned Messages')}
                    >
                        <Pin size={24} color={showPinnedMessages ? "#fff" : "#b9bbbe"} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Pinned Messages Panel */}
            <Suspense fallback={<Loader size={48} />}>
                <PinnedMessagesPanel
                    isOpen={showPinnedMessages}
                    onClose={() => setShowPinnedMessages(false)}
                    type="dm"
                    sourceId={currentDMFriend?.id || currentDMFriend?._id}
                />
            </Suspense>

            {/* Voice Call Banner */}
            {isCallActive && (
                <View style={{ width: '100%', backgroundColor: '#16213e', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                    {callStatus === 'calling' ? (
                        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <Phone size={20} color="#10b981" style={{ marginInlineEnd: 8, animation: 'dmBounce 1.5s infinite' }} />
                            <Text style={{ color: '#fff', fontSize: 16 }}>
                                {t('dm.calling_state', `Ringing ${currentDMFriend?.username}...`)}
                            </Text>
                        </View>
                    ) : callStatus === 'declined' ? (
                        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <PhoneOff size={20} color="#ef4444" style={{ marginInlineEnd: 8 }} />
                            <Text style={{ color: '#ef4444', fontSize: 16 }}>
                                {t('dm.declined_state', 'Call Declined')}
                            </Text>
                        </View>
                    ) : (
                        <Suspense fallback={<Loader size={32} />}>
                            <DMVoiceCall
                                currentDMFriend={currentDMFriend}
                                onEndCall={() => {
                                    setIsCallActive(false);
                                    setCallStatus(null);
                                    cancelDMCall(currentDMFriend?.id || currentDMFriend?._id);
                                }}
                            />
                        </Suspense>
                    )}
                </View>
            )}

            {/* Messages */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
            >
                {dmMessages.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyAvatar}>
                            {currentDMFriend.avatar_url ? (
                                <img
                                    src={resolveAssetUrl(currentDMFriend.avatar_url)}
                                    style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                    alt=""
                                />
                            ) : (
                                <Text style={styles.emptyAvatarText}>
                                    {currentDMFriend.username?.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <Text style={styles.emptyTitle}>
                            {currentDMFriend.display_name || currentDMFriend.username}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {t('dm.beginning_soul_bond', 'This is the beginning of your soul bond with')} @{currentDMFriend.username}
                        </Text>
                    </View>
                ) : (
                    Object.entries(groupedMessages).map(([date, msgs]) => (
                        <View key={date}>
                            <View style={styles.dateDivider}>
                                <View style={styles.dateLine} />
                                <Text style={styles.dateText}>{date}</Text>
                                <View style={styles.dateLine} />
                            </View>
                            {msgs.map((msg) => {
                                const isOwnMessage = msg.sender_id === user?._id;
                                const isOracleMessage = msg.sender_id === ORACLE_ID;
                                const isHovered = hoveredMessageId === msg._id;
                                const isEditing = editingMessageId === msg._id;

                                // Determine sender
                                const sender = isOwnMessage ? user : currentDMFriend;
                                const avatarLetter = sender?.username?.charAt(0).toUpperCase() || '?';
                                const displayName = sender?.display_name || sender?.username || 'Unknown';

                                // Get premium data for the sender
                                const isPremium = sender?.is_premium || false;
                                const accentColor = sender?.accent_color || null;

                                // Get equipped relics for the sender
                                const equippedRelics = sender?.equipped_relics || {};
                                const frameClass = RELIC_CSS_MAP[equippedRelics.frame] || null;
                                const bubbleClass = RELIC_CSS_MAP[equippedRelics.bubble] || null;

                                return (
                                    <View
                                        key={msg._id}
                                        ref={(el) => { if (el) messageRefs.current[msg._id] = el; }}
                                        style={[
                                            styles.messageItem,
                                            isHovered && styles.messageItemHovered,
                                            highlightedMessageId === msg._id && styles.messageItemHighlight,
                                            isOracleMessage && { marginBottom: 24, paddingInlineStart: 10 }
                                        ]}
                                        onMouseEnter={() => setHoveredMessageId(msg._id)}
                                        onMouseLeave={() => setHoveredMessageId(null)}
                                    >
                                        <TouchableOpacity
                                            style={[styles.messageAvatar, { overflow: 'visible' }]}
                                            onPress={() => setSelectedUserProfile({ userId: msg.sender_id })}
                                        >
                                            {/* Aura Ring — only if no frame equipped (Frame > Glow priority) */}
                                            {!frameClass && <div style={getAuraRingStyle(isPremium, accentColor, { size: 'small' })} />}

                                            {/* Relic Frame — raw div with inline styles + CSS className for animations */}
                                            {frameClass && <div className={`relic-frame ${frameClass}`} style={{
                                                position: 'absolute',
                                                inset: '-4px',
                                                borderRadius: '50%',
                                                zIndex: 3,
                                                pointerEvents: 'none',
                                                ...(FRAME_INLINE_STYLES[frameClass] || {}),
                                            }} />}

                                            <View style={{ width: '100%', height: '100%', borderRadius: '50%', zIndex: 2, position: 'relative' }}>
                                                {sender?.avatar_url ? (
                                                    <img
                                                        src={resolveAssetUrl(sender.avatar_url)}
                                                        style={{ width: '100%', height: '100%', borderRadius: '50%', cursor: 'pointer' }}
                                                        alt=""
                                                    />
                                                ) : (
                                                    <Text style={styles.messageAvatarText}>
                                                        {avatarLetter}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>

                                        {/* Message content — using raw div so className works for bubble CSS */}
                                        <div
                                            style={{
                                                flex: 1,
                                                ...(bubbleClass ? (BUBBLE_INLINE_STYLES[bubbleClass] || {}) : {}),
                                            }}
                                            className={bubbleClass ? `relic-bubble ${bubbleClass}` : undefined}
                                        >
                                            <View style={styles.messageHeader}>
                                                <TouchableOpacity onPress={() => setSelectedUserProfile({ userId: msg.sender_id })}>
                                                    <Text style={[
                                                        styles.messageUsername,
                                                        { cursor: 'pointer' },
                                                        getAuraNameStyle(isPremium, accentColor),
                                                        isOracleMessage && { textShadow: '0 0 5px #9ca3af' }
                                                    ]}>
                                                        {displayName}
                                                        {isOracleMessage && <span style={{
                                                            fontSize: 10, backgroundColor: '#374151', color: '#f3f4f6',
                                                            padding: '2px 4px', borderRadius: 4, marginInlineStart: 6,
                                                            verticalAlign: 'middle', border: '1px solid #9ca3af'
                                                        }}>ORACLE</span>}
                                                    </Text>
                                                </TouchableOpacity>
                                                <Text style={styles.messageTime}>
                                                    {formatTime(msg.timestamp || msg.created_at)}
                                                </Text>
                                            </View>

                                            {isEditing ? (
                                                <View style={styles.editContainer}>
                                                    <TextInput
                                                        style={styles.editInput}
                                                        value={editContent}
                                                        onChangeText={setEditContent}
                                                        onKeyPress={(e) => handleEditKeyPress(e, msg._id)}
                                                        autoFocus
                                                        multiline
                                                    />
                                                    <View style={styles.editActions}>
                                                        <Text style={styles.editHint}>{t('dm.edit_hint', 'Enter to save • Esc to cancel')}</Text>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View style={styles.messageBody}>
                                                    {/* Forwarded Indicator */}
                                                    {msg.is_forwarded && (
                                                        <View style={styles.forwardedIndicator}>
                                                            <Text style={styles.forwardedText}>
                                                                ↪️ {t('dm.forward_badge', 'Forwarded')}{msg.forward_server_name ? ` ${t('dm.forward_from', 'from')} ${msg.forward_server_name}` : ''}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    {/* Reply Preview */}
                                                    {msg.reply_to && (
                                                        <View style={styles.replyPreview}>
                                                            <View style={styles.replyBar} />
                                                            <View style={styles.replyContent}>
                                                                <Text style={styles.replyUsername}>↩️ {msg.reply_to.username}</Text>
                                                                <Text style={styles.replyText} numberOfLines={1}>
                                                                    {msg.reply_to.content}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    )}
                                                    <MarkdownText style={styles.messageText}>{msg.content}</MarkdownText>
                                                    {msg.updated_at && msg.updated_at !== msg.created_at && (
                                                        <Text style={styles.editedLabel}>{t('dm.edited_label', '(edited)')}</Text>
                                                    )}
                                                    {/* Attachments */}
                                                    {msg.attachments?.length > 0 && (
                                                        <View style={{ marginTop: 8 }}>
                                                            {msg.attachments.map((att, i) => (
                                                                <View key={i} style={{ marginBottom: 4 }}>
                                                                    {att.type === 'voice' ? (
                                                                        <VoiceMessagePlayer
                                                                            url={resolveAssetUrl(att.url)}
                                                                            duration={att.metadata?.duration}
                                                                        />
                                                                    ) : att.type === 'image' ? (
                                                                        <img src={resolveAssetUrl(att.url)} style={{ maxWidth: 300, borderRadius: 8 }} alt="" />
                                                                    ) : (
                                                                        <TouchableOpacity onPress={() => window.open(resolveAssetUrl(att.url), '_blank')}>
                                                                            <Text style={{ color: '#8b5cf6', fontSize: 13, textDecorationLine: 'underline' }}>
                                                                                📎 {att.filename}
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                    )}
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}

                                                    {/* Display Reactions under message */}
                                                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                        <View style={styles.reactionsContainer}>
                                                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                                                                users.length > 0 && (
                                                                    <TouchableOpacity
                                                                        key={emoji}
                                                                        style={[
                                                                            styles.reactionBadge,
                                                                            users.includes(user?._id) && styles.reactionBadgeActive
                                                                        ]}
                                                                        onPress={() => handleReaction(msg._id, emoji)}
                                                                    >
                                                                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                                                                        <Text style={styles.reactionCount}>{users.length}</Text>
                                                                    </TouchableOpacity>
                                                                )
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        {
                                            isHovered && !isEditing && (
                                                <View style={styles.messageActions}>
                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        onPress={() => setShowEmojiPicker(showEmojiPicker === msg._id ? null : msg._id)}
                                                        title={t('dm.btn_react', 'Bestow reaction')}
                                                    >
                                                        <Smile size={18} color="#b9bbbe" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.actionIconBtn, starredMessages.has(msg._id) && styles.starredIconBtn]}
                                                        onPress={() => handleStarMessage(msg._id)}
                                                        title={starredMessages.has(msg._id) ? t('dm.btn_unstar', "Unstar message") : t('dm.btn_star', "Star message")}
                                                    >
                                                        <Star size={18} color={starredMessages.has(msg._id) ? "#f59e0b" : "#b9bbbe"} fill={starredMessages.has(msg._id) ? "#f59e0b" : "none"} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        onPress={() => handleReply(msg)}
                                                        title={t('dm.btn_reply', 'Reply')}
                                                    >
                                                        <Reply size={18} color="#b9bbbe" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        onPress={() => handleForward(msg)}
                                                        title={t('dm.btn_forward', 'Forward')}
                                                    >
                                                        <Share size={18} color="#b9bbbe" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.actionIconBtn, copyLinkFeedback === msg._id && styles.copiedIconBtn]}
                                                        onPress={() => handleCopyLink(msg)}
                                                        title={copyLinkFeedback === msg._id ? t('dm.btn_copied', "Copied!") : t('dm.btn_copy_link', "Copy Essence")}
                                                    >
                                                        {copyLinkFeedback === msg._id ? (
                                                            <Check size={18} color="#10b981" />
                                                        ) : (
                                                            <Link size={18} color="#b9bbbe" />
                                                        )}
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        onPress={() => msg.is_pinned ? unpinMessage(msg._id) : pinMessage(msg._id)}
                                                        title={msg.is_pinned ? t('dm.btn_unpin', 'Unpin Message') : t('dm.btn_pin', 'Pin Message')}
                                                    >
                                                        <Pin size={18} color={msg.is_pinned ? "#fff" : "#b9bbbe"} fill={msg.is_pinned ? "#fff" : "none"} />
                                                    </TouchableOpacity>

                                                    {/* Oracle Utility Buttons */}
                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        onPress={async () => {
                                                            try {
                                                                setSystemWhisper({ title: t('oracle.distilling_title', 'Distilling Essence...'), content: t('oracle.contemplating', 'The Oracle is contemplating...') });
                                                                const response = await oracleAPI.summarize(msg.content);
                                                                setSystemWhisper({ title: t('oracle.distilled_title', '🔮 Distilled Essence'), content: response.data.result });
                                                            } catch (e) { setSystemWhisper({ title: 'Error', content: t('oracle.error_vision', 'Clouded vision.') }); }
                                                        }}
                                                        title={t('dm.btn_summarize', 'Distill Essence (Summarize)')}
                                                    >
                                                        <Sparkles size={18} color="#9ca3af" />
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        onPress={async () => {
                                                            try {
                                                                setSystemWhisper({ title: t('oracle.unveiling_title', 'Unveiling Meaning...'), content: t('oracle.contemplating', 'The Oracle is contemplating...') });
                                                                const response = await oracleAPI.explain(msg.content);
                                                                setSystemWhisper({ title: t('oracle.unveiled_title', '👁️ Unveiled Meaning'), content: response.data.result });
                                                            } catch (e) { setSystemWhisper({ title: 'Error', content: t('oracle.error_vision', 'Clouded vision.') }); }
                                                        }}
                                                        title={t('dm.btn_explain', 'Unveil Meaning (Explain)')}
                                                    >
                                                        <Eye size={18} color="#9ca3af" />
                                                    </TouchableOpacity>
                                                    {isOwnMessage && (
                                                        <>
                                                            <TouchableOpacity
                                                                style={styles.actionIconBtn}
                                                                onPress={() => handleStartEdit(msg)}
                                                                title={t('dm.btn_edit', 'Reshape')}
                                                            >
                                                                <Edit2 size={18} color="#b9bbbe" />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={[styles.actionIconBtn, styles.deleteIconBtn]}
                                                                onPress={() => handleDelete(msg._id)}
                                                                title={t('dm.btn_delete', 'Delete')}
                                                            >
                                                                <Trash2 size={18} color="#ef4444" />
                                                            </TouchableOpacity>
                                                        </>
                                                    )}
                                                </View>
                                            )
                                        }

                                        {/* Emoji Picker */}
                                        {
                                            showEmojiPicker === msg._id && (
                                                <View style={styles.emojiPicker}>
                                                    {QUICK_EMOJIS.map(emoji => (
                                                        <TouchableOpacity
                                                            key={emoji}
                                                            style={styles.emojiBtn}
                                                            onPress={() => handleReaction(msg._id, emoji)}
                                                        >
                                                            <Text style={styles.emojiText}>{emoji}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            )
                                        }
                                    </View>
                                );
                            })}
                        </View>
                    ))
                )}
            </ScrollView >

            {/* Input */}
            {/* File Preview */}
            {
                selectedFiles.length > 0 && (
                    <View style={styles.filesPreview}>
                        {selectedFiles.map((file, index) => (
                            <View key={index} style={styles.filePreviewItem}>
                                <View style={styles.fileIcon}>
                                    <Text style={styles.fileIconText}>📄</Text>
                                </View>
                                <View style={styles.fileInfo}>
                                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                                    <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                                </View>
                                <TouchableOpacity style={styles.removeFileBtn} onPress={() => removeFile(index)}>
                                    <Text style={styles.removeFileText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )
            }

            {/* Reply Preview Bar */}
            {
                replyingTo && (
                    <View style={styles.replyInputBar}>
                        <View style={styles.replyInputContent}>
                            <Text style={styles.replyInputLabel}>{t('dm.replying_to', 'Replying to')}</Text>
                            <Text style={styles.replyInputUsername}>{replyingTo.sender_display_name || replyingTo.sender_username}</Text>
                            <Text style={styles.replyInputText} numberOfLines={1}>{replyingTo.content}</Text>
                        </View>
                        <TouchableOpacity style={styles.replyInputClose} onPress={cancelReply}>
                            <Text style={styles.replyInputCloseText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Typing Indicator */}
            {
                typingInfo && (
                    <div className="dm-typing-indicator-container">
                        <div className="dm-typing-dots-container">
                            <span className="dm-typing-dot"></span>
                            <span className="dm-typing-dot"></span>
                            <span className="dm-typing-dot"></span>
                        </div>
                        <span className="dm-typing-text">
                            {typingInfo.username} {t('dm.is_typing', 'is typing...')}
                        </span>
                    </div>
                )
            }

            {/* Input */}
            {
                isRecording ? (
                    /* Voice Recording UI */
                    <View style={styles.recordingContainer}>
                        <View style={styles.recordingIndicator}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingTime}>{formatRecordingTime(recordingTime)}</Text>
                        </View>
                        <View style={styles.recordingActions}>
                            <TouchableOpacity
                                style={styles.recordingCancelBtn}
                                onPress={cancelRecording}
                                title={t('dm.btn_cancel_recording', 'Cancel recording')}
                            >
                                <Trash2 size={20} color="#ef4444" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.recordingSendBtn}
                                onPress={sendVoiceMessage}
                                title={t('dm.btn_send_voice', 'Send voice message')}
                            >
                                <Send size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    /* Normal Input UI */
                    <View style={styles.inputContainer}>
                        <TouchableOpacity style={styles.attachBtn} onPress={() => fileInputRef.current?.click()}>
                            <Text style={styles.attachIcon}>+</Text>
                        </TouchableOpacity>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".docx,.pdf,.pptx,.jpg,.jpeg,.png,.gif,.txt,.zip,.rar"
                            onChange={handleFileSelect}
                            multiple
                        />
                        <TextInput
                            style={styles.input}
                            placeholder={replyingTo ? `${t('dm.placeholder_reply', 'Reply to')} ${replyingTo.sender_username}...` : `${t('dm.placeholder_message', 'Message')} @${currentDMFriend.username}`}
                            placeholderTextColor="#6b7280"
                            value={message}
                            onChangeText={handleInputChange}
                            onKeyPress={handleKeyPress}
                            multiline
                        />
                        <TouchableOpacity
                            style={styles.micBtn}
                            onPress={startRecording}
                            title={t('dm.btn_record_voice', 'Record voice message')}
                        >
                            <Mic size={22} color="#b9bbbe" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sendBtn, ((!message.trim() && selectedFiles.length === 0) || sending) && styles.sendBtnDisabled]}
                            onPress={handleSend}
                            disabled={(!message.trim() && selectedFiles.length === 0) || sending}
                        >
                            <Text style={styles.sendIcon}>➤</Text>
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Forward Modal */}
            <Suspense fallback={<Loader size={48} />}>
                <ForwardModal
                    isOpen={forwardModalOpen}
                    onClose={() => {
                        setForwardModalOpen(false);
                        setMessageToForward(null);
                    }}
                    message={messageToForward}
                    sourceType="dm"
                    onForwarded={() => {
                        setForwardModalOpen(false);
                        setMessageToForward(null);
                    }}
                />
            </Suspense>

            {/* User Profile Modal */}
            {
                selectedUserProfile && (
                    <Suspense fallback={<Loader size={48} />}>
                        <MemberProfile
                            userId={selectedUserProfile.userId}
                            onClose={() => setSelectedUserProfile(null)}
                        />
                    </Suspense>
                )
            }
            {/* System Direct Message (Oracle Output) */}
            {systemWhisper && (
                <div style={{
                    position: 'absolute',
                    bottom: 100,
                    right: 20,
                    width: 320,
                    backgroundColor: 'rgba(20, 10, 30, 0.95)',
                    border: '1px solid #9ca3af',
                    borderRadius: 8,
                    padding: 16,
                    boxShadow: '0 0 20px rgba(156, 163, 175, 0.3)',
                    zIndex: 1000,
                    backdropFilter: 'blur(10px)',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ color: '#f3f4f6', fontWeight: 'bold', fontSize: 14 }}>{systemWhisper.title}</Text>
                        <TouchableOpacity onPress={() => setSystemWhisper(null)}>
                            <X size={16} color="#9ca3af" />
                        </TouchableOpacity>
                    </div>
                    <Text style={{ color: '#e5e7eb', fontSize: 13, lineHeight: '1.4' }}>
                        {systemWhisper.content}
                    </Text>
                </div>
            )}
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.3s ease',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'var(--bg-primary)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'background-color 0.3s ease',
    },
    backBtn: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 12,
        cursor: 'pointer',
    },
    backIcon: {
        color: '#9ca3af',
        fontSize: 20,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    headerSubtitle: {
        color: '#9ca3af',
        fontSize: 12,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 24,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        overflow: 'hidden',
    },
    emptyAvatarText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '700',
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: '#9ca3af',
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 20,
    },
    dateDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        marginTop: 24,
    },
    dateLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    dateText: {
        color: '#9ca3af',
        fontSize: 12,
        fontWeight: '600',
        paddingHorizontal: 12,
    },
    // New Message Item Styles
    messageItem: {
        flexDirection: 'row',
        marginBottom: 16,
        paddingInlineEnd: 48,
        position: 'relative',
        borderRadius: 8,
        padding: 8,
        marginInlineStart: -8,
        marginInlineEnd: -8,
        transition: 'background-color 0.2s ease',
    },
    messageItemHovered: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    messageItemHighlight: {
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
        borderColor: '#7c3aed',
        borderLeftWidth: 2,
    },
    messageAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 16,
        marginTop: 2,
        overflow: 'hidden',
    },
    messageAvatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    messageContent: {
        flex: 1,
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    messageUsername: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        marginInlineEnd: 8,
    },
    messageTime: {
        color: '#9ca3af',
        fontSize: 12,
        fontWeight: '400',
    },
    messageBody: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    messageText: {
        color: '#dcddde',
        fontSize: 15,
        lineHeight: 22,
    },
    editedLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
        marginInlineStart: 4,
        marginBottom: 2,
    },
    // Action buttons repositioned
    messageActions: {
        position: 'absolute',
        insetInlineEnd: 0,
        top: 0,
        flexDirection: 'row',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 2,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    },
    actionIconBtn: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        borderRadius: 4,
        transition: 'background 0.2s',
    },
    deleteIconBtn: {
        // Red tint on hover handled by JS or just style
    },
    starredIconBtn: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    copiedIconBtn: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    forwardedIndicator: {
        marginBottom: 4,
    },
    forwardedText: {
        color: '#9ca3af',
        fontSize: 11,
        fontStyle: 'italic',
    },
    actionIcon: {
        fontSize: 14,
        color: '#b9bbbe',
    },
    deleteIcon: {
        color: '#ef4444',
    },
    // Edit Input
    editContainer: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
        padding: 8,
        marginTop: 4,
    },
    editInput: {
        color: '#dcddde',
        fontSize: 15,
        marginBottom: 8,
        outlineWidth: 0,
        backgroundColor: 'transparent',
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    editHint: {
        color: '#72767d',
        fontSize: 11,
    },
    // Typing Indicator
    typingIndicator: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: 'var(--bg-primary)',
    },
    typingText: {
        color: '#9ca3af',
        fontSize: 13,
        fontStyle: 'italic',
    },
    // Footer Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'var(--bg-primary)',
        paddingTop: 0,
        transition: 'background-color 0.3s ease',
    },
    input: {
        flex: 1,
        backgroundColor: '#202225',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#dcddde',
        fontSize: 15,
        maxHeight: 140,
        outlineWidth: 0,
    },
    sendBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineStart: 12,
        cursor: 'pointer',
        backgroundImage: 'none',
    },
    sendBtnDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    sendIcon: {
        color: '#b9bbbe',
        fontSize: 20,
    },
    emojiPicker: {
        position: 'absolute',
        top: -45,
        insetInlineEnd: 0,
        flexDirection: 'row',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 8,
        padding: 6,
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    },
    emojiBtn: {
        padding: 4,
        marginHorizontal: 2,
        borderRadius: 4,
        cursor: 'pointer',
    },
    emojiText: {
        fontSize: 18,
    },
    reactionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
        gap: 4,
    },
    reactionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
        cursor: 'pointer',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    reactionBadgeActive: {
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.3)',
    },
    reactionEmoji: {
        fontSize: 14,
        marginInlineEnd: 4,
    },
    reactionCount: {
        color: '#a0a0a0',
        fontSize: 12,
        fontWeight: '500',
    },
    // File Upload Styles
    attachBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 12,
        cursor: 'pointer',
        backgroundColor: '#202225',
        borderRadius: 20,
    },
    attachIcon: {
        color: '#b9bbbe',
        fontSize: 24,
        fontWeight: '300',
    },
    filesPreview: {
        maxHeight: 200,
        padding: 16,
        paddingBottom: 8,
        backgroundColor: '#1a1a2e',
    },
    filePreviewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2f3136',
        padding: 10,
        borderRadius: 8,
        marginBottom: 8,
    },
    fileIcon: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderRadius: 4,
        marginInlineEnd: 12,
    },
    fileIconText: {
        fontSize: 18,
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        color: '#dcddde',
        fontSize: 14,
        fontWeight: '500',
    },
    fileSize: {
        color: '#72767d',
        fontSize: 12,
        marginTop: 2,
    },
    removeFileBtn: {
        padding: 4,
        marginInlineStart: 8,
        cursor: 'pointer',
    },
    removeFileText: {
        color: '#ef4444',
        fontSize: 14,
        fontWeight: 'bold',
    },
    // Reply preview in message
    replyPreview: {
        flexDirection: 'row',
        marginBottom: 6,
        alignItems: 'stretch',
    },
    replyBar: {
        width: 3,
        backgroundColor: '#7c3aed',
        borderRadius: 2,
        marginInlineEnd: 8,
    },
    replyContent: {
        flex: 1,
    },
    replyUsername: {
        color: '#9ca3af',
        fontSize: 12,
        marginBottom: 2,
    },
    replyText: {
        color: '#6b7280',
        fontSize: 13,
    },
    // Reply input bar above input
    replyInputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16213e',
        padding: 10,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(124, 58, 237, 0.3)',
    },
    replyInputContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    replyInputLabel: {
        color: '#9ca3af',
        fontSize: 12,
    },
    replyInputUsername: {
        color: '#a78bfa',
        fontSize: 12,
        fontWeight: '600',
    },
    replyInputText: {
        color: '#6b7280',
        fontSize: 12,
        flex: 1,
    },
    replyInputClose: {
        padding: 4,
        cursor: 'pointer',
    },
    replyInputCloseText: {
        color: '#9ca3af',
        fontSize: 14,
    },
    // Voice recording styles
    micBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 8,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    recordingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1a1a2e',
        padding: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(239, 68, 68, 0.3)',
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
        marginInlineEnd: 10,
    },
    recordingTime: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    recordingActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    recordingCancelBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    recordingSendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
});

export default DirectMessageArea;
