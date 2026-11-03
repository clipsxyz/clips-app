import React, { useCallback, useState } from 'react';
import type { Asset } from 'react-native-image-picker';
import GazetteerAlertSheet from './GazetteerAlertSheet.native';
import GazetteerMenuSheet from './GazetteerMenuSheet.native';
import { launchNativeCamera } from '../utils/launchNativeCamera';
import { ensureCameraCapturePermission } from '../utils/galleryMediaPermissionsNative';
import { pickFromFullGallery } from '../utils/pickDeviceMediaNative';
import { MAX_FEED_VIDEO_DURATION_SEC } from '../utils/validateLocalVideoNative';

type StoryNavigation = {
    navigate: (name: string, params?: Record<string, unknown>) => void;
};

type AlertState = {
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
};

function assetIsVideo(asset: { type?: string; uri?: string }) {
    return Boolean(
        asset.type?.startsWith('video') ||
            asset.uri?.toLowerCase().endsWith('.mp4') ||
            asset.uri?.toLowerCase().endsWith('.mov'),
    );
}

function assetIsSupported(asset: Asset) {
    if (!asset.uri) return false;
    if (asset.type?.startsWith('image/') || asset.type?.startsWith('video/')) return true;
    if (assetIsVideo(asset)) return true;
    return /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(asset.uri);
}

/** Same “Add to your story” card as Create, shown over the current screen. */
export default function AddToStorySheet({
    visible,
    onDismiss,
    navigation,
}: {
    visible: boolean;
    onDismiss: () => void;
    navigation: StoryNavigation;
}) {
    const [alert, setAlert] = useState<AlertState | null>(null);

    const openComposer = useCallback(
        (asset: Asset) => {
            if (!asset.uri) return;
            const isVideo = assetIsVideo(asset);
            const duration = Number(asset.duration || 0);
            navigation.navigate('Story24Composer', {
                mediaUrl: asset.uri,
                mediaType: isVideo ? 'video' : 'image',
                videoCoverTime: isVideo ? 0 : undefined,
                videoDurationSec:
                    isVideo && Number.isFinite(duration) && duration > 0
                        ? Math.max(0.1, Math.floor(duration * 10) / 10)
                        : undefined,
            });
        },
        [navigation],
    );

    const pickGallery = useCallback(async () => {
        try {
            const picked = await pickFromFullGallery(1);
            if (picked === 'denied') {
                setAlert({
                    title: 'Gallery access needed',
                    message:
                        'Allow access to all photos and videos in Settings (not “selected photos”) so you can see your full camera roll.',
                    icon: 'alert',
                });
                return;
            }
            if (picked === 'cancel') return;
            const supported = picked.filter(assetIsSupported);
            if (supported.length === 0) {
                setAlert({
                    title: 'No Supported Files',
                    message: 'Please select images or videos from your gallery.',
                    icon: 'alert',
                });
                return;
            }
            openComposer(supported[0]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Could not open your gallery.';
            setAlert({ title: 'Media error', message, icon: 'alert' });
        }
    }, [openComposer]);

    const pickCamera = useCallback(
        async (capture: 'photo' | 'video') => {
            const allowed = await ensureCameraCapturePermission(capture);
            if (!allowed) {
                setAlert({
                    title: capture === 'video' ? 'Camera and microphone needed' : 'Camera access needed',
                    message:
                        capture === 'video'
                            ? 'Allow camera and microphone in Settings to record a video for your story.'
                            : 'Allow camera access in Settings to take a photo for your story.',
                    icon: 'alert',
                });
                return;
            }
            launchNativeCamera(
                {
                    mediaType: capture,
                    quality: capture === 'video' ? 0.8 : 0.9,
                    saveToPhotos: true,
                    cameraType: 'back',
                    durationLimitSec: capture === 'video' ? MAX_FEED_VIDEO_DURATION_SEC : 0,
                },
                (response) => {
                    if (response.didCancel) return;
                    if (response.errorCode) {
                        setAlert({
                            title: 'Camera error',
                            message: response.errorMessage || 'Could not open the camera.',
                            icon: 'alert',
                        });
                        return;
                    }
                    const supported = (response.assets || []).filter(assetIsSupported);
                    if (supported.length === 0) {
                        setAlert({
                            title: capture === 'video' ? 'No video' : 'No photo',
                            message:
                                capture === 'video'
                                    ? 'No video was recorded. Try again.'
                                    : 'No photo was captured. Try again.',
                            icon: 'alert',
                        });
                        return;
                    }
                    openComposer(supported[0]);
                },
            );
        },
        [openComposer],
    );

    return (
        <>
            <GazetteerMenuSheet
                visible={visible}
                title="Add to your story"
                subtitle="Photo, video, or a link"
                options={[
                    {
                        label: 'Photo library',
                        icon: 'images-outline',
                        onPress: () => {
                            void pickGallery();
                        },
                    },
                    {
                        label: 'Take photo',
                        icon: 'camera-outline',
                        onPress: () => {
                            void pickCamera('photo');
                        },
                    },
                    {
                        label: 'Record video',
                        icon: 'videocam-outline',
                        onPress: () => {
                            void pickCamera('video');
                        },
                    },
                    {
                        label: 'Paste a link',
                        icon: 'link-outline',
                        onPress: () => navigation.navigate('StoryLinkCreate'),
                    },
                ]}
                onDismiss={onDismiss}
            />
            <GazetteerAlertSheet
                visible={alert !== null}
                title={alert?.title ?? ''}
                message={alert?.message}
                icon={alert?.icon ?? 'alert'}
                confirmButtonText="OK"
                onConfirm={() => setAlert(null)}
                onDismiss={() => setAlert(null)}
            />
        </>
    );
}
