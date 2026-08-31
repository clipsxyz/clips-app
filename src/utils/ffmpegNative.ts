type FfmpegModule = {
    FFmpegKit: {
        execute: (command: string) => Promise<{
            getReturnCode: () => Promise<unknown>;
            getAllLogsAsString: () => Promise<string>;
        }>;
    };
    ReturnCode: {
        isSuccess: (code: unknown) => boolean;
    };
};

let ffmpegModulePromise: Promise<FfmpegModule> | null = null;

export async function loadFfmpeg(): Promise<FfmpegModule> {
    if (!ffmpegModulePromise) {
        const specifier = 'ffmpeg-kit-react-native-alt';
        ffmpegModulePromise = import(specifier) as Promise<FfmpegModule>;
    }
    return ffmpegModulePromise;
}

export function toFfmpegPath(uri: string): string {
    const trimmed = uri.trim();
    if (trimmed.startsWith('file://')) {
        return decodeURIComponent(trimmed.replace('file://', ''));
    }
    return trimmed;
}

export function toFileUri(path: string): string {
    if (path.startsWith('file://') || path.startsWith('content://')) {
        return path;
    }
    return `file://${path}`;
}

export function makeSiblingOutputPath(inputUri: string, suffix: string, ext: string): string {
    const inputPath = toFfmpegPath(inputUri);
    const base = inputPath.replace(/\.[^/.]+$/, '');
    return `${base}-${suffix}-${Date.now()}.${ext}`;
}

/** Run an FFmpeg CLI string; throws with session logs on failure. */
export async function executeFfmpeg(command: string): Promise<void> {
    const { FFmpegKit, ReturnCode } = await loadFfmpeg();
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();
    if (!ReturnCode.isSuccess(returnCode)) {
        const logs = await session.getAllLogsAsString();
        throw new Error(logs || 'FFmpeg command failed');
    }
}
