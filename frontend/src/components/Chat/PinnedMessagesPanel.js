import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native-web';
import { X, Pin, MessageSquare, ExternalLink } from 'lucide-react';
import { useServerStore } from '../../store/serverStore';
import { useFriendsStore } from '../../store/friendsStore';
import { useTranslation } from 'react-i18next';
import MarkdownText from './MarkdownText';
import { generateMessageLink } from '../../utils/messageLinkUtils';

const PinnedMessagesPanel = ({ isOpen, onClose, type, sourceId }) => { // type: 'channel' | 'dm'
    const { t } = useTranslation();
    const {
        pinnedMessages: channelPins,
        fetchPinnedMessages: fetchChannelPins,
        unpinMessage: unpinChannelMessage
    } = useServerStore();

    const {
        pinnedMessages: dmPins,
        fetchPinnedMessages: fetchDmPins,
        unpinMessage: unpinDmMessage
    } = useFriendsStore();

    const isChannel = type === 'channel';
    const pins = isChannel ? channelPins : dmPins;
    const fetchPins = isChannel ? fetchChannelPins : fetchDmPins;
    const unpinMessage = isChannel ? unpinChannelMessage : unpinDmMessage;

    useEffect(() => {
        if (isOpen && sourceId) {
            fetchPins(sourceId);
        }
    }, [isOpen, sourceId, fetchPins]);

    if (!isOpen) return null;

    const handleJumpToMessage = (messageId) => {
        // Implement jump functionality
        // We can use URL params to trigger channel in ChatArea
        const url = new URL(window.location.href);
        url.searchParams.set('highlightMessage', messageId);
        window.history.pushState({}, '', url);
        // Force update or let Router handle it? 
        // Since we are in the same view, we might need to trigger a re-render or event.
        // But ChatArea listens to searchParams, so pushing state and dispatching popstate might work.
        window.dispatchEvent(new Event('popstate'));
        onClose();
    };

    const handleUnpin = async (messageId) => {
        await unpinMessage(messageId);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <View style={styles.overlayContainer}>
            <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
            <View style={styles.panel}>
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <Pin size={20} color="#dcddde" style={{ marginRight: 8 }} />
                        <Text style={styles.headerTitle}>{t('chat.anchored_truths', 'Anchored Truths')}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={24} color="#b9bbbe" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    {pins.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>{t('chat.no_pinned', 'No truths anchored yet.')}</Text>
                            <Text style={styles.emptySubText}>
                                {t('chat.pinned_desc', 'Anchor important thoughts to quickly access them later.')}
                            </Text>
                        </View>
                    ) : (
                        pins.map((msg) => (
                            <View key={msg._id} style={styles.messageItem}>
                                <View style={styles.messageHeader}>
                                    <View style={styles.userInfo}>
                                        {msg.author_avatar_url || msg.sender_avatar_url ? (
                                            <img
                                                src={((msg.author_avatar_url || msg.sender_avatar_url)?.startsWith('http') ? (msg.author_avatar_url || msg.sender_avatar_url) : `http://localhost:8000${msg.author_avatar_url || msg.sender_avatar_url}`)}
                                                style={styles.avatar}
                                                alt=""
                                            />
                                        ) : (
                                            <View style={[styles.avatar, styles.defaultAvatar]}>
                                                <Text style={styles.avatarText}>
                                                    {(msg.author_username || msg.sender_username || '?').charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={styles.username}>
                                            {msg.author_display_name || msg.sender_display_name || msg.author_username || msg.sender_username}
                                        </Text>
                                    </View>
                                    <Text style={styles.timestamp}>{formatTime(msg.timestamp)}</Text>
                                </View>

                                <View style={styles.messageContent}>
                                    <MarkdownText style={styles.messageText}>
                                        {msg.content_snippet || msg.content}
                                    </MarkdownText>
                                </View>

                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        style={styles.actionBtn}
                                        onPress={() => handleJumpToMessage(msg._id)}
                                    >
                                        <Text style={styles.actionBtnText}>{t('chat.jump_to', 'Jump to thought')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionIconBtn}
                                        onPress={() => handleUnpin(msg._id)}
                                        title={t('chat.unpin_msg', 'Unanchor')}
                                    >
                                        <X size={16} color="#b9bbbe" />
                                    </TouchableOpacity>
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
    overlayContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100, // Above messages
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0)', // Transparent as requested "click outside"
        // Or semi-transparent? Usually panels like this in Discord are just floaty.
        // Let's stick to transparent to not dim the chat unnecessarily, 
        // but if it helps focus, maybe very slight dim.
        // User said "Clicking outside ... should close it".
    },
    panel: {
        width: 400,
        height: '100%',
        backgroundColor: '#2f3136',
        borderLeftWidth: 1,
        borderLeftColor: '#202225',
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        padding: 16,
        paddingBottom: 0, // Tab style almost
        height: 60,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#2f3136',
        borderBottomWidth: 1,
        borderBottomColor: '#202225',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        flex: 1,
        padding: 16,
        backgroundColor: '#2f3136',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        padding: 20,
    },
    emptyText: {
        color: '#dcddde',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptySubText: {
        color: '#72767d',
        textAlign: 'center',
        fontSize: 14,
    },
    messageItem: {
        backgroundColor: '#36393f',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#202225',
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        alignItems: 'center',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        marginInlineEnd: 8,
        overflow: 'hidden',
    },
    defaultAvatar: {
        backgroundColor: '#5865f2',
    },
    avatarText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    username: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    timestamp: {
        color: '#72767d',
        fontSize: 12,
    },
    messageContent: {
        marginBottom: 8,
    },
    messageText: {
        color: '#dcddde',
        fontSize: 14,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#2f3136',
    },
    actionBtn: {
        padding: 4,
    },
    actionBtnText: {
        color: '#00aff4',
        fontSize: 12,
        fontWeight: '500',
    },
    actionIconBtn: {
        padding: 4,
    },
});

export default PinnedMessagesPanel;
