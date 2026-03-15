import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { useServerStore } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import { messagesAPI, starredAPI, oracleAPI } from '../../services/api';
import { connectChatSocket, startTyping, stopTyping, joinChannel, leaveChannel } from '../../services/socket';
import MarkdownText from './MarkdownText';
import ForwardModal from './ForwardModal';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import PinnedMessagesPanel from './PinnedMessagesPanel';
import VoiceChannel from './VoiceChannel';
import MemberProfile from '../Profile/MemberProfile';
import { generateMessageLink, copyToClipboard } from '../../utils/messageLinkUtils';
import { Smile, Star, Reply, Share, Link, Edit2, Trash2, Check, Mic, Send, Square, Pin, Bell, Users, Hash, Sparkles, Eye, X } from 'lucide-react';
import {
    getAuraRingStyle,
    getAuraNameStyle,
    injectAuraAnimations,
    getAuraRingSecondaryStyle,
    getAuraPulseStyle,
    getAuraHolographicStyle
} from '../../utils/PremiumAura';
import { RELIC_CSS_MAP } from '../Shop/EtherealShop';
import { resolveAssetUrl } from '../../config';

// Role badge config: maps server role → display label + color
const ROLE_BADGES = {
    owner: { label: 'ARCHON', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' },
    moderator: { label: 'SENTINEL', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' },
};

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

const ChatArea = () => {
    const { t } = useTranslation();
    const { currentChannel, messages, addMessage, updateMessage, removeMessage, fetchMessages, members, fetchMembers, currentServer } = useServerStore();
    const { user } = useAuthStore();
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [muteTimeRemaining, setMuteTimeRemaining] = useState('');

    const ALLOWED_EXTENSIONS = ['docx', 'pdf', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'zip', 'rar'];

    // Edit/delete state
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    // Reaction picker state
    const [showEmojiPicker, setShowEmojiPicker] = useState(null);
    const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

    // Starred messages state
    const [starredMessages, setStarredMessages] = useState(new Set());

    // Reply state
    const [replyingTo, setReplyingTo] = useState(null);

    // Forward modal state
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [messageToForward, setMessageToForward] = useState(null);
    const [copyLinkFeedback, setCopyLinkFeedback] = useState(null);

    // Typing indicator state
    const [typingUsers, setTypingUsers] = useState([]);

    // User profile popup state
    const [selectedUserProfile, setSelectedUserProfile] = useState(null);
    const typingTimeoutRef = useRef(null);
    const [systemWhisper, setSystemWhisper] = useState(null); // { title, content }

    // Highlight message from URL params (for "jump to message" feature)
    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const messageRefs = useRef({});

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);

    // Pinned messages state
    const [showPinnedPanel, setShowPinnedPanel] = useState(false);

    // Check if current user is muted
    const myMemberData = members.find(m => m.user_id === user?._id);
    const isMuted = myMemberData?.is_muted;
    const muteReason = myMemberData?.mute_reason;
    const muteExpiresAt = myMemberData?.mute_expires_at;

    // Check if user is moderator/owner
    const isModOrOwner = myMemberData?.role === 'owner' || myMemberData?.role === 'moderator';

    // Check if channel is restricted to mods only
    const isChannelRestricted = currentChannel?.send_permission === 'mods_only' && !isModOrOwner;

    // Inject Aura animations on mount
    useEffect(() => {
        injectAuraAnimations();
    }, []);

    // Helper to get premium data for a user from members list
    const getMemberPremiumData = useCallback((userId) => {
        const member = members.find(m => m.user_id === userId);

        // If it's the current user, prioritize the global `user` state for instant reactivity
        if (user && userId === user._id) {
            return {
                isPremium: user.is_premium || false,
                accentColor: user.accent_color || null,
                equippedRelics: user.equipped_relics || {},
                role: member?.role || 'member', // Keep role from server members list
            };
        }

        return {
            isPremium: member?.is_premium || false,
            accentColor: member?.accent_color || null,
            equippedRelics: member?.equipped_relics || {},
            role: member?.role || 'member',
        };
    }, [members, user]);

    // Calculate and update remaining mute time
    useEffect(() => {
        if (!isMuted || !muteExpiresAt) {
            setMuteTimeRemaining('');
            return;
        }

        const updateTimeRemaining = () => {
            const now = new Date();
            const expiresAt = new Date(muteExpiresAt);
            const diffMs = expiresAt - now;

            if (diffMs <= 0) {
                setMuteTimeRemaining(t('chat.mute_expired', 'Mute expired - refreshing...'));
                // Refresh members to check if mute has been lifted
                if (currentServer?._id) {
                    fetchMembers(currentServer._id);
                }
                return;
            }

            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            if (hours > 0) {
                setMuteTimeRemaining(t('chat.mute_remaining_hms', '{{hours}}h {{minutes}}m {{seconds}}s remaining', { hours, minutes, seconds }));
            } else if (minutes > 0) {
                setMuteTimeRemaining(t('chat.mute_remaining_ms', '{{minutes}}m {{seconds}}s remaining', { minutes, seconds }));
            } else {
                setMuteTimeRemaining(t('chat.mute_remaining_s', '{{seconds}}s remaining', { seconds }));
            }
        };

        updateTimeRemaining();
        const interval = setInterval(updateTimeRemaining, 1000);
        return () => clearInterval(interval);
    }, [isMuted, muteExpiresAt, currentServer?._id, fetchMembers]);

    useEffect(() => {
        // Channel to bottom on new messages (unless we're highlighting)
        if (scrollRef.current && !highlightedMessageId) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, highlightedMessageId]);

    // Handle "jump to message" from URL params
    useEffect(() => {
        const highlightId = searchParams.get('highlightMessage');
        if (highlightId && messages.length > 0) {
            // Set highlighted message
            setHighlightedMessageId(highlightId);

            // Clear the URL param
            searchParams.delete('highlightMessage');
            setSearchParams(searchParams, { replace: true });

            // Channel to the message after a small delay (to allow render)
            setTimeout(() => {
                const messageElement = messageRefs.current[highlightId];
                if (messageElement) {
                    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);

            // Clear highlight after 3 seconds
            setTimeout(() => {
                setHighlightedMessageId(null);
            }, 3000);
        }
    }, [searchParams, messages, setSearchParams]);

    // Socket connection for real-time messages and typing
    useEffect(() => {
        if (!currentChannel) return;

        // Connect socket with handlers
        const socket = connectChatSocket(
            // onMessage handler - add new messages to store
            (message) => {
                if (message.channel_id === currentChannel._id) {
                    addMessage(message);
                }
            },
            // onTyping handler
            (data) => {
                if (data.channel_id === currentChannel._id && data.user_id !== user?._id) {
                    setTypingUsers(prev => {
                        if (!prev.find(u => u.user_id === data.user_id)) {
                            return [...prev, { user_id: data.user_id, username: data.username }];
                        }
                        return prev;
                    });
                }
            },
            // onStopTyping handler
            (data) => {
                if (data.channel_id === currentChannel._id) {
                    setTypingUsers(prev => prev.filter(u => u.user_id !== data.user_id));
                }
            }
        );

        // Join the channel room
        if (socket) {
            joinChannel(currentChannel._id).catch(err => {
                console.error('Failed to join channel:', err);
            });
        }

        return () => {
            // Leave channel on cleanup
            if (currentChannel) {
                leaveChannel(currentChannel._id);
            }
            setTypingUsers([]);
        };
    }, [currentChannel, addMessage, user?._id]);

    const handleSend = async () => {
        if ((!messageText.trim() && selectedFiles.length === 0) || !currentChannel || isSending || isMuted || isChannelRestricted) return;

        const content = messageText.trim() || ' '; // API requires content
        const fileToSend = selectedFiles[0] || null; // Get first file if exists
        const replyToId = replyingTo?._id || null;
        setMessageText('');
        setSelectedFiles([]);
        setReplyingTo(null);
        setIsSending(true);

        // Stop typing indicator
        if (currentChannel) {
            stopTyping(currentChannel._id);
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
            const response = await messagesAPI.sendMessage(currentChannel._id, formData);
            addMessage(response.data.data);
        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage = error.response?.data?.detail || "Failed to send message. Please try again.";
            toast.error(errorMessage);

            // Restore text and files so the user doesn't lose their draft
            setMessageText(content === ' ' ? '' : content);
            if (fileToSend) setSelectedFiles([fileToSend]);
        } finally {
            setIsSending(false);
        }
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

    // Handle input change with typing indicator
    const handleInputChange = useCallback((text) => {
        setMessageText(text);

        if (currentChannel && text.trim()) {
            startTyping(currentChannel._id);

            // Clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Stop typing after 2 seconds of no input
            typingTimeoutRef.current = setTimeout(() => {
                stopTyping(currentChannel._id);
            }, 2000);
        }
    }, [currentChannel]);

    // Handle reply button click
    const handleReply = (msg) => {
        setReplyingTo(msg);
    };

    const cancelReply = () => {
        setReplyingTo(null);
    };

    // Edit message handlers
    const handleStartEdit = (msg) => {
        setEditingMessageId(msg._id);
        setEditContent(msg.content);
        setDeleteConfirmId(null);
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    const handleSaveEdit = async (messageId) => {
        if (!editContent.trim() || !currentChannel) return;

        try {
            const response = await messagesAPI.editMessage(currentChannel._id, messageId, editContent.trim());
            updateMessage(messageId, response.data.data);
            setEditingMessageId(null);
            setEditContent('');
        } catch (error) {
            console.error('Failed to edit message:', error);
        }
    };

    const handleEditKeyPress = (e, messageId) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit(messageId);
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    // Delete message handlers
    const handleDeleteClick = (messageId) => {
        setDeleteConfirmId(messageId);
        setEditingMessageId(null);
    };

    const handleConfirmDelete = async (messageId) => {
        if (!currentChannel) return;

        try {
            await messagesAPI.deleteMessage(currentChannel._id, messageId);
            removeMessage(messageId);
            setDeleteConfirmId(null);
        } catch (error) {
            console.error('Failed to delete message:', error);
        }
    };

    const handleCancelDelete = () => {
        setDeleteConfirmId(null);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Check if current user can edit/delete a message
    const canEditMessage = (msg) => msg.user_id === user?._id;
    const canDeleteMessage = (msg) => msg.user_id === user?._id || isModOrOwner;

    // Reaction handlers
    const handleReaction = async (messageId, emoji) => {
        try {
            const msg = messages.find(m => m._id === messageId);
            const reactions = msg?.reactions || {};
            const hasReacted = reactions[emoji]?.includes(user?._id);

            if (hasReacted) {
                const response = await messagesAPI.removeReaction(messageId, emoji);
                updateMessage(messageId, { reactions: response.data.reactions });
            } else {
                const response = await messagesAPI.addReaction(messageId, emoji);
                updateMessage(messageId, { reactions: response.data.reactions });
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
                await starredAPI.starMessage('channel', messageId);
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

    // Copy message link handler
    const handleCopyLink = async (msg) => {
        if (!currentServer || !currentChannel) return;
        const link = generateMessageLink(currentServer._id, currentChannel._id, msg._id);
        const success = await copyToClipboard(link);
        if (success) {
            setCopyLinkFeedback(msg._id);
            setTimeout(() => setCopyLinkFeedback(null), 2000);
        }
    };

    // Voice recording handlers
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

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start(100); // Collect data every 100ms
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Failed to start recording:', error);
            toast.error(t('chat.mic_required', 'Microphone access is required to record voice messages.'));
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
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                // Stop all tracks
                mediaRecorder.stream.getTracks().forEach(track => track.stop());

                resolve({ blob: audioBlob, duration: recordingTime });
            };

            mediaRecorder.stop();

            // Clear interval
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
        });
    };

    const cancelRecording = async () => {
        const mediaRecorder = mediaRecorderRef.current;
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            mediaRecorder.stop();
        }

        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }

        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
    };

    const sendVoiceMessage = async () => {
        const result = await stopRecording();
        setIsRecording(false);
        setRecordingTime(0);

        if (!result || !result.blob || result.blob.size === 0) {
            console.error('No audio recorded');
            return;
        }

        setIsSending(true);

        try {
            const formData = new FormData();
            formData.append('content', t('chat.voice_enchantment', '🎤 Voice Enchantment'));

            // Create file with proper extension
            const extension = result.blob.type.includes('webm') ? 'webm' : 'm4a';
            const file = new File([result.blob], `voice_${Date.now()}.${extension}`, {
                type: result.blob.type
            });
            formData.append('file', file);
            formData.append('message_type', 'voice');
            formData.append('duration', result.duration.toString());

            const response = await messagesAPI.sendMessage(currentChannel._id, formData);
            addMessage(response.data.data);
        } catch (error) {
            console.error('Failed to send voice message:', error);
            const errorMessage = error.response?.data?.detail || "Failed to send voice message. Please try again.";
            toast.error(errorMessage);
        } finally {
            setIsSending(false);
        }
    };

    if (!currentChannel) {
        return (
            <View style={styles.noChannel}>
                <Text style={styles.noChannelText}>{t('chat.no_channel', 'Select a Channel to begin communion')}</Text>
            </View>
        );
    }

    if (currentChannel.type === 'voice') {
        return <VoiceChannel channelId={currentChannel._id} />;
    }

    return (
        <View style={styles.container}>
            {/* Typing Indicator CSS Animation */}
            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
                .typing-indicator-container {
                    display: flex;
                    align-items: center;
                    padding: 4px 16px 8px 16px;
                    gap: 8px;
                }
                .typing-dots-container {
                    display: flex;
                    align-items: center;
                    height: 10px;
                }
                .typing-dot {
                    width: 6px;
                    height: 6px;
                    background-color: #b9bbbe;
                    border-radius: 50%;
                    display: inline-block;
                    margin: 0 2px;
                    animation: bounce 1.4s infinite ease-in-out both;
                }
                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }
                .typing-dot:nth-child(3) { animation-delay: 0s; }
                .typing-text {
                    color: #b9bbbe;
                    font-size: 12px;
                    font-weight: 600;
                }

                /* Relic Frame Styles */
                .relic-frame {
                    position: absolute;
                    inset: -4px;
                    border-radius: 50%;
                    z-index: 3;
                    pointer-events: none;
                }
                .relic-frame-celestial {
                    border: 2px solid #7c3aed;
                    box-shadow: 0 0 8px rgba(124, 58, 237, 0.6), inset 0 0 4px rgba(124, 58, 237, 0.3);
                    animation: celestialPulse 3s ease-in-out infinite;
                }
                .relic-frame-infernal {
                    border: 2px solid #ef4444;
                    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6), inset 0 0 4px rgba(239, 68, 68, 0.3);
                    animation: infernalFlicker 2s ease-in-out infinite;
                }
                .relic-frame-frost {
                    border: 2px solid #06b6d4;
                    box-shadow: 0 0 8px rgba(6, 182, 212, 0.6), inset 0 0 4px rgba(6, 182, 212, 0.3);
                }
                .relic-frame-verdant {
                    border: 2px solid #10b981;
                    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5), inset 0 0 4px rgba(16, 185, 129, 0.25);
                }

                /* Relic Bubble Styles */
                .relic-bubble-ethereal {
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(124, 58, 237, 0.04)) !important;
                    border-inline-start: 2px solid rgba(139, 92, 246, 0.4) !important;
                }
                .relic-bubble-shadow {
                    background: linear-gradient(135deg, rgba(30, 27, 75, 0.3), rgba(0, 0, 0, 0.15)) !important;
                    border-inline-start: 2px solid rgba(99, 102, 241, 0.3) !important;
                }
                .relic-bubble-golden {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.04)) !important;
                    border-inline-start: 2px solid rgba(245, 158, 11, 0.4) !important;
                }
                .relic-bubble-aurora {
                    background: linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(16, 185, 129, 0.04)) !important;
                    border-inline-start: 2px solid rgba(6, 182, 212, 0.4) !important;
                }

                @keyframes celestialPulse {
                    0%, 100% { box-shadow: 0 0 8px rgba(124, 58, 237, 0.6); }
                    50% { box-shadow: 0 0 14px rgba(124, 58, 237, 0.9); }
                }
                @keyframes infernalFlicker {
                    0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.6); }
                    50% { box-shadow: 0 0 14px rgba(239, 68, 68, 0.9); }
                }
            `}</style>
            {/* Header */}
            <div style={StyleSheet.flatten(styles.header)}>
                <div style={StyleSheet.flatten(styles.headerLeft)}>
                    <Hash size={24} color="#9ca3af" style={{ marginInlineEnd: 8 }} />
                    <View>
                        <Text style={styles.headerTitle}>{currentChannel.name}</Text>
                        {currentChannel.topic && (
                            <Text style={styles.headerTopic}>{currentChannel.topic}</Text>
                        )}
                    </View>
                </div>
                <div style={StyleSheet.flatten(styles.headerIcons)}>
                    <TouchableOpacity
                        style={[styles.headerIconButton, showPinnedPanel && styles.headerIconButtonActive]}
                        onPress={() => setShowPinnedPanel(!showPinnedPanel)}
                        title="Anchored Truths"
                    >
                        <Pin size={24} color={showPinnedPanel ? "#fff" : "#b9bbbe"} />
                    </TouchableOpacity>
                </div>
            </div>

            {/* Messages */}
            <ScrollView
                ref={scrollRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyMessages}>
                        <Text style={styles.emptyTitle}>{t('chat.welcome_channel', 'Welcome to the sanctuary of #{{name}}!', { name: currentChannel.name })}</Text>
                        <Text style={styles.emptySubtitle}>{t('chat.beginning_path', 'This is the beginning of this sacred path.')}</Text>
                    </View>
                ) : (
                    messages.map((msg, index) => {
                        const isHovered = hoveredMessageId === msg._id;
                        const isEditing = editingMessageId === msg._id;
                        const isDeleting = deleteConfirmId === msg._id;

                        // Get premium data for the message sender
                        const { isPremium, accentColor, equippedRelics, role } = getMemberPremiumData(msg.user_id);
                        // Resolve relic IDs → actual CSS class names
                        const frameClass = equippedRelics?.frame ? (RELIC_CSS_MAP[equippedRelics.frame] || '') : '';
                        const bubbleClass = equippedRelics?.bubble ? (RELIC_CSS_MAP[equippedRelics.bubble] || '') : '';
                        const roleBadge = ROLE_BADGES[role] || null;

                        return (
                            <View
                                key={msg._id || index}
                                ref={(el) => { if (el) messageRefs.current[msg._id] = el; }}
                                style={[
                                    styles.messageItem,
                                    isHovered && styles.messageItemHovered,
                                    highlightedMessageId === msg._id && styles.messageItemHighlight
                                ]}
                                onMouseEnter={() => setHoveredMessageId(msg._id)}
                                onMouseLeave={() => setHoveredMessageId(null)}
                            >
                                <TouchableOpacity
                                    style={[styles.messageAvatar, { overflow: 'visible' }]}
                                    onPress={() => setSelectedUserProfile({ userId: msg.user_id, username: msg.username })}
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
                                        {msg.avatar_url ? (
                                            <img
                                                src={resolveAssetUrl(msg.avatar_url)}
                                                style={{ width: '100%', height: '100%', borderRadius: '50%', cursor: 'pointer' }}
                                                alt=""
                                            />
                                        ) : (
                                            <Text style={styles.messageAvatarText}>
                                                {msg.username?.charAt(0).toUpperCase() || '?'}
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
                                    <div style={StyleSheet.flatten(styles.messageHeader)}>
                                        <TouchableOpacity onPress={() => setSelectedUserProfile({ userId: msg.user_id, username: msg.username })}>
                                            <Text style={[styles.messageUsername, { cursor: 'pointer' }, getAuraNameStyle(isPremium, accentColor)]}>
                                                {msg.display_name || msg.username}
                                            </Text>
                                        </TouchableOpacity>
                                        {/* Minimalist Role Badge Removed */}
                                        <Text style={styles.messageTime}>{formatTime(msg.timestamp)}</Text>
                                        {msg.is_pinned && (
                                            <View style={styles.pinnedBadge} title={t('chat.anchored_truth', 'Anchored Truth')}>
                                                <View style={{ transform: [{ rotate: '45deg' }] }}>
                                                    <Pin size={12} color="#b9bbbe" />
                                                </View>
                                            </View>
                                        )}
                                        {msg.is_edited && (
                                            <Text style={styles.editedBadge}>{t('chat.edited', '(edited)')}</Text>
                                        )}
                                    </div>

                                    {isEditing ? (
                                        <View style={styles.editContainer}>
                                            <TextInput
                                                style={styles.editInput}
                                                value={editContent}
                                                onChangeText={setEditContent}
                                                onKeyPress={(e) => handleEditKeyPress(e, msg._id)}
                                                multiline
                                                autoFocus
                                            />
                                            <View style={styles.editActions}>
                                                <TouchableOpacity
                                                    style={styles.editActionBtn}
                                                    onPress={() => handleSaveEdit(msg._id)}
                                                >
                                                    <Text style={styles.editActionText}>{t('chat.btn_reshape', 'Reshape')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.editActionBtn, styles.cancelBtn]}
                                                    onPress={handleCancelEdit}
                                                >
                                                    <Text style={styles.editActionText}>{t('common.cancel', 'Cancel')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.editHint}>{t('chat.edit_hint', 'Esc to cancel • Enter to reshape')}</Text>
                                        </View>
                                    ) : isDeleting ? (
                                        <View style={styles.deleteConfirmContainer}>
                                            <Text style={styles.deleteConfirmText}>
                                                {t('chat.confirm_delete', 'Delete this thought?')}
                                            </Text>
                                            <View style={styles.deleteActions}>
                                                <TouchableOpacity
                                                    style={[styles.deleteActionBtn, styles.confirmDeleteBtn]}
                                                    onPress={() => handleConfirmDelete(msg._id)}
                                                >
                                                    <Text style={styles.deleteActionText}>{t('chat.btn_banish', 'Delete')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.deleteActionBtn}
                                                    onPress={handleCancelDelete}
                                                >
                                                    <Text style={styles.deleteActionText}>{t('common.cancel', 'Cancel')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            {/* Forwarded Indicator */}
                                            {msg.is_forwarded && (
                                                <View style={styles.forwardedIndicator}>
                                                    <Text style={styles.forwardedText}>
                                                        {msg.forward_server_name ? t('chat.forwarded_from', '↪️ Forwarded from {{name}}', { name: msg.forward_server_name }) : t('chat.forwarded', '↪️ Forwarded')}
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
                                            {msg.attachments?.length > 0 && (
                                                <View style={styles.attachments}>
                                                    {msg.attachments.map((att, i) => (
                                                        <View key={i} style={styles.attachment}>
                                                            {att.type === 'voice' ? (
                                                                <VoiceMessagePlayer
                                                                    url={resolveAssetUrl(att.url)}
                                                                    duration={att.metadata?.duration}
                                                                />
                                                            ) : att.type === 'image' ? (
                                                                <img src={resolveAssetUrl(att.url)} style={{ maxWidth: 300, borderRadius: 8 }} alt="" />
                                                            ) : (
                                                                <TouchableOpacity onPress={() => window.open(resolveAssetUrl(att.url), '_blank')}>
                                                                    <Text style={styles.attachmentName}>📎 {att.filename}</Text>
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
                                        </>
                                    )}
                                </div>

                                {/* Action buttons - show on hover */}
                                {
                                    isHovered && !isEditing && !isDeleting && (
                                        <View style={styles.messageActions}>
                                            <TouchableOpacity
                                                style={styles.actionIconBtn}
                                                onPress={() => setShowEmojiPicker(showEmojiPicker === msg._id ? null : msg._id)}
                                                title={t('chat.add_reaction', 'Add reaction')}
                                            >
                                                <Smile size={18} color="#b9bbbe" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionIconBtn, starredMessages.has(msg._id) && styles.starredIconBtn]}
                                                onPress={() => handleStarMessage(msg._id)}
                                                title={starredMessages.has(msg._id) ? t('chat.unstar_msg', 'Unstar message') : t('chat.star_msg', 'Star message')}
                                            >
                                                <Star size={18} color={starredMessages.has(msg._id) ? "#f59e0b" : "#b9bbbe"} fill={starredMessages.has(msg._id) ? "#f59e0b" : "none"} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.actionIconBtn}
                                                onPress={() => handleReply(msg)}
                                                title={t('chat.reply', 'Reply')}
                                            >
                                                <Reply size={18} color="#b9bbbe" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.actionIconBtn}
                                                onPress={() => handleForward(msg)}
                                                title={t('chat.forward', 'Forward')}
                                            >
                                                <Share size={18} color="#b9bbbe" />
                                            </TouchableOpacity>

                                            {/* Oracle Utility Buttons */}
                                            <TouchableOpacity
                                                style={styles.actionIconBtn}
                                                onPress={async () => {
                                                    try {
                                                        setSystemWhisper({ title: t('oracle.distilling', 'Distilling Essence...'), content: t('oracle.contemplating', 'The Oracle is contemplating...') });
                                                        const response = await oracleAPI.summarize(msg.content);
                                                        setSystemWhisper({ title: t('oracle.distilled', '🔮 Distilled Essence'), content: response.data.result });
                                                    } catch (e) { setSystemWhisper({ title: t('common.error', 'Error'), content: t('oracle.error_vision', 'Clouded vision.') }); }
                                                }}
                                                title={t('oracle.btn_distill', 'Distill Essence (Summarize)')}
                                            >
                                                <Sparkles size={18} color="#9ca3af" />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.actionIconBtn}
                                                onPress={async () => {
                                                    try {
                                                        setSystemWhisper({ title: t('oracle.unveiling', 'Unveiling Meaning...'), content: t('oracle.contemplating', 'The Oracle is contemplating...') });
                                                        const response = await oracleAPI.explain(msg.content);
                                                        setSystemWhisper({ title: t('oracle.unveiled', '👁️ Unveiled Meaning'), content: response.data.result });
                                                    } catch (e) { setSystemWhisper({ title: t('common.error', 'Error'), content: t('oracle.error_vision', 'Clouded vision.') }); }
                                                }}
                                                title={t('oracle.btn_unveil', 'Unveil Meaning (Explain)')}
                                            >
                                                <Eye size={18} color="#9ca3af" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionIconBtn, copyLinkFeedback === msg._id && styles.copiedIconBtn]}
                                                onPress={() => handleCopyLink(msg)}
                                                title={copyLinkFeedback === msg._id ? t('common.copied', 'Copied!') : t('channel.copy_link', 'Copy Link')}
                                            >
                                                {copyLinkFeedback === msg._id ? (
                                                    <Check size={18} color="#10b981" />
                                                ) : (
                                                    <Link size={18} color="#b9bbbe" />
                                                )}
                                            </TouchableOpacity>
                                            {(isModOrOwner) && (
                                                <TouchableOpacity
                                                    style={[styles.actionIconBtn, msg.is_pinned && styles.pinnedIconBtn]}
                                                    onPress={() => {
                                                        const { pinMessage, unpinMessage } = useServerStore.getState();
                                                        if (msg.is_pinned) unpinMessage(msg._id);
                                                        else pinMessage(msg._id);
                                                    }}
                                                    title={msg.is_pinned ? t('chat.unpin_msg', 'Unpin Message') : t('chat.pin_msg', 'Pin Message')}
                                                >
                                                    <View style={msg.is_pinned ? { transform: [{ rotate: '45deg' }] } : {}}>
                                                        <Pin size={18} color={msg.is_pinned ? "#fff" : "#b9bbbe"} fill={msg.is_pinned ? "#fff" : "none"} />
                                                    </View>
                                                </TouchableOpacity>
                                            )}
                                            {canEditMessage(msg) && (
                                                <TouchableOpacity
                                                    style={styles.actionIconBtn}
                                                    onPress={() => handleStartEdit(msg)}
                                                    title={t('chat.edit_msg', 'Edit message')}
                                                >
                                                    <Edit2 size={18} color="#b9bbbe" />
                                                </TouchableOpacity>
                                            )}
                                            {canDeleteMessage(msg) && (
                                                <TouchableOpacity
                                                    style={[styles.actionIconBtn, styles.deleteIconBtn]}
                                                    onPress={() => handleDeleteClick(msg._id)}
                                                    title={t('chat.delete_msg', 'Delete message')}
                                                >
                                                    <Trash2 size={18} color="#ef4444" />
                                                </TouchableOpacity>
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
                    })
                )}
            </ScrollView >

            {/* Input - Show muted message, restricted message, or normal input */}
            {
                isMuted ? (
                    <View style={styles.mutedContainer}>
                        <View style={styles.mutedIcon}>
                            <Text style={styles.mutedIconText}>🔇</Text>
                        </View>
                        <View style={styles.mutedInfo}>
                            <Text style={styles.mutedTitle}>{t('chat.muted_title', 'You have been muted')}</Text>
                            <Text style={styles.mutedReason}>
                                {t('chat.muted_reason', 'Reason: {{reason}}', { reason: muteReason || t('chat.no_reason', 'No reason provided') })}
                            </Text>
                            {muteTimeRemaining && (
                                <Text style={styles.mutedDuration}>⏱️ {muteTimeRemaining}</Text>
                            )}
                        </View>
                    </View>
                ) : isChannelRestricted ? (
                    <View style={styles.restrictedContainer}>
                        <View style={styles.restrictedIcon}>
                            <Text style={styles.restrictedIconText}>🔒</Text>
                        </View>
                        <View style={styles.restrictedInfo}>
                            <Text style={styles.restrictedTitle}>{t('chat.restricted_title', 'Channel Restricted')}</Text>
                            <Text style={styles.restrictedReason}>
                                {t('chat.restricted_desc', 'Only moderators and the server owner can send messages in this channel.')}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <>
                        {/* Reply Preview Bar */}
                        {replyingTo && (
                            <View style={styles.replyInputBar}>
                                <View style={styles.replyInputContent}>
                                    <Text style={styles.replyInputLabel}>{t('chat.replying_to', 'Replying to')}</Text>
                                    <Text style={styles.replyInputUsername}>{replyingTo.display_name || replyingTo.username}</Text>
                                    <Text style={styles.replyInputText} numberOfLines={1}>{replyingTo.content}</Text>
                                </View>
                                <TouchableOpacity style={styles.replyInputClose} onPress={cancelReply}>
                                    <Text style={styles.replyInputCloseText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* File Preview */}
                        {selectedFiles.length > 0 && (
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
                        )}

                        {/* Typing Indicator */}
                        {typingUsers.length > 0 && (
                            <div className="typing-indicator-container">
                                <div className="typing-dots-container">
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                </div>
                                <span className="typing-text">
                                    {typingUsers.length === 1
                                        ? t('chat.typing_one', '{{user}} is typing...', { user: typingUsers[0].username })
                                        : typingUsers.length === 2
                                            ? t('chat.typing_two', '{{user1}} and {{user2}} are typing...', { user1: typingUsers[0].username, user2: typingUsers[1].username })
                                            : t('chat.typing_multiple', '{{count}} people are typing...', { count: typingUsers.length })
                                    }
                                </span>
                            </div>
                        )}

                        {isRecording ? (
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
                                        title={t('chat.cancel_recording', 'Cancel recording')}
                                    >
                                        <Trash2 size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.recordingSendBtn}
                                        onPress={sendVoiceMessage}
                                        title={t('chat.send_voice_msg', 'Send voice message')}
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
                                    placeholder={replyingTo ? t('chat.reply_placeholder', 'Reply to {{user}}...', { user: replyingTo.username }) : t('chat.message_placeholder', 'Message #{{name}}', { name: currentChannel.name })}
                                    placeholderTextColor="#6b7280"
                                    value={messageText}
                                    onChangeText={handleInputChange}
                                    onKeyPress={handleKeyPress}
                                    multiline
                                />
                                <TouchableOpacity
                                    style={styles.micBtn}
                                    onPress={startRecording}
                                    title={t('chat.record_voice_msg', 'Record voice message')}
                                >
                                    <Mic size={22} color="#b9bbbe" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.sendBtn, ((!messageText.trim() && selectedFiles.length === 0) || isSending) && styles.sendBtnDisabled]}
                                    onPress={handleSend}
                                    disabled={(!messageText.trim() && selectedFiles.length === 0) || isSending}
                                >
                                    <Text style={styles.sendBtnText}>➤</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )
            }

            {/* Forward Modal */}
            <ForwardModal
                isOpen={forwardModalOpen}
                onClose={() => {
                    setForwardModalOpen(false);
                    setMessageToForward(null);
                }}
                message={messageToForward}
                sourceType="channel"
                onForwarded={() => {
                    setForwardModalOpen(false);
                    setMessageToForward(null);
                }}
            />

            {/* Pinned Messages Panel */}
            <PinnedMessagesPanel
                isOpen={showPinnedPanel}
                onClose={() => setShowPinnedPanel(false)}
                type="channel"
                sourceId={currentChannel?._id}
            />

            {/* User Profile Modal */}
            {
                selectedUserProfile && (
                    <MemberProfile
                        userId={selectedUserProfile.userId}
                        onClose={() => setSelectedUserProfile(null)}
                    />
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
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'var(--bg-primary)',
        transition: 'background-color 0.3s ease',
    },
    headerLeft: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerIcons: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    headerIcon: {
        color: '#6b7280',
        flexShrink: 0,
        marginInlineEnd: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    headerTopic: {
        color: '#9ca3af',
        fontSize: 12,
        marginTop: 2,
    },
    headerIconButton: {
        cursor: 'pointer',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
    },
    emptyMessages: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: '#6b7280',
        fontSize: 14,
    },
    messageItem: {
        flexDirection: 'row',
        marginBottom: 16,
        position: 'relative',
        paddingInlineEnd: 70,
        borderRadius: 8,
        padding: 8,
        marginInlineStart: -8,
        marginInlineEnd: -8,
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
    },
    messageItemHighlight: {
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        boxShadow: '0 0 0 2px #7c3aed, 0 0 20px rgba(124, 58, 237, 0.4)',
    },
    messageItemHovered: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    messageAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 12,
        overflow: 'hidden',
    },
    messageAvatarText: {
        color: '#fff',
        fontSize: 16,
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
        fontSize: 14,
        fontWeight: '600',
        marginInlineEnd: 8,
    },
    messageTime: {
        color: '#6b7280',
        fontSize: 12,
    },
    editedBadge: {
        color: '#6b7280',
        fontSize: 11,
        marginInlineStart: 6,
        fontStyle: 'italic',
    },
    messageText: {
        color: '#b4b4b4',
        fontSize: 14,
        lineHeight: 20,
    },
    attachments: {
        marginTop: 8,
    },
    attachment: {
        marginBottom: 4,
    },
    attachmentName: {
        color: '#8b5cf6',
        fontSize: 13,
    },
    // Message action buttons
    messageActions: {
        position: 'absolute',
        insetInlineEnd: 0,
        top: 0,
        flexDirection: 'row',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 6,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    actionIconBtn: {
        width: 28,
        height: 28,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 2,
        cursor: 'pointer',
    },
    deleteIconBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
    },
    // Edit mode styles
    editContainer: {
        marginTop: 4,
    },
    editInput: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 8,
        padding: 10,
        color: '#fff',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#7c3aed',
        outlineWidth: 0,
    },
    editActions: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    editActionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: '#7c3aed',
    },
    cancelBtn: {
        backgroundColor: '#374151',
    },
    editActionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    editHint: {
        color: '#6b7280',
        fontSize: 11,
        marginTop: 4,
    },
    // Delete confirmation styles
    deleteConfirmContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    deleteConfirmText: {
        color: '#f87171',
        fontSize: 14,
        marginBottom: 8,
    },
    deleteActions: {
        flexDirection: 'row',
        gap: 8,
    },
    deleteActionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: '#374151',
    },
    confirmDeleteBtn: {
        backgroundColor: '#ef4444',
    },
    deleteActionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 16,
        paddingTop: 8,
        backgroundColor: 'var(--bg-primary)',
        transition: 'background-color 0.3s ease',
    },
    input: {
        flex: 1,
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 14,
        maxHeight: 120,
        outlineWidth: 0,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        cursor: 'pointer',
    },
    sendBtnDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    sendBtnText: {
        color: '#fff',
        fontSize: 18,
    },
    noChannel: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noChannelText: {
        color: '#6b7280',
        fontSize: 16,
    },
    voiceChannel: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    voiceIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#16213e',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    voiceIconText: {
        fontSize: 36,
    },
    voiceTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    voiceSubtitle: {
        color: '#6b7280',
        fontSize: 14,
        marginBottom: 24,
    },
    joinVoiceBtn: {
        backgroundImage: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 8,
    },
    joinVoiceBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    mutedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(239, 68, 68, 0.3)',
    },
    mutedIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    mutedIconText: {
        fontSize: 20,
    },
    mutedInfo: {
        flex: 1,
    },
    mutedTitle: {
        color: '#ef4444',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    mutedReason: {
        color: '#f87171',
        fontSize: 13,
    },
    mutedDuration: {
        color: '#fbbf24',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
    },
    restrictedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(124, 58, 237, 0.3)',
    },
    restrictedIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    restrictedIconText: {
        fontSize: 20,
    },
    restrictedInfo: {
        flex: 1,
    },
    restrictedTitle: {
        color: '#a855f7',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    restrictedReason: {
        color: '#c084fc',
        fontSize: 13,
    },
    emojiPicker: {
        position: 'absolute',
        top: -45,
        insetInlineEnd: 0,
        flexDirection: 'row',
        backgroundColor: '#1a1a2e',
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
        marginLeft: 8,
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
        marginInlineEnd: 12,
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
    // Typing indicator
    typingIndicator: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: '#1a1a2e',
    },
    typingText: {
        color: '#9ca3af',
        fontSize: 12,
        fontStyle: 'italic',
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

export default ChatArea;
