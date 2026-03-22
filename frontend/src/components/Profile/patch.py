import sys

file_path = r'c:\Users\DELL\Desktop\nexus_ - Copy\frontend\src\components\Profile\ProfilePanel.js'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Import
text = text.replace('Package, Gem, Users, Server } from', 'Package, Gem, Users, Server, Rocket, Check } from')

# 2. useServerStore
text = text.replace('const { user, updateUser, logout, refreshUser } = useAuthStore();', 'const { user, updateUser, logout, refreshUser } = useAuthStore();\n    const { servers } = useServerStore();')

# 3. State
state_target = "const [uploadingBanner, setUploadingBanner] = useState(false);\n    const [currentStatus, setCurrentStatus] = useState(user?.status || 'online');"
state_replace = "const [uploadingBanner, setUploadingBanner] = useState(false);\n    const [showBoostApplyModal, setShowBoostApplyModal] = useState(false);\n    const [selectedBoostServer, setSelectedBoostServer] = useState(null);\n    const [applyingBoost, setApplyingBoost] = useState(false);\n    const [currentStatus, setCurrentStatus] = useState(user?.status || 'online');"
text = text.replace(state_target, state_replace)

# 4. handleApplyBoost
handle_target = "    };\n\n    const statusOptions = ["
handle_replace = """    };

    const handleApplyBoost = async () => {
        if (!selectedBoostServer) return;
        setApplyingBoost(true);
        try {
            const response = await usersAPI.applyServerBoost(selectedBoostServer);
            setMessage('🚀 ' + response.data.message);
            refreshUser();
            setShowBoostApplyModal(false);
        } catch (error) {
            setMessage('❌ ' + (error.response?.data?.detail || 'Failed to apply Server Boost'));
        } finally {
            setApplyingBoost(false);
        }
    };

    const statusOptions = ["""
text = text.replace(handle_target, handle_replace)

# 5. Inventory Boost UI
inv_target = "{inventoryMsg ? <Text style={{ color: '#a855f7', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{inventoryMsg}</Text> : null}\n                        {ownedRelics"
inv_replace = """{inventoryMsg ? <Text style={{ color: '#a855f7', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{inventoryMsg}</Text> : null}
                        
                        {(user?.available_server_boosts > 0) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168, 85, 247, 0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)', marginBottom: 8 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: 'rgba(168, 85, 247, 0.2)' }}>
                                    <Rocket size={20} color="#a855f7" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Server Boost (x{user.available_server_boosts})</Text>
                                    <Text style={{ color: '#a855f7', fontSize: 11 }}>Permanent Server Level Up</Text>
                                </View>
                                <TouchableOpacity
                                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundImage: 'linear-gradient(135deg, #a855f7, #9333ea)' }}
                                    onPress={() => setShowBoostApplyModal(true)}
                                >
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Use</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {ownedRelics"""
text = text.replace(inv_target, inv_replace)

# 6. Apply Modal
modal_target = "    if (showNexusEliteModal) return <NexusEliteModal onClose={() => setShowNexusEliteModal(false)} />;"
modal_replace = """    if (showBoostApplyModal) {
        return (
            <div style={{ ...styles.overlay, zIndex: 3000 }}>
                <div style={{ ...styles.panel, width: 440, height: 'auto', padding: 24, display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ color: '#fff', fontSize: 18, margin: 0, display: 'flex', alignItems: 'center' }}>
                            <Rocket size={20} color="#a855f7" style={{ marginRight: 8 }} />
                            Apply Server Boost
                        </h3>
                        <button style={{ ...styles.closeBtn, border: 'none' }} onClick={() => setShowBoostApplyModal(false)}>
                            <X size={20} color="#fff" />
                        </button>
                    </div>

                    <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                        Select a server you are a member of to apply your Server Boost. This permanently increases the server's level and unlocks Custom Banners.
                    </p>

                    <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                        {servers.length === 0 ? (
                            <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px 0' }}>You are not in any servers.</p>
                        ) : (
                            servers.map(server => (
                                <div
                                    key={server._id}
                                    onClick={() => setSelectedBoostServer(server._id)}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: 8,
                                        background: selectedBoostServer === server._id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${selectedBoostServer === server._id ? '#a855f7' : 'transparent'}`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ width: 40, height: 40, borderRadius: 20, background: '#1e1b4b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                        {server.icon_url ? <img src={resolveAssetUrl(server.icon_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{server.name.charAt(0)}</span>}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#fff', fontWeight: '500', fontSize: 14, marginBottom: 2 }}>{server.name}</div>
                                        <div style={{ color: '#fbbf24', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Sparkles size={10} />
                                            Level {server.boost_level || 0}
                                        </div>
                                    </div>
                                    {selectedBoostServer === server._id && <Check size={18} color="#a855f7" />}
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        disabled={!selectedBoostServer || applyingBoost}
                        onClick={handleApplyBoost}
                        style={{
                            ...styles.saveBtn,
                            width: '100%',
                            opacity: (!selectedBoostServer || applyingBoost) ? 0.5 : 1,
                            padding: '14px',
                            fontSize: 15,
                            border: 'none',
                            marginBottom: 0
                        }}
                    >
                        {applyingBoost ? 'Applying Boost...' : `Confirm Application`}
                    </button>
                </div>
            </div>
        );
    }

    if (showNexusEliteModal) return <NexusEliteModal onClose={() => setShowNexusEliteModal(false)} />;"""
text = text.replace(modal_target, modal_replace)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
