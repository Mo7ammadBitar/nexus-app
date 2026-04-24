import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Swords, Hexagon, FileText, Scissors, Circle, Grid3x3, Send, Zap } from 'lucide-react';
import { gamesAPI } from '../../services/api';
import { toast } from 'react-hot-toast';

const GAMES = [
    {
        id: 'tic-tac-toe',
        name: 'Tic-Tac-Toe',
        desc: 'Classic X & O Strategy',
        icons: (
            <>
                <X size={22} strokeWidth={3} color="#fb7185" style={{ filter: 'drop-shadow(0 0 6px rgba(251,113,133,0.6))' }} />
                <Circle size={20} strokeWidth={3} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.6))' }} />
            </>
        ),
        accent: '#22d3ee',
    },
    {
        id: 'rps',
        name: 'Rock Paper Scissors',
        desc: 'Quick reflex showdown',
        icons: (
            <>
                <Hexagon size={20} color="#c084fc" style={{ filter: 'drop-shadow(0 0 5px rgba(168,85,247,0.5))' }} />
                <FileText size={20} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.5))' }} />
                <Scissors size={20} color="#fb7185" style={{ filter: 'drop-shadow(0 0 5px rgba(251,113,133,0.5))' }} />
            </>
        ),
        accent: '#c084fc',
    },
];

const ChallengeModal = ({ isOpen, onClose, friendId, friendName }) => {
    const [selectedGame, setSelectedGame] = useState(null);
    const [wagerText, setWagerText] = useState('');
    const [sending, setSending] = useState(false);

    if (!isOpen) return null;

    const handleSend = async () => {
        if (!selectedGame) {
            toast.error('Select a game first!');
            return;
        }
        setSending(true);
        try {
            await gamesAPI.sendChallenge(friendId, selectedGame, wagerText);
            // Challenge appears in DM chat automatically via dm_new_message socket event
            toast.success(`Challenge sent to ${friendName}!`);
            onClose();
            setSelectedGame(null);
            setWagerText('');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Failed to send challenge.';
            toast.error(msg);
        } finally {
            setSending(false);
        }
    };

    return ReactDOM.createPortal(
        <div style={s.overlay} onClick={onClose}>
            <div style={s.modal} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={s.header}>
                    <div style={s.headerLeft}>
                        <Swords size={20} color="#e8ff47" style={{ filter: 'drop-shadow(0 0 6px rgba(232,255,71,0.5))' }} />
                        <span style={s.headerTitle}>Challenge {friendName}</span>
                    </div>
                    <button style={s.closeBtn} onClick={onClose}>
                        <X size={18} color="rgba(240,240,245,0.4)" />
                    </button>
                </div>

                {/* Game Picker */}
                <div style={s.section}>
                    <div style={s.sectionLabel}>SELECT GAME</div>
                    <div style={s.gameList}>
                        {GAMES.map(game => (
                            <button
                                key={game.id}
                                style={{
                                    ...s.gameOption,
                                    ...(selectedGame === game.id ? {
                                        borderColor: game.accent + '66',
                                        background: game.accent + '0F',
                                        boxShadow: `0 0 16px ${game.accent}22`,
                                    } : {}),
                                }}
                                onClick={() => setSelectedGame(game.id)}
                            >
                                <div style={s.gameIcons}>{game.icons}</div>
                                <div>
                                    <div style={s.gameName}>{game.name}</div>
                                    <div style={s.gameDesc}>{game.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Wager */}
                <div style={s.section}>
                    <div style={s.sectionLabel}>
                        <Zap size={12} color="#e8ff47" style={{ marginRight: 4, opacity: 0.6 }} />
                        WAGER (OPTIONAL)
                    </div>
                    <input
                        style={s.input}
                        placeholder="e.g. 50 Aether Shards"
                        value={wagerText}
                        onChange={e => setWagerText(e.target.value)}
                        maxLength={60}
                    />
                </div>

                {/* Send */}
                <button
                    style={{
                        ...s.sendBtn,
                        opacity: selectedGame ? 1 : 0.4,
                        cursor: selectedGame ? 'pointer' : 'not-allowed',
                    }}
                    onClick={handleSend}
                    disabled={!selectedGame || sending}
                >
                    <Send size={15} style={{ marginRight: 8 }} />
                    {sending ? 'Sending...' : 'Send Challenge'}
                </button>
            </div>
        </div>,
        document.body,
    );
};

const s = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
    },
    modal: {
        background: '#16161a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '0',
        width: 380,
        maxWidth: '92vw',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        color: '#f0f0f5',
        fontSize: 15,
        fontWeight: 700,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        display: 'flex',
        alignItems: 'center',
    },
    section: {
        padding: '16px 20px 0',
    },
    sectionLabel: {
        display: 'flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'rgba(240,240,245,0.35)',
        marginBottom: 10,
    },
    gameList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    gameOption: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'left',
        color: 'inherit',
    },
    gameIcons: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    gameName: {
        color: '#f0f0f5',
        fontSize: 14,
        fontWeight: 700,
    },
    gameDesc: {
        color: 'rgba(240,240,245,0.35)',
        fontSize: 11,
        marginTop: 2,
    },
    input: {
        width: '100%',
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        color: '#f0f0f5',
        fontSize: 13,
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
    },
    sendBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'calc(100% - 40px)',
        margin: '20px 20px',
        padding: '12px 20px',
        borderRadius: 12,
        border: '1px solid rgba(57,217,138,0.3)',
        background: 'rgba(57,217,138,0.12)',
        color: '#39d98a',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        letterSpacing: '0.02em',
    },
};

export default ChallengeModal;
