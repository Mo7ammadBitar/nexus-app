import React, { useState } from 'react';
import { Gamepad2, ArrowLeft, Swords, Trophy, Hexagon, FileText, Scissors } from 'lucide-react';
import RockPaperScissors from './RockPaperScissors';

const GamingHub = () => {
    const [activeGame, setActiveGame] = useState(null);

    if (activeGame === 'rps') {
        return <RockPaperScissors onBack={() => setActiveGame(null)} />;
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={styles.headerIcon}>
                        <Gamepad2 size={28} color="#22c55e" />
                    </div>
                    <div>
                        <h1 style={styles.headerTitle}>Gaming Hub</h1>
                        <p style={styles.headerSub}>Play mini-games and have fun!</p>
                    </div>
                </div>
            </div>

            {/* Games Grid */}
            <div style={styles.gamesGrid}>
                {/* RPS Card */}
                <button style={styles.gameCard} onClick={() => setActiveGame('rps')}>
                    <div style={styles.gameCardGlow} />
                    <div style={styles.gameIconWrap}>
                        <Hexagon size={36} color="#c084fc" style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.7))' }} />
                        <FileText size={36} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.7))' }} />
                        <Scissors size={36} color="#fb7185" style={{ filter: 'drop-shadow(0 0 8px rgba(251,113,133,0.7))' }} />
                    </div>
                    <h3 style={styles.gameTitle}>Rock Paper Scissors</h3>
                    <p style={styles.gameDesc}>The classic game, reimagined. Challenge the CPU!</p>
                    <div style={styles.playBadge}>
                        <Swords size={14} style={{ marginRight: 6 }} />
                        Play Now
                    </div>
                </button>

                {/* Coming Soon Card */}
                <div style={{ ...styles.gameCard, opacity: 0.4, cursor: 'not-allowed' }}>
                    <div style={styles.gameIconWrap}>
                        <Trophy size={40} color="#6b7280" />
                    </div>
                    <h3 style={styles.gameTitle}>More Games</h3>
                    <p style={styles.gameDesc}>New mini-games are coming soon...</p>
                    <div style={{ ...styles.playBadge, background: 'rgba(107,114,128,0.2)', color: '#6b7280' }}>
                        Coming Soon
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'auto',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'var(--bg-secondary)',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
    },
    headerIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        background: 'rgba(34, 197, 94, 0.12)',
        border: '1px solid rgba(34, 197, 94, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
        margin: 0,
        background: 'linear-gradient(90deg, #22c55e, #4ade80)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    headerSub: {
        color: '#6b7280',
        fontSize: 13,
        margin: '4px 0 0',
    },
    gamesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 20,
        padding: '32px',
    },
    gameCard: {
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(15,15,35,0.95), rgba(25,25,50,0.95))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        textAlign: 'center',
        color: 'inherit',
        outline: 'none',
    },
    gameCardGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent, #22c55e, transparent)',
        opacity: 0.6,
    },
    gameIconWrap: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        marginBottom: 4,
    },
    gameTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        margin: 0,
    },
    gameDesc: {
        color: '#9ca3af',
        fontSize: 13,
        margin: 0,
        lineHeight: 1.5,
    },
    playBadge: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(34, 197, 94, 0.15)',
        color: '#4ade80',
        fontSize: 13,
        fontWeight: '700',
        padding: '8px 20px',
        borderRadius: 20,
        marginTop: 4,
    },
};

export default GamingHub;
