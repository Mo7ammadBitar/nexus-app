import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Award, Check, AlertCircle } from 'lucide-react';
import { BADGE_DEFINITIONS } from './UserBadges';
import { usersAPI } from '../../services/api';

const MAX_EQUIPPED = 4;

/**
 * BadgeManager Modal
 *
 * Lets the user see all owned badges and toggle which ones are equipped.
 * Enforces a strict maximum of 4 equipped badges.
 *
 * @param {boolean} isOpen
 * @param {string[]} ownedBadges — all badge IDs the user has unlocked
 * @param {string[]} equippedBadges — currently displayed badge IDs
 * @param {function} onSave — called with the new equipped list after successful save
 * @param {function} onClose
 */
const BadgeManager = ({ isOpen, ownedBadges = [], equippedBadges = [], onSave, onClose }) => {
    const [selected, setSelected] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Sync on open
    useEffect(() => {
        if (isOpen) {
            setSelected([...equippedBadges]);
            setError('');
            setSuccessMsg('');
        }
    }, [isOpen, equippedBadges]);

    if (!isOpen) return null;

    const toggleBadge = (badgeId) => {
        setError('');
        setSuccessMsg('');
        if (selected.includes(badgeId)) {
            setSelected(selected.filter(id => id !== badgeId));
        } else {
            if (selected.length >= MAX_EQUIPPED) {
                setError(`Maximum ${MAX_EQUIPPED} badges can be equipped at once.`);
                return;
            }
            setSelected([...selected, badgeId]);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const res = await usersAPI.updateEquippedBadges(selected);
            setSuccessMsg('Badges updated!');
            if (onSave) onSave(res.data.equipped_badges || selected);
            setTimeout(() => onClose(), 800);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update badges');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = JSON.stringify([...selected].sort()) !== JSON.stringify([...equippedBadges].sort());

    return ReactDOM.createPortal(
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <Award size={22} color="#a855f7" style={{ marginRight: 10 }} />
                        <h3 style={styles.title}>Manage Badges</h3>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>
                        <X size={18} color="#fff" />
                    </button>
                </div>

                {/* Subtitle */}
                <p style={styles.subtitle}>
                    Choose up to <strong>{MAX_EQUIPPED}</strong> badges to display on your profile.
                    <span style={styles.counter}>{selected.length}/{MAX_EQUIPPED} equipped</span>
                </p>

                {/* Badge Grid */}
                {ownedBadges.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Award size={48} color="#2a2a4a" />
                        <p style={styles.emptyText}>No badges earned yet</p>
                        <p style={styles.emptyHint}>Complete quests, win games, and be an early adopter to earn badges!</p>
                    </div>
                ) : (
                    <div style={styles.grid}>
                        {ownedBadges.map((badgeId) => {
                            const def = BADGE_DEFINITIONS[badgeId];
                            if (!def) return null;
                            const isEquipped = selected.includes(badgeId);
                            const Icon = def.icon;

                            return (
                                <button
                                    key={badgeId}
                                    style={{
                                        ...styles.badgeCard,
                                        borderColor: isEquipped ? def.color : 'rgba(255,255,255,0.06)',
                                        backgroundColor: isEquipped ? `${def.color}15` : 'rgba(255,255,255,0.03)',
                                        ...(selected.length >= MAX_EQUIPPED && !isEquipped ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                                    }}
                                    onClick={() => toggleBadge(badgeId)}
                                    title={def.tooltip}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: '50%',
                                        background: isEquipped ? def.gradient : 'rgba(255,255,255,0.06)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: isEquipped ? def.glow : 'none',
                                        transition: 'all 0.3s ease',
                                        marginBottom: 8,
                                    }}>
                                        <Icon size={20} color={isEquipped ? '#fff' : '#6b7280'} strokeWidth={2} />
                                    </div>

                                    {/* Name */}
                                    <span style={{
                                        color: isEquipped ? '#fff' : '#9ca3af',
                                        fontSize: 12,
                                        fontWeight: '600',
                                        textAlign: 'center',
                                        lineHeight: 1.3,
                                    }}>
                                        {def.name}
                                    </span>

                                    {/* Equipped indicator */}
                                    {isEquipped && (
                                        <div style={styles.equippedDot}>
                                            <Check size={10} color="#fff" strokeWidth={3} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Auto-badge hint */}
                <p style={{
                    color: '#4a4a6a',
                    fontSize: 11,
                    margin: '0 24px 16px 24px',
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    textAlign: 'center',
                }}>
                    Note: Role (Admin/Creator) and Prime badges are permanently auto-displayed and do not require manual equipping.
                </p>

                {/* Error / Success Messages */}
                {error && (
                    <div style={styles.errorMsg}>
                        <AlertCircle size={14} style={{ marginRight: 6, flexShrink: 0 }} />
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div style={styles.successMsg}>
                        <Check size={14} style={{ marginRight: 6, flexShrink: 0 }} />
                        {successMsg}
                    </div>
                )}

                {/* Save Button */}
                {ownedBadges.length > 0 && (
                    <button
                        style={{
                            ...styles.saveBtn,
                            opacity: (!hasChanges || saving) ? 0.5 : 1,
                            cursor: (!hasChanges || saving) ? 'not-allowed' : 'pointer',
                        }}
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? 'Saving...' : 'Save Badges'}
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 7000,
        animation: 'fadeIn 0.2s ease',
    },
    modal: {
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        width: 420,
        maxWidth: '92vw',
        maxHeight: '80vh',
        overflow: 'auto',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 24px 0 24px',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        margin: 0,
    },
    closeBtn: {
        width: 32, height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s',
    },
    subtitle: {
        color: '#9ca3af',
        fontSize: 13,
        margin: '12px 24px 20px 24px',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
    },
    counter: {
        color: '#a855f7',
        fontSize: 12,
        fontWeight: '700',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        padding: '4px 10px',
        borderRadius: 20,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        padding: '0 24px 20px 24px',
    },
    badgeCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 8px',
        borderRadius: 12,
        border: '2px solid rgba(255,255,255,0.06)',
        background: 'none',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        position: 'relative',
        minHeight: 100,
    },
    equippedDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 18,
        height: 18,
        borderRadius: '50%',
        backgroundColor: '#10b981',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px',
        gap: 8,
    },
    emptyText: {
        color: '#4a4a6a',
        fontSize: 15,
        fontWeight: '600',
        margin: '8px 0 0 0',
    },
    emptyHint: {
        color: '#3a3a5a',
        fontSize: 12,
        textAlign: 'center',
        margin: 0,
        maxWidth: 260,
        lineHeight: 1.5,
    },
    errorMsg: {
        display: 'flex',
        alignItems: 'center',
        color: '#ef4444',
        fontSize: 13,
        padding: '0 24px',
        marginBottom: 12,
    },
    successMsg: {
        display: 'flex',
        alignItems: 'center',
        color: '#10b981',
        fontSize: 13,
        padding: '0 24px',
        marginBottom: 12,
    },
    saveBtn: {
        width: 'calc(100% - 48px)',
        margin: '0 24px 24px 24px',
        padding: '14px',
        borderRadius: 10,
        border: 'none',
        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
};

export default BadgeManager;
