import React from 'react';

const MAX_VIDEO_SECONDS = 60;

export type CameraCaptureMode = 'photo' | 'video';

type Props = {
    visible: boolean;
    mode: CameraCaptureMode;
    onClose: () => void;
    onCapture: (file: File) => void;
    /** Chat can flip between a photo and a short video without leaving the sheet. */
    canSwitchMode?: boolean;
    onModeChange?: (mode: CameraCaptureMode) => void;
    maxVideoSeconds?: number;
    /** Show time left (90, 89, …) instead of time elapsed. */
    countdown?: boolean;
};

function formatTimer(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function preferredRecorderType() {
    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    return candidates.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) ?? '';
}

export default function CreateCameraSheet({
    visible,
    mode,
    onClose,
    onCapture,
    canSwitchMode = false,
    onModeChange,
    maxVideoSeconds = MAX_VIDEO_SECONDS,
    countdown = false,
}: Props) {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const recorderRef = React.useRef<MediaRecorder | null>(null);
    const chunksRef = React.useRef<Blob[]>([]);
    const discardRef = React.useRef(false);
    const onCaptureRef = React.useRef(onCapture);
    const [facing, setFacing] = React.useState<'environment' | 'user'>('environment');
    const [error, setError] = React.useState<string | null>(null);
    const [ready, setReady] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [recording, setRecording] = React.useState(false);
    const [elapsed, setElapsed] = React.useState(0);

    onCaptureRef.current = onCapture;
    const modeRef = React.useRef(mode);
    modeRef.current = mode;

    const stopStream = React.useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setReady(false);
    }, []);

    React.useEffect(() => {
        if (!visible) return;
        setFacing('environment');
        setElapsed(0);
        setRecording(false);
        setBusy(false);
    }, [visible]);

    React.useEffect(() => {
        if (!visible) {
            discardRef.current = true;
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop();
            }
            recorderRef.current = null;
            stopStream();
            setRecording(false);
            setElapsed(0);
            return;
        }
        let cancelled = false;
        setError(null);
        setReady(false);
        const start = async () => {
            stopStream();
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: modeRef.current === 'video' || canSwitchMode,
                    video: { facingMode: { ideal: facing } },
                });
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => undefined);
                }
                setReady(true);
            } catch {
                if (!cancelled) {
                    setError(
                        modeRef.current === 'video' || canSwitchMode
                            ? 'Allow the camera and microphone in the browser so you can record here.'
                            : 'Allow the camera in the browser so you can take a photo here.',
                    );
                }
            }
        };
        void start();
        return () => {
            cancelled = true;
            stopStream();
        };
    }, [visible, facing, canSwitchMode, stopStream]);

    React.useEffect(() => {
        if (!recording) return;
        const started = Date.now();
        const timer = window.setInterval(() => {
            const seconds = Math.min(maxVideoSeconds, Math.floor((Date.now() - started) / 1000));
            setElapsed(seconds);
            if (seconds >= maxVideoSeconds && recorderRef.current?.state === 'recording') {
                recorderRef.current.stop();
            }
        }, 250);
        return () => window.clearInterval(timer);
    }, [recording, maxVideoSeconds]);

    const takePhoto = () => {
        const video = videoRef.current;
        if (!video || !ready || busy || recording) return;
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return;
        setBusy(true);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
            setBusy(false);
            return;
        }
        if (facing === 'user') {
            context.translate(width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
            (blob) => {
                setBusy(false);
                if (!blob) {
                    setError('Could not take the photo. Try again.');
                    return;
                }
                stopStream();
                onCaptureRef.current(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.92,
        );
    };

    const toggleRecording = () => {
        if (!ready || busy) return;
        const active = recorderRef.current;
        if (active && active.state === 'recording') {
            active.stop();
            return;
        }
        const stream = streamRef.current;
        if (!stream || typeof MediaRecorder === 'undefined') {
            setError('This browser cannot record video here.');
            return;
        }
        chunksRef.current = [];
        discardRef.current = false;
        const mimeType = preferredRecorderType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
            setRecording(false);
            recorderRef.current = null;
            const type = recorder.mimeType || mimeType || 'video/webm';
            const blob = new Blob(chunksRef.current, { type });
            chunksRef.current = [];
            if (discardRef.current) {
                discardRef.current = false;
                return;
            }
            const extension = type.includes('mp4') ? 'mp4' : 'webm';
            stopStream();
            onCaptureRef.current(new File([blob], `video-${Date.now()}.${extension}`, { type }));
        };
        recorder.onerror = () => {
            setRecording(false);
            setError('Could not record the video. Try again.');
        };
        recorderRef.current = recorder;
        setElapsed(0);
        setRecording(true);
        recorder.start(250);
    };

    const close = () => {
        if (recorderRef.current && recorderRef.current.state === 'recording') {
            discardRef.current = true;
            recorderRef.current.stop();
        }
        onClose();
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-end">
            <button type="button" className="absolute inset-0 bg-black/45" aria-label="Close camera" onClick={close} />
            <div className="relative h-[80dvh] w-full overflow-hidden rounded-t-[28px] bg-black">
                <video
                    ref={videoRef}
                    className={`absolute inset-0 h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
                    autoPlay
                    muted
                    playsInline
                />
                <div className="pointer-events-none absolute left-0 right-0 top-2 flex justify-center">
                    <span className="h-1 w-9 rounded-full bg-white/55" />
                </div>
                {mode === 'video' ? (
                    <div className="pointer-events-none absolute left-0 right-0 top-6 flex justify-center">
                        <span className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-sm font-bold tabular-nums text-white">
                            <span className="h-2 w-2 rounded-full bg-[#FF3B30]" />
                            {countdown
                                ? String(Math.max(0, maxVideoSeconds - (recording ? elapsed : 0)))
                                : formatTimer(elapsed)}
                        </span>
                    </div>
                ) : null}
                {error ? (
                    <p className="absolute left-4 right-4 top-16 text-center text-sm font-semibold text-red-100">{error}</p>
                ) : null}
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-[max(18px,env(safe-area-inset-bottom))]">
                    {canSwitchMode ? (
                        <div className={`mb-[18px] flex gap-7 ${recording ? 'invisible' : ''}`}>
                            <button
                                type="button"
                                onClick={() => onModeChange?.('photo')}
                                className={`text-[13px] font-bold tracking-wide ${mode === 'photo' ? 'text-white' : 'text-white/55'}`}
                            >
                                Photo
                            </button>
                            <button
                                type="button"
                                onClick={() => onModeChange?.('video')}
                                className={`text-[13px] font-bold tracking-wide ${mode === 'video' ? 'text-white' : 'text-white/55'}`}
                            >
                                Video
                            </button>
                        </div>
                    ) : null}
                    <div className="flex w-full items-center justify-between px-7">
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Close camera"
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-2xl font-semibold text-white"
                    >
                        ×
                    </button>
                    {mode === 'video' ? (
                        <button
                            type="button"
                            onClick={toggleRecording}
                            disabled={!ready}
                            aria-label={recording ? 'Stop recording' : 'Start recording'}
                            className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-4 border-white disabled:opacity-60"
                        >
                            {recording ? (
                                <span className="h-8 w-8 rounded-lg bg-[#FF3B30]" />
                            ) : (
                                <span className="h-[66px] w-[66px] rounded-full bg-[#FF3B30]" />
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={takePhoto}
                            disabled={!ready || busy}
                            aria-label="Take photo"
                            className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-4 border-white disabled:opacity-60"
                        >
                            <span className="h-[66px] w-[66px] rounded-full bg-white" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (recording) return;
                            setFacing((current) => (current === 'environment' ? 'user' : 'environment'));
                        }}
                        disabled={recording}
                        aria-label="Flip camera"
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-40"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M8 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-1.5-2h-5L8 7z" />
                            <path d="M15 13a3 3 0 1 1-1-2.2" />
                            <path d="M15 9.5V12h-2.5" />
                        </svg>
                    </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
