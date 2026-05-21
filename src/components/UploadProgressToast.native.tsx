import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    subscribeUploadOverlay,
    type UploadOverlayState,
} from '../utils/uploadOverlayNative';

/**
 * Floating upload card (web `showUploadOverlay` parity) — mount once at app root.
 */
export default function UploadProgressToast() {
    const insets = useSafeAreaInsets();
    const [state, setState] = useState<UploadOverlayState | null>(null);

    useEffect(() => subscribeUploadOverlay(setState), []);

    if (!state) return null;

    const isSuccess = state.status === 'success';
    const isError = state.status === 'error';

    return (
        <View
            style={[styles.wrap, { top: insets.top + 12 }]}
            pointerEvents="none"
        >
            <View style={styles.card}>
                <View style={styles.thumb}>
                    {state.thumbUri ? (
                        <Image source={{ uri: state.thumbUri }} style={styles.thumbImage} />
                    ) : (
                        <View style={styles.thumbPlaceholder}>
                            <Icon name="cloud-upload-outline" size={20} color="#9CA3AF" />
                        </View>
                    )}
                    {state.status === 'uploading' ? (
                        <View style={styles.thumbSpinner}>
                            <ActivityIndicator size="small" color="#f472b6" />
                        </View>
                    ) : null}
                </View>
                <View style={styles.textCol}>
                    <Text style={styles.title} numberOfLines={1}>
                        {state.title}
                    </Text>
                    <Text
                        style={[
                            styles.message,
                            isSuccess && styles.messageSuccess,
                            isError && styles.messageError,
                        ]}
                        numberOfLines={2}
                    >
                        {state.message}
                    </Text>
                </View>
                {isSuccess ? (
                    <Icon name="checkmark-circle" size={22} color="#34D399" />
                ) : null}
                {isError ? (
                    <Icon name="alert-circle" size={22} color="#F87171" />
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 9999,
        elevation: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(3, 7, 18, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.55)',
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
    },
    thumb: {
        width: 42,
        height: 56,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#020617',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.4)',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    thumbPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbSpinner: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textCol: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        color: '#E5E7EB',
        fontSize: 12,
        fontWeight: '700',
    },
    message: {
        color: '#9CA3AF',
        fontSize: 11,
        marginTop: 2,
    },
    messageSuccess: {
        color: '#A7F3D0',
    },
    messageError: {
        color: '#FECACA',
    },
});
