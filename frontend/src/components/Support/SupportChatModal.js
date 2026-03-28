import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { supportAPI } from '../../services/api';
import { X, Send, AlertCircle, RefreshCcw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const SupportChatModal = ({ isOpen, onClose, ticket, onTicketUpdated }) => {
    const { user } = useAuthStore();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Reopen logic
    const [showReopenInput, setShowReopenInput] = useState(false);
    const [reopenReason, setReopenReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const scrollRef = useRef(null);

    useEffect(() => {
        if (isOpen && ticket) {
            loadMessages();
            setShowReopenInput(false);
            setReopenReason('');
        }
    }, [isOpen, ticket]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const res = await supportAPI.getTicketMessages(ticket._id);
            setMessages(res.data);
        } catch (error) {
            console.error('Failed to load ticket messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!newMessage.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await supportAPI.sendMessage(ticket._id, newMessage);
            setMessages(prev => [...prev, res.data]);
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRequestReopen = async () => {
        if (!reopenReason.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await supportAPI.requestReopen(ticket._id, reopenReason);
            if (onTicketUpdated) onTicketUpdated(res.data);
            setShowReopenInput(false);
        } catch (error) {
            console.error('Failed to request reopen:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !ticket) return null;

    const isClosed = ticket.status === 'closed';
    const isReopenRequested = ticket.status === 'reopen_requested';

    return (
        <View style={styles.overlay} onClick={onClose}>
            <View style={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.title}>Ticket: {ticket.subject}</Text>
                        <View style={[styles.statusBadge, isClosed ? styles.statusClosed : (isReopenRequested ? styles.statusRequested : styles.statusOpen)]}>
                            <Text style={styles.statusText}>{ticket.status.replace('_', ' ').toUpperCase()}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={20} color="#9ca3af" />
                    </TouchableOpacity>
                </View>

                {/* Chat Area */}
                <ScrollView 
                    ref={scrollRef} 
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                >
                    {loading ? (
                        <Text style={styles.loadingText}>Loading history...</Text>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMe = msg.sender_id === user._id;
                            return (
                                <View key={msg._id || idx} style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
                                    <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
                                        <Text style={styles.messageText}>{msg.message}</Text>
                                        <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeThem]}>
                                            {new Date(msg.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                {/* Input Area */}
                <View style={styles.inputSection}>
                    {isClosed ? (
                        showReopenInput ? (
                            <View style={styles.reopenForm}>
                                <Text style={styles.reopenHint}>Please provide a reason to reopen this ticket:</Text>
                                <TextInput
                                    style={styles.reopenInput}
                                    placeholder="I still need help with..."
                                    placeholderTextColor="#6b7280"
                                    value={reopenReason}
                                    onChangeText={setReopenReason}
                                    multiline
                                />
                                <View style={styles.reopenActions}>
                                    <TouchableOpacity 
                                        style={styles.cancelReopenBtn} 
                                        onPress={() => setShowReopenInput(false)}
                                    >
                                        <Text style={styles.cancelReopenText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.submitReopenBtn, (!reopenReason.trim() || isSubmitting) && styles.disabledBtn]} 
                                        onPress={handleRequestReopen}
                                        disabled={!reopenReason.trim() || isSubmitting}
                                    >
                                        <RefreshCcw size={16} color="#fff" style={{ marginRight: 6 }} />
                                        <Text style={styles.submitReopenText}>Submit Request</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.closedState}>
                                <AlertCircle size={20} color="#9ca3af" style={{ marginBottom: 8 }} />
                                <Text style={styles.closedText}>This ticket is closed.</Text>
                                <TouchableOpacity style={styles.requestReopenBtn} onPress={() => setShowReopenInput(true)}>
                                    <Text style={styles.requestReopenText}>Follow-up / Request to Reopen</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    ) : isReopenRequested ? (
                        <View style={styles.closedState}>
                            <AlertCircle size={20} color="#f59e0b" style={{ marginBottom: 8 }} />
                            <Text style={styles.closedText}>Reopen requested. Awaiting Admin review.</Text>
                        </View>
                    ) : (
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Reply to support..."
                                placeholderTextColor="#6b7280"
                                value={newMessage}
                                onChangeText={setNewMessage}
                                multiline
                            />
                            <TouchableOpacity 
                                style={[styles.sendBtn, (!newMessage.trim() || isSubmitting) && styles.disabledSendBtn]} 
                                onPress={handleSend}
                                disabled={!newMessage.trim() || isSubmitting}
                            >
                                <Send size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'blur(4px)',
    },
    modal: {
        width: '90%',
        maxWidth: 600,
        height: '80%',
        maxHeight: 800,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderWidth: 1,
        borderColor: '#374151',
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
        backgroundColor: '#111827',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        color: '#f3f4f6',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 12,
        flexShrink: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusOpen: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
    statusClosed: { backgroundColor: 'rgba(107, 114, 128, 0.2)' },
    statusRequested: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#f3f4f6',
    },
    closeBtn: {
        padding: 4,
        cursor: 'pointer',
    },
    messagesContainer: {
        flex: 1,
        backgroundColor: '#1f2937',
    },
    messagesContent: {
        padding: 16,
    },
    loadingText: {
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 20,
    },
    messageWrapper: {
        marginBottom: 16,
        flexDirection: 'row',
    },
    messageWrapperMe: {
        justifyContent: 'flex-end',
    },
    messageWrapperThem: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 12,
    },
    messageBubbleMe: {
        backgroundColor: '#6b21a8',
        borderBottomRightRadius: 4,
    },
    messageBubbleThem: {
        backgroundColor: '#374151',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        color: '#f3f4f6',
        fontSize: 14,
        lineHeight: 20,
    },
    messageTime: {
        fontSize: 11,
        marginTop: 4,
    },
    messageTimeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
    messageTimeThem: { color: '#9ca3af', textAlign: 'left' },
    inputSection: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#374151',
        backgroundColor: '#111827',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#374151',
        borderRadius: 8,
        padding: 8,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        maxHeight: 120,
        outlineWidth: 0,
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        cursor: 'pointer',
    },
    disabledSendBtn: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    closedState: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    closedText: {
        color: '#9ca3af',
        fontSize: 14,
        marginBottom: 12,
    },
    requestReopenBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#8b5cf6',
        cursor: 'pointer',
    },
    requestReopenText: {
        color: '#c4b5fd',
        fontSize: 13,
        fontWeight: '500',
    },
    reopenForm: {
        backgroundColor: '#1f2937',
        padding: 12,
        borderRadius: 8,
    },
    reopenHint: {
        color: '#d1d5db',
        fontSize: 13,
        marginBottom: 8,
    },
    reopenInput: {
        backgroundColor: '#374151',
        color: '#fff',
        padding: 12,
        borderRadius: 6,
        minHeight: 80,
        outlineWidth: 0,
        marginBottom: 12,
        fontSize: 14,
    },
    reopenActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    cancelReopenBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        cursor: 'pointer',
    },
    cancelReopenText: {
        color: '#9ca3af',
        fontWeight: '500',
    },
    submitReopenBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8b5cf6',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        cursor: 'pointer',
    },
    disabledBtn: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    submitReopenText: {
        color: '#fff',
        fontWeight: '500',
    },
});

export default SupportChatModal;
