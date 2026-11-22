import React, { useCallback, useState } from 'react';
import type { Asset } from 'react-native-image-picker';
import GazetteerAlertSheet from './GazetteerAlertSheet.native';
import GazetteerMenuSheet from './GazetteerMenuSheet.native';
import CreateCameraSheet, { type CameraCaptureMode, type CapturedCameraMedia } from './CreateCameraSheet.native';
import { MAX_STORIES_VIDEO_DURATION_SEC } from '../utils/autoTrimVideoNative';
import { pickFromFullGallery } from '../utils/pickDeviceMediaNative';
import { requestInAppCameraAccess } from '../utils/galleryMediaPermissionsNative';

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
    const [cameraMode, setCameraMode] = useState<CameraCaptureMode | null>(null);

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

    const openCaptured = useCallback(
        (media: CapturedCameraMedia) => {
            openComposer(media);
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
                            void (async () => {
                                const allowed = await requestInAppCameraAccess('photo');
                                if (!allowed) {
                                    setAlert({
                                        title: 'Camera access needed',
                                        message: 'Allow the camera so you can take a photo for your Shorts.',
                                        icon: 'alert',
                                    });
                                    return;
                                }
                                setCameraMode('photo');
                            })();
                        },
                    },
                    {
                        label: 'Record video',
                        icon: 'videocam-outline',
                        onPress: () => {
                            void (async () => {
                                const allowed = await requestInAppCameraAccess('video');
                                if (!allowed) {
                                    setAlert({
                                        title: 'Camera access needed',
                                        message: 'Allow the camera so you can record a video for your Shorts. Video also asks for the microphone.',
                                        icon: 'alert',
                                    });
                                    return;
                                }
                                setCameraMode('video');
                            })();
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
            <CreateCameraSheet
                visible={cameraMode != null}
                mode={cameraMode ?? 'photo'}
                maxVideoSeconds={MAX_STORIES_VIDEO_DURATION_SEC}
                countdown={cameraMode === 'video'}
                onClose={() => setCameraMode(null)}
                onCapture={(media) => {
                    setCameraMode(null);
                    openCaptured(media);
                }}
            />
        </>
    );
}
