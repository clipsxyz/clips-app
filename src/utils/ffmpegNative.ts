type FfmpegSession = {
    getReturnCode: () => Promise<unknown>;
    getAllLogsAsString: () => Promise<string>;
    getSessionId?: () => number;
};

type FfmpegStatistics = {
    getTime?: () => number;
};

type FfmpegModule = {
    FFmpegKit: {
        execute: (command: string) => Promise<FfmpegSession>;
        executeAsync?: (
            command: string,
            completeCallback?: (session: FfmpegSession) => void,
            logCallback?: undefined,
            statisticsCallback?: (statistics: FfmpegStatistics) => void,
        ) => Promise<FfmpegSession>;
        cancel?: (sessionId?: number) => Promise<void>;
    };
    FFmpegKitConfig?: {
        enableStatistics?: () => Promise<void>;
    };
    ReturnCode: {
        isSuccess: (code: unknown) => boolean;
        isCancel?: (code: unknown) => boolean;
    };
};

export type FfmpegRunOptions = {
    /** 0–1 while FFmpeg is encoding. Requires durationSec. */
    onProgress?: (fraction: number) => void;
    /** Output length the progress timestamp is measured against. */
    durationSec?: number;
};

let statisticsReady = false;
let activeSessionId: number | undefined;

/** Stop the in-flight FFmpeg encode started with progress reporting. */
export function cancelActiveFfmpeg(): void {
    const sessionId = activeSessionId;
    if (sessionId == null) return;
    void loadFfmpeg()
        .then(({ FFmpegKit }) => FFmpegKit.cancel?.(sessionId))
        .catch(() => undefined);
}

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

/**
 * Filesystem path for ffmpeg-kit. It does not open `file://` or `content://` strings;
 * Android must be a plain absolute path such as `/data/user/0/.../clip.mp4`.
 */
export function toFfmpegPath(uri: string): string {
    let trimmed = String(uri || '').trim();
    if (/^file:\/\/file:\/\//i.test(trimmed)) {
        trimmed = trimmed.replace(/^file:\/\//i, '');
    }
    if (/^file:\/\//i.test(trimmed)) {
        const rest = trimmed.replace(/^file:\/\//i, '');
        try {
            trimmed = decodeURIComponent(rest);
        } catch {
            trimmed = rest;
        }
    }
    return trimmed;
}

/** App-private storage ffmpeg-kit can read and write on Android. Gallery folders are not. */
export function isAppWritableVideoPath(path: string): boolean {
    const plain = toFfmpegPath(path);
    return (
        plain.includes('/cache/') ||
        plain.includes('/files/') ||
        plain.startsWith('/data/user/') ||
        plain.startsWith('/data/data/')
    );
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

function ffmpegTimeSeconds(statistics: FfmpegStatistics, durationSec: number): number {
    const raw = Number(statistics?.getTime?.() ?? 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    // ffmpeg-kit reports milliseconds. A value far past the clip is microseconds.
    if (durationSec > 0 && raw > durationSec * 1000 * 4) return raw / 1_000_000;
    return raw / 1000;
}

/**
 * Run an FFmpeg CLI string with full Metro session logging.
 * On failure throws — never returns success for a non-zero ReturnCode.
 * Pass onProgress to run asynchronously so the UI can move during the encode.
 */
export async function executeFfmpeg(command: string, options: FfmpegRunOptions = {}): Promise<void> {
    console.log('[FFmpeg Log] command:', command);

    const loaded = await loadFfmpeg();
    const { FFmpegKit, ReturnCode } = loaded;
    if (typeof FFmpegKit?.execute !== 'function') {
        throw new Error(
            'FFmpeg is not available in this build. Rebuild the app with ffmpeg-kit-react-native-alt linked.',
        );
    }

    const durationSec = Number(options.durationSec);
    const onProgress = options.onProgress;
    const reportProgress =
        typeof onProgress === 'function' && Number.isFinite(durationSec) && durationSec > 0;

    let session: FfmpegSession;
    if (reportProgress && typeof FFmpegKit.executeAsync === 'function') {
        if (!statisticsReady && typeof loaded.FFmpegKitConfig?.enableStatistics === 'function') {
            await loaded.FFmpegKitConfig.enableStatistics();
            statisticsReady = true;
        }
        let lastFraction = 0;
        const report = (fraction: number) => {
            const next = Math.max(lastFraction, Math.min(0.99, fraction));
            if (next - lastFraction < 0.01) return;
            lastFraction = next;
            onProgress(next);
        };
        report(0.01);
        try {
        session = await new Promise<FfmpegSession>((resolve, reject) => {
            let settled = false;
            const finish = (value: FfmpegSession) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            FFmpegKit.executeAsync!(
                command,
                (completed) => finish(completed),
                undefined,
                (statistics) => {
                    const seconds = ffmpegTimeSeconds(statistics, durationSec);
                    if (seconds <= 0) return;
                    report(seconds / durationSec);
                },
            )
                .then((early) => {
                    const id = early?.getSessionId?.();
                    if (typeof id === 'number') activeSessionId = id;
                })
                .catch((err: unknown) => {
                    if (!settled) {
                        settled = true;
                        reject(err);
                    }
                });
        });
        } finally {
            activeSessionId = undefined;
        }
    } else {
        session = await FFmpegKit.execute(command);
    }

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
        if (typeof ReturnCode?.isCancel === 'function' && ReturnCode.isCancel(returnCode)) {
            const cancelled = new Error('Video compression cancelled');
            cancelled.name = 'FfmpegCancelled';
            throw cancelled;
        }
        const detail =
            failStack ||
            allLogs ||
            output ||
            (returnCode != null ? `returnCode=${String(returnCode)}` : 'unknown failure');
        console.warn('[FFmpeg] trim failed', { command, detail });
        const error = new Error('FFmpeg failed to trim video');
        (error as Error & { detail?: string; command?: string }).detail = detail;
        (error as Error & { command?: string }).command = command;
        throw error;
    }

    if (reportProgress) onProgress(1);
}
