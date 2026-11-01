import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useAuthStore } from './store/authStore';
import { useFriendsStore } from './store/friendsStore';
import { useVoiceStore } from './store/voiceStore';
import { useServerStore } from './store/serverStore';
import { connectChatSocket } from './services/socket';
import { ThemeProvider } from './context/ThemeProvider';
import { updateBadgeCount } from './services/notificationService';
import { Toaster } from 'react-hot-toast';
import AudioPermissionBanner from './components/AudioPermissionBanner';

// Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import HomeScreen from './screens/HomeScreen';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return children;
};

const routerFutureConfig = { v7_startTransition: true, v7_relativeSplatPath: true };

function App() {
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const setupSocketListeners = useFriendsStore((state) => state.setupSocketListeners);
    const setupVoiceSocketListeners = useVoiceStore((state) => state.setupVoiceSocketListeners);

    useEffect(() => {
        if (isAuthenticated && user?._id) {
            // Connect to chat socket
            const socket = connectChatSocket();

            let handleConnect = null;
            let handlePresenceUpdate = null;

            if (socket) {
                // Reconnect & room join handler
                handleConnect = () => {
                    console.log("Joining my personal room:", user._id);
                    socket.emit("join_user_room", user._id);
                };

                if (socket.connected) {
                    handleConnect();
                }
                socket.off('connect', handleConnect);
                socket.on('connect', handleConnect);

                // Presence Listener with named handler
                handlePresenceUpdate = (data) => {
                    // console.log("Presence update:", data);
                    const { user_id, status } = data;
                    if (user_id && status) {
                        useServerStore.getState().updateMemberStatus(user_id, status);
                        useFriendsStore.getState().updateFriendStatus(user_id, status);
                    }
                };
                socket.off('presence_update', handlePresenceUpdate);
                socket.on('presence_update', handlePresenceUpdate);

                // Setup store listeners
                setupSocketListeners(socket);
                useServerStore.getState().setupSocketListeners(socket);
                if (setupVoiceSocketListeners) {
                    setupVoiceSocketListeners(socket);
                }
            }

            // Focus listener — auto-clear badge when user returns to the app
            const handleFocus = () => {
                const state = useFriendsStore.getState();
                const currentFriend = state.currentDMFriend;
                if (currentFriend) {
                    const friendId = currentFriend.id || currentFriend._id;
                    // Mark as read and clear unread for the active chat
                    const { dmAPI } = require('./services/api');
                    dmAPI.markAsRead(friendId).catch(() => { });
                    const newCounts = { ...state.unreadCounts };
                    const clearedCount = newCounts[friendId] || 0;
                    delete newCounts[friendId];
                    const newTotal = Math.max(0, state.totalUnread - clearedCount);
                    useFriendsStore.setState({ unreadCounts: newCounts, totalUnread: newTotal });
                    updateBadgeCount(newTotal);
                } else {
                    // No active chat, just clear the badge flash
                    updateBadgeCount(useFriendsStore.getState().totalUnread);
                }
            };
            window.addEventListener('focus', handleFocus);

            // Cleanup
            return () => {
                window.removeEventListener('focus', handleFocus);
                if (socket) {
                    if (handleConnect) socket.off('connect', handleConnect);
                    if (handlePresenceUpdate) socket.off('presence_update', handlePresenceUpdate);
                }
            };
        }
    }, [isAuthenticated, user, setupSocketListeners]);

    // Debug: verify PayPal Client ID is injected at build time
    const paypalClientId = process.env.REACT_APP_PAYPAL_CLIENT_ID;
    console.log('PayPal Client ID:', paypalClientId ? `${paypalClientId.substring(0, 8)}...` : '❌ MISSING');

    return (
        <PayPalScriptProvider options={{
            'client-id': paypalClientId || 'sb',
            currency: 'USD',
            intent: 'capture',
        }}>
            <Toaster
                position="top-center"
                toastOptions={{
                    style: {
                        background: '#333',
                        color: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #444'
                    }
                }}
            />
            <AudioPermissionBanner />
            <ThemeProvider>
                <BrowserRouter future={routerFutureConfig}>
                    <Routes>
                        {/* Public Routes */}
                        <Route
                            path="/login"
                            element={
                                <PublicRoute>
                                    <LoginScreen />
                                </PublicRoute>
                            }
                        />
                        <Route
                            path="/register"
                            element={
                                <PublicRoute>
                                    <RegisterScreen />
                                </PublicRoute>
                            }
                        />
                        <Route
                            path="/forgot-password"
                            element={
                                <PublicRoute>
                                    <ForgotPasswordScreen />
                                </PublicRoute>
                            }
                        />
                        <Route
                            path="/verify-email"
                            element={
                                <PublicRoute>
                                    <VerifyEmailScreen />
                                </PublicRoute>
                            }
                        />

                        {/* Protected Routes */}
                        <Route
                            path="/*"
                            element={
                                <ProtectedRoute>
                                    <HomeScreen />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </BrowserRouter>
            </ThemeProvider>
        </PayPalScriptProvider>
    );
}

export default App;

