import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native-web';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service here
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        // Alternatively, force a hard reload: window.location.reload();
    }

    render() {
        if (this.state.hasError) {
            // Render the discord/ethereal dark-themed fallback UI
            return (
                <View style={styles.fallbackContainer}>
                    <View style={styles.errorBox}>
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorTitle}>The weave has tangled!</Text>
                        <Text style={styles.errorDescription}>
                            Oops! This section of the realm encountered an unexpected error.
                        </Text>
                        <TouchableOpacity style={styles.retryButton} onPress={this.handleReload}>
                            <Text style={styles.retryButtonText}>Attempt Restoration</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    fallbackContainer: {
        flex: 1,
        backgroundColor: '#0f172a', // deep dark ethereal bg
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        borderRadius: 8,
    },
    errorBox: {
        backgroundColor: '#1e293b',
        padding: 32,
        borderRadius: 16,
        alignItems: 'center',
        maxWidth: 400,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        borderWidth: 1,
        borderColor: '#334155',
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorTitle: {
        color: '#f8fafc',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    errorDescription: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    retryButton: {
        backgroundColor: '#6366f1', // Ethereal indigo
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        transition: 'background-color 0.2s',
    },
    retryButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 14,
    }
});

export default ErrorBoundary;
