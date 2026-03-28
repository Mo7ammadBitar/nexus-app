import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native-web';
import { useAuthStore } from '../../store/authStore';
import api, { supportAPI } from '../../services/api';
import { Crown, Shield, Users, Server, X, UserPlus, FileEdit, Trash2, Ban, CheckCircle, Gift, ShieldOff, MessageSquare, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SupportChatModal from '../Support/SupportChatModal';

const AdminDashboard = ({ onClose }) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const isSuperAdmin = user?.role === 'super_admin';
    const isAdmin = user?.role === 'admin' || isSuperAdmin;

    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [servers, setServers] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Support Tickets State
    const [tickets, setTickets] = useState([]);
    const [activeTicket, setActiveTicket] = useState(null);

    // Create User Form
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUserUsername, setNewUserUsername] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');

    // Create Admin Form
    const [newAdminUsername, setNewAdminUsername] = useState('');
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');

    // Ban Dialog
    const [banDialog, setBanDialog] = useState(null);
    const [banReason, setBanReason] = useState('');
    const [banDuration, setBanDuration] = useState('');

    // Edit Dialogs
    const [editUserDialog, setEditUserDialog] = useState(null);
    const [editAdminDialog, setEditAdminDialog] = useState(null);
    const [editServerDialog, setEditServerDialog] = useState(null);
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editServerName, setEditServerName] = useState('');

    // Premium Management
    const [premiumDialog, setPremiumDialog] = useState(null);
    const [premiumPlan, setPremiumPlan] = useState('lifetime');

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        else if (activeTab === 'servers') fetchServers();
        else if (activeTab === 'admins' && isSuperAdmin) fetchAdmins();
        else if (activeTab === 'support') fetchTickets();
    }, [activeTab]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/admin/users');
            setUsers(response.data.users || []);
        } catch (error) {
            setMessage('❌ ' + t('admin.failed_load_users', 'Failed to load users'));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchServers = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/admin/servers');
            setServers(response.data.servers || []);
        } catch (error) {
            setMessage('❌ ' + t('admin.failed_load_servers', 'Failed to load servers'));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAdmins = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/admin/admins');
            setAdmins(response.data.admins || []);
        } catch (error) {
            setMessage('❌ ' + t('admin.failed_load_admins', 'Failed to load admins'));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTickets = async () => {
        setIsLoading(true);
        try {
            const response = await supportAPI.getAdminTickets();
            setTickets(response.data || []);
        } catch (error) {
            setMessage('❌ Failed to load support tickets');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseTicketLocally = async (ticketId, e) => {
        e.stopPropagation();
        try {
            await supportAPI.closeTicket(ticketId);
            fetchTickets();
            setMessage('✅ Ticket closed successfully');
        } catch (error) {
            setMessage('❌ Failed to close ticket');
        }
    };

    const handleCreateUser = async () => {
        if (!newUserUsername || !newUserEmail || !newUserPassword) {
            setMessage('❌ ' + t('admin.fill_all_fields', 'Please fill all fields'));
            return;
        }
        try {
            await api.post('/admin/create-user', {
                username: newUserUsername,
                email: newUserEmail,
                password: newUserPassword,
            });
            setMessage('✅ ' + t('admin.user_created', 'User created successfully'));
            setNewUserUsername('');
            setNewUserEmail('');
            setNewUserPassword('');
            setShowCreateUser(false);
            fetchUsers();
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.create_user_failed', 'Failed to create user')));
        }
    };

    const handleCreateAdmin = async () => {
        if (!newAdminUsername || !newAdminEmail || !newAdminPassword) {
            setMessage('❌ ' + t('admin.fill_all_fields', 'Please fill all fields'));
            return;
        }
        try {
            await api.post('/admin/create-admin', {
                username: newAdminUsername,
                email: newAdminEmail,
                password: newAdminPassword,
            });
            setMessage('✅ ' + t('admin.admin_created', 'Admin created successfully'));
            setNewAdminUsername('');
            setNewAdminEmail('');
            setNewAdminPassword('');
            fetchAdmins();
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.create_admin_failed', 'Failed to create admin')));
        }
    };

    const openBanDialog = (type, id, isBanned) => {
        setBanDialog({ type, id, isBanned });
        setBanReason('');
        setBanDuration('');
    };

    const closeBanDialog = () => {
        setBanDialog(null);
        setBanReason('');
        setBanDuration('');
    };

    const handleBan = async () => {
        const isCurrentlyBanned = banDialog?.isBanned;

        if (!isCurrentlyBanned && (!banReason || banReason.length < 10)) {
            setMessage('❌ ' + t('admin.ban_reason_length', 'Ban reason must be at least 10 characters'));
            return;
        }
        try {
            const { type, id, isBanned } = banDialog;
            const endpoint = `/admin/${type}/${id}/${isBanned ? 'unban' : 'ban'}`;

            if (isBanned) {
                await api.put(endpoint);
            } else {
                const durationDays = banDuration ? parseInt(banDuration) : null;
                await api.put(endpoint, {
                    reason: banReason,
                    duration_days: durationDays,
                });
            }

            closeBanDialog();
            if (type === 'users') fetchUsers();
            else if (type === 'servers') fetchServers();

            const entity = type === 'users' ? t('admin.entity_user', 'User') : t('admin.entity_server', 'Server');
            setMessage(isBanned ? `✅ ${entity} ${t('admin.unbanned', 'unbanned')}` : `✅ ${entity} ${t('admin.banned', 'banned')}`);
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.action_failed', 'Action failed')));
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm(t('admin.confirm_delete_user', 'Are you sure you want to permanently delete this user?'))) return;
        try {
            await api.delete(`/admin/users/${userId}?permanent=true`);
            fetchUsers();
            setMessage('✅ ' + t('admin.user_deleted', 'User deleted'));
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.delete_user_failed', 'Failed to delete user')));
        }
    };

    const openEditUserDialog = (user) => {
        setEditUserDialog(user);
        setEditDisplayName(user.display_name || user.username);
    };

    const closeEditUserDialog = () => {
        setEditUserDialog(null);
        setEditDisplayName('');
    };

    const handleEditUser = async () => {
        try {
            await api.put(`/admin/users/${editUserDialog.id}`, {
                display_name: editDisplayName,
            });
            closeEditUserDialog();
            fetchUsers();
            setMessage('✅ ' + t('admin.user_updated', 'User updated'));
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.update_user_failed', 'Failed to update user')));
        }
    };

    const openEditAdminDialog = (admin) => {
        setEditAdminDialog(admin);
        setEditDisplayName(admin.display_name || admin.username);
    };

    const closeEditAdminDialog = () => {
        setEditAdminDialog(null);
        setEditDisplayName('');
    };

    const handleEditAdmin = async () => {
        try {
            await api.put(`/admin/admins/${editAdminDialog.id}`, {
                display_name: editDisplayName,
            });
            closeEditAdminDialog();
            fetchAdmins();
            setMessage('✅ ' + t('admin.admin_updated', 'Admin updated'));
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.update_admin_failed', 'Failed to update admin')));
        }
    };

    const handleDeleteAdmin = async (adminId) => {
        if (!window.confirm(t('admin.confirm_delete_admin', 'Are you sure you want to permanently delete this admin?'))) return;
        try {
            await api.delete(`/admin/admins/${adminId}`);
            fetchAdmins();
            setMessage('✅ ' + t('admin.admin_deleted', 'Admin deleted'));
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.delete_admin_failed', 'Failed to delete admin')));
        }
    };

    const openEditServerDialog = (server) => {
        setEditServerDialog(server);
        setEditServerName(server.name);
    };

    const closeEditServerDialog = () => {
        setEditServerDialog(null);
        setEditServerName('');
    };

    const handleEditServer = async () => {
        try {
            await api.put(`/admin/servers/${editServerDialog.id}`, {
                name: editServerName,
            });
            closeEditServerDialog();
            fetchServers();
            setMessage('✅ ' + t('admin.server_updated', 'Server updated'));
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.update_server_failed', 'Failed to update server')));
        }
    };

    const handleDeleteServer = async (serverId) => {
        if (!window.confirm(t('admin.confirm_delete_server', 'Are you sure you want to permanently delete this server?'))) return;
        try {
            await api.delete(`/admin/servers/${serverId}?permanent=true`);
            fetchServers();
            setMessage('✅ ' + t('admin.server_deleted', 'Server deleted'));
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || t('admin.delete_server_failed', 'Failed to delete server')));
        }
    };

    // ===== Premium Management Handlers =====
    const openPremiumDialog = (user) => {
        setPremiumDialog(user);
        setPremiumPlan('lifetime');
    };

    const closePremiumDialog = () => {
        setPremiumDialog(null);
        setPremiumPlan('lifetime');
    };

    const handleGrantPremium = async () => {
        if (!premiumDialog) return;
        try {
            const res = await api.post(`/admin/users/${premiumDialog.id || premiumDialog._id}/grant-premium`, {
                plan: premiumPlan,
            });
            closePremiumDialog();
            fetchUsers();
            setMessage(`✅ ${res.data.message}`);
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || 'Failed to grant premium'));
        }
    };

    const handleRevokePremium = async () => {
        if (!premiumDialog) return;
        if (!window.confirm(`Revoke premium from ${premiumDialog.username}?`)) return;
        try {
            const res = await api.post(`/admin/users/${premiumDialog.id || premiumDialog._id}/revoke-premium`);
            closePremiumDialog();
            fetchUsers();
            setMessage(`✅ ${res.data.message}`);
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || 'Failed to revoke premium'));
        }
    };

    return (
        <div style={inlineStyles.overlay}>
            <div style={inlineStyles.panel}>
                <div style={inlineStyles.header}>
                    <span style={{ ...inlineStyles.title, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isSuperAdmin ? <><Crown size={24} color="#f59e0b" /> {t('admin.super_admin_dashboard', 'Super Admin Dashboard')}</> : <><Shield size={24} color="#8b5cf6" /> {t('admin.admin_dashboard', 'Admin Dashboard')}</>}
                    </span>
                    <button style={{ ...inlineStyles.closeBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div style={inlineStyles.tabs}>
                    <button
                        style={{ ...inlineStyles.tab, ...(activeTab === 'users' ? inlineStyles.tabActive : {}), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onClick={() => setActiveTab('users')}
                    >
                        <Users size={16} /> {t('admin.tab_users', 'Users')}
                    </button>
                    <button
                        style={{ ...inlineStyles.tab, ...(activeTab === 'servers' ? inlineStyles.tabActive : {}), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onClick={() => setActiveTab('servers')}
                    >
                        <Server size={16} /> {t('admin.tab_servers', 'Servers')}
                    </button>
                    {isSuperAdmin && (
                        <button
                            style={{ ...inlineStyles.tab, ...(activeTab === 'admins' ? inlineStyles.tabActive : {}), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            onClick={() => setActiveTab('admins')}
                        >
                            <Shield size={16} /> {t('admin.tab_admins', 'Admins')}
                        </button>
                    )}
                    <button
                        style={{ ...inlineStyles.tab, ...(activeTab === 'support' ? inlineStyles.tabActive : {}), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onClick={() => setActiveTab('support')}
                    >
                        <MessageSquare size={16} /> Support Tickets
                    </button>
                </div>

                {/* Message */}
                {message && (
                    <div style={inlineStyles.message}>{message}</div>
                )}

                {/* Content */}
                <div style={inlineStyles.content}>
                    {isLoading ? (
                        <div style={inlineStyles.loading}>{t('common.loading', 'Loading...')}</div>
                    ) : (
                        <>
                            {/* Users Tab */}
                            {activeTab === 'users' && (
                                <div>
                                    {/* Create User Button */}
                                    {isAdmin && (
                                        <div style={inlineStyles.actionBar}>
                                            <button
                                                style={{ ...inlineStyles.createBtn, display: 'flex', alignItems: 'center', gap: 6 }}
                                                onClick={() => setShowCreateUser(!showCreateUser)}
                                            >
                                                {showCreateUser ? <><X size={16} /> {t('common.cancel', 'Cancel')}</> : <><UserPlus size={16} /> {t('admin.btn_create_user', 'Create User')}</>}
                                            </button>
                                        </div>
                                    )}

                                    {/* Create User Form */}
                                    {showCreateUser && isAdmin && (
                                        <div style={inlineStyles.form}>
                                            <h4 style={inlineStyles.formTitle}>{t('admin.create_new_user', 'Create New User')}</h4>
                                            <input
                                                style={inlineStyles.input}
                                                placeholder={t('common.username', 'Username')}
                                                value={newUserUsername}
                                                onChange={e => setNewUserUsername(e.target.value)}
                                            />
                                            <input
                                                style={inlineStyles.input}
                                                placeholder={t('common.email', 'Email')}
                                                type="email"
                                                value={newUserEmail}
                                                onChange={e => setNewUserEmail(e.target.value)}
                                            />
                                            <input
                                                style={inlineStyles.input}
                                                placeholder={t('common.password', 'Password')}
                                                type="password"
                                                value={newUserPassword}
                                                onChange={e => setNewUserPassword(e.target.value)}
                                            />
                                            <button style={inlineStyles.submitBtn} onClick={handleCreateUser}>
                                                {t('admin.btn_create_user', 'Create User')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Users List */}
                                    <div style={inlineStyles.list}>
                                        {users.length === 0 ? (
                                            <div style={inlineStyles.empty}>{t('admin.no_users_found', 'No users found')}</div>
                                        ) : (
                                            users.map(u => (
                                                <div key={u.id || u._id} style={inlineStyles.listItem}>
                                                    <div style={inlineStyles.itemInfo}>
                                                        <span style={inlineStyles.itemName}>{u.username}</span>
                                                        <span style={inlineStyles.itemEmail}>{u.email}</span>
                                                        {u.display_name && u.display_name !== u.username && (
                                                            <span style={inlineStyles.itemSecondary}>{t('admin.display_name_label', 'Display:')} {u.display_name}</span>
                                                        )}
                                                        {u.is_banned && (
                                                            <span style={inlineStyles.bannedBadge}>{t('admin.badge_banned', 'BANNED')}</span>
                                                        )}
                                                        {u.is_premium && (
                                                            <span style={inlineStyles.premiumBadge}>ELITE</span>
                                                        )}
                                                    </div>
                                                    <div style={inlineStyles.actionButtons}>
                                                        {isAdmin && (
                                                            <>
                                                                <button
                                                                    style={{ ...inlineStyles.editBtn, display: 'flex', alignItems: 'center', gap: 4 }}
                                                                    onClick={() => openEditUserDialog(u)}
                                                                >
                                                                    <FileEdit size={14} /> {t('common.edit', 'Edit')}
                                                                </button>
                                                                <button
                                                                    style={{ ...(u.is_banned ? inlineStyles.unbanBtn : inlineStyles.banBtn), display: 'flex', alignItems: 'center', gap: 4 }}
                                                                    onClick={() => openBanDialog('users', u.id || u._id, u.is_banned)}
                                                                >
                                                                    {u.is_banned ? <><CheckCircle size={14} /> {t('admin.btn_unban', 'Unban')}</> : <><Ban size={14} /> {t('admin.btn_ban', 'Ban')}</>}
                                                                </button>
                                                                <button
                                                                    style={{ ...inlineStyles.deleteBtn, display: 'flex', alignItems: 'center', gap: 4 }}
                                                                    onClick={() => handleDeleteUser(u.id || u._id)}
                                                                >
                                                                    <Trash2 size={14} /> {t('common.delete', 'Delete')}
                                                                </button>
                                                                <button
                                                                    style={{ ...inlineStyles.premiumManageBtn, display: 'flex', alignItems: 'center', gap: 4 }}
                                                                    onClick={() => openPremiumDialog(u)}
                                                                >
                                                                    <Crown size={14} /> Premium
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Servers Tab */}
                            {activeTab === 'servers' && (
                                <div>
                                    {/* Servers List */}
                                    <div style={inlineStyles.list}>
                                        {servers.length === 0 ? (
                                            <div style={inlineStyles.empty}>{t('admin.no_servers_found', 'No servers found')}</div>
                                        ) : (
                                            servers.map(s => (
                                                <div key={s.id || s._id} style={inlineStyles.listItem}>
                                                    <div style={inlineStyles.itemInfo}>
                                                        <span style={inlineStyles.itemName}>{s.name}</span>
                                                        <span style={inlineStyles.itemEmail}>{t('admin.invite_label', 'Invite:')} {s.invite_code}</span>
                                                        <span style={inlineStyles.itemSecondary}>{t('admin.owner_label', 'Owner:')} {s.owner_username || t('admin.unknown_owner', 'Unknown')}</span>
                                                        {s.is_banned && (
                                                            <span style={inlineStyles.bannedBadge}>{t('admin.badge_banned', 'BANNED')}</span>
                                                        )}
                                                    </div>
                                                    <div style={inlineStyles.actionButtons}>
                                                        {isAdmin && (
                                                            <>
                                                                <button
                                                                    style={{ ...inlineStyles.editBtn, display: 'flex', alignItems: 'center', gap: 4 }}
                                                                    onClick={() => openEditServerDialog(s)}
                                                                >
                                                                    <FileEdit size={14} /> {t('common.edit', 'Edit')}
                                                                </button>
                                                                <button
                                                                    style={{ ...(s.is_banned ? inlineStyles.unbanBtn : inlineStyles.banBtn), display: 'flex', alignItems: 'center', gap: 4 }}
                                                                    onClick={() => openBanDialog('servers', s.id || s._id, s.is_banned)}
                                                                >
                                                                    {s.is_banned ? <><CheckCircle size={14} /> {t('admin.btn_unban', 'Unban')}</> : <><Ban size={14} /> {t('admin.btn_ban', 'Ban')}</>}
                                                                </button>
                                                                <button
                                                                    style={{ ...inlineStyles.deleteBtn, display: 'flex', alignItems: 'center', gap: 4 }}
                                                                    onClick={() => handleDeleteServer(s.id || s._id)}
                                                                >
                                                                    <Trash2 size={14} /> {t('common.delete', 'Delete')}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Admins Tab (Super Admin Only) */}
                            {activeTab === 'admins' && isSuperAdmin && (
                                <div>
                                    {/* Create Admin Form */}
                                    <div style={inlineStyles.form}>
                                        <h4 style={inlineStyles.formTitle}>{t('admin.create_new_admin', 'Create New Admin')}</h4>
                                        <input
                                            style={inlineStyles.input}
                                            placeholder={t('common.username', 'Username')}
                                            value={newAdminUsername}
                                            onChange={e => setNewAdminUsername(e.target.value)}
                                        />
                                        <input
                                            style={inlineStyles.input}
                                            placeholder={t('common.email', 'Email')}
                                            type="email"
                                            value={newAdminEmail}
                                            onChange={e => setNewAdminEmail(e.target.value)}
                                        />
                                        <input
                                            style={inlineStyles.input}
                                            placeholder={t('common.password', 'Password')}
                                            type="password"
                                            value={newAdminPassword}
                                            onChange={e => setNewAdminPassword(e.target.value)}
                                        />
                                        <button style={inlineStyles.submitBtn} onClick={handleCreateAdmin}>
                                            {t('admin.btn_create_admin', 'Create Admin')}
                                        </button>
                                    </div>

                                    {/* Admin List */}
                                    <div style={inlineStyles.list}>
                                        {admins.length === 0 ? (
                                            <div style={inlineStyles.empty}>{t('admin.no_admins_found', 'No admins found')}</div>
                                        ) : (
                                            admins.map(a => (
                                                <div key={a.id || a._id} style={inlineStyles.listItem}>
                                                    <div style={inlineStyles.itemInfo}>
                                                        <span style={inlineStyles.itemName}>{a.username}</span>
                                                        <span style={inlineStyles.itemEmail}>{a.email}</span>
                                                        {a.display_name && a.display_name !== a.username && (
                                                            <span style={inlineStyles.itemSecondary}>{t('admin.display_name_label', 'Display:')} {a.display_name}</span>
                                                        )}
                                                    </div>
                                                    <div style={inlineStyles.actionButtons}>
                                                        <button
                                                            style={{ ...inlineStyles.editBtn, display: 'flex', alignItems: 'center', gap: 4 }}
                                                            onClick={() => openEditAdminDialog(a)}
                                                        >
                                                            <FileEdit size={14} /> {t('common.edit', 'Edit')}
                                                        </button>
                                                        <button
                                                            style={{ ...inlineStyles.deleteBtn, display: 'flex', alignItems: 'center', gap: 4 }}
                                                            onClick={() => handleDeleteAdmin(a.id || a._id)}
                                                        >
                                                            <Trash2 size={14} /> {t('common.delete', 'Delete')}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Support Tickets Tab */}
                            {activeTab === 'support' && (
                                <div>
                                    <h4 style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>Customer Support Tickets</h4>
                                    <div style={inlineStyles.list}>
                                        {tickets.length === 0 ? (
                                            <div style={inlineStyles.empty}>No support tickets found</div>
                                        ) : (
                                            tickets.map(t => (
                                                <div key={t._id} style={{ ...inlineStyles.listItem, cursor: 'pointer', borderColor: t.status === 'reopen_requested' ? '#f59e0b' : 'rgba(255,255,255,0.1)' }} onClick={() => setActiveTicket(t)}>
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{t.subject}</span>
                                                        <span style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginTop: 4 }}>User ID: {t.user_id}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: t.status === 'open' ? 'rgba(16, 185, 129, 0.2)' : (t.status === 'closed' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(245, 158, 11, 0.2)'), color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                                                            {t.status.replace('_', ' ').toUpperCase()}
                                                        </div>
                                                        {t.status !== 'closed' && (
                                                            <button 
                                                                style={{ padding: '6px 12px', borderRadius: 4, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}
                                                                onClick={(e) => handleCloseTicketLocally(t._id, e)}
                                                            >
                                                                <Lock size={12} /> Close Ticket
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <SupportChatModal isOpen={!!activeTicket} ticket={activeTicket} onClose={() => { setActiveTicket(null); fetchTickets(); }} />

            {/* Ban Dialog */}
            {banDialog && (
                <div style={inlineStyles.modalOverlay}>
                    <div style={inlineStyles.modal}>
                        <h3 style={inlineStyles.modalTitle}>
                            {banDialog.isBanned ? t('admin.btn_unban', 'Unban') : t('admin.btn_ban', 'Ban')} {banDialog.type === 'users' ? t('admin.entity_user', 'User') : t('admin.entity_server', 'Server')}
                        </h3>
                        {!banDialog.isBanned && (
                            <>
                                <label style={inlineStyles.label}>{t('admin.reason_required', 'Reason (required, min 10 characters)')}</label>
                                <textarea
                                    style={inlineStyles.textarea}
                                    placeholder={t('admin.enter_ban_reason', 'Enter ban reason...')}
                                    value={banReason}
                                    onChange={e => setBanReason(e.target.value)}
                                    rows="3"
                                />
                                <label style={inlineStyles.label}>{t('admin.duration_label', 'Duration (days, leave empty for permanent)')}</label>
                                <input
                                    style={inlineStyles.input}
                                    type="number"
                                    placeholder={t('admin.eg_7', 'e.g. 7')}
                                    min="1"
                                    max="365"
                                    value={banDuration}
                                    onChange={e => setBanDuration(e.target.value)}
                                />
                            </>
                        )}
                        <div style={inlineStyles.modalActions}>
                            <button style={inlineStyles.cancelBtn} onClick={closeBanDialog}>
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                style={banDialog.isBanned ? inlineStyles.unbanBtn : inlineStyles.banBtn}
                                onClick={handleBan}
                                disabled={!banDialog.isBanned && (!banReason || banReason.length < 10)}
                            >
                                {banDialog.isBanned ? t('admin.btn_unban', 'Unban') : t('admin.btn_ban', 'Ban')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Dialog */}
            {editUserDialog && (
                <div style={inlineStyles.modalOverlay}>
                    <div style={inlineStyles.modal}>
                        <h3 style={inlineStyles.modalTitle}>{t('admin.edit_user_title', 'Edit User')}</h3>
                        <label style={inlineStyles.label}>{t('admin.display_name_label_full', 'Display Name')}</label>
                        <input
                            style={inlineStyles.input}
                            value={editDisplayName}
                            onChange={e => setEditDisplayName(e.target.value)}
                        />
                        <div style={inlineStyles.modalActions}>
                            <button style={inlineStyles.cancelBtn} onClick={closeEditUserDialog}>
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button style={inlineStyles.submitBtn} onClick={handleEditUser}>
                                {t('common.save', 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Admin Dialog */}
            {editAdminDialog && (
                <div style={inlineStyles.modalOverlay}>
                    <div style={inlineStyles.modal}>
                        <h3 style={inlineStyles.modalTitle}>{t('admin.edit_admin_title', 'Edit Admin')}</h3>
                        <label style={inlineStyles.label}>{t('admin.display_name_label_full', 'Display Name')}</label>
                        <input
                            style={inlineStyles.input}
                            value={editDisplayName}
                            onChange={e => setEditDisplayName(e.target.value)}
                        />
                        <div style={inlineStyles.modalActions}>
                            <button style={inlineStyles.cancelBtn} onClick={closeEditAdminDialog}>
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button style={inlineStyles.submitBtn} onClick={handleEditAdmin}>
                                {t('common.save', 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Server Dialog */}
            {editServerDialog && (
                <div style={inlineStyles.modalOverlay}>
                    <div style={inlineStyles.modal}>
                        <h3 style={inlineStyles.modalTitle}>{t('admin.edit_server_title', 'Edit Server')}</h3>
                        <label style={inlineStyles.label}>{t('admin.server_name_label', 'Server Name')}</label>
                        <input
                            style={inlineStyles.input}
                            value={editServerName}
                            onChange={e => setEditServerName(e.target.value)}
                        />
                        <div style={inlineStyles.modalActions}>
                            <button style={inlineStyles.cancelBtn} onClick={closeEditServerDialog}>
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button style={inlineStyles.submitBtn} onClick={handleEditServer}>
                                {t('common.save', 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Management Dialog */}
            {premiumDialog && (
                <div style={inlineStyles.modalOverlay}>
                    <div style={{ ...inlineStyles.modal, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <h3 style={{ ...inlineStyles.modalTitle, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Crown size={22} color="#f59e0b" /> Premium Management
                        </h3>
                        <div style={{ 
                            padding: '16px', 
                            backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                            borderRadius: '10px', 
                            marginBottom: '20px',
                            border: '1px solid rgba(245, 158, 11, 0.15)'
                        }}>
                            <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: 4 }}>
                                {premiumDialog.display_name || premiumDialog.username}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '13px' }}>
                                @{premiumDialog.username} &middot; {premiumDialog.email}
                            </div>
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ 
                                    color: premiumDialog.is_premium ? '#f59e0b' : '#6b7280', 
                                    fontSize: '12px', 
                                    fontWeight: '600',
                                    padding: '3px 10px',
                                    borderRadius: '999px',
                                    background: premiumDialog.is_premium ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                                    border: premiumDialog.is_premium ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(107, 114, 128, 0.2)'
                                }}>
                                    {premiumDialog.is_premium ? 'ELITE MEMBER' : 'FREE TIER'}
                                </span>
                            </div>
                        </div>

                        {/* Plan Selector */}
                        <label style={{ ...inlineStyles.label, marginBottom: 10 }}>Select Plan Duration</label>
                        <select
                            value={premiumPlan}
                            onChange={e => setPremiumPlan(e.target.value)}
                            style={{
                                ...inlineStyles.input,
                                cursor: 'pointer',
                                appearance: 'auto',
                                marginBottom: '24px',
                            }}
                        >
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                            <option value="lifetime">Lifetime (Forever)</option>
                        </select>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                            <button
                                style={inlineStyles.grantPremiumBtn}
                                onClick={handleGrantPremium}
                            >
                                <Gift size={18} style={{ marginRight: 8 }} /> Grant Premium
                            </button>
                            {premiumDialog.is_premium && (
                                <button
                                    style={inlineStyles.revokePremiumBtn}
                                    onClick={handleRevokePremium}
                                >
                                    <ShieldOff size={18} style={{ marginRight: 8 }} /> Revoke Premium
                                </button>
                            )}
                        </div>

                        <div style={{ ...inlineStyles.modalActions, marginTop: 16 }}>
                            <button style={inlineStyles.cancelBtn} onClick={closePremiumDialog}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Using inline styles for better compatibility
const inlineStyles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3000,
    },
    panel: {
        backgroundColor: '#16213e',
        borderRadius: '16px',
        width: '800px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    },
    title: {
        color: '#fff',
        fontSize: '22px',
        fontWeight: '700',
    },
    closeBtn: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        color: '#fff',
        fontSize: '18px',
        cursor: 'pointer',
    },
    tabs: {
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    },
    tab: {
        flex: 1,
        padding: '14px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#6b7280',
        fontSize: '14px',
        cursor: 'pointer',
    },
    tabActive: {
        color: '#fff',
        borderBottom: '2px solid #7c3aed',
    },
    message: {
        padding: '12px 20px',
        color: '#fff',
        fontSize: '14px',
        textAlign: 'center',
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
    },
    content: {
        padding: '20px',
        overflowY: 'auto',
        flex: 1,
    },
    loading: {
        color: '#6b7280',
        textAlign: 'center',
        padding: '40px',
    },
    empty: {
        color: '#6b7280',
        textAlign: 'center',
        padding: '40px',
    },
    actionBar: {
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'flex-end',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    listItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px',
        backgroundColor: '#0f3460',
        borderRadius: '8px',
    },
    itemInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: 1,
    },
    itemName: {
        color: '#fff',
        fontSize: '15px',
        fontWeight: '500',
    },
    itemEmail: {
        color: '#6b7280',
        fontSize: '13px',
    },
    itemSecondary: {
        color: '#9ca3af',
        fontSize: '12px',
    },
    bannedBadge: {
        color: '#ef4444',
        fontSize: '11px',
        fontWeight: '600',
        marginTop: '4px',
    },
    actionButtons: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
    },
    banBtn: {
        padding: '8px 16px',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        border: 'none',
        borderRadius: '6px',
        color: '#ef4444',
        cursor: 'pointer',
        fontSize: '13px',
    },
    unbanBtn: {
        padding: '8px 16px',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        border: 'none',
        borderRadius: '6px',
        color: '#10b981',
        cursor: 'pointer',
        fontSize: '13px',
    },
    editBtn: {
        padding: '8px 16px',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        border: 'none',
        borderRadius: '6px',
        color: '#3b82f6',
        cursor: 'pointer',
        fontSize: '13px',
    },
    deleteBtn: {
        padding: '8px 16px',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        border: 'none',
        borderRadius: '6px',
        color: '#ef4444',
        cursor: 'pointer',
        fontSize: '13px',
    },
    form: {
        padding: '16px',
        backgroundColor: '#0f3460',
        borderRadius: '8px',
        marginBottom: '20px',
    },
    formTitle: {
        color: '#fff',
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: '16px',
        marginTop: 0,
    },
    input: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#16213e',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '14px',
        marginBottom: '12px',
        boxSizing: 'border-box',
    },
    textarea: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#16213e',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '14px',
        marginBottom: '12px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        resize: 'vertical',
    },
    label: {
        color: '#fff',
        fontSize: '14px',
        marginBottom: '8px',
        display: 'block',
    },
    createBtn: {
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: 'none',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    submitBtn: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        border: 'none',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 4000,
    },
    modal: {
        backgroundColor: '#16213e',
        borderRadius: '12px',
        padding: '24px',
        width: '500px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
    },
    modalTitle: {
        color: '#fff',
        fontSize: '20px',
        fontWeight: '600',
        marginBottom: '20px',
        marginTop: 0,
    },
    modalActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        marginTop: '20px',
    },
    cancelBtn: {
        padding: '10px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '14px',
        cursor: 'pointer',
    },
    // Premium Management Styles
    premiumBadge: {
        color: '#f59e0b',
        fontSize: '11px',
        fontWeight: '700',
        padding: '2px 8px',
        borderRadius: '999px',
        background: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        letterSpacing: '0.5px',
    },
    premiumManageBtn: {
        padding: '8px 16px',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 179, 8, 0.15))',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '6px',
        color: '#f59e0b',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '500',
    },
    grantPremiumBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 24px',
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
        border: 'none',
        borderRadius: '10px',
        color: '#fff',
        fontSize: '15px',
        fontWeight: '700',
        cursor: 'pointer',
        letterSpacing: '0.5px',
        boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
        transition: 'all 0.3s ease',
    },
    revokePremiumBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 24px',
        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)',
        border: 'none',
        borderRadius: '10px',
        color: '#fff',
        fontSize: '15px',
        fontWeight: '700',
        cursor: 'pointer',
        letterSpacing: '0.5px',
        boxShadow: '0 4px 20px rgba(220, 38, 38, 0.3)',
        transition: 'all 0.3s ease',
    },
};

export default AdminDashboard;
