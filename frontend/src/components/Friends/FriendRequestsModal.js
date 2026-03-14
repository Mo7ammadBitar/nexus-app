import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useFriendsStore } from '../../store/friendsStore';
import { friendsAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';

const FriendRequestsModal = ({ onClose }) => {
    const { t } = useTranslation();
    const {
        pendingRequests,
        sentRequests,
        fetchPendingRequests,
        fetchSentRequests,
        fetchFriends,
        acceptRequest,
        rejectRequest,
        cancelRequest,
    } = useFriendsStore();

    const [activeTab, setActiveTab] = useState('pending');
    const [searchUsername, setSearchUsername] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [searchSuccess, setSearchSuccess] = useState('');
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        fetchPendingRequests();
        fetchSentRequests();
    }, []);

    const handleAddFriend = async () => {
        if (!searchUsername.trim()) return;

        setSearchLoading(true);
        setSearchError('');
        setSearchSuccess('');

        try {
            await friendsAPI.sendRequest(searchUsername.trim());
            setSearchSuccess(t('friends.request_sent', 'Friend request sent to @{{username}}', { username: searchUsername.trim() }));
            setSearchUsername('');
            fetchSentRequests();
        } catch (err) {
            setSearchError(err.response?.data?.detail || t('friends.request_failed', 'Failed to send request'));
        }
        setSearchLoading(false);
    };

    const handleAccept = async (requestId) => {
        setActionLoading(requestId);
        await acceptRequest(requestId);
        fetchFriends();
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

    return ReactDOM.createPortal(
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <h2 style={styles.title}>{t('friends.modal_title', 'Friends')}</h2>
                    <button style={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* Add Friend Section */}
                <div style={styles.addFriendSection}>
                    <h3 style={styles.sectionTitle}>{t('friends.add_friend_title', 'ADD FRIEND')}</h3>
                    <p style={styles.sectionDesc}>
                        {t('friends.add_friend_desc', 'You can add a friend with their username.')}
                    </p>
                    <div style={styles.searchContainer}>
                        <input
                            style={styles.searchInput}
                            placeholder={t('friends.enter_username', 'Enter a username')}
                            value={searchUsername}
                            onChange={(e) => setSearchUsername(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                        />
                        <button
                            style={{
                                ...styles.sendBtn,
                                opacity: !searchUsername.trim() || searchLoading ? 0.5 : 1,
                            }}
                            onClick={handleAddFriend}
                            disabled={!searchUsername.trim() || searchLoading}
                        >
                            {searchLoading ? '...' : t('friends.btn_send_request', 'Send Friend Request')}
                        </button>
                    </div>
                    {searchError && <p style={styles.errorText}>{searchError}</p>}
                    {searchSuccess && <p style={styles.successText}>{searchSuccess}</p>}
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    <button
                        style={{
                            ...styles.tab,
                            ...(activeTab === 'pending' ? styles.activeTab : {}),
                        }}
                        onClick={() => setActiveTab('pending')}
                    >
                        {t('friends.tab_pending', 'Pending')}
                        {pendingRequests.length > 0 && (
                            <span style={styles.badge}>{pendingRequests.length}</span>
                        )}
                    </button>
                    <button
                        style={{
                            ...styles.tab,
                            ...(activeTab === 'sent' ? styles.activeTab : {}),
                        }}
                        onClick={() => setActiveTab('sent')}
                    >
                        {t('friends.tab_sent', 'Sent')}
                        {sentRequests.length > 0 && (
                            <span style={styles.badgeGray}>{sentRequests.length}</span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {activeTab === 'pending' && (
                        pendingRequests.length === 0 ? (
                            <div style={styles.emptyState}>
                                <span style={styles.emptyIcon}>📬</span>
                                <p style={styles.emptyText}>{t('friends.no_pending', 'No pending requests')}</p>
                            </div>
                        ) : (
                            pendingRequests.map((request) => (
                                <div key={request._id} style={styles.requestItem}>
                                    <div style={styles.requestInfo}>
                                        <div style={styles.avatar}>
                                            {request.requester?.avatar_url ? (
                                                <img
                                                    src={((request.requester.avatar_url)?.startsWith('http') ? (request.requester.avatar_url) : `http://localhost:8000${request.requester.avatar_url}`)}
                                                    style={styles.avatarImage}
                                                    alt=""
                                                />
                                            ) : (
                                                <span style={styles.avatarText}>
                                                    {request.requester?.username?.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div style={styles.requestDetails}>
                                            <span style={styles.requestName}>
                                                {request.requester?.display_name || request.requester?.username}
                                            </span>
                                            <span style={styles.requestUsername}>
                                                @{request.requester?.username}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={styles.requestActions}>
                                        <button
                                            style={styles.acceptBtn}
                                            onClick={() => handleAccept(request._id)}
                                            disabled={actionLoading === request._id}
                                        >
                                            ✓
                                        </button>
                                        <button
                                            style={styles.rejectBtn}
                                            onClick={() => handleReject(request._id)}
                                            disabled={actionLoading === request._id}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}

                    {activeTab === 'sent' && (
                        sentRequests.length === 0 ? (
                            <div style={styles.emptyState}>
                                <span style={styles.emptyIcon}>📤</span>
                                <p style={styles.emptyText}>{t('friends.no_sent', 'No sent requests')}</p>
                            </div>
                        ) : (
                            sentRequests.map((request) => (
                                <div key={request._id} style={styles.requestItem}>
                                    <div style={styles.requestInfo}>
                                        <div style={styles.avatar}>
                                            {request.receiver?.avatar_url ? (
                                                <img
                                                    src={((request.receiver.avatar_url)?.startsWith('http') ? (request.receiver.avatar_url) : `http://localhost:8000${request.receiver.avatar_url}`)}
                                                    style={styles.avatarImage}
                                                    alt=""
                                                />
                                            ) : (
                                                <span style={styles.avatarText}>
                                                    {request.receiver?.username?.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div style={styles.requestDetails}>
                                            <span style={styles.requestName}>
                                                {request.receiver?.display_name || request.receiver?.username}
                                            </span>
                                            <span style={styles.requestUsername}>
                                                @{request.receiver?.username}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={styles.requestActions}>
                                        <span style={styles.pendingLabel}>{t('friends.status_pending', 'Pending')}</span>
                                        <button
                                            style={styles.cancelBtn}
                                            onClick={() => handleCancel(request._id)}
                                            disabled={actionLoading === request._id}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
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
    modal: {
        backgroundColor: '#16213e',
        borderRadius: '12px',
        width: '440px',
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
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    },
    title: {
        color: '#fff',
        fontSize: '18px',
        fontWeight: '600',
        margin: 0,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#6b7280',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '4px',
    },
    addFriendSection: {
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    },
    sectionTitle: {
        color: '#fff',
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        margin: '0 0 8px 0',
    },
    sectionDesc: {
        color: '#6b7280',
        fontSize: '13px',
        margin: '0 0 12px 0',
    },
    searchContainer: {
        display: 'flex',
        backgroundColor: '#0f3460',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
        padding: '12px 16px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#fff',
        fontSize: '14px',
        outline: 'none',
    },
    sendBtn: {
        padding: '12px 20px',
        backgroundColor: '#7c3aed',
        border: 'none',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    errorText: {
        color: '#ef4444',
        fontSize: '13px',
        marginTop: '8px',
        marginBottom: 0,
    },
    successText: {
        color: '#10b981',
        fontSize: '13px',
        marginTop: '8px',
        marginBottom: 0,
    },
    tabs: {
        display: 'flex',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    },
    tab: {
        padding: '12px 16px',
        background: 'none',
        border: 'none',
        borderBottom: '2px solid transparent',
        color: '#6b7280',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    activeTab: {
        color: '#fff',
        borderBottomColor: '#7c3aed',
    },
    badge: {
        backgroundColor: '#ef4444',
        color: '#fff',
        padding: '2px 6px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: '600',
    },
    badgeGray: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        color: '#6b7280',
        padding: '2px 6px',
        borderRadius: '10px',
        fontSize: '11px',
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px 20px',
    },
    emptyIcon: {
        fontSize: '36px',
        display: 'block',
        marginBottom: '12px',
    },
    emptyText: {
        color: '#6b7280',
        fontSize: '14px',
        margin: 0,
    },
    requestItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        marginBottom: '6px',
    },
    requestInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    avatar: {
        width: '40px',
        height: '40px',
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
        fontSize: '16px',
        fontWeight: '600',
    },
    requestDetails: {
        display: 'flex',
        flexDirection: 'column',
    },
    requestName: {
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
    },
    requestUsername: {
        color: '#6b7280',
        fontSize: '12px',
    },
    requestActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    acceptBtn: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: '#10b981',
        border: 'none',
        color: '#fff',
        fontSize: '16px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rejectBtn: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: '#ef4444',
        border: 'none',
        color: '#fff',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingLabel: {
        color: '#6b7280',
        fontSize: '12px',
    },
    cancelBtn: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        color: '#6b7280',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
};

export default FriendRequestsModal;
