import React, { useState, useEffect } from 'react';
import { Gamepad2, ArrowLeft, Swords, Trophy, Hexagon, FileText, Scissors, X, Circle, Grid3x3 } from 'lucide-react';
import RockPaperScissors from './RockPaperScissors';
import TicTacToe from './TicTacToe';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useSocket } from '../../hooks/useSocket';
import { gamesAPI } from '../../services/api';
import { toast } from 'react-hot-toast';

const GamingHub = () => {
    const [activeGame, setActiveGame] = useState(null);
    const activeMultiplayerGame = useUIStore(s => s.activeMultiplayerGame);
    const clearActiveMultiplayerGame = useUIStore(s => s.clearActiveMultiplayerGame);
    const setShowGamingHub = useUIStore(s => s.setShowGamingHub);
    const [lastGameResult, setLastGameResult] = useState(null);
    const { socket } = useSocket('/chat');

    useEffect(() => {
        if (!socket) return;
        const handleGameResult = (data) => {
            setLastGameResult({
                result: data.result,
                opponent_result: data.opponent_result,
                game_type: data.game_type || 'Game'
            });
        };
        socket.on('game:result', handleGameResult);
        return () => socket.off('game:result', handleGameResult);
    }, [socket]);

    const handleGameEnd = async (result) => {
        if (!activeMultiplayerGame?.challengeId) return;
        try {
            await gamesAPI.recordResult(activeMultiplayerGame.challengeId, result);
        } catch (err) {
            console.error("Failed to record result:", err);
            toast.error("Failed to save game result.");
        }
    };

    const navigate = useNavigate();

    const handleExitMultiplayer = () => {
        clearActiveMultiplayerGame();
        
        // Use the global state directly to avoid any stale closure issues
        useUIStore.getState().setShowGamingHub(false);
    };

    const renderResultBanner = () => {
        if (!lastGameResult) return null;
        const isWin = lastGameResult.result === 'win';
        const isLoss = lastGameResult.result === 'lose' || lastGameResult.result === 'loss'; // handle 'loss'
        
        let bgColor = 'rgba(255, 202, 64, 0.15)'; // Draw
        let borderColor = '#ffca40';
        let textColor = '#ffca40';
        let text = 'MATCH DRAWN!';

        if (isWin) {
            bgColor = 'rgba(57, 217, 138, 0.15)';
            borderColor = '#39d98a';
            textColor = '#39d98a';
            text = 'VICTORY!';
        } else if (isLoss) {
            bgColor = 'rgba(255, 79, 123, 0.15)';
            borderColor = '#ff4f7b';
            textColor = '#ff4f7b';
            text = 'DEFEAT!';
        }

        return (
            <div style={{
                position: 'fixed',
                bottom: 30,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#16161a',
                border: `2px solid ${borderColor}`,
                boxShadow: `0 8px 32px ${bgColor}`,
                borderRadius: 16,
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                zIndex: 9999,
                animation: 'slideUpBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                <Trophy size={24} color={textColor} />
                <span style={{ color: textColor, fontWeight: 800, fontSize: 18, letterSpacing: '0.05em' }}>
                    {text}
                </span>
                <button
                    onClick={() => setLastGameResult(null)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(240,240,245,0.4)',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        marginLeft: 12
                    }}
                >
                    <X size={20} />
                </button>
            </div>
        );
    };

    // Priority: if a multiplayer game session is active, render that game
    if (activeMultiplayerGame) {
        if (activeMultiplayerGame.gameType === 'tic-tac-toe') {
            return (
                <>
                    {renderResultBanner()}
                    <TicTacToe onBack={handleExitMultiplayer} multiplayerSession={activeMultiplayerGame} onGameEnd={handleGameEnd} />
                </>
            );
        }
        if (activeMultiplayerGame.gameType === 'rps') {
            return (
                <>
                    {renderResultBanner()}
                    <RockPaperScissors onBack={handleExitMultiplayer} multiplayerSession={activeMultiplayerGame} onGameEnd={handleGameEnd} />
                </>
            );
        }
    }

    if (activeGame === 'rps') {
        return <RockPaperScissors onBack={() => setActiveGame(null)} />;
    }
    if (activeGame === 'ttt') {
        return <TicTacToe onBack={() => setActiveGame(null)} />;
    }

    return (
        <div style={styles.container}>
            {renderResultBanner()}
            
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

                {/* Tic-Tac-Toe Card */}
                <button style={styles.gameCard} onClick={() => setActiveGame('ttt')}>
                    <div style={{ ...styles.gameCardGlow, background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)' }} />
                    <div style={styles.gameIconWrap}>
                        <X size={36} strokeWidth={3} color="#fb7185" style={{ filter: 'drop-shadow(0 0 8px rgba(251,113,133,0.7))' }} />
                        <Circle size={32} strokeWidth={3} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.7))' }} />
                    </div>
                    <h3 style={styles.gameTitle}>Tic-Tac-Toe</h3>
                    <p style={styles.gameDesc}>Challenge an unbeatable AI or play it easy!</p>
                    <div style={{ ...styles.playBadge, background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>
                        <Grid3x3 size={14} style={{ marginRight: 6 }} />
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
            
            <style>{`
                @keyframes slideUpBounce {
                    0% { transform: translate(-50%, 100%); opacity: 0; }
                    60% { transform: translate(-50%, -10%); opacity: 1; }
                    100% { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
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
