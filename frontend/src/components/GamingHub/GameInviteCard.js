import React from 'react';
import {
    Gamepad2, Swords, X, PlayCircle, XCircle, Clock, Zap,
} from 'lucide-react';

/**
 * GameInviteCard — Rich embed for game challenges in chat (DMs / Channels).
 *
 * Props:
 *  - challengerName  (string)
 *  - gameName        (string)
 *  - wagerText       (string)  e.g. "50 Aether Shards"
 *  - status          ('pending' | 'accepted' | 'declined' | 'expired')
 *  - onAccept        (function)
 *  - onDecline       (function)
 */
const GameInviteCard = ({
    challengerName = 'Unknown',
    gameName = 'Game',
    wagerText = '',
    status = 'pending',
    onAccept,
    onDecline,
}) => {
    const isPending  = status === 'pending';
    const isAccepted = status === 'accepted';
    const isDeclined = status === 'declined';
    const isExpired  = status === 'expired';
    const isDimmed   = isDeclined || isExpired;

    // Accent colors per status
    const accentMap = {
        pending:  { color: '#e8ff47', glow: 'rgba(232,255,71,0.25)' },
        accepted: { color: '#39d98a', glow: 'rgba(57,217,138,0.3)' },
        declined: { color: '#ff4f7b', glow: 'rgba(255,79,123,0.15)' },
        expired:  { color: '#6b7280', glow: 'rgba(107,114,128,0.1)' },
    };
    const accent = accentMap[status] || accentMap.pending;

    return (
        <div
            style={{
                ...s.card,
                borderColor: isDimmed ? 'rgba(255,255,255,0.04)' : accent.color + '33',
                boxShadow: isDimmed ? 'none' : `0 0 20px ${accent.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                opacity: isDimmed ? 0.55 : 1,
            }}
        >
            {/* Top accent line */}
            <div
                style={{
                    ...s.accentLine,
                    background: `linear-gradient(90deg, transparent, ${accent.color}, transparent)`,
                    opacity: isDimmed ? 0.2 : 0.6,
                }}
            />

            {/* Header */}
            <div style={s.header}>
                <div style={{ ...s.headerIconWrap, borderColor: accent.color + '44' }}>
                    <Gamepad2 size={18} color={accent.color} style={{ filter: `drop-shadow(0 0 6px ${accent.glow})` }} />
                </div>
                <div style={s.headerText}>
                    <span style={s.challengerName}>{challengerName}</span>
                    <span style={s.headerMuted}> challenged you to </span>
                    <span style={s.gameName}>{gameName}</span>
                    <span style={s.headerMuted}>!</span>
                </div>
            </div>

            {/* Wager / body */}
            {wagerText && (
                <div style={s.wagerRow}>
                    <Zap size={13} color="#e8ff47" style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span style={s.wagerText}>{wagerText}</span>
                </div>
            )}

            {/* Status: Pending — Action Buttons */}
            {isPending && (
                <div style={s.actions}>
                    <button style={s.acceptBtn} onClick={onAccept}>
                        <Swords size={15} style={{ marginRight: 6 }} />
                        Accept
                    </button>
                    <button style={s.declineBtn} onClick={onDecline}>
                        <X size={15} style={{ marginRight: 4 }} />
                        Decline
                    </button>
                </div>
            )}

            {/* Status: Accepted */}
            {isAccepted && (
                <div style={s.statusRow}>
                    <PlayCircle
                        size={18}
                        color="#39d98a"
                        style={{ filter: 'drop-shadow(0 0 8px rgba(57,217,138,0.6))', flexShrink: 0 }}
                    />
                    <span style={{ ...s.statusText, color: '#39d98a' }}>
                        Game in Progress — Click to spectate / join
                    </span>
                    <div style={s.pulsingDot} />
                </div>
            )}

            {/* Status: Declined */}
            {isDeclined && (
                <div style={s.statusRow}>
                    <XCircle size={18} color="#ff4f7b" style={{ flexShrink: 0 }} />
                    <span style={{ ...s.statusText, color: '#ff4f7b' }}>Challenge Declined</span>
                </div>
            )}

            {/* Status: Expired */}
            {isExpired && (
                <div style={s.statusRow}>
                    <Clock size={18} color="#6b7280" style={{ flexShrink: 0 }} />
                    <span style={{ ...s.statusText, color: '#6b7280' }}>Challenge Expired</span>
                </div>
            )}
        </div>
    );
};

// ── STYLES ──
const s = {
    card: {
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.40)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid',
        borderRadius: 16,
        padding: '0',
        maxWidth: 400,
        width: '100%',
        transition: 'all 0.3s ease',
        fontFamily: "'Inter', sans-serif",
    },
    accentLine: {
        height: 2,
        width: '100%',
    },

    // Header
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '14px 16px 0',
    },
    headerIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        border: '1px solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.03)',
        flexShrink: 0,
    },
    headerText: {
        fontSize: 13,
        lineHeight: 1.5,
        color: 'rgba(240,240,245,0.55)',
        paddingTop: 2,
    },
    challengerName: {
        fontWeight: 700,
        color: '#f0f0f5',
    },
    headerMuted: {
        color: 'rgba(240,240,245,0.4)',
    },
    gameName: {
        fontWeight: 700,
        color: '#e8ff47',
    },

    // Wager
    wagerRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px 0',
    },
    wagerText: {
        fontSize: 12,
        color: 'rgba(240,240,245,0.35)',
        fontWeight: 500,
    },

    // Actions
    actions: {
        display: 'flex',
        gap: 8,
        padding: '14px 16px',
    },
    acceptBtn: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '9px 16px',
        borderRadius: 10,
        border: '1px solid rgba(57,217,138,0.3)',
        background: 'rgba(57,217,138,0.12)',
        color: '#39d98a',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        letterSpacing: '0.02em',
        boxShadow: '0 0 16px rgba(57,217,138,0.15)',
    },
    declineBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '9px 16px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        color: 'rgba(240,240,245,0.4)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },

    // Status row
    statusRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
    },
    statusText: {
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.02em',
        flex: 1,
    },
    pulsingDot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#39d98a',
        boxShadow: '0 0 8px rgba(57,217,138,0.6)',
        animation: 'gicPulse 1.5s ease-in-out infinite',
        flexShrink: 0,
    },
};

// Inject keyframe
if (typeof document !== 'undefined' && !document.querySelector('[data-gic-styles]')) {
    const tag = document.createElement('style');
    tag.setAttribute('data-gic-styles', '');
    tag.textContent = `
        @keyframes gicPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.7); }
        }
    `;
    document.head.appendChild(tag);
}

export default GameInviteCard;
