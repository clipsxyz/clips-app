import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import { glassPanel, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { mapLaravelUserToAppFields, updateAuthProfile } from '../api/client';
import { uploadFileFromUri } from '../utils/uploadFileNative';
import { hasCustomProfileCover, resolveProfileCoverSource, DEFAULT_PROFILE_COVER_SOURCE } from '../utils/profileCoverNative';
import type { User } from '../types';

type CoverAlertConfig = {
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
};

export default function ProfileCoverScreen({ navigation }: any) {
    const { user, login } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [coverAlert, setCoverAlert] = useState<CoverAlertConfig | null>(null);

    const showCoverAlert = (config: CoverAlertConfig) => setCoverAlert(config);

    const coverUrl = user?.profileBackgroundUrl || '';
    const customCover = hasCustomProfileCover(coverUrl);
    const [previewFailed, setPreviewFailed] = useState(false);
    const previewSource = previewFailed
        ? DEFAULT_PROFILE_COVER_SOURCE
        : resolveProfileCoverSource(coverUrl);

    useEffect(() => {
        setPreviewFailed(false);
    }, [coverUrl]);

    const saveCoverUrl = useCallback(
        async (nextUrl: string) => {
            if (!user) return;
            const normalized = nextUrl.trim();
            if (isLaravelApiEnabled()) {
                const apiUser = await updateAuthProfile({
                    profile_background_url: normalized || null,
                });
                const fields = mapLaravelUserToAppFields(apiUser as Record<string, unknown>);
                login({
                    ...user,
                    ...fields,
                    profileBackgroundUrl: normalized || undefined,
                } as User);
                return;
            }
            login({
                ...user,
                profileBackgroundUrl: normalized || undefined,
            } as User);
        },
        [login, user],
    );

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
                    showCoverAlert({
                        title: 'Photo error',
                        message: response.errorMessage || 'Could not open your photo library.',
                        icon: 'alert',
                    });
                    return;
                }
                const asset = response.assets?.[0];
                if (!asset?.uri) {
                    showCoverAlert({
                        title: 'Invalid file',
                        message: 'Please choose an image file.',
                        icon: 'alert',
                    });
                    return;
                }
                if (asset.type && !asset.type.startsWith('image/')) {
                    showCoverAlert({
                        title: 'Invalid file',
                        message: 'Please choose an image file.',
                        icon: 'alert',
                    });
                    return;
                }
                void uploadCover(asset.uri, asset.type || 'image/jpeg', asset.fileName, asset.base64);
            },
        );
    };

    const uploadCover = async (
        uri: string,
        mimeType?: string,
        fileName?: string,
        base64?: string,
    ) => {
        setIsSaving(true);
        try {
            let nextCoverUrl = '';

            if (isLaravelApiEnabled()) {
                try {
                    const upload = await uploadFileFromUri(
                        uri,
                        mimeType || 'image/jpeg',
                        fileName || 'profile-cover.jpg',
                    );
                    nextCoverUrl = upload.fileUrl || upload.url || '';
                } catch {
                    // Fall through to data URL.
                }
            }

            if (!nextCoverUrl && base64) {
                const prefix = mimeType?.includes('png') ? 'data:image/png;base64,' : 'data:image/jpeg;base64,';
                nextCoverUrl = base64.startsWith('data:') ? base64 : `${prefix}${base64}`;
            }

            if (!nextCoverUrl) {
                throw new Error('Could not prepare cover image. Try again or check your connection.');
            }

            await saveCoverUrl(nextCoverUrl);
            showCoverAlert({
                title: 'Cover updated',
                message: 'Your profile cover image has been updated.',
                icon: 'success',
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Could not update cover image.';
            showCoverAlert({
                title: 'Upload failed',
                message,
                icon: 'alert',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async () => {
        try {
            await saveCoverUrl('');
            showCoverAlert({
                title: 'Cover removed',
                message: 'Your profile is back to the default map background.',
                icon: 'success',
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Could not remove cover image.';
            showCoverAlert({
                title: 'Update failed',
                message,
                icon: 'alert',
            });
        }
    };

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCopy}>
                    <Text style={styles.headerTitle}>Profile Cover</Text>
                    <Text style={styles.headerSubtitle}>Choose the background shown behind your profile picture</Text>
                </View>
            </View>

            <View style={styles.body}>
                <View style={styles.previewCard}>
                    <Image
                        source={previewSource}
                        style={[styles.previewImage, (!customCover || previewFailed) && styles.previewImageMuted]}
                        resizeMode="cover"
                        onError={() => {
                            if (customCover) setPreviewFailed(true);
                        }}
                    />
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.primaryBtn, isSaving && styles.btnDisabled]}
                        onPress={handlePickImage}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#111827" />
                        ) : (
                            <>
                                <Icon name="image-outline" size={18} color="#111827" />
                                <Text style={styles.primaryBtnText}>Upload image</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.secondaryBtn, (isSaving || !customCover) && styles.btnDisabled]}
                        onPress={handleRemove}
                        disabled={isSaving || !customCover}
                    >
                        <Icon name="trash-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.secondaryBtnText}>Reset</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <GazetteerAlertSheet
                visible={coverAlert !== null}
                title={coverAlert?.title ?? ''}
                message={coverAlert?.message}
                icon={coverAlert?.icon ?? 'alert'}
                confirmButtonText="OK"
                onConfirm={() => setCoverAlert(null)}
                onDismiss={() => setCoverAlert(null)}
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        ...gazetteerHeader,
    },
    headerCopy: { flex: 1 },
    headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
    headerSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    body: { padding: 16, gap: 16 },
    previewCard: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        ...glassPanel,
    },
    previewImage: {
        width: '100%',
        height: 200,
    },
    previewImageMuted: {
        opacity: 0.85,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    primaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 14,
    },
    primaryBtnText: {
        color: '#111827',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    secondaryBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    btnDisabled: {
        opacity: 0.5,
    },
});
