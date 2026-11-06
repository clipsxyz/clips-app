import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ox } from '../constants/nativeOpticalScale';
import {
    boostFilterEmptyState,
    type BoostPostFilter,
} from '../utils/boostPostGrid';

type Props = {
    tab: BoostPostFilter;
    onSwitchToReady: () => void;
    onCreatePost: () => void;
};

export default function BoostEmptyState({ tab, onSwitchToReady, onCreatePost }: Props) {
    const empty = boostFilterEmptyState(tab);
    const onPress = empty.action === 'ready' ? onSwitchToReady : onCreatePost;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>{empty.title}</Text>
            <Text style={styles.message}>{empty.message}</Text>
            <TouchableOpacity
                onPress={onPress}
                style={styles.button}
                accessibilityRole="button"
                accessibilityLabel={empty.actionLabel}
            >
                <Text style={styles.buttonText}>{empty.actionLabel}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        maxWidth: ox(300),
        paddingHorizontal: ox(20),
        paddingVertical: ox(22),
        borderRadius: ox(16),
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
    },
    title: {
        fontSize: ox(17),
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: ox(8),
    },
    message: {
        fontSize: ox(14),
        lineHeight: ox(20),
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: ox(16),
    },
    button: {
        minHeight: ox(40),
        paddingHorizontal: ox(16),
        borderRadius: ox(12),
        backgroundColor: '#d91b5c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
    },
});
