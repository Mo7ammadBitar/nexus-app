import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native-web';
import { useTranslation } from 'react-i18next';

const MockPayPalButton = ({ amount, description, onSuccess, style }) => {
    const { t } = useTranslation();
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePress = () => {
        setIsProcessing(true);

        // Simulate network delay for payment processing
        setTimeout(() => {
            setIsProcessing(false);
            if (onSuccess) onSuccess();
        }, 2000);
    };

    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={handlePress}
            disabled={isProcessing}
        >
            {isProcessing ? (
                <View style={styles.processingContent}>
                    <ActivityIndicator size="small" color="#003087" />
                    <Text style={styles.processingText}>{t('common.processing', 'Processing...')}</Text>
                </View>
            ) : (
                <View style={styles.content}>
                    <View style={styles.paypalLogo}>
                        <Text style={[styles.paypalText, { color: '#003087' }]}>Pay</Text>
                        <Text style={[styles.paypalText, { color: '#009cde' }]}>Pal</Text>
                    </View>
                    <Text style={styles.amountText}>{amount}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ffc439',
        borderRadius: 4,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 200,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    paypalLogo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    paypalText: {
        fontSize: 18,
        fontWeight: 'bold',
        fontStyle: 'italic',
        fontFamily: 'Verdana, sans-serif',
    },
    amountText: {
        color: '#003087',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    processingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    processingText: {
        color: '#003087',
        fontSize: 14,
        fontWeight: '500',
    },
});

export default MockPayPalButton;
