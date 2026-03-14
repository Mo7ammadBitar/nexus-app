import React from 'react';
import { createRoot } from 'react-dom/client';

// --- بداية الـ Polyfills (عشان تشغيل axios و voice chat) ---
import { Buffer } from 'buffer';
import processPolyfill from 'process';

// تعريف المتغيرات العامة يدوياً
if (typeof window !== 'undefined') {
    window.global = window;
    window.process = processPolyfill;
    window.Buffer = Buffer;
}
// --- نهاية الـ Polyfills ---

import './i18n';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);