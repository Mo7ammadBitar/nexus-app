import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Edit2, Check, Copy, Crown, Shield, User, Lightbulb, Trash2, Camera, Lock, Image, Upload, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useServerStore } from '../../store/serverStore';
import { serversAPI } from '../../services/api';import SentinelDashboard from './SentinelDashboard';

const ServerSettings = ({ onClose }) => {
    const { t } = useTranslation();
    const { currentServer, fetchServers, selectServer, updateServer } = useServerStore();
    const [copied, setCopied] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState(currentServer?.name || '');
    const [showSentinel, setShowSentinel] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const iconInputRef = useRef(null);
    const bannerInputRef = useRef(null);

    const myRole = currentServer?.my_role;
    const isOwner = myRole === 'owner';
    const isModerator = myRole === 'moderator';
    const canViewInvite = isOwner || isModerator;
    const boostLevel = currentServer?.boost_level || 0;

    const handleCopyInvite = () => {
        if (currentServer?.invite_code) {
            navigator.clipboard.writeText(currentServer.invite_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSaveName = async () => {
        if (!newName.trim() || newName === currentServer.name) {
            setEditingName(false);
            return;
        }
        setSaving(true);
        setError('');
        try {
            await serversAPI.updateServer(currentServer._id, { name: newName.trim() });
            await fetchServers();
            await selectServer(currentServer._id);
            setEditingName(false);
        } catch (err) {
            setError(err.response?.data?.detail || t('server.err_update_name', 'Failed to update name'));
        }
        setSaving(false);
    };

    const handleDeleteServer = async () => {
        if (confirm(t('server.confirm_delete_msg1', 'Are you sure you want to DELETE "') + currentServer.name + t('server.confirm_delete_msg2', '"? This action cannot be undone!'))) {
            try {
                await serversAPI.deleteServer(currentServer._id);
                await fetchServers();
                onClose();
            } catch (err) {
                setError(err.response?.data?.detail || t('server.err_delete_server', 'Failed to delete server'));
            }
        }
    };

    const handleIconUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingIcon(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            await serversAPI.uploadIcon(currentServer._id, formData);
            await fetchServers();
            await selectServer(currentServer._id);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to upload icon');
        }
        setUploadingIcon(false);
    };

    const handleBannerUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingBanner(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            await serversAPI.uploadBanner(currentServer._id, formData);
            await fetchServers();
            await selectServer(currentServer._id);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to upload banner');
        }
        setUploadingBanner(false);
    };

    if (!currentServer || !canViewInvite) return null;

    return ReactDOM.createPortal(
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>{t('server.settings_title', 'Server Settings')}</h2>
                    <button style={styles.closeBtn} onClick={onClose}><X size={24} /></button>
                </div>

                {error && <div style={styles.error}>{error}</div>}

                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>{t('server.realm_knowledge', 'Server Knowledge')}</h3>
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t('server.realm_name', 'Server Name')}</span>
                        {editingName ? (
                            <div style={styles.editContainer}>
                                <input
                                    style={styles.nameInput}
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    autoFocus
                                />
                                <button style={styles.saveBtn} onClick={handleSaveName} disabled={saving}>
                                    {saving ? '...' : <Check size={14} />}
                                </button>
                                <button style={styles.cancelEditBtn} onClick={() => setEditingName(false)}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <div style={styles.editContainer}>
                                <span style={styles.value}>{currentServer.name}</span>
                                {isOwner && (
                                    <button style={styles.editBtn} onClick={() => setEditingName(true)}>
                                        <Edit2 size={14} color="#b9bbbe" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t('server.your_role', 'Your Role')}</span>
                        <span style={styles.roleBadge}>
                            {myRole === 'owner' ? <><Crown size={14} color="#f59e0b" style={{ marginInlineEnd: 6 }} /> {t('role.prime', 'Prime')}</> :
                                myRole === 'moderator' ? <><Shield size={14} color="#10b981" style={{ marginInlineEnd: 6 }} /> {t('role.sentinel', 'Sentinel')}</> : <><User size={14} color="#b9bbbe" style={{ marginInlineEnd: 6 }} /> {t('role.spirit', 'Member')}</>}
                        </span>
                    </div>
                </div>

                {/* Server Icon Upload (Free — Owner) */}
                {isOwner && (
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>
                            <Camera size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Server Icon
                        </h3>
                        <p style={styles.description}>Upload a custom icon for your server. It will replace the default initials in the sidebar.</p>
                        <div style={styles.iconUploadArea}>
                            <div
                                style={styles.iconPreview}
                                onClick={() => iconInputRef.current?.click()}
                            >
                                {currentServer.icon_url ? (
                                    <img src={currentServer.icon_url} alt="" style={styles.iconImg} />
                                ) : (
                                    <span style={styles.iconInitial}>{currentServer.name?.charAt(0).toUpperCase()}</span>
                                )}
                                <div style={styles.iconOverlay}>
                                    <Camera size={20} color="#fff" />
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <button
                                    style={styles.uploadBtn}
                                    onClick={() => iconInputRef.current?.click()}
                                    disabled={uploadingIcon}
                                >
                                    <Upload size={14} style={{ marginRight: 6 }} />
                                    {uploadingIcon ? 'Uploading...' : 'Change Icon'}
                                </button>
                                <p style={styles.uploadHint}>JPG, PNG, GIF or WebP. Recommended 256x256.</p>
                            </div>
                        </div>
                        <input
                            ref={iconInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            style={{ display: 'none' }}
                            onChange={handleIconUpload}
                        />
                    </div>
                )}

                {/* Server Banner Upload (Premium — boost_level >= 1) */}
                {isOwner && (
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>
                            <Image size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Server Banner
                        </h3>
                        {boostLevel >= 1 ? (
                            <>
                                <p style={styles.description}>Upload a banner that displays at the top of your server's chat.</p>
                                <div
                                    style={styles.bannerUploadZone}
                                    onClick={() => bannerInputRef.current?.click()}
                                >
                                    {currentServer.banner_url ? (
                                        <img src={currentServer.banner_url} alt="" style={styles.bannerImg} />
                                    ) : (
                                        <div style={styles.bannerPlaceholder}>
                                            <Upload size={28} color="#a855f7" />
                                            <span style={{ color: '#a855f7', fontSize: 13, marginTop: 8 }}>Click to upload banner</span>
                                        </div>
                                    )}
                                    {uploadingBanner && (
                                        <div style={styles.bannerUploading}>Uploading...</div>
                                    )}
                                </div>
                                <p style={styles.uploadHint}>Recommended 960x540. JPG, PNG, GIF or WebP.</p>
                                <input
                                    ref={bannerInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    style={{ display: 'none' }}
                                    onChange={handleBannerUpload}
                                />
                            </>
                        ) : (
                            <div style={styles.lockedBanner}>
                                <Lock size={22} color="#6b7280" />
                                <div style={{ flex: 1 }}>
                                    <p style={styles.lockedTitle}>Boost Required</p>
                                    <p style={styles.lockedDesc}>
                                        Reach Boost Level 1 to unlock Custom Banners. Buy a boost in the Ethereal Shop!
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>{t('server.gate_key', 'Invite Code')}</h3>
                    <p style={styles.description}>
                        {t('server.invite_desc', 'Share this key to invite members to the Server')}
                    </p>
                    <div style={styles.inviteContainer}>
                        <code style={styles.inviteCode}>{currentServer.invite_code}</code>
                        <button
                            style={styles.copyBtn}
                            onClick={handleCopyInvite}
                        >
                            {copied ? <><Check size={14} style={{ marginInlineEnd: 6 }} /> {t('common.copied', 'Copied!')}</> : <><Copy size={14} style={{ marginInlineEnd: 6 }} /> {t('common.copy', 'Copy')}</>}
                        </button>
                    </div>
                </div>

                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>{t('server.spirit_management', 'Member Management')}</h3>
                    <div style={styles.tipBox}>
                        <span style={styles.tipIcon}><Lightbulb size={18} color="#f59e0b" /></span>
                        <span style={styles.tipText} dangerouslySetInnerHTML={{ __html: t('server.spirit_tip', '<strong>Right-click on any member</strong> in the member list (right side) to promote, demote, silence, or expel them.') }} />
                    </div>
                    {isOwner && (
                        <p style={styles.permissionNote}>
                            {t('server.prime_note', 'As Prime, you can promote members to Sentinels and demote them back.')}
                        </p>
                    )}
                    {isModerator && (
                        <p style={styles.permissionNote}>
                            {t('server.sentinel_note', 'As Sentinel, you can silence and expel members (but not other Sentinels).')}
                        </p>
                    )}
                </div>

                {/* Sentinel Section */}
                {canViewInvite && (
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>
                            <ShieldAlert size={14} color="#ef4444" style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Nexus Sentinel
                        </h3>
                        <p style={styles.description}>
                            Access the automated moderation system and threat logs.
                        </p>
                        <button style={styles.sentinelBtn} onClick={() => setShowSentinel(true)}>
                            OPEN SENTINEL CONTROL ROOM
                        </button>
                    </div>
                )}

                {isOwner && (
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>{t('server.abyssal_zone', 'Abyssal Zone')}</h3>
                        <button style={styles.deleteBtn} onClick={handleDeleteServer}>
                            <Trash2 size={16} style={{ marginInlineEnd: 8 }} /> {t('server.shatter_realm', 'Shatter Server')}
                        </button>
                        <p style={styles.warningText}>
                            {t('server.shatter_warning', 'This will permanently shatter the Server and all its data.')}
                        </p>
                    </div>
                )}
            </div>
            {showSentinel && (
                <SentinelDashboard 
                    serverId={currentServer._id} 
                    currentSettings={currentServer.sentinel_settings || {}}
                    onClose={() => setShowSentinel(false)} 
                    onSettingsUpdated={(newSettings, updatedServer) => {
                        if (updateServer && currentServer?._id) {
                            updateServer(currentServer._id, {
                                sentinel_settings: newSettings,
                                ...(updatedServer ? updatedServer : {})
                            });
                        }
                    }}
                />
            )}
        </div>,
        document.body
    );
};

const styles = {
    overlay: {
        position: 'absolute',
        top: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5000,
    },
    modal: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        width: '520px',
        maxWidth: '90vw',
        maxHeight: '85vh',
        overflow: 'auto',
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
        fontSize: '20px',
        fontWeight: '600',
        margin: 0,
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--bg-secondary)',
        fontSize: '20px',
        cursor: 'pointer',
        padding: '4px 8px',
    },
    error: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
        padding: '12px 24px',
        fontSize: '14px',
    },
    section: {
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    },
    sectionTitle: {
        color: 'var(--bg-secondary)',
        fontSize: '12px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        margin: '0 0 12px 0',
        display: 'flex',
        alignItems: 'center',
    },
    description: {
        color: '#6b7280',
        fontSize: '14px',
        margin: '0 0 16px 0',
        lineHeight: '1.5',
    },
    infoRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
    },
    label: {
        color: '#a0a0a0',
        fontSize: '14px',
    },
    value: {
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
    },
    editContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    nameInput: {
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '6px',
        padding: '6px 10px',
        color: '#fff',
        fontSize: '14px',
        width: '150px',
        outline: 'none',
    },
    editBtn: {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '4px',
    },
    saveBtn: {
        background: '#22c55e',
        border: 'none',
        borderRadius: '4px',
        color: '#fff',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    cancelEditBtn: {
        background: '#6b7280',
        border: 'none',
        borderRadius: '4px',
        color: '#fff',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    roleBadge: {
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
    },
    // ---- Icon Upload ----
    iconUploadArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
    },
    iconPreview: {
        width: 72,
        height: 72,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
        border: '2px solid rgba(168, 85, 247, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'border-color 0.3s ease',
    },
    iconImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%',
    },
    iconInitial: {
        color: '#a78bfa',
        fontSize: '28px',
        fontWeight: '700',
    },
    iconOverlay: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
        transition: 'opacity 0.2s ease',
        borderRadius: '50%',
    },
    uploadBtn: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 18px',
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: 'none',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        marginBottom: '6px',
    },
    uploadHint: {
        color: '#4b5563',
        fontSize: '12px',
        margin: 0,
    },
    // ---- Banner Upload ----
    bannerUploadZone: {
        width: '100%',
        height: 140,
        borderRadius: '12px',
        border: '2px dashed rgba(168, 85, 247, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4), rgba(49, 46, 129, 0.2))',
        transition: 'border-color 0.3s ease',
        marginBottom: 8,
    },
    bannerImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    bannerPlaceholder: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerUploading: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#a855f7',
        fontSize: '14px',
        fontWeight: '600',
    },
    lockedBanner: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '18px 16px',
        background: 'rgba(107, 114, 128, 0.08)',
        borderRadius: '12px',
        border: '1px solid rgba(107, 114, 128, 0.15)',
    },
    lockedTitle: {
        color: '#9ca3af',
        fontSize: '14px',
        fontWeight: '600',
        margin: '0 0 4px 0',
    },
    lockedDesc: {
        color: '#6b7280',
        fontSize: '13px',
        margin: 0,
        lineHeight: '1.4',
    },
    // ---- Invite / Tip / etc ----
    inviteContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: '#0f3460',
        borderRadius: '8px',
        padding: '12px 16px',
    },
    inviteCode: {
        flex: 1,
        color: '#fff',
        fontSize: '18px',
        fontWeight: '600',
        fontFamily: 'monospace',
        letterSpacing: '2px',
    },
    copyBtn: {
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: 'none',
        borderRadius: '6px',
        padding: '8px 16px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    tipBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '12px',
    },
    tipIcon: {
        fontSize: '20px',
    },
    tipText: {
        color: '#e5e5e5',
        fontSize: '14px',
        lineHeight: '1.5',
    },
    permissionNote: {
        color: '#6b7280',
        fontSize: '13px',
        margin: '8px 0 0 0',
    },
    deleteBtn: {
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        border: 'none',
        borderRadius: '8px',
        padding: '12px 20px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        width: '100%',
    },
    sentinelBtn: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        padding: '12px 20px',
        color: '#ef4444',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        width: '100%',
        letterSpacing: '1px',
    },
    warningText: {
        color: '#6b7280',
        fontSize: '12px',
        marginTop: '8px',
        marginBottom: 0,
    },
};

export default ServerSettings;

