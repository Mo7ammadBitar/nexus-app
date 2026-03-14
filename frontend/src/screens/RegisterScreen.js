import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { validateEmail, validatePassword } from '../utils/validation';

const RegisterScreen = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { register, isLoading, error, clearError } = useAuthStore();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        clearError();
    }, []);

    const handleRegister = async () => {
        setLocalError('');

        if (!username || !email || !password || !confirmPassword) {
            setLocalError(t('register.error_empty_fields', 'Please fill in all fields'));
            return;
        }

        if (password !== confirmPassword) {
            setLocalError(t('register.error_passwords_match', 'Passwords do not match'));
            return;
        }


        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            setLocalError(emailValidation.message);
            return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            setLocalError(passwordValidation.message);
            return;
        }

        if (password !== confirmPassword) {
            setLocalError(t('register.error_passwords_match', 'Passwords do not match'));
            return;
        }

        const result = await register(username, email, password);
        if (result.success) {
            navigate('/verify-email', { state: { email } });
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleRegister();
        }
    };

    const displayError = localError || error;

    return (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <View style={styles.container}>
                <View style={styles.card}>
                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logo}>
                            <Text style={styles.logoText}>N</Text>
                        </View>
                        <Text style={styles.title}>{t('register.title', 'Inscribe your Essence')}</Text>
                    </View>

                    {/* Error Message */}
                    {displayError && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{displayError}</Text>
                        </View>
                    )}

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('register.username_label', 'TRUE NAME')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('register.username_placeholder', 'Choose a unique True Name')}
                                placeholderTextColor="#6b7280"
                                value={username}
                                onChangeText={(text) => { setUsername(text); clearError(); setLocalError(''); }}
                                autoCapitalize="none"
                                onKeyPress={handleKeyPress}
                            />
                            <Text style={styles.hint}>{t('register.username_hint', 'This cannot be changed later')}</Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('register.email_label', 'SPIRIT MARK')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('register.email_placeholder', 'Enter your Member Mark')}
                                placeholderTextColor="#6b7280"
                                value={email}
                                onChangeText={(text) => { setEmail(text); clearError(); setLocalError(''); }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                onKeyPress={handleKeyPress}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('register.password_label', 'SECRET KEY')}</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder={t('register.password_placeholder', 'Create a Secret Key')}
                                    placeholderTextColor="#6b7280"
                                    value={password}
                                    onChangeText={(text) => { setPassword(text); clearError(); setLocalError(''); }}
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
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>{t('register.confirm_password_label', 'CONFIRM KEY')}</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder={t('register.confirm_password_placeholder', 'Confirm your Secret Key')}
                                    placeholderTextColor="#6b7280"
                                    value={confirmPassword}
                                    onChangeText={(text) => { setConfirmPassword(text); clearError(); setLocalError(''); }}
                                    secureTextEntry={!showConfirmPassword}
                                    onKeyPress={handleKeyPress}
                                />
                                <TouchableOpacity
                                    style={styles.eyeIcon}
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff size={20} color="#6b7280" />
                                    ) : (
                                        <Eye size={20} color="#6b7280" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled]}
                            onPress={handleRegister}
                            disabled={isLoading}
                        >
                            <Text style={styles.buttonText}>
                                {isLoading ? t('register.button_loading', 'Inscribing...') : t('register.button_active', 'Inscribe')}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Link to="/login" style={{ textDecoration: 'none' }}>
                                <Text style={styles.link}>{t('register.login_link', 'Already inscribed?')}</Text>
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
        height: '100vh',
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
        marginBottom: 18,
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
    hint: {
        color: '#6b7280',
        fontSize: 12,
        marginTop: 6,
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
    link: {
        color: '#8b5cf6',
        fontSize: 14,
        fontWeight: '500',
        textDecorationLine: 'none',
    },
});

export default RegisterScreen;
