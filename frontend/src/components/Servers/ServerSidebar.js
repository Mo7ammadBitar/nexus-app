import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native-web';
import { useServerStore } from '../../store/serverStore';
import { useFriendsStore } from '../../store/friendsStore';
import { useUIStore } from '../../store/uiStore';
import { Search, Users, Plus, Sparkles, Link, ShoppingBag, Crown, Gamepad2 } from 'lucide-react';
import GlobalSearch from '../Search/GlobalSearch';
import EtherealShop from '../Shop/EtherealShop';
import { useTranslation } from 'react-i18next';

const ServerSidebar = ({ onOpenFriends, onOpenPrime }) => {
    const { t } = useTranslation();
    const { servers, currentServer, selectServer, createServer, joinServer, fetchServers } = useServerStore();
    const { pendingRequests, fetchPendingRequests, totalUnread, fetchUnreadCounts } = useFriendsStore();
    const [showModal, setShowModal] = useState(null);
    const [serverName, setServerName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const { isShopOpen: showShop, setShopOpen: setShowShop, setShowGamingHub, setShowPrimeScreen } = useUIStore();

    // Fetch pending requests and unread counts on mount
    useEffect(() => {
        fetchPendingRequests();
        fetchUnreadCounts();

        // Keyboard listener for Ctrl+K / Cmd+K
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowSearch(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleCreateServer = async () => {
        if (!serverName.trim()) return;
        const result = await createServer(serverName.trim());
        if (result.success) {
            setShowModal(null);
            setServerName('');
            selectServer(result.server._id);
        } else {
            setError(result.error);
        }
    };

    const handleJoinServer = async () => {
        if (!inviteCode.trim()) return;
        const result = await joinServer(inviteCode.trim());
        if (result.success) {
            setShowModal(null);
            setInviteCode('');
        } else {
            setError(result.error);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: 'var(--bg-tertiary)', transition: 'background-color 0.3s ease' }]}>
            <ScrollView style={styles.serverList}>
                {/* Search Button */}
                <TouchableOpacity
                    style={styles.searchIcon}
                    onPress={() => setShowSearch(true)}
                    title="Search (Ctrl+K)"
                >
                    <Search size={22} color="#10b981" />
                </TouchableOpacity>

                <View style={styles.separator} />

                {/* Friends Button */}
                <TouchableOpacity
                    style={[
                        styles.friendsIcon,
                        !currentServer && styles.serverIconActive
                    ]}
                    onPress={onOpenFriends}
                >
                    <Users size={26} color={pendingRequests.length > 0 || totalUnread > 0 ? "#fff" : (!currentServer ? "#fff" : "#b9bbbe")} />
                    {!currentServer && (
                        <div style={StyleSheet.flatten(styles.activeIndicator)} />
                    )}
                    {(pendingRequests.length > 0 || totalUnread > 0) && (
                        <View style={styles.notificationBadge}>
                            <Text style={styles.badgeText}>
                                {(() => {
                                    const total = pendingRequests.length + totalUnread;
                                    return total > 9 ? '9+' : total;
                                })()}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <div style={StyleSheet.flatten(styles.separator)} />

                {/* Server Icons */}
                {servers?.map((server) => {
                    if (!server) return null;
                    return (
                        <TouchableOpacity
                            key={server._id}
                            style={[
                                styles.serverIcon,
                                currentServer?._id === server._id && styles.serverIconActive
                            ]}
                            onPress={() => selectServer(server._id)}
                        >
                            {server.icon_url ? (
                                <img
                                    src={server.icon_url}
                                    alt={server.name}
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 24,
                                        objectFit: 'cover',
                                    }}
                                />
                            ) : (
                                <Text style={styles.serverIconText}>
                                    {server.name?.charAt(0).toUpperCase()}
                                </Text>
                            )}
                            {currentServer?._id === server._id && (
                                <div style={StyleSheet.flatten(styles.activeIndicator)} />
                            )}
                        </TouchableOpacity>
                    );
                })}

                <div style={StyleSheet.flatten(styles.separator)} />

                {/* Add Server Button */}
                <TouchableOpacity
                    style={styles.addServerBtn}
                    onPress={() => setShowModal('add')}
                >
                    <Plus size={28} color="#10b981" />
                </TouchableOpacity>

                <div style={StyleSheet.flatten(styles.separator)} />

                {/* Shop Button */}
                <TouchableOpacity
                    style={styles.shopIcon}
                    onPress={() => setShowShop(true)}
                    title="Ethereal Shop"
                >
                    <ShoppingBag size={24} color="#f59e0b" />
                </TouchableOpacity>

                <div style={StyleSheet.flatten(styles.separator)} />

                {/* Gaming Hub Button */}
                <TouchableOpacity
                    style={styles.gamingIcon}
                    onPress={() => {
                        useServerStore.getState().clearServer();
                        useFriendsStore.getState().closeDM();
                        setShowPrimeScreen(false);
                        setShowGamingHub(true);
                        useUIStore.getState().setMobileView('chat');
                    }}
                    title="Gaming Hub"
                >
                    <Gamepad2 size={24} color="#22c55e" />
                </TouchableOpacity>

                <div style={StyleSheet.flatten(styles.separator)} />

                {/* Prime Button */}
                <TouchableOpacity
                    style={styles.primeIcon}
                    onPress={() => {
                        if (onOpenPrime) onOpenPrime();
                        useUIStore.getState().setMobileView('chat');
                    }}
                    title="Nexus Prime"
                >
                    <Crown size={24} color="#a855f7" />
                </TouchableOpacity>
            </ScrollView>

            {/* Modal - using React Portal for proper overlay */}
            {showModal && ReactDOM.createPortal(
                <div style={modalStyles.overlay}>
                    <style>{`
                        @media (max-width: 768px) {
                            .mobile-server-modal {
                                width: 100vw !important;
                                max-width: 100vw !important;
                                height: 100dvh !important;
                                max-height: 100dvh !important;
                                border-radius: 0 !important;
                                padding-top: 40px !important;
                                justify-content: flex-start !important;
                                display: flex !important;
                                flex-direction: column !important;
                            }
                        }
                    `}</style>
                    <div style={modalStyles.modal} className="mobile-server-modal">
                        <h2 style={modalStyles.title}>
                            {showModal === 'add' ? t('server_sidebar.modal_add_title', 'Add a Realm') :
                                showModal === 'create' ? t('server_sidebar.modal_create_title', 'Forge a Realm') : t('server_sidebar.modal_join_title', 'Enter a Realm')}
                        </h2>

                        {showModal === 'add' && (
                            <div style={modalStyles.buttons}>
                                <button
                                    style={modalStyles.optionBtn}
                                    onClick={() => { setShowModal('create'); setError(''); }}
                                >
                                    <span style={{ ...modalStyles.optionIcon, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={24} color="#fff" /></span>
                                    <span style={modalStyles.optionText}>{t('server_sidebar.btn_forge_new', 'Create New Server')}</span>
                                </button>
                                <button
                                    style={modalStyles.optionBtn}
                                    onClick={() => { setShowModal('join'); setError(''); }}
                                >
                                    <span style={{ ...modalStyles.optionIcon, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Link size={24} color="#fff" /></span>
                                    <span style={modalStyles.optionText}>{t('server_sidebar.btn_enter', 'Enter a Realm')}</span>
                                </button>
                            </div>
                        )}

                        {showModal === 'create' && (
                            <div style={modalStyles.form}>
                                {error && <p style={modalStyles.error}>{error}</p>}
                                <input
                                    style={modalStyles.input}
                                    placeholder={t('server_sidebar.input_realm_name', 'Server name')}
                                    value={serverName}
                                    onChange={(e) => setServerName(e.target.value)}
                                    autoFocus
                                />
                                <button style={modalStyles.submitBtn} onClick={handleCreateServer}>
                                    {t('server_sidebar.btn_forge_submit', 'Create Server')}
                                </button>
                            </div>
                        )}

                        {showModal === 'join' && (
                            <div style={modalStyles.form}>
                                {error && <p style={modalStyles.error}>{error}</p>}
                                <input
                                    style={modalStyles.input}
                                    placeholder={t('server_sidebar.input_gate_key', 'Enter Invite Code')}
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value)}
                                    autoFocus
                                />
                                <button style={modalStyles.submitBtn} onClick={handleJoinServer}>
                                    {t('server_sidebar.btn_enter', 'Enter Server')}
                                </button>
                            </div>
                        )}

                        <button
                            style={modalStyles.closeBtn}
                            onClick={() => { setShowModal(null); setError(''); }}
                        >
                            {t('server_sidebar.btn_cancel', 'Cancel')}
                        </button>
                    </div>
                </div>,
                document.body
            )}
            {/* Global Search Modal */}
            <GlobalSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
            {/* Ethereal Shop Modal */}
            <EtherealShop isOpen={showShop} onClose={() => setShowShop(false)} />
        </View>
    );
};

// Modal inline styles for better compatibility
const modalStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3000,
    },
    modal: {
        backgroundColor: '#16213e',
        borderRadius: '16px',
        padding: '28px',
        width: '420px',
        maxWidth: '90vw',
    },
    title: {
        color: '#fff',
        fontSize: '24px',
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: '24px',
        marginTop: 0,
    },
    buttons: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    optionBtn: {
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#0f3460',
        padding: '18px',
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    optionIcon: {
        flexShrink: 0,
        marginInlineEnd: '14px',
    },
    optionText: {
        color: '#fff',
        fontSize: '17px',
        fontWeight: '500',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
    },
    error: {
        color: '#ef4444',
        fontSize: '14px',
        marginBottom: '12px',
        marginTop: 0,
    },
    input: {
        backgroundColor: '#0f3460',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '14px',
        color: '#fff',
        fontSize: '15px',
        marginBottom: '16px',
        outline: 'none',
    },
    submitBtn: {
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: 'none',
        borderRadius: '8px',
        padding: '14px',
        color: '#fff',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    closeBtn: {
        width: '100%',
        marginTop: '16px',
        padding: '10px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#6b7280',
        fontSize: '14px',
        cursor: 'pointer',
    },
};

const styles = StyleSheet.create({
    container: {
        width: 72,
        backgroundColor: 'var(--bg-tertiary)',
        paddingTop: 12,
        alignItems: 'center',
        transition: 'background-color 0.3s ease',
    },
    serverList: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 12,
    },
    searchIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'var(--bg-secondary)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    serverIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
    },
    friendsIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'var(--bg-secondary)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s ease',
    },
    notificationBadge: {
        position: 'absolute',
        top: '50%',
        insetInlineEnd: -4,
        transform: 'translateY(-50%)',
        height: 20,
        borderRadius: 10,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    serverIconActive: {
        borderRadius: 16,
        backgroundColor: 'var(--active-item-bg)',
    },
    serverIconText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        lineHeight: 'normal',
        textAlign: 'center',
        margin: 0,
    },
    activeIndicator: {
        position: 'absolute',
        insetInlineStart: -12,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 4,
        height: 40,
        backgroundColor: '#fff',
        borderRadius: '0 4px 4px 0',
    },
    separator: {
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 8,
        borderRadius: 1,
    },
    addServerBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#16213e',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    addServerIcon: {
        color: '#10b981',
        fontSize: 24,
    },
    shopIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    primeIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.2)',
    },
    gamingIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: '#16213e',
        borderRadius: 16,
        padding: 24,
        width: 400,
        maxWidth: '90vw',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'column',
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f3460',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        cursor: 'pointer',
    },
    optionIcon: {
        color: '#9ca3af',
        marginInlineEnd: 12,
    },
    optionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    formContainer: {
        marginTop: 8,
    },
    input: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        padding: 14,
        color: '#fff',
        fontSize: 15,
        marginBottom: 16,
        outlineWidth: 0,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        marginBottom: 12,
    },
    submitBtn: {
        backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        cursor: 'pointer',
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    closeBtn: {
        marginTop: 16,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#6b7280',
        fontSize: 14,
    },
});

export default ServerSidebar;
