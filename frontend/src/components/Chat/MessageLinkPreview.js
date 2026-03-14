import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native-web';
import { previewAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../store/serverStore';
import { useTranslation } from 'react-i18next';

/**
 * MessageLinkPreview - Renders a rich preview card for message links
 * Shows server name, channel name, and message snippet if user has access
 */
const MessageLinkPreview = ({ linkData }) => {
    const { t } = useTranslation();
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const navigate = useNavigate();

    // Get store actions
    const selectServer = useServerStore(state => state.selectServer);
    const selectChannel = useServerStore(state => state.selectChannel);
    const currentServer = useServerStore(state => state.currentServer);

    const { serverId, channelId, messageId } = linkData;

    useEffect(() => {
        const fetchPreview = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await previewAPI.getMessagePreview(serverId, channelId, messageId);
                setPreviewData(response.data);
            } catch (err) {
                console.error('Failed to fetch message preview:', err);
                if (err.response?.status === 403) {
                    setError('private');
                } else if (err.response?.status === 404) {
                    setError('not_found');
                } else {
                    setError('unknown');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchPreview();
    }, [serverId, channelId, messageId]);

    const handleClick = async () => {
        if (isNavigating) return;
        setIsNavigating(true);

        try {
            // Check if we need to switch servers
            if (currentServer?._id !== serverId) {
                // Select the target server (this also fetches channels and members)
                await selectServer(serverId);
            }

            // Select the target channel (this fetches messages)
            await selectChannel(channelId);

            // Navigate with highlight message ID as a query parameter
            navigate(`/app?highlightMessage=${messageId}`);
        } catch (err) {
            console.error('Failed to navigate to message:', err);
        } finally {
            setIsNavigating(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingCard}>
                    <View style={styles.loadingIcon} />
                    <Text style={styles.loadingText}>{t('message_preview.loading', 'Loading preview...')}</Text>
                </View>
            </View>
        );
    }

    if (error === 'private') {
        return (
            <View style={styles.container}>
                <View style={styles.privateCard}>
                    <Text style={styles.privateIcon}>🔒</Text>
                    <View style={styles.privateContent}>
                        <Text style={styles.privateTitle}>{t('message_preview.private_server', 'Private Server')}</Text>
                        <Text style={styles.privateSubtitle}>{t('message_preview.private_subtitle', "You don't have access to view this message")}</Text>
                    </View>
                </View>
            </View>
        );
    }

    if (error === 'not_found') {
        return (
            <View style={styles.container}>
                <View style={styles.errorCard}>
                    <Text style={styles.errorIcon}>❓</Text>
                    <Text style={styles.errorText}>{t('message_preview.not_found', 'Message not found')}</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <View style={styles.errorCard}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{t('message_preview.failed_load', 'Failed to load preview')}</Text>
                </View>
            </View>
        );
    }

    return (
        <TouchableOpacity style={styles.container} onPress={handleClick}>
            <View style={styles.previewCard}>
                {/* Left accent bar */}
                <View style={styles.accentBar} />

                <View style={styles.content}>
                    {/* Server info row */}
                    <View style={styles.serverRow}>
                        {previewData?.server_icon_url ? (
                            <img
                                src={((previewData.server_icon_url)?.startsWith('http') ? (previewData.server_icon_url) : `http://localhost:8000${previewData.server_icon_url}`)}
                                style={{ width: 16, height: 16, borderRadius: 4 }}
                                alt=""
                            />
                        ) : (
                            <View style={styles.serverIconPlaceholder}>
                                <Text style={styles.serverIconText}>
                                    {previewData?.server_name?.charAt(0)?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.serverName}>{previewData?.server_name}</Text>
                        <Text style={styles.channelName}>#{previewData?.channel_name}</Text>
                    </View>

                    {/* Message content */}
                    <View style={styles.messageRow}>
                        <Text style={styles.authorName}>{previewData?.author_username}:</Text>
                        <Text style={styles.messageSnippet} numberOfLines={2}>
                            {previewData?.message_snippet || `(${t('message_preview.no_content', 'no content')})`}
                        </Text>
                    </View>

                    {/* Jump to message hint */}
                    <Text style={styles.jumpHint}>{t('message_preview.jump_hint', 'Click to jump to message →')}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 6,
    },
    previewCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(30, 30, 50, 0.8)',
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.3)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    accentBar: {
        width: 4,
        backgroundColor: '#7c3aed',
    },
    content: {
        flex: 1,
        padding: 12,
    },
    serverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    avatar: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginInlineEnd: 12,
    },
    serverIconPlaceholder: {
        width: 16,
        height: 16,
        borderRadius: 4,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    serverIconText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    serverName: {
        color: '#e0e0e0',
        fontSize: 12,
        fontWeight: '600',
        marginInlineStart: 6,
    },
    timestamp: {
        color: '#72767d',
        fontSize: 12,
        marginInlineStart: 8,
    },
    channelName: {
        color: '#9ca3af',
        fontSize: 12,
        marginInlineStart: 8,
    },
    messageRow: {
        marginBottom: 4,
    },
    authorName: {
        color: '#a78bfa',
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 2,
    },
    messageSnippet: {
        color: '#b4b4b4',
        fontSize: 13,
        lineHeight: 18,
    },
    jumpHint: {
        color: '#7c3aed',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 4,
    },
    // Loading state
    loadingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 30, 50, 0.6)',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    image: {
        width: 80,
        height: 80,
        borderRadius: 4,
        objectFit: 'cover',
        marginInlineEnd: 10,
    },
    loadingIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(124, 58, 237, 0.3)',
        marginRight: 10,
    },
    loadingText: {
        color: '#9ca3af',
        fontSize: 12,
    },
    // Private/error states
    privateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(40, 40, 60, 0.6)',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    privateIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    privateContent: {
        flex: 1,
    },
    botTag: {
        backgroundColor: '#7c3aed',
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        marginInlineStart: 6,
    },
    privateTitle: {
        color: '#e0e0e0',
        fontSize: 13,
        fontWeight: '500',
    },
    privateSubtitle: {
        color: '#6b7280',
        fontSize: 11,
        marginTop: 2,
    },
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(40, 40, 60, 0.4)',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    errorIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    attachmentIcon: {
        marginInlineEnd: 8,
    },
    errorText: {
        color: '#9ca3af',
        fontSize: 12,
    },
});

export default MessageLinkPreview;
