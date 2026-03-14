/**
 * Notification Service
 * Handles native OS notifications and Electron taskbar badge syncing.
 * Gracefully falls back to no-ops when not running in Electron.
 */

// Request notification permission on first import
if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().then((perm) => {
        console.log('🔔 Notification permission:', perm);
    });
}

/**
 * Generate a Discord-style red badge as a Data URL using an offscreen canvas.
 * @param {number} count - The unread count to display
 * @returns {string} PNG Data URL of the badge
 */
const generateBadgeDataUrl = (count) => {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Draw red circle (Discord Red: #ED4245)
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ED4245';
    ctx.fill();

    // Draw white text
    const text = count > 9 ? '9+' : count.toString();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${count > 9 ? 16 : 20}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + 1);

    return canvas.toDataURL('image/png');
};

/**
 * Show a native OS notification.
 * In Electron, the HTML5 Notification API automatically bridges to native notifications.
 *
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {object} options - Optional settings
 * @param {function} options.onClick - Callback when notification is clicked
 * @param {boolean} options.skipFocusCheck - If true, show even when window is focused
 */
export const showNativeNotification = (title, body, options = {}) => {
    const { onClick, skipFocusCheck = false } = options;

    if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
        return;
    }

    // Don't notify if the window is focused (unless explicitly skipped for DMs)
    if (!skipFocusCheck && document.hasFocus()) {
        return;
    }

    try {
        const notification = new Notification(title, {
            body: body?.length > 80 ? body.substring(0, 77) + '...' : body,
            silent: false,
        });

        if (onClick) {
            notification.onclick = () => {
                window.focus();
                onClick();
            };
        }
    } catch (e) {
        console.warn('🔔 Notification failed:', e.message);
    }
};

/**
 * Update the OS-level badge count (Electron only).
 * On macOS: sets the dock badge number.
 * On Windows: renders a Discord-style red badge via canvas and sets it as an overlay icon.
 * Falls back to a no-op in browser dev mode.
 */
export const updateBadgeCount = (count) => {
    if (!window.electronAPI?.updateBadgeCount) return;

    if (count === 0) {
        window.electronAPI.updateBadgeCount(0, null);
    } else {
        const dataUrl = generateBadgeDataUrl(count);
        window.electronAPI.updateBadgeCount(count, dataUrl);
    }
};
