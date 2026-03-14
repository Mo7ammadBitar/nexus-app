import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en.json';
import arTranslation from './locales/ar.json';
import frTranslation from './locales/fr.json';
import esTranslation from './locales/es.json';
import jaTranslation from './locales/ja.json';
import ruTranslation from './locales/ru.json';
import zhTranslation from './locales/zh.json';
import ptTranslation from './locales/pt.json';

const resources = {
    en: { translation: enTranslation },
    ar: { translation: arTranslation },
    fr: { translation: frTranslation },
    es: { translation: esTranslation },
    ja: { translation: jaTranslation },
    ru: { translation: ruTranslation },
    zh: { translation: zhTranslation },
    pt: { translation: ptTranslation }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
        }
    });

// RTL Logic (Disabled per user request)
i18n.on('languageChanged', (lng) => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = lng;
});

export default i18n;
