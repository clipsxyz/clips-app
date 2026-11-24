import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCameraOutline, IoImagesOutline, IoLinkOutline, IoVideocamOutline } from 'react-icons/io5';
import GazetteerAlertSheet from './GazetteerAlertSheet';
import GazetteerMenuSheet from './GazetteerMenuSheet';
import CreateCameraSheet, { type CameraCaptureMode } from './CreateCameraSheet';
import { holdFeedAudio } from '../utils/feedAudioHold';

type Props = {
    visible: boolean;
    onDismiss: () => void;
};

function openDeviceFileInput(input: HTMLInputElement | null, capture = false) {
    if (!input) return;
    // showPicker ignores `capture` and can reject the camera. The camera input must be clicked.
    if (!capture && typeof input.showPicker === 'function') {
        try {
            const pending = input.showPicker();
            void Promise.resolve(pending).catch(() => {
                /* User dismissed the picker. */
            });
            return;
        } catch {
            /* fall through to click() */
        }
    }
    input.click();
}

function storyFileKind(file: File): 'image' | 'video' | null {
    const type = (file.type || '').toLowerCase();
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    const name = (file.name || '').toLowerCase();
    if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/.test(name)) return 'image';
    if (/\.(mp4|webm|mov|m4v|3gp|3gpp)$/.test(name)) return 'video';
    // Phone cameras often hand back a still with an empty type and a blank name.
    if (!type && file.size > 0) return 'image';
    return null;
}

/** Same “Add to your story” card as Create, shown over the current screen. */
export default function AddToStorySheet({ visible, onDismiss }: Props) {
    const navigate = useNavigate();
    const [cameraMode, setCameraMode] = React.useState<CameraCaptureMode | null>(null);
    const libraryRef = React.useRef<HTMLInputElement | null>(null);
    const photoRef = React.useRef<HTMLInputElement | null>(null);
    const videoRef = React.useRef<HTMLInputElement | null>(null);
    const visibleRef = React.useRef(visible);
    const pickerPendingRef = React.useRef(false);
    const choseFileRef = React.useRef(false);
    const releaseAudioRef = React.useRef<(() => void) | null>(null);
    const [alert, setAlert] = React.useState<{ title: string; message: string } | null>(null);

    const releaseFeedAudio = React.useCallback(() => {
        releaseAudioRef.current?.();
        releaseAudioRef.current = null;
    }, []);

    const holdFeed = React.useCallback(() => {
        if (!releaseAudioRef.current) releaseAudioRef.current = holdFeedAudio();
    }, []);

    React.useEffect(() => {
        visibleRef.current = visible;
        if (visible) {
            holdFeed();
            return;
        }
        if (!pickerPendingRef.current) releaseFeedAudio();
    }, [visible, holdFeed, releaseFeedAudio]);

    React.useEffect(() => () => releaseFeedAudio(), [releaseFeedAudio]);

    React.useEffect(() => {
        const coveredRef = { current: false };
        const resumeIfPickerCancelled = () => {
            if (!coveredRef.current) return;
            coveredRef.current = false;
            window.setTimeout(() => {
                if (document.visibilityState === 'hidden') return;
                if (!pickerPendingRef.current || choseFileRef.current) return;
                pickerPendingRef.current = false;
                if (!visibleRef.current) releaseFeedAudio();
            }, 400);
        };
        const markCovered = () => {
            if (pickerPendingRef.current) coveredRef.current = true;
        };
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                markCovered();
                return;
            }
            resumeIfPickerCancelled();
        };
        window.addEventListener('blur', markCovered);
        window.addEventListener('focus', resumeIfPickerCancelled);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('blur', markCovered);
            window.removeEventListener('focus', resumeIfPickerCancelled);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [releaseFeedAudio]);

    const finishPicker = (choseFile: boolean) => {
        choseFileRef.current = choseFile;
        pickerPendingRef.current = false;
        if (!choseFile && !visibleRef.current) releaseFeedAudio();
    };

    const openPicker = (input: HTMLInputElement | null, capture = false) => {
        choseFileRef.current = false;
        pickerPendingRef.current = true;
        holdFeed();
        openDeviceFileInput(input, capture);
    };

    const resetInputs = () => {
        if (libraryRef.current) libraryRef.current.value = '';
        if (photoRef.current) photoRef.current.value = '';
        if (videoRef.current) videoRef.current.value = '';
    };

    const ingestStoryFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) {
            finishPicker(false);
            return;
        }
        const file = Array.from(files).find((item) => storyFileKind(item) !== null);
        if (!file) {
            setAlert({
                title: 'No Supported Files',
                message: 'Please select images or videos from your gallery.',
            });
            resetInputs();
            finishPicker(false);
            return;
        }

        const mediaType = storyFileKind(file) === 'video' ? 'video' : 'image';
        const mediaUrl = URL.createObjectURL(file);
        let videoDuration: number | undefined;
        if (mediaType === 'video') {
            const probeUrl = URL.createObjectURL(file);
            videoDuration = await new Promise<number | undefined>((resolve) => {
                const tempVideo = document.createElement('video');
                tempVideo.preload = 'metadata';
                tempVideo.src = probeUrl;
                let settled = false;
                const finish = (dur?: number) => {
                    if (settled) return;
                    settled = true;
                    URL.revokeObjectURL(probeUrl);
                    resolve(dur);
                };
                tempVideo.onloadedmetadata = () => {
                    const dur = tempVideo.duration;
                    finish(Number.isFinite(dur) && dur > 0 ? Math.max(0.1, Math.floor(dur * 10) / 10) : undefined);
                };
                tempVideo.onerror = () => finish(undefined);
                setTimeout(() => finish(undefined), 5000);
            });
        }

        navigate('/clip', {
            state: {
                storyMode: true,
                storyAudience: 'public',
                mediaUrl,
                mediaType,
                videoDuration,
            },
        });
        resetInputs();
    };

    return (
        <>
            <GazetteerMenuSheet
                visible={visible}
                title="Add to your story"
                subtitle="Photo, video, or a link"
                options={[
                    {
                        label: 'Photo library',
                        icon: <IoImagesOutline size={20} color="#FFFFFF" />,
                        onPress: () => openPicker(libraryRef.current),
                    },
                    {
                        label: 'Take photo',
                        icon: <IoCameraOutline size={20} color="#FFFFFF" />,
                        onPress: () => setCameraMode('photo'),
                    },
                    {
                        label: 'Record video',
                        icon: <IoVideocamOutline size={20} color="#FFFFFF" />,
                        onPress: () => setCameraMode('video'),
                    },
                    {
                        label: 'Paste a link',
                        icon: <IoLinkOutline size={20} color="#FFFFFF" />,
                        onPress: () => navigate('/create/story-link'),
                    },
                ]}
                onDismiss={onDismiss}
            />
            <GazetteerAlertSheet
                visible={alert !== null}
                title={alert?.title ?? ''}
                message={alert?.message}
                icon="alert"
                confirmButtonText="OK"
                onConfirm={() => setAlert(null)}
                onDismiss={() => setAlert(null)}
            />
            <CreateCameraSheet
                visible={cameraMode != null}
                mode={cameraMode ?? 'photo'}
                maxVideoSeconds={15}
                countdown={cameraMode === 'video'}
                onClose={() => setCameraMode(null)}
                onCapture={(file) => {
                    setCameraMode(null);
                    const transfer = new DataTransfer();
                    transfer.items.add(file);
                    void ingestStoryFiles(transfer.files);
                }}
            />
            <input
                ref={libraryRef}
                type="file"
                accept="image/*,video/*,.heic,.heif"
                className="fixed left-0 top-0 h-px w-px opacity-0"
                onChange={(event) => {
                    finishPicker(true);
                    void ingestStoryFiles(event.target.files);
                }}
                onCancel={() => finishPicker(false)}
            />
            <input
                ref={photoRef}
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                className="fixed left-0 top-0 h-px w-px opacity-0"
                onChange={(event) => {
                    finishPicker(true);
                    void ingestStoryFiles(event.target.files);
                }}
                onCancel={() => finishPicker(false)}
            />
            <input
                ref={videoRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="fixed left-0 top-0 h-px w-px opacity-0"
                onChange={(event) => {
                    finishPicker(true);
                    void ingestStoryFiles(event.target.files);
                }}
                onCancel={() => finishPicker(false)}
            />
        </>
    );
}
