import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native-web';
import { Crown, Check, X, Sparkles, Zap, Palette, Image as ImageIcon } from 'lucide-react';
import PayPalCheckoutButton from '../Shop/PayPalCheckoutButton';
import { paymentsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';

const NexusEliteModal = ({ onClose }) => {
    const { t } = useTranslation();
    const { refreshUser } = useAuthStore();

    const handleSubscribe = async (orderId, plan) => {
        try {
            await paymentsAPI.verifyElite(orderId, plan);
            await refreshUser(); // Update user state to unlock features immediately
            onClose(); // Close modal on success
            alert(t('elite.msg_success', "Welcome to Nexus Elite! Features unlocked."));
        } catch (error) {
            console.error("Subscription failed:", error);
            alert(error.response?.data?.detail || t('elite.msg_fail', "Failed to subscribe. Please try again."));
        }
    };

    return (
        <View style={styles.overlay}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                    <X size={24} color="#fff" />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Crown size={48} color="#fbbf24" style={{ filter: 'drop-shadow(0 0 10px #fbbf24)' }} />
                    <Text style={styles.title}>{t('elite.title', 'Nexus Elite')}</Text>
                    <Text style={styles.subtitle}>{t('elite.subtitle', 'Unlock the full potential of your identity')}</Text>
                </View>

                <View style={styles.featuresList}>
                    <FeatureItem icon={<Palette size={20} color="#a855f7" />} text={t('elite.feature_themes', 'Custom Profile Themes & Colors')} />
                    <FeatureItem icon={<ImageIcon size={20} color="#3b82f6" />} text={t('elite.feature_animations', 'Animated Avatar & Profile Banner')} />
                    <FeatureItem icon={<Sparkles size={20} color="#fbbf24" />} text={t('elite.feature_badges', 'Gold Name & Special Badge')} />
                    <FeatureItem icon={<Zap size={20} color="#ef4444" />} text={t('elite.feature_servers', 'Priority Server Access')} />
                </View>

                <View style={styles.plansContainer}>
                    {/* Monthly Plan */}
                    <View style={styles.planCard}>
                        <Text style={styles.planName}>{t('elite.plan_monthly', 'Monthly')}</Text>
                        <Text style={styles.planPrice}>$4.99<Text style={styles.period}>{t('elite.period_mo', '/mo')}</Text></Text>
                        <div style={{ width: '100%', marginTop: 16 }}>
                            <PayPalCheckoutButton
                                amount="4.99"
                                onApproved={(orderId) => handleSubscribe(orderId, 'monthly')}
                            />
                        </div>
                    </View>

                    {/* Yearly Plan - Best Value */}
                    <View style={[styles.planCard, styles.bestValueCard]}>
                        <div style={styles.bestValueBadge}>{t('elite.badge_best_value', 'BEST VALUE')}</div>
                        <Text style={styles.planName}>{t('elite.plan_yearly', 'Yearly')}</Text>
                        <Text style={styles.planPrice}>$39.99<Text style={styles.period}>{t('elite.period_yr', '/yr')}</Text></Text>
                        <Text style={styles.savings}>{t('elite.savings_17', 'Save 17%')}</Text>
                        <div style={{ width: '100%', marginTop: 16 }}>
                            <PayPalCheckoutButton
                                amount="39.99"
                                onApproved={(orderId) => handleSubscribe(orderId, 'yearly')}
                            />
                        </div>
                    </View>
                </View>
            </View>
        </View>
    );
};

const FeatureItem = ({ icon, text }) => (
    <View style={styles.featureRow}>
        <View style={styles.iconWrapper}>{icon}</View>
        <Text style={styles.featureText}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center', alignItems: 'center',
        zIndex: 5000,
        backdropFilter: 'blur(5px)'
    },
    container: {
        width: 800,
        maxWidth: '95vw',
        backgroundColor: '#0f172a',
        borderRadius: 24,
        padding: 40,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
        boxShadow: '0 0 50px rgba(251, 191, 36, 0.15)',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute', top: 20, right: 20,
        padding: 8, cursor: 'pointer', zIndex: 10
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        textShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: 18,
    },
    featuresList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 24,
        marginBottom: 40,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        paddingRight: 20,
        borderRadius: 12,
    },
    iconWrapper: {
        marginRight: 12,
    },
    featureText: {
        color: '#e2e8f0',
        fontSize: 15,
        fontWeight: '500',
    },
    plansContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        flexWrap: 'wrap',
    },
    planCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 24,
        width: 250,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    bestValueCard: {
        backgroundColor: 'rgba(251, 191, 36, 0.05)',
        borderColor: 'rgba(251, 191, 36, 0.4)',
        position: 'relative',
        transform: 'scale(1.05)',
    },
    bestValueBadge: {
        position: 'absolute',
        top: -12,
        backgroundColor: '#fbbf24',
        color: '#000',
        fontSize: 12,
        fontWeight: 'bold',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
        boxShadow: '0 4px 10px rgba(251, 191, 36, 0.3)',
    },
    planName: {
        color: '#94a3b8',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    planPrice: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    period: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '400',
    },
    savings: {
        color: '#22c55e',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
});

export default NexusEliteModal;
