import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/Auth';
import GazetteerAlertSheet from './GazetteerAlertSheet.native';
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
    const { user } = useAuth();
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);

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

    const remember = async (choice: 'enabled' | 'later') => {
        try {
            await AsyncStorage.setItem(NOTIFICATION_PERMISSION_PROMPTED_KEY, choice);
        } catch {
            /* the in-memory dismiss still stops this session */
        }
    };

    const onLater = () => {
        if (busy) return;
        void remember('later');
        finishPermissionPrompt(false);
        setVisible(false);
    };

    const onEnable = () => {
        if (busy) return;
        setBusy(true);
        setVisible(false);
        void remember('enabled');
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
    };

    return (
        <GazetteerAlertSheet
            visible={visible}
            title="Enable Notifications"
            message="Stay updated on post boosts, comments, and local activity."
            icon="info"
            confirmButtonText={busy ? 'Please wait...' : 'Enable Notifications'}
            cancelButtonText="Maybe Later"
            showCancelButton
            onConfirm={onEnable}
            onDismiss={onLater}
        />
    );
}
