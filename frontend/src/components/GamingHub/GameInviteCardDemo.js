import React, { useState } from 'react';
import GameInviteCard from './GameInviteCard';

/**
 * Demo harness — renders all 4 GameInviteCard states side by side.
 * Drop this into any view to visually test, then remove.
 *
 * Usage in any component:
 *   import GameInviteCardDemo from '../GamingHub/GameInviteCardDemo';
 *   <GameInviteCardDemo />
 */
const GameInviteCardDemo = () => {
    const [liveStatus, setLiveStatus] = useState('pending');

    return (
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 440 }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>
                Live Interactive Card
            </h3>
            <GameInviteCard
                challengerName="Shadow"
                gameName="Tic-Tac-Toe"
                wagerText="50 Aether Shards"
                status={liveStatus}
                onAccept={() => setLiveStatus('accepted')}
                onDecline={() => setLiveStatus('declined')}
            />
            {liveStatus !== 'pending' && (
                <button
                    onClick={() => setLiveStatus('pending')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: '#1e1e24',
                        color: '#aaa',
                        fontSize: 12,
                        cursor: 'pointer',
                    }}
                >
                    Reset to Pending
                </button>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' }} />

            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>
                All States Preview
            </h3>

            <GameInviteCard
                challengerName="NeonBlade"
                gameName="Rock Paper Scissors"
                wagerText="100 Aether Shards"
                status="pending"
                onAccept={() => {}}
                onDecline={() => {}}
            />
            <GameInviteCard
                challengerName="CyberPhantom"
                gameName="Tic-Tac-Toe"
                wagerText="25 Aether Shards"
                status="accepted"
            />
            <GameInviteCard
                challengerName="Starfall"
                gameName="Rock Paper Scissors"
                wagerText=""
                status="declined"
            />
            <GameInviteCard
                challengerName="GhostWalker"
                gameName="Tic-Tac-Toe"
                wagerText="10 Aether Shards"
                status="expired"
            />
        </div>
    );
};

export default GameInviteCardDemo;
