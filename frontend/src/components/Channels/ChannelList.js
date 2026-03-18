import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native-web';
import { Hash, Volume2, Lock, Settings, Trash2, Plus, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useServerStore } from '../../store/serverStore';
import { useUIStore } from '../../store/uiStore';

const ChannelList = () => {
    const { t } = useTranslation();
    const { channels, currentChannel, selectChannel, currentServer, createChannel, updateChannel, deleteChannel } = useServerStore();
    const { setMobileView } = useUIStore();
    const [showCreate, setShowCreate] = useState(false);
    const [channelName, setChannelName] = useState('');
    const [channelType, setChannelType] = useState('text');

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);

    // Settings modal state
    const [settingsModal, setSettingsModal] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPermission, setEditPermission] = useState('all');

    const textChannels = channels.filter(c => c.type === 'text');
    const voiceChannels = channels.filter(c => c.type === 'voice');

    const isOwner = currentServer?.my_role === 'owner';

    const handleCreate = async () => {
        if (!channelName.trim()) return;
        await createChannel(currentServer._id, channelName.trim(), channelType);
        setShowCreate(false);
        setChannelName('');
    };

    // Context menu handlers
    const handleContextMenu = (e, channel) => {
        e.preventDefault();
        if (!isOwner) return; // Only owner can access channel settings

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            channel,
        });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleOpenSettings = () => {
        if (!contextMenu) return;
        setEditName(contextMenu.channel.name);
        setEditPermission(contextMenu.channel.send_permission || 'all');
        setSettingsModal(contextMenu.channel);
        closeContextMenu();
    };

    const handleDeleteChannel = async () => {
        if (!contextMenu) return;
        if (window.confirm(t('channel.confirm_delete', `Are you sure you want to delete #${contextMenu.channel.name}?`).replace('${contextMenu.channel.name}', contextMenu.channel.name))) {
            await deleteChannel(currentServer._id, contextMenu.channel._id);
        }
        closeContextMenu();
    };

    const handleSaveSettings = async () => {
        if (!settingsModal || !editName.trim()) return;

        const data = {};
        if (editName.trim() !== settingsModal.name) {
            data.name = editName.trim();
        }
        if (editPermission !== (settingsModal.send_permission || 'all')) {
            data.send_permission = editPermission;
        }

        if (Object.keys(data).length > 0) {
            await updateChannel(currentServer._id, settingsModal._id, data);
        }
        setSettingsModal(null);
    };

    const ChannelItem = ({ channel }) => (
        <div onContextMenu={(e) => handleContextMenu(e, channel)}>
            <TouchableOpacity
                style={[
                    styles.channelItem,
                    currentChannel?._id === channel._id && styles.channelItemActive
                ]}
                onPress={() => {
                    selectChannel(channel._id);
                    setMobileView('chat');
                }}
            >
                <View style={styles.iconContainer}>
                    {channel.type === 'voice' ? (
                        <Volume2 size={18} color={currentChannel?._id === channel._id ? "#fff" : "#9ca3af"} />
                    ) : (
                        <Hash size={18} color={currentChannel?._id === channel._id ? "#fff" : "#9ca3af"} />
                    )}
                </View>
                <Text
                    style={[
                        styles.channelName,
                        currentChannel?._id === channel._id && styles.channelNameActive
                    ]}
                    numberOfLines={1}
                >
                    {channel.name}
                </Text>
                {channel.send_permission === 'mods_only' && (
                    <Lock size={14} color="#9ca3af" style={{ marginLeft: 6 }} />
                )}
            </TouchableOpacity>
        </div>
    );

    return (
        <ScrollView style={styles.container}>
            {/* Text Channels */}
            <div style={StyleSheet.flatten(styles.category)}>
                <div style={StyleSheet.flatten(styles.categoryHeader)}>
                    <Text style={styles.categoryTitle}>{t('channel.category_scrolls', 'SCROLLS')}</Text>
                    {isOwner && (
                        <TouchableOpacity onPress={() => { setChannelType('text'); setShowCreate(true); }}>
                            <Plus size={18} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </div>
                {textChannels.map(channel => (
                    <ChannelItem key={channel._id} channel={channel} />
                ))}
            </div>

            {/* Voice Channels */}
            <div style={StyleSheet.flatten(styles.category)}>
                <div style={StyleSheet.flatten(styles.categoryHeader)}>
                    <Text style={styles.categoryTitle}>{t('channel.category_crystals', 'CRYSTALS')}</Text>
                    {isOwner && (
                        <TouchableOpacity onPress={() => { setChannelType('voice'); setShowCreate(true); }}>
                            <Plus size={18} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </div>
                {voiceChannels.map(channel => (
                    <ChannelItem key={channel._id} channel={channel} />
                ))}
            </div>

            {/* Context Menu Portal */}
            {contextMenu && ReactDOM.createPortal(
                <div style={menuStyles.overlay} onClick={closeContextMenu}>
                    <div
                        style={{
                            ...menuStyles.menu,
                            left: contextMenu.x,
                            top: contextMenu.y,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={menuStyles.header}>
                            # {contextMenu.channel.name}
                        </div>
                        <button style={menuStyles.item} onClick={handleOpenSettings}>
                            <Settings size={14} style={{ marginRight: 8 }} /> {t('channel.pathway_settings', 'Pathway Settings')}
                        </button>
                        <button style={{ ...menuStyles.item, ...menuStyles.dangerItem }} onClick={handleDeleteChannel}>
                            <Trash2 size={14} style={{ marginRight: 8 }} /> {t('channel.unravel_path', 'Create Channel')}
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* Channel Settings Modal */}
            {settingsModal && ReactDOM.createPortal(
                <div style={modalStyles.overlay}>
                    <div style={modalStyles.modal}>
                        <h2 style={modalStyles.title}>
                            {t('channel.pathway_settings', 'Pathway Settings')}
                        </h2>
                        <div style={modalStyles.form}>
                            <label style={modalStyles.label}>{t('channel.path_name', 'Path Name')}</label>
                            <input
                                style={modalStyles.input}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="channel-name"
                            />

                            <label style={modalStyles.label}>{t('channel.who_can_resonate', 'Who Can Resonate')}</label>
                            <select
                                style={modalStyles.select}
                                value={editPermission}
                                onChange={(e) => setEditPermission(e.target.value)}
                            >
                                <option value="all">{t('channel.all_spirits', 'All Members')}</option>
                                <option value="mods_only">{t('channel.mods_only', 'Moderators & Owner Only')}</option>
                            </select>
                        </div>
                        <div style={modalStyles.buttons}>
                            <button
                                style={modalStyles.cancelBtn}
                                onClick={() => setSettingsModal(null)}
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button style={modalStyles.saveBtn} onClick={handleSaveSettings}>
                                {t('common.save_changes', 'Save Changes')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Create Channel Modal - using React Portal for proper overlay */}
            {showCreate && ReactDOM.createPortal(
                <div style={createModalStyles.overlay}>
                    <div style={createModalStyles.modal}>
                        <h2 style={createModalStyles.title}>
                            {t('channel.forge', 'Create')} {channelType === 'voice' ? t('channel.type_crystal', 'Voice Channel') : t('channel.type_scroll', 'Channel')}
                        </h2>
                        <input
                            style={createModalStyles.input}
                            placeholder={channelType === 'voice' ? t('channel.crystal_name', 'Voice Channel Name') : t('channel.scroll_name', 'Channel Name')}
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            autoFocus
                        />
                        <div style={createModalStyles.buttons}>
                            <button
                                style={createModalStyles.cancelBtn}
                                onClick={() => setShowCreate(false)}
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button style={createModalStyles.createBtn} onClick={handleCreate}>
                                {t('channel.btn_forge', 'Create')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 8,
    },
    category: {
        marginBottom: 16,
    },
    categoryHeader: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 4,
    },
    categoryTitle: {
        color: '#6b7280',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    addBtn: {
        color: '#6b7280',
        fontSize: 18,
        cursor: 'pointer',
    },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginHorizontal: 8,
        borderRadius: 6,
        cursor: 'pointer',
    },
    channelItemActive: {
        backgroundColor: 'var(--active-item-bg)',
    },
    iconContainer: {
        marginRight: 6,
        width: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    channelName: {
        color: '#b4b4b4',
        fontSize: 14,
        flex: 1,
    },
    channelNameActive: {
        color: '#fff',
    },
    restrictedBadge: {
        fontSize: 12,
        marginLeft: 4,
    },
});

// Context menu styles
const menuStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 4000,
    },
    menu: {
        position: 'fixed',
        backgroundColor: '#0f3460',
        borderRadius: '8px',
        padding: '8px 0',
        minWidth: '180px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    header: {
        padding: '8px 12px',
        color: '#fff',
        fontWeight: '600',
        fontSize: '13px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '4px',
    },
    item: {
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#e5e5e5',
        fontSize: '14px',
        textAlign: 'left',
        cursor: 'pointer',
    },
    dangerItem: {
        color: '#ef4444',
    },
};

// Channel settings modal styles
const modalStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5000,
    },
    modal: {
        backgroundColor: '#16213e',
        borderRadius: '16px',
        padding: '28px',
        width: '400px',
        maxWidth: '90vw',
    },
    title: {
        color: '#fff',
        fontSize: '20px',
        fontWeight: '600',
        marginBottom: '20px',
        marginTop: 0,
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
    },
    label: {
        color: '#a0a0a0',
        fontSize: '12px',
        fontWeight: '600',
        marginBottom: '6px',
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: '#0f3460',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '12px',
        color: '#fff',
        fontSize: '14px',
        marginBottom: '16px',
        outline: 'none',
    },
    select: {
        backgroundColor: '#0f3460',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '12px',
        color: '#fff',
        fontSize: '14px',
        marginBottom: '20px',
        outline: 'none',
    },
    buttons: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
    },
    cancelBtn: {
        padding: '10px 16px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#6b7280',
        fontSize: '14px',
        cursor: 'pointer',
    },
    saveBtn: {
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 20px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

// Create modal inline styles
const createModalStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
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
        width: '400px',
        maxWidth: '90vw',
    },
    title: {
        color: '#fff',
        fontSize: '20px',
        fontWeight: '600',
        marginBottom: '20px',
        marginTop: 0,
    },
    input: {
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#0f3460',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '14px',
        color: '#fff',
        fontSize: '15px',
        marginBottom: '20px',
        outline: 'none',
    },
    buttons: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
    },
    cancelBtn: {
        padding: '10px 16px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#6b7280',
        fontSize: '14px',
        cursor: 'pointer',
    },
    createBtn: {
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 20px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

export default ChannelList;
