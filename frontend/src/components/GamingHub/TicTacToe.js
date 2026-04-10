import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RotateCcw, X, Circle, ChevronDown, Bot, Users, Search, Send, Loader, Clock } from 'lucide-react';
import { useFriendsStore } from '../../store/friendsStore';
import { gamesAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import { resolveAssetUrl } from '../../config';

// ── SOUND ENGINE ──
const createSoundEngine = () => {
    let ctx = null;
    const getCtx = () => {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    };
    const tone = ({ freq = 440, type = 'sine', vol = 0.3, dur = 0.15, attack = 0.005 }) => {
        try {
            const ac = getCtx();
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ac.currentTime);
            gain.gain.setValueAtTime(0, ac.currentTime);
            gain.gain.linearRampToValueAtTime(vol, ac.currentTime + attack);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + dur + 0.01);
        } catch (e) { /* silent */ }
    };
    return {
        place: () => {
            tone({ freq: 660, type: 'sine', vol: 0.15, dur: 0.08 });
            setTimeout(() => tone({ freq: 880, type: 'sine', vol: 0.1, dur: 0.06 }), 50);
        },
        win: () => {
            [523, 659, 784, 1047].forEach((f, i) =>
                setTimeout(() => tone({ freq: f, vol: 0.25, dur: 0.2, type: 'triangle' }), i * 80)
            );
        },
        lose: () => {
            tone({ freq: 330, type: 'sawtooth', vol: 0.2, dur: 0.15 });
            setTimeout(() => tone({ freq: 220, type: 'sawtooth', vol: 0.2, dur: 0.2 }), 100);
        },
        draw: () => {
            tone({ freq: 440, type: 'sine', vol: 0.18, dur: 0.25 });
        },
    };
};

// ── WIN COMBOS ──
const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

const checkWinner = (board) => {
    for (const line of WIN_LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line };
        }
    }
    if (board.every(cell => cell !== null)) return { winner: 'draw', line: null };
    return null;
};

// ── MINIMAX AI ──
const minimax = (board, isMaximizing, depth = 0) => {
    const result = checkWinner(board);
    if (result) {
        if (result.winner === 'O') return 10 - depth;
        if (result.winner === 'X') return depth - 10;
        return 0;
    }
    if (isMaximizing) {
        let best = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = 'O';
                best = Math.max(best, minimax(board, false, depth + 1));
                board[i] = null;
            }
        }
        return best;
    } else {
        let best = Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = 'X';
                best = Math.min(best, minimax(board, true, depth + 1));
                board[i] = null;
            }
        }
        return best;
    }
};

const getBestMove = (board) => {
    let bestVal = -Infinity;
    let bestMove = -1;
    for (let i = 0; i < 9; i++) {
        if (!board[i]) {
            board[i] = 'O';
            const val = minimax(board, false, 0);
            board[i] = null;
            if (val > bestVal) {
                bestVal = val;
                bestMove = i;
            }
        }
    }
    return bestMove;
};

const getRandomMove = (board) => {
    const empty = board.map((v, i) => v === null ? i : null).filter(v => v !== null);
    return empty[Math.floor(Math.random() * empty.length)];
};

// ── STRIKE LINE GEOMETRY ──
const getStrikeStyle = (line) => {
    if (!line) return {};
    const [a, , c] = line;
    const rowA = Math.floor(a / 3), colA = a % 3;
    const rowC = Math.floor(c / 3), colC = c % 3;
    const cellSize = 100 / 3;
    const startX = colA * cellSize + cellSize / 2;
    const startY = rowA * cellSize + cellSize / 2;
    const endX = colC * cellSize + cellSize / 2;
    const endY = rowC * cellSize + cellSize / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return {
        position: 'absolute',
        top: `${startY}%`,
        left: `${startX}%`,
        width: `${length}%`,
        height: 3,
        background: 'linear-gradient(90deg, #e8ff47, #39d98a)',
        boxShadow: '0 0 12px rgba(232,255,71,0.6), 0 0 24px rgba(57,217,138,0.4)',
        borderRadius: 4,
        transform: `rotate(${angle}deg)`,
        transformOrigin: '0 50%',
        zIndex: 10,
        animation: 'tttStrike 0.4s ease forwards',
    };
};


// ═══════════════════════════════════════════════════
// LOBBY VIEW — "Play vs CPU" / "Play Multiplayer"
// ═══════════════════════════════════════════════════
const LobbyView = ({ onSelectCPU, onSelectMultiplayer, onBack }) => (
    <div style={st.container}>
        <div style={st.header}>
            <button style={st.headerBtn} onClick={onBack}>
                <ArrowLeft size={16} style={{ marginRight: 6 }} /> Back
            </button>
            <div style={st.modeBadge}>TIC-TAC-TOE</div>
            <div style={{ width: 80 }} />
        </div>

        <div style={lobby.body}>
            <div style={lobby.titleWrap}>
                <X size={38} strokeWidth={3} color="#fb7185" style={{ filter: 'drop-shadow(0 0 12px rgba(251,113,133,0.7))' }} />
                <Circle size={34} strokeWidth={3} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.7))' }} />
            </div>
            <h2 style={lobby.title}>Choose Mode</h2>
            <p style={lobby.subtitle}>Challenge the AI or invite a friend</p>

            <div style={lobby.cards}>
                <button style={lobby.card} onClick={onSelectCPU}>
                    <div style={{ ...lobby.cardGlow, background: 'linear-gradient(90deg, transparent, #c084fc, transparent)' }} />
                    <div style={lobby.cardIcon}>
                        <Bot size={40} color="#c084fc" style={{ filter: 'drop-shadow(0 0 10px rgba(192,132,252,0.6))' }} />
                    </div>
                    <div style={lobby.cardTitle}>Play vs CPU</div>
                    <div style={lobby.cardDesc}>Challenge the Minimax AI — Easy or Unbeatable</div>
                    <div style={{ ...lobby.cardBadge, borderColor: 'rgba(192,132,252,0.3)', background: 'rgba(192,132,252,0.1)', color: '#c084fc' }}>
                        <Bot size={13} style={{ marginRight: 6 }} /> Solo Play
                    </div>
                </button>

                <button style={lobby.card} onClick={onSelectMultiplayer}>
                    <div style={{ ...lobby.cardGlow, background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)' }} />
                    <div style={lobby.cardIcon}>
                        <Users size={40} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.6))' }} />
                    </div>
                    <div style={lobby.cardTitle}>Play Multiplayer</div>
                    <div style={lobby.cardDesc}>Challenge a friend — they'll receive an invite in DMs</div>
                    <div style={{ ...lobby.cardBadge, borderColor: 'rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
                        <Users size={13} style={{ marginRight: 6 }} /> Invite Friend
                    </div>
                </button>
            </div>
        </div>
    </div>
);


// ═══════════════════════════════════════════════════
// FRIEND PICKER VIEW — select opponent
// ═══════════════════════════════════════════════════
const FriendPickerView = ({ onBack, onBackToLobby }) => {
    const { friends, fetchFriends } = useFriendsStore();
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState(null); // friendId being sent to
    const [sentTo, setSentTo] = useState(null); // { id, name } after success

    useEffect(() => {
        fetchFriends();
    }, []); // eslint-disable-line

    const filtered = friends.filter(f =>
        (f.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.display_name || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleChallenge = async (friend) => {
        const fId = friend._id || friend.id;
        setSending(fId);
        try {
            const res = await gamesAPI.sendChallenge(fId, 'tic-tac-toe');
            const challenge = res.data.challenge;
            useFriendsStore.getState().addGameChallenge(challenge);
            setSentTo({ id: fId, name: friend.display_name || friend.username });
            toast.success(`Challenge sent to ${friend.display_name || friend.username}!`);
        } catch (err) {
            const msg = err.response?.data?.detail || 'Failed to send challenge.';
            toast.error(msg);
        } finally {
            setSending(null);
        }
    };

    // Waiting state after challenge sent
    if (sentTo) {
        return (
            <div style={st.container}>
                <div style={st.header}>
                    <button style={st.headerBtn} onClick={onBack}>
                        <ArrowLeft size={16} style={{ marginRight: 6 }} /> Hub
                    </button>
                    <div style={st.modeBadge}>TIC-TAC-TOE</div>
                    <div style={{ width: 80 }} />
                </div>
                <div style={waiting.body}>
                    <div style={waiting.iconRing}>
                        <Send size={36} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.6))' }} />
                    </div>
                    <h2 style={waiting.title}>Challenge Sent!</h2>
                    <p style={waiting.subtitle}>
                        Waiting for <span style={{ color: '#f0f0f5', fontWeight: 700 }}>{sentTo.name}</span> to accept in their DMs...
                    </p>
                    <div style={waiting.timerRow}>
                        <Clock size={14} color="rgba(240,240,245,0.3)" />
                        <span style={waiting.timerText}>Expires in 5 minutes</span>
                    </div>
                    <button style={waiting.backBtn} onClick={onBackToLobby}>
                        <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back to Lobby
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={st.container}>
            <div style={st.header}>
                <button style={st.headerBtn} onClick={onBackToLobby}>
                    <ArrowLeft size={16} style={{ marginRight: 6 }} /> Lobby
                </button>
                <div style={st.modeBadge}>SELECT OPPONENT</div>
                <div style={{ width: 80 }} />
            </div>

            {/* Search */}
            <div style={fp.searchWrap}>
                <Search size={16} color="rgba(240,240,245,0.3)" style={{ flexShrink: 0 }} />
                <input
                    style={fp.searchInput}
                    placeholder="Search friends..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Friends List */}
            <div style={fp.list}>
                {filtered.length === 0 ? (
                    <div style={fp.empty}>
                        <Users size={32} color="rgba(240,240,245,0.15)" />
                        <span style={fp.emptyText}>{friends.length === 0 ? 'No friends yet' : 'No friends match your search'}</span>
                    </div>
                ) : (
                    filtered.map(friend => {
                        const fId = friend._id || friend.id;
                        const isSending = sending === fId;
                        return (
                            <button
                                key={fId}
                                style={fp.friendRow}
                                onClick={() => !isSending && handleChallenge(friend)}
                                disabled={isSending}
                            >
                                <div style={fp.avatar}>
                                    {friend.avatar_url ? (
                                        <img src={resolveAssetUrl(friend.avatar_url)} style={fp.avatarImg} alt="" />
                                    ) : (
                                        <span style={fp.avatarLetter}>{(friend.username || '?')[0].toUpperCase()}</span>
                                    )}
                                    {friend.is_online && <div style={fp.onlineDot} />}
                                </div>
                                <div style={fp.friendInfo}>
                                    <div style={fp.friendName}>{friend.display_name || friend.username}</div>
                                    <div style={fp.friendUsername}>@{friend.username}</div>
                                </div>
                                <div style={{
                                    ...fp.challengeBtn,
                                    opacity: isSending ? 0.5 : 1,
                                }}>
                                    {isSending ? (
                                        <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                        <>
                                            <Send size={13} style={{ marginRight: 5 }} />
                                            Challenge
                                        </>
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════════════
// CPU GAME VIEW — the existing game logic
// ═══════════════════════════════════════════════════
const CPUGameView = ({ onBack, onBackToLobby }) => {
    const soundsRef = useRef(null);
    if (!soundsRef.current) soundsRef.current = createSoundEngine();
    const sounds = soundsRef.current;

    const [board, setBoard] = useState(Array(9).fill(null));
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);
    const [gameOver, setGameOver] = useState(false);
    const [winLine, setWinLine] = useState(null);
    const [resultText, setResultText] = useState('');
    const [resultType, setResultType] = useState('');
    const [score, setScore] = useState({ player: 0, cpu: 0, draws: 0 });
    const [difficulty, setDifficulty] = useState('hard');
    const [cpuThinking, setCpuThinking] = useState(false);
    const [showDiffMenu, setShowDiffMenu] = useState(false);
    const [hoveredCell, setHoveredCell] = useState(null);

    useEffect(() => {
        if (isPlayerTurn || gameOver) return;
        setCpuThinking(true);
        const timer = setTimeout(() => {
            const boardCopy = [...board];
            const move = difficulty === 'hard' ? getBestMove(boardCopy) : getRandomMove(boardCopy);
            if (move === -1 || move === undefined) return;
            const newBoard = [...board];
            newBoard[move] = 'O';
            setBoard(newBoard);
            sounds.place();
            const result = checkWinner(newBoard);
            if (result) endGame(result);
            else setIsPlayerTurn(true);
            setCpuThinking(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [isPlayerTurn, gameOver, board, difficulty]); // eslint-disable-line

    const handleCellClick = (index) => {
        if (!isPlayerTurn || board[index] || gameOver || cpuThinking) return;
        const newBoard = [...board];
        newBoard[index] = 'X';
        setBoard(newBoard);
        sounds.place();
        const result = checkWinner(newBoard);
        if (result) endGame(result);
        else setIsPlayerTurn(false);
    };

    const endGame = (result) => {
        setGameOver(true);
        if (result.winner === 'X') {
            setResultText('▲ YOU WIN'); setResultType('win');
            setWinLine(result.line);
            setScore(prev => ({ ...prev, player: prev.player + 1 }));
            sounds.win();
        } else if (result.winner === 'O') {
            setResultText('▼ CPU WINS'); setResultType('lose');
            setWinLine(result.line);
            setScore(prev => ({ ...prev, cpu: prev.cpu + 1 }));
            sounds.lose();
        } else {
            setResultText('═ DRAW'); setResultType('draw');
            setScore(prev => ({ ...prev, draws: prev.draws + 1 }));
            sounds.draw();
        }
    };

    const resetGame = () => {
        setBoard(Array(9).fill(null));
        setIsPlayerTurn(true); setGameOver(false);
        setWinLine(null); setResultText(''); setResultType('');
        setCpuThinking(false);
    };

    const resetAll = () => { resetGame(); setScore({ player: 0, cpu: 0, draws: 0 }); };

    const renderCell = (index) => {
        const value = board[index];
        const isWinCell = winLine && winLine.includes(index);
        const isEmpty = !value && !gameOver;
        const isHovered = hoveredCell === index && isEmpty && isPlayerTurn && !cpuThinking;
        return (
            <button
                key={index}
                style={{
                    ...st.cell,
                    ...(isHovered ? st.cellHover : {}),
                    ...(isWinCell ? st.cellWin : {}),
                    cursor: isEmpty && isPlayerTurn && !cpuThinking ? 'pointer' : 'default',
                }}
                onClick={() => handleCellClick(index)}
                onMouseEnter={() => setHoveredCell(index)}
                onMouseLeave={() => setHoveredCell(null)}
            >
                {value === 'X' && (
                    <X size={48} strokeWidth={3} color="#fb7185"
                        style={{ filter: 'drop-shadow(0 0 10px rgba(251,113,133,0.8)) drop-shadow(0 0 20px rgba(251,113,133,0.4))', animation: 'tttPop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
                    />
                )}
                {value === 'O' && (
                    <Circle size={44} strokeWidth={3} color="#22d3ee"
                        style={{ filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.8)) drop-shadow(0 0 20px rgba(34,211,238,0.4))', animation: 'tttPop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
                    />
                )}
                {isHovered && !value && (
                    <X size={48} strokeWidth={3} color="rgba(251,113,133,0.15)" />
                )}
            </button>
        );
    };

    const statusColor = resultType === 'win' ? '#39d98a' : resultType === 'lose' ? '#ff4f7b' : resultType === 'draw' ? '#ffca40' : 'rgba(240,240,245,0.55)';
    const statusBg = resultType === 'win' ? 'rgba(57,217,138,0.12)' : resultType === 'lose' ? 'rgba(255,79,123,0.12)' : resultType === 'draw' ? 'rgba(255,202,64,0.12)' : '#1e1e24';
    const statusBorder = resultType === 'win' ? '#39d98a' : resultType === 'lose' ? '#ff4f7b' : resultType === 'draw' ? '#ffca40' : 'rgba(255,255,255,0.08)';
    const currentStatus = gameOver ? resultText : cpuThinking ? '● CPU is thinking…' : '● Your turn — place X';

    return (
        <div style={st.container}>
            <div style={st.header}>
                <button style={st.headerBtn} onClick={onBackToLobby}>
                    <ArrowLeft size={16} style={{ marginRight: 6 }} /> Lobby
                </button>
                <div style={st.modeBadge}>VS CPU</div>
                <button style={st.headerBtn} onClick={resetAll}>
                    <RotateCcw size={14} style={{ marginRight: 6 }} /> Reset
                </button>
            </div>

            <div style={st.scoreboard}>
                <div style={st.scoreBlock}>
                    <span style={st.scoreLabel}>YOU (X)</span>
                    <span style={{ ...st.scoreNum, color: '#fb7185' }}>{score.player}</span>
                </div>
                <div style={st.scoreCenter}>
                    <div style={st.drawsBadge}>Draws: {score.draws}</div>
                    <div style={{ position: 'relative' }}>
                        <button style={st.diffBtn} onClick={() => setShowDiffMenu(!showDiffMenu)}>
                            {difficulty === 'hard' ? 'Hard' : 'Easy'}
                            <ChevronDown size={14} style={{ marginLeft: 4, opacity: 0.5 }} />
                        </button>
                        {showDiffMenu && (
                            <div style={st.diffMenu}>
                                <button
                                    style={{ ...st.diffOption, ...(difficulty === 'easy' ? st.diffOptionActive : {}) }}
                                    onClick={() => { setDifficulty('easy'); setShowDiffMenu(false); resetGame(); }}
                                >
                                    Easy — Random moves
                                </button>
                                <button
                                    style={{ ...st.diffOption, ...(difficulty === 'hard' ? st.diffOptionActive : {}) }}
                                    onClick={() => { setDifficulty('hard'); setShowDiffMenu(false); resetGame(); }}
                                >
                                    Hard — Unbeatable AI
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div style={st.scoreBlock}>
                    <span style={st.scoreLabel}>CPU (O)</span>
                    <span style={{ ...st.scoreNum, color: '#22d3ee' }}>{score.cpu}</span>
                </div>
            </div>

            <div style={{ ...st.statusBanner, background: statusBg, borderColor: statusBorder }}>
                <span style={{ ...st.statusText, color: statusColor }}>{currentStatus}</span>
            </div>

            <div style={st.boardContainer}>
                <div style={st.board}>
                    {winLine && <div style={getStrikeStyle(winLine)} />}
                    {board.map((_, i) => renderCell(i))}
                </div>
            </div>

            {gameOver && (
                <div style={st.playAgainWrap}>
                    <button style={st.playAgainBtn} onClick={resetGame}>Play Again</button>
                </div>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════
// MAIN TicTacToe — mode router
// ═══════════════════════════════════════════════════
const TicTacToe = ({ onBack }) => {
    const [mode, setMode] = useState('lobby'); // 'lobby' | 'cpu' | 'friends'

    if (mode === 'cpu') {
        return <CPUGameView onBack={onBack} onBackToLobby={() => setMode('lobby')} />;
    }
    if (mode === 'friends') {
        return <FriendPickerView onBack={onBack} onBackToLobby={() => setMode('lobby')} />;
    }
    return (
        <LobbyView
            onBack={onBack}
            onSelectCPU={() => setMode('cpu')}
            onSelectMultiplayer={() => setMode('friends')}
        />
    );
};


// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const st = {
    container: {
        flex: 1, display: 'flex', flexDirection: 'column',
        background: '#0d0d0f', overflow: 'auto', fontFamily: "'Inter', sans-serif",
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#16161a', flexShrink: 0,
    },
    headerBtn: {
        display: 'flex', alignItems: 'center',
        fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.14)', background: '#1e1e24',
        color: 'rgba(240,240,245,0.55)', cursor: 'pointer', transition: 'all 0.2s',
    },
    modeBadge: {
        fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: '#e8ff47', background: 'rgba(232,255,71,0.1)',
        padding: '6px 14px', borderRadius: 99, border: '1px solid rgba(232,255,71,0.3)',
    },
    scoreboard: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px', background: '#16161a',
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
    },
    scoreBlock: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 80 },
    scoreLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,240,245,0.55)' },
    scoreNum: { fontSize: 42, fontWeight: 800, fontFamily: "'DM Mono', monospace", lineHeight: 1 },
    scoreCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
    drawsBadge: { fontSize: 11, color: 'rgba(240,240,245,0.3)', fontFamily: 'monospace' },
    diffBtn: {
        display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600,
        padding: '5px 12px', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)', background: '#1e1e24',
        color: 'rgba(240,240,245,0.6)', cursor: 'pointer', transition: 'all 0.2s',
    },
    diffMenu: {
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
        marginTop: 6, background: '#1e1e24', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12, padding: 4, zIndex: 50, minWidth: 200,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
    },
    diffOption: {
        display: 'block', width: '100%', padding: '10px 14px', fontSize: 12, fontWeight: 600,
        color: 'rgba(240,240,245,0.6)', background: 'transparent', border: 'none',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
    },
    diffOptionActive: { background: 'rgba(232,255,71,0.08)', color: '#e8ff47' },
    statusBanner: {
        textAlign: 'center', padding: '12px 16px',
        borderBottom: '1px solid', borderTop: 'none',
        flexShrink: 0, transition: 'all 0.3s ease',
    },
    statusText: { fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' },
    boardContainer: {
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', background: '#0d0d0f',
    },
    board: {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
        width: 'min(380px, 80vw)', height: 'min(380px, 80vw)',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20, padding: 8, position: 'relative', backdropFilter: 'blur(8px)',
    },
    cell: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(22,22,26,0.8)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, transition: 'all 0.2s ease', outline: 'none', color: 'inherit', aspectRatio: '1',
    },
    cellHover: {
        background: 'rgba(251,113,133,0.04)', borderColor: 'rgba(251,113,133,0.15)',
        boxShadow: '0 0 16px rgba(251,113,133,0.08)',
    },
    cellWin: { background: 'rgba(232,255,71,0.04)', borderColor: 'rgba(232,255,71,0.2)' },
    playAgainWrap: { display: 'flex', justifyContent: 'center', padding: '0 24px 24px', background: '#0d0d0f', flexShrink: 0 },
    playAgainBtn: {
        fontSize: 14, fontWeight: 700, padding: '12px 40px', borderRadius: 12,
        border: '1px solid rgba(232,255,71,0.3)', background: 'rgba(232,255,71,0.08)',
        color: '#e8ff47', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.06em',
    },
};

// Lobby styles
const lobby = {
    body: {
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '40px 24px', gap: 16,
    },
    titleWrap: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
    title: { color: '#f0f0f5', fontSize: 26, fontWeight: 800, margin: 0 },
    subtitle: { color: 'rgba(240,240,245,0.4)', fontSize: 14, margin: '0 0 20px' },
    cards: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600, width: '100%' },
    card: {
        position: 'relative', overflow: 'hidden', flex: '1 1 240px', maxWidth: 280,
        background: 'linear-gradient(135deg, rgba(15,15,35,0.95), rgba(25,25,50,0.95))',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20,
        padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 14, cursor: 'pointer', transition: 'all 0.3s ease',
        textAlign: 'center', color: 'inherit', outline: 'none',
    },
    cardGlow: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.6,
    },
    cardIcon: { marginBottom: 4 },
    cardTitle: { color: '#f0f0f5', fontSize: 18, fontWeight: 700 },
    cardDesc: { color: 'rgba(240,240,245,0.4)', fontSize: 13, lineHeight: 1.5 },
    cardBadge: {
        display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700,
        padding: '8px 18px', borderRadius: 20, border: '1px solid', marginTop: 4,
    },
};

// Friend picker styles
const fp = {
    searchWrap: {
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
        background: '#16161a', borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    searchInput: {
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        color: '#f0f0f5', fontSize: 14, fontFamily: 'inherit',
    },
    list: {
        flex: 1, overflow: 'auto', padding: '8px 12px',
    },
    empty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, padding: '60px 20px',
    },
    emptyText: { color: 'rgba(240,240,245,0.25)', fontSize: 13 },
    friendRow: {
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 14, border: '1px solid transparent', background: 'transparent',
        cursor: 'pointer', transition: 'all 0.15s ease', width: '100%',
        color: 'inherit', textAlign: 'left', outline: 'none',
    },
    avatar: {
        position: 'relative', width: 40, height: 40, borderRadius: 20,
        background: 'rgba(124,58,237,0.2)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
    },
    avatarImg: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 20 },
    avatarLetter: { color: '#fff', fontSize: 16, fontWeight: 700 },
    onlineDot: {
        position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
        borderRadius: 6, background: '#39d98a', border: '2px solid #16161a',
    },
    friendInfo: { flex: 1, minWidth: 0 },
    friendName: { color: '#f0f0f5', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    friendUsername: { color: 'rgba(240,240,245,0.3)', fontSize: 12 },
    challengeBtn: {
        display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700,
        padding: '7px 14px', borderRadius: 10, flexShrink: 0,
        border: '1px solid rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.1)',
        color: '#22d3ee', transition: 'all 0.2s',
    },
};

// Waiting state styles
const waiting = {
    body: {
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '40px 24px', gap: 16,
    },
    iconRing: {
        width: 80, height: 80, borderRadius: 40,
        border: '2px solid rgba(34,211,238,0.3)',
        background: 'rgba(34,211,238,0.06)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    title: { color: '#f0f0f5', fontSize: 22, fontWeight: 800, margin: 0 },
    subtitle: { color: 'rgba(240,240,245,0.45)', fontSize: 14, margin: 0, textAlign: 'center', lineHeight: 1.6 },
    timerRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
    timerText: { color: 'rgba(240,240,245,0.25)', fontSize: 12, fontFamily: 'monospace' },
    backBtn: {
        display: 'flex', alignItems: 'center', marginTop: 20, fontSize: 13, fontWeight: 600,
        padding: '10px 22px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)', background: '#1e1e24',
        color: 'rgba(240,240,245,0.5)', cursor: 'pointer', transition: 'all 0.2s',
    },
};

// Inject keyframes
if (typeof document !== 'undefined' && !document.querySelector('[data-ttt-styles]')) {
    const tag = document.createElement('style');
    tag.setAttribute('data-ttt-styles', '');
    tag.textContent = `
        @keyframes tttPop {
            0% { transform: scale(0) rotate(-15deg); opacity: 0; }
            60% { transform: scale(1.2) rotate(3deg); }
            100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes tttStrike {
            0% { transform-origin: 0 50%; transform: scaleX(0) rotate(var(--angle, 0deg)); opacity: 0; }
            100% { transform-origin: 0 50%; opacity: 1; }
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(tag);
}

export default TicTacToe;
