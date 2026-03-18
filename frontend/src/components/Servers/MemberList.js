import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native-web';
import { useServerStore } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import MemberProfile from '../Profile/MemberProfile';
import { Crown, Shield, VolumeX, User, Volume2, UserX } from 'lucide-react'; // Icons
import { useTranslation } from 'react-i18next';
import { getAuraRingStyle, getAuraNameStyle, injectAuraAnimations } from '../../utils/PremiumAura';
import { RELIC_CSS_MAP } from '../Shop/EtherealShop';
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


const MemberList = () => {
    const { t } = useTranslation();
    const { members, currentServer, promoteMember, demoteMember, muteMember, unmuteMember, kickMember } = useServerStore();
    const { user } = useAuthStore();
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [muteModal, setMuteModal] = useState(null);
    const [muteReason, setMuteReason] = useState('');
    const [muteDuration, setMuteDuration] = useState('1');
    const [muteError, setMuteError] = useState('');

    // Inject Aura animations on mount
    useEffect(() => {
        injectAuraAnimations();
    }, []);

    const myRole = currentServer?.my_role;
    const isOwner = myRole === 'owner';
    const isModerator = myRole === 'moderator';
    const canManage = isOwner || isModerator;

    const owners = members.filter(m => m.role === 'owner');
    const moderators = members.filter(m => m.role === 'moderator');
    const regularMembers = members.filter(m => m.role === 'member');

    // Handle Functions
    const handleContextMenu = (e, member) => { e.preventDefault(); if (member.user_id === user?._id || !canManage) return; setContextMenu({ x: e.clientX, y: e.clientY, member }); };
    const closeContextMenu = () => setContextMenu(null);

    const handlePromote = async () => { if (!contextMenu) return; await promoteMember(currentServer._id, contextMenu.member.user_id); closeContextMenu(); };
    const handleDemote = async () => { if (!contextMenu) return; await demoteMember(currentServer._id, contextMenu.member.user_id); closeContextMenu(); };

    const handleMuteClick = () => { if (!contextMenu) return; setMuteModal(contextMenu.member); closeContextMenu(); };

    const handleUnmute = async () => { if (!contextMenu) return; await unmuteMember(currentServer._id, contextMenu.member.user_id); closeContextMenu(); };

    const handleKick = async () => { if (!contextMenu) return; if (confirm(t('server.confirm_kick', `Kick ${contextMenu.member.username}?`).replace('${contextMenu.member.username}', contextMenu.member.username))) { await kickMember(currentServer._id, contextMenu.member.user_id); } closeContextMenu(); };

    const handleMuteSubmit = async () => {
        if (!muteModal || !muteReason.trim()) return;
        if (muteReason.trim().length < 5) {
            setMuteError(t('server.err_mute_reason_length', 'Reason must be at least 5 characters'));
            return;
        }
        setMuteError('');
        const result = await muteMember(currentServer._id, muteModal.user_id, muteReason, parseInt(muteDuration));
        if (result.success) {
            setMuteModal(null);
            setMuteReason('');
            setMuteDuration('1');
        } else {
            setMuteError(typeof result.error === 'string' ? result.error : t('server.err_mute', 'Failed to mute member'));
        }
    };

    const getMenuActions = (member) => {
        const actions = [];
        if (isOwner) {
            if (member.role === 'member') actions.push({ label: <><Shield size={14} style={{ marginInlineEnd: 6 }} /> {t('role.ordain_warden', 'Ordain as Moderator')}</>, onClick: handlePromote });
            if (member.role === 'moderator') actions.push({ label: <><User size={14} style={{ marginInlineEnd: 6 }} /> {t('role.cast_down_spirit', 'Cast down to Member')}</>, onClick: handleDemote });
        }
        if (canManage && member.role !== 'owner') {
            if (isModerator && member.role === 'moderator') return actions;
            if (member.is_muted) {
                actions.push({ label: <><Volume2 size={14} style={{ marginInlineEnd: 6 }} /> {t('server.restore_voice', 'Restore Voice')}</>, onClick: handleUnmute });
            } else {
                actions.push({ label: <><VolumeX size={14} style={{ marginInlineEnd: 6 }} /> {t('server.silence', 'Silence')}</>, onClick: handleMuteClick });
            }
            actions.push({ label: <><UserX size={14} style={{ marginInlineEnd: 6 }} /> {t('server.kick', 'Kick')}</>, onClick: handleKick, danger: true });
        }
        return actions;
    };

    const MemberItem = ({ member }) => {
        // Hydrate with latest global user state if it's the current user
        const isMe = user && member.user_id === user._id;

        const isPremium = isMe ? (user.is_premium) : member.is_premium;
        const currentAccent = isMe ? user.accent_color : member.accent_color;

        // Priority: Custom Accent > Premium Gold > Default
        const effectiveAccent = currentAccent || (isPremium ? '#f59e0b' : null);

        // Frame priority: Equipped Frame > Premium Glow > Default
        const equippedRelics = isMe ? (user.equipped_relics || {}) : (member.equipped_relics || {});
        const frameClass = equippedRelics.frame ? (RELIC_CSS_MAP[equippedRelics.frame] || '') : '';
        const hasFrame = !!frameClass;

        const getStatusStyle = () => {
            if (!member.is_online) return styles.statusOffline;
            const status = member.status || 'online';
            if (status === 'dnd') return styles.statusDnd;
            if (status === 'idle') return styles.statusIdle;
            return styles.statusOnline;
        };

        return (
            <div
                onContextMenu={(e) => handleContextMenu(e, member)}
                style={{ cursor: 'pointer', width: '100%' }} // Added width: 100% fix
            >
                <TouchableOpacity
                    style={styles.memberItem}
                    onPress={() => setSelectedProfile({ userId: member.user_id, serverRole: member.role })}
                >
                    <View style={styles.avatarContainer}>
                        {/* Aura Ring — only if no frame equipped */}
                        {!hasFrame && <div style={getAuraRingStyle(isPremium, effectiveAccent, { size: 'small' })} />}

                        {/* Relic Frame overlay */}
                        {hasFrame && <div className={`relic-frame ${frameClass}`} style={{
                            position: 'absolute',
                            inset: '-4px',
                            borderRadius: '50%',
                            zIndex: 3,
                            pointerEvents: 'none',
                            ...(FRAME_INLINE_STYLES[frameClass] || {}),
                        }} />}

                        <View style={[
                            styles.avatar,
                            !hasFrame && effectiveAccent && styles.accentAvatar,
                            !hasFrame && effectiveAccent && {
                                borderColor: effectiveAccent,
                                backgroundColor: 'transparent'  // Fix black ring
                            }
                        ]}>
                            {member.avatar_url ? (
                                <img
                                    src={resolveAssetUrl(member.avatar_url)}
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', pointerEvents: 'none' }}
                                    alt=""
                                />
                            ) : (
                                <Text style={styles.avatarText}>{member.username?.charAt(0).toUpperCase()}</Text>
                            )}
                        </View>
                        <View style={[styles.statusDot, getStatusStyle()]} />
                    </View>

                    <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, getAuraNameStyle(isPremium, effectiveAccent)]} numberOfLines={1}>
                            {member.display_name || member.username}
                        </Text>

                        {/* Icons Section */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginInlineStart: 6, gap: 4 }}>
                            {member.role === 'owner' && <Crown size={14} color="#f59e0b" />}
                            {member.role === 'moderator' && <Shield size={14} color="#8b5cf6" />}

                            {isPremium && member.role === 'member' && (
                                <Crown size={12} color={effectiveAccent || "#f59e0b"} fill={effectiveAccent ? `${effectiveAccent}40` : "transparent"} />
                            )}

                            {member.is_muted && <VolumeX size={14} color="#ef4444" />}
                        </View>
                    </View>
                </TouchableOpacity>
            </div>
        );
    };

    const MemberGroup = ({ title, members, icon }) => {
        if (members.length === 0) return null;
        return (
            <div style={StyleSheet.flatten(styles.group)}>
                <div style={{ ...StyleSheet.flatten({ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }) }}>
                    {icon}
                    <Text style={[styles.groupTitle, { marginBottom: 0, marginInlineStart: icon ? 6 : 0 }]}>{title} — {members.length}</Text>
                </div>
                {members.map(member => <MemberItem key={member._id} member={member} />)}
            </div>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <MemberGroup title={t('role.sovereign_caps', 'SOVEREIGN')} members={owners} icon={<Crown size={12} color="#f59e0b" />} />
                <MemberGroup title={t('role.wardens_caps', 'WARDENS')} members={moderators} icon={<Shield size={12} color="#8b5cf6" />} />
                <MemberGroup title={t('role.spirits_caps', 'SPIRITS')} members={regularMembers} icon={null} />
            </ScrollView>

            {/* Context Menu Portal */}
            {contextMenu && ReactDOM.createPortal(
                <div style={menuStyles.overlay} onClick={closeContextMenu}>
                    <div
                        style={{
                            ...menuStyles.menu,
                            insetInlineStart: contextMenu.x,
                            top: contextMenu.y,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={menuStyles.header}>
                            {contextMenu.member.display_name || contextMenu.member.username}
                        </div>
                        {getMenuActions(contextMenu.member).map((action, i) => (
                            <button
                                key={i}
                                style={{
                                    ...menuStyles.item,
                                    ...(action.danger ? menuStyles.dangerItem : {}),
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                onClick={action.onClick}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}

            {/* Mute Modal Portal */}
            {muteModal && ReactDOM.createPortal(
                <div style={modalStyles.overlay}>
                    <div style={modalStyles.modal}>
                        <h2 style={modalStyles.title}>{t('server.silence_user', 'Silence ')} {muteModal.display_name || muteModal.username}</h2>
                        <div style={modalStyles.form}>
                            {muteError && <p style={modalStyles.error}>{muteError}</p>}
                            <label style={modalStyles.label}>{t('server.mute_reason_label', 'Reason (min 5 characters)')}</label>
                            <input
                                style={modalStyles.input}
                                placeholder={t('server.mute_reason_placeholder', 'Enter mute reason...')}
                                value={muteReason}
                                onChange={(e) => setMuteReason(e.target.value)}
                                autoFocus
                            />
                            <label style={modalStyles.label}>{t('server.mute_duration_label', 'Duration')}</label>
                            <select
                                style={modalStyles.select}
                                value={muteDuration}
                                onChange={(e) => setMuteDuration(e.target.value)}
                            >
                                <option value="1">{t('time.hour_1', '1 hour')}</option>
                                <option value="6">{t('time.hours_6', '6 hours')}</option>
                                <option value="24">{t('time.hours_24', '24 hours')}</option>
                                <option value="72">{t('time.days_3', '3 days')}</option>
                                <option value="168">{t('time.days_7', '7 days')}</option>
                            </select>
                        </div>
                        <div style={modalStyles.buttons}>
                            <button
                                style={modalStyles.cancelBtn}
                                onClick={() => { setMuteModal(null); setMuteReason(''); setMuteError(''); }}
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                style={modalStyles.submitBtn}
                                onClick={handleMuteSubmit}
                                disabled={!muteReason.trim()}
                            >
                                {t('server.submit_silence', 'Silence Member')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* FIXED: Member Profile Portal */}
            {selectedProfile && ReactDOM.createPortal(
                <MemberProfile
                    userId={selectedProfile.userId}
                    serverRole={selectedProfile.serverRole}
                    onClose={() => setSelectedProfile(null)}
                />,
                document.body // This forces it to render outside the sidebar
            )}
        </View>
    );
};

// Styles Objects (Copied back to ensure full functionality)
const menuStyles = {
    overlay: { position: 'fixed', top: 0, insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, zIndex: 4000 },
    menu: { position: 'fixed', backgroundColor: '#0f3460', borderRadius: '8px', padding: '8px 0', minWidth: '180px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' },
    header: { padding: '8px 12px', color: '#fff', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '4px' },
    item: { display: 'block', width: '100%', padding: '8px 12px', backgroundColor: 'transparent', border: 'none', color: '#e5e5e5', fontSize: '14px', textAlign: 'left', cursor: 'pointer' },
    dangerItem: { color: '#ef4444' },
};

const modalStyles = {
    overlay: { position: 'fixed', top: 0, insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000 },
    modal: { backgroundColor: '#16213e', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw' },
    title: { color: '#fff', fontSize: '20px', fontWeight: '600', marginBottom: '20px', marginTop: 0 },
    form: { display: 'flex', flexDirection: 'column' },
    label: { color: '#a0a0a0', fontSize: '12px', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' },
    input: { backgroundColor: '#0f3460', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '12px', color: '#fff', fontSize: '14px', marginBottom: '16px', outline: 'none' },
    select: { backgroundColor: '#0f3460', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '12px', color: '#fff', fontSize: '14px', marginBottom: '20px', outline: 'none' },
    buttons: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
    cancelBtn: { padding: '10px 16px', backgroundColor: 'transparent', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer' },
    submitBtn: { background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
    error: { color: '#ef4444', fontSize: '14px', marginBottom: '12px', marginTop: 0 },
};

const styles = StyleSheet.create({
    container: { width: 240, backgroundColor: 'var(--bg-secondary)', borderLeftWidth: 1, borderLeftColor: 'rgba(255, 255, 255, 0.05)' },
    scrollView: { flex: 1, padding: 16 },
    group: { marginBottom: 20 },
    groupTitle: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
    memberItem: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 6, cursor: 'pointer', marginBottom: 2 },
    avatarContainer: { position: 'relative', marginInlineEnd: 10 },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'transparent', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    accentAvatar: { borderWidth: 2 },
    avatarText: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 16, textAlign: 'center' },
    statusDot: { position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#16213e' },
    statusOnline: { backgroundColor: '#22c55e' },
    statusDnd: { backgroundColor: '#ef4444' },
    statusIdle: { backgroundColor: '#f59e0b' },
    statusOffline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#6b7280' },
    memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    memberName: { color: '#b4b4b4', fontSize: 14, flex: 1 },
});

export default MemberList;