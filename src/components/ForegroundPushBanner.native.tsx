import React, { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { handleNotificationRouting } from '../utils/navigationService';
import type { PushPayload } from '../utils/pushPayload';

const DISMISS_MS = 4500;

/** In-app banner for FCM messages that arrive while Gazetteer is in the foreground. */
export default function ForegroundPushBanner() {
    const insets = useSafeAreaInsets();
    const [payload, setPayload] = useState<PushPayload | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('foregroundPush', (next: PushPayload) => {
            if (!next?.title && !next?.body) return;
            setPayload(next);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setPayload(null), DISMISS_MS);
        });
        return () => {
            sub.remove();
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    if (!payload) return null;

    return (
        <View pointerEvents="box-none" style={[styles.host, { top: Math.max(insets.top, 12) }]}>
            <Pressable
                accessibilityRole="button"
                onPress={() => {
                    const data = payload.data || {};
                    setPayload(null);
                    handleNotificationRouting({ data });
                }}
                style={styles.card}
            >
                <Text style={styles.title} numberOfLines={1}>
                    {payload.title || 'Gazetteer'}
                </Text>
                {payload.body ? (
                    <Text style={styles.body} numberOfLines={2}>
                        {payload.body}
                    </Text>
                ) : null}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 80,
    },
    card: {
        backgroundColor: 'rgba(11, 14, 20, 0.96)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    body: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 13,
        marginTop: 2,
    },
});
