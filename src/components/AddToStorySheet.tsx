import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCameraOutline, IoImagesOutline, IoLinkOutline, IoVideocamOutline } from 'react-icons/io5';
import GazetteerAlertSheet from './GazetteerAlertSheet';
import GazetteerMenuSheet from './GazetteerMenuSheet';

type Props = {
    visible: boolean;
    onDismiss: () => void;
};

function openDeviceFileInput(input: HTMLInputElement | null) {
    if (!input) return;
    try {
        if (typeof input.showPicker === 'function') {
            void input.showPicker();
            return;
        }
    } catch {
        /* fall through to click() */
    }
    input.click();
}

/** Same “Add to your story” card as Create, shown over the current screen. */
export default function AddToStorySheet({ visible, onDismiss }: Props) {
    const navigate = useNavigate();
    const libraryRef = React.useRef<HTMLInputElement | null>(null);
    const photoRef = React.useRef<HTMLInputElement | null>(null);
    const videoRef = React.useRef<HTMLInputElement | null>(null);
    const [alert, setAlert] = React.useState<{ title: string; message: string } | null>(null);

    const resetInputs = () => {
        if (libraryRef.current) libraryRef.current.value = '';
        if (photoRef.current) photoRef.current.value = '';
        if (videoRef.current) videoRef.current.value = '';
    };

    const ingestStoryFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = Array.from(files).find(
            (item) => item.type.startsWith('image/') || item.type.startsWith('video/'),
        );
        if (!file) {
            setAlert({
                title: 'No Supported Files',
                message: 'Please select images or videos from your gallery.',
            });
            resetInputs();
            return;
        }

        const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
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
                        onPress: () => openDeviceFileInput(libraryRef.current),
                    },
                    {
                        label: 'Take photo',
                        icon: <IoCameraOutline size={20} color="#FFFFFF" />,
                        onPress: () => openDeviceFileInput(photoRef.current),
                    },
                    {
                        label: 'Record video',
                        icon: <IoVideocamOutline size={20} color="#FFFFFF" />,
                        onPress: () => openDeviceFileInput(videoRef.current),
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
            <input
                ref={libraryRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => {
                    void ingestStoryFiles(event.target.files);
                }}
            />
            <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                    void ingestStoryFiles(event.target.files);
                }}
            />
            <input
                ref={videoRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                    void ingestStoryFiles(event.target.files);
                }}
            />
        </>
    );
}
