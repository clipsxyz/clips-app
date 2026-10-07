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
        // Non-literal specifier: the alt package ships an ambient `declare module` d.ts,
        // so a literal import() would not resolve to a module type.
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

/** True when the native FFmpeg module exposes a synchronous execute entry point. */
export async function isFfmpegExecuteAvailable(): Promise<boolean> {
    try {
        const { FFmpegKit } = await loadFfmpeg();
        return typeof FFmpegKit?.execute === 'function';
    } catch {
        return false;
    }
}

async function readSessionField(
    session: { [key: string]: unknown } | null | undefined,
    method: string,
): Promise<string> {
    const fn = session?.[method];
    if (typeof fn !== 'function') return '';
    try {
        const value = await (fn as () => Promise<unknown>).call(session);
        return value == null ? '' : String(value);
    } catch {
        return '';
    }
}

/**
 * Run an FFmpeg CLI string with full Metro session logging.
 * On failure throws — never returns success for a non-zero ReturnCode.
 */
export async function executeFfmpeg(command: string): Promise<void> {
    console.log('[FFmpeg Log] command:', command);

    const { FFmpegKit, ReturnCode } = await loadFfmpeg();
    if (typeof FFmpegKit?.execute !== 'function') {
        throw new Error(
            'FFmpeg is not available in this build. Rebuild the app with ffmpeg-kit-react-native-alt linked.',
        );
    }

    const session = await FFmpegKit.execute(command);

    const returnCode =
        typeof session?.getReturnCode === 'function' ? await session.getReturnCode() : null;
    const output = await readSessionField(session as any, 'getOutput');
    const allLogs = await readSessionField(session as any, 'getAllLogsAsString');
    const failStack = await readSessionField(session as any, 'getFailStackTrace');
    const state = await readSessionField(session as any, 'getState');

    const logBlob = [output, allLogs].filter(Boolean).join('\n') || '(no session output)';
    console.log('[FFmpeg Log]', logBlob);
    if (failStack) {
        console.log('[FFmpeg Log] failStackTrace:', failStack);
    }
    if (state) {
        console.log('[FFmpeg Log] state:', state);
    }
    console.log(
        '[FFmpeg Log] returnCode:',
        returnCode != null && typeof (returnCode as any)?.getValue === 'function'
            ? (returnCode as any).getValue()
            : returnCode,
    );

    const isSuccess =
        typeof ReturnCode?.isSuccess === 'function'
            ? ReturnCode.isSuccess(returnCode)
            : false;

    if (!isSuccess) {
        const detail =
            failStack ||
            allLogs ||
            output ||
            (returnCode != null ? `returnCode=${String(returnCode)}` : 'unknown failure');
        throw new Error(`FFmpeg failed to trim video: ${detail}`);
    }
}
