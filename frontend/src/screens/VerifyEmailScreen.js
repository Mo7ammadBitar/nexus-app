import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

const VerifyEmailScreen = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { verifyEmail, isLoading, error, clearError } = useAuthStore();

    const [otp, setOtp] = useState('');
    const [localError, setLocalError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const email = location.state?.email;

    useEffect(() => {
        clearError();
        if (!email) {
            navigate('/login');
        }
    }, [email, navigate, clearError]);

    const handleVerify = async () => {
        setLocalError('');

        if (!otp || otp.length !== 6) {
            setLocalError(t('verify_email.error_invalid_otp', 'Please enter the 6-digit verification code.'));
            return;
        }

        const result = await verifyEmail(email, otp);
        if (result.success) {
            setSuccessMessage(t('verify_email.success', 'Email verified successfully! Redirecting...'));
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        }
    };

    const displayError = localError || error;

    if (!email) return null;

    return (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <View style={styles.container}>
                <View style={styles.card}>
                    <View style={styles.iconContainer}>
                        <Mail size={48} color="#a855f7" />
                    </View>

                    <Text style={styles.title}>{t('verify_email.title', 'Verify Your Mark')}</Text>
                    <Text style={styles.subtitle}>
                        {t('verify_email.subtitle', "We've sent a 6-digit glyph to {{email}}. Enter it below to complete your registration.", { email })}
                    </Text>

                    {displayError ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{displayError}</Text>
                        </View>
                    ) : null}

                    {successMessage ? (
                        <View style={styles.successContainer}>
                            <Text style={styles.successText}>{successMessage}</Text>
                        </View>
                    ) : null}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('verify_email.otp_label', 'VERIFICATION GLYPH')}</Text>
                        <TextInput
                            style={[styles.input, styles.otpInput]}
                            placeholder="000000"
                            placeholderTextColor="#6b7280"
                            value={otp}
                            onChangeText={(text) => { setOtp(text.replace(/\D/g, '').slice(0, 6)); clearError(); setLocalError(''); }}
                            keyboardType="number-pad"
                            maxLength={6}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleVerify}
                        disabled={isLoading || !!successMessage}
                    >
                        <Text style={styles.buttonText}>
                            {isLoading ? t('verify_email.btn_verifying', 'Verifying...') : t('verify_email.btn_verify', 'Verify & Login')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.resendLink} onPress={() => navigate('/login')}>
                        <Text style={styles.resendLinkText}>{t('verify_email.btn_login', 'Go back to Login')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollContainer: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: 20,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    },
    card: {
        backgroundColor: '#16213e',
        borderRadius: 16,
        padding: 40,
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        color: '#b4b4b4',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
        borderLeftColor: '#ef4444',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
    },
    successContainer: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
        borderLeftColor: '#10b981',
    },
    successText: {
        color: '#10b981',
        fontSize: 14,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: '#b4b4b4',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        padding: 14,
        color: '#fff',
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        outlineWidth: 0,
    },
    otpInput: {
        textAlign: 'center',
        fontSize: 24,
        letterSpacing: 8,
        fontWeight: '600',
    },
    button: {
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        marginTop: 10,
        boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)',
        cursor: 'pointer',
    },
    buttonDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    buttonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    resendLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    resendLinkText: {
        color: '#8b5cf6',
        fontSize: 14,
    },
});

export default VerifyEmailScreen;
