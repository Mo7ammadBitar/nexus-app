/**
 * NEXUS Theme Provider - Fixed Logic
 * Separates Client Theme (Backgrounds) from Profile Accent (Borders/Glows)
 */

import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const ThemeContext = createContext({
    accentColor: '#7c3aed',
    themeColor: '#7c3aed',
    applyAccentColor: () => { },
    applyThemeColor: () => { },
});

//Helper Functions
const hexToRgb = (hex) => {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

const mixWithBlack = (rgb, factor) => {
    return `rgb(${Math.round(rgb.r * (1 - factor))}, ${Math.round(rgb.g * (1 - factor))}, ${Math.round(rgb.b * (1 - factor))})`;
};

const mixWithWhite = (rgb, factor) => {
    return `rgb(${Math.round(rgb.r + (255 - rgb.r) * factor)}, ${Math.round(rgb.g + (255 - rgb.g) * factor)}, ${Math.round(rgb.b + (255 - rgb.b) * factor)})`;
};

// ============================================
// CSS APPLICATORS (Isolated Logic)
// ============================================

// 1. Theme CSS: Controls Backgrounds, Sidebar, Hovers
const setThemeCSS = (themeColor) => {
    const root = document.documentElement;

    if (themeColor) {
        const rgb = hexToRgb(themeColor);
        if (rgb) {
            // Generate palette based on selected color
            root.style.setProperty('--bg-tertiary', mixWithBlack(rgb, 0.92)); // Darkest (Sidebar/Inputs)
            root.style.setProperty('--sidebar-bg', mixWithBlack(rgb, 0.92));
            root.style.setProperty('--bg-secondary', mixWithBlack(rgb, 0.85)); // Medium (Members/Headers)
            root.style.setProperty('--bg-primary', mixWithBlack(rgb, 0.88)); // Main (Chat)
            root.style.setProperty('--bg-quaternary', mixWithBlack(rgb, 0.80)); // Hover states

            // App Tint
            root.style.setProperty('--app-bg-gradient',
                `linear-gradient(180deg, ${mixWithBlack(rgb, 0.9)} 0%, ${mixWithBlack(rgb, 0.95)} 100%)`
            );

            // Dynamic Theme Highlights (Gradient & Glow)
            const lightColor = mixWithWhite(rgb, 0.2); // 20% Lighter for gradient end
            root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${themeColor} 0%, ${lightColor} 100%)`);
            root.style.setProperty('--theme-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);

            // Active Item Backgrounds (Channels/Sidebar Icons)
            root.style.setProperty('--active-item-bg', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
            return;
        }
    }

    // Default Fallback (Dark Blue Theme + Purple Highlights)
    root.style.setProperty('--bg-primary', '#1a1a2e');
    root.style.setProperty('--bg-secondary', '#16213e');
    root.style.setProperty('--bg-tertiary', '#0f3460');
    root.style.setProperty('--bg-quaternary', '#1e1e3f');
    root.style.setProperty('--sidebar-bg', '#0f3460');
    root.style.setProperty('--app-bg-gradient', 'none');

    // Reset to Purple Defaults
    root.style.setProperty('--theme-gradient', 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)');
    root.style.setProperty('--theme-glow', 'rgba(124, 58, 237, 0.4)');
    root.style.setProperty('--active-item-bg', 'rgba(124, 58, 237, 0.15)');
};

// 2. Accent CSS: Controls Borders, Name Glows, Primary Buttons
const setAccentCSS = (accentColor) => {
    const root = document.documentElement;
    const color = accentColor || '#7c3aed'; // Default Purple
    const rgb = hexToRgb(color);

    if (rgb) {
        root.style.setProperty('--user-accent', color);
        root.style.setProperty('--user-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        root.style.setProperty('--user-accent-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
        root.style.setProperty('--scrollbar-thumb', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
    }
};

// ============================================
// COMPONENT
// ============================================

export const ThemeProvider = ({ children }) => {
    const user = useAuthStore((state) => state.user);

    // Refs to track state and prevent loops
    const lastTheme = useRef(null);
    const lastAccent = useRef(null);
    const isInitialized = useRef(false);

    // Initial Load Logic
    useEffect(() => {
        if (user && !isInitialized.current) {
            // Apply Saved Theme
            if (user.theme_color) {
                setThemeCSS(user.theme_color);
                lastTheme.current = user.theme_color;
            } else {
                setThemeCSS(null); // Force Default
            }

            // Apply Saved Accent
            const accent = user.accent_color || '#7c3aed';
            setAccentCSS(accent);
            lastAccent.current = accent;

            isInitialized.current = true;
        }
    }, [user]);

    // Live Preview / Update Handlers
    const applyThemeColor = useCallback((color) => {
        // Only update if color actually changed
        if (color !== lastTheme.current) {
            setThemeCSS(color);
            lastTheme.current = color;
        }
    }, []);

    const applyAccentColor = useCallback((color) => {
        if (color !== lastAccent.current) {
            setAccentCSS(color);
            lastAccent.current = color;
        }
    }, []);

    return (
        <ThemeContext.Provider value={{
            accentColor: user?.accent_color,
            themeColor: user?.theme_color,
            applyAccentColor,
            applyThemeColor
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeProvider;