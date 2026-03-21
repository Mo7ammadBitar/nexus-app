import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { paymentsAPI } from '../../services/api';
import PayPalCheckoutButton from '../Shop/PayPalCheckoutButton';
import {
    Crown, Palette, ShieldCheck, Sparkles, Gem,
    Clock, ChevronRight, Zap, Star
} from 'lucide-react';

/**
 * NexusPrimeScreen — Premium subscription page with 3 states:
 *   'none'     → Upsell view with PayPal checkout
 *   'active'   → Active subscriber dashboard
 *   'lifetime' → Lifetime/Founder VIP dashboard
 */
const NexusPrimeScreen = () => {
    const { user } = useAuthStore();

    // Derive initial state from user data
    const getInitialState = () => {
        if (user?.prime_tier === 'lifetime') return 'lifetime';
        if (user?.is_premium) return 'active';
        return 'none';
    };

    const [primeState, setPrimeState] = useState(getInitialState);
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [notification, setNotification] = useState(null);

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // PayPal approval handler — verify with backend, update state
    const handlePayPalApproval = async (orderId) => {
        try {
            const plan = billingCycle === 'monthly' ? 'monthly' : 'yearly';
            await paymentsAPI.verifyElite(orderId, plan);
            setPrimeState('active');
            showNotification('Welcome to Nexus Prime! Your account has been upgraded.', 'success');
        } catch (error) {
            showNotification(
                error.response?.data?.detail || 'Failed to verify purchase. Please contact support.',
                'error'
            );
        }
    };

    const amount = billingCycle === 'monthly' ? '4.99' : '49.90';
    const displayName = user?.display_name || user?.username || 'Champion';

    // ───────────────────────── FEATURE DATA ─────────────────────────
    const features = [
        {
            icon: Palette,
            color: '#a855f7',
            glow: 'rgba(168, 85, 247, 0.35)',
            title: 'Custom Identity',
            desc: 'Personalize your profile with exclusive accent colors, animated auras, and unique name effects.',
        },
        {
            icon: ShieldCheck,
            color: '#10b981',
            glow: 'rgba(16, 185, 129, 0.35)',
            title: 'Ad-Free Realm',
            desc: 'Experience Nexus without interruptions. No ads, no distractions — pure communication.',
        },
        {
            icon: Sparkles,
            color: '#f59e0b',
            glow: 'rgba(245, 158, 11, 0.35)',
            title: 'Elite Status',
            desc: 'Stand out with a premium badge, exclusive relics, and priority access to new features.',
        },
        {
            icon: Gem,
            color: '#6366f1',
            glow: 'rgba(99, 102, 241, 0.35)',
            title: 'Monthly Tribute',
            desc: 'Receive bonus Shards every month to spend in the Ethereal Shop on cosmetics.',
        },
    ];

    // ═══════════════════════════════════════════════════════════════
    //  STATE 1: UPSELL VIEW
    // ═══════════════════════════════════════════════════════════════
    if (primeState === 'none') {
        return (
            <div style={s.root}>
                <style>{`
                    @keyframes primeGlow {
                        0%, 100% { filter: drop-shadow(0 0 20px rgba(168,85,247,0.4)); }
                        50% { filter: drop-shadow(0 0 35px rgba(168,85,247,0.7)); }
                    }
                    @keyframes shimmer {
                        0% { background-position: -200% center; }
                        100% { background-position: 200% center; }
                    }
                    @keyframes float {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-6px); }
                    }
                    .prime-card:hover {
                        border-color: rgba(168,85,247,0.4) !important;
                        box-shadow: 0 0 20px rgba(168,85,247,0.15) !important;
                        transform: translateY(-3px) !important;
                    }
                    .prime-toggle-option {
                        transition: all 0.3s ease;
                    }
                `}</style>

                {/* Notification */}
                {notification && (
                    <div style={{
                        ...s.notification,
                        borderColor: notification.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(168,85,247,0.4)',
                        background: notification.type === 'error'
                            ? 'rgba(239,68,68,0.1)'
                            : 'rgba(168,85,247,0.1)',
                    }}>
                        {notification.type === 'error'
                            ? <ShieldCheck size={16} color="#ef4444" />
                            : <Sparkles size={16} color="#a855f7" />
                        }
                        <span style={{ color: '#e2e8f0', fontSize: 14 }}>{notification.msg}</span>
                    </div>
                )}

                <div style={s.scrollWrap}>
                    {/* ── Hero ── */}
                    <div style={s.heroSection}>
                        <div style={s.heroCrownWrap}>
                            <Crown size={48} color="#a855f7" style={{ animation: 'primeGlow 3s ease-in-out infinite' }} />
                        </div>
                        <h1 style={s.heroTitle}>
                            Unlock the Ultimate<br />
                            <span style={s.heroGradient}>Nexus Experience</span>
                        </h1>
                        <p style={s.heroSubtitle}>
                            Elevate your presence with exclusive perks, premium cosmetics, and an ad-free realm.
                        </p>
                    </div>

                    {/* ── Features Grid ── */}
                    <div style={s.featuresGrid}>
                        {features.map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <div key={i} className="prime-card" style={s.featureCard}>
                                    <div style={{ ...s.iconPlate, background: `radial-gradient(circle, ${f.glow}, transparent 70%)` }}>
                                        <div style={{ ...s.iconCircle, borderColor: `${f.color}55`, boxShadow: `0 0 18px ${f.glow}` }}>
                                            <Icon size={22} color={f.color} />
                                        </div>
                                    </div>
                                    <h3 style={s.featureTitle}>{f.title}</h3>
                                    <p style={s.featureDesc}>{f.desc}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Pricing Toggle ── */}
                    <div style={s.pricingSection}>
                        <div style={s.toggleWrap}>
                            <button
                                className="prime-toggle-option"
                                style={{
                                    ...s.toggleBtn,
                                    ...(billingCycle === 'monthly' ? s.toggleBtnActive : {}),
                                }}
                                onClick={() => setBillingCycle('monthly')}
                            >
                                Monthly
                            </button>
                            <button
                                className="prime-toggle-option"
                                style={{
                                    ...s.toggleBtn,
                                    ...(billingCycle === 'yearly' ? s.toggleBtnActive : {}),
                                }}
                                onClick={() => setBillingCycle('yearly')}
                            >
                                Yearly
                                {billingCycle === 'yearly' && (
                                    <span style={s.saveBadge}>
                                        <Zap size={10} style={{ marginRight: 3 }} />
                                        2 Months Free
                                    </span>
                                )}
                            </button>
                        </div>

                        <div style={s.priceDisplay}>
                            <span style={s.priceAmount}>${amount}</span>
                            <span style={s.pricePeriod}>/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                        </div>

                        {billingCycle === 'yearly' && (
                            <p style={s.savingsText}>
                                <Star size={12} color="#fbbf24" style={{ marginRight: 4 }} />
                                Save $9.98 compared to monthly billing
                            </p>
                        )}

                        {/* PayPal Checkout */}
                        <div style={s.paypalWrap}>
                            <PayPalCheckoutButton
                                amount={amount}
                                onApproved={(orderId) => handlePayPalApproval(orderId)}
                            />
                        </div>

                        <p style={s.disclaimer}>
                            Secure checkout powered by PayPal. Cancel anytime.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  STATE 2 & 3: ACTIVE / LIFETIME DASHBOARD
    // ═══════════════════════════════════════════════════════════════
    const isLifetime = primeState === 'lifetime';

    return (
        <div style={s.root}>
            <style>{`
                @keyframes primeGlow {
                    0%, 100% { filter: drop-shadow(0 0 20px rgba(168,85,247,0.4)); }
                    50% { filter: drop-shadow(0 0 35px rgba(168,85,247,0.7)); }
                }
                .dash-action:hover {
                    border-color: rgba(168,85,247,0.5) !important;
                    box-shadow: 0 0 20px rgba(168,85,247,0.15) !important;
                    transform: translateY(-2px) !important;
                }
            `}</style>

            {/* Notification */}
            {notification && (
                <div style={{
                    ...s.notification,
                    borderColor: notification.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(168,85,247,0.4)',
                    background: notification.type === 'error'
                        ? 'rgba(239,68,68,0.1)'
                        : 'rgba(168,85,247,0.1)',
                }}>
                    <Sparkles size={16} color="#a855f7" />
                    <span style={{ color: '#e2e8f0', fontSize: 14 }}>{notification.msg}</span>
                </div>
            )}

            <div style={s.scrollWrap}>
                {/* ── Dashboard Header ── */}
                <div style={s.dashHeader}>
                    <div style={s.heroCrownWrap}>
                        <Crown
                            size={40}
                            color={isLifetime ? '#fbbf24' : '#a855f7'}
                            style={{ animation: 'primeGlow 3s ease-in-out infinite' }}
                        />
                    </div>
                    <h1 style={s.dashTitle}>
                        Welcome to the Elite,{' '}
                        <span style={isLifetime ? s.dashNameGold : s.dashNamePurple}>
                            {displayName}
                        </span>
                    </h1>
                    <p style={s.heroSubtitle}>
                        {isLifetime
                            ? 'You are a Nexus Founder. Your legacy is eternal.'
                            : 'You are a Nexus Prime member. Enjoy your exclusive perks.'
                        }
                    </p>
                </div>

                {/* ── Status Card ── */}
                <div style={{
                    ...s.statusCard,
                    ...(isLifetime ? s.statusCardLifetime : {}),
                }}>
                    <div style={s.statusRow}>
                        {isLifetime ? (
                            <>
                                <Crown size={22} color="#fbbf24" style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.5))', marginRight: 12 }} />
                                <div>
                                    <p style={s.statusLabel}>Subscription Renewal</p>
                                    <p style={s.statusValueGold}>NEVER!</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <Clock size={22} color="#a855f7" style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.5))', marginRight: 12 }} />
                                <div>
                                    <p style={s.statusLabel}>Subscription Renewal</p>
                                    <p style={s.statusValue}>Your subscription renews in 25 days</p>
                                </div>
                            </>
                        )}
                    </div>
                    {isLifetime && (
                        <div style={s.founderBadge}>
                            <Star size={12} color="#fbbf24" style={{ marginRight: 4 }} />
                            Founder
                        </div>
                    )}
                </div>

                {/* ── Quick Actions ── */}
                <h2 style={s.sectionTitle}>Quick Actions</h2>
                <div style={s.actionsGrid}>
                    {[
                        { icon: Palette, label: 'Manage Accent Colors', desc: 'Customize your profile palette', color: '#a855f7' },
                        { icon: Gem, label: 'Claim Monthly Shards', desc: 'Collect your bonus tribute', color: '#6366f1' },
                        { icon: ShieldCheck, label: 'Privacy Settings', desc: 'Manage your ad-free experience', color: '#10b981' },
                        { icon: Sparkles, label: 'Exclusive Relics', desc: 'Browse Prime-only cosmetics', color: '#f59e0b' },
                    ].map((action, i) => {
                        const Icon = action.icon;
                        return (
                            <div key={i} className="dash-action" style={s.actionCard}>
                                <div style={{ ...s.actionIconWrap, borderColor: `${action.color}33`, boxShadow: `0 0 12px ${action.color}22` }}>
                                    <Icon size={20} color={action.color} />
                                </div>
                                <div style={s.actionText}>
                                    <h4 style={s.actionLabel}>{action.label}</h4>
                                    <p style={s.actionDesc}>{action.desc}</p>
                                </div>
                                <ChevronRight size={18} color="#4a5568" />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default NexusPrimeScreen;


// ============================================================
// STYLES
// ============================================================
const s = {
    root: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0a0a0a',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
    },
    scrollWrap: {
        flex: 1,
        overflowY: 'auto',
        padding: '40px 48px 60px',
    },
    notification: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 24px',
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: 'rgba(168,85,247,0.2)',
        textAlign: 'center',
        justifyContent: 'center',
    },

    // ── Hero ──
    heroSection: {
        textAlign: 'center',
        marginBottom: 48,
        paddingTop: 16,
    },
    heroCrownWrap: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 20,
    },
    heroTitle: {
        fontSize: 36,
        fontWeight: 800,
        color: '#f1f5f9',
        lineHeight: 1.2,
        margin: '0 0 16px',
        letterSpacing: '-0.02em',
    },
    heroGradient: {
        background: 'linear-gradient(135deg, #a855f7, #fbbf24)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    heroSubtitle: {
        fontSize: 15,
        color: '#64748b',
        margin: 0,
        maxWidth: 480,
        marginLeft: 'auto',
        marginRight: 'auto',
        lineHeight: 1.6,
    },

    // ── Features Grid ──
    featuresGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 18,
        marginBottom: 48,
        maxWidth: 960,
        marginLeft: 'auto',
        marginRight: 'auto',
    },
    featureCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: '28px 22px',
        textAlign: 'center',
        transition: 'all 0.3s ease',
        cursor: 'default',
    },
    iconPlate: {
        width: 64,
        height: 64,
        margin: '0 auto 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: '50%',
        borderWidth: 1,
        borderStyle: 'solid',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    featureTitle: {
        color: '#f1f5f9',
        fontSize: 15,
        fontWeight: 700,
        margin: '0 0 8px',
    },
    featureDesc: {
        color: '#64748b',
        fontSize: 12.5,
        lineHeight: 1.5,
        margin: 0,
    },

    // ── Pricing ──
    pricingSection: {
        textAlign: 'center',
        maxWidth: 440,
        marginLeft: 'auto',
        marginRight: 'auto',
    },
    toggleWrap: {
        display: 'inline-flex',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 30,
        padding: 4,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 24,
    },
    toggleBtn: {
        padding: '10px 24px',
        borderRadius: 26,
        border: 'none',
        background: 'transparent',
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    toggleBtnActive: {
        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        color: '#fff',
        boxShadow: '0 4px 15px rgba(124,58,237,0.4)',
    },
    saveBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 700,
        color: '#fbbf24',
        backgroundColor: 'rgba(251,191,36,0.15)',
        padding: '2px 8px',
        borderRadius: 10,
        marginLeft: 4,
    },
    priceDisplay: {
        marginBottom: 8,
    },
    priceAmount: {
        fontSize: 48,
        fontWeight: 800,
        color: '#f1f5f9',
        letterSpacing: '-0.03em',
    },
    pricePeriod: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: 500,
    },
    savingsText: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        color: '#fbbf24',
        margin: '0 0 24px',
    },
    paypalWrap: {
        maxWidth: 320,
        margin: '24px auto 16px',
    },
    disclaimer: {
        color: '#475569',
        fontSize: 11,
        margin: '0 0 20px',
    },

    // ── Dashboard (State 2 & 3) ──
    dashHeader: {
        textAlign: 'center',
        marginBottom: 36,
        paddingTop: 16,
    },
    dashTitle: {
        fontSize: 28,
        fontWeight: 800,
        color: '#f1f5f9',
        margin: '0 0 12px',
        letterSpacing: '-0.02em',
    },
    dashNamePurple: {
        background: 'linear-gradient(135deg, #a855f7, #c084fc)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    dashNameGold: {
        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },

    statusCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'rgba(168,85,247,0.15)',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 36,
        maxWidth: 560,
        marginLeft: 'auto',
        marginRight: 'auto',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
    },
    statusCardLifetime: {
        borderColor: 'rgba(251,191,36,0.35)',
        boxShadow: '0 0 30px rgba(251,191,36,0.08), inset 0 0 30px rgba(251,191,36,0.03)',
        background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(245,158,11,0.02))',
    },
    statusRow: {
        display: 'flex',
        alignItems: 'center',
    },
    statusLabel: {
        color: '#64748b',
        fontSize: 12,
        margin: '0 0 4px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    statusValue: {
        color: '#c4b5fd',
        fontSize: 15,
        fontWeight: 600,
        margin: 0,
    },
    statusValueGold: {
        color: '#fbbf24',
        fontSize: 20,
        fontWeight: 800,
        margin: 0,
        letterSpacing: '0.04em',
        filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.4))',
    },
    founderBadge: {
        position: 'absolute',
        top: 16,
        right: 20,
        display: 'flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: '#fbbf24',
        backgroundColor: 'rgba(251,191,36,0.12)',
        padding: '4px 12px',
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'rgba(251,191,36,0.25)',
    },

    sectionTitle: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 16px',
        maxWidth: 560,
        marginLeft: 'auto',
        marginRight: 'auto',
    },
    actionsGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 560,
        marginLeft: 'auto',
        marginRight: 'auto',
    },
    actionCard: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
    },
    actionIconWrap: {
        width: 40,
        height: 40,
        borderRadius: '50%',
        borderWidth: 1,
        borderStyle: 'solid',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        flexShrink: 0,
    },
    actionText: {
        flex: 1,
    },
    actionLabel: {
        color: '#f1f5f9',
        fontSize: 14,
        fontWeight: 600,
        margin: '0 0 3px',
    },
    actionDesc: {
        color: '#64748b',
        fontSize: 12,
        margin: 0,
    },
};
