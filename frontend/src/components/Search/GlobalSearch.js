import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native-web';
import { Search, Hash, MessageSquare, X, ArrowRight, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { searchAPI } from '../../services/api';
import debounce from 'lodash.debounce';

const GlobalSearch = ({ isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Handle search query
    const performSearch = async (searchQuery) => {
        if (!searchQuery.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await searchAPI.searchMessages(searchQuery);
            setResults(response.data.results || []);
            setSelectedIndex(0);
        } catch (error) {
            console.error('Search failed:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    const debouncedSearch = useCallback(
        debounce((q) => performSearch(q), 500),
        []
    );

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        debouncedSearch(val);
    };

    const handleResultClick = (result) => {
        onClose();
        if (result.type === 'channel') {
            // Navigate to channel with message highlight
            navigate(`/channels/${result.location.server_id}/${result.location.channel_id}?highlightMessage=${result.message_id}`);
        } else if (result.type === 'dm') {
            // Navigate to DM with message highlight
            navigate(`/dashboard/dms/${result.location.friend_id}?highlightMessage=${result.message_id}`);
        }
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results.length > 0) {
                handleResultClick(results[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString(i18n.language) + ' ' + date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Search Header */}
                <div style={styles.header}>
                    <Search color="#9ca3af" size={20} />
                    <input
                        ref={inputRef}
                        style={styles.input}
                        placeholder={t('search.placeholder', 'Scry for thoughts...')}
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                    />
                    <button style={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Results List */}
                <div style={styles.resultsContainer}>
                    {loading ? (
                        <div style={styles.loadingState}>
                            <Loader className="spin" size={24} color="#7c3aed" />
                        </div>
                    ) : results.length > 0 ? (
                        <div style={styles.resultsList}>
                            {results.map((result, index) => (
                                <div
                                    key={result.message_id}
                                    style={{
                                        ...styles.resultItem,
                                        backgroundColor: index === selectedIndex ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                                    }}
                                    onClick={() => handleResultClick(result)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div style={styles.resultIcon}>
                                        {result.type === 'channel' ? <Hash size={18} /> : <MessageSquare size={18} />}
                                    </div>
                                    <div style={styles.resultContent}>
                                        <div style={styles.resultHeader}>
                                            <span style={styles.senderName}>{result.sender.display_name || result.sender.username}</span>
                                            <span style={styles.locationInfo}>
                                                {t('search.in', 'in')} {result.type === 'channel'
                                                    ? `${result.location.server_name} / #${result.location.channel_name}`
                                                    : `@${result.location.friend_username}`}
                                            </span>
                                            <span style={styles.timestamp}>{formatTime(result.timestamp)}</span>
                                        </div>
                                        <div style={styles.messagePreview}>
                                            {result.content.length > 100 ? result.content.substring(0, 100) + '...' : result.content}
                                        </div>
                                    </div>
                                    {index === selectedIndex && <ArrowRight size={16} color="#7c3aed" />}
                                </div>
                            ))}
                        </div>
                    ) : query ? (
                        <div style={styles.emptyState}>
                            <p style={styles.emptyText}>{t('search.no_results', 'No visions found for')} "{query}"</p>
                        </div>
                    ) : (
                        <div style={styles.emptyState}>
                            <p style={styles.emptyText}>{t('search.empty_state', 'Scry for thoughts across all servers and soul bonds')}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <div style={styles.hotkeyHint}>
                        <span style={styles.key}>↑</span>
                        <span style={styles.key}>↓</span>
                        <span>{t('search.nav', 'to navigate')}</span>
                    </div>
                    <div style={styles.hotkeyHint}>
                        <span style={styles.key}>↵</span>
                        <span>{t('search.select', 'to select')}</span>
                    </div>
                    <div style={styles.hotkeyHint}>
                        <span style={styles.key}>esc</span>
                        <span>{t('search.close', 'to close')}</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '80px',
        zIndex: 9999,
        backdropFilter: 'blur(2px)',
    },
    modal: {
        width: '600px',
        maxHeight: '600px',
        backgroundColor: '#1f2937',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: '#16213e',
    },
    input: {
        flex: 1,
        backgroundColor: 'transparent',
        border: 'none',
        color: '#fff',
        fontSize: '18px',
        marginLeft: '12px',
        outline: 'none',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#9ca3af',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '4px',
    },
    resultsContainer: {
        flex: 1,
        overflowY: 'auto',
        minHeight: '300px',
        maxHeight: '500px',
    },
    loadingState: {
        padding: '40px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        padding: '40px',
        textAlign: 'center',
        color: '#9ca3af',
    },
    emptyText: {
        margin: 0,
        fontSize: '15px',
    },
    resultsList: {
        padding: '8px 0',
    },
    resultItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        cursor: 'pointer',
        borderLeft: '2px solid transparent', // Marker placeholder
        transition: 'background-color 0.1s',
    },
    resultIcon: {
        color: '#9ca3af',
        marginRight: '12px',
        display: 'flex',
        alignItems: 'center',
    },
    resultContent: {
        flex: 1,
        overflow: 'hidden',
    },
    resultHeader: {
        display: 'flex',
        alignItems: 'baseline',
        marginBottom: '4px',
    },
    senderName: {
        color: '#fff',
        fontWeight: '600',
        fontSize: '14px',
        marginRight: '8px',
    },
    locationInfo: {
        color: '#9ca3af',
        fontSize: '12px',
        marginRight: 'auto',
    },
    timestamp: {
        color: '#6b7280',
        fontSize: '11px',
        marginLeft: '8px',
    },
    messagePreview: {
        color: '#d1d5db',
        fontSize: '14px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    footer: {
        padding: '8px 16px',
        backgroundColor: '#16213e',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        gap: '16px',
        justifyContent: 'flex-end',
    },
    hotkeyHint: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: '#9ca3af',
    },
    key: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '11px',
        color: '#d1d5db',
    },
};

export default GlobalSearch;
