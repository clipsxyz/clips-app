import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import ProfileCoverHero from '../components/ProfileCoverHero.native';
import {
    UEFA_PASSPORT_GRADIENT,
    UEFA_PASSPORT_GRADIENT_LOCATIONS,
} from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { mapLaravelUserToAppFields, updateAuthProfile } from '../api/client';
import { getAvatarForHandle } from '../api/users';
import { uploadFileFromUri } from '../utils/uploadFileNative';
import { hasCustomProfileCover } from '../utils/profileCoverNative';
import type { User } from '../types';
import { ox } from '../constants/nativeOpticalScale';

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
    const displayName = user?.name || 'Your profile';
    const handle = user?.handle || '';

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
        <GazetteerScreenShell ambient={false} style={styles.shell}>
            <LinearGradient
                colors={[...UEFA_PASSPORT_GRADIENT]}
                locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.canvas}
            >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.headerIconBtn}
                    accessibilityLabel="Go back"
                >
                    <Icon name="chevron-back" size={ox(22)} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Cover</Text>
                    <Text style={styles.headerHandle} numberOfLines={1}>
                        {handle || 'Profile background'}
                    </Text>
                </View>
                <View style={styles.headerIconSpacer} />
            </View>

            <View style={styles.body}>
                <ProfileCoverHero
                    coverUrl={coverUrl}
                    avatarUrl={user?.avatarUrl || getAvatarForHandle(handle)}
                    name={displayName}
                >
                    <View style={styles.identity}>
                        <Text style={styles.identityName} numberOfLines={1}>
                            {displayName}
                        </Text>
                        {handle ? (
                            <Text style={styles.identityHandle} numberOfLines={1}>
                                {handle}
                            </Text>
                        ) : null}
                    </View>
                </ProfileCoverHero>

                <Text style={styles.hint}>This is the background behind your profile photo.</Text>

                <TouchableOpacity
                    style={[styles.uploadBtn, isSaving && styles.btnDisabled]}
                    onPress={handlePickImage}
                    disabled={isSaving}
                    activeOpacity={0.9}
                >
                    <View style={styles.uploadFill} collapsable={false}>
                        {isSaving ? (
                            <ActivityIndicator color="#000000" />
                        ) : (
                            <>
                                <Icon name="image-outline" size={ox(18)} color="#000000" style={styles.uploadIcon} />
                                <Text style={styles.uploadText}>Upload image</Text>
                            </>
                        )}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.resetBtn, (isSaving || !customCover) && styles.btnDisabled]}
                    onPress={() => {
                        void handleRemove();
                    }}
                    disabled={isSaving || !customCover}
                    activeOpacity={0.85}
                >
                    <Icon name="trash-outline" size={ox(16)} color="#FFFFFF" />
                    <Text style={styles.resetText}>Reset to map</Text>
                </TouchableOpacity>
            </View>
            </LinearGradient>

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
    shell: {
        backgroundColor: '#05050A',
    },
    canvas: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(12),
        paddingVertical: ox(8),
    },
    headerIconBtn: {
        width: ox(44),
        height: ox(44),
        borderRadius: ox(22),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerIconSpacer: {
        width: ox(44),
        height: ox(44),
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: ox(8),
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
        textAlign: 'center',
    },
    headerHandle: {
        color: '#9CA3AF',
        fontSize: ox(11),
        textAlign: 'center',
        marginTop: 1,
    },
    body: {
        paddingHorizontal: ox(16),
        paddingTop: ox(8),
    },
    identity: {
        alignItems: 'center',
        marginTop: ox(8),
    },
    identityName: {
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '700',
        textAlign: 'center',
    },
    identityHandle: {
        color: '#9CA3AF',
        fontSize: ox(12),
        marginTop: ox(2),
        textAlign: 'center',
    },
    hint: {
        color: 'rgba(255,255,255,0.62)',
        fontSize: ox(13),
        lineHeight: ox(18),
        textAlign: 'center',
        marginTop: ox(18),
        marginBottom: ox(16),
    },
    uploadBtn: {
        height: ox(48),
        borderRadius: ox(24),
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    uploadFill: {
        flex: 1,
        height: ox(48),
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadIcon: {
        marginRight: ox(8),
    },
    uploadText: {
        color: '#000000',
        fontSize: ox(15),
        fontWeight: '700',
        backgroundColor: '#FFFFFF',
    },
    resetBtn: {
        marginTop: ox(12),
        height: ox(44),
        borderRadius: ox(22),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.45)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(8),
    },
    resetText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
    btnDisabled: {
        opacity: 0.45,
    },
});
