import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { Post } from '../types';
import {
    isVideoMediaUri,
    postHasVideoMedia,
    resolvePostPlaybackUri,
} from './postMedia';

/** First ~1.5–2MB of each upcoming MP4 — enough for Instant Start without hogging bandwidth. */
export const FEED_VIDEO_PREBUFFER_BYTES = 1.75 * 1024 * 1024;

/** Persisted with Video playback settings — Wi‑Fi-only prebuffer by default. */
export const FEED_VIDEO_PREBUFFER_PREF_KEY = 'clips:feedVideoPrebufferPref';

const MAX_VIDEOS_PER_BATCH = 4;
const MAX_CONCURRENT = 2;
const PREBUFFER_TIMEOUT_MS = 12_000;

const prebufferedUris = new Set<string>();
const inFlightUris = new Set<string>();

export type FeedVideoPrebufferConfig = {
    /**
     * When true, skip heavy Range prebuffer on cellular / metered links.
     * Playback still works; only background warming is halted. Default: true.
     */
    skipOnCellular: boolean;
};

let prebufferConfig: FeedVideoPrebufferConfig = {
    skipOnCellular: true,
};
let prefHydrated = false;
let prefHydratePromise: Promise<void> | null = null;

async function hydratePrebufferPref(): Promise<void> {
    if (prefHydrated) return;
    if (prefHydratePromise) return prefHydratePromise;
    prefHydratePromise = (async () => {
        try {
            const raw = await AsyncStorage.getItem(FEED_VIDEO_PREBUFFER_PREF_KEY);
            if (raw === 'cellular' || raw === 'wifi') {
                prebufferConfig = {
                    ...prebufferConfig,
                    skipOnCellular: raw === 'wifi',
                };
            }
        } catch {
            /* keep defaults */
        } finally {
            prefHydrated = true;
            prefHydratePromise = null;
        }
    })();
    return prefHydratePromise;
}

export function getFeedVideoPrebufferConfig(): FeedVideoPrebufferConfig {
    return { ...prebufferConfig };
}

/** Load persisted preference (safe to call on feed mount / settings open). */
export async function loadFeedVideoPrebufferConfig(): Promise<FeedVideoPrebufferConfig> {
    await hydratePrebufferPref();
    return getFeedVideoPrebufferConfig();
}

export function setFeedVideoPrebufferConfig(
    partial: Partial<FeedVideoPrebufferConfig>,
): FeedVideoPrebufferConfig {
    prebufferConfig = { ...prebufferConfig, ...partial };
    prefHydrated = true;
    const next = getFeedVideoPrebufferConfig();
    void AsyncStorage.setItem(
        FEED_VIDEO_PREBUFFER_PREF_KEY,
        next.skipOnCellular ? 'wifi' : 'cellular',
    ).catch(() => {});
    return next;
}

function isRemoteHttpUri(uri: string): boolean {
    return /^https?:\/\//i.test(uri);
}

function isHlsUri(uri: string): boolean {
    return /\.m3u8(\?|#|$)/i.test(uri);
}

/**
 * True when the device can safely start a video Range prebuffer.
 * Requires connectivity + reachable internet; optionally skips cellular.
 */
export async function canPrebufferFeedVideo(): Promise<boolean> {
    try {
        await hydratePrebufferPref();
        const state = await NetInfo.fetch();
        if (state.isConnected !== true) return false;
        // null = reachability still unknown — allow if connected.
        if (state.isInternetReachable === false) return false;
        if (prebufferConfig.skipOnCellular && state.type === 'cellular') {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

/** Collect playable remote video URLs from an incoming feed page (origin URLs). */
export function collectFeedVideoPrefetchUris(posts: Post[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (raw?: string | null) => {
        const u = String(raw || '').trim();
        if (!u || !isRemoteHttpUri(u) || seen.has(u)) return;
        if (isHlsUri(u)) return;
        seen.add(u);
        out.push(u);
    };

    for (const post of posts) {
        if (!postHasVideoMedia(post)) continue;
        const items = (post.mediaItems || []).filter(
            (item) => item?.type === 'image' || item?.type === 'video',
        );
        if (items.length > 0) {
            for (const item of items) {
                if (item.type === 'video' || isVideoMediaUri(item.url)) {
                    push(resolvePostPlaybackUri(post, item));
                }
            }
        } else {
            push(resolvePostPlaybackUri(post));
        }
    }
    return out;
}

/**
 * Download the first FEED_VIDEO_PREBUFFER_BYTES from the same origin URL
 * ExoPlayer plays. Do not route through AndroidVideoCache — that URI is not
 * what the player uses, so warming it cannot help first-play.
 * All network failures are swallowed — never reject into the JS host.
 */
async function prebufferVideoUri(uri: string, maxBytes: number): Promise<void> {
    const originUri = String(uri || '').trim();
    let claimed = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
        if (!originUri || prebufferedUris.has(originUri) || inFlightUris.has(originUri)) return;
        inFlightUris.add(originUri);
        claimed = true;

        if (!(await canPrebufferFeedVideo())) return;

        timer = setTimeout(() => {
            try {
                controller.abort();
            } catch {
                /* ignore */
            }
        }, PREBUFFER_TIMEOUT_MS);

        let res: Response;
        try {
            res = await fetch(originUri, {
                method: 'GET',
                headers: {
                    Range: `bytes=0-${Math.max(0, Math.floor(maxBytes) - 1)}`,
                    Accept: 'video/*,*/*',
                },
                signal: controller.signal,
            });
        } catch {
            return;
        }

        if (!res.ok && res.status !== 206) return;

        try {
            const body = res.body as {
                getReader?: () => {
                    read: () => Promise<{ done: boolean; value?: Uint8Array }>;
                    cancel: () => Promise<void>;
                };
            } | null;
            const reader = typeof body?.getReader === 'function' ? body.getReader() : null;
            if (reader) {
                let received = 0;
                while (received < maxBytes) {
                    let chunk: { done: boolean; value?: Uint8Array };
                    try {
                        chunk = await reader.read();
                    } catch {
                        break;
                    }
                    if (chunk.done) break;
                    received += chunk.value?.byteLength ?? 0;
                }
            } else {
                try {
                    await res.arrayBuffer();
                } catch {
                    return;
                }
            }
        } catch {
            return;
        }

        prebufferedUris.add(originUri);
        if (prebufferedUris.size > 80) {
            const first = prebufferedUris.values().next().value;
            if (first) prebufferedUris.delete(first);
        }
    } catch {
        // Best-effort only — never surface to the UI thread.
    } finally {
        if (timer) clearTimeout(timer);
        if (claimed) inFlightUris.delete(originUri);
    }
}

async function runLimited(
    uris: string[],
    concurrency: number,
    worker: (uri: string) => Promise<void>,
): Promise<void> {
    let index = 0;
    const runWorker = async () => {
        while (index < uris.length) {
            try {
                const next = uris[index];
                index += 1;
                if (!next) break;
                try {
                    await worker(next);
                } catch {
                    // Isolate per-URI failures so the pool keeps draining.
                }
            } catch {
                index += 1;
            }
        }
    };
    const n = Math.max(1, Math.min(concurrency, uris.length));
    try {
        await Promise.all(Array.from({ length: n }, () => runWorker()));
    } catch {
        /* ignore */
    }
}

/**
 * Pre-buffer the first 1–2MB of upcoming feed videos from the origin URL.
 * Safe to call while scrolling so the next cell is warm before it is active.
 * No-ops when offline or (by default) on cellular.
 */
export async function prebufferFeedVideos(uris: string[]): Promise<void> {
    try {
        if (!(await canPrebufferFeedVideo())) return;

        const queue = uris
            .map((u) => String(u || '').trim())
            .filter((u) => u && isRemoteHttpUri(u))
            .slice(0, MAX_VIDEOS_PER_BATCH);

        if (!queue.length) return;

        await runLimited(queue, MAX_CONCURRENT, (uri) =>
            prebufferVideoUri(uri, FEED_VIDEO_PREBUFFER_BYTES),
        );
    } catch {
        // Silent — background prefetch must never reject into React Query / UI.
    }
}
