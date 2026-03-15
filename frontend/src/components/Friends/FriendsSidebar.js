import React, { useEffect, useState } from 'react';
import { useFriendsStore } from '../../store/friendsStore';
import { useTypingStore } from '../../store/typingStore';
import { friendsAPI } from '../../services/api';

const getStatusColor = (status) => {
    switch (status) {
        case 'online': return '#22c55e';
        case 'idle': return '#f59e0b';
        case 'dnd': return '#ef4444';
        default: return '#9ca3af';
    }
};

// CSS for typing animation (injected once)
const typingAnimationStyles = `
/* Typing Indicator Animation (Bouncing Dots) */
.typing-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 100%;
}

.typing-dot {
  width: 4px;
  height: 4px;
  background-color: #fff;
  border-radius: 50%;
  animation: typingBounce 1.4s infinite ease-in-out both;
}

.typing-dot:nth-child(1) { animation-delay: -0.32s; }
.typing-dot:nth-child(2) { animation-delay: -0.16s; }
.typing-dot:nth-child(3) { animation-delay: 0s; }

@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
`;

// Inject styles once
if (typeof document !== 'undefined' && !document.getElementById('typing-animation-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'typing-animation-styles';
    styleSheet.textContent = typingAnimationStyles;
    document.head.appendChild(styleSheet);
}

// Typing Animation Component
const TypingDotsIndicator = () => (
    <div style={styles.typingDotsContainer}>
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
    </div>
);

import { getAuraRingStyle, getAuraNameStyle } from '../../utils/PremiumAura';
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

const FriendsSidebar = ({ onOpenDM, onOpenRequests }) => {
    const { t } = useTranslation();
    const { friends, fetchFriends, currentDMFriend, unreadCounts } = useFriendsStore();
    const dmTyping = useTypingStore(state => state.dmTyping);

    useEffect(() => {
        fetchFriends();
    }, []);

    return (
        <div style={styles.container}>
            {/* Friends List */}
            <div style={styles.friendsList}>
                {friends.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p style={styles.emptyText}>{t('friends_sidebar.empty_friends_title', 'No allies yet')}</p>
                        <p style={styles.emptySubtext}>{t('friends_sidebar.empty_friends_subtitle', 'Click + to summon allies')}</p>
                    </div>
                ) : (
                    friends.map((friend) => {
                        if (!friend) return null;
                        const friendId = friend.id || friend._id;
                        const isTyping = !!dmTyping[friendId];

                        // Premium Data
                        const isPremium = friend.is_premium || false;
                        const accentColor = friend.accent_color || null;

                        const equippedRelics = friend.equipped_relics || {};
                        const frameClass = equippedRelics.frame ? (RELIC_CSS_MAP[equippedRelics.frame] || '') : '';
                        const hasFrame = !!frameClass;

                        return (
                            <div
                                key={friendId}
                                style={{
                                    ...styles.friendItem,
                                    ...((currentDMFriend?.id || currentDMFriend?._id) === friendId ? styles.friendItemActive : {}),
                                }}
                                onClick={() => onOpenDM(friend)}
                            >
                                <div style={{
                                    ...styles.avatar,
                                    border: (!hasFrame && isPremium) ? 'none' : styles.avatar.border,
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

                                    {friend.avatar_url ? (
                                        <img
                                            src={resolveAssetUrl(friend.avatar_url)}
                                            style={{ ...styles.avatarImage, position: 'relative', zIndex: 2 }}
                                            alt=""
                                        />
                                    ) : (
                                        <span style={{ ...styles.avatarText, position: 'relative', zIndex: 2 }}>
                                            {friend.username?.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                    {/* Show typing animation or status dot */}
                                    {isTyping ? (
                                        <div style={{ position: 'relative', zIndex: 3 }}>
                                            <TypingDotsIndicator />
                                        </div>
                                    ) : (
                                        <div style={{
                                            ...styles.statusDot,
                                            backgroundColor: getStatusColor(friend.status || (friend.is_online ? 'online' : 'offline')),
                                            zIndex: 3
                                        }} />
                                    )}
                                </div>
                                <div style={styles.friendInfo}>
                                    <span style={{ ...styles.friendName, ...getAuraNameStyle(isPremium, accentColor) }}>
                                        {friend.display_name || friend.username}
                                    </span>
                                </div>
                                {/* Unread Badge */}
                                {unreadCounts[friendId] > 0 && (
                                    <div style={styles.unreadBadge}>
                                        {unreadCounts[friendId] > 9 ? '9+' : unreadCounts[friendId]}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
    },

    friendsList: {
        flex: 1,
        padding: '0 8px',
        overflowY: 'auto',
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px 16px',
    },
    emptyText: {
        color: '#6b7280',
        fontSize: '14px',
        margin: '0 0 4px 0',
    },
    emptySubtext: {
        color: '#4b5563',
        fontSize: '12px',
        margin: 0,
    },
    friendItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '2px',
        transition: 'background-color 0.2s',
    },
    friendItemActive: {
        backgroundColor: 'rgba(124, 58, 237, 0.3)',
    },
    avatar: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '12px',
        position: 'relative', // For status dot
        // overflow: 'hidden', // Removed to allow status dot overlap
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        border: '2px solid var(--bg-secondary)', // Cutout effect
    },
    typingDotsContainer: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        padding: '3px 4px',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%', // Ensure image is round
    },
    avatarText: {
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
    },
    friendInfo: {
        flex: 1,
        overflow: 'hidden',
    },
    friendName: {
        color: '#e5e5e5',
        fontSize: '14px',
        fontWeight: '500',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    unreadBadge: {
        backgroundColor: '#ef4444',
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: '600',
        minWidth: '18px',
        textAlign: 'center',
    },
};

export default FriendsSidebar;
