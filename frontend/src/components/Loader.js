import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native-web';

const Loader = ({ size = 48, color = '#6366f1' }) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: false,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: false,
                })
            ])
        ).start();
    }, [pulseAnim]);

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.circle,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderColor: color,
                        opacity: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1]
                        }),
                        transform: [{
                            scale: pulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.8, 1.2]
                            })
                        }]
                    }
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)', // Subtle dark ethereal background
        padding: 24,
    },
    circle: {
        borderWidth: 4,
        borderStyle: 'solid',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    }
});

export default Loader;
