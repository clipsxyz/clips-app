export type UploadOverlayStatus = 'uploading' | 'success' | 'error';

export type UploadOverlayState = {
    id: string;
    thumbUri?: string;
    thumbType?: 'image' | 'video';
    /** Text-only post preview tile (web upload overlay parity). */
    textThumbBackground?: string;
    textThumbLabel?: string;
    title: string;
    message: string;
    status: UploadOverlayStatus;
    /** 0–1 while a video is compressing. Absent once upload continues. */
    fraction?: number;
};

export type UploadOverlayController = {
    id: string;
    progress: (message?: string, title?: string, fraction?: number) => void;
    success: (message?: string) => void;
    error: (message?: string) => void;
    dismiss: () => void;
};

type Listener = (state: UploadOverlayState | null) => void;

const listeners = new Set<Listener>();
const jobControllers = new Map<string, UploadOverlayController>();

function emit(state: UploadOverlayState | null) {
    listeners.forEach((fn) => fn(state));
}

export function subscribeUploadOverlay(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function showUploadOverlayNative(opts: {
    thumbUri?: string;
    thumbType?: 'image' | 'video';
    textThumbBackground?: string;
    textThumbLabel?: string;
    initialMessage?: string;
    uploadingTitle?: string;
    successTitle?: string;
    errorTitle?: string;
    jobId?: string;
}): UploadOverlayController {
    const id = opts.jobId || `upload-${Date.now()}`;
    const uploadingTitle = opts.uploadingTitle ?? 'Preparing post…';
    const successTitle = opts.successTitle ?? 'Posted!';
    const errorTitle = opts.errorTitle ?? 'Post failed';

    let currentTitle = uploadingTitle;
    let currentMessage = opts.initialMessage ?? 'Posting to Gazetteer…';
    let currentFraction: number | undefined;

    const update = (status: UploadOverlayStatus, message: string, title: string, fraction?: number) => {
        currentTitle = title;
        currentMessage = message;
        if (fraction === undefined) currentFraction = undefined;
        else currentFraction = Math.max(0, Math.min(1, fraction));
        emit({
            id,
            thumbUri: opts.thumbUri,
            thumbType: opts.thumbType ?? 'image',
            textThumbBackground: opts.textThumbBackground,
            textThumbLabel: opts.textThumbLabel,
            title,
            message,
            status,
            fraction: currentFraction,
        });
    };

    update('uploading', currentMessage, currentTitle);

    const controller: UploadOverlayController = {
        id,
        progress(message?: string, title?: string, fraction?: number) {
            update(
                'uploading',
                message ?? currentMessage,
                title ?? currentTitle,
                fraction === undefined ? undefined : fraction,
            );
        },
        success(message = 'Your post is now live') {
            update('success', message, successTitle);
            setTimeout(() => {
                emit(null);
                jobControllers.delete(id);
            }, 2800);
        },
        error(message = 'Could not post. Please try again.') {
            update('error', message, errorTitle);
            setTimeout(() => {
                emit(null);
                jobControllers.delete(id);
            }, 2800);
        },
        dismiss() {
            emit(null);
            jobControllers.delete(id);
        },
    };

    jobControllers.set(id, controller);
    return controller;
}

export function getUploadOverlayForJob(jobId: string): UploadOverlayController | undefined {
    return jobControllers.get(jobId);
}

export function registerUploadOverlayJob(jobId: string, controller: UploadOverlayController): void {
    jobControllers.set(jobId, controller);
}
