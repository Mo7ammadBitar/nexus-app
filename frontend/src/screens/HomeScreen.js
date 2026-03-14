import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { Settings, Users, Crown, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAuraRingStyle, getAuraNameStyle } from '../utils/PremiumAura';
import { RELIC_CSS_MAP } from '../components/Shop/EtherealShop';

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

import { useLocation, matchPath, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useServerStore } from '../store/serverStore';
import { useFriendsStore } from '../store/friendsStore';
import { useUIStore } from '../store/uiStore';

// Components
import ServerSidebar from '../components/Servers/ServerSidebar';
import ChannelList from '../components/Channels/ChannelList';
import ChatArea from '../components/Chat/ChatArea';
import MemberList from '../components/Servers/MemberList';
import ProfilePanel from '../components/Profile/ProfilePanel';
import ServerSettings from '../components/Servers/ServerSettings';
import FriendsSidebar from '../components/Friends/FriendsSidebar';
import FriendRequestsModal from '../components/Friends/FriendRequestsModal';
import DirectMessageArea from '../components/Friends/DirectMessageArea';
import IncomingCallModal from '../components/Chat/IncomingCallModal';
import ErrorBoundary from '../components/ErrorBoundary';
import { initPresence, disconnectChatSocket } from '../services/socket';

const HomeScreen = () => {
    const { t } = useTranslation();
    const { user, logout } = useAuthStore();
    const { currentServer, selectServer, selectChannel, fetchServers } = useServerStore();
    const { currentDMFriend, openDM, openDMById, closeDM, fetchFriends } = useFriendsStore();
    const { showFriendsPanel: showFriendsMode, setShowFriendsPanel: setShowFriendsMode, isProfileModalOpen: showProfile, setProfileModalOpen: setShowProfile } = useUIStore();
    const [showMembers, setShowMembers] = useState(true);
    const location = useLocation();
    const [showServerSettings, setShowServerSettings] = useState(false);
    const [showFriendRequests, setShowFriendRequests] = useState(false);
    const navigate = useNavigate();

    const canSeeSettings = currentServer?.my_role === 'owner' || currentServer?.my_role === 'moderator';

    useEffect(() => {
        fetchServers();
        // Initialize presence for online tracking
        initPresence();

        // Cleanup on unmount (logout)
        return () => {
            disconnectChatSocket();
        };
    }, []);

    // URL Synchronization
    useEffect(() => {
        const syncStateWithUrl = async () => {
            const pathname = location.pathname;

            // Check for Server/Channel path: /channels/:serverId/:channelId
            const channelMatch = matchPath('/channels/:serverId/:channelId', pathname);
            if (channelMatch) {
                const { serverId, channelId } = channelMatch.params;

                // Only act if not already on this server/channel
                if (currentServer?._id !== serverId) {
                    await selectServer(serverId);
                    // selectServer selects default channel, override if specific one needed
                    if (channelId) {
                        // We need to wait a tick for store to update? 
                        // selectServer is async so it should be ready
                        useServerStore.getState().selectChannel(channelId);
                    }
                } else if (useServerStore.getState().currentChannel?._id !== channelId) {
                    selectChannel(channelId);
                }
                return;
            }

            // Check for DM path: /dashboard/dms/:friendId
            const dmMatch = matchPath('/dashboard/dms/:friendId', pathname);
            if (dmMatch) {
                const { friendId } = dmMatch.params;
                if (currentDMFriend?._id !== friendId && currentDMFriend?.id !== friendId) {
                    // Switch to friends mode UI locally first to avoid flicker?
                    setShowFriendsMode(true);
                    await openDMById(friendId);
                }
                return;
            }
        };

        syncStateWithUrl();
    }, [location.pathname]);

    const handleOpenFriends = () => {
        // Clear server selection when opening friends
        useServerStore.getState().clearServer();
        setShowFriendsMode(true);
        fetchFriends();
        navigate('/');
    };

    const handleOpenDM = (friend) => {
        openDM(friend);
    };

    const handleOpenRequests = () => {
        setShowFriendRequests(true);
    };

    // Check if we're in DM mode
    const isDMMode = currentDMFriend !== null;

    // Frame logic for User Panel Avatar
    const isPremium = user?.is_premium || false;
    const equippedRelics = user?.equipped_relics || {};
    const frameClass = equippedRelics.frame ? (RELIC_CSS_MAP[equippedRelics.frame] || '') : '';
    const hasFrame = !!frameClass;

    return (
        <View style={styles.container}>
            {/* Server Sidebar (Icons) */}
            <ErrorBoundary>
                <ServerSidebar onOpenFriends={handleOpenFriends} />
            </ErrorBoundary>

            {/* Channel Sidebar */}
            <View style={styles.channelSidebar}>
                {currentServer ? (
                    <>
                        <View style={styles.serverHeader}>
                            <Text style={styles.serverName} numberOfLines={1}>
                                {currentServer.name}
                            </Text>
                            {canSeeSettings && (
                                <TouchableOpacity
                                    style={styles.serverSettingsBtn}
                                    onPress={() => setShowServerSettings(true)}
                                >
                                    <Settings size={20} color="#b9bbbe" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <ErrorBoundary>
                            <ChannelList />
                        </ErrorBoundary>
                    </>
                ) : showFriendsMode || isDMMode ? (
                    <>
                        <View style={styles.serverHeader}>
                            <Text style={styles.serverName}>{t('home.whispers', 'Direct Messages')}</Text>
                            <TouchableOpacity
                                style={styles.addFriendHeaderBtn}
                                onPress={handleOpenRequests}
                                title={t('home.btn_friend_requests', 'Friend Requests & Add Friend')}
                            >
                                <Text style={styles.addFriendHeaderIcon}>+</Text>
                            </TouchableOpacity>
                        </View>
                        <ErrorBoundary>
                            <FriendsSidebar
                                onOpenDM={handleOpenDM}
                                onOpenRequests={handleOpenRequests}
                            />
                        </ErrorBoundary>
                    </>
                ) : (
                    <View style={styles.noServerSelected}>
                        <Text style={styles.welcomeTitle}>{t('home.welcome_title', 'Welcome to Nexus')}</Text>
                        <Text style={styles.welcomeSubtitle}>
                            {t('home.welcome_subtitle', 'Select a Server to begin communion')}
                        </Text>
                    </View>
                )}

                {/* User Panel - Clickable */}
                <TouchableOpacity
                    style={styles.userPanel}
                    onPress={() => setShowProfile(true)}
                >
                    <View style={styles.userInfo}>
                        <div style={{
                            ...styles.avatar,
                            border: (!hasFrame && isPremium) ? 'none' : styles.avatar.border,
                            backgroundColor: (!hasFrame && isPremium) ? 'transparent' : styles.avatar.backgroundColor,
                            position: 'relative' // Ensure relative positioning for absolute children
                        }}>
                            {/* Premium Aura Ring — only if no frame equipped */}
                            {!hasFrame && <div style={getAuraRingStyle(isPremium, user?.accent_color, { size: 'small' })} />}

                            {/* Relic Frame overlay */}
                            {hasFrame && <div className={`relic-frame ${frameClass}`} style={{
                                position: 'absolute',
                                inset: '-4px',
                                borderRadius: '50%',
                                zIndex: 3,
                                pointerEvents: 'none',
                                ...(FRAME_INLINE_STYLES[frameClass] || {}),
                            }} />}

                            {user?.avatar_url ? (
                                <img
                                    src={((user.avatar_url)?.startsWith('http') ? (user.avatar_url) : `http://localhost:8000${user.avatar_url}`)}
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', position: 'relative', zIndex: 2 }}
                                    alt=""
                                />
                            ) : (
                                <Text style={[styles.avatarText, { position: 'relative', zIndex: 2 }]}>
                                    {user?.username?.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </div>
                        <View style={styles.userDetails}>
                            <Text style={[styles.username, getAuraNameStyle(user?.is_premium, user?.accent_color)]} numberOfLines={1}>
                                {user?.display_name || user?.username}
                            </Text>
                            <View style={styles.roleContainer}>
                                {user?.role === 'super_admin' ? (
                                    <>
                                        <Crown size={12} color="#fbbf24" style={{ marginRight: 4 }} />
                                        <Text style={[styles.role, { color: '#fbbf24' }]}>{t('home.role_high_warden', 'High Moderator')}</Text>
                                    </>
                                ) : user?.role === 'admin' ? (
                                    <>
                                        <ShieldCheck size={12} color="#10b981" style={{ marginRight: 4 }} />
                                        <Text style={[styles.role, { color: '#10b981' }]}>{t('home.role_warden', 'Moderator')}</Text>
                                    </>
                                ) : (
                                    <Text style={styles.role}>{t('home.role_manifested', 'Manifested')}</Text>
                                )}
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.settingsBtn} onPress={(e) => { e.stopPropagation(); setShowProfile(true); }}>
                        <Settings size={18} color="#fff" />
                    </TouchableOpacity>
                </TouchableOpacity>
            </View>

            {/* Main Chat Area */}
            <View style={styles.mainArea}>
                {isDMMode ? (
                    <ErrorBoundary>
                        <DirectMessageArea />
                    </ErrorBoundary>
                ) : currentServer ? (
                    <ErrorBoundary>
                        <ChatArea />
                    </ErrorBoundary>
                ) : showFriendsMode ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyLogo}>
                            <Users size={48} color="#fff" />
                        </View>
                        <Text style={styles.emptyTitle}>{t('home.empty_ally_title', 'Select an Ally')}</Text>
                        <Text style={styles.emptySubtitle}>
                            {t('home.empty_ally_subtitle', 'Click on an Ally from the sidebar to start chatting')}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyLogo}>
                            <Text style={styles.emptyLogoText}>N</Text>
                        </View>
                        <Text style={styles.emptyTitle}>{t('home.empty_realm_title', 'No Server Selected')}</Text>
                        <Text style={styles.emptySubtitle}>
                            {t('home.empty_realm_subtitle', 'Click on a Server to view Scriptures and start chatting')}
                        </Text>
                    </View>
                )}
            </View>

            {/* Member List */}
            {currentServer && showMembers && !isDMMode && (
                <MemberList />
            )}

            {/* Profile Panel Modal */}
            {showProfile && (
                <ProfilePanel onClose={() => setShowProfile(false)} />
            )}

            {/* Server Settings Modal */}
            {showServerSettings && (
                <ServerSettings onClose={() => setShowServerSettings(false)} />
            )}

            {/* Friend Requests Modal */}
            {showFriendRequests && (
                <FriendRequestsModal onClose={() => setShowFriendRequests(false)} />
            )}

            {/* Global Incoming DM Call Modal */}
            <IncomingCallModal />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'var(--bg-primary)',
        height: '100vh',
    },
    channelSidebar: {
        width: 240,
        backgroundColor: 'var(--bg-secondary)',
        borderRightWidth: 1,
        borderRightColor: 'var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.3s ease',
    },
    serverHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    },
    serverName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    serverSettingsBtn: {
        padding: 4,
        cursor: 'pointer',
    },
    serverSettingsIcon: {
        fontSize: 16,
    },
    noServerSelected: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    welcomeTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    welcomeSubtitle: {
        color: '#6b7280',
        fontSize: 13,
        textAlign: 'center',
    },
    userPanel: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'var(--bg-tertiary)',
        borderTopWidth: 1,
        borderTopColor: 'var(--border-color)',
        transition: 'background-color 0.3s ease',
    },
    userInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    userDetails: {
        marginLeft: 10,
        flex: 1,
    },
    username: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    role: {
        color: '#94a3b8',
        fontSize: 12,
    },
    roleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingsBtn: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    settingsIcon: {
        fontSize: 16,
    },
    mainArea: {
        flex: 1,
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.3s ease',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyLogo: {
        width: 100,
        height: 100,
        borderRadius: 25,
        backgroundImage: 'var(--theme-gradient)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        boxShadow: '0 10px 40px var(--theme-glow)',
    },
    emptyLogoText: {
        color: '#fff',
        fontSize: 48,
        fontWeight: '700',
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: '#6b7280',
        fontSize: 15,
    },
    dmSidebar: {
        flex: 1,
    },
    dmInfo: {
        padding: 16,
    },
    dmInfoText: {
        color: '#6b7280',
        fontSize: 14,
    },
    addFriendHeaderBtn: {
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    addFriendHeaderIcon: {
        color: '#6b7280',
        fontSize: 18,
        fontWeight: '400',
    },
});

export default HomeScreen;
