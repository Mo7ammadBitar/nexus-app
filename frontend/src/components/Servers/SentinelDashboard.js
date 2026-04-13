import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
    X, ShieldAlert, Terminal, UserMinus, Plus, Trash2, ShieldCheck,
    AlertTriangle, Eraser, Activity
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { serversAPI } from '../../services/api';
import api from '../../services/api';

const SentinelDashboard = ({ serverId, currentSettings, onClose, onSettingsUpdated }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('shield');
    const [settings, setSettings] = useState({
        is_enabled: false,
        anti_spam: true,
        anti_links: false,
        banned_words: [],
        ai_strictness: false,
        ...currentSettings
    });
    
    // Threat List
    const [members, setMembers] = useState([]);
    // Audit Log
    const [auditLogs, setAuditLogs] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newWord, setNewWord] = useState('');

    useEffect(() => {
        if (activeTab === 'threats') {
            fetchMembers();
        } else if (activeTab === 'audit') {
            fetchAuditLogs();
        }
    }, [activeTab]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const res = await serversAPI.getMembers(serverId);
            // Filter only members with strikes
            const threats = (res.data.members || []).filter(m => m.strikes > 0);
            setMembers(threats);
        } catch (err) {
            console.error("Failed to fetch members", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/servers/${serverId}/audit-logs`);
            setAuditLogs(res.data.audit_logs || []);
        } catch (err) {
            console.error("Failed to fetch audit logs", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.put(`/servers/${serverId}/sentinel`, settings);
            if (onSettingsUpdated) {
                onSettingsUpdated(settings);
            }
        } catch (err) {
            console.error("Failed to save sentinel settings", err);
        } finally {
            setSaving(false);
        }
    };

    const toggleSetting = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const addBannedWord = () => {
        if (newWord.trim() && !settings.banned_words.includes(newWord.trim().toLowerCase())) {
            setSettings(prev => ({
                ...prev,
                banned_words: [...prev.banned_words, newWord.trim().toLowerCase()]
            }));
            setNewWord('');
        }
    };

    const removeBannedWord = (word) => {
        setSettings(prev => ({
            ...prev,
            banned_words: prev.banned_words.filter(w => w !== word)
        }));
    };

    const handlePardon = async (userId) => {
        if (confirm("Reset strikes for this user?")) {
            try {
                await api.post(`/servers/${serverId}/members/${userId}/pardon`);
                fetchMembers();
            } catch (err) {
                console.error("Pardon failed", err);
            }
        }
    };

    const handleKick = async (userId) => {
        if (confirm("Kick this user from the server?")) {
            try {
                await serversAPI.kickMember(serverId, userId);
                fetchMembers();
            } catch (err) {
                console.error("Kick failed", err);
            }
        }
    };

    const renderShieldSettings = () => (
        <div style={styles.tabContent}>
            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <ShieldCheck size={20} color={settings.is_enabled ? "#10b981" : "#ef4444"} />
                    <h3 style={styles.cardTitle}>Core System</h3>
                    <button 
                        style={settings.is_enabled ? styles.toggleBtnActive : styles.toggleBtn}
                        onClick={() => toggleSetting('is_enabled')}
                    >
                        {settings.is_enabled ? 'ONLINE' : 'OFFLINE'}
                    </button>
                </div>
                <p style={styles.description}>Activate Nexus Sentinel to monitor and enforce automated moderation rules.</p>
            </div>

            <div style={{ ...styles.card, opacity: settings.is_enabled ? 1 : 0.5, pointerEvents: settings.is_enabled ? 'auto' : 'none' }}>
                <h3 style={styles.cardTitle}>Enforcement Protocols</h3>
                
                <div style={styles.settingRow}>
                    <div>
                        <div style={styles.settingLabel}>Anti-Spam</div>
                        <div style={styles.settingDesc}>Timeout users who send 5+ messages within 5 seconds.</div>
                    </div>
                    <button 
                        style={settings.anti_spam ? styles.switchActive : styles.switch}
                        onClick={() => toggleSetting('anti_spam')}
                    />
                </div>

                <div style={styles.settingRow}>
                    <div>
                        <div style={styles.settingLabel}>Anti-Links</div>
                        <div style={styles.settingDesc}>Delete messages containing URLs.</div>
                    </div>
                    <button 
                        style={settings.anti_links ? styles.switchActive : styles.switch}
                        onClick={() => toggleSetting('anti_links')}
                    />
                </div>

                <div style={{ marginTop: 24 }}>
                    <div style={styles.settingLabel}>Banned Words Filter</div>
                    <div style={styles.settingDesc}>Messages containing these patterns will be intercepted.</div>
                    
                    <div style={styles.wordInputContainer}>
                        <input 
                            style={styles.wordInput}
                            placeholder="Add a word..."
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addBannedWord()}
                        />
                        <button style={styles.addWordBtn} onClick={addBannedWord}>
                            <Plus size={18} />
                        </button>
                    </div>

                    <div style={styles.wordList}>
                        {settings.banned_words.map(word => (
                            <div key={word} style={styles.wordTag}>
                                {word}
                                <button style={styles.removeWordBtn} onClick={() => removeBannedWord(word)}>
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <button 
                style={{...styles.saveMainBtn, opacity: saving ? 0.7 : 1}} 
                onClick={handleSaveSettings}
                disabled={saving}
            >
                {saving ? 'SYNCING...' : 'SAVE CONFIGURATION'}
            </button>
        </div>
    );

    const renderThreatList = () => (
        <div style={styles.tabContent}>
            <div style={styles.card}>
                <h3 style={styles.cardTitle}><Activity size={18} color="#ef4444" style={{marginRight: 8}}/> Active Threats</h3>
                <p style={styles.description}>Profiles with active strikes or timeouts.</p>

                {loading ? (
                    <div style={styles.loading}>Scanning...</div>
                ) : members.length === 0 ? (
                    <div style={styles.clearStatus}>
                        <ShieldCheck size={48} color="#10b981" />
                        <p>No active threats detected.</p>
                    </div>
                ) : (
                    <div style={styles.threatTable}>
                        {members.map(m => {
                            const isTimedOut = m.timeout_until && new Date(m.timeout_until) > new Date();
                            return (
                                <div key={m.user_id} style={styles.threatRow}>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.threatName}>{m.username}</div>
                                        <div style={styles.threatStats}>
                                            <span style={styles.strikeTag}>{m.strikes} Strikes</span>
                                            {isTimedOut && <span style={styles.timeoutTag}>TIMED OUT</span>}
                                        </div>
                                    </div>
                                    <div style={styles.threatActions}>
                                        <button style={styles.actionBtn} onClick={() => handlePardon(m.user_id)} title="Pardon (Reset Strikes)">
                                            <Eraser size={18} color="#3b82f6" />
                                        </button>
                                        <button style={styles.actionBtn} onClick={() => handleKick(m.user_id)} title="Kick Member">
                                            <UserMinus size={18} color="#ef4444" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    const renderAuditLog = () => (
        <div style={styles.tabContent}>
            <div style={styles.terminal}>
                <div style={styles.terminalHeader}>
                    <Terminal size={14} color="#a0aec0" />
                    <span>NEXUS_SENTINEL_SYS_LOG</span>
                </div>
                <div style={styles.terminalBody}>
                    {loading ? (
                        <div>Initializing log stream...</div>
                    ) : auditLogs.length === 0 ? (
                        <div style={{color: '#a0aec0'}}>No recent automated actions recorded.</div>
                    ) : (
                        auditLogs.map(log => {
                            const date = new Date(log.created_at);
                            return (
                                <div key={log._id} style={styles.logEntry}>
                                    <span style={{color: '#10b981'}}>[{date.toLocaleTimeString()}]</span>
                                    <span style={{color: '#a855f7', marginLeft: 8}}>ACTION: {log.action}</span>
                                    <span style={{color: '#e2e8f0', marginLeft: 8}}>TARGET: {log.user_id}</span>
                                    <span style={{color: '#ef4444', marginLeft: 8}}>REASON: {log.reason}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <ShieldAlert size={28} color="#ef4444" />
                        <div>
                            <h2 style={styles.title}>NEXUS SENTINEL</h2>
                            <span style={styles.subtitle}>Automated Defense Grid</span>
                        </div>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}><X size={24} /></button>
                </div>

                <div style={styles.navBar}>
                    <button 
                        style={activeTab === 'shield' ? styles.navBtnActive : styles.navBtn}
                        onClick={() => setActiveTab('shield')}
                    >
                        Shield Settings
                    </button>
                    <button 
                        style={activeTab === 'threats' ? styles.navBtnActive : styles.navBtn}
                        onClick={() => setActiveTab('threats')}
                    >
                        Threat List
                    </button>
                    <button 
                        style={activeTab === 'audit' ? styles.navBtnActive : styles.navBtn}
                        onClick={() => setActiveTab('audit')}
                    >
                        Live Audit Log
                    </button>
                </div>

                <div style={styles.contentArea}>
                    {activeTab === 'shield' && renderShieldSettings()}
                    {activeTab === 'threats' && renderThreatList()}
                    {activeTab === 'audit' && renderAuditLog()}
                </div>
            </div>
        </div>,
        document.body
    );
};

const styles = {
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 5100,
        backdropFilter: 'blur(4px)'
    },
    modal: {
        backgroundColor: '#0a0a0f',
        borderRadius: '12px',
        width: '600px', maxWidth: '95vw',
        height: '700px', maxHeight: '90vh',
        border: '1px solid #1f1f2e',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 40px rgba(239, 68, 68, 0.1)',
        overflow: 'hidden'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '24px',
        backgroundColor: '#0f0f15',
        borderBottom: '1px solid #1f1f2e',
    },
    headerLeft: {
        display: 'flex', alignItems: 'center', gap: '16px'
    },
    title: {
        color: '#fff', fontSize: '20px', fontWeight: '800', margin: 0,
        letterSpacing: '2px', textTransform: 'uppercase'
    },
    subtitle: {
        color: '#ef4444', fontSize: '11px', fontWeight: '600',
        letterSpacing: '3px', textTransform: 'uppercase'
    },
    closeBtn: {
        background: 'transparent', border: 'none', color: '#6b7280',
        cursor: 'pointer', padding: '4px'
    },
    navBar: {
        display: 'flex', backgroundColor: '#0a0a0f',
        borderBottom: '1px solid #1f1f2e', padding: '0 16px'
    },
    navBtn: {
        background: 'transparent', border: 'none', color: '#6b7280',
        padding: '16px 20px', fontSize: '13px', fontWeight: '600',
        cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase',
        borderBottom: '2px solid transparent'
    },
    navBtnActive: {
        background: 'transparent', border: 'none', color: '#ef4444',
        padding: '16px 20px', fontSize: '13px', fontWeight: '600',
        cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase',
        borderBottom: '2px solid #ef4444'
    },
    contentArea: {
        flex: 1, overflowY: 'auto', padding: '24px',
        backgroundColor: '#0a0a0f'
    },
    tabContent: {
        display: 'flex', flexDirection: 'column', gap: '20px'
    },
    card: {
        backgroundColor: '#151520', borderRadius: '8px', padding: '20px',
        border: '1px solid #1f1f2e'
    },
    cardHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '8px'
    },
    cardTitle: {
        color: '#fff', fontSize: '15px', fontWeight: '600', margin: 0,
        display: 'flex', alignItems: 'center'
    },
    description: {
        color: '#a0aec0', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5
    },
    toggleBtn: {
        backgroundColor: 'transparent', border: '1px solid #ef4444',
        color: '#ef4444', padding: '6px 12px', borderRadius: '4px',
        fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '1px'
    },
    toggleBtnActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981',
        color: '#10b981', padding: '6px 12px', borderRadius: '4px',
        fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '1px',
        boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)'
    },
    settingRow: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 0', borderBottom: '1px solid #1f1f2e'
    },
    settingLabel: {
        color: '#e2e8f0', fontSize: '14px', fontWeight: '500', marginBottom: '4px'
    },
    settingDesc: {
        color: '#64748b', fontSize: '12px'
    },
    switch: {
        width: '40px', height: '22px', backgroundColor: '#334155',
        borderRadius: '11px', border: 'none', cursor: 'pointer',
        position: 'relative', transition: 'all 0.3s'
    },
    switchActive: {
        width: '40px', height: '22px', backgroundColor: '#ef4444',
        borderRadius: '11px', border: 'none', cursor: 'pointer',
        position: 'relative', transition: 'all 0.3s'
    },
    // Missing switch knob logic in raw CSS, but works fine for mock design
    wordInputContainer: {
        display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '16px'
    },
    wordInput: {
        flex: 1, backgroundColor: '#0a0a0f', border: '1px solid #1f1f2e',
        borderRadius: '6px', padding: '10px 14px', color: '#fff', fontSize: '13px',
        outline: 'none'
    },
    addWordBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#ef4444', borderRadius: '6px', padding: '0 16px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
    },
    wordList: {
        display: 'flex', flexWrap: 'wrap', gap: '8px'
    },
    wordTag: {
        display: 'flex', alignItems: 'center', gap: '6px',
        backgroundColor: '#0a0a0f', border: '1px solid #334155',
        color: '#cbd5e1', padding: '4px 10px', borderRadius: '16px',
        fontSize: '12px'
    },
    removeWordBtn: {
        background: 'transparent', border: 'none', color: '#64748b',
        cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center'
    },
    saveMainBtn: {
        width: '100%', backgroundColor: '#ef4444', color: '#fff',
        border: 'none', padding: '14px', borderRadius: '6px',
        fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px',
        cursor: 'pointer', display: 'flex', justifyContent: 'center',
        alignItems: 'center', marginTop: 'auto', boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)'
    },
    threatTable: {
        display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px'
    },
    threatRow: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#0a0a0f', padding: '14px 16px', borderRadius: '6px',
        borderLeft: '4px solid #ef4444'
    },
    threatName: {
        color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '4px'
    },
    threatStats: {
        display: 'flex', gap: '8px'
    },
    strikeTag: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
        fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px'
    },
    timeoutTag: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
        fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px'
    },
    threatActions: {
        display: 'flex', gap: '8px'
    },
    actionBtn: {
        backgroundColor: 'transparent', border: '1px solid #334155',
        borderRadius: '6px', padding: '8px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    clearStatus: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '40px 0', color: '#10b981',
        fontSize: '14px', fontWeight: '500', gap: '12px'
    },
    loading: {
        color: '#64748b', fontSize: '13px', fontStyle: 'italic', padding: '20px', textAlign: 'center'
    },
    terminal: {
        backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden',
        border: '1px solid #1f1f2e', fontFamily: 'monospace', height: '100%',
        minHeight: '400px'
    },
    terminalHeader: {
        backgroundColor: '#111', padding: '8px 12px', display: 'flex',
        alignItems: 'center', gap: '8px', color: '#a0aec0', fontSize: '11px',
        letterSpacing: '1px', borderBottom: '1px solid #1f1f2e'
    },
    terminalBody: {
        padding: '16px', overflowY: 'auto', height: 'calc(100% - 35px)',
        fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
    },
    logEntry: {
        marginBottom: '6px', fontFamily: '"Fira Code", monospace'
    }
};

export default SentinelDashboard;
