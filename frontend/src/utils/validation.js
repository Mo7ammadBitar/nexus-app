import i18n from '../i18n';

export const validateEmail = (email) => {
    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, message: i18n.t('validation.invalid_email_format', 'Invalid email format. Use format: example@domain.com') };
    }

    // Domain check (Checking for common valid domains + general structure)
    const domain = email.split('@')[1].toLowerCase();
    const commonDomains = [
        'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
        'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com',
        'yandex.com', 'mail.com', 'gmx.com', 'live.com',
        'me.com', 'msn.com', 'comcast.net', 'verizon.net', 'envato.com'
    ];

    // Strict domain check as per user request
    if (!commonDomains.includes(domain)) {
        return {
            isValid: false,
            message: i18n.t('validation.unsupported_email_domain', 'Please use a supported email provider (e.g., Gmail, Yahoo, Outlook).')
        };
    }

    return { isValid: true };
};

export const validatePassword = (password) => {
    if (password.length < 8) {
        return { isValid: false, message: i18n.t('validation.password_too_short', 'Password must be at least 8 characters long.') };
    }

    // Check for at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLetter || !hasNumber) {
        return { isValid: false, message: i18n.t('validation.password_requirements', 'Password must contain at least 1 letter and 1 number.') };
    }

    return { isValid: true };
};
