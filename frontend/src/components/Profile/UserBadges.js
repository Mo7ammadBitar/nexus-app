import React from 'react';
import { Crown, Sparkles, BookOpen, Swords } from 'lucide-react';

/**
 * Badge Definitions Map
 * All badge visual logic lives here — backend only stores IDs.
 */
export const BADGE_DEFINITIONS = {
    founder: {
        id: 'founder',
        name: 'Nexus Pioneer',
        tooltip: 'Nexus Pioneer — One of the first 100 users',
        icon: Sparkles,
        color: '#06b6d4',       // Cyan
        glow: '0 0 8px rgba(6, 182, 212, 0.7), 0 0 16px rgba(6, 182, 212, 0.3)',
        gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
    },
    scholar: {
        id: 'scholar',
        name: 'Nexus Scholar',
        tooltip: 'Nexus Scholar — Completed 10+ quests',
        icon: BookOpen,
        color: '#f59e0b',       // Gold
        glow: '0 0 8px rgba(245, 158, 11, 0.7), 0 0 16px rgba(245, 158, 11, 0.3)',
        gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    },
    arena_champion: {
        id: 'arena_champion',
        name: 'Arena Champion',
        tooltip: 'Arena Champion — Won 10+ games',
        icon: Swords,
        color: '#ef4444',       // Crimson Red
        glow: '0 0 8px rgba(239, 68, 68, 0.7), 0 0 16px rgba(239, 68, 68, 0.3)',
        gradient: 'linear-gradient(135deg, #ef4444, #f87171)',
    },
};

/**
 * Prime Badge Tier Calculator
 * Returns tier info based on months of premium membership.
 */
const getPrimeTier = (premiumSince) => {
    if (!premiumSince) return null;
    const now = new Date();
    const since = new Date(premiumSince);
    const months = Math.max(1, Math.floor((now - since) / (1000 * 60 * 60 * 24 * 30)));

    if (months >= 11) return { tier: 'Platinum', color: '#a855f7', glow: '0 0 10px rgba(168,85,247,0.8), 0 0 20px rgba(168,85,247,0.4)', months };
    if (months >= 6) return { tier: 'Diamond', color: '#3b82f6', glow: '0 0 10px rgba(59,130,246,0.8), 0 0 20px rgba(59,130,246,0.4)', months };
    if (months >= 4) return { tier: 'Gold', color: '#f59e0b', glow: '0 0 10px rgba(245,158,11,0.8), 0 0 20px rgba(245,158,11,0.4)', months };
    if (months >= 2) return { tier: 'Silver', color: '#9ca3af', glow: '0 0 10px rgba(156,163,175,0.7), 0 0 18px rgba(156,163,175,0.3)', months };
    return { tier: 'Bronze', color: '#cd7f32', glow: '0 0 10px rgba(205,127,50,0.7), 0 0 18px rgba(205,127,50,0.3)', months };
};

/**
 * Single Badge Chip
 */
const BadgeChip = ({ icon: Icon, color, glow, tooltip, gradient }) => (
    <div
        style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: gradient || color,
            boxShadow: glow,
            cursor: 'default',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            flexShrink: 0,
        }}
        title={tooltip}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.15)';
            e.currentTarget.style.boxShadow = glow.replace(/0\.7/g, '1').replace(/0\.3/g, '0.6').replace(/0\.8/g, '1').replace(/0\.4/g, '0.7');
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = glow;
        }}
    >
        <Icon size={15} color="#fff" strokeWidth={2.5} />
    </div>
);

/**
 * UserBadges — display-only component
 *
 * Renders the Evolving Prime badge (if applicable, does NOT count toward 4 limit)
 * followed by equipped manual badges.
 *
 * @param {object} user — needs: is_premium, premium_since, equipped_badges
 * @param {string} size — 'small' | 'normal' (default 'normal')
 */
const UserBadges = ({ user, size = 'normal' }) => {
    if (!user) return null;

    const equippedBadges = user.equipped_badges || [];
    const isPremium = user.is_premium;
    const premiumSince = user.premium_since;

    const primeTier = isPremium && premiumSince ? getPrimeTier(premiumSince) : null;
    const hasAnything = primeTier || equippedBadges.length > 0;

    if (!hasAnything) return null;

    const scale = size === 'small' ? 0.82 : 1;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: size === 'small' ? 4 : 6,
                marginTop: size === 'small' ? 2 : 4,
                flexWrap: 'wrap',
                transform: `scale(${scale})`,
                transformOrigin: 'left center',
            }}
        >
            {/* Auto Prime Badge */}
            {primeTier && (
                <BadgeChip
                    icon={Crown}
                    color={primeTier.color}
                    glow={primeTier.glow}
                    gradient={`linear-gradient(135deg, ${primeTier.color}, ${primeTier.color}cc)`}
                    tooltip={`Nexus Prime (${primeTier.months} month${primeTier.months !== 1 ? 's' : ''}) — ${primeTier.tier}`}
                />
            )}

            {/* Manual Equipped Badges */}
            {equippedBadges.map((badgeId) => {
                const def = BADGE_DEFINITIONS[badgeId];
                if (!def) return null;
                return (
                    <BadgeChip
                        key={badgeId}
                        icon={def.icon}
                        color={def.color}
                        glow={def.glow}
                        gradient={def.gradient}
                        tooltip={def.tooltip}
                    />
                );
            })}
        </div>
    );
};

export default UserBadges;
export { getPrimeTier };
