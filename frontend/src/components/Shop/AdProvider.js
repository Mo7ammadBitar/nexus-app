import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';

/**
 * AdProvider - Modular Rewarded Ad System
 * 
 * ARCHITECTURE:
 * This module provides a clean interface for rewarded ads.
 * Currently runs in Dev Mode with a mock countdown.
 * When ready for production, swap the implementation below.
 * 
 * Interface: showRewardedAd(onReward, onDismiss)
 */

// ============================================================
// PRODUCTION IMPLEMENTATION (Google AdSense / AdMob)
// ============================================================
// 
// To switch to real ads:
// 1. Install the AdMob SDK or add the AdSense script tag
// 2. Uncomment the production implementation below
// 3. Comment out the Dev Mode implementation
//
// --- Google AdSense (Web) ---
// const showRewardedAdProduction = (onReward, onDismiss) => {
//     // Ensure the AdSense script is loaded in index.html:
//     // <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXX" crossorigin="anonymous"></script>
//
//     // Create and configure the ad
//     // window.adsbygoogle = window.adsbygoogle || [];
//     // window.adsbygoogle.push({
//     //     google_ad_client: 'ca-pub-XXXXXXXXXXXXXXXX',
//     //     enable_page_level_ads: true,
//     //     // Rewarded ad configuration
//     //     google_ad_slot: 'XXXXXXXXXX',
//     //     google_ad_format: 'rewarded',
//     //     google_ad_callback: {
//     //         onRewardGranted: () => onReward(),
//     //         onAdClosed: () => onDismiss(),
//     //         onAdFailedToLoad: (error) => {
//     //             console.error('Ad failed to load:', error);
//     //             onDismiss();
//     //         }
//     //     }
//     // });
// };
//
// --- Google AdMob (React Native / Mobile) ---
// import { RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
//
// const showRewardedAdMobile = (onReward, onDismiss) => {
//     const rewardedAd = RewardedAd.createForAdRequest('ca-app-pub-XXXXX/YYYYY');
//     
//     rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
//         rewardedAd.show();
//     });
//     
//     rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
//         console.log('User earned reward:', reward);
//         onReward();
//     });
//     
//     rewardedAd.addAdEventListener('closed', () => {
//         onDismiss();
//     });
//     
//     rewardedAd.load();
// };
// ============================================================


// ============================================================
// DEV MODE IMPLEMENTATION (Mock Countdown)
// ============================================================

const AD_DURATION = 15; // seconds

const MockAdModal = ({ onReward, onDismiss }) => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState(AD_DURATION);
    const [isComplete, setIsComplete] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    setIsComplete(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, []);

    const progress = ((AD_DURATION - timeLeft) / AD_DURATION) * 100;

    const handleCollect = () => {
        onReward();
    };

    return ReactDOM.createPortal(
        <div style={adStyles.overlay}>
            <div style={adStyles.modal}>
                {/* Header */}
                <div style={adStyles.header}>
                    <div style={adStyles.sparkle}>✦</div>
                    <h2 style={adStyles.title}>{t('shop.ad_title', 'Astral Vision')}</h2>
                    <p style={adStyles.subtitle}>
                        {isComplete
                            ? t('shop.ad_complete', 'The vision is complete!')
                            : t('shop.ad_gaze', 'Gaze into the ethereal plane...')
                        }
                    </p>
                </div>

                {/* Ad Content Area (Mock) */}
                <div style={adStyles.adArea}>
                    <div style={adStyles.adPlaceholder}>
                        <div style={adStyles.orbContainer}>
                            <div style={{
                                ...adStyles.orb,
                                animation: 'orbPulse 2s ease-in-out infinite',
                                boxShadow: isComplete
                                    ? '0 0 60px rgba(245, 158, 11, 0.8), 0 0 120px rgba(245, 158, 11, 0.4)'
                                    : '0 0 40px rgba(124, 58, 237, 0.6), 0 0 80px rgba(124, 58, 237, 0.3)',
                                background: isComplete
                                    ? 'radial-gradient(circle, #f59e0b, #d97706)'
                                    : 'radial-gradient(circle, #7c3aed, #4c1d95)',
                            }}>
                                <span style={adStyles.orbEmoji}>
                                    {isComplete ? '✦' : '👁️'}
                                </span>
                            </div>
                        </div>
                        <p style={adStyles.devNote}>
                            {t('shop.ad_dev_note', '[ Dev Mode — Ad Placeholder ]')}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={adStyles.progressContainer}>
                    <div style={adStyles.progressTrack}>
                        <div style={{
                            ...adStyles.progressFill,
                            width: `${progress}%`,
                            background: isComplete
                                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                : 'linear-gradient(90deg, #7c3aed, #a855f7)',
                        }} />
                    </div>
                    <span style={adStyles.timer}>
                        {isComplete ? t('shop.ad_timer_complete', '✓ Complete') : `${timeLeft}${t('shop.ad_timer_remaining', 's remaining')}`}
                    </span>
                </div>

                {/* Actions */}
                <div style={adStyles.actions}>
                    {isComplete ? (
                        <button style={adStyles.collectBtn} onClick={handleCollect}>
                            <span style={{ marginRight: 8 }}>✦</span>
                            {t('shop.ad_collect', 'Collect +50 Shards')}
                            <span style={{ marginLeft: 8 }}>✦</span>
                        </button>
                    ) : (
                        <button style={adStyles.dismissBtn} onClick={onDismiss}>
                            {t('shop.ad_skip', 'Skip (No Reward)')}
                        </button>
                    )}
                </div>
            </div>

            {/* Inject keyframes */}
            <style>{`
                @keyframes orbPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
            `}</style>
        </div>,
        document.body
    );
};


// ============================================================
// PUBLIC API
// ============================================================

/**
 * AdProvider Component
 * 
 * Usage:
 *   <AdProvider ref={adRef} />
 *   adRef.current.showRewardedAd(onReward, onDismiss)
 * 
 * Or use the hook:
 *   const { showAd, AdModal } = useRewardedAd();
 */

export const useRewardedAd = () => {
    const [adState, setAdState] = useState(null);

    const showRewardedAd = useCallback((onReward, onDismiss) => {
        setAdState({ onReward, onDismiss });
    }, []);

    const handleReward = useCallback(() => {
        if (adState?.onReward) adState.onReward();
        setAdState(null);
    }, [adState]);

    const handleDismiss = useCallback(() => {
        if (adState?.onDismiss) adState.onDismiss();
        setAdState(null);
    }, [adState]);

    const AdModal = adState ? (
        <MockAdModal onReward={handleReward} onDismiss={handleDismiss} />
    ) : null;

    return { showRewardedAd, AdModal };
};

export default useRewardedAd;


// ============================================================
// STYLES
// ============================================================

const adStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
    },
    modal: {
        backgroundColor: '#0a0a1a',
        borderRadius: '20px',
        padding: '32px',
        width: '440px',
        maxWidth: '90vw',
        border: '1px solid rgba(124, 58, 237, 0.3)',
        boxShadow: '0 0 60px rgba(124, 58, 237, 0.2)',
    },
    header: {
        textAlign: 'center',
        marginBottom: '24px',
    },
    sparkle: {
        fontSize: '28px',
        color: '#a855f7',
        marginBottom: '8px',
    },
    title: {
        color: '#fff',
        fontSize: '24px',
        fontWeight: '700',
        margin: '0 0 8px 0',
        background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        color: '#a0a0a0',
        fontSize: '14px',
        margin: 0,
    },
    adArea: {
        backgroundColor: '#111127',
        borderRadius: '12px',
        padding: '40px 20px',
        marginBottom: '20px',
        border: '1px solid rgba(124, 58, 237, 0.15)',
    },
    adPlaceholder: {
        textAlign: 'center',
    },
    orbContainer: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
    },
    orb: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'all 0.5s ease',
    },
    orbEmoji: {
        fontSize: '32px',
    },
    devNote: {
        color: '#4a4a6a',
        fontSize: '12px',
        fontStyle: 'italic',
        margin: 0,
    },
    progressContainer: {
        marginBottom: '24px',
    },
    progressTrack: {
        height: '6px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '8px',
    },
    progressFill: {
        height: '100%',
        borderRadius: '3px',
        transition: 'width 1s linear',
    },
    timer: {
        color: '#8b8ba0',
        fontSize: '13px',
        textAlign: 'center',
        display: 'block',
    },
    actions: {
        display: 'flex',
        justifyContent: 'center',
    },
    collectBtn: {
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        border: 'none',
        borderRadius: '12px',
        padding: '14px 32px',
        color: '#fff',
        fontSize: '16px',
        fontWeight: '700',
        cursor: 'pointer',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
        transition: 'transform 0.2s, box-shadow 0.2s',
    },
    dismissBtn: {
        background: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        padding: '12px 24px',
        color: '#6b7280',
        fontSize: '14px',
        cursor: 'pointer',
        width: '100%',
        transition: 'all 0.2s',
    },
};
