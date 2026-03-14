import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Edit2, Check, Copy, Crown, Shield, User, Lightbulb, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useServerStore } from '../../store/serverStore';
import { serversAPI } from '../../services/api';

const ServerSettings = ({ onClose }) => {
    const { t } = useTranslation();
    const { currentServer, fetchServers, selectServer } = useServerStore();
    const [copied, setCopied] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState(currentServer?.name || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const myRole = currentServer?.my_role;
    const isOwner = myRole === 'owner';
    const isModerator = myRole === 'moderator';
    const canViewInvite = isOwner || isModerator;

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
        width: '480px',
        maxWidth: '90vw',
        maxHeight: '80vh',
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
    warningText: {
        color: '#6b7280',
        fontSize: '12px',
        marginTop: '8px',
        marginBottom: 0,
    },
};

export default ServerSettings;
