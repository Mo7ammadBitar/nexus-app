import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { usersAPI, friendsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useFriendsStore } from '../../store/friendsStore';
import { useServerStore } from '../../store/serverStore';
import { Crown, Check, Hourglass, AlertCircle, UserPlus, MessageSquare, X, Shield, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAuraRingStyle, getAuraNameStyle, injectAuraAnimations } from '../../utils/PremiumAura';
import { RELIC_CSS_MAP } from '../Shop/EtherealShop';
import { resolveAssetUrl } from '../../config';
import UserBadges from './UserBadges';

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

const MemberProfile = ({ userId, serverRole, onClose }) => {
    const { t, i18n } = useTranslation();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [friendshipStatus, setFriendshipStatus] = useState('none');
    const [requestId, setRequestId] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showRemoveDialog, setShowRemoveDialog] = useState(false); // Confirmation dialog state

    const { user: currentUser } = useAuthStore();
    const isOwnProfile = currentUser?._id === userId;

    useEffect(() => {
        injectAuraAnimations();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch user profile
                const userResponse = await usersAPI.getUser(userId);
                setUser(userResponse.data);

                // Fetch friendship status (only if not own profile)
                if (!isOwnProfile) {
                    try {
                        const statusResponse = await friendsAPI.getStatus(userId);
                        setFriendshipStatus(statusResponse.data.status);
                        setRequestId(statusResponse.data.request_id);
                    } catch (err) {
                        console.error('Failed to fetch friendship status:', err);
                    }
                }
            } catch (err) {
                setError(t('profile.err_load_profile', 'Failed to load profile'));
            }
            setLoading(false);
        };
        fetchData();
    }, [userId, isOwnProfile]);

    // Friend request actions
    const handleSendFriendRequest = async () => {
        if (!user?.username || actionLoading) return;
        setActionLoading(true);
        try {
            const response = await friendsAPI.sendRequest(user.username);
            setFriendshipStatus('pending_sent');
            setRequestId(response.data.request_id);
        } catch (err) {
            console.error('Failed to send friend request:', err);
        }
        setActionLoading(false);
    };

    const handleCancelRequest = async () => {
        if (!requestId || actionLoading) return;
        setActionLoading(true);
        try {
            await friendsAPI.cancelRequest(requestId);
            setFriendshipStatus('none');
            setRequestId(null);
        } catch (err) {
            console.error('Failed to cancel request:', err);
        }
        setActionLoading(false);
    };

    const handleAcceptRequest = async () => {
        if (!requestId || actionLoading) return;
        setActionLoading(true);
        try {
            await friendsAPI.acceptRequest(requestId);
            setFriendshipStatus('friends');
        } catch (err) {
            console.error('Failed to accept request:', err);
        }
        setActionLoading(false);
    };

    const handleRejectRequest = async () => {
        if (!requestId || actionLoading) return;
        setActionLoading(true);
        try {
            await friendsAPI.rejectRequest(requestId);
            setFriendshipStatus('none');
            setRequestId(null);
        } catch (err) {
            console.error('Failed to reject request:', err);
        }
        setActionLoading(false);
    };

    const handleRemoveFriend = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            await friendsAPI.removeFriend(userId);
            setFriendshipStatus('none');
            setRequestId(null);
            setShowRemoveDialog(false); // Close dialog on success
        } catch (err) {
            console.error('Failed to remove friend:', err);
        }
        setActionLoading(false);
    };

    // Render friend action button based on status
    const renderFriendButton = () => {
        if (isOwnProfile) return null;

        const buttonBaseStyle = {
            ...styles.actionBtn,
            opacity: actionLoading ? 0.6 : 1,
            cursor: actionLoading ? 'not-allowed' : 'pointer',
        };

        switch (friendshipStatus) {
            case 'friends':
                return (
                    <button
                        style={{ ...buttonBaseStyle, backgroundColor: '#10b981' }}
                        onClick={() => setShowRemoveDialog(true)}
                        disabled={actionLoading}
                        title={t('profile.tooltip_allies', 'Allies - Click to remove friend')}
                    >
                        <Check size={16} style={{ marginRight: 6 }} /> {t('profile.btn_allies', 'Allies')}
                    </button>
                );
            case 'pending_sent':
                return (
                    <button
                        style={{ ...buttonBaseStyle, backgroundColor: '#6b7280' }}
                        onClick={handleCancelRequest}
                        disabled={actionLoading}
                        title={t('profile.tooltip_withdraw', 'Withdraw alliance offer')}
                    >
                        <Hourglass size={16} style={{ marginRight: 6 }} /> {t('profile.btn_awaiting', 'Awaiting')}
                    </button>
                );
            case 'pending_received':
                return (
                    <div style={styles.pendingActions}>
                        <button
                            style={{ ...buttonBaseStyle, backgroundColor: '#10b981', marginRight: '8px', display: 'flex', alignItems: 'center' }}
                            onClick={handleAcceptRequest}
                            disabled={actionLoading}
                            title={t('profile.tooltip_embrace', 'Accept alliance')}
                        >
                            <Check size={16} style={{ marginRight: 6 }} /> {t('profile.btn_embrace', 'Accept')}
                        </button>
                        <button
                            style={{ ...buttonBaseStyle, backgroundColor: '#ef4444', display: 'flex', alignItems: 'center' }}
                            onClick={handleRejectRequest}
                            disabled={actionLoading}
                            title={t('profile.tooltip_deny', 'Decline alliance')}
                        >
                            <X size={16} style={{ marginRight: 6 }} /> {t('profile.btn_deny', 'Decline')}
                        </button>
                    </div>
                );
            case 'self':
                return null;
            default:
                return (
                    <button
                        style={{ ...buttonBaseStyle, display: 'flex', alignItems: 'center' }}
                        onClick={handleSendFriendRequest}
                        disabled={actionLoading}
                        title={t('profile.tooltip_offer', 'Offer Alliance')}
                    >
                        <UserPlus size={16} style={{ marginRight: 6 }} /> {t('profile.btn_summon_ally', 'Add Friend')}
                    </button>
                );
        }
    };

    // Message button (only for friends)
    const renderMessageButton = () => {
        if (isOwnProfile) return null;
        if (friendshipStatus !== 'friends') return null;

        const handleOpenDM = () => {
            // Open DM with this user
            useFriendsStore.getState().openDM({
                _id: userId,
                username: user.username,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
            });
            onClose();
        };

        return (
            <button
                style={{ ...styles.actionBtn, backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center' }}
                onClick={handleOpenDM}
                title={t('profile.tooltip_whisper', 'Direct Message')}
            >
                <MessageSquare size={16} style={{ marginRight: 6 }} /> {t('profile.btn_whisper', 'Direct Message')}
            </button>
        );
    };

    if (!userId) return null;

    // Premium cosmetic helpers
    const isPremium = user?.is_premium;
    const avatarType = user?.avatar_type || 'static';
    const bannerType = user?.banner_type || 'solid';

    // Banner styles based on premium status
    const getBannerStyle = () => {
        if (!isPremium || bannerType === 'solid') {
            return {
                backgroundColor: '#7c3aed', // Solid color for free users
            };
        }
        // Gradient banners for premium
        if (bannerType === 'gradient') {
            return {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            };
        }
        // Animated gradient for premium
        if (bannerType === 'animated') {
            return {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 3s ease infinite',
            };
        }
        return { backgroundColor: '#7c3aed' };
    };

    // Calculate dynamic background based on target user's theme
    let cardBackgroundColor = '#16213e'; // Default Dark Blue
    let themeRgb = null;

    if (user?.theme_color) {
        themeRgb = hexToRgb(user.theme_color);
        // Mix with 0.85 factor (same as bg-secondary in ThemeProvider)
        if (themeRgb) cardBackgroundColor = mixWithBlack(themeRgb, 0.85);
    }

    // Dynamic Colors for Child Elements
    const badgeBg = themeRgb ? `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, 0.2)` : 'rgba(124, 58, 237, 0.2)';
    const badgeColor = user?.theme_color || '#a855f7';
    const closeBtnBg = themeRgb ? mixWithBlack(themeRgb, 0.92) : '#0f3460'; // Darker than card

    // Avatar container style for animated avatars
    const getAvatarContainerStyle = () => {
        const baseStyle = { ...styles.avatar };

        if (isPremium) {
            return {
                ...baseStyle,
                border: 'none',
                backgroundColor: 'transparent'
            };
        }

        const stylesWithBg = {
            ...baseStyle,
            borderColor: cardBackgroundColor
        };

        return stylesWithBg;
    };

    return ReactDOM.createPortal(
        <div style={styles.overlay} onClick={onClose}>
            {/* Inject keyframes for animations */}
            <style>{`
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(124, 58, 237, 0.6); }
                    50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(124, 58, 237, 0.8); }
                }
                @keyframes premiumShimmer {
                    0% { opacity: 0.8; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.1); }
                    100% { opacity: 0.8; transform: scale(1); }
                }
                @keyframes crownPulse {
                    0%, 100% { filter: drop-shadow(0 0 4px #f59e0b); }
                    50% { filter: drop-shadow(0 0 8px #fbbf24); }
                }
            `}</style>

            <div style={{ ...styles.modal, backgroundColor: cardBackgroundColor }} onClick={(e) => e.stopPropagation()}>
                {loading ? (
                    <div style={styles.loading}>{t('common.loading', 'Loading...')}</div>
                ) : error ? (
                    <div style={styles.error}>{error}</div>
                ) : user ? (
                    <>
                        {/* Banner */}
                        <div style={{ ...styles.banner, ...getBannerStyle() }}>
                            {user.banner_url ? (
                                <img
                                    src={resolveAssetUrl(user.banner_url)}
                                    style={styles.bannerImage}
                                    alt=""
                                />
                            ) : null}
                            {isPremium && (
                                <div style={styles.premiumBadgeAnimated}>
                                    <Crown size={14} color="#fff" style={{ marginRight: 4 }} />
                                    {t('role.premium_caps', 'PREMIUM')}
                                </div>
                            )}


                        </div>

                        {/* Avatar */}
                        {(() => {
                            const equippedRelics = user.equipped_relics || {};
                            const frameClass = equippedRelics.frame ? (RELIC_CSS_MAP[equippedRelics.frame] || '') : '';
                            const hasFrame = !!frameClass;
                            const auraProps = user?.accent_color || (isPremium ? '#f59e0b' : null);

                            return (
                                <div style={{ ...styles.avatarContainer, position: 'relative' }}>
                                    {/* Premium Aura Ring — only if no frame equipped */}
                                    {!hasFrame && <div style={getAuraRingStyle(isPremium, auraProps, { size: 'large' })} />}

                                    {/* Dynamic Border with Aura Effect */}
                                    <div style={{
                                        ...getAvatarContainerStyle(),
                                        position: 'relative',
                                        zIndex: 2,
                                        // Strip premium container border if frame is present
                                        ...(hasFrame ? { borderWidth: 0, overflow: 'visible', backgroundColor: 'transparent' } : {})
                                    }}>
                                        {/* Relic Frame overlay */}
                                        {hasFrame && <div className={`relic-frame ${frameClass}`} style={{
                                            position: 'absolute',
                                            inset: '-8px', // Slightly larger for the bigger profile avatar
                                            borderRadius: '50%',
                                            zIndex: 3,
                                            pointerEvents: 'none',
                                            ...(FRAME_INLINE_STYLES[frameClass] || {}),
                                        }} />}

                                        {user.avatar_url ? (
                                            <img
                                                src={resolveAssetUrl(user.avatar_url)}
                                                style={styles.avatarImage}
                                                alt=""
                                            />
                                        ) : (
                                            <span style={styles.avatarText}>
                                                {user.username?.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* User Info */}
                        <div style={styles.userInfo}>
                            <h2 style={{
                                ...styles.displayName,
                                ...getAuraNameStyle(isPremium, user?.accent_color || (isPremium ? '#f59e0b' : null))
                            }}>
                                {user.display_name || user.username}
                                {isPremium && (
                                    <span style={styles.premiumCrown}>
                                        <Crown size={18} color="#f59e0b" style={{ animation: 'crownPulse 2s ease-in-out infinite' }} />
                                    </span>
                                )}
                            </h2>
                            <UserBadges user={user} />
                            <p style={styles.username}>@{user.username}</p>

                            <div style={{ ...styles.roleBadge, backgroundColor: badgeBg, color: badgeColor, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {serverRole === 'owner' ? <><Crown size={14} /> {t('role.sovereign', 'Owner')}</> :
                                    serverRole === 'moderator' ? <><Shield size={14} /> {t('role.warden', 'Moderator')}</> : <><User size={14} /> {t('role.spirit', 'Member')}</>}
                            </div>

                            {user.bio && (
                                <div style={styles.bioSection}>
                                    <h4 style={styles.bioTitle}>{t('profile.bio_title', 'BIO')}</h4>
                                    <p style={styles.bioText}>{user.bio}</p>
                                </div>
                            )}

                            {user.about_me && (
                                <div style={styles.aboutMeSection}>
                                    <h4 style={styles.bioTitle}>{t('profile.scroll_of_self', 'SCROLL OF SELF')}</h4>
                                    <p style={styles.bioText}>{user.about_me}</p>
                                </div>
                            )}

                            <div style={styles.joinDate}>
                                {t('profile.materialized_on', 'Joined on')} {new Date(user.created_at).toLocaleDateString(i18n.language, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>

                            {/* Friend action buttons at bottom */}
                            {!isOwnProfile && (
                                <div style={styles.actionSection}>
                                    {renderFriendButton()}
                                    {renderMessageButton()}
                                </div>
                            )}
                        </div>

                        {/* Close button */}
                        <button style={{ ...styles.closeBtn, backgroundColor: closeBtnBg }} onClick={onClose}>{t('common.close', 'Close')}</button>

                        {/* Remove Friend Confirmation Overlay */}
                        {showRemoveDialog && (
                            <div style={styles.confirmOverlay}>
                                <div style={styles.confirmBox}>
                                    <h3 style={styles.confirmTitle}>{t('profile.sever_title', 'Remove Friend?')}</h3>
                                    <p style={styles.confirmText}>
                                        {t('profile.sever_text', 'Are you sure you want to sever the bond with ')} <strong>{user.display_name}</strong>?
                                    </p>
                                    <div style={styles.confirmButtons}>
                                        <button
                                            style={styles.cancelBtn}
                                            onClick={() => setShowRemoveDialog(false)}
                                        >
                                            {t('common.cancel', 'Cancel')}
                                        </button>
                                        <button
                                            style={styles.confirmRemoveBtn}
                                            onClick={handleRemoveFriend}
                                            disabled={actionLoading}
                                        >
                                            {actionLoading ? t('profile.btn_severing', 'Severing...') : t('profile.btn_sever', 'Remove Friend')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </div>,
        document.body
    );
};

// Helper Functions for Color Mixing
const hexToRgb = (hex) => {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

const mixWithBlack = (rgb, factor) => {
    if (!rgb) return '#16213e';
    return `rgb(${Math.round(rgb.r * (1 - factor))}, ${Math.round(rgb.g * (1 - factor))}, ${Math.round(rgb.b * (1 - factor))})`;
};

const mixWithWhite = (rgb, factor) => {
    if (!rgb) return '#fff';
    return `rgb(${Math.round(rgb.r + (255 - rgb.r) * factor)}, ${Math.round(rgb.g + (255 - rgb.g) * factor)}, ${Math.round(rgb.b + (255 - rgb.b) * factor)})`;
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 6000,
    },
    modal: {
        backgroundColor: 'var(--bg-secondary)', // Will be overridden dynamically
        borderRadius: '16px',
        width: '400px',
        maxWidth: '90vw',
        overflow: 'hidden',
    },
    loading: {
        color: '#fff',
        padding: '40px',
        textAlign: 'center',
    },
    error: {
        color: '#ef4444',
        padding: '40px',
        textAlign: 'center',
    },
    banner: {
        height: '100px',
        position: 'relative',
        overflow: 'hidden',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    premiumBadge: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: '#fff',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.5px',
    },

    avatarContainer: {
        position: 'relative',
        marginTop: '-50px',
        marginLeft: '24px',
        width: '100px',
        height: '100px',
    },
    avatar: {
        width: '100px',
        height: '100px',
        borderRadius: '50px',
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: '6px solid var(--bg-secondary)', // Will be overridden
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
        fontSize: 48,
        fontWeight: '700',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        lineHeight: 'normal',
        margin: 0,
    },
    premiumRing: {
        position: 'absolute',
        top: '-4px',
        left: '-4px',
        right: '-4px',
        bottom: '-4px',
        borderRadius: '54px',
        border: '3px solid transparent',
        background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b) border-box',
        zIndex: -1,
    },
    userInfo: {
        padding: '16px 24px 24px',
    },
    displayName: {
        color: '#fff',
        fontSize: '24px',
        fontWeight: '700',
        margin: '0 0 4px 0',
    },
    premiumStar: {
        fontSize: '20px',
    },
    username: {
        color: '#a0a0a0',
        fontSize: '14px',
        margin: '0 0 12px 0',
    },
    roleBadge: {
        display: 'inline-block',
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
        color: '#a855f7',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        marginBottom: '16px',
    },
    bioSection: {
        marginTop: '16px',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
    },
    bioTitle: {
        color: '#6b7280',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        margin: '0 0 8px 0',
    },
    bioText: {
        color: '#e5e5e5',
        fontSize: '14px',
        lineHeight: '1.5',
        margin: 0,
    },
    joinDate: {
        color: '#6b7280',
        fontSize: '12px',
        marginTop: '16px',
    },
    actionSection: {
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
    },
    actionBtn: {
        padding: '10px 16px',
        borderRadius: '8px',
        backgroundColor: '#7c3aed',
        border: 'none',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    pendingActions: {
        display: 'flex',
    },
    closeBtn: {
        width: '100%',
        padding: '14px',
        backgroundColor: '#0f3460',
        border: 'none',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
    },
    premiumBadgeAnimated: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: '#fff',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        display: 'flex',
        alignItems: 'center',
        animation: 'premiumShimmer 2s ease-in-out infinite',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
    },
    premiumCrown: {
        marginLeft: '8px',
        display: 'inline-flex',
        alignItems: 'center',
    },
    aboutMeSection: {
        marginTop: '12px',
        padding: '12px',
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        borderRadius: '8px',
        borderLeft: '3px solid #7c3aed',
    },
    confirmOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
        padding: '20px',
        animation: 'fadeIn 0.2s ease',
    },
    confirmBox: {
        backgroundColor: '#16213e',
        borderRadius: '12px',
        padding: '20px',
        width: '100%',
        maxWidth: '300px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
    },
    confirmTitle: {
        color: '#fff',
        fontSize: '18px',
        fontWeight: '700',
        marginBottom: '12px',
        marginTop: 0,
    },
    confirmText: {
        color: '#a0a0a0',
        fontSize: '14px',
        lineHeight: '1.4',
        marginBottom: '20px',
    },
    confirmButtons: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
    },
    cancelBtn: {
        padding: '8px 16px',
        borderRadius: '6px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        color: '#fff',
        fontWeight: '600',
        cursor: 'pointer',
        flex: 1,
    },
    confirmRemoveBtn: {
        padding: '8px 16px',
        borderRadius: '6px',
        backgroundColor: '#ef4444',
        border: 'none',
        color: '#fff',
        fontWeight: '600',
        cursor: 'pointer',
        flex: 1,
    },
};

export default MemberProfile;
