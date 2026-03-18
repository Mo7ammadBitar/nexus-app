import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, Mail, Key, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../services/api';

const ForgotPasswordScreen = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Step: 'email' | 'otp' | 'success'
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleRequestOTP = async () => {
        if (!email) {
            setError(t('forgot_password.error_enter_email', 'Please enter your email'));
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await authAPI.forgotPassword(email);
            setMessage(response.message);
            setStep('otp');
        } catch (err) {
            setError(err.response?.data?.detail || t('forgot_password.error_send_failed', 'Failed to send reset email'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setError('');

        if (!otp) {
            setError(t('forgot_password.error_enter_otp', 'Please enter the OTP code'));
            return;
        }

        if (newPassword.length < 6) {
            setError(t('forgot_password.error_password_length', 'Password must be at least 6 characters'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('forgot_password.error_passwords_match', 'Passwords do not match'));
            return;
        }

        setIsLoading(true);

        try {
            await authAPI.resetPassword(email, otp, newPassword);
            setStep('success');
        } catch (err) {
            setError(err.response?.data?.detail || t('forgot_password.error_reset_failed', 'Failed to reset password'));
        } finally {
            setIsLoading(false);
        }
    };

    const renderEmailStep = () => (
        <View>
            <View style={styles.iconContainer}>
                <Mail size={48} color="#a855f7" />
            </View>
            <Text style={styles.title}>{t('forgot_password.title', 'Lost your Key?')}</Text>
            <Text style={styles.subtitle}>
                {t('forgot_password.subtitle', "Enter your Member Mark and we'll send you a glyph to reset your key.")}
            </Text>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('forgot_password.email_label', 'SPIRIT MARK')}</Text>
                <TextInput
                    style={styles.input}
                    placeholder={t('forgot_password.email_placeholder', 'Enter your Member Mark')}
                    placeholderTextColor="#6b7280"
                    value={email}
                    onChangeText={(text) => { setEmail(text); setError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onKeyPress={(e) => e.key === 'Enter' && handleRequestOTP()}
                />
            </View>
            <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRequestOTP}
                disabled={isLoading}
            >
                <Text style={styles.buttonText}>
                    {isLoading ? t('forgot_password.btn_sending', 'Sending...') : t('forgot_password.btn_send_glyph', 'Send Restoration Glyph')}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderOtpStep = () => (
        <View>
            <View style={styles.iconContainer}>
                <Key size={48} color="#a855f7" />
            </View>
            <Text style={styles.title}>{t('forgot_password.otp_title', 'Enter Restoration Glyph')}</Text>
            <Text style={styles.subtitle}>
                {t('forgot_password.otp_subtitle', "We've sent a 6-digit glyph to {{email}}. Enter it below with your new key.", { email })}
            </Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('forgot_password.otp_label', 'RESTORATION GLYPH')}</Text>
                <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="000000"
                    placeholderTextColor="#6b7280"
                    value={otp}
                    onChangeText={(text) => { setOtp(text.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    keyboardType="number-pad"
                    maxLength={6}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('forgot_password.new_key_label', 'NEW SECRET KEY')}</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder={t('forgot_password.new_key_placeholder', 'Enter new Secret Key')}
                        placeholderTextColor="#6b7280"
                        value={newPassword}
                        onChangeText={(text) => { setNewPassword(text); setError(''); }}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('forgot_password.confirm_key_label', 'CONFIRM KEY')}</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder={t('forgot_password.confirm_key_placeholder', 'Confirm new Secret Key')}
                        placeholderTextColor="#6b7280"
                        value={confirmPassword}
                        onChangeText={(text) => { setConfirmPassword(text); setError(''); }}
                        secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        {showConfirmPassword ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}
            >
                <Text style={styles.buttonText}>
                    {isLoading ? t('forgot_password.btn_restoring', 'Restoring...') : t('forgot_password.btn_restore', 'Restore Key')}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendLink} onPress={() => setStep('email')}>
                <Text style={styles.resendLinkText}>{t('forgot_password.btn_go_back', "Didn't receive glyph? Go back")}</Text>
            </TouchableOpacity>
        </View>
    );

    const renderSuccessStep = () => (
        <View>
            <View style={[styles.iconContainer, styles.successIcon]}>
                <Check size={48} color="#10b981" />
            </View>
            <Text style={styles.title}>{t('forgot_password.success_title', 'Key Restored!')}</Text>
            <Text style={styles.subtitle}>
                {t('forgot_password.success_subtitle', "Your Secret Key has been restored successfully. You can now manifest with your new key.")}
            </Text>

            <TouchableOpacity
                style={styles.button}
                onPress={() => navigate('/login')}
            >
                <Text style={styles.buttonText}>{t('forgot_password.btn_go_to_manifest', 'Go to Manifest')}</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <View style={styles.container}>
                <View style={styles.card}>
                    {step !== 'success' && (
                        <TouchableOpacity style={styles.backButton} onPress={() => navigate('/login')}>
                            <ArrowLeft size={20} color="#b4b4b4" />
                            <Text style={styles.backText}>{t('forgot_password.btn_back', 'Back to Manifest')}</Text>
                        </TouchableOpacity>
                    )}
                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}
                    {message && step === 'otp' ? (
                        <View style={styles.successContainer}>
                            <Text style={styles.successText}>{message}</Text>
                        </View>
                    ) : null}
                    {step === 'email' ? renderEmailStep() : null}
                    {step === 'otp' ? renderOtpStep() : null}
                    {step === 'success' ? renderSuccessStep() : null}
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
        minHeight: '100dvh',
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
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        cursor: 'pointer',
    },
    backText: {
        color: '#b4b4b4',
        fontSize: 14,
        marginLeft: 8,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    successIcon: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        padding: 20,
        borderRadius: 50,
        alignSelf: 'center',
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
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f3460',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    passwordInput: {
        flex: 1,
        padding: 14,
        color: '#fff',
        fontSize: 15,
        outlineWidth: 0,
        backgroundColor: 'transparent',
    },
    eyeIcon: {
        padding: 14,
        cursor: 'pointer',
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

export default ForgotPasswordScreen;
