import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, RotateCcw, Hexagon, FileText, Scissors, HelpCircle, Loader, Wifi } from 'lucide-react';
import { chatSocket } from '../../services/socket';
import { toast } from 'react-hot-toast';

// ── SOUND ENGINE (Web Audio API — no files needed) ──
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
        select: () => {
            tone({ freq: 880, type: 'sine', vol: 0.2, dur: 0.1 });
            setTimeout(() => tone({ freq: 1100, type: 'sine', vol: 0.15, dur: 0.08 }), 60);
        },
        win: () => {
            [523, 659, 784, 1047].forEach((f, i) =>
                setTimeout(() => tone({ freq: f, vol: 0.25, dur: 0.2, type: 'triangle' }), i * 80)
            );
        },
        lose: () => {
            tone({ freq: 330, type: 'sawtooth', vol: 0.2, dur: 0.15 });
            setTimeout(() => tone({ freq: 220, type: 'sawtooth', vol: 0.2, dur: 0.2 }), 100);
            setTimeout(() => tone({ freq: 165, type: 'sawtooth', vol: 0.15, dur: 0.3 }), 200);
        },
        draw: () => {
            tone({ freq: 440, type: 'sine', vol: 0.18, dur: 0.25 });
        },
    };
};

// ── ICON CONFIG ──
const MOVE_ICON_CONFIG = {
    rock:     { Icon: Hexagon,  color: '#c084fc', glow: 'drop-shadow(0 0 10px rgba(168,85,247,0.8)) drop-shadow(0 0 20px rgba(168,85,247,0.4))' },
    paper:    { Icon: FileText, color: '#22d3ee', glow: 'drop-shadow(0 0 10px rgba(34,211,238,0.8)) drop-shadow(0 0 20px rgba(34,211,238,0.4))' },
    scissors: { Icon: Scissors, color: '#fb7185', glow: 'drop-shadow(0 0 10px rgba(251,113,133,0.8)) drop-shadow(0 0 20px rgba(251,113,133,0.4))' },
};

const MoveIcon = ({ move, size = 34 }) => {
    if (!move || move === 'waiting') return <HelpCircle size={size} color="rgba(240,240,245,0.3)" />;
    if (move === 'thinking') return <Loader size={size} color="rgba(240,240,245,0.4)" style={{ animation: 'rpsSpin 1s linear infinite' }} />;
    const config = MOVE_ICON_CONFIG[move];
    if (!config) return null;
    const { Icon, color, glow } = config;
    return <Icon size={size} color={color} style={{ filter: glow, transition: 'all 0.3s ease' }} />;
};

// ── GAME LOGIC ──
const MOVES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

const getResult = (p1, p2) => {
    if (p1 === p2) return 'draw';
    return BEATS[p1] === p2 ? 'win' : 'lose';
};

const getCpuMove = () => MOVES[Math.floor(Math.random() * 3)];

const delay = (ms) => new Promise(r => setTimeout(r, ms));


// ═══════════════════════════════════════════════════
// MULTIPLAYER RPS VIEW — Real-time 2-player via Socket.IO
// ═══════════════════════════════════════════════════
const MultiplayerRPSView = ({ session, onBack }) => {
    const soundsRef = useRef(null);
    if (!soundsRef.current) soundsRef.current = createSoundEngine();
    const sounds = soundsRef.current;

    const [score, setScore] = useState({ me: 0, them: 0, draws: 0 });
    const [round, setRound] = useState(1);
    const [myMove, setMyMove] = useState(null);       // my chosen move
    const [theirMove, setTheirMove] = useState(null);  // from socket
    const [p1Choice, setP1Choice] = useState({ move: 'waiting', name: 'Waiting…', state: '' });
    const [p2Choice, setP2Choice] = useState({ move: 'waiting', name: 'Waiting…', state: '' });
    const [resultText, setResultText] = useState('Make your move!');
    const [resultClass, setResultClass] = useState('');
    const [locked, setLocked] = useState(false);
    const [selectedMove, setSelectedMove] = useState(null);
    const [flashClass, setFlashClass] = useState('');
    const [recentRounds, setRecentRounds] = useState([]);

    const myMoveRef = useRef(null);
    const theirMoveRef = useRef(null);

    const capitalize = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

    // Resolve round when both moves are in
    const resolveRound = useCallback((mine, theirs) => {
        const result = getResult(mine, theirs);
        const myState = result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'draw';
        const theirState = result === 'lose' ? 'win' : result === 'win' ? 'lose' : 'draw';

        setP1Choice({ move: mine, name: capitalize(mine), state: myState });
        setP2Choice({ move: theirs, name: capitalize(theirs), state: theirState });

        const resultTexts = { win: '▲ YOU WIN', lose: '▼ YOU LOSE', draw: '═ DRAW' };
        setResultText(resultTexts[result]);
        setResultClass(result);

        if (result === 'win') sounds.win();
        else if (result === 'lose') sounds.lose();
        else sounds.draw();

        setFlashClass(result);
        setTimeout(() => setFlashClass(''), 400);

        setScore(prev => ({
            me: prev.me + (result === 'win' ? 1 : 0),
            them: prev.them + (result === 'lose' ? 1 : 0),
            draws: prev.draws + (result === 'draw' ? 1 : 0),
        }));

        setRecentRounds(prev => [
            { p1: mine, p2: theirs, result, round },
            ...prev,
        ].slice(0, 5));

        setRound(r => r + 1);

        // Unlock after brief delay
        setTimeout(() => {
            setSelectedMove(null);
            setLocked(false);
            setMyMove(null);
            setTheirMove(null);
            myMoveRef.current = null;
            theirMoveRef.current = null;
        }, 1200);
    }, [round, sounds]);

    // Socket setup
    useEffect(() => {
        if (!chatSocket) return;

        chatSocket.emit('game_join_room', { game_room_id: session.gameRoomId });

        const handleMoveMade = (data) => {
            if (data.game_room_id !== session.gameRoomId) return;
            const opponentMove = data.move_type;
            if (!opponentMove) return;

            theirMoveRef.current = opponentMove;
            setTheirMove(opponentMove);

            // If I've already moved, resolve now
            if (myMoveRef.current) {
                resolveRound(myMoveRef.current, opponentMove);
            }
        };

        const handlePlayerLeft = (data) => {
            if (data.game_room_id === session.gameRoomId) {
                toast.error(`${data.username} left the game`);
            }
        };

        chatSocket.on('game:move_made', handleMoveMade);
        chatSocket.on('game:player_left', handlePlayerLeft);

        return () => {
            chatSocket.off('game:move_made', handleMoveMade);
            chatSocket.off('game:player_left', handlePlayerLeft);
            chatSocket.emit('game_leave', { game_room_id: session.gameRoomId });
        };
    }, [session.gameRoomId]); // eslint-disable-line

    const handleMove = (move) => {
        if (locked) return;
        setLocked(true);
        setSelectedMove(move);
        setMyMove(move);
        myMoveRef.current = move;
        sounds.select();

        // Show thinking states
        setP1Choice({ move: 'thinking', name: 'Locked In!', state: '' });
        setP2Choice({ move: 'thinking', name: `Waiting for ${session.theirName}…`, state: '' });
        setResultText('Waiting for opponent…');
        setResultClass('');

        // Send move to opponent
        if (chatSocket) {
            chatSocket.emit('game_move', {
                game_room_id: session.gameRoomId,
                move_type: move,
            });
        }

        // If opponent already moved, resolve
        if (theirMoveRef.current) {
            setTimeout(() => resolveRound(move, theirMoveRef.current), 400);
        }
    };

    const handleLeaveGame = () => {
        if (chatSocket) {
            chatSocket.emit('game_leave', { game_room_id: session.gameRoomId });
        }
        onBack();
    };

    return (
        <div style={s.container}>
            {/* Flash overlay */}
            {flashClass && (
                <div style={{
                    ...s.flashOverlay,
                    background: flashClass === 'win' ? 'rgba(57,217,138,0.15)'
                        : flashClass === 'lose' ? 'rgba(255,79,123,0.15)'
                        : 'rgba(255,202,64,0.1)',
                }} />
            )}

            {/* Header */}
            <div style={s.header}>
                <button style={s.headerBtn} onClick={handleLeaveGame}>
                    <ArrowLeft size={16} style={{ marginRight: 6 }} /> Leave
                </button>
                <div style={{ ...s.modeBadge, background: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.3)', color: '#22d3ee' }}>
                    <Wifi size={12} style={{ marginRight: 6 }} /> VS {session.theirName}
                </div>
                <div style={{ width: 80 }} />
            </div>

            {/* Scoreboard */}
            <div style={s.scoreboard}>
                <div style={s.scoreBlock}>
                    <span style={s.scoreLabel}>{session.myName}</span>
                    <span style={{ ...s.scoreNum, color: '#c084fc' }}>{score.me}</span>
                </div>
                <div style={s.scoreCenter}>
                    <span style={s.drawsBadge}>Draws: {score.draws}</span>
                    <span style={s.roundBadge}>Round {round}</span>
                </div>
                <div style={s.scoreBlock}>
                    <span style={s.scoreLabel}>{session.theirName}</span>
                    <span style={{ ...s.scoreNum, color: '#fb7185' }}>{score.them}</span>
                </div>
            </div>

            {/* Arena */}
            <div style={s.arena}>
                <div style={s.arenaSide}>
                    <div style={{
                        ...s.choiceDisplay,
                        borderColor: p1Choice.state === 'win' ? '#39d98a' : p1Choice.state === 'lose' ? '#ff4f7b' : 'rgba(255,255,255,0.08)',
                        boxShadow: p1Choice.state === 'win' ? '0 0 24px rgba(57,217,138,0.3)' : 'none',
                    }}>
                        <MoveIcon move={p1Choice.move} size={40} />
                        <span style={s.choiceName}>{p1Choice.name}</span>
                        <span style={s.choiceSub}>You</span>
                    </div>
                </div>

                <div style={s.arenaVs}>
                    <span style={s.vsText}>VS</span>
                    <div style={{
                        ...s.resultBanner,
                        borderColor: resultClass === 'win' ? '#39d98a' : resultClass === 'lose' ? '#ff4f7b' : resultClass === 'draw' ? '#ffca40' : 'rgba(255,255,255,0.08)',
                        background: resultClass === 'win' ? 'rgba(57,217,138,0.12)' : resultClass === 'lose' ? 'rgba(255,79,123,0.12)' : resultClass === 'draw' ? 'rgba(255,202,64,0.12)' : '#1e1e24',
                    }}>
                        <span style={{
                            ...s.resultText,
                            color: resultClass === 'win' ? '#39d98a' : resultClass === 'lose' ? '#ff4f7b' : resultClass === 'draw' ? '#ffca40' : 'rgba(240,240,245,0.35)',
                        }}>{resultText}</span>
                    </div>
                </div>

                <div style={s.arenaSide}>
                    <div style={{
                        ...s.choiceDisplay,
                        borderColor: p2Choice.state === 'win' ? '#39d98a' : p2Choice.state === 'lose' ? '#ff4f7b' : 'rgba(255,255,255,0.08)',
                        boxShadow: p2Choice.state === 'win' ? '0 0 24px rgba(57,217,138,0.3)' : 'none',
                    }}>
                        <MoveIcon move={p2Choice.move} size={40} />
                        <span style={s.choiceName}>{p2Choice.name}</span>
                        <span style={s.choiceSub}>{session.theirName}</span>
                    </div>
                </div>
            </div>

            {/* Move Buttons */}
            <div style={s.moveButtons}>
                {MOVES.map(move => (
                    <button
                        key={move}
                        style={{
                            ...s.moveBtn,
                            ...(selectedMove === move ? s.moveBtnSelected : {}),
                            ...(locked ? s.moveBtnDisabled : {}),
                        }}
                        onClick={() => handleMove(move)}
                        disabled={locked}
                    >
                        <MoveIcon move={move} size={28} />
                        <span style={s.moveName}>{capitalize(move)}</span>
                    </button>
                ))}
            </div>

            {/* Recent Rounds */}
            {recentRounds.length > 0 && (
                <div style={s.historyWrap}>
                    <div style={s.historyTitle}>Recent Rounds</div>
                    {recentRounds.map((r, i) => (
                        <div key={i} style={s.historyRow}>
                            <span style={s.historyRound}>R{r.round}</span>
                            <MoveIcon move={r.p1} size={16} />
                            <span style={s.historyVs}>vs</span>
                            <MoveIcon move={r.p2} size={16} />
                            <span style={{
                                ...s.historyResult,
                                color: r.result === 'win' ? '#39d98a' : r.result === 'lose' ? '#ff4f7b' : '#ffca40',
                            }}>
                                {r.result === 'win' ? 'Won' : r.result === 'lose' ? 'Lost' : 'Draw'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const RockPaperScissors = ({ onBack, multiplayerSession }) => {
    // If launched with a multiplayer session (from game:start), go straight to multiplayer
    if (multiplayerSession) {
        return <MultiplayerRPSView session={multiplayerSession} onBack={onBack} />;
    }

    const soundsRef = useRef(null);
    if (!soundsRef.current) soundsRef.current = createSoundEngine();
    const sounds = soundsRef.current;

    const [score, setScore] = useState({ p1: 0, p2: 0, draws: 0 });
    const [round, setRound] = useState(1);
    const [p1Choice, setP1Choice] = useState({ move: 'waiting', name: 'Waiting…', state: '' });
    const [p2Choice, setP2Choice] = useState({ move: 'waiting', name: 'Waiting…', state: '' });
    const [resultText, setResultText] = useState('Make your move!');
    const [resultClass, setResultClass] = useState('');
    const [locked, setLocked] = useState(false);
    const [selectedMove, setSelectedMove] = useState(null);
    const [recentRounds, setRecentRounds] = useState([]);
    const [flashClass, setFlashClass] = useState('');

    const capitalize = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

    const handleMove = useCallback(async (move) => {
        if (locked) return;
        setLocked(true);
        setSelectedMove(move);
        sounds.select();

        // Thinking state
        setP1Choice({ move: 'thinking', name: 'Thinking…', state: '' });
        setP2Choice({ move: 'thinking', name: 'Thinking…', state: '' });
        setResultText('…');
        setResultClass('');

        await delay(400);

        const cpuMove = getCpuMove();
        const result = getResult(move, cpuMove);
        const p1State = result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'draw';
        const p2State = result === 'lose' ? 'win' : result === 'win' ? 'lose' : 'draw';

        setP1Choice({ move: move, name: capitalize(move), state: p1State });
        setP2Choice({ move: cpuMove, name: capitalize(cpuMove), state: p2State });

        const resultTexts = {
            win: '▲ YOU WIN',
            lose: '▼ YOU LOSE',
            draw: '═ DRAW',
        };
        setResultText(resultTexts[result]);
        setResultClass(result);

        // Sound
        if (result === 'win') sounds.win();
        else if (result === 'lose') sounds.lose();
        else sounds.draw();

        // Flash
        setFlashClass(result);
        setTimeout(() => setFlashClass(''), 400);

        // Score
        setScore(prev => ({
            p1: prev.p1 + (result === 'win' ? 1 : 0),
            p2: prev.p2 + (result === 'lose' ? 1 : 0),
            draws: prev.draws + (result === 'draw' ? 1 : 0),
        }));

        // Recent rounds
        setRecentRounds(prev => [
            { p1: move, p2: cpuMove, result, round },
            ...prev,
        ].slice(0, 5));

        setRound(r => r + 1);

        await delay(600);
        setSelectedMove(null);
        setLocked(false);
    }, [locked, round, sounds]);

    const handleReset = () => {
        setScore({ p1: 0, p2: 0, draws: 0 });
        setRound(1);
        setP1Choice({ move: 'waiting', name: 'Waiting…', state: '' });
        setP2Choice({ move: 'waiting', name: 'Waiting…', state: '' });
        setResultText('Make your move!');
        setResultClass('');
        setRecentRounds([]);
        setSelectedMove(null);
        setLocked(false);
    };

    const stateStyle = (state) => {
        if (state === 'win') return { borderColor: '#39d98a', boxShadow: '0 0 24px rgba(57,217,138,0.3)', background: 'rgba(57,217,138,0.05)' };
        if (state === 'lose') return { borderColor: '#ff4f7b', boxShadow: '0 0 24px rgba(255,79,123,0.3)', background: 'rgba(255,79,123,0.05)' };
        if (state === 'draw') return { borderColor: '#ffca40', boxShadow: '0 0 20px rgba(255,202,64,0.25)' };
        return {};
    };

    const bannerStyle = () => {
        if (resultClass === 'win') return { background: 'rgba(57,217,138,0.12)', borderColor: '#39d98a' };
        if (resultClass === 'lose') return { background: 'rgba(255,79,123,0.12)', borderColor: '#ff4f7b' };
        if (resultClass === 'draw') return { background: 'rgba(255,202,64,0.12)', borderColor: '#ffca40' };
        return {};
    };
    const bannerTextColor = () => {
        if (resultClass === 'win') return '#39d98a';
        if (resultClass === 'lose') return '#ff4f7b';
        if (resultClass === 'draw') return '#ffca40';
        return 'rgba(240,240,245,0.55)';
    };

    const resultBadgeColor = (r) => {
        if (r === 'win') return { background: 'rgba(57,217,138,0.15)', color: '#39d98a' };
        if (r === 'lose') return { background: 'rgba(255,79,123,0.15)', color: '#ff4f7b' };
        return { background: 'rgba(255,202,64,0.15)', color: '#ffca40' };
    };

    return (
        <div style={s.container}>
            {/* Flash Overlay */}
            {flashClass && <div style={{ ...s.flash, ...(flashClass === 'win' ? s.flashWin : flashClass === 'lose' ? s.flashLose : s.flashDraw) }} />}

            {/* Header */}
            <div style={s.header}>
                <button style={s.backBtn} onClick={onBack}>
                    <ArrowLeft size={16} style={{ marginRight: 6 }} /> Back
                </button>
                <div style={s.modeBadge}>vs Computer</div>
                <button style={s.resetBtn} onClick={handleReset}>
                    <RotateCcw size={14} style={{ marginRight: 6 }} /> Reset
                </button>
            </div>

            {/* Scoreboard */}
            <div style={s.scoreboard}>
                <div style={s.scoreBlock}>
                    <span style={s.scoreLabel}>YOU</span>
                    <span style={{ ...s.scoreNum, color: '#39d98a' }}>{score.p1}</span>
                </div>
                <div style={s.scoreCenter}>
                    <div style={s.roundBadge}>Round {round}</div>
                    <div style={s.drawsText}>Draws: {score.draws}</div>
                </div>
                <div style={s.scoreBlock}>
                    <span style={s.scoreLabel}>CPU</span>
                    <span style={{ ...s.scoreNum, color: '#ff4f7b' }}>{score.p2}</span>
                </div>
            </div>

            {/* Arena */}
            <div style={s.arena}>
                <div style={s.arenaSide}>
                    <div style={{ ...s.choiceDisplay, ...stateStyle(p1Choice.state) }}>
                        <div style={s.choiceIconWrap}>
                            <MoveIcon move={p1Choice.move} size={64} />
                        </div>
                        <span style={s.choiceName}>{p1Choice.name}</span>
                    </div>
                </div>

                <div style={s.arenaVs}>
                    <div style={s.vsText}>VS</div>
                    <div style={{ ...s.resultBanner, ...bannerStyle() }}>
                        <span style={{ ...s.resultText, color: bannerTextColor() }}>{resultText}</span>
                    </div>
                </div>

                <div style={s.arenaSide}>
                    <div style={{ ...s.choiceDisplay, ...stateStyle(p2Choice.state) }}>
                        <div style={s.choiceIconWrap}>
                            <MoveIcon move={p2Choice.move} size={64} />
                        </div>
                        <span style={s.choiceName}>{p2Choice.name}</span>
                    </div>
                </div>
            </div>

            {/* Move Buttons */}
            <div style={s.moveButtons}>
                {MOVES.map(move => (
                    <button
                        key={move}
                        style={{
                            ...s.moveBtn,
                            ...(selectedMove === move ? s.moveBtnSelected : {}),
                            ...(locked ? s.moveBtnDisabled : {}),
                        }}
                        onClick={() => handleMove(move)}
                        disabled={locked}
                    >
                        <div style={s.moveBtnIconWrap}>
                            <MoveIcon move={move} size={34} />
                        </div>
                        <span style={s.moveLabel}>{move.toUpperCase()}</span>
                    </button>
                ))}
            </div>

            {/* Recent Rounds */}
            <div style={s.recentRounds}>
                <div style={s.rrTitle}>RECENT ROUNDS</div>
                <div style={s.rrList}>
                    {recentRounds.length === 0 ? (
                        <div style={s.rrEmpty}>No rounds yet — make your move!</div>
                    ) : (
                        recentRounds.map((rr, i) => (
                            <div key={i} style={s.rrItem}>
                                <span style={s.rrNum}>#{rr.round}</span>
                                <span style={s.rrMoves}>
                                    <MoveIcon move={rr.p1} size={20} />
                                    <span style={{ color: 'rgba(240,240,245,0.3)', margin: '0 6px', fontSize: 11 }}>vs</span>
                                    <MoveIcon move={rr.p2} size={20} />
                                </span>
                                <span style={{ ...s.rrResult, ...resultBadgeColor(rr.result) }}>
                                    {rr.result.toUpperCase()}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// ── STYLES ──
const s = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#0d0d0f',
        overflow: 'auto',
        position: 'relative',
        fontFamily: "'Inter', sans-serif",
    },
    flash: {
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 400,
        animation: 'rpsFlash 0.4s ease forwards',
    },
    flashWin: { background: 'rgba(57,217,138,0.08)' },
    flashLose: { background: 'rgba(255,79,123,0.08)' },
    flashDraw: { background: 'rgba(255,202,64,0.08)' },

    // Header
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#16161a',
        flexShrink: 0,
    },
    backBtn: {
        display: 'flex',
        alignItems: 'center',
        fontSize: 13,
        fontWeight: 600,
        padding: '7px 14px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.14)',
        background: '#1e1e24',
        color: 'rgba(240,240,245,0.55)',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    resetBtn: {
        display: 'flex',
        alignItems: 'center',
        fontSize: 13,
        fontWeight: 600,
        padding: '7px 14px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.14)',
        background: '#1e1e24',
        color: 'rgba(240,240,245,0.55)',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    modeBadge: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#e8ff47',
        background: 'rgba(232,255,71,0.1)',
        padding: '6px 14px',
        borderRadius: 99,
        border: '1px solid rgba(232,255,71,0.3)',
    },

    // Scoreboard
    scoreboard: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 32px',
        background: '#16161a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
    },
    scoreBlock: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 80,
    },
    scoreLabel: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'rgba(240,240,245,0.55)',
    },
    scoreNum: {
        fontSize: 42,
        fontWeight: 800,
        fontFamily: "'DM Mono', monospace, monospace",
        lineHeight: 1,
        color: '#f0f0f5',
    },
    scoreCenter: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
    },
    roundBadge: {
        fontSize: 12,
        fontWeight: 700,
        color: '#f0f0f5',
        background: '#26262e',
        padding: '5px 12px',
        borderRadius: 99,
        letterSpacing: '0.05em',
    },
    drawsText: {
        fontSize: 11,
        color: 'rgba(240,240,245,0.3)',
        fontFamily: 'monospace',
    },

    // Arena
    arena: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 10px',
        flexShrink: 0,
        background: '#0d0d0f',
        gap: 12,
        flexWrap: 'wrap',
    },
    arenaSide: {
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
    },
    choiceDisplay: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '16px 8px',
        background: '#16161a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        minWidth: 85,
        maxWidth: 120,
        width: '100%',
        transition: 'all 0.3s ease',
    },
    choiceIconWrap: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 64,
    },
    choiceName: {
        fontSize: 13,
        fontWeight: 600,
        color: 'rgba(240,240,245,0.55)',
        textTransform: 'capitalize',
        letterSpacing: '0.05em',
    },
    arenaVs: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    vsText: {
        fontSize: 16,
        fontWeight: 800,
        color: 'rgba(240,240,245,0.3)',
        letterSpacing: '0.1em',
    },
    resultBanner: {
        minWidth: 90,
        textAlign: 'center',
        padding: '8px 12px',
        borderRadius: 99,
        background: '#1e1e24',
        border: '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.3s ease',
    },
    resultText: {
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.05em',
    },

    // Move Buttons
    moveButtons: {
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '16px',
        flexShrink: 0,
        background: '#0d0d0f',
    },
    moveBtn: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '16px',
        background: '#16161a',
        border: '2px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        minWidth: 85,
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
        color: 'inherit',
    },
    moveBtnSelected: {
        borderColor: '#e8ff47',
        background: 'rgba(232,255,71,0.06)',
        boxShadow: '0 0 24px rgba(232,255,71,0.25)',
    },
    moveBtnDisabled: {
        opacity: 0.4,
        cursor: 'not-allowed',
    },
    moveBtnIconWrap: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 34,
    },
    moveLabel: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'rgba(240,240,245,0.55)',
    },

    // Recent Rounds
    recentRounds: {
        flexShrink: 0,
        padding: '0 24px 20px',
        background: '#0d0d0f',
    },
    rrTitle: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.15em',
        color: 'rgba(240,240,245,0.3)',
        marginBottom: 10,
        paddingLeft: 4,
    },
    rrList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 120,
        overflowY: 'auto',
    },
    rrEmpty: {
        fontSize: 12,
        color: 'rgba(240,240,245,0.3)',
        textAlign: 'center',
        padding: 16,
    },
    rrItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        background: '#16161a',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 12,
    },
    rrNum: {
        fontSize: 10,
        color: 'rgba(240,240,245,0.3)',
        fontFamily: 'monospace',
        minWidth: 20,
        textAlign: 'right',
    },
    rrMoves: {
        display: 'flex',
        alignItems: 'center',
        flex: 1,
    },
    rrResult: {
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.05em',
        padding: '3px 8px',
        borderRadius: 99,
        textTransform: 'uppercase',
    },
};

// Inject keyframes
if (typeof document !== 'undefined' && !document.querySelector('[data-rps-styles]')) {
    const tag = document.createElement('style');
    tag.setAttribute('data-rps-styles', '');
    tag.textContent = `@keyframes rpsFlash { 0% { opacity: 1; } 100% { opacity: 0; } } @keyframes rpsSpin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(tag);
}

export default RockPaperScissors;
