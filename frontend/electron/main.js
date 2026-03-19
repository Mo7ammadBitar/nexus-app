const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 940,
        minHeight: 600,
        title: 'Nexus',
        backgroundColor: '#1a1a2e',
        icon: path.join(__dirname, '../public/favicon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false  // Prevent Chromium from suspending WebSockets
        },
        frame: true,
        autoHideMenuBar: true
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Handle window title
    mainWindow.on('page-title-updated', (e) => {
        e.preventDefault();
    });

    // Stop flashing when window gains focus
    mainWindow.on('focus', () => {
        mainWindow.flashFrame(false);
    });
}

// --- IPC Handlers ---

// Update OS badge count / taskbar overlay icon
ipcMain.on('update-badge-count', (event, count, dataUrl) => {
    if (process.platform === 'darwin') {
        app.setBadgeCount(count);
    } else if (process.platform === 'win32') {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;

        if (count === 0) {
            // Clear the overlay icon
            win.setOverlayIcon(null, '');
            win.flashFrame(false);
        } else {
            // Set the Discord-style red badge overlay
            if (dataUrl) {
                try {
                    const overlay = nativeImage.createFromDataURL(dataUrl);
                    win.setOverlayIcon(overlay, `${count} unread notifications`);
                } catch (e) {
                    console.error('Failed to create overlay icon:', e);
                }
            }
            // Brief taskbar flash if window not focused
            if (!win.isFocused()) {
                win.flashFrame(true);
            }
        }
    }
});

app.whenReady().then(() => {
    // --- Content Security Policy ---
    // Allow connections to both localhost (dev) and Azure (prod)
    const { session } = require('electron');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
                    "connect-src 'self' " +
                        "http://localhost:* ws://localhost:* " +
                        "https://nexus-backend-api-1-e8dabjgja2gqfdh2.spaincentral-01.azurewebsites.net " +
                        "wss://nexus-backend-api-1-e8dabjgja2gqfdh2.spaincentral-01.azurewebsites.net " +
                        "https://*.cloudinary.com " +
                        "https://pagead2.googlesyndication.com " +
                        "https://www.paypal.com https://www.sandbox.paypal.com; " +
                    "img-src 'self' data: blob: http://localhost:* " +
                        "https://nexus-backend-api-1-e8dabjgja2gqfdh2.spaincentral-01.azurewebsites.net " +
                        "https://*.cloudinary.com https://*; " +
                    "media-src 'self' blob: http://localhost:* " +
                        "https://nexus-backend-api-1-e8dabjgja2gqfdh2.spaincentral-01.azurewebsites.net; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.doubleclick.net https://www.paypal.com https://www.sandbox.paypal.com; " +
                    "frame-src 'self' https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.paypal.com https://www.sandbox.paypal.com;"
                ]
            }
        });
    });

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
