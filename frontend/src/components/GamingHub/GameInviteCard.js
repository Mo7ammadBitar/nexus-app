import React, { useState, useEffect } from 'react';
import {
    Gamepad2, Swords, X, PlayCircle, XCircle, Clock, Zap, Loader, Trophy
} from 'lucide-react';

const GameInviteCard = ({
    challengerName = 'Unknown',
    gameName = 'Game',
    wagerText = '',
    status = 'pending',
    isSender = false,
    opponentName = '',
    expiresAt = null,
    onAccept,
    onDecline,
    onCancel,
    accepting = false,
    declining = false,
    cancelling = false,
    gameResult = null,
}) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isExpiredLocally, setIsExpiredLocally] = useState(false);

    // Live countdown timer
    useEffect(() => {
        if (status !== 'pending' || !expiresAt) return;

        const updateTimer = () => {
            const now = new Date();
            const expiry = new Date(expiresAt);
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeLeft('Expired');
                setIsExpiredLocally(true);
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [status, expiresAt]);

    const effectiveStatus = (status === 'pending' && isExpiredLocally) ? 'expired' : status;

    const isPending  = effectiveStatus === 'pending';
    const isAccepted = effectiveStatus === 'accepted';
    const isDeclined = effectiveStatus === 'declined';
    const isExpired  = effectiveStatus === 'expired';
    const isCancelled = effectiveStatus === 'cancelled';
    const isCompleted = effectiveStatus === 'completed';
    const isDimmed   = isDeclined || isExpired || isCancelled;

    const accentMap = {
        pending:   { color: '#e8ff47', glow: 'rgba(232,255,71,0.25)' },
        accepted:  { color: '#39d98a', glow: 'rgba(57,217,138,0.3)' },
        declined:  { color: '#ff4f7b', glow: 'rgba(255,79,123,0.15)' },
        expired:   { color: '#6b7280', glow: 'rgba(107,114,128,0.1)' },
        cancelled: { color: '#6b7280', glow: 'rgba(107,114,128,0.1)' },
        completed: { color: '#e8ff47', glow: 'rgba(232,255,71,0.25)' },
    };
    const accent = accentMap[effectiveStatus] || accentMap.pending;

    const formatResultText = () => {
        if (!gameResult) return 'Match Completed!';
        const res = gameResult.reporter_result;
        if (res === 'draw') return 'Game Drawn';
        if (res === 'win') return 'Result: Win';
        if (res === 'loss' || res === 'lose') return 'Result: Loss';
        return `Result: ${res}`;
    };

    return (
        <div
            style={{
                ...s.card,
                borderColor: isDimmed ? 'rgba(255,255,255,0.04)' : accent.color + '33',
                boxShadow: isDimmed ? 'none' : `0 0 20px ${accent.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                opacity: isDimmed ? 0.55 : 1,
            }}
        >
            <div
                style={{
                    ...s.accentLine,
                    background: `linear-gradient(90deg, transparent, ${accent.color}, transparent)`,
                    opacity: isDimmed ? 0.2 : 0.6,
                }}
            />

            <div style={s.header}>
                <div style={{ ...s.headerIconWrap, borderColor: accent.color + '44' }}>
                    <Gamepad2 size={18} color={accent.color} style={{ filter: `drop-shadow(0 0 6px ${accent.glow})` }} />
                </div>
                <div style={s.headerText}>
                    {isSender ? (
                        <>
                            <span style={s.headerMuted}>You challenged </span>
                            <span style={s.challengerName}>{opponentName || 'them'}</span>
                            <span style={s.headerMuted}> to </span>
                            <span style={s.gameName}>{gameName}</span>
                            <span style={s.headerMuted}>!</span>
                        </>
                    ) : (
                        <>
                            <span style={s.challengerName}>{challengerName}</span>
                            <span style={s.headerMuted}> challenged you to </span>
                            <span style={s.gameName}>{gameName}</span>
                            <span style={s.headerMuted}>!</span>
                        </>
                    )}
                </div>
            </div>

            {wagerText && (
                <div style={s.wagerRow}>
                    <Zap size={13} color="#e8ff47" style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span style={s.wagerText}>{wagerText}</span>
                </div>
            )}

            {isPending && (
                isSender ? (
                    <div style={s.statusRow}>
                        <Loader
                            size={16}
                            color="#e8ff47"
                            style={{ flexShrink: 0, animation: 'gicSpin 1.5s linear infinite' }}
                        />
                        <span style={{ ...s.statusText, color: 'rgba(240,240,245,0.5)' }}>
                            Waiting for {opponentName || 'opponent'}...
                        </span>
                        {timeLeft && (
                            <span style={s.timerBadge}>
                                <Clock size={11} style={{ marginRight: 3, opacity: 0.6 }} />
                                {timeLeft}
                            </span>
                        )}
                        <button 
                            style={{...s.declineBtn, padding: '4px 8px', fontSize: 11, marginLeft: 8, opacity: cancelling ? 0.6 : 1 }}
                            onClick={onCancel}
                            disabled={cancelling}
                        >
                            {cancelling ? '...' : 'Cancel'}
                        </button>
                    </div>
                ) : (
                    <div>
                        {timeLeft && (
                            <div style={s.timerRow}>
                                <Clock size={12} color="rgba(240,240,245,0.3)" />
                                <span style={s.timerText}>Expires in {timeLeft}</span>
                            </div>
                        )}
                        <div style={s.actions}>
                            <button
                                style={{ ...s.acceptBtn, opacity: accepting ? 0.6 : 1 }}
                                onClick={onAccept}
                                disabled={accepting || declining}
                            >
                                {accepting ? (
                                    <Loader size={15} style={{ marginRight: 6, animation: 'gicSpin 1s linear infinite' }} />
                                ) : (
                                    <Swords size={15} style={{ marginRight: 6 }} />
                                )}
                                {accepting ? 'Accepting...' : 'Accept'}
                            </button>
                            <button
                                style={{ ...s.declineBtn, opacity: declining ? 0.6 : 1 }}
                                onClick={onDecline}
                                disabled={accepting || declining}
                            >
                                {declining ? (
                                    <Loader size={15} style={{ marginRight: 4, animation: 'gicSpin 1s linear infinite' }} />
                                ) : (
                                    <X size={15} style={{ marginRight: 4 }} />
                                )}
                                {declining ? 'Declining...' : 'Decline'}
                            </button>
                        </div>
                    </div>
                )
            )}

            {isAccepted && (
                <div style={s.statusRow}>
                    <PlayCircle
                        size={18}
                        color="#39d98a"
                        style={{ filter: 'drop-shadow(0 0 8px rgba(57,217,138,0.6))', flexShrink: 0 }}
                    />
                    <span style={{ ...s.statusText, color: '#39d98a' }}>
                        Challenge Accepted — Game On! 🎮
                    </span>
                    <div style={s.pulsingDot} />
                </div>
            )}

            {isDeclined && (
                <div style={s.statusRow}>
                    <XCircle size={18} color="#ff4f7b" style={{ flexShrink: 0 }} />
                    <span style={{ ...s.statusText, color: '#ff4f7b' }}>Challenge Declined</span>
                </div>
            )}

            {isExpired && (
                <div style={s.statusRow}>
                    <Clock size={18} color="#6b7280" style={{ flexShrink: 0 }} />
                    <span style={{ ...s.statusText, color: '#6b7280' }}>Challenge Expired</span>
                </div>
            )}

            {isCancelled && (
                <div style={s.statusRow}>
                    <XCircle size={18} color="#6b7280" style={{ flexShrink: 0 }} />
                    <span style={{ ...s.statusText, color: '#6b7280' }}>Challenge Cancelled</span>
                </div>
            )}

            {isCompleted && (
                <div style={s.statusRow}>
                    <Trophy size={18} color="#e8ff47" style={{ flexShrink: 0 }} />
                    <span style={{ ...s.statusText, color: '#e8ff47' }}>
                        {formatResultText()}
                    </span>
                </div>
            )}
        </div>
    );
};

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
    accentLine: { height: 2, width: '100%' },
    header: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px 0' },
    headerIconWrap: { width: 34, height: 34, borderRadius: 10, border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', flexShrink: 0 },
    headerText: { fontSize: 13, lineHeight: 1.5, color: 'rgba(240,240,245,0.55)', paddingTop: 2 },
    challengerName: { fontWeight: 700, color: '#f0f0f5' },
    headerMuted: { color: 'rgba(240,240,245,0.4)' },
    gameName: { fontWeight: 700, color: '#e8ff47' },
    wagerRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px 0' },
    wagerText: { fontSize: 12, color: 'rgba(240,240,245,0.35)', fontWeight: 500 },
    timerRow: { display: 'flex', alignItems: 'center', gap: 5, padding: '10px 16px 0' },
    timerText: { fontSize: 11, color: 'rgba(240,240,245,0.25)', fontFamily: 'monospace' },
    timerBadge: { display: 'flex', alignItems: 'center', fontSize: 11, fontFamily: 'monospace', color: 'rgba(240,240,245,0.3)', marginLeft: 'auto', flexShrink: 0 },
    actions: { display: 'flex', gap: 8, padding: '14px 16px' },
    acceptBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(57,217,138,0.3)', background: 'rgba(57,217,138,0.12)', color: '#39d98a', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', letterSpacing: '0.02em', boxShadow: '0 0 16px rgba(57,217,138,0.15)' },
    declineBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(240,240,245,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' },
    statusRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' },
    statusText: { fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', flex: 1 },
    pulsingDot: { width: 8, height: 8, borderRadius: '50%', background: '#39d98a', boxShadow: '0 0 8px rgba(57,217,138,0.6)', animation: 'gicPulse 1.5s ease-in-out infinite', flexShrink: 0 },
};

if (typeof document !== 'undefined' && !document.querySelector('[data-gic-styles]')) {
    const tag = document.createElement('style');
    tag.setAttribute('data-gic-styles', '');
    tag.textContent = `
        @keyframes gicPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        @keyframes gicSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(tag);
}

export default GameInviteCard;
