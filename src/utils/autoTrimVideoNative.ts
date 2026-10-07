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

/** Stories 24 clip cap — keep the first 15 seconds (0:00 → 0:15). */
export const MAX_STORIES_VIDEO_DURATION_SEC = 15;

/** Newsfeed clip cap — keep the first 90 seconds (0:00 → 1:30). */
export const MAX_FEED_VIDEO_DURATION_SEC = 90;

/** Long-edge scale for 4K/gallery sources during hard-trim (max 720p). */
export const HARD_TRIM_MAX_EDGE_PX = 720;

/** Aggressive hard-trim encode — target ~2–3MB / 15s and ~10MB / 90s. */
export const HARD_TRIM_VIDEO_BITRATE = '1200k';
export const HARD_TRIM_VIDEO_MAXRATE = '1500k';
export const HARD_TRIM_VIDEO_BUFSIZE = '2000k';
export const HARD_TRIM_AUDIO_BITRATE = '96k';

export type VideoUploadDestination = 'feed' | 'stories';

export function maxVideoDurationForDestination(destination: VideoUploadDestination): number {
    return destination === 'stories'
        ? MAX_STORIES_VIDEO_DURATION_SEC
        : MAX_FEED_VIDEO_DURATION_SEC;
}

/**
 * Soft telemetry / legacy alias only — client never blocks upload on byte size.
 * Trimmed 15s/90s + 720p / 1200k output is expected to stay well under Laravel limits.
 */
export const MAX_UPLOAD_VIDEO_BYTES = 150 * 1024 * 1024;
export const CLIENT_POST_TRIM_MAX_UPLOAD_BYTES = MAX_UPLOAD_VIDEO_BYTES;
/** @deprecated Soft telemetry only — do not throw UploadTooLarge from client. */
export const ABSOLUTE_UPLOAD_VIDEO_BYTES = MAX_UPLOAD_VIDEO_BYTES;

export type AutoTrimVideoResult = {
    uri: string;
    durationSec: number;
    wasTrimmed: boolean;
    sizeBytes: number | null;
};

type CompressTrimOptions = {
    maxSeconds?: number;
    /** Seek before input (default 0). */
    startTimeSec?: number;
    maxWidth?: number;
    audioBitrate?: string;
    videoBitrate?: string;
    suffix?: string;
};

function autoTrimToastMessage(maxSeconds: number): void {
    const message = `Clips are limited to ${maxSeconds}s — we trimmed your video automatically`;
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

export type HardVideoWindowOptions = {
    /** Window start in seconds (default 0). */
    startTime?: number;
    /** Window end in seconds — clip length is `endTime - startTime`. */
    endTime?: number;
    maxSeconds?: number;
    notify?: boolean;
};

/**
 * Always hard-crop local video to [startTime, endTime] with scale + ultrafast H.264.
 * Stories: 0→15s. Feed: 0→90s. Never returns the original URI — throws if FFmpeg fails.
 */
export async function hardTrimVideoWindowForUpload(
    inputUri: string,
    destination: VideoUploadDestination,
    options: HardVideoWindowOptions = {},
): Promise<AutoTrimVideoResult> {
    const destCap = maxVideoDurationForDestination(destination);
    const startTime = Math.max(0, options.startTime ?? 0);
    const endTime = Math.max(
        startTime + 1,
        Math.floor(options.endTime ?? options.maxSeconds ?? destCap),
    );
    const clipSeconds = Math.max(1, endTime - startTime);
    const notify = options.notify !== false;

    const normalized = normalizeNativeUploadUri(inputUri);
    const trimmedUri = await compressTrimVideoToMaxSeconds(normalized, {
        startTimeSec: startTime,
        maxSeconds: clipSeconds,
        maxWidth: HARD_TRIM_MAX_EDGE_PX,
        audioBitrate: HARD_TRIM_AUDIO_BITRATE,
        videoBitrate: HARD_TRIM_VIDEO_BITRATE,
        suffix: `hardtrim${clipSeconds}`,
    });

    if (!trimmedUri || trimmedUri === normalized) {
        throw new Error('Video trim did not produce a new file.');
    }

    const sizeBytes = await statLocalFileBytes(trimmedUri);

    if (notify) {
        autoTrimToastMessage(clipSeconds);
    }

    return {
        uri: trimmedUri,
        durationSec: clipSeconds,
        wasTrimmed: true,
        sizeBytes,
    };
}

/**
 * Extract [start, start+N] while re-encoding (never `-c copy`).
 * Aggressive compress:
 * `-ss 0 -i <in> -t <15|90> -vf "scale='min(720\,iw)':-2" -c:v libx264 -b:v 1200k -maxrate 1500k -bufsize 2000k -preset ultrafast -c:a aac -b:a 96k -y <out>`
 * On FFmpeg failure throws — never returns the original URI.
 */
export async function compressTrimVideoToMaxSeconds(
    inputUri: string,
    options: CompressTrimOptions | number = {},
): Promise<string> {
    const opts: CompressTrimOptions =
        typeof options === 'number' ? { maxSeconds: options } : options;
    const maxSeconds = opts.maxSeconds ?? MAX_FEED_VIDEO_DURATION_SEC;
    const maxEdge = opts.maxWidth ?? HARD_TRIM_MAX_EDGE_PX;
    const audioBitrate = opts.audioBitrate ?? HARD_TRIM_AUDIO_BITRATE;
    const videoBitrate = opts.videoBitrate ?? HARD_TRIM_VIDEO_BITRATE;
    const suffix = opts.suffix ?? `trim${maxSeconds}b1200`;

    if (typeof executeFfmpeg !== 'function') {
        throw new Error('FFmpeg is not available. Rebuild the app with ffmpeg-kit linked.');
    }

    const resolved = await resolveLocalMediaUriForFfmpeg(inputUri);
    const inputPath = toFfmpegPath(resolved);
    const outputPath = makeSiblingOutputPath(resolved, suffix, 'mp4');
    const startSec = Math.max(0, Number(opts.startTimeSec) || 0);
    const t = Math.max(1, Math.floor(maxSeconds));

    // Cap long edge at 720 (4K → 720p); escaped comma form matches FFmpegKit arg parsing.
    const vf = `scale='min(${maxEdge}\\,iw)':-2`;

    const command = [
        `-ss ${startSec}`,
        `-i "${inputPath}"`,
        `-t ${t}`,
        `-vf "${vf}"`,
        '-c:v libx264',
        `-b:v ${videoBitrate}`,
        `-maxrate ${HARD_TRIM_VIDEO_MAXRATE}`,
        `-bufsize ${HARD_TRIM_VIDEO_BUFSIZE}`,
        '-preset ultrafast',
        '-c:a aac',
        `-b:a ${audioBitrate}`,
        '-y',
        `"${outputPath}"`,
    ].join(' ');

    try {
        await executeFfmpeg(command);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        if (/^FFmpeg failed to trim video:/i.test(detail)) {
            throw err instanceof Error ? err : new Error(detail);
        }
        throw new Error(`FFmpeg failed to trim video: ${detail}`);
    }

    const outUri = toFileUri(outputPath);
    if (!outUri || outUri === normalizeNativeUploadUri(inputUri)) {
        throw new Error('FFmpeg failed to trim video: output URI missing or identical to input');
    }
    return outUri;
}

/** @deprecated Use compressTrimVideoToMaxSeconds */
export const streamCopyTrimVideoToMaxSeconds = compressTrimVideoToMaxSeconds;

/**
 * Always hard-trim to destination / maxSeconds window (no skip for “short” or “small” files).
 */
export async function ensureFeedVideoUnderLimits(
    inputUri: string,
    _hints: { durationSec?: number | null; fileSize?: number | null } = {},
    options: { notify?: boolean; maxSeconds?: number } = {},
): Promise<AutoTrimVideoResult> {
    const maxSeconds = Math.max(
        1,
        Math.floor(options.maxSeconds ?? MAX_FEED_VIDEO_DURATION_SEC),
    );
    const destination: VideoUploadDestination =
        maxSeconds <= MAX_STORIES_VIDEO_DURATION_SEC ? 'stories' : 'feed';
    return hardTrimVideoWindowForUpload(inputUri, destination, {
        startTime: 0,
        endTime: maxSeconds,
        notify: options.notify !== false,
    });
}

/**
 * @deprecated Client size gates are removed. Hard-trim always runs first; server 413 is the only size gate.
 * Kept as a no-op telemetry helper so legacy imports do not throw.
 */
export async function assertLocalVideoUnderUploadLimit(
    uri: string,
    _meta: { durationSec?: number | null; stage?: string } = {},
): Promise<number | null> {
    // Never throw UploadTooLarge — byte checks before/after trim are intentionally disabled.
    return statLocalFileBytes(uri);
}

export async function processSelectedVideoForFeed(
    inputUri: string,
    _durationInSeconds: number,
    options: { notify?: boolean; maxSeconds?: number } = {},
): Promise<AutoTrimVideoResult> {
    return ensureFeedVideoUnderLimits(inputUri, {}, options);
}
