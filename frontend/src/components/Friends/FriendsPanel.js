import React, { useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useFriendsStore } from '../../store/friendsStore';
import { MessageSquare, X, Users, Inbox, Send, Check, Hourglass } from 'lucide-react';
import { getAuraRingStyle, getAuraNameStyle, injectAuraAnimations } from '../../utils/PremiumAura';
import { RELIC_CSS_MAP } from '../Shop/EtherealShop';
import { useTranslation } from 'react-i18next';
import { resolveAssetUrl } from '../../config';

// Inline styles for frame relics
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

const FriendsPanel = ({ onClose, onOpenDM }) => {
    const {
        friends,
        pendingRequests,
        sentRequests,
        fetchFriends,
        fetchPendingRequests,
        fetchSentRequests,
        acceptRequest,
        rejectRequest,
        cancelRequest,
        removeFriend,
        unreadCounts,
    } = useFriendsStore();

    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('friends');
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        fetchFriends();
        fetchPendingRequests();
        fetchSentRequests();
        injectAuraAnimations();
    }, []);

    const handleAccept = async (requestId) => {
        setActionLoading(requestId);
        await acceptRequest(requestId);
        setActionLoading(null);
    };

    const handleReject = async (requestId) => {
        setActionLoading(requestId);
        await rejectRequest(requestId);
        setActionLoading(null);
    };

    const handleCancel = async (requestId) => {
        setActionLoading(requestId);
        await cancelRequest(requestId);
        setActionLoading(null);
    };

    const handleRemove = async (friendId) => {
        if (window.confirm(t('friends_panel.confirm_remove', 'Are you sure you want to sever the bond with this Ally?'))) {
            setActionLoading(friendId);
            await removeFriend(friendId);
            setActionLoading(null);
        }
    };

    const handleOpenDM = (friend) => {
        onOpenDM(friend);
        onClose();
    };

    const renderFriendsList = () => (
        <div style={styles.list}>
            {friends.length === 0 ? (
                <div style={styles.emptyState}>
                    <span style={{ ...styles.emptyIcon, display: 'flex', justifyContent: 'center' }}><Users size={48} color="#4b5563" /></span>
                    <p style={styles.emptyText}>{t('friends_panel.empty_allies_title', 'No allies yet')}</p>
                    <p style={styles.emptySubtext}>{t('friends_panel.empty_allies_subtitle', 'Summon allies to start communing!')}</p>
                </div>
            ) : (
                friends.map((friend) => {
                    if (!friend) return null;
                    const isPremium = friend.is_premium;
                    const accentColor = friend.accent_color;

                    const equippedRelics = friend.equipped_relics || {};
                    const frameClass = equippedRelics.frame ? (RELIC_CSS_MAP[equippedRelics.frame] || '') : '';
                    const hasFrame = !!frameClass;

                    return (
                        <div key={friend._id} style={styles.friendItem}>
                            <div style={styles.friendInfo}>
                                <div style={{
                                    ...styles.avatar,
                                    position: 'relative',
                                    border: (!hasFrame && isPremium) ? 'none' : styles.avatar.border,
                                    overflow: 'visible', // Allow ring to show outside
                                    backgroundColor: (!hasFrame && isPremium) ? 'transparent' : styles.avatar.backgroundColor
                                }}>
                                    {/* Aura Ring — only if no frame equipped */}
                                    {!hasFrame && <div style={getAuraRingStyle(isPremium, accentColor, { size: 'small' })} />}

                                    {/* Relic Frame overlay */}
                                    {hasFrame && <div className={`relic-frame ${frameClass}`} style={{
                                        position: 'absolute',
                                        inset: '-4px',
                                        borderRadius: '50%',
                                        zIndex: 3,
                                        pointerEvents: 'none',
                                        ...(FRAME_INLINE_STYLES[frameClass] || {}),
                                    }} />}

                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        zIndex: 2,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: !friend.avatar_url ? (isPremium ? 'transparent' : '#a855f7') : 'transparent' // Fallback bg logic
                                    }}>
                                        {friend.avatar_url ? (
                                            <img
                                                src={resolveAssetUrl(friend.avatar_url)}
                                                style={styles.avatarImage}
                                                alt=""
                                            />
                                        ) : (
                                            <span style={styles.avatarText}>
                                                {friend.username?.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={styles.friendDetails}>
                                    <span style={{
                                        ...styles.friendName,
                                        ...getAuraNameStyle(isPremium, accentColor)
                                    }}>
                                        {friend.display_name || friend.username}
                                    </span>
                                    <span style={styles.friendUsername}>@{friend.username}</span>
                                </div>
                                {/* Unread Badge */}
                                {unreadCounts[friend.id] > 0 && (
                                    <div style={styles.unreadBadge}>
                                        {unreadCounts[friend.id] > 9 ? '9+' : unreadCounts[friend.id]}
                                    </div>
                                )}
                            </div>
                            <div style={styles.friendActions}>
                                <button
                                    style={styles.messageBtn}
                                    onClick={() => handleOpenDM(friend)}
                                    title={t('friends_panel.btn_whisper', 'Direct Message')}
                                >
                                    <MessageSquare size={16} />
                                </button>
                                <button
                                    style={{ ...styles.removeBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => handleRemove(friend._id)}
                                    disabled={actionLoading === friend._id}
                                    title={t('friends_panel.btn_remove_friend', 'Remove Friend')}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );

    const renderPendingRequests = () => (
        <div style={styles.list}>
            {pendingRequests.length === 0 ? (
                <div style={styles.emptyState}>
                    <span style={{ ...styles.emptyIcon, display: 'flex', justifyContent: 'center' }}><Inbox size={48} color="#4b5563" /></span>
                    <p style={styles.emptyText}>{t('friends_panel.empty_pending_title', 'No awaiting bonds')}</p>
                </div>
            ) : (
                pendingRequests.map((request) => (
                    <div key={request._id} style={styles.friendItem}>
                        <div style={styles.friendInfo}>
                            <div style={styles.avatar}>
                                {request.requester?.avatar_url ? (
                                    <img
                                        src={resolveAssetUrl(request.requester.avatar_url)}
                                        style={styles.avatarImage}
                                        alt=""
                                    />
                                ) : (
                                    <span style={styles.avatarText}>
                                        {request.requester?.username?.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div style={styles.friendDetails}>
                                <span style={styles.friendName}>
                                    {request.requester?.display_name || request.requester?.username}
                                </span>
                                <span style={styles.friendUsername}>
                                    @{request.requester?.username}
                                </span>
                            </div>
                        </div>
                        <div style={styles.requestActions}>
                            <button
                                style={{ ...styles.acceptBtn, display: 'flex', alignItems: 'center', gap: 6 }}
                                onClick={() => handleAccept(request._id)}
                                disabled={actionLoading === request._id}
                            >
                                <Check size={14} /> {t('friends_panel.btn_accept', 'Accept')}
                            </button>
                            <button
                                style={{ ...styles.rejectBtn, display: 'flex', alignItems: 'center', gap: 6 }}
                                onClick={() => handleReject(request._id)}
                                disabled={actionLoading === request._id}
                            >
                                <X size={14} /> {t('friends_panel.btn_reject', 'Decline')}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    const renderSentRequests = () => (
        <div style={styles.list}>
            {sentRequests.length === 0 ? (
                <div style={styles.emptyState}>
                    <span style={{ ...styles.emptyIcon, display: 'flex', justifyContent: 'center' }}><Send size={48} color="#4b5563" /></span>
                    <p style={styles.emptyText}>{t('friends_panel.empty_sent_title', 'No offered alliances')}</p>
                </div>
            ) : (
                sentRequests.map((request) => (
                    <div key={request._id} style={styles.friendItem}>
                        <div style={styles.friendInfo}>
                            <div style={styles.avatar}>
                                {request.receiver?.avatar_url ? (
                                    <img
                                        src={resolveAssetUrl(request.receiver.avatar_url)}
                                        style={styles.avatarImage}
                                        alt=""
                                    />
                                ) : (
                                    <span style={styles.avatarText}>
                                        {request.receiver?.username?.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div style={styles.friendDetails}>
                                <span style={styles.friendName}>
                                    {request.receiver?.display_name || request.receiver?.username}
                                </span>
                                <span style={styles.friendUsername}>
                                    @{request.receiver?.username}
                                </span>
                            </div>
                        </div>
                        <div style={styles.requestActions}>
                            <span style={{ ...styles.pendingBadge, display: 'flex', alignItems: 'center', gap: 4 }}><Hourglass size={14} /> {t('friends_panel.status_awaiting', 'Awaiting')}</span>
                            <button
                                style={styles.cancelBtn}
                                onClick={() => handleCancel(request._id)}
                                disabled={actionLoading === request._id}
                            >
                                {t('friends_panel.btn_cancel', 'Withdraw')}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return ReactDOM.createPortal(
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <h2 style={styles.title}>{t('friends_panel.title', 'Allies')}</h2>
                    <button style={{ ...styles.closeBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    <button
                        style={{
                            ...styles.tab,
                            ...(activeTab === 'friends' ? styles.activeTab : {}),
                        }}
                        onClick={() => setActiveTab('friends')}
                    >
                        {t('friends_panel.tab_all', 'All Allies')}
                        {friends.length > 0 && (
                            <span style={styles.badge}>{friends.length}</span>
                        )}
                    </button>
                    <button
                        style={{
                            ...styles.tab,
                            ...(activeTab === 'pending' ? styles.activeTab : {}),
                        }}
                        onClick={() => setActiveTab('pending')}
                    >
                        {t('friends_panel.tab_pending', 'Awaiting')}
                        {pendingRequests.length > 0 && (
                            <span style={styles.notificationBadge}>{pendingRequests.length}</span>
                        )}
                    </button>
                    <button
                        style={{
                            ...styles.tab,
                            ...(activeTab === 'sent' ? styles.activeTab : {}),
                        }}
                        onClick={() => setActiveTab('sent')}
                    >
                        {t('friends_panel.tab_sent', 'Offered')}
                        {sentRequests.length > 0 && (
                            <span style={styles.badge}>{sentRequests.length}</span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {activeTab === 'friends' && renderFriendsList()}
                    {activeTab === 'pending' && renderPendingRequests()}
                    {activeTab === 'sent' && renderSentRequests()}
                </div>
            </div>
        </div>,
        document.body
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5000,
    },
    panel: {
        backgroundColor: '#16213e',
        borderRadius: '16px',
        width: '500px',
        maxWidth: '95vw',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    },
    title: {
        color: '#fff',
        fontSize: '22px',
        fontWeight: '700',
        margin: 0,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#6b7280',
        fontSize: '20px',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '4px',
        transition: 'color 0.2s',
    },
    tabs: {
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '0 16px',
    },
    tab: {
        flex: 1,
        padding: '14px 16px',
        background: 'none',
        border: 'none',
        borderBottom: '2px solid transparent',
        color: '#6b7280',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s',
    },
    activeTab: {
        color: '#fff',
        borderBottomColor: '#7c3aed',
    },
    badge: {
        backgroundColor: 'rgba(124, 58, 237, 0.3)',
        color: '#a855f7',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '12px',
    },
    notificationBadge: {
        backgroundColor: '#ef4444',
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px 20px',
    },
    emptyIcon: {
        fontSize: '48px',
        display: 'block',
        marginBottom: '16px',
    },
    emptyText: {
        color: '#fff',
        fontSize: '16px',
        fontWeight: '500',
        margin: '0 0 8px 0',
    },
    emptySubtext: {
        color: '#6b7280',
        fontSize: '14px',
        margin: 0,
    },
    friendItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '10px',
        transition: 'background-color 0.2s',
    },
    friendInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    avatar: {
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    avatarText: {
        color: '#fff',
        fontSize: '18px',
        fontWeight: '600',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        lineHeight: 'normal',
        margin: 0,
    },
    friendDetails: {
        display: 'flex',
        flexDirection: 'column',
    },
    friendName: {
        color: '#fff',
        fontSize: '15px',
        fontWeight: '500',
    },
    friendUsername: {
        color: '#6b7280',
        fontSize: '13px',
    },
    friendActions: {
        display: 'flex',
        gap: '8px',
    },
    messageBtn: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: '#3b82f6',
        border: 'none',
        fontSize: '16px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'opacity 0.2s',
    },
    removeBtn: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        border: 'none',
        color: '#ef4444',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'all 0.2s',
    },
    requestActions: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    acceptBtn: {
        padding: '8px 16px',
        borderRadius: '6px',
        backgroundColor: '#10b981',
        border: 'none',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    rejectBtn: {
        padding: '8px 16px',
        borderRadius: '6px',
        backgroundColor: '#ef4444',
        border: 'none',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    pendingBadge: {
        color: '#6b7280',
        fontSize: '13px',
    },
    cancelBtn: {
        padding: '8px 16px',
        borderRadius: '6px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        color: '#fff',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    unreadBadge: {
        backgroundColor: '#ef4444',
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: '600',
        marginLeft: '8px',
    },
};

export default FriendsPanel;
