import React, { useEffect, useState } from 'react';
import { useQuestStore } from '../../store/questStore';
import { useAuthStore } from '../../store/authStore';
import { Trophy, Gift, Sparkles, CheckCircle, Clock, ChevronRight, Copy, Check, MessageSquare, MessagesSquare, Users, UserCircle, Sun, Zap, Compass } from 'lucide-react';

const QUEST_ICON_MAP = {
    MessageSquare: MessageSquare,
    MessagesSquare: MessagesSquare,
    Users: Users,
    UserCircle: UserCircle,
    Sun: Sun,
    Zap: Zap,
    Compass: Compass,
};

const CATEGORY_COLORS = {
    engagement: { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6', icon: '#a78bfa' },
    growth: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', icon: '#4ade80' },
    profile: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', icon: '#60a5fa' },
    retention: { bg: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24', icon: '#fcd34d' },
};

const QuestCard = ({ quest, onClaim, isClaiming }) => {
    const colors = CATEGORY_COLORS[quest.category] || CATEGORY_COLORS.engagement;
    const progressPercent = quest.requirement_value > 0
        ? Math.min((quest.current_progress / quest.requirement_value) * 100, 100)
        : 0;

    const getStatusBadge = () => {
        if (quest.claimed) {
            return (
                <span style={styles.badge.claimed}>
                    <CheckCircle size={12} style={{ marginRight: 4 }} />
                    Claimed
                </span>
            );
        }
        if (quest.is_completed) {
            return (
                <span style={styles.badge.ready}>
                    <Gift size={12} style={{ marginRight: 4 }} />
                    Ready!
                </span>
            );
        }
        return (
            <span style={styles.badge.inProgress}>
                <Clock size={12} style={{ marginRight: 4 }} />
                In Progress
            </span>
        );
    };

    return (
        <div style={{
            ...styles.questCard,
            borderColor: quest.is_completed && !quest.claimed ? colors.border : 'rgba(255,255,255,0.06)',
            boxShadow: quest.is_completed && !quest.claimed
                ? `0 0 20px ${colors.border}33, 0 4px 16px rgba(0,0,0,0.3)`
                : '0 4px 16px rgba(0,0,0,0.3)',
            opacity: quest.claimed && !quest.is_repeatable ? 0.6 : 1,
        }}>
            {/* Quest Header */}
            <div style={styles.questHeader}>
                <div style={{ ...styles.questIconWrap, background: colors.bg }}>
                    {(() => { const Icon = QUEST_ICON_MAP[quest.icon]; return Icon ? <Icon size={24} style={{ color: colors.icon }} /> : <span style={{ fontSize: 24 }}>{quest.icon}</span>; })()}
                </div>
                <div style={styles.questInfo}>
                    <div style={styles.questTitleRow}>
                        <h3 style={styles.questName}>{quest.name}</h3>
                        {getStatusBadge()}
                    </div>
                    <p style={styles.questDesc}>{quest.description}</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div style={styles.progressSection}>
                <div style={styles.progressBarBg}>
                    <div style={{
                        ...styles.progressBarFill,
                        width: `${progressPercent}%`,
                        background: quest.is_completed
                            ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                            : `linear-gradient(90deg, ${colors.border}, ${colors.icon})`,
                    }} />
                </div>
                <div style={styles.progressLabels}>
                    <span style={styles.progressText}>
                        {quest.requirement_type === 'has_uploaded_avatar'
                            ? (quest.current_progress >= 1 ? 'Completed' : 'Not yet')
                            : quest.requirement_type === 'daily_login'
                                ? (quest.is_completed ? 'Ready to claim' : 'Log in today')
                                : `${quest.current_progress} / ${quest.requirement_value}`
                        }
                    </span>
                    <span style={styles.rewardText}>
                        <Sparkles size={14} style={{ color: '#fbbf24', marginRight: 4 }} />
                        {quest.reward_shards} Shards
                    </span>
                </div>
            </div>

            {/* Claim Button */}
            {quest.is_completed && !quest.claimed && (
                <button
                    style={{
                        ...styles.claimButton,
                        opacity: isClaiming ? 0.7 : 1,
                        cursor: isClaiming ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => onClaim(quest.id)}
                    disabled={isClaiming}
                >
                    <Gift size={16} style={{ marginRight: 6 }} />
                    {isClaiming ? 'Claiming...' : `Claim +${quest.reward_shards} Shards`}
                    {!isClaiming && <ChevronRight size={16} style={{ marginLeft: 4 }} />}
                </button>
            )}

            {/* Repeatable Badge */}
            {quest.is_repeatable && (
                <div style={styles.repeatableBadge}>
                    ↻ Repeatable (24h cooldown)
                </div>
            )}
        </div>
    );
};

const QuestsPanel = () => {
    const { quests, isLoading, error, fetchQuests, claimQuest, claimingQuestId } = useQuestStore();
    const user = useAuthStore(state => state.user);
    const [filter, setFilter] = useState('all');
    const [claimFeedback, setClaimFeedback] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleCopyCode = () => {
        if (user?.invite_code) {
            navigator.clipboard.writeText(user.invite_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    useEffect(() => {
        fetchQuests();
    }, [fetchQuests]);

    const handleClaim = async (questId) => {
        const result = await claimQuest(questId);
        if (result.success) {
            setClaimFeedback(`+${result.shards_earned} Aether Shards earned!`);
            setTimeout(() => setClaimFeedback(null), 3000);
            // Refresh quests to get updated progress
            fetchQuests();
        } else {
            setClaimFeedback(result.error || 'Failed to claim');
            setTimeout(() => setClaimFeedback(null), 3000);
        }
    };

    const categories = ['all', 'engagement', 'growth', 'profile', 'retention'];
    const categoryLabels = {
        all: '⚔️ All Quests',
        engagement: '💬 Engagement',
        growth: '🌱 Growth',
        profile: '🎭 Profile',
        retention: '☀️ Retention',
    };

    const filteredQuests = filter === 'all' ? quests : quests.filter(q => q.category === filter);

    // Stats
    const completed = quests.filter(q => q.claimed).length;
    const totalOneTime = quests.filter(q => !q.is_repeatable).length;

    if (isLoading && quests.length === 0) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner} />
                <p style={styles.loadingText}>Loading Quests...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <Trophy size={24} style={{ color: '#fbbf24' }} />
                    <h2 style={styles.headerTitle}>Nexus Quests</h2>
                </div>
                <div style={styles.headerStats}>
                    <span style={styles.statBadge}>
                        {completed}/{totalOneTime} Completed
                    </span>
                </div>
            </div>

            {/* Invite Code Banner */}
            {user?.invite_code && (
                <div style={styles.inviteBanner}>
                    <div style={styles.inviteBannerLeft}>
                        <span style={{ fontSize: 20 }}>🦋</span>
                        <div>
                            <div style={styles.inviteLabel}>Your Invite Code</div>
                            <div style={styles.inviteDesc}>Share this code with friends to earn 500 Shards!</div>
                        </div>
                    </div>
                    <button style={styles.inviteCodeBtn} onClick={handleCopyCode}>
                        <span style={styles.inviteCodeText}>{user.invite_code}</span>
                        {copied
                            ? <Check size={14} style={{ color: '#4ade80', marginLeft: 8, flexShrink: 0 }} />
                            : <Copy size={14} style={{ color: '#9ca3af', marginLeft: 8, flexShrink: 0 }} />
                        }
                    </button>
                </div>
            )}

            {/* Claim Feedback Toast */}
            {claimFeedback && (
                <div style={styles.toast}>
                    <Sparkles size={16} style={{ color: '#fbbf24', marginRight: 8 }} />
                    {claimFeedback}
                </div>
            )}

            {/* Category Filters */}
            <div style={styles.filterRow}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        style={{
                            ...styles.filterButton,
                            ...(filter === cat ? styles.filterButtonActive : {}),
                        }}
                        onClick={() => setFilter(cat)}
                    >
                        {categoryLabels[cat]}
                    </button>
                ))}
            </div>

            {/* Quest List */}
            {error && (
                <div style={styles.errorBox}>
                    <p>{error}</p>
                    <button style={styles.retryBtn} onClick={fetchQuests}>Retry</button>
                </div>
            )}

            <div style={styles.questGrid}>
                {filteredQuests.map(quest => (
                    <QuestCard
                        key={quest.id}
                        quest={quest}
                        onClaim={handleClaim}
                        isClaiming={claimingQuestId === quest.id}
                    />
                ))}
            </div>

            {filteredQuests.length === 0 && !isLoading && (
                <div style={styles.emptyState}>
                    <Trophy size={48} style={{ color: '#4b5563', marginBottom: 12 }} />
                    <p style={{ color: '#6b7280' }}>No quests in this category</p>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        padding: '0 4px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        padding: '16px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        margin: 0,
        background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    headerStats: {
        display: 'flex',
        gap: 8,
    },
    statBadge: {
        background: 'rgba(251, 191, 36, 0.12)',
        color: '#fbbf24',
        fontSize: 13,
        fontWeight: '600',
        padding: '6px 14px',
        borderRadius: 20,
        border: '1px solid rgba(251, 191, 36, 0.2)',
    },
    toast: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 12,
        padding: '12px 20px',
        marginBottom: 16,
        color: '#4ade80',
        fontWeight: '600',
        fontSize: 14,
        animation: 'fadeIn 0.3s ease',
    },
    filterRow: {
        display: 'flex',
        gap: 6,
        marginBottom: 20,
        flexWrap: 'wrap',
    },
    filterButton: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '8px 16px',
        color: '#9ca3af',
        fontSize: 12,
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
    },
    filterButtonActive: {
        background: 'rgba(139, 92, 246, 0.15)',
        borderColor: '#8b5cf6',
        color: '#a78bfa',
    },
    questGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    questCard: {
        background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.95), rgba(20, 20, 45, 0.95))',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '20px',
        transition: 'all 0.3s ease',
    },
    questHeader: {
        display: 'flex',
        gap: 14,
        marginBottom: 16,
    },
    questIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    questInfo: {
        flex: 1,
        minWidth: 0,
    },
    questTitleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 4,
        flexWrap: 'wrap',
    },
    questName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        margin: 0,
    },
    questDesc: {
        color: '#9ca3af',
        fontSize: 13,
        margin: 0,
        lineHeight: 1.4,
    },
    badge: {
        claimed: {
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#4ade80',
            fontSize: 11,
            fontWeight: '600',
            padding: '3px 10px',
            borderRadius: 12,
        },
        ready: {
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(251, 191, 36, 0.15)',
            color: '#fbbf24',
            fontSize: 11,
            fontWeight: '600',
            padding: '3px 10px',
            borderRadius: 12,
            animation: 'pulse 2s infinite',
        },
        inProgress: {
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(139, 92, 246, 0.12)',
            color: '#a78bfa',
            fontSize: 11,
            fontWeight: '600',
            padding: '3px 10px',
            borderRadius: 12,
        },
    },
    progressSection: {
        marginBottom: 12,
    },
    progressBarBg: {
        height: 8,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
        transition: 'width 0.5s ease',
    },
    progressLabels: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressText: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: '500',
    },
    rewardText: {
        display: 'flex',
        alignItems: 'center',
        color: '#fbbf24',
        fontSize: 13,
        fontWeight: '600',
    },
    claimButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        border: 'none',
        borderRadius: 12,
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
        marginTop: 4,
    },
    repeatableBadge: {
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 11,
        marginTop: 8,
        fontStyle: 'italic',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
    },
    spinner: {
        width: 32,
        height: 32,
        border: '3px solid rgba(139, 92, 246, 0.2)',
        borderTopColor: '#8b5cf6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: 12,
    },
    loadingText: {
        color: '#6b7280',
        fontSize: 14,
    },
    errorBox: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: 12,
        padding: '16px',
        textAlign: 'center',
        color: '#ef4444',
        marginBottom: 16,
    },
    retryBtn: {
        marginTop: 8,
        background: 'rgba(239, 68, 68, 0.2)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 8,
        padding: '8px 20px',
        color: '#ef4444',
        fontSize: 13,
        fontWeight: '600',
        cursor: 'pointer',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
    },
    inviteBanner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(16, 185, 129, 0.08))',
        border: '1px solid rgba(34, 197, 94, 0.2)',
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    inviteBannerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    inviteLabel: {
        color: '#4ade80',
        fontSize: 14,
        fontWeight: '700',
    },
    inviteDesc: {
        color: '#6b7280',
        fontSize: 12,
        marginTop: 2,
    },
    inviteCodeBtn: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.06)',
        border: '1px dashed rgba(255,255,255,0.15)',
        borderRadius: 10,
        padding: '10px 16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    inviteCodeText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 2,
        fontFamily: 'monospace',
    },
};

// Add keyframe animations via a style tag
if (typeof document !== 'undefined') {
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    `;
    if (!document.querySelector('[data-quest-styles]')) {
        styleTag.setAttribute('data-quest-styles', '');
        document.head.appendChild(styleTag);
    }
}

export default QuestsPanel;
