import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { useTranslation } from 'react-i18next';
import { starredAPI } from '../../services/api';

const StarredMessagesPanel = ({ onClose }) => {
    const { t, i18n } = useTranslation();
    const [starredMessages, setStarredMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchStarredMessages();
    }, []);

    const fetchStarredMessages = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await starredAPI.getStarredMessages();
            setStarredMessages(response.data);
        } catch (err) {
            console.error('Failed to fetch starred messages:', err);
            setError(t('profile.err_load_starred', 'Failed to load starred messages'));
        } finally {
            setLoading(false);
        }
    };

    const handleUnstar = async (messageId) => {
        try {
            await starredAPI.unstarMessage(messageId);
            setStarredMessages(prev => prev.filter(msg => msg.message_id !== messageId));
        } catch (err) {
            console.error('Failed to unstar message:', err);
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString(i18n.language, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSourceIcon = (sourceType) => {
        return sourceType === 'dm' ? '💬' : '#';
    };

    return (
        <View style={styles.overlay}>
            <View style={styles.panel}>
                <View style={styles.header}>
                    <Text style={styles.title}>⭐ {t('profile.starred_title', 'Starred Messages')}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    {loading ? (
                        <View style={styles.centerContainer}>
                            <Text style={styles.loadingText}>{t('profile.loading_starred', 'Loading starred messages...')}</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.centerContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryBtn} onPress={fetchStarredMessages}>
                                <Text style={styles.retryBtnText}>{t('common.retry', 'Retry')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : starredMessages.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>⭐</Text>
                            <Text style={styles.emptyTitle}>{t('profile.no_starred_title', 'No Starred Messages')}</Text>
                            <Text style={styles.emptySubtitle}>
                                {t('profile.no_starred_subtitle', 'Star important messages to find them easily later. Click the ☆ icon on any message to star it.')}
                            </Text>
                        </View>
                    ) : (
                        starredMessages.map((msg) => (
                            <View key={msg._id} style={styles.messageCard}>
                                <View style={styles.messageHeader}>
                                    <View style={styles.senderInfo}>
                                        <View style={styles.senderAvatar}>
                                            {msg.sender_avatar_url ? (
                                                <img
                                                    src={((msg.sender_avatar_url)?.startsWith('http') ? (msg.sender_avatar_url) : `http://localhost:8000${msg.sender_avatar_url}`)}
                                                    style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                                    alt=""
                                                />
                                            ) : (
                                                <Text style={styles.senderAvatarText}>
                                                    {msg.sender_username?.charAt(0).toUpperCase() || '?'}
                                                </Text>
                                            )}
                                        </View>
                                        <View>
                                            <Text style={styles.senderName}>
                                                {msg.sender_display_name || msg.sender_username}
                                            </Text>
                                            <Text style={styles.timestamp}>{formatTime(msg.timestamp)}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.unstarBtn}
                                        onPress={() => handleUnstar(msg.message_id)}
                                    >
                                        <Text style={styles.unstarIcon}>⭐</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.messageContent}>
                                    <Text style={styles.messageText}>{msg.content}</Text>

                                    {/* Attachments */}
                                    {msg.attachments?.length > 0 && (
                                        <View style={styles.attachments}>
                                            {msg.attachments.map((att, i) => (
                                                <View key={i} style={styles.attachment}>
                                                    {att.type === 'image' ? (
                                                        <img
                                                            src={((att.url)?.startsWith('http') ? (att.url) : `http://localhost:8000${att.url}`)}
                                                            style={{ maxWidth: 200, borderRadius: 8 }}
                                                            alt=""
                                                        />
                                                    ) : (
                                                        <Text style={styles.attachmentName}>📎 {att.filename}</Text>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                <View style={styles.sourceContainer}>
                                    <Text style={styles.sourceIcon}>{getSourceIcon(msg.source_type)}</Text>
                                    <Text style={styles.sourceText}>{msg.source_name}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
    },
    panel: {
        backgroundColor: '#16213e',
        borderRadius: 16,
        width: 600,
        maxWidth: '90vw',
        maxHeight: '85vh',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    closeBtnText: {
        color: '#fff',
        fontSize: 16,
    },
    content: {
        padding: 20,
        maxHeight: 'calc(85vh - 80px)',
    },
    centerContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        color: '#9ca3af',
        fontSize: 14,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        marginBottom: 12,
    },
    retryBtn: {
        backgroundColor: '#7c3aed',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    retryBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: '#9ca3af',
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 20,
    },
    messageCard: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    senderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    senderAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    senderAvatarText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    senderName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    timestamp: {
        color: '#6b7280',
        fontSize: 12,
        marginTop: 2,
    },
    unstarBtn: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    unstarIcon: {
        fontSize: 14,
    },
    messageContent: {
        marginBottom: 12,
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
    sourceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    sourceIcon: {
        color: '#6b7280',
        fontSize: 14,
        marginRight: 6,
    },
    sourceText: {
        color: '#6b7280',
        fontSize: 12,
    },
});

export default StarredMessagesPanel;
