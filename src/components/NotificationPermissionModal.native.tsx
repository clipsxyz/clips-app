import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import {
    hasNotificationPermission,
    requestNotificationPermission,
} from '../utils/permissions';
import { syncFCMToken } from '../services/fcmService';

export const NOTIFICATION_PERMISSION_PROMPTED_KEY = '@gazetteer_permission_prompted';

type PermissionPromptResult = (granted: boolean) => void;
let permissionPromptOpener: (() => void) | null = null;
let permissionPromptResult: PermissionPromptResult | null = null;

export function registerNotificationPermissionOpener(open: () => void): () => void {
    permissionPromptOpener = open;
    return () => {
        if (permissionPromptOpener === open) permissionPromptOpener = null;
    };
}

/** Settings and other callers ask for the explanatory sheet before the OS prompt. */
export function openNotificationPermissionModal(): Promise<boolean> {
    return new Promise((resolve) => {
        permissionPromptResult = resolve;
        if (!permissionPromptOpener) {
            permissionPromptResult = null;
            resolve(false);
            return;
        }
        permissionPromptOpener();
    });
}

function finishPermissionPrompt(granted: boolean) {
    const done = permissionPromptResult;
    permissionPromptResult = null;
    done?.(granted);
}

/**
 * Explains notifications before the one-time OS prompt.
 * Mount once near the app root. It stays hidden after the user acts, and after a later visit.
 */
export default function NotificationPermissionModal() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const slide = useRef(new Animated.Value(40)).current;
    const fade = useRef(new Animated.Value(0)).current;

    useEffect(() => registerNotificationPermissionOpener(() => setVisible(true)), []);

    useEffect(() => {
        if (!user?.id) {
            setVisible(false);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const seen = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_PROMPTED_KEY);
                if (cancelled || seen) return;
                const alreadyAllowed = await hasNotificationPermission();
                if (cancelled) return;
                if (alreadyAllowed) {
                    await AsyncStorage.setItem(NOTIFICATION_PERMISSION_PROMPTED_KEY, 'granted');
                    await syncFCMToken();
                    return;
                }
                setVisible(true);
            } catch (error) {
                console.warn('[FCM] permission modal check failed:', error);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    useEffect(() => {
        if (!visible) return;
        slide.setValue(48);
        fade.setValue(0);
        Animated.parallel([
            Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.spring(slide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
        ]).start();
    }, [fade, slide, visible]);

    const remember = async (choice: 'enabled' | 'later') => {
        try {
            await AsyncStorage.setItem(NOTIFICATION_PERMISSION_PROMPTED_KEY, choice);
        } catch {
            /* the in-memory dismiss still stops this session */
        }
    };

    const dismiss = () => {
        Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
            setVisible(false);
        });
    };

    const onLater = () => {
        if (busy) return;
        void remember('later');
        finishPermissionPrompt(false);
        dismiss();
    };

    const onEnable = () => {
        if (busy) return;
        setBusy(true);
        void remember('enabled');
        dismiss();
        setTimeout(() => {
            void (async () => {
                try {
                    const allowed = await requestNotificationPermission();
                    if (allowed) await syncFCMToken();
                    finishPermissionPrompt(allowed);
                } catch (error) {
                    console.warn('[FCM] enable notifications failed:', error);
                    finishPermissionPrompt(false);
                } finally {
                    setBusy(false);
                }
            })();
        }, 180);
    };

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onLater}>
            <Animated.View style={[styles.backdrop, { opacity: fade }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onLater} accessibilityLabel="Maybe later" />
                <Animated.View
                    style={[
                        styles.sheet,
                        { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: slide }] },
                    ]}
                >
                    <View style={styles.handle} />
                    <View style={styles.iconWrap}>
                        <Icon name="notifications" size={28} color="#00F2FF" />
                    </View>
                    <Text style={styles.title}>Enable Notifications</Text>
                    <Text style={styles.message}>
                        Stay updated on post boosts, comments, and local activity.
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={onEnable}
                        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                    >
                        <Text style={styles.primaryText}>Enable Notifications</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        onPress={onLater}
                        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                    >
                        <Text style={styles.secondaryText}>Maybe Later</Text>
                    </Pressable>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.62)',
        justifyContent: 'flex-end',
    },
    sheet: {
        marginHorizontal: 12,
        marginBottom: 12,
        borderRadius: 24,
        backgroundColor: '#0B0E14',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.28)',
        marginBottom: 16,
    },
    iconWrap: {
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 242, 255, 0.12)',
        marginBottom: 14,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
    },
    message: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 15,
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    primary: {
        backgroundColor: '#00F2FF',
        borderRadius: 14,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryText: {
        color: '#041018',
        fontSize: 16,
        fontWeight: '700',
    },
    secondary: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    secondaryText: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 15,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.82,
    },
});
