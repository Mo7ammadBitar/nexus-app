import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native-web';
import { Crown, Shield, ShieldCheck, User, Camera, Lock, Sparkles, X, LogOut, Circle, Moon, MinusCircle, Ghost, Package, Gem, Users, Server, Rocket, Check, LifeBuoy, MessageSquare, ArrowLeft, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useShopStore } from '../../store/shopStore';
import { useTheme } from '../../context/ThemeProvider';
import { usersAPI, supportAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import AdminDashboard from '../Admin/AdminDashboard';
import StarredMessagesPanel from './StarredMessagesPanel';
import SupportChatModal from '../Support/SupportChatModal';

import NexusEliteModal from './NexusEliteModal';
import { getAuraRingStyle, getAuraNameStyle, injectAuraAnimations, getAuraAvatarContainerStyle } from '../../utils/PremiumAura';
import { RELIC_CSS_MAP } from '../Shop/EtherealShop';
import { resolveAssetUrl } from '../../config';
import UserBadges from './UserBadges';
import BadgeManager from './BadgeManager';

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

// Helper Functions
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
    if (!rgb) return '#0f3460';
    return `rgb(${Math.round(rgb.r * (1 - factor))}, ${Math.round(rgb.g * (1 - factor))}, ${Math.round(rgb.b * (1 - factor))})`;
};

const ProfilePanel = ({ onClose }) => {
    const { t, i18n } = useTranslation();
    const { user, updateUser, logout, refreshUser } = useAuthStore();
    const { servers } = useServerStore();

    // Hooks for Live Preview - Also get saved colors from context
    const { applyAccentColor, applyThemeColor, accentColor: savedAccentColor, themeColor: savedThemeColor } = useTheme();

    // Local State
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [bio, setBio] = useState(user?.bio || '');

    // Color Pickers State - Initialize from saved context values
    const [accentColor, setAccentColor] = useState(savedAccentColor || user?.accent_color || '#7c3aed');
    const [themeColor, setThemeColor] = useState(savedThemeColor || user?.theme_color || '#7c3aed');

    // Dynamic container color derived from themeColor
    const themeRgb = hexToRgb(themeColor);
    const containerBg = themeRgb ? mixWithBlack(themeRgb, 0.6) : '#0f3460';
    const containerBorder = themeRgb ? `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, 0.3)` : 'rgba(255,255,255,0.1)';
    const panelBg = themeRgb ? mixWithBlack(themeRgb, 0.92) : null;

    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [showNexusEliteModal, setShowNexusEliteModal] = useState(false);
    const [showAdminDashboard, setShowAdminDashboard] = useState(false);
    const [showStarredMessages, setShowStarredMessages] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [showBoostApplyModal, setShowBoostApplyModal] = useState(false);
    const [selectedBoostServer, setSelectedBoostServer] = useState(null);
    const [applyingBoost, setApplyingBoost] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(user?.status || 'online');

    // Shop/Inventory state
    const { shards, ownedRelics, equippedRelics, fetchInventory, equipRelic, unequipRelic } = useShopStore();
    const [inventoryMsg, setInventoryMsg] = useState('');

    // Support Tickets state
    const [showSupportArea, setShowSupportArea] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [activeTicket, setActiveTicket] = useState(null);
    const [showCreateTicket, setShowCreateTicket] = useState(false);
    const [newTicketSubject, setNewTicketSubject] = useState('');
    const [newTicketMessage, setNewTicketMessage] = useState('');
    const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
    const [showBadgeManager, setShowBadgeManager] = useState(false);

    const fetchTickets = async () => {
        try {
            const res = await supportAPI.getMyTickets();
            setTickets(res.data);
        } catch (e) { console.error('Error fetching tickets', e); }
    };

    const handleCreateTicket = async () => {
        if (!newTicketSubject.trim() || !newTicketMessage.trim() || isSubmittingTicket) return;
        setIsSubmittingTicket(true);
        try {
            const res = await supportAPI.createTicket(newTicketSubject, newTicketMessage);
            setShowCreateTicket(false);
            setNewTicketSubject('');
            setNewTicketMessage('');
            fetchTickets();
            setActiveTicket(res.data);
        } catch (e) {
            console.error('Error creating ticket', e);
        } finally {
            setIsSubmittingTicket(false);
        }
    };

    const avatarInputRef = useRef(null);
    const bannerInputRef = useRef(null);

    // Hydration guard - prevents live preview until initial sync completes
    const isHydrating = useRef(true);

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isPremium = user?.is_premium;

    // 1. Fetch Data on Mount & Inject Aura Animations
    useEffect(() => {
        injectAuraAnimations();
        refreshUser();
        fetchInventory();
    }, []);

    // 2. Sync Local State with User Data and Context (Hydration)
    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || '');
            setBio(user.bio || '');
            setCurrentStatus(user.status || 'online');

            // Sync accent color from context (primary) or user object (fallback)
            const syncedAccent = savedAccentColor || user.accent_color || '#7c3aed';
            setAccentColor(syncedAccent);

            // Sync theme color from context (primary) or user object (fallback)
            const syncedTheme = savedThemeColor || user.theme_color || '#7c3aed';
            setThemeColor(syncedTheme);

            // Mark hydration complete AFTER state is synced
            // Use microtask to ensure setState calls have processed
            queueMicrotask(() => {
                isHydrating.current = false;
            });
        }
    }, [user, savedThemeColor, savedAccentColor]);

    // 3. Live Preview Effects (Blocked during hydration)
    useEffect(() => {
        if (!isHydrating.current) applyAccentColor(accentColor);
    }, [accentColor]);

    useEffect(() => {
        if (!isHydrating.current) applyThemeColor(themeColor);
    }, [themeColor]);


    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const updateData = {
                display_name: displayName,
                bio,
                accent_color: accentColor,
                theme_color: themeColor
            };

            const response = await usersAPI.updateProfile(updateData);
            // Backend returns { message, display_name, bio, accent_color, theme_color } directly
            updateUser({
                display_name: response.data.display_name,
                bio: response.data.bio,
                accent_color: response.data.accent_color,
                theme_color: response.data.theme_color,
            });
            setMessage('✅ ' + t('profile.msg_update_success', 'Profile updated successfully!'));
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('profile.msg_update_fail', 'Failed to update profile')));
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const validTypes = isPremium ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) { setMessage('❌ ' + t('profile.msg_invalid_file', 'Invalid file type')); return; }
        setUploadingAvatar(true);
        try {
            const response = await usersAPI.uploadAvatar(file);
            updateUser({ avatar_url: response.data.avatar_url, avatar_type: response.data.avatar_type });
            setMessage('✅ ' + t('profile.msg_avatar_success', 'Avatar updated!'));
        } catch (error) { setMessage('❌ ' + t('profile.msg_avatar_fail', 'Failed to upload avatar')); } finally { setUploadingAvatar(false); }
    };

    const handleBannerUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploadingBanner(true);
        try {
            const response = await usersAPI.uploadBanner(file);
            updateUser({ banner_url: response.data.banner_url, banner_type: response.data.banner_type });
            setMessage('✅ ' + t('profile.msg_banner_success', 'Banner updated!'));
        } catch (error) { setMessage('❌ ' + t('profile.msg_banner_fail', 'Failed to upload banner')); } finally { setUploadingBanner(false); }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            await usersAPI.updateStatus(newStatus);
            setCurrentStatus(newStatus);
            updateUser({ status: newStatus });
            const serverStore = useServerStore.getState();
            if (serverStore.currentServer) serverStore.fetchMembers(serverStore.currentServer._id);
        } catch (error) { setMessage('❌ ' + t('profile.msg_status_fail', 'Failed to update status')); }
    };

    const handleApplyBoost = async () => {
        if (!selectedBoostServer) return;
        setApplyingBoost(true);
        try {
            const response = await usersAPI.applyServerBoost(selectedBoostServer);
            setMessage('🚀 ' + response.data.message);
            refreshUser();
            setShowBoostApplyModal(false);
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || 'Failed to apply Server Boost'));
        } finally {
            setApplyingBoost(false);
        }
    };

    const statusOptions = [
        { value: 'online', label: t('status.online', 'Online'), color: '#22c55e', icon: <Circle size={14} fill="#22c55e" color="#22c55e" /> },
        { value: 'idle', label: t('status.idle', 'Idle'), color: '#f59e0b', icon: <Moon size={14} fill="#f59e0b" color="#f59e0b" /> },
        { value: 'dnd', label: t('status.dnd', 'Do Not Disturb'), color: '#ef4444', icon: <MinusCircle size={14} fill="#ef4444" color="#ef4444" /> },
        { value: 'invisible', label: t('status.invisible', 'Invisible'), color: '#6b7280', icon: <Ghost size={14} color="#a0aec0" /> }
    ];

    if (showBoostApplyModal) {
        return (
            <div style={{ ...styles.overlay, zIndex: 3000 }}>
                <div style={{ ...styles.panel, width: 440, height: 'auto', padding: 24, display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ color: '#fff', fontSize: 18, margin: 0, display: 'flex', alignItems: 'center' }}>
                            <Rocket size={20} color="#a855f7" style={{ marginRight: 8 }} />
                            Apply Server Boost
                        </h3>
                        <button style={{ ...styles.closeBtn, border: 'none' }} onClick={() => setShowBoostApplyModal(false)}>
                            <X size={20} color="#fff" />
                        </button>
                    </div>

                    <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                        Select a server you are a member of to apply your Server Boost. This permanently increases the server's level and unlocks Custom Banners.
                    </p>

                    <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                        {servers.length === 0 ? (
                            <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px 0' }}>You are not in any servers.</p>
                        ) : (
                            servers.map(server => (
                                <div
                                    key={server._id}
                                    onClick={() => setSelectedBoostServer(server._id)}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: 8,
                                        background: selectedBoostServer === server._id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${selectedBoostServer === server._id ? '#a855f7' : 'transparent'}`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ width: 40, height: 40, borderRadius: 20, background: '#1e1b4b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                        {server.icon_url ? <img src={resolveAssetUrl(server.icon_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{server.name.charAt(0)}</span>}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#fff', fontWeight: '500', fontSize: 14, marginBottom: 2 }}>{server.name}</div>
                                        <div style={{ color: '#fbbf24', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Sparkles size={10} />
                                            Level {server.boost_level || 0}
                                        </div>
                                    </div>
                                    {selectedBoostServer === server._id && <Check size={18} color="#a855f7" />}
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        disabled={!selectedBoostServer || applyingBoost}
                        onClick={handleApplyBoost}
                        style={{
                            ...styles.saveBtn,
                            width: '100%',
                            opacity: (!selectedBoostServer || applyingBoost) ? 0.5 : 1,
                            padding: '14px',
                            fontSize: 15,
                            border: 'none',
                            marginBottom: 0
                        }}
                    >
                        {applyingBoost ? 'Applying Boost...' : `Confirm Application`}
                    </button>
                </div>
            </div>
        );
    }

    if (showSupportArea) {
        return (
            <View style={styles.overlay}>
                <View style={[styles.panel, panelBg && { backgroundColor: panelBg }]}>
                    <View style={styles.header}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setShowSupportArea(false)} style={{ marginRight: 12 }}>
                                <ArrowLeft size={20} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.title}>Support Tickets</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.content}>
                        {showCreateTicket ? (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 16 }}>Create New Ticket</Text>
                                <View style={styles.field}>
                                    <Text style={styles.label}>SUBJECT</Text>
                                    <TextInput style={styles.input} value={newTicketSubject} onChangeText={setNewTicketSubject} placeholder="Brief description of the issue..." placeholderTextColor="#6b7280" />
                                </View>
                                <View style={styles.field}>
                                    <Text style={styles.label}>MESSAGE</Text>
                                    <TextInput style={[styles.input, styles.textArea]} value={newTicketMessage} onChangeText={setNewTicketMessage} placeholder="Explain the problem in detail..." placeholderTextColor="#6b7280" multiline numberOfLines={4} />
                                </View>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#374151', backgroundImage: 'none' }]} onPress={() => setShowCreateTicket(false)}>
                                        <Text style={styles.saveBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.saveBtn, { flex: 1 }, isSubmittingTicket && styles.saveBtnDisabled]} onPress={handleCreateTicket} disabled={isSubmittingTicket}>
                                        <Text style={styles.saveBtnText}>{isSubmittingTicket ? 'Submitting...' : 'Submit Ticket'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139, 92, 246, 0.15)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#8b5cf6', marginBottom: 24 }} onPress={() => setShowCreateTicket(true)}>
                                    <Plus size={18} color="#c4b5fd" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#c4b5fd', fontWeight: '600' }}>Create New Ticket</Text>
                                </TouchableOpacity>
                                
                                <Text style={{ color: '#9ca3af', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' }}>Your Tickets</Text>
                                {tickets.length === 0 ? (
                                    <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 20 }}>No support tickets found.</Text>
                                ) : (
                                    tickets.map(ticket => (
                                        <TouchableOpacity 
                                            key={ticket._id} 
                                            style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                            onPress={() => setActiveTicket(ticket)}
                                        >
                                            <View style={{ flex: 1, marginRight: 12 }}>
                                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500', marginBottom: 4 }} numberOfLines={1}>{ticket.subject}</Text>
                                                <Text style={{ color: '#9ca3af', fontSize: 12 }}>Last updated: {new Date(ticket.updated_at).toLocaleDateString()}</Text>
                                            </View>
                                            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: ticket.status === 'open' ? 'rgba(16, 185, 129, 0.2)' : (ticket.status === 'closed' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(245, 158, 11, 0.2)') }}>
                                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#fff' }}>{ticket.status.replace('_', ' ').toUpperCase()}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        )}
                    </ScrollView>
                    <SupportChatModal isOpen={!!activeTicket} ticket={activeTicket} onClose={() => setActiveTicket(null)} onTicketUpdated={() => fetchTickets()} />
                </View>
            </View>
        );
    }

    if (showNexusEliteModal) return <NexusEliteModal onClose={() => setShowNexusEliteModal(false)} />;
    if (showAdminDashboard) return <AdminDashboard onClose={() => setShowAdminDashboard(false)} />;
    if (showStarredMessages) return <StarredMessagesPanel onClose={() => setShowStarredMessages(false)} />;

    // Frame priority logic for Avatar
    const frameClass = equippedRelics?.frame ? (RELIC_CSS_MAP[equippedRelics.frame] || '') : '';
    const hasFrame = !!frameClass;

    return (
        <View style={styles.overlay}>
            <View style={[styles.panel, panelBg && { backgroundColor: panelBg }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>{t('settings')}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    {/* Banner Section */}
                    <View style={styles.bannerSection}>
                        <View style={[styles.banner, isPremium && styles.premiumBanner]}>
                            {user?.banner_url ? (
                                <img src={resolveAssetUrl(user.banner_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    {isPremium ? (
                                        <>
                                            <Sparkles size={20} color="#f59e0b" style={{ marginRight: 8 }} />
                                            <Text style={[styles.bannerPlaceholder, getAuraNameStyle(true, accentColor), { fontSize: 16 }]}>{t('profile.premium_banner', 'PREMIUM BANNER')}</Text>
                                        </>
                                    ) : (
                                        <Text style={styles.bannerPlaceholder}>{t('profile.no_banner', 'No Banner')}</Text>
                                    )}
                                </View>
                            )}
                        </View >
                        <TouchableOpacity
                            style={{ ...styles.editBannerBtn, backgroundColor: 'rgba(0,0,0,0.6)', borderColor: themeColor || '#7c3aed', borderWidth: 1 }}
                            onPress={() => isPremium ? bannerInputRef.current?.click() : setShowNexusEliteModal(true)}
                            disabled={uploadingBanner}
                        >
                            {isPremium ? <Camera size={16} color="#fff" /> : <Lock size={14} color="#fff" />}
                        </TouchableOpacity>
                        <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} />
                    </View >

                    {/* Avatar Section */}
                    < View style={styles.avatarSection} >
                        <View style={styles.avatarWrapper}>
                            {/* Premium Aura Ring — only if no frame equipped */}
                            {!hasFrame && <div style={getAuraRingStyle(isPremium, accentColor, { size: 'large' })} />}

                            {/* Dynamic Border with Aura Effect — only if no frame equipped */}
                            <View style={[
                                styles.avatar,
                                !hasFrame && getAuraAvatarContainerStyle(isPremium, accentColor),
                                hasFrame && { borderWidth: 0, overflow: 'visible', backgroundColor: 'transparent' } // Strip premium container styles if frame is present
                            ]}>
                                {/* Relic Frame overlay */}
                                {hasFrame && <div className={`relic-frame ${frameClass}`} style={{
                                    position: 'absolute',
                                    inset: '-8px', // Slightly larger for the bigger profile avatar
                                    borderRadius: '50%',
                                    zIndex: 3,
                                    pointerEvents: 'none',
                                    ...(FRAME_INLINE_STYLES[frameClass] || {}),
                                }} />}

                                {user?.avatar_url ? (
                                    <img src={resolveAssetUrl(user.avatar_url)} style={{ width: '100%', height: '100%', borderRadius: '50%', position: 'relative', zIndex: 2 }} alt="" />
                                ) : (
                                    <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                                        <Text style={styles.avatarText}>{user?.username?.charAt(0).toUpperCase()}</Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity
                                style={{ ...styles.editAvatarBtn, backgroundColor: themeColor || '#7c3aed', borderColor: 'var(--bg-secondary)' }}
                                onPress={() => avatarInputRef.current?.click()}
                                disabled={uploadingAvatar}
                            >
                                <Camera size={14} color="#fff" />
                            </TouchableOpacity>
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept={isPremium ? "image/*" : "image/jpeg,image/png,image/webp"}
                                style={{ display: 'none' }}
                                onChange={handleAvatarUpload}
                            />
                        </View>
                        <View style={styles.avatarInfo}>
                            <Text style={[styles.username, getAuraNameStyle(isPremium, accentColor)]}>{user?.username}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                {user?.role === 'super_admin' ? (
                                    <>
                                        <Crown size={14} color="#fbbf24" />
                                        <Text style={[styles.role, { color: '#fbbf24' }]}>{t('role.super_admin', 'Super Admin')}</Text>
                                    </>
                                ) : user?.role === 'admin' ? (
                                    <>
                                        <ShieldCheck size={14} color="#10b981" />
                                        <Text style={[styles.role, { color: '#10b981' }]}>{t('role.admin', 'Admin')}</Text>
                                    </>
                                ) : (
                                    <>
                                        <User size={14} color="#9ca3af" />
                                        <Text style={styles.role}>{t('role.user', 'User')}</Text>
                                    </>
                                )}
                            </View>
                            {isPremium && (
                                <View style={{ marginTop: 4 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Sparkles size={12} color="#f59e0b" style={{ marginRight: 4 }} />
                                        <Text style={styles.premiumBadge}>{t('role.premium', 'Premium')}</Text>
                                    </View>
                                    {user?.premium_expires_at && (
                                        <Text style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>
                                            {t('profile.active_until', 'Active until')} {new Date(user.premium_expires_at).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </Text>
                                    )}
                                </View>
                            )}
                            <UserBadges user={user} size="small" />
                        </View>
                    </View >

                    {/* === APPEARANCE SECTION (FIXED) === */}
                    < View style={styles.section} >
                        <Text style={styles.sectionTitle}>{t('appearance')}</Text>

                        {/* Language Selector */}
                        <View style={styles.field}>
                            <Text style={styles.label}>{t('language').toUpperCase()}</Text>
                            <select
                                value={i18n.language.split('-')[0]}
                                onChange={(e) => {
                                    const selectedLang = e.target.value;
                                    i18n.changeLanguage(selectedLang);
                                    if (user) {
                                        usersAPI.updateProfile({ preferred_language: selectedLang }).catch(() => { });
                                    }
                                }}
                                style={{
                                    backgroundColor: containerBg,
                                    color: '#fff',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: `1px solid ${containerBorder}`,
                                    width: '100%',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    appearance: 'none'
                                }}
                            >
                                <option value="en">🇺🇸 English</option>
                                <option value="ar">🇪🇬 العربية</option>
                                <option value="fr">🇫🇷 Français</option>
                                <option value="es">🇪🇸 Español</option>
                                <option value="ja">🇯🇵 日本語</option>
                                <option value="ru">🇷🇺 Русский</option>
                                <option value="zh">🇨🇳 中文</option>
                                <option value="pt">🇧🇷 Português</option>
                            </select>
                        </View>

                        {/* 1. Profile Accent */}
                        <View style={styles.field}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={styles.label}>{t('profile.profile_accent', 'PROFILE ACCENT')}</Text>
                                {!isPremium && <Lock size={12} color="#6b7280" />}
                            </View>

                            {isPremium ? (
                                /* استخدمنا div عادي عشان نمنع الكراش ونخلي اللون يظهر صح */
                                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: containerBg, padding: '8px', borderRadius: '8px', border: `1px solid ${containerBorder}` }}>
                                    <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', backgroundColor: accentColor, border: '2px solid rgba(255,255,255,0.2)' }}>
                                        <input
                                            type="color"
                                            value={accentColor}
                                            onChange={(e) => setAccentColor(e.target.value)}
                                            style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0 }}
                                        />
                                    </div>
                                    <span style={{ color: '#ffffff', marginLeft: '12px', fontFamily: 'monospace', fontSize: '14px', fontWeight: '600' }}>
                                        {accentColor}
                                    </span>
                                </div>
                            ) : (
                                <TouchableOpacity style={styles.premiumLockBtn}>
                                    <Text style={{ color: '#6b7280', fontSize: 12 }}>{t('profile.unlock_premium', 'Unlock with Premium')}</Text>
                                </TouchableOpacity>
                            )}
                            <Text style={styles.helpText}>{t('profile.accent_help', 'Controls your avatar border and name glow.')}</Text>
                        </View>

                        {/* 2. Client Theme */}
                        <View style={styles.field}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={styles.label}>{t('profile.client_theme', 'CLIENT THEME')}</Text>
                                {!isPremium && <Lock size={12} color="#6b7280" />}
                            </View>

                            {isPremium ? (
                                /* نفس الكلام هنا div بدل View */
                                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: containerBg, padding: '8px', borderRadius: '8px', border: `1px solid ${containerBorder}` }}>
                                    <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', backgroundColor: themeColor, border: '2px solid rgba(255,255,255,0.2)' }}>
                                        <input
                                            type="color"
                                            value={themeColor}
                                            onChange={(e) => setThemeColor(e.target.value)}
                                            style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0 }}
                                        />
                                    </div>
                                    <span style={{ color: '#ffffff', marginLeft: '12px', fontFamily: 'monospace', fontSize: '14px', fontWeight: '600' }}>
                                        {themeColor}
                                    </span>
                                </div>
                            ) : (
                                <TouchableOpacity style={styles.premiumLockBtn} onPress={() => setShowNexusEliteModal(true)}>
                                    <Text style={{ color: '#6b7280', fontSize: 12 }}>{t('profile.unlock_premium', 'Unlock with Premium')}</Text>
                                </TouchableOpacity>
                            )}
                            <Text style={styles.helpText}>{t('profile.theme_help', 'Tints the entire application background and sidebar.')}</Text>
                        </View>
                    </View>

                    {/* Status Selector */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('profile.status_title', 'Status')}</Text>
                        <View style={styles.statusGrid}>
                            {statusOptions.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.statusOption,
                                        { backgroundColor: containerBg, borderColor: containerBorder, borderWidth: 1 },
                                        currentStatus === option.value && {
                                            borderColor: themeColor ? `${themeColor}80` : 'rgba(124, 58, 237, 0.5)',
                                            backgroundColor: themeColor ? `${themeColor}33` : 'rgba(124, 58, 237, 0.2)'
                                        }
                                    ]}
                                    onPress={() => handleStatusChange(option.value)}
                                >
                                    <View style={{ marginRight: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {option.icon}
                                    </View>
                                    <Text style={[styles.statusLabel, currentStatus === option.value && { color: option.color }]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Inventory Section */}
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Package size={18} color="#f59e0b" />
                                <Text style={styles.sectionTitle}>{t('inventory')}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Gem size={14} style={{ color: '#a855f7', filter: 'drop-shadow(0 0 5px #a855f7)' }} />
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{shards}</Text>
                                <Text style={{ color: '#6b7280', fontSize: 12, marginLeft: 2 }}>{t('shop.shards', 'Shards')}</Text>
                            </View>
                        </View>
                        {inventoryMsg ? <Text style={{ color: '#a855f7', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{inventoryMsg}</Text> : null}
                        
                        {(user?.available_server_boosts > 0) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168, 85, 247, 0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)', marginBottom: 8 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: 'rgba(168, 85, 247, 0.2)' }}>
                                    <Rocket size={20} color="#a855f7" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Server Boost (x{user.available_server_boosts})</Text>
                                    <Text style={{ color: '#a855f7', fontSize: 11 }}>Permanent Server Level Up</Text>
                                </View>
                                <TouchableOpacity
                                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundImage: 'linear-gradient(135deg, #a855f7, #9333ea)' }}
                                    onPress={() => setShowBoostApplyModal(true)}
                                >
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Use</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {ownedRelics && ownedRelics.length > 0 ? (
                            <View style={{ gap: 8 }}>
                                {ownedRelics.map(relic => (
                                    <View key={relic.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: relic.equipped ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)' }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                            <Text style={{ fontSize: 18 }}>{relic.type === 'frame' ? '🖼️' : '💬'}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{relic.name}</Text>
                                            <Text style={{ color: '#6b7280', fontSize: 11 }}>{relic.type === 'frame' ? t('shop.frame', 'Frame') : t('shop.bubble', 'Bubble')}{relic.equipped ? t('shop.equipped_suffix', ' • Equipped') : ''}</Text>
                                        </View>
                                        {relic.equipped ? (
                                            <TouchableOpacity
                                                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}
                                                onPress={async () => {
                                                    const r = await unequipRelic(relic.type);
                                                    if (r.success) { setInventoryMsg(t('profile.msg_removed', 'Removed!')); fetchInventory(); } else setInventoryMsg('❌ ' + r.error);
                                                    setTimeout(() => setInventoryMsg(''), 2000);
                                                }}
                                            >
                                                <Text style={{ color: '#ef4444', fontSize: 12 }}>{t('profile.btn_remove', 'Remove')}</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundImage: 'linear-gradient(135deg, #10b981, #059669)' }}
                                                onPress={async () => {
                                                    const r = await equipRelic(relic.id);
                                                    if (r.success) { setInventoryMsg(t('profile.msg_equipped', 'Equipped!')); fetchInventory(); } else setInventoryMsg('❌ ' + r.error);
                                                    setTimeout(() => setInventoryMsg(''), 2000);
                                                }}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{t('profile.btn_equip', 'Equip')}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center', padding: 20 }}>
                                <Text style={{ color: '#4a4a6a', fontSize: 13 }}>{t('profile.no_relics', 'No relics attuned yet')}</Text>
                                <Text style={{ color: '#3a3a5a', fontSize: 11, marginTop: 4 }}>{t('profile.visit_shop', 'Visit the Ethereal Shop to connect relics')}</Text>
                            </View>
                        )}

                        {/* Manage Badges Button */}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                padding: 14,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: 'rgba(168, 85, 247, 0.3)',
                                marginTop: 12,
                            }}
                            onPress={() => setShowBadgeManager(true)}
                        >
                            <Sparkles size={16} color="#c4b5fd" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#c4b5fd', fontWeight: '600', fontSize: 13 }}>Manage Badges</Text>
                            {(user?.owned_badges?.length > 0) && (
                                <View style={{
                                    marginLeft: 8,
                                    backgroundColor: 'rgba(168, 85, 247, 0.3)',
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 10,
                                }}>
                                    <Text style={{ color: '#e9d5ff', fontSize: 11, fontWeight: '700' }}>{user.owned_badges.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Support Tickets Section */}
                    {!isAdmin && (
                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                <LifeBuoy size={18} color="#8b5cf6" style={{ marginRight: 8 }} />
                                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Customer Support</Text>
                            </View>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' }}
                                onPress={() => { setShowSupportArea(true); fetchTickets(); }}
                            >
                                <MessageSquare size={20} color="#8b5cf6" style={{ marginRight: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 }}>Contact Support</Text>
                                    <Text style={{ color: '#9ca3af', fontSize: 13 }}>View past tickets or create a new request</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Admin Tools Section */}
                    {isAdmin && (
                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                <ShieldCheck size={18} color="#10b981" style={{ marginRight: 8 }} />
                                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('profile.admin_tools', 'Admin Tools')}</Text>
                            </View>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}
                                onPress={() => setShowAdminDashboard(true)}
                            >
                                <Users size={20} color="#10b981" style={{ marginRight: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 }}>{t('profile.moderation_panel', 'Moderation Panel')}</Text>
                                    <Text style={{ color: '#9ca3af', fontSize: 13 }}>{t('profile.moderation_desc', 'User banning, kicking, and server moderation')}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Super Admin Tools Section */}
                    {user?.role === 'super_admin' && (
                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                <Crown size={18} color="#fbbf24" style={{ marginRight: 8 }} />
                                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('profile.super_admin_tools', 'Super Admin Tools')}</Text>
                            </View>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', marginTop: 12 }}
                                onPress={() => setShowAdminDashboard(true)}
                            >
                                <Server size={20} color="#fbbf24" style={{ marginRight: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 }}>{t('profile.system_controls', 'Global System Controls')}</Text>
                                    <Text style={{ color: '#9ca3af', fontSize: 13 }}>{t('profile.system_controls_desc', 'Realm bans, admin logic, and premium features management')}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Other Inputs */}
                    <View style={styles.field}>
                        <Text style={styles.label}>{t('profile.display_name', 'DISPLAY NAME')}</Text>
                        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder={t('profile.placeholder_display_name', 'Display name')} placeholderTextColor="#6b7280" />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>{t('profile.about_me', 'ABOUT ME')}</Text>
                        <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio} placeholder={t('profile.placeholder_about_me', 'Tell us about yourself')} placeholderTextColor="#6b7280" multiline numberOfLines={4} />
                    </View>

                    {message ? <Text style={styles.message}>{message}</Text> : null}

                    <TouchableOpacity
                        style={[
                            styles.saveBtn,
                            isSaving && styles.saveBtnDisabled,
                            { backgroundImage: themeColor ? `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` : styles.saveBtn.backgroundImage }
                        ]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        <Text style={styles.saveBtnText}>{isSaving ? t('profile.btn_saving', 'Saving...') : t('profile.btn_save', 'Save Changes')}</Text>
                    </TouchableOpacity>

                    {/* Logout */}
                    <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                        <LogOut size={16} color="#ef4444" style={{ marginRight: 8 }} />
                        <Text style={styles.logoutBtnText}>{t('profile.btn_logout', 'Log Out')}</Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Badge Manager Modal */}
                <BadgeManager
                    isOpen={showBadgeManager}
                    ownedBadges={user?.owned_badges || []}
                    equippedBadges={user?.equipped_badges || []}
                    onSave={(newEquipped) => {
                        updateUser({ equipped_badges: newEquipped });
                        refreshUser();
                    }}
                    onClose={() => setShowBadgeManager(false)}
                />
            </View>
        </View>
    );
};

// Standard CSS styles for the HTML elements
const htmlStyles = {
    colorInput: {
        width: '100%',
        height: '100%',
        padding: 0,
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        opacity: 0, // Hide the actual input but keep it clickable
        position: 'absolute',
        top: 0,
        left: 0,
    }
};

const styles = StyleSheet.create({
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
    panel: { backgroundColor: 'var(--bg-secondary)', borderRadius: 16, width: 500, maxWidth: '90vw', maxHeight: '85vh', overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
    title: { color: '#fff', fontSize: 20, fontWeight: '700' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },
    content: { padding: 20 },
    bannerSection: { position: 'relative', marginBottom: 16 },
    banner: { height: 100, backgroundColor: '#7c3aed', borderRadius: 8, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    editBannerBtn: { position: 'absolute', bottom: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },
    avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: -40, paddingLeft: 16 },
    avatarWrapper: { position: 'relative', zIndex: 10 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'var(--bg-secondary)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, overflow: 'visible', zIndex: 2 },
    editAvatarBtn: { position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', borderWidth: 2, borderColor: 'var(--bg-secondary)', zIndex: 20 },
    avatarText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '700',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        lineHeight: 'normal',
        margin: 0,
    },
    avatarInfo: { marginLeft: 16 },
    username: { color: '#fff', fontSize: 24, fontWeight: '600' },
    role: { color: '#8b5cf6', fontSize: 14 },
    premiumBadge: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
    section: { marginBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 16 },
    field: { marginBottom: 20 },
    label: { color: '#b4b4b4', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
    input: { backgroundColor: '#0f3460', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, outlineWidth: 0 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    message: { color: '#fff', fontSize: 14, marginBottom: 16, textAlign: 'center' },
    saveBtn: { backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', padding: 14, borderRadius: 8, alignItems: 'center', cursor: 'pointer', marginBottom: 24 },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    logoutBtn: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 20 },
    logoutBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
    helpText: { color: '#6b7280', fontSize: 11, marginTop: 4 },
    premiumLockBtn: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' },

    // Color Picker Styles
    colorPickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f3460',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    colorInputWrapper: {
        width: 40,
        height: 40,
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        marginRight: 12
    },
    colorValue: {
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 14
    },

    statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusOption: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#0f3460', cursor: 'pointer', borderWidth: 2, borderColor: 'transparent' },
    statusOptionActive: { borderColor: 'rgba(124, 58, 237, 0.5)', backgroundColor: 'rgba(124, 58, 237, 0.2)' },
    statusIcon: { fontSize: 14, marginRight: 8 },
    statusLabel: { color: '#a0a0a0', fontSize: 13, fontWeight: '500' },
});

export default ProfilePanel;
