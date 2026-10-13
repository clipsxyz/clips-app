import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerAlertSheet from './GazetteerAlertSheet.native';
import { useAuth } from '../context/Auth';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { mapLaravelUserToAppFields, updateAuthProfile } from '../api/client';
import { uploadFileFromUri } from '../utils/uploadFileNative';
import type { User } from '../types';

type Props = {
    visible: boolean;
    onClose: () => void;
};

/** Local file/data URIs can't be stored by the backend (see AuthController::nullablePublicAvatarUrl). */
function isPersistableAvatarUrl(url: string | undefined): url is string {
    if (!url) return false;
    return /^https?:\/\//i.test(url.trim());
}

/** Web ProfilePage profile-picture modal parity — preview, change, remove. */
export default function ProfilePictureModal({ visible, onClose }: Props) {
    const { user, login } = useAuth();
    const [busy, setBusy] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{
        title: string;
        message?: string;
        icon?: 'success' | 'alert' | 'info';
        onConfirm?: () => void;
        showCancelButton?: boolean;
    } | null>(null);

    const saveAvatarUrl = async (nextUrl: string | undefined) => {
        if (!user) return;
        // Persist to the backend first so /auth/me can't revert the avatar on the
        // next launch. Removal (undefined) clears the stored URL server-side.
        if (isLaravelApiEnabled() && (nextUrl === undefined || isPersistableAvatarUrl(nextUrl))) {
            try {
                const apiUser = await updateAuthProfile({
                    avatar_url: isPersistableAvatarUrl(nextUrl) ? nextUrl : null,
                });
                const fields = mapLaravelUserToAppFields(apiUser as Record<string, unknown>);
                login({
                    ...(user as User),
                    ...fields,
                    avatarUrl:
                        (fields.avatarUrl as string | undefined) ||
                        (isPersistableAvatarUrl(nextUrl) ? nextUrl : undefined),
                });
                return;
            } catch (error) {
                console.error('Failed to persist profile avatar:', error);
                throw error;
            }
        }
        login({
            ...user,
            avatarUrl: nextUrl,
        } as User);
    };

    const handlePickImage = () => {
        ImagePicker.launchImageLibrary(
            {
                mediaType: 'photo',
                quality: 0.9,
                includeBase64: true,
                selectionLimit: 1,
            },
            (response) => {
                if (response.didCancel) return;
                if (response.errorCode) {
                    setAlertConfig({
                        title: 'Photo error',
                        message: response.errorMessage || 'Could not open your photo library.',
                        icon: 'alert',
                    });
                    return;
                }
                const asset = response.assets?.[0];
                if (!asset?.uri) {
                    setAlertConfig({
                        title: 'Invalid file',
                        message: 'Please choose an image file.',
                        icon: 'alert',
                    });
                    return;
                }
                void applyAvatar(asset.uri, asset.type || 'image/jpeg', asset.fileName, asset.base64);
            },
        );
    };

    const applyAvatar = async (
        uri: string,
        mimeType?: string,
        fileName?: string,
        base64?: string,
    ) => {
        if (!user) return;
        setBusy(true);
        try {
            let nextAvatarUrl = '';

            if (isLaravelApiEnabled()) {
                try {
                    const upload = await uploadFileFromUri(
                        uri,
                        mimeType || 'image/jpeg',
                        fileName || 'profile-avatar.jpg',
                    );
                    nextAvatarUrl = upload.fileUrl || upload.url || '';
                } catch {
                    // Fall through to local URI / data URL.
                }
            }

            if (!nextAvatarUrl && base64) {
                const prefix = mimeType?.includes('png') ? 'data:image/png;base64,' : 'data:image/jpeg;base64,';
                nextAvatarUrl = base64.startsWith('data:') ? base64 : `${prefix}${base64}`;
            }

            if (!nextAvatarUrl) {
                nextAvatarUrl = uri;
            }

            await saveAvatarUrl(nextAvatarUrl);
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Could not update profile picture.';
            setAlertConfig({
                title: 'Update failed',
                message,
                icon: 'alert',
            });
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = () => {
        if (!user?.avatarUrl) return;
        setAlertConfig({
            title: 'Remove photo?',
            message: 'Your profile will show your initials instead.',
            icon: 'alert',
            showCancelButton: true,
            onConfirm: () => {
                void saveAvatarUrl(undefined)
                    .then(() => {
                        setAlertConfig(null);
                        onClose();
                    })
                    .catch((err: unknown) => {
                        setAlertConfig({
                            title: 'Update failed',
                            message: err instanceof Error ? err.message : 'Could not remove profile picture.',
                            icon: 'alert',
                        });
                    });
            },
        });
    };

    if (!user) return null;

    const initial = (user.name || user.handle || 'U').charAt(0).toUpperCase();

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <View style={styles.centerWrap}>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
                        <Icon name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.avatarRing}>
                        {user.avatarUrl ? (
                            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarInitial}>{initial}</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.changeBtn, busy && styles.changeBtnDisabled]}
                        onPress={handlePickImage}
                        disabled={busy}
                    >
                        {busy ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <Icon name="camera-outline" size={22} color="#F3F4F6" />
                                <Text style={styles.changeBtnText}>Change</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {user.avatarUrl ? (
                        <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} disabled={busy}>
                            <Text style={styles.removeBtnText}>Remove photo</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            <GazetteerAlertSheet
                visible={alertConfig !== null}
                title={alertConfig?.title ?? ''}
                message={alertConfig?.message}
                icon={alertConfig?.icon ?? 'alert'}
                confirmButtonText={alertConfig?.showCancelButton ? 'Remove' : 'OK'}
                cancelButtonText="Cancel"
                showCancelButton={alertConfig?.showCancelButton ?? false}
                onConfirm={() => {
                    if (alertConfig?.onConfirm) {
                        alertConfig.onConfirm();
                        return;
                    }
                    setAlertConfig(null);
                }}
                onDismiss={() => setAlertConfig(null)}
            />
        </Modal>
    );
}

const AVATAR_SIZE = 192;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.82)',
    },
    centerWrap: {
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        gap: 20,
    },
    closeBtn: {
        position: 'absolute',
        top: -8,
        right: 0,
        padding: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    avatarRing: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#374151',
        backgroundColor: '#1F2937',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1F2937',
    },
    avatarInitial: {
        fontSize: 72,
        fontWeight: '700',
        color: '#F3F4F6',
    },
    changeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        minWidth: 140,
        justifyContent: 'center',
    },
    changeBtnDisabled: {
        opacity: 0.7,
    },
    changeBtnText: {
        color: '#F3F4F6',
        fontSize: 14,
        fontWeight: '600',
    },
    removeBtn: {
        paddingVertical: 8,
    },
    removeBtnText: {
        color: '#F87171',
        fontSize: 14,
        fontWeight: '600',
    },
});
