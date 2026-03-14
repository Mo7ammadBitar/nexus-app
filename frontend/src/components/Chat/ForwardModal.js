import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native-web';
import { useTranslation } from 'react-i18next';
import { serversAPI, messagesAPI, dmAPI, friendsAPI } from '../../services/api';

/**
 * ForwardModal - Modal for selecting forward destination
 * Allows forwarding to channels or DM friends
 */
const ForwardModal = ({ isOpen, onClose, message, sourceType, onForwarded }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('channels'); // 'channels' or 'friends'
    const [servers, setServers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedServer, setExpandedServer] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [forwardStatus, setForwardStatus] = useState(null); // { type: 'success'|'error', message: string }

    // Fetch servers and friends on open
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [serversRes, friendsRes] = await Promise.all([
                serversAPI.getMyServers(),
                friendsAPI.getFriends()
            ]);
            setServers(serversRes.data.servers || []);
            setFriends(friendsRes.data.friends || []);
        } catch (error) {
            console.error('Failed to fetch forward destinations:', error);
        }
        setIsLoading(false);
    };

    const handleForwardToChannel = async (channelId) => {
        setForwardStatus(null);
        try {
            await messagesAPI.forwardMessage(channelId, message._id);
            setForwardStatus({ type: 'success', message: t('chat.forward_success', 'Thought forwarded!') });
            setTimeout(() => {
                onForwarded?.();
                onClose();
            }, 1000);
        } catch (error) {
            console.error('Forward failed:', error);
            setForwardStatus({ type: 'error', message: t('chat.forward_error', 'Failed to forward message') });
        }
    };

    const handleForwardToFriend = async (friendId) => {
        setForwardStatus(null);
        try {
            await dmAPI.forwardMessage(friendId, message._id, sourceType);
            setForwardStatus({ type: 'success', message: t('chat.forward_success', 'Thought forwarded!') });
            setTimeout(() => {
                onForwarded?.();
                onClose();
            }, 1000);
        } catch (error) {
            console.error('Forward failed:', error);
            setForwardStatus({ type: 'error', message: t('chat.forward_error', 'Failed to forward message') });
        }
    };

    const toggleServerExpand = async (serverId) => {
        if (expandedServer === serverId) {
            setExpandedServer(null);
            return;
        }
        setExpandedServer(serverId);

        // Fetch channels for this server if not already loaded
        const server = servers.find(s => s._id === serverId);
        if (!server?.channels) {
            try {
                const res = await serversAPI.getChannels(serverId);
                setServers(prev => prev.map(s =>
                    s._id === serverId
                        ? { ...s, channels: res.data.channels?.filter(c => c.type === 'text') || [] }
                        : s
                ));
            } catch (error) {
                console.error('Failed to fetch channels:', error);
            }
        }
    };

    // Filter based on search
    const filteredServers = servers.filter(s =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredFriends = friends.filter(f =>
        f.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <View style={styles.overlay}>
            <View style={styles.modal}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{t('chat.transmute_thought', 'Forward Thought')}</Text>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Message Preview */}
                <View style={styles.preview}>
                    <Text style={styles.previewLabel}>{t('chat.thought_label', 'Thought:')}</Text>
                    <Text style={styles.previewContent} numberOfLines={2}>
                        {message?.content || t('chat.attachment', '(attachment)')}
                    </Text>
                </View>

                {/* Search */}
                <TextInput
                    style={styles.searchInput}
                    placeholder={t('common.search', 'Search...')}
                    placeholderTextColor="#6b7280"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                {/* Tabs */}
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'channels' && styles.tabActive]}
                        onPress={() => setActiveTab('channels')}
                    >
                        <Text style={[styles.tabText, activeTab === 'channels' && styles.tabTextActive]}>
                            {t('channel.category_scrolls', 'Channels')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
                        onPress={() => setActiveTab('friends')}
                    >
                        <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
                            {t('friends.allies', 'Allies')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Status Message */}
                {forwardStatus && (
                    <View style={[
                        styles.statusBar,
                        forwardStatus.type === 'success' ? styles.statusSuccess : styles.statusError
                    ]}>
                        <Text style={styles.statusText}>{forwardStatus.message}</Text>
                    </View>
                )}

                {/* Content */}
                <ScrollView style={styles.content}>
                    {isLoading ? (
                        <View style={styles.loading}>
                            <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
                        </View>
                    ) : activeTab === 'channels' ? (
                        /* Servers & Channels List */
                        filteredServers.length === 0 ? (
                            <Text style={styles.emptyText}>{t('chat.no_realms', 'No servers found')}</Text>
                        ) : (
                            filteredServers.map(server => (
                                <View key={server._id}>
                                    <TouchableOpacity
                                        style={styles.serverItem}
                                        onPress={() => toggleServerExpand(server._id)}
                                    >
                                        <View style={styles.serverIcon}>
                                            {server.icon_url ? (
                                                <img
                                                    src={((server.icon_url)?.startsWith('http') ? (server.icon_url) : `http://localhost:8000${server.icon_url}`)}
                                                    style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                                    alt=""
                                                />
                                            ) : (
                                                <Text style={styles.serverIconText}>
                                                    {server.name?.charAt(0).toUpperCase()}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.serverName}>{server.name}</Text>
                                        <Text style={styles.expandIcon}>
                                            {expandedServer === server._id ? '▼' : '▶'}
                                        </Text>
                                    </TouchableOpacity>

                                    {expandedServer === server._id && (
                                        <View style={styles.channelList}>
                                            {server.channels?.length === 0 ? (
                                                <Text style={styles.noChannelsText}>{t('chat.no_scrolls', 'No channels found')}</Text>
                                            ) : (
                                                server.channels?.map(channel => (
                                                    <TouchableOpacity
                                                        key={channel._id}
                                                        style={styles.channelItem}
                                                        onPress={() => handleForwardToChannel(channel._id)}
                                                    >
                                                        <Text style={styles.channelIcon}>#</Text>
                                                        <Text style={styles.channelName}>{channel.name}</Text>
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                        </View>
                                    )}
                                </View>
                            ))
                        )
                    ) : (
                        /* Friends List */
                        filteredFriends.length === 0 ? (
                            <Text style={styles.emptyText}>{t('chat.no_allies', 'No allies found')}</Text>
                        ) : (
                            filteredFriends.map(friend => (
                                <TouchableOpacity
                                    key={friend.id}
                                    style={styles.friendItem}
                                    onPress={() => handleForwardToFriend(friend.id)}
                                >
                                    <View style={styles.friendAvatar}>
                                        {friend.avatar_url ? (
                                            <img
                                                src={((friend.avatar_url)?.startsWith('http') ? (friend.avatar_url) : `http://localhost:8000${friend.avatar_url}`)}
                                                style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                                alt=""
                                            />
                                        ) : (
                                            <Text style={styles.friendAvatarText}>
                                                {friend.username?.charAt(0).toUpperCase()}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={styles.friendInfo}>
                                        <Text style={styles.friendName}>
                                            {friend.display_name || friend.username}
                                        </Text>
                                        <Text style={styles.friendUsername}>@{friend.username}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )
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
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modal: {
        width: 420,
        maxHeight: '80vh',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    closeBtn: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
        cursor: 'pointer',
    },
    closeIcon: {
        color: '#9ca3af',
        fontSize: 18,
    },
    preview: {
        paddingInlineStart: 12,
        margin: 12,
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#7c3aed',
    },
    previewLabel: {
        color: '#9ca3af',
        fontSize: 11,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    previewContent: {
        color: '#dcddde',
        fontSize: 14,
    },
    searchInputContainer: {
        position: 'relative',
        margin: 12,
        marginTop: 0,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#374151',
        borderRadius: 8,
        padding: 12,
        paddingInlineStart: 40,
        color: '#fff',
        fontSize: 14,
        outlineWidth: 0,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        cursor: 'pointer',
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#7c3aed',
    },
    tabText: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#7c3aed',
    },
    statusBar: {
        padding: 10,
        margin: 12,
        marginTop: 8,
        marginBottom: 0,
        borderRadius: 6,
        alignItems: 'center',
    },
    statusSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    statusError: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    statusText: {
        color: '#fff',
        fontSize: 13,
    },
    content: {
        maxHeight: 300,
        padding: 12,
    },
    loading: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        color: '#9ca3af',
        fontSize: 14,
    },
    emptyText: {
        color: '#6b7280',
        fontSize: 14,
        textAlign: 'center',
        padding: 40,
    },
    serverItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 4,
    },
    serverIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 12,
        overflow: 'hidden',
    },
    serverIconText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    serverName: {
        flex: 1,
        color: '#dcddde',
        fontSize: 14,
        fontWeight: '500',
    },
    expandIcon: {
        color: '#6b7280',
        fontSize: 10,
    },
    channelList: {
        marginInlineStart: 48,
        marginBottom: 8,
    },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        paddingInlineStart: 12,
        borderRadius: 6,
        cursor: 'pointer',
        marginBottom: 2,
    },
    channelIcon: {
        color: '#9ca3af',
        fontSize: 16,
        marginInlineEnd: 12,
    },
    channelName: {
        color: '#b4b4b4',
        fontSize: 14,
    },
    noChannelsText: {
        color: '#6b7280',
        fontSize: 13,
        padding: 8,
        fontStyle: 'italic',
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 4,
    },
    friendAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 12,
        overflow: 'hidden',
    },
    friendAvatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        color: '#dcddde',
        fontSize: 14,
        fontWeight: '500',
    },
    friendUsername: {
        color: '#6b7280',
        fontSize: 12,
    },
    searchIcon: {
        position: 'absolute',
        insetInlineStart: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#9ca3af',
    },
});

export default ForwardModal;
