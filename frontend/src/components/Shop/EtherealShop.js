import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useShopStore } from '../../store/shopStore';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import QuestsPanel from './QuestsPanel';
import PayPalCheckoutButton from './PayPalCheckoutButton';
import { paymentsAPI, shopAPI } from '../../services/api';
import { Gem, Sparkles, X, LayoutGrid, Frame, MessageCircle, XCircle, Check, Coins, Rocket, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Maps relic IDs to their CSS class names
export const RELIC_CSS_MAP = {
    frame_celestial: 'relic-frame-celestial',
    frame_infernal: 'relic-frame-infernal',
    frame_frost: 'relic-frame-frost',
    frame_verdant: 'relic-frame-verdant',
    frame_astral_vortex: 'frame-astral-vortex',
    frame_neon_pulse: 'frame-neon-pulse',
    frame_inferno_ring: 'frame-inferno-ring',
    bubble_ethereal: 'relic-bubble-ethereal',
    bubble_shadow: 'relic-bubble-shadow',
    bubble_golden: 'relic-bubble-golden',
    bubble_aurora: 'relic-bubble-aurora',
    bubble_astral_vortex: 'bubble-astral-vortex',
    bubble_neon_pulse: 'bubble-neon-pulse',
    bubble_inferno_ring: 'bubble-inferno-ring',
};

/**
 * The Ethereal Shop — Cosmetic Shop & Economy UI
 */
const EtherealShop = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { updateUser } = useAuthStore();
    const {
        shards, relicsCatalog, isLoading, error,
        fetchShop, buyRelic, equipRelic, unequipRelic
    } = useShopStore();
    const { servers } = useServerStore();

    const [notification, setNotification] = useState(null);
    const [buyingId, setBuyingId] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    
    // Server Boost State
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [boostingServerId, setBoostingServerId] = useState('');
    const [boosting, setBoosting] = useState(false);

    useEffect(() => {
        if (isOpen) fetchShop();
    }, [isOpen]);

    const handleBuyBoost = async () => {
        setBoosting(true);
        try {
            const response = await shopAPI.buyServerBoost();
            
            // Update auth store with the new inventory boost count
            updateUser({ available_server_boosts: response.data.available_server_boosts });

            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Rocket size={16} color="#a855f7" />
                    <span>{response.data.message}</span>
                </div>
            );
            fetchShop(); // refresh shards
            setShowBoostModal(false);
        } catch (err) {
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <XCircle size={16} color="#ef4444" />
                    <span>{err.response?.data?.detail || 'Failed to buy Server Boost'}</span>
                </div>
            );
        }
        setBoosting(false);
    };

    const showNotification = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleBuy = async (relicId) => {
        setBuyingId(relicId);
        const result = await buyRelic(relicId);
        if (result.success) {
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color="#a855f7" />
                    <span>{result.message}</span>
                </div>
            );
        } else {
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <XCircle size={16} color="#ef4444" />
                    <span>{result.error}</span>
                </div>
            );
        }
        setBuyingId(null);
    };

    const handleEquip = async (relicId) => {
        const result = await equipRelic(relicId);
        if (result.success) {
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={16} color="#10b981" />
                    <span>{result.message}</span>
                </div>
            );
        }
        else {
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <XCircle size={16} color="#ef4444" />
                    <span>{result.error}</span>
                </div>
            );
        }
    };

    const handleUnequip = async (relic) => {
        const result = await unequipRelic(relic.type);
        if (result.success) {
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={16} color="#94a3b8" />
                    <span>{result.message}</span>
                </div>
            );
        }
        else {
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <XCircle size={16} color="#ef4444" />
                    <span>{result.error}</span>
                </div>
            );
        }
    };

    const handleBuyShards = async (orderId, packId) => {
        try {
            const response = await paymentsAPI.verifyShards(orderId, packId);
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Gem size={16} color="#fbbf24" />
                    <span>{response.data.message}</span>
                </div>
            );
            // Refresh shop data to update shard balance
            fetchShop();
        } catch (error) {
            showNotification(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <XCircle size={16} color="#ef4444" />
                    <span>{error.response?.data?.detail || t('shop.err_purchase', 'Failed to purchase shards')}</span>
                </div>
            );
        }
    };

    const filteredRelics = relicsCatalog.filter(r =>
        activeFilter === 'all' || r.type === activeFilter || activeFilter === 'treasury'
    );

    const SHARD_PACKS = [
        { id: 'pack_small', shards: 100, price: '0.99', name: t('shop.pack_small', 'Pile of Shards') },
        { id: 'pack_medium', shards: 550, price: '4.99', name: t('shop.pack_medium', 'Sack of Shards'), popular: true },
        { id: 'pack_large', shards: 1200, price: '9.99', name: t('shop.pack_large', 'Chest of Shards') }
    ];

    if (!isOpen) return null;

    /** Renders the live preview for a frame relic */
    const renderFramePreview = (relic) => {
        const cssClass = RELIC_CSS_MAP[relic.id] || '';
        return (
            <div style={shopStyles.framePreviewWrap}>
                <div className={`relic-frame ${cssClass}`} style={{
                    position: 'absolute',
                    inset: '-4px',
                    borderRadius: '50%',
                    zIndex: 3,
                    pointerEvents: 'none',
                }} />
                <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${relic.preview_color}88, ${relic.preview_color}44)`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: 18,
                    color: '#fff',
                    fontWeight: 700,
                    zIndex: 2,
                }}>N</div>
            </div>
        );
    };

    /** Renders the live preview for a bubble relic */
    const renderBubblePreview = (relic) => {
        const cssClass = RELIC_CSS_MAP[relic.id] || '';
        return (
            <div style={shopStyles.bubblePreviewWrap}>
                <div className={cssClass} style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: 11,
                    color: '#c4b5fd',
                    lineHeight: 1.4,
                }}>
                    <span style={{ color: '#a0a0c0', fontSize: 10 }}>{t('shop.preview', 'Preview')}</span>
                    <br />
                    {t('shop.preview_text', 'The stars direct message your name...')}
                </div>
            </div>
        );
    };

    return ReactDOM.createPortal(
        <div style={shopStyles.overlay} onClick={onClose}>
            <style>{`
                /* Preview frame styles (inside shop cards) */
                .shop-preview .relic-frame {
                    position: absolute;
                    inset: -4px;
                    border-radius: 50%;
                    z-index: 3;
                    pointer-events: none;
                }
                .shop-preview .relic-frame-celestial {
                    border: 2px solid #7c3aed;
                    box-shadow: 0 0 8px rgba(124, 58, 237, 0.6), inset 0 0 4px rgba(124, 58, 237, 0.3);
                    animation: celestialPulse 3s ease-in-out infinite;
                }
                .shop-preview .relic-frame-infernal {
                    border: 2px solid #ef4444;
                    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6), inset 0 0 4px rgba(239, 68, 68, 0.3);
                    animation: infernalFlicker 2s ease-in-out infinite;
                }
                .shop-preview .relic-frame-frost {
                    border: 2px solid #06b6d4;
                    box-shadow: 0 0 8px rgba(6, 182, 212, 0.6), inset 0 0 4px rgba(6, 182, 212, 0.3);
                }
                .shop-preview .relic-frame-verdant {
                    border: 2px solid #10b981;
                    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5), inset 0 0 4px rgba(16, 185, 129, 0.25);
                }
                .shop-preview .relic-bubble-ethereal {
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.06));
                    border-left: 2px solid rgba(139, 92, 246, 0.5);
                }
                .shop-preview .relic-bubble-shadow {
                    background: linear-gradient(135deg, rgba(30, 27, 75, 0.4), rgba(0, 0, 0, 0.2));
                    border-left: 2px solid rgba(99, 102, 241, 0.4);
                }
                .shop-preview .relic-bubble-golden {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.06));
                    border-left: 2px solid rgba(245, 158, 11, 0.5);
                }
                .shop-preview .relic-bubble-aurora {
                    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(16, 185, 129, 0.06));
                    border-left: 2px solid rgba(6, 182, 212, 0.5);
                }
                @keyframes celestialPulse {
                    0%, 100% { box-shadow: 0 0 8px rgba(124, 58, 237, 0.6); }
                    50% { box-shadow: 0 0 14px rgba(124, 58, 237, 0.9); }
                }
                @keyframes infernalFlicker {
                    0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.6); }
                    50% { box-shadow: 0 0 14px rgba(239, 68, 68, 0.9); }
                }
                @media (max-width: 768px) {
                    .mobile-shop-modal {
                        width: 100vw !important;
                        max-width: 100vw !important;
                        height: 100dvh !important;
                        max-height: 100dvh !important;
                        border-radius: 0 !important;
                        border: none !important;
                    }
                    .mobile-shop-header {
                        padding: 16px 16px 12px !important;
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 12px !important;
                    }
                    .mobile-header-right {
                        width: 100% !important;
                        justify-content: space-between !important;
                    }
                    .mobile-shop-content {
                        padding: 16px !important;
                    }
                    .mobile-vision-card {
                        flex-direction: column !important;
                        text-align: center !important;
                        gap: 16px !important;
                        padding: 16px !important;
                    }
                    .mobile-vision-left {
                        flex-direction: column !important;
                    }
                    .mobile-filter-row {
                        flex-wrap: wrap !important;
                        justify-content: center !important;
                    }
                    .mobile-relics-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
            <div style={shopStyles.container} className="mobile-shop-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={shopStyles.header} className="mobile-shop-header">
                    <div>
                        <h2 style={shopStyles.title}>
                            <Sparkles size={20} style={{ color: '#a855f7', marginRight: 8 }} />
                            {t('shop.title', 'The Ethereal Shop')}
                        </h2>
                        <p style={shopStyles.subtitle}>{t('shop.subtitle', 'Connect to ancient relics and adorn your presence')}</p>
                    </div>
                    <div style={shopStyles.headerRight} className="mobile-header-right">
                        <div style={shopStyles.shardsBadge}>
                            <Gem size={16} style={shopStyles.gemIcon} />
                            <span style={shopStyles.shardsAmount}>{shards}</span>
                            <span style={shopStyles.shardsLabel}>{t('shop.shards', 'Shards')}</span>
                        </div>
                        <button style={shopStyles.closeBtn} onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Notification */}
                {notification && (
                    <div style={shopStyles.notification}>{notification}</div>
                )}

                <div style={shopStyles.content} className="mobile-shop-content">
                    {/* Filter Tabs */}
                    <div style={shopStyles.filterRow} className="mobile-filter-row">
                        {['all', 'frame', 'bubble', 'treasury', 'quests'].map(filter => (
                            <button
                                key={filter}
                                style={{
                                    ...shopStyles.filterTab,
                                    ...(activeFilter === filter ? shopStyles.filterTabActive : {}),
                                    ...(filter === 'quests' && activeFilter !== 'quests' ? { borderColor: 'rgba(251, 191, 36, 0.3)', color: '#fbbf24' } : {}),
                                }}
                                onClick={() => setActiveFilter(filter)}
                            >
                                {filter === 'all' && <LayoutGrid size={14} style={{ marginRight: 6 }} />}
                                {filter === 'frame' && <Frame size={14} style={{ marginRight: 6 }} />}
                                {filter === 'bubble' && <MessageCircle size={14} style={{ marginRight: 6 }} />}
                                {filter === 'treasury' && <Coins size={14} style={{ marginRight: 6 }} />}
                                {filter === 'quests' && <Trophy size={14} style={{ marginRight: 6 }} />}
                                {filter === 'all' ? t('shop.filter_all', 'All Relics') : filter === 'frame' ? t('shop.filter_frames', 'Frames') : filter === 'bubble' ? t('shop.filter_bubbles', 'Bubbles') : filter === 'treasury' ? t('shop.filter_treasury', 'Treasury') : 'Quests'}
                            </button>
                        ))}
                    </div>

                    {/* Quests View */}
                    {activeFilter === 'quests' && (
                        <QuestsPanel />
                    )}

                    {/* Treasury View */}
                    {activeFilter === 'treasury' ? (
                        <div style={shopStyles.relicsGrid} className="mobile-relics-grid">
                            
                            {/* Server Boost Card */}
                            <div style={{ ...shopStyles.relicCard, position: 'relative', background: 'linear-gradient(145deg, rgba(168, 85, 247, 0.1), rgba(0,0,0,0.2))', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                                <div style={{ position: 'absolute', top: 0, right: 0, background: '#a855f7', color: '#fff', fontSize: 10, fontWeight: 'bold', padding: '4px 8px', borderBottomLeftRadius: 8, zIndex: 2 }}>
                                    PREMIUM
                                </div>
                                <div style={{ padding: 20, textAlign: 'center' }}>
                                    <div style={{ width: 60, height: 60, borderRadius: 30, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <Rocket size={28} color="#a855f7" style={{ filter: 'drop-shadow(0 0 10px #a855f7)' }} />
                                    </div>
                                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', margin: '0 0 4px' }}>Server Boost</h3>
                                    <p style={{ color: '#aaa', fontSize: 13, margin: '0 0 4px', minHeight: 40 }}>Unlock Custom Server Banners for a specific server</p>
                                    <p style={{ color: '#fbbf24', fontSize: 18, fontWeight: '700', margin: '0 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                        1000 <Gem size={16} color="#fbbf24" style={{ filter: 'drop-shadow(0 0 2px #fbbf24)' }} />
                                    </p>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                        <button 
                                            style={shopStyles.buyBtn} 
                                            onClick={() => setShowBoostModal(true)}
                                        >
                                            Buy Boost
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Shard Packs */}
                            {SHARD_PACKS.map(pack => (
                                <div key={pack.id} style={{ ...shopStyles.relicCard, position: 'relative', background: pack.popular ? 'linear-gradient(145deg, rgba(251, 191, 36, 0.1), rgba(0,0,0,0.2))' : shopStyles.relicCard.backgroundColor, borderColor: pack.popular ? 'rgba(251, 191, 36, 0.3)' : shopStyles.relicCard.borderColor }}>
                                    {pack.popular && (
                                        <div style={{ position: 'absolute', top: 0, right: 0, background: '#fbbf24', color: '#000', fontSize: 10, fontWeight: 'bold', padding: '4px 8px', borderBottomLeftRadius: 8, zIndex: 2 }}>
                                            {t('shop.badge_best_value', 'BEST VALUE')}
                                        </div>
                                    )}
                                    <div style={{ padding: 20, textAlign: 'center' }}>
                                        <div style={{ width: 60, height: 60, borderRadius: 30, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <Gem size={28} color="#a855f7" style={{ filter: 'drop-shadow(0 0 10px #a855f7)' }} />
                                        </div>
                                        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', margin: '0 0 4px' }}>{pack.shards} {t('shop.shards', 'Shards')}</h3>
                                        <p style={{ color: '#aaa', fontSize: 13, margin: '0 0 4px' }}>{pack.name}</p>
                                        <p style={{ color: '#fbbf24', fontSize: 18, fontWeight: '700', margin: '0 0 16px' }}>${pack.price}</p>

                                        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                            <PayPalCheckoutButton
                                                itemId={pack.id}
                                                onApproved={(orderId) => handleBuyShards(orderId, pack.id)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Relics Grid */
                        isLoading ? (
                            <div style={shopStyles.loading}>{t('shop.loading', 'Loading relics...')}</div>
                        ) : error ? (
                            <div style={shopStyles.error}>{error}</div>
                        ) : (
                            <div style={shopStyles.relicsGrid} className="mobile-relics-grid">
                                {filteredRelics.map(relic => (
                                    <div key={relic.id} style={shopStyles.relicCard} className="shop-preview">
                                        {/* Live Preview */}
                                        <div style={{
                                            ...shopStyles.relicPreview,
                                            background: `linear-gradient(135deg, ${relic.preview_color}22, ${relic.preview_color}08)`,
                                            borderBottomWidth: '1px',
                                            borderBottomStyle: 'solid',
                                            borderBottomColor: `${relic.preview_color}33`,
                                        }}>
                                            {relic.type === 'frame'
                                                ? renderFramePreview(relic)
                                                : renderBubblePreview(relic)
                                            }
                                            {relic.equipped && (
                                                <div style={shopStyles.equippedIndicator}>{t('shop.equipped', 'Equipped')}</div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div style={shopStyles.relicInfo}>
                                            <h4 style={shopStyles.relicName}>{relic.name}</h4>
                                            <p style={shopStyles.relicDesc}>{relic.description}</p>
                                            <div style={shopStyles.relicType}>
                                                {relic.type === 'frame' ? <Frame size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'text-bottom' }} /> : <MessageCircle size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'text-bottom' }} />}
                                                {relic.type === 'frame' ? t('shop.frame', 'Frame') : t('shop.bubble', 'Bubble')}
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <div style={shopStyles.relicAction}>
                                            {!relic.owned ? (
                                                <button
                                                    style={{
                                                        ...shopStyles.buyBtn,
                                                        opacity: buyingId === relic.id || shards < relic.price ? 0.5 : 1,
                                                    }}
                                                    onClick={() => handleBuy(relic.id)}
                                                    disabled={buyingId === relic.id || shards < relic.price}
                                                >
                                                    <Gem size={12} style={shopStyles.gemIconSmall} />
                                                    {relic.price} {t('shop.btn_attune', '— Connect')}
                                                </button>
                                            ) : relic.equipped ? (
                                                <button
                                                    style={shopStyles.unequipBtn}
                                                    onClick={() => handleUnequip(relic)}
                                                >
                                                    {t('shop.btn_remove', 'Remove')}
                                                </button>
                                            ) : (
                                                <button
                                                    style={shopStyles.equipBtn}
                                                    onClick={() => handleEquip(relic.id)}
                                                >
                                                    <Sparkles size={13} style={{ marginRight: 4 }} />
                                                    {t('shop.btn_equip', 'Equip')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
            
            {/* Server Boost Selection Modal */}
            {showBoostModal && (
                <div style={{ ...shopStyles.overlay, zIndex: 4010 }}>
                    <div style={{ ...shopStyles.container, width: 440, height: 'auto', padding: 24, display: 'block' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ color: '#fff', fontSize: 18, margin: 0, display: 'flex', alignItems: 'center' }}>
                                <Rocket size={20} color="#a855f7" style={{ marginRight: 8 }} />
                                Boost a Server
                            </h3>
                            <button style={shopStyles.closeBtn} onClick={() => setShowBoostModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                            Purchase a level 1 Server Boost for your Inventory. You can apply it to any server you are a member of from your Profile Settings.
                        </p>

                        <div style={{ padding: '20px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 12, marginBottom: 24, textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Rocket size={32} color="#a855f7" style={{ filter: 'drop-shadow(0 0 10px #a855f7)' }} />
                            </div>
                            <h4 style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', margin: '0 0 8px' }}>Server Boost x1</h4>
                            <p style={{ color: '#aaa', fontSize: 14, margin: 0 }}>Unlocks Custom Server Banners</p>
                        </div>

                        {shards < 1000 ? (
                            <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, marginBottom: 12 }}>
                                Not enough Shards. You need 1000 Shards to purchase a Server Boost.
                            </div>
                        ) : null}

                        <button
                            disabled={boosting || shards < 1000}
                            onClick={handleBuyBoost}
                            style={{
                                ...shopStyles.buyBtn,
                                opacity: (boosting || shards < 1000) ? 0.5 : 1,
                                padding: '14px',
                                fontSize: 15
                            }}
                        >
                            {boosting ? 'Purchasing...' : `Confirm Purchase (1000 Shards)`}
                        </button>
                    </div>
                </div>
            )}
        </div >,
        document.body
    );
};

export default EtherealShop;


// ============================================================
// STYLES
// ============================================================

const shopStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 4000,
    },
    container: {
        backgroundColor: '#0d0d1f',
        borderRadius: '20px',
        width: '720px',
        maxWidth: '92vw',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(124, 58, 237, 0.2)',
        boxShadow: '0 0 80px rgba(124, 58, 237, 0.15)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 28px 16px',
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    title: {
        color: '#fff',
        fontSize: '22px',
        fontWeight: '700',
        margin: '0 0 4px 0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    titleIcon: {
        color: '#a855f7',
        fontSize: '20px',
    },
    subtitle: {
        color: '#6b7280',
        fontSize: '13px',
        margin: 0,
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    shardsBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(168, 85, 247, 0.1))',
        padding: '8px 16px',
        borderRadius: '12px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(124, 58, 237, 0.3)',
    },
    gemIcon: {
        color: '#a855f7',
        filter: 'drop-shadow(0 0 5px #a855f7)',
    },
    gemIconSmall: {
        color: '#c4b5fd',
        filter: 'drop-shadow(0 0 3px #a855f7)',
        marginRight: 4,
    },
    shardsAmount: {
        color: '#fff',
        fontSize: '18px',
        fontWeight: '700',
    },
    shardsLabel: {
        color: '#a0a0a0',
        fontSize: '12px',
    },
    closeBtn: {
        background: 'rgba(255, 255, 255, 0.08)',
        border: 'none',
        color: '#fff',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        fontSize: '16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notification: {
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        color: '#d4b4f7',
        padding: '10px 28px',
        fontSize: '14px',
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: 'rgba(124, 58, 237, 0.2)',
        textAlign: 'center',
    },
    content: {
        padding: '20px 28px 28px',
        overflowY: 'auto',
        flex: 1,
    },

    // Vision Card
    visionCard: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.06))',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(245, 158, 11, 0.25)',
        borderRadius: '14px',
        padding: '20px 24px',
        marginBottom: '24px',
    },
    visionLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    visionOrb: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #f59e0b, #d97706)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '24px',
        boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
    },
    visionTitle: {
        color: '#fbbf24',
        fontSize: '16px',
        fontWeight: '700',
        margin: '0 0 4px 0',
    },
    visionDesc: {
        color: '#a0a0a0',
        fontSize: '13px',
        margin: 0,
    },
    visionBtn: {
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        border: 'none',
        borderRadius: '10px',
        padding: '12px 20px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
        transition: 'transform 0.2s',
        whiteSpace: 'nowrap',
    },

    // Filter — using separate border properties to avoid React warnings
    filterRow: {
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
    },
    filterTab: {
        background: 'rgba(255, 255, 255, 0.04)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '8px 16px',
        color: '#8b8ba0',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    filterTabActive: {
        background: 'rgba(124, 58, 237, 0.15)',
        borderColor: 'rgba(124, 58, 237, 0.4)',
        color: '#a855f7',
    },

    // Relics Grid
    relicsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
    },
    relicCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '14px',
        overflow: 'hidden',
        transition: 'all 0.2s',
    },
    relicPreview: {
        height: '100px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },

    // Frame preview: centered avatar circle with glow ring
    framePreviewWrap: {
        position: 'relative',
        width: 52,
        height: 52,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Bubble preview: message-like box
    bubblePreviewWrap: {
        width: '85%',
    },

    equippedIndicator: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: 'rgba(16, 185, 129, 0.8)',
        color: '#fff',
        fontSize: '10px',
        fontWeight: '600',
        padding: '3px 8px',
        borderRadius: '4px',
    },
    relicInfo: {
        padding: '14px 14px 8px',
    },
    relicName: {
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        margin: '0 0 6px 0',
    },
    relicDesc: {
        color: '#6b7280',
        fontSize: '11px',
        margin: '0 0 8px 0',
        lineHeight: '1.4',
    },
    relicType: {
        color: '#4a4a6a',
        fontSize: '11px',
    },
    relicAction: {
        padding: '0 14px 14px',
    },
    buyBtn: {
        width: '100%',
        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        border: 'none',
        borderRadius: '8px',
        padding: '10px',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
    },
    equipBtn: {
        width: '100%',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        border: 'none',
        borderRadius: '8px',
        padding: '10px',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    unequipBtn: {
        width: '100%',
        background: 'transparent',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(239, 68, 68, 0.4)',
        borderRadius: '8px',
        padding: '10px',
        color: '#ef4444',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
    },

    loading: {
        color: '#6b7280',
        textAlign: 'center',
        padding: '40px',
        fontSize: '14px',
    },
    error: {
        color: '#ef4444',
        textAlign: 'center',
        padding: '40px',
        fontSize: '14px',
    },
};
