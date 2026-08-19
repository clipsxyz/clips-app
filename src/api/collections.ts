import { Collection, Post } from '../types';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import * as apiClient from './client';
import { posts, getPostById, decorateForUser } from './posts';

// Storage key for collections
const COLLECTIONS_STORAGE_KEY = 'clips_app_collections';
const DEFAULT_COLLECTION_NAME = 'All Posts';
const normalizeUserId = (value: string | number | undefined | null): string => String(value ?? '').trim();
const MAX_INLINE_PREVIEW_URL_LENGTH = 4000;
type CollectionWithPreviewMap = Collection & {
    postPreviewMap?: Record<string, Partial<Post>>;
};

function mapApiCollection(raw: any, fallbackUserId?: string): Collection {
    const createdAtRaw = raw?.created_at ?? raw?.createdAt;
    const updatedAtRaw = raw?.updated_at ?? raw?.updatedAt;
    const postIdsRaw = raw?.post_ids ?? raw?.postIds;
    const userIdRaw = raw?.user_id ?? raw?.userId ?? fallbackUserId ?? 'me';
    return {
        id: String(raw?.id ?? `collection-${Date.now()}`),
        userId: normalizeUserId(userIdRaw),
        name: String(raw?.name ?? 'Untitled Collection'),
        isPrivate: Boolean(raw?.is_private ?? raw?.isPrivate ?? true),
        thumbnailUrl: typeof (raw?.thumbnail_url ?? raw?.thumbnailUrl) === 'string'
            ? (raw?.thumbnail_url ?? raw?.thumbnailUrl)
            : undefined,
        postIds: Array.isArray(postIdsRaw) ? postIdsRaw.map((id: any) => String(id)) : [],
        createdAt: typeof createdAtRaw === 'number' ? createdAtRaw : Date.parse(createdAtRaw || '') || Date.now(),
        updatedAt: typeof updatedAtRaw === 'number' ? updatedAtRaw : Date.parse(updatedAtRaw || '') || Date.now(),
    };
}

function mapApiCollections(payload: any, fallbackUserId?: string): Collection[] {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.collections)
                ? payload.collections
                : [];
    return list.map((item: any) => mapApiCollection(item, fallbackUserId));
}

/** React Native persistence (Metro); absent on web/Vite. */
function tryAsyncStorage(): { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> } | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('@react-native-async-storage/async-storage');
        return mod.default ?? mod;
    } catch {
        return null;
    }
}

function sanitizeCollectionsForStorage(input: CollectionWithPreviewMap[]): CollectionWithPreviewMap[] {
    return input.map((collection) => {
        const next: CollectionWithPreviewMap = { ...collection };
        if (typeof next.thumbnailUrl === 'string' && next.thumbnailUrl.startsWith('data:') && next.thumbnailUrl.length > MAX_INLINE_PREVIEW_URL_LENGTH) {
            next.thumbnailUrl = undefined;
        }
        if (!next.postPreviewMap) return next;
        const compactMap: Record<string, Partial<Post>> = {};
        for (const [postId, preview] of Object.entries(next.postPreviewMap)) {
            const safePreview: Partial<Post> = { ...preview };
            if (typeof safePreview.mediaUrl === 'string' && safePreview.mediaUrl.startsWith('data:') && safePreview.mediaUrl.length > MAX_INLINE_PREVIEW_URL_LENGTH) {
                safePreview.mediaUrl = undefined;
            }
            if (typeof safePreview.videoPosterUrl === 'string' && safePreview.videoPosterUrl.startsWith('data:') && safePreview.videoPosterUrl.length > MAX_INLINE_PREVIEW_URL_LENGTH) {
                safePreview.videoPosterUrl = undefined;
            }
            const candidate = Array.isArray(safePreview.mediaItems) && safePreview.mediaItems.length > 0
                ? safePreview.mediaItems.find((item) => !!item?.url) || safePreview.mediaItems[0]
                : undefined;
            const candidateUrl = compactPersistedMediaUrl(candidate?.url);
            if (candidate && candidateUrl && candidate.type && (candidate.type === 'image' || candidate.type === 'video')) {
                safePreview.mediaItems = [{ url: candidateUrl, type: candidate.type, duration: candidate.duration }];
                if (!safePreview.mediaUrl) safePreview.mediaUrl = candidateUrl;
            } else {
                safePreview.mediaItems = undefined;
            }
            compactMap[postId] = safePreview;
        }
        next.postPreviewMap = compactMap;
        return next;
    });
}

function ultraCompactCollectionsForStorage(input: CollectionWithPreviewMap[]): CollectionWithPreviewMap[] {
    return input.map((collection) => {
        let thumb: string | undefined;
        const u = typeof collection.thumbnailUrl === 'string' ? collection.thumbnailUrl.trim() : '';
        if (
            u &&
            (u.startsWith('http://') ||
                u.startsWith('https://') ||
                u.startsWith('blob:') ||
                (u.startsWith('data:') && u.length <= MAX_INLINE_PREVIEW_URL_LENGTH))
        ) {
            thumb = u;
        }
        const next: CollectionWithPreviewMap = {
            ...collection,
            thumbnailUrl: thumb,
            postPreviewMap: undefined,
        };
        return next;
    });
}

async function loadCollectionsFromPersistence(): Promise<CollectionWithPreviewMap[]> {
    const asyncSt = tryAsyncStorage();
    if (asyncSt) {
        try {
            // Do not race AsyncStorage with a timeout: a slow read returning [] then
            // persistCollectionsToDisk would wipe the user's real collections.
            const stored = await asyncSt.getItem(COLLECTIONS_STORAGE_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? (parsed as CollectionWithPreviewMap[]) : [];
        } catch (error) {
            console.error('Error reading collections from AsyncStorage — clearing corrupt data:', error);
            try {
                await asyncSt.removeItem(COLLECTIONS_STORAGE_KEY);
            } catch {
                /* ignore */
            }
            return [];
        }
    }
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? (parsed as CollectionWithPreviewMap[]) : [];
        }
    } catch (error) {
        console.error('Error reading collections from localStorage:', error);
        try {
            localStorage.removeItem(COLLECTIONS_STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }
    return [];
}

async function persistCollectionsToDisk(collections: CollectionWithPreviewMap[]): Promise<void> {
    const asyncSt = tryAsyncStorage();
    const writeJson = async (json: string) => {
        if (asyncSt) {
            await asyncSt.setItem(COLLECTIONS_STORAGE_KEY, json);
            return;
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(COLLECTIONS_STORAGE_KEY, json);
            return;
        }
    };

    const attemptWrite = async (payload: CollectionWithPreviewMap[]) => {
        await writeJson(JSON.stringify(payload));
    };

    try {
        await attemptWrite(collections);
    } catch {
        try {
            await attemptWrite(sanitizeCollectionsForStorage(collections));
        } catch {
            try {
                await attemptWrite(ultraCompactCollectionsForStorage(collections));
            } catch (finalError) {
                console.error('Error saving collections:', finalError);
                throw new Error('Failed to save collection data.');
            }
        }
    }
}

// Mock delay function
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isFakeVideoPosterUrl(url: string | undefined): boolean {
    if (!url) return false;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { isFakeMockVideoPosterUrl } = require('../constants/mockFeedVideos') as {
            isFakeMockVideoPosterUrl: (u: string | undefined | null) => boolean;
        };
        return isFakeMockVideoPosterUrl(url);
    } catch {
        return false;
    }
}

/**
 * Image URL suitable for `<Image>` thumbs only.
 * Never returns MP4s or the old Unsplash “demo posters” — for videos without a real poster,
 * callers should render a paused Video frame (see ProfileGridThumb).
 */
export function resolvePostThumbnail(post?: Partial<Post>): string | undefined {
    if (!post) return undefined;
    const looksLikeVideo = (url?: string) =>
        !!url && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
    const usableImage = (url?: string) => {
        const compact = compactPersistedMediaUrl(url);
        if (!compact || looksLikeVideo(compact) || isFakeVideoPosterUrl(compact)) return undefined;
        return compact;
    };

    const extra = post as Partial<Post> & {
        thumbnail_url?: string;
        poster_url?: string;
        posterUrl?: string;
        media_url?: string;
    };
    const firstMediaItem =
        Array.isArray(post.mediaItems) && post.mediaItems.length > 0
            ? post.mediaItems.find((item) => (item?.type === 'image' || item?.type === 'video') && !!item.url) ||
              post.mediaItems[0]
            : undefined;
    const slide = firstMediaItem as
        | { posterUrl?: string; poster_url?: string; thumbnailUrl?: string; thumbnail_url?: string; url?: string; type?: string }
        | undefined;

    const candidates = [
        extra.thumbnail_url,
        extra.thumbnailUrl,
        extra.poster_url,
        extra.posterUrl,
        post.videoPosterUrl,
        slide?.thumbnail_url,
        slide?.thumbnailUrl,
        slide?.poster_url,
        slide?.posterUrl,
        slide?.type === 'image' ? slide.url : undefined,
        extra.media_url,
        post.mediaUrl,
        slide?.url,
    ];
    for (const candidate of candidates) {
        const img = usableImage(typeof candidate === 'string' ? candidate : undefined);
        if (img) return img;
    }

    const media = compactPersistedMediaUrl(post.mediaUrl || firstMediaItem?.url);
    if (media && looksLikeVideo(media)) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { resolveDemoVideoPosterUri } = require('../constants/mockFeedVideos') as {
                resolveDemoVideoPosterUri: (url: string | undefined) => string | undefined;
            };
            const demoPoster = resolveDemoVideoPosterUri(media);
            if (demoPoster) return demoPoster;
        } catch {
            /* ignore */
        }
    }
    return undefined;
}

/** List-row thumbnail: prefer live post URL so blobs/API paths stay valid after creating a collection. */
export function getCollectionThumbnailUrl(collection: Collection, postPool?: Post[]): string | undefined {
    const looksLikeVideo = (url?: string) =>
        !!url && /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
    const firstId = collection.postIds[0];
    if (firstId) {
        const fp = postPool?.find((p) => p.id === firstId) ?? posts.find((p) => p.id === firstId);
        const live = resolvePostThumbnail(fp);
        if (live) return live;
    }
    const t = typeof collection.thumbnailUrl === 'string' ? collection.thumbnailUrl.trim() : '';
    if (!t || looksLikeVideo(t) || isFakeVideoPosterUrl(t)) {
        return undefined;
    }
    return t;
}

function compactPersistedMediaUrl(url?: string): string | undefined {
    if (!url || typeof url !== 'string') return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    // Keep blob/data/http URLs so collection cards can always render media.
    // Blob URLs are ephemeral across browser restarts but valid in-session.
    return trimmed;
}

function emitCollectionsUpdated(userId: string): void {
    const normalizedUserId = normalizeUserId(userId);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('collectionsUpdated', { detail: { userId: normalizedUserId } }));
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { DeviceEventEmitter } = require('react-native');
        DeviceEventEmitter.emit('collectionsUpdated', { userId: normalizedUserId });
    } catch {
        /* not React Native */
    }
}

function findDefaultCollection(collections: Collection[], userId: string): Collection | undefined {
    const normalizedUserId = normalizeUserId(userId);
    return collections.find((c) => normalizeUserId(c.userId) === normalizedUserId && c.name === DEFAULT_COLLECTION_NAME);
}

function buildPostPreview(post: Partial<Post> | undefined, postId: string): Partial<Post> {
    const compactMediaItems: Array<{ url: string; type: 'image' | 'video'; duration?: number }> = [];
    if (Array.isArray(post?.mediaItems) && post.mediaItems.length > 0) {
        for (const item of post.mediaItems) {
            if (!item || (item.type !== 'image' && item.type !== 'video')) continue;
            const compactUrl = compactPersistedMediaUrl(item.url);
            if (!compactUrl) continue;
            compactMediaItems.push({
                url: compactUrl,
                type: item.type,
                duration: item.duration,
            });
        }
    }
    const firstMediaItem = compactMediaItems[0];
    const bodyText = (
        post?.text ||
        (post as { text_content?: string } | undefined)?.text_content ||
        post?.caption ||
        post?.imageText ||
        ''
    )
        .toString()
        .trim();
    const rawMediaUrl = compactPersistedMediaUrl(post?.mediaUrl) || firstMediaItem?.url;
    // Never promote a still poster into mediaUrl — that turns text/video posts into fake images.
    const resolvedMediaUrl = rawMediaUrl;
    const hasTextOnly = Boolean(bodyText) && !resolvedMediaUrl && compactMediaItems.length === 0;
    const resolvedMediaType = hasTextOnly
        ? undefined
        : post?.mediaType ||
          (firstMediaItem?.type === 'video' || firstMediaItem?.type === 'image'
              ? firstMediaItem.type
              : (resolvedMediaUrl || '').match(/\.(mp4|mov|m4v|webm)(\?|$)/i)
                ? 'video'
                : resolvedMediaUrl
                  ? 'image'
                  : undefined);
    const posterUrl = compactPersistedMediaUrl(post?.videoPosterUrl);
    return {
        id: post?.id || postId,
        userHandle: post?.userHandle || 'unknown@clips',
        locationLabel: post?.locationLabel || 'Unknown Location',
        tags: Array.isArray(post?.tags) ? post!.tags : [],
        mediaUrl: resolvedMediaUrl,
        mediaType: resolvedMediaType as Post['mediaType'],
        videoPosterUrl: posterUrl && !isFakeVideoPosterUrl(posterUrl) ? posterUrl : undefined,
        mediaItems: compactMediaItems.length > 0 ? compactMediaItems : undefined,
        text: bodyText || undefined,
        caption: post?.caption,
        text_content: bodyText || (post as { text_content?: string } | undefined)?.text_content,
        textStyle: post?.textStyle,
        templateId: (post as { templateId?: string } | undefined)?.templateId,
        createdAt: post?.createdAt || Date.now(),
        stats: post?.stats || { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
        isBookmarked: !!post?.isBookmarked,
        isFollowing: !!post?.isFollowing,
        userLiked: !!post?.userLiked,
        userReclipped: !!post?.userReclipped,
    };
}

function cachePostSnapshot(postId: string, post?: Partial<Post>): void {
    if (!post) return;
    const existingIndex = posts.findIndex((p) => p.id === postId);
    const cached = buildPostPreview(post, postId) as Post;
    if (existingIndex >= 0) {
        const existing = posts[existingIndex];
        posts[existingIndex] = {
            ...existing,
            ...cached,
            id: postId,
            // Never wipe body copy / style / media when a thin snapshot is cached.
            text: cached.text || existing.text,
            caption: cached.caption || existing.caption,
            text_content: cached.text_content || existing.text_content,
            textStyle: cached.textStyle || existing.textStyle,
            templateId: cached.templateId || existing.templateId,
            mediaUrl: cached.mediaUrl || existing.mediaUrl,
            mediaType: cached.mediaType || existing.mediaType,
            videoPosterUrl: cached.videoPosterUrl || existing.videoPosterUrl,
            mediaItems:
                cached.mediaItems && cached.mediaItems.length > 0
                    ? cached.mediaItems
                    : existing.mediaItems,
        };
        return;
    }
    posts.unshift(cached);
}

function savePreviewForPost(collection: CollectionWithPreviewMap, postId: string, post?: Partial<Post>): void {
    if (!post && !collection.postPreviewMap?.[postId]) return;
    const nextMap = { ...(collection.postPreviewMap || {}) };
    nextMap[postId] = buildPostPreview(post, postId);
    collection.postPreviewMap = nextMap;
}

function ensureDefaultCollection(collections: Collection[], userId: string): Collection {
    const normalizedUserId = normalizeUserId(userId);
    const existing = findDefaultCollection(collections, normalizedUserId);
    if (existing) return existing;
    const created: Collection = {
        id: `collection-default-${normalizedUserId}`,
        userId: normalizedUserId,
        name: DEFAULT_COLLECTION_NAME,
        isPrivate: true,
        postIds: [],
        thumbnailUrl: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    collections.push(created);
    return created;
}

/**
 * Create a new collection
 */
export async function createCollection(userId: string, name: string, isPrivate: boolean = true, initialPostId?: string, initialPost?: Partial<Post>): Promise<Collection> {
    if (isLaravelApiEnabled()) {
        try {
            const payload = await apiClient.createCollectionApi({
                name: name.trim(),
                isPrivate,
                is_private: isPrivate,
                ...(initialPostId ? { postId: initialPostId, post_id: initialPostId } : {}),
            });
            const mapped = mapApiCollection(payload?.data ?? payload?.collection ?? payload, userId);
            emitCollectionsUpdated(userId);
            return mapped;
        } catch (error) {
            console.warn('Laravel createCollection failed, falling back to local collections:', error);
        }
    }

    await delay(200);
    const normalizedUserId = normalizeUserId(userId);

    let thumbnailUrl: string | undefined;

    // If an initial post is provided, set it as the thumbnail
    if (initialPostId) {
        const post = initialPost || posts.find(p => p.id === initialPostId);
        cachePostSnapshot(initialPostId, post);
        thumbnailUrl = resolvePostThumbnail(post);
    }

    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error('Collection name required');
    }
    if (trimmed.toLowerCase() === DEFAULT_COLLECTION_NAME.toLowerCase()) {
        throw new Error('Collection name reserved');
    }

    const collection: Collection = {
        id: `collection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: normalizedUserId,
        name: trimmed,
        isPrivate,
        postIds: initialPostId ? [initialPostId] : [],
        thumbnailUrl,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    const collections = await loadCollectionsFromPersistence();
    ensureDefaultCollection(collections, normalizedUserId);
    collections.push(collection);
    if (initialPostId) {
        const defaults = ensureDefaultCollection(collections, normalizedUserId);
        savePreviewForPost(collection as CollectionWithPreviewMap, initialPostId, initialPost || posts.find((p) => p.id === initialPostId));
        savePreviewForPost(defaults as CollectionWithPreviewMap, initialPostId, initialPost || posts.find((p) => p.id === initialPostId));
        if (!defaults.postIds.includes(initialPostId)) {
            defaults.postIds.unshift(initialPostId);
            defaults.updatedAt = Date.now();
            if (!defaults.thumbnailUrl) defaults.thumbnailUrl = thumbnailUrl;
        }
    }
    await persistCollectionsToDisk(collections);
    emitCollectionsUpdated(normalizedUserId);
    return collection;
}

/**
 * Get all collections for a user
 */
export async function getUserCollections(userId: string): Promise<Collection[]> {
    if (isLaravelApiEnabled()) {
        try {
            const payload = await apiClient.fetchCollections();
            return mapApiCollections(payload, userId).sort((a, b) => b.updatedAt - a.updatedAt);
        } catch (error) {
            console.warn('Laravel getUserCollections failed, falling back to local collections:', error);
        }
    }

    await delay(100);
    const normalizedUserId = normalizeUserId(userId);

    const collections = await loadCollectionsFromPersistence();
    ensureDefaultCollection(collections, normalizedUserId);
    await persistCollectionsToDisk(collections);
    const userCollections = collections
        .filter(c => normalizeUserId(c.userId) === normalizedUserId)
        .map(c => {
            if (c.postIds.length === 0) {
                c.thumbnailUrl = undefined;
            } else {
                const firstPost = posts.find(p => p.id === c.postIds[0]);
                if (firstPost) {
                    const resolved = resolvePostThumbnail(firstPost);
                    if (resolved) {
                        c.thumbnailUrl = resolved;
                    } else {
                        c.thumbnailUrl = undefined;
                    }
                }
                // If first post isn't hydrated yet in `posts`, keep persisted/API thumbnailUrl — avoids broken flashes after create.
            }
            return c;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt); // Most recently updated first

    return userCollections;
}

/**
 * Add a post to a collection
 */
export async function addPostToCollection(collectionId: string, postId: string, postSnapshot?: Partial<Post>): Promise<Collection> {
    if (isLaravelApiEnabled()) {
        try {
            const payload = await apiClient.addPostToCollectionApi(collectionId, postId);
            const mapped = mapApiCollection(payload?.data ?? payload?.collection ?? payload);
            emitCollectionsUpdated(mapped.userId);
            return mapped;
        } catch (error) {
            console.warn('Laravel addPostToCollection failed, falling back to local collections:', error);
        }
    }

    await delay(150);

    const collections = await loadCollectionsFromPersistence();
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        throw new Error('Collection not found');
    }

    const defaultCollection = ensureDefaultCollection(collections, collection.userId);

    // Don't add if already in selected collection
    if (!collection.postIds.includes(postId)) {
        collection.postIds = [postId, ...collection.postIds.filter((id) => id !== postId)];
        collection.updatedAt = Date.now();

        // Always use the latest saved post as collection thumbnail.
        const post = postSnapshot || posts.find(p => p.id === postId);
        cachePostSnapshot(postId, post);
        collection.thumbnailUrl = resolvePostThumbnail(post);
        savePreviewForPost(collection as CollectionWithPreviewMap, postId, post);
    }

    // Instagram-like behavior: every saved post also exists in the master "All Posts" list
    if (!defaultCollection.postIds.includes(postId)) {
        defaultCollection.postIds.unshift(postId);
        defaultCollection.updatedAt = Date.now();
    }
    const defaultPost = postSnapshot || posts.find(p => p.id === postId);
    const defaultThumb = resolvePostThumbnail(defaultPost);
    if (defaultThumb) defaultCollection.thumbnailUrl = defaultThumb;
    savePreviewForPost(defaultCollection as CollectionWithPreviewMap, postId, defaultPost);

    await persistCollectionsToDisk(collections);
    emitCollectionsUpdated(collection.userId);
    return collection;
}

/**
 * Remove a post from a collection
 */
export async function removePostFromCollection(
    collectionId: string,
    postId: string,
    opts?: { unsaveMaster?: boolean }
): Promise<Collection> {
    if (isLaravelApiEnabled()) {
        try {
            const payload = await apiClient.removePostFromCollectionApi(collectionId, postId);
            const mapped = mapApiCollection(payload?.data ?? payload?.collection ?? payload);
            emitCollectionsUpdated(mapped.userId);
            return mapped;
        } catch (error) {
            console.warn('Laravel removePostFromCollection failed, falling back to local collections:', error);
        }
    }

    await delay(150);

    const collections = await loadCollectionsFromPersistence();
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        throw new Error('Collection not found');
    }

    // Keep master collection immutable from per-collection removal unless explicitly unsaving (`unsaveMaster`).
    if (collection.name === DEFAULT_COLLECTION_NAME && !opts?.unsaveMaster) {
        return collection;
    }

    collection.postIds = collection.postIds.filter(id => id !== postId);
    collection.updatedAt = Date.now();

    // Update thumbnail if collection becomes empty
    if (collection.postIds.length === 0) {
        collection.thumbnailUrl = undefined;
    } else if (collection.thumbnailUrl) {
        // Update thumbnail to first post if current thumbnail was removed
        const firstPost = posts.find(p => p.id === collection.postIds[0]);
        const resolved = resolvePostThumbnail(firstPost);
        if (resolved) {
            collection.thumbnailUrl = resolved;
        }
    }

    await persistCollectionsToDisk(collections);
    emitCollectionsUpdated(collection.userId);
    return collection;
}

/** Remove this post from every collection it appears in for this user (full unsave). */
export async function unsavePost(userId: string, postId: string): Promise<void> {
    const cols = await getCollectionsForPost(userId, postId);
    for (const c of cols) {
        await removePostFromCollection(c.id, postId, { unsaveMaster: true });
    }
}

export async function getCollection(collectionId: string): Promise<Collection | null> {
    if (isLaravelApiEnabled()) {
        try {
            const payload = await apiClient.fetchCollection(collectionId);
            return mapApiCollection(payload?.data ?? payload?.collection ?? payload);
        } catch (error) {
            console.warn('Laravel getCollection failed, falling back to local collections:', error);
        }
    }

    await delay(50);
    const collections = await loadCollectionsFromPersistence();
    return collections.find((c) => c.id === collectionId) || null;
}

export async function savePostToDefaultCollection(userId: string, postId: string, postSnapshot?: Partial<Post>): Promise<Collection> {
    await delay(120);
    const normalizedUserId = normalizeUserId(userId);
    const collections = await loadCollectionsFromPersistence();
    const defaults = ensureDefaultCollection(collections, normalizedUserId);
    if (!defaults.postIds.includes(postId)) {
        defaults.postIds.unshift(postId);
        defaults.updatedAt = Date.now();
    }
    const post = postSnapshot || posts.find((p) => p.id === postId);
    cachePostSnapshot(postId, post);
    const resolved = resolvePostThumbnail(post);
    if (resolved) defaults.thumbnailUrl = resolved;
    savePreviewForPost(defaults as CollectionWithPreviewMap, postId, post);
    await persistCollectionsToDisk(collections);
    emitCollectionsUpdated(normalizedUserId);
    return defaults;
}

/**
 * Get all posts in a collection
 */
export async function getCollectionPosts(collectionId: string): Promise<Post[]> {
    if (isLaravelApiEnabled()) {
        try {
            const payload = await apiClient.fetchCollection(collectionId);
            const list = Array.isArray(payload?.posts)
                ? payload.posts
                : Array.isArray(payload?.data?.posts)
                    ? payload.data.posts
                    : [];
            if (Array.isArray(list) && list.length > 0) {
                return list as Post[];
            }
        } catch (error) {
            console.warn('Laravel getCollectionPosts failed, falling back to local collections:', error);
        }
    }

    await delay(100);

    const collections = await loadCollectionsFromPersistence();
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        throw new Error('Collection not found');
    }

    const collectionWithPreview = collection as CollectionWithPreviewMap;
    const resolvedPosts = await Promise.all(
        collection.postIds.map(async (postId) => {
            const live = posts.find((p) => p.id === postId);
            if (live) return live;

            const preview = collectionWithPreview.postPreviewMap?.[postId];
            // Prefer a full fetch when possible, but never drop text/image previews.
            try {
                const fetched = await getPostById(postId);
                if (fetched) {
                    cachePostSnapshot(postId, fetched);
                    return fetched;
                }
            } catch (error) {
                console.warn('Collection fallback fetch failed for post:', postId, error);
            }

            if (!preview) return undefined;
            const rebuilt = buildPostPreview(preview, postId) as Post;
            cachePostSnapshot(postId, rebuilt);
            return rebuilt;
        }),
    );

    const collectionPosts = resolvedPosts
        .filter((p): p is Post => p !== undefined)
        .sort((a, b) => b.createdAt - a.createdAt); // Newest first

    return collectionPosts;
}

/**
 * Resolve a post that was saved to collections but may no longer be in the live feed store
 * (common for text/image posts after navigation). Checks collection preview snapshots.
 */
export async function getPostFromCollectionPreviews(
    postId: string,
    userId?: string,
): Promise<Post | null> {
    if (!postId) return null;
    const live = posts.find((p) => p.id === postId);
    if (live) {
        return userId ? decorateForUser(userId, live) : live;
    }

    const collections = await loadCollectionsFromPersistence();
    for (const collection of collections) {
        const preview = (collection as CollectionWithPreviewMap).postPreviewMap?.[postId];
        if (!preview) continue;
        const rebuilt = buildPostPreview(preview, postId) as Post;
        cachePostSnapshot(postId, rebuilt);
        return userId ? decorateForUser(userId, rebuilt) : rebuilt;
    }
    return null;
}

/**
 * Check if a post is in a collection
 */
export async function isPostInCollection(collectionId: string, postId: string): Promise<boolean> {
    await delay(50);

    const collections = await loadCollectionsFromPersistence();
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        return false;
    }

    return collection.postIds.includes(postId);
}

/**
 * Get collections that contain a specific post
 */
export async function getCollectionsForPost(userId: string, postId: string): Promise<Collection[]> {
    if (isLaravelApiEnabled()) {
        try {
            const payload = await apiClient.fetchCollections();
            return mapApiCollections(payload, userId)
                .filter((c) => c.postIds.includes(postId))
                .sort((a, b) => b.updatedAt - a.updatedAt);
        } catch (error) {
            console.warn('Laravel getCollectionsForPost failed, falling back to local collections:', error);
        }
    }

    await delay(100);
    const normalizedUserId = normalizeUserId(userId);

    const collections = await loadCollectionsFromPersistence();
    return collections
        .filter(c => normalizeUserId(c.userId) === normalizedUserId && c.postIds.includes(postId))
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId: string): Promise<void> {
    if (isLaravelApiEnabled()) {
        try {
            await apiClient.deleteCollectionApi(collectionId);
            return;
        } catch (error) {
            console.warn('Laravel deleteCollection failed, falling back to local collections:', error);
        }
    }

    await delay(150);

    const collections = await loadCollectionsFromPersistence();
    const index = collections.findIndex(c => c.id === collectionId);
    if (index === -1) {
        throw new Error('Collection not found');
    }

    const deleted = collections[index];
    collections.splice(index, 1);
    await persistCollectionsToDisk(collections);
    emitCollectionsUpdated(deleted?.userId || '');
}

