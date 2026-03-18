import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAuraNameStyle } from '../utils/PremiumAura';
import { validateEmail } from '../utils/validation';

const LoginScreen = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { login, isLoading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        clearError();
        setLocalError('');
    }, []);

    const handleLogin = async () => {
        setLocalError('');

        if (!email || !password) return;

        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            setLocalError(emailValidation.message);
            return;
        }

        const result = await login(email, password);
        if (result.success) {
            navigate('/');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    };

    return (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <View style={styles.container}>
                <View style={styles.card}>
                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logo}>
                            <Text style={styles.logoText}>N</Text>
                        </View>
                        <Text style={styles.title}>{t('login.welcome_title', 'Welcome back, Traveler!')}</Text>
                        <Text style={styles.subtitle}>{t('login.welcome_subtitle', 'The server awaits your return.')}</Text>
                    </View>

                    {/* Error Message */}
                    {(error || localError) && (error || localError) !== 'Email not found' && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{localError || error}</Text>
                        </View>
                    )}

                    {error === 'Email not found' && (
                        <View style={styles.notFoundContainer}>
                            <Text style={styles.notFoundText}>{t('login.error_unknown', 'Member Mark unknown')}</Text>
                            <Text style={styles.notFoundSubText}>
                                {t('login.error_new', 'Seems you are new to this plane!')}
                            </Text>
                        </View>
                    )}

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('login.email_label', 'SPIRIT MARK')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('login.email_placeholder', 'Enter your Member Mark')}
                                placeholderTextColor="#6b7280"
                                value={email}
                                onChangeText={(text) => setEmail(text)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                onKeyPress={handleKeyPress}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('login.password_label', 'SECRET KEY')}</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder={t('login.password_placeholder', 'Enter your Secret Key')}
                                    placeholderTextColor="#6b7280"
                                    value={password}
                                    onChangeText={(text) => setPassword(text)}
                                    secureTextEntry={!showPassword}
                                    onKeyPress={handleKeyPress}
                                />
                                <TouchableOpacity
                                    style={styles.eyeIcon}
                                    onPress={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff size={20} color="#6b7280" />
                                    ) : (
                                        <Eye size={20} color="#6b7280" />
                                    )}
                                </TouchableOpacity>
                            </View>
                            <Link to="/forgot-password" style={{ textDecoration: 'none' }}>
                                <Text style={styles.forgotLink}>{t('login.forgot_password', 'Lost your Key?')}</Text>
                            </Link>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            <Text style={styles.buttonText}>
                                {isLoading ? t('login.button_loading', 'Manifesting...') : t('login.button_active', 'Manifest')}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>{t('login.register_prompt', 'New to the Server? ')}</Text>
                            <Link to="/register" style={{ textDecoration: 'none' }}>
                                <Text style={[styles.link, error === 'Email not found' && getAuraNameStyle(true, '#f59e0b')]}>
                                    {t('login.register_link', 'Inscribe')}
                                </Text>
                            </Link>
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollContainer: {
        flex: 1,
        height: '100dvh',
        backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
        padding: 20,
    },
    container: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
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
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        boxShadow: '0 10px 30px rgba(124, 58, 237, 0.4)',
    },
    logoText: {
        color: '#fff',
        fontSize: 36,
        fontWeight: '700',
    },
    title: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        color: '#b4b4b4',
        fontSize: 15,
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
    form: {
        width: '100%',
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
    forgotLink: {
        color: '#8b5cf6',
        fontSize: 13,
        marginTop: 8,
        textDecorationLine: 'none',
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        color: '#6b7280',
        fontSize: 14,
    },
    link: {
        color: '#8b5cf6',
        fontSize: 14,
        fontWeight: '500',
        textDecorationLine: 'none',
    },
    notFoundContainer: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
        borderLeftColor: '#f59e0b',
        alignItems: 'center',
    },
    notFoundText: {
        color: '#f59e0b',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    notFoundSubText: {
        color: '#d1d5db',
        fontSize: 14,
        marginBottom: 8,
    },
    registerLinkAura: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

export default LoginScreen;