import { Platform, ToastAndroid, Alert } from 'react-native';
import {
    executeFfmpeg,
    makeSiblingOutputPath,
    toFfmpegPath,
    toFileUri,
} from './ffmpegNative';
import { resolveLocalMediaUriForFfmpeg } from './resolveLocalMediaUriForFfmpegNative';
import { normalizeNativeUploadUri } from './uploadFileNative';
import { statLocalFileBytes } from './localFileNative';

/** Feed clip cap — always keep / show the first 60 seconds. */
export const MAX_FEED_VIDEO_DURATION_SEC = 60;

/**
 * Soft client warning threshold. After a successful 60s re-encode we still upload
 * (Laravel accepts up to ~256MB) — never block the user with UploadTooLarge if we
 * already produced a 60s clip.
 */
export const MAX_UPLOAD_VIDEO_BYTES = 50 * 1024 * 1024;

/** Absolute ceiling matching Laravel `max:262144` (KB) — only then refuse. */
export const ABSOLUTE_UPLOAD_VIDEO_BYTES = 240 * 1024 * 1024;

const AUTO_TRIM_TOAST = 'Clips are limited to 60s — we trimmed your video automatically';

export type AutoTrimVideoResult = {
    uri: string;
    durationSec: number;
    wasTrimmed: boolean;
    sizeBytes: number | null;
};

type CompressTrimOptions = {
    maxSeconds?: number;
    crf?: number;
    maxWidth?: number;
    audioBitrate?: string;
    videoBitrate?: string;
    suffix?: string;
};

function showAutoTrimToast(message: string = AUTO_TRIM_TOAST): void {
    if (Platform.OS === 'android') {
        try {
            ToastAndroid.show(message, ToastAndroid.LONG);
            return;
        } catch {
            /* fall through */
        }
    }
    Alert.alert('Video', message);
}

export function bytesToMb(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(2);
}

/**
 * Take the first N seconds while re-encoding (never `-c copy`).
 */
export async function compressTrimVideoToMaxSeconds(
    inputUri: string,
    options: CompressTrimOptions | number = {},
): Promise<string> {
    const opts: CompressTrimOptions =
        typeof options === 'number' ? { maxSeconds: options } : options;
    const maxSeconds = opts.maxSeconds ?? MAX_FEED_VIDEO_DURATION_SEC;
    const crf = opts.crf ?? 28;
    const maxWidth = opts.maxWidth ?? 720;
    const audioBitrate = opts.audioBitrate ?? '128k';
    const suffix = opts.suffix ?? `trim${maxSeconds}c${crf}`;

    const resolved = await resolveLocalMediaUriForFfmpeg(inputUri);
    const inputPath = toFfmpegPath(resolved);
    const outputPath = makeSiblingOutputPath(resolved, suffix, 'mp4');
    const t = Math.max(1, Math.floor(maxSeconds));

    const bitrateArgs = opts.videoBitrate
        ? [`-b:v ${opts.videoBitrate}`, `-maxrate ${opts.videoBitrate}`, `-bufsize ${opts.videoBitrate}`]
        : [];

    const command = [
        '-y',
        `-ss 00:00:00`,
        `-i "${inputPath}"`,
        `-t ${t}`,
        `-vf "scale='min(${maxWidth},iw)':-2"`,
        '-c:v libx264',
        `-crf ${crf}`,
        '-preset ultrafast',
        ...bitrateArgs,
        '-c:a aac',
        `-b:a ${audioBitrate}`,
        '-movflags +faststart',
        `"${outputPath}"`,
    ].join(' ');

    await executeFfmpeg(command);
    return toFileUri(outputPath);
}

/** @deprecated Use compressTrimVideoToMaxSeconds */
export const streamCopyTrimVideoToMaxSeconds = compressTrimVideoToMaxSeconds;

/**
 * Re-encode first 60s only when the clip is too long or too large.
 * Short/small gallery clips skip FFmpeg so pick + feed stay responsive.
 */
export async function ensureFeedVideoUnderLimits(
    inputUri: string,
    hints: { durationSec?: number | null; fileSize?: number | null } = {},
    options: { notify?: boolean } = {},
): Promise<AutoTrimVideoResult> {
    const notify = options.notify !== false;
    const normalized = normalizeNativeUploadUri(inputUri);
    let duration =
        typeof hints.durationSec === 'number' && Number.isFinite(hints.durationSec)
            ? hints.durationSec > 1000
                ? hints.durationSec / 1000
                : hints.durationSec
            : null;
    let sizeBytes =
        typeof hints.fileSize === 'number' && hints.fileSize >= 0
            ? hints.fileSize
            : await statLocalFileBytes(normalized);

    const needsDurationCap = duration != null && duration > MAX_FEED_VIDEO_DURATION_SEC;
    const needsSizeCap = sizeBytes != null && sizeBytes > MAX_UPLOAD_VIDEO_BYTES;

    // Only encode when we already know the clip is over 60s or over the soft size cap.
    // Unknown duration used to force a multi-second FFmpeg pass before preview.
    if (!needsDurationCap && !needsSizeCap) {
        return {
            uri: normalized,
            durationSec: duration && duration > 0 ? duration : MAX_FEED_VIDEO_DURATION_SEC,
            wasTrimmed: false,
            sizeBytes,
        };
    }

    let working = normalized;
    let wasTrimmed = false;

    const passes: CompressTrimOptions[] = [
        {
            maxSeconds: MAX_FEED_VIDEO_DURATION_SEC,
            crf: 28,
            maxWidth: 720,
            audioBitrate: '128k',
            suffix: 'trim60-crf28',
        },
        {
            maxSeconds: MAX_FEED_VIDEO_DURATION_SEC,
            crf: 32,
            maxWidth: 640,
            audioBitrate: '96k',
            videoBitrate: '1200k',
            suffix: 'trim60-crf32',
        },
        {
            maxSeconds: MAX_FEED_VIDEO_DURATION_SEC,
            crf: 36,
            maxWidth: 480,
            audioBitrate: '64k',
            videoBitrate: '800k',
            suffix: 'trim60-crf36',
        },
    ];

    let lastError: unknown = null;
    for (let i = 0; i < passes.length; i++) {
        try {
            working = await compressTrimVideoToMaxSeconds(working, passes[i]);
            wasTrimmed = true;
            sizeBytes = await statLocalFileBytes(working);
            duration = MAX_FEED_VIDEO_DURATION_SEC;
            if (sizeBytes == null || sizeBytes <= MAX_UPLOAD_VIDEO_BYTES) {
                break;
            }
        } catch (err) {
            lastError = err;
            if (i === 0) {
                // First pass must succeed — otherwise we have nothing safe to upload.
                throw new Error('Could not prepare this video. Try a shorter clip.');
            }
        }
    }

    if (!wasTrimmed && lastError) {
        throw new Error('Could not prepare this video. Try a shorter clip.');
    }

    if (notify && wasTrimmed) {
        showAutoTrimToast();
    }

    return {
        uri: working,
        durationSec: MAX_FEED_VIDEO_DURATION_SEC,
        wasTrimmed,
        sizeBytes,
    };
}

/**
 * Soft check after ensureFeedVideoUnderLimits.
 * Only hard-fail at the absolute Laravel ceiling — 60s re-encode is always preferred.
 */
export async function assertLocalVideoUnderUploadLimit(
    uri: string,
    meta: { durationSec?: number | null; stage?: string } = {},
): Promise<number | null> {
    const sizeBytes = await statLocalFileBytes(uri);
    const sizeMb = sizeBytes != null ? bytesToMb(sizeBytes) : null;
    if (sizeBytes != null && sizeBytes > ABSOLUTE_UPLOAD_VIDEO_BYTES) {
        const err = new Error(
            `This clip is still too large after compression (${sizeMb}MB). Try a shorter video.`,
        );
        err.name = 'UploadTooLarge';
        throw err;
    }
    return sizeBytes;
}

export async function processSelectedVideoForFeed(
    inputUri: string,
    durationInSeconds: number,
    options: { notify?: boolean } = {},
): Promise<AutoTrimVideoResult> {
    return ensureFeedVideoUnderLimits(
        inputUri,
        { durationSec: durationInSeconds },
        options,
    );
}
