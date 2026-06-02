import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchFollowedUsersStoryGroups } from '../api/stories';
import { getFollowedUsers } from '../api/posts';
import { formatTextOnlyFeedByline } from './feedTextBubble';
import { resolveStoryMediaUrl } from './storyMediaNative';

export type Stories24RailItem = {
    handle: string;
    title: string;
    subtitle?: string;
    thumb?: string;
    previewVideoUrl?: string;
};

/** RN AsyncStorage key — keep in sync with web `clips:stories24OpenedFromRailHandle` semantics. */
export const STORIES24_FROM_RAIL_HANDLE_KEY = 'clips:rn:stories24OpenedFromRailHandle';
export const STORIES24_LOADING_HOLD_MS = 2600;
/** Card → fullscreen expand before navigating to Stories (match web App.tsx). */
export const STORIES24_EXPAND_MS = 560;
/** Fullscreen → card shrink when returning to feed (match web App.tsx). */
export const STORIES24_COLLAPSE_MS = 720;
export const STORIES24_ADD_YOURS_HANDLE = '__add_yours__';

/** RN AsyncStorage — keep in sync with web `clips:stories24RailReturn`. */
export const STORIES24_RAIL_RETURN_KEY = 'clips:rn:stories24RailReturn';

/** RN AsyncStorage — keep in sync with web feed scroll restore keys. */
export const STORIES24_FEED_SCROLL_Y_KEY = 'clips:rn:stories24FeedScrollY';
export const STORIES24_RESTORE_FEED_SCROLL_FLAG = 'clips:rn:stories24RestoreFeedScroll';

export type Stories24RailReturnPayload = {
    handle: string;
    previewThumb?: string;
    previewVideoUrl?: string;
};

export function normalizeStories24Handle(handle: string): string {
    return (handle || '').trim().toLowerCase().replace(/^@/, '');
}

/** Web sessionStorage key — must match App.tsx / StoriesPage. */
export const STORIES24_WEB_FROM_RAIL_HANDLE_KEY = 'clips:stories24OpenedFromRailHandle';

export function getStories24RailHandles(items: Stories24RailItem[]): string[] {
    return items
        .map((item) => item.handle)
        .filter((handle) => handle && handle !== STORIES24_ADD_YOURS_HANDLE);
}

export function isStories24AddYoursHandle(handle: string | undefined | null): boolean {
    if (!handle) return false;
    return normalizeStories24Handle(handle) === normalizeStories24Handle(STORIES24_ADD_YOURS_HANDLE);
}

/** First real story card in the rail (same order as feed strip; skips Add yours). */
export function getFirstStories24StoryItem(items: Stories24RailItem[]): Stories24RailItem | null {
    return pickFirstStories24RailStory(items);
}

/** First story card in rail scroll order (never the Add yours placeholder). */
export function pickFirstStories24RailStory(items: Stories24RailItem[]): Stories24RailItem | null {
    return (
        items.find((item) => item.handle && !isStories24AddYoursHandle(item.handle)) ?? null
    );
}

export type Stories24OpenTarget = {
    item: Stories24RailItem;
    railHandles: string[];
};

/** Resolve header / play-button open target from current rail items. */
export function resolveStories24OpenTarget(items: Stories24RailItem[]): Stories24OpenTarget | null {
    const item = pickFirstStories24RailStory(items);
    if (!item) return null;
    return { item, railHandles: getStories24RailHandles(items) };
}

/** Navigation params shared by feed rail cards and header play (RN Stories screen). */
export function buildStories24StoryNavParams(
    item: Stories24RailItem,
    railHandles: string[],
): {
    openUserHandle: string;
    fromStories24Rail: boolean;
    railHandles: string[];
    previewThumb?: string;
    previewVideoUrl?: string;
} {
    return {
        openUserHandle: item.handle,
        fromStories24Rail: true,
        railHandles,
        previewThumb: item.thumb,
        previewVideoUrl: item.previewVideoUrl,
    };
}

export async function buildStories24RailItems(
    userId: string,
    userHandle?: string | null,
): Promise<Stories24RailItem[]> {
    const followedUserHandles = await getFollowedUsers(userId);
    const groups = await fetchFollowedUsersStoryGroups(userId, followedUserHandles || []);

    const nextItems: Stories24RailItem[] = [];
    for (const group of groups) {
        const sortedStories = [...(group.stories || [])].sort(
            (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
        );
        const latest = sortedStories[0];
        if (!latest) continue;

        const latestMediaUrl = resolveStoryMediaUrl(latest.mediaUrl);
        const latestMediaType = latest.mediaType;
        const firstImage = resolveStoryMediaUrl(
            sortedStories.find((s) => s.mediaType === 'image' && !!s.mediaUrl)?.mediaUrl,
        );
        let thumb = firstImage || (latestMediaType !== 'video' ? latestMediaUrl : undefined);
        const text =
            (latest.text || (latest as { text_content?: string }).text_content || '').trim() ||
            (latest.poll?.question || '').trim() ||
            (latest.sharedFromPost ? 'Shared a post' : 'New story');
        const title = text.length > 34 ? `${text.slice(0, 34)}...` : text;
        const subtitle = formatTextOnlyFeedByline(group.userHandle, latest.location);

        nextItems.push({
            handle: group.userHandle,
            title,
            subtitle,
            thumb,
            previewVideoUrl: latestMediaType === 'video' ? latestMediaUrl : undefined,
        });
        if (nextItems.length >= 12) break;
    }

    const mergedByHandle = new Map<string, Stories24RailItem>();
    for (const item of nextItems) mergedByHandle.set(item.handle.trim().toLowerCase(), item);
    const baseItems = Array.from(mergedByHandle.values());
    const normalizedUserHandle = (userHandle || '').trim().toLowerCase();
    const userItemIndex = baseItems.findIndex(
        (item) => item.handle.trim().toLowerCase() === normalizedUserHandle,
    );

    const ordered =
        userItemIndex > 0
            ? [baseItems[userItemIndex], ...baseItems.filter((_, idx) => idx !== userItemIndex)]
            : [...baseItems];

    if (normalizedUserHandle && userItemIndex === -1) {
        ordered.unshift({ handle: STORIES24_ADD_YOURS_HANDLE, title: 'Add yours' });
    }

    return ordered.slice(0, 12);
}

export async function persistStories24RailOpenHandle(handle: string): Promise<void> {
    const trimmed = (handle || '').trim();
    if (!trimmed || trimmed === STORIES24_ADD_YOURS_HANDLE) return;
    try {
        await AsyncStorage.setItem(STORIES24_FROM_RAIL_HANDLE_KEY, trimmed);
    } catch {
        /* ignore */
    }
}

export async function readStories24RailOpenHandle(): Promise<string | null> {
    try {
        const stored = await AsyncStorage.getItem(STORIES24_FROM_RAIL_HANDLE_KEY);
        return stored?.trim() || null;
    } catch {
        return null;
    }
}

export async function clearStories24RailOpenHandle(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORIES24_FROM_RAIL_HANDLE_KEY);
    } catch {
        /* ignore */
    }
}

export async function persistStories24RailReturn(payload: Stories24RailReturnPayload): Promise<void> {
    const handle = (payload.handle || '').trim();
    if (!handle) return;
    try {
        await AsyncStorage.setItem(
            STORIES24_RAIL_RETURN_KEY,
            JSON.stringify({
                handle,
                previewThumb: payload.previewThumb,
                previewVideoUrl: payload.previewVideoUrl,
            }),
        );
    } catch {
        /* ignore */
    }
}

/** Read and clear collapse payload (feed runs shrink animation once). */
export async function snapshotStories24FeedScroll(scrollY: number): Promise<void> {
    const y = Number.isFinite(scrollY) && scrollY >= 0 ? Math.round(scrollY) : 0;
    try {
        await AsyncStorage.multiSet([
            [STORIES24_FEED_SCROLL_Y_KEY, String(y)],
            [STORIES24_RESTORE_FEED_SCROLL_FLAG, '1'],
        ]);
    } catch {
        /* ignore */
    }
}

/** Read and clear pending feed scroll restore (after returning from Stories 24). */
export async function consumeStories24FeedScrollRestore(): Promise<number | null> {
    try {
        const pending = await AsyncStorage.getItem(STORIES24_RESTORE_FEED_SCROLL_FLAG);
        if (pending !== '1') return null;
        const raw = await AsyncStorage.getItem(STORIES24_FEED_SCROLL_Y_KEY);
        await AsyncStorage.multiRemove([STORIES24_FEED_SCROLL_Y_KEY, STORIES24_RESTORE_FEED_SCROLL_FLAG]);
        const top = raw != null ? parseInt(raw, 10) : 0;
        if (!Number.isFinite(top) || top < 0) return null;
        return top;
    } catch {
        try {
            await AsyncStorage.multiRemove([STORIES24_FEED_SCROLL_Y_KEY, STORIES24_RESTORE_FEED_SCROLL_FLAG]);
        } catch {
            /* ignore */
        }
        return null;
    }
}

export async function consumeStories24RailReturn(): Promise<Stories24RailReturnPayload | null> {
    try {
        const raw = await AsyncStorage.getItem(STORIES24_RAIL_RETURN_KEY);
        if (!raw) return null;
        await AsyncStorage.removeItem(STORIES24_RAIL_RETURN_KEY);
        const parsed = JSON.parse(raw) as Stories24RailReturnPayload;
        const handle = (parsed?.handle || '').trim();
        if (!handle) return null;
        return {
            handle,
            previewThumb: parsed.previewThumb,
            previewVideoUrl: parsed.previewVideoUrl,
        };
    } catch {
        try {
            await AsyncStorage.removeItem(STORIES24_RAIL_RETURN_KEY);
        } catch {
            /* ignore */
        }
        return null;
    }
}
