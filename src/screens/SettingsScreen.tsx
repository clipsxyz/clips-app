import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { openNotificationPermissionModal } from '../components/NotificationPermissionModal.native';
import { clearCachedFcmToken, syncFCMToken } from '../services/fcmService';
import { isPushNotificationAuthorized } from '../utils/permissions';
import { ox } from '../constants/nativeOpticalScale';

type RowProps = {
    /** When false, skip the permission read (settings sheet is closed). */
    active?: boolean;
    /** Close a parent modal before the pre-permission sheet is presented. */
    onBeforePermissionModal?: () => void;
};

export function PushNotificationSettingsRow({ active = true, onBeforePermissionModal }: RowProps) {
    const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
    const [busy, setBusy] = useState(false);
    const checkRef = useRef(0);

    const refresh = useCallback(() => {
        const checkId = checkRef.current + 1;
        checkRef.current = checkId;
        void isPushNotificationAuthorized().then((allowed) => {
            if (checkRef.current === checkId) setIsNotificationsEnabled(allowed);
        });
    }, []);

    useEffect(() => {
        if (!active) return;
        refresh();
    }, [active, refresh]);

    useFocusEffect(
        useCallback(() => {
            if (!active) return undefined;
            refresh();
            return undefined;
        }, [active, refresh]),
    );

    const handleToggleChange = (next: boolean) => {
        if (busy) return;
        checkRef.current += 1;
        if (!next) {
            setIsNotificationsEnabled(false);
            void clearCachedFcmToken().catch((error) => {
                console.warn('[FCM] failed to clear cached token:', error);
            });
            Alert.alert(
                'Notifications turned off',
                'Notifications turned off. To fully block alerts, update your device settings.',
            );
            return;
        }

        setBusy(true);
        setIsNotificationsEnabled(true);
        void (async () => {
            try {
                const alreadyAllowed = await isPushNotificationAuthorized();
                if (alreadyAllowed) {
                    await syncFCMToken();
                    setIsNotificationsEnabled(true);
                    return;
                }
                onBeforePermissionModal?.();
                await new Promise((resolve) => setTimeout(resolve, onBeforePermissionModal ? 320 : 0));
                const granted = await openNotificationPermissionModal();
                setIsNotificationsEnabled(granted);
            } catch (error) {
                console.warn('[FCM] settings notification toggle failed:', error);
                setIsNotificationsEnabled(false);
            } finally {
                setBusy(false);
            }
        })();
    };

    return (
        <View style={styles.row}>
            <Icon name="notifications-outline" size={ox(22)} color="#00F2FF" style={styles.icon} />
            <View style={styles.copy}>
                <Text style={styles.title}>Push Notifications</Text>
                <Text style={styles.description}>Receive updates on post boosts and activity</Text>
            </View>
            <Switch
                value={isNotificationsEnabled}
                onValueChange={handleToggleChange}
                disabled={busy}
                trackColor={{ false: 'rgba(255,255,255,0.22)', true: '#00F2FF' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="rgba(255,255,255,0.22)"
            />
        </View>
    );
}

export default function SettingsScreen({ navigation }: { navigation: { goBack: () => void } }) {
    return (
        <GazetteerScreenShell ambientVariant="passport">
            <View style={styles.screen}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
                        <Icon name="chevron-back" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>
                <PushNotificationSettingsRow />
            </View>
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        paddingHorizontal: ox(16),
        paddingTop: ox(12),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: ox(16),
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: ox(20),
        fontWeight: '700',
        marginLeft: ox(8),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: ox(12),
    },
    icon: {
        marginRight: ox(10),
    },
    copy: {
        flex: 1,
        paddingRight: ox(10),
    },
    title: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
    description: {
        marginTop: ox(2),
        color: '#8B949E',
        fontSize: ox(12),
        lineHeight: ox(17),
    },
});
