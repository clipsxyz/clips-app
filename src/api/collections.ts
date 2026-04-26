import { Collection, Post } from '../types';
import { posts, getPostById } from './posts';

// Storage key for collections
const COLLECTIONS_STORAGE_KEY = 'clips_app_collections';
const DEFAULT_COLLECTION_NAME = 'All Posts';
const normalizeUserId = (value: string | number | undefined | null): string => String(value ?? '').trim();
const MAX_INLINE_PREVIEW_URL_LENGTH = 4000;
type CollectionWithPreviewMap = Collection & {
    postPreviewMap?: Record<string, Partial<Post>>;
};

// Get collections from localStorage
function getCollectionsFromStorage(): CollectionWithPreviewMap[] {
    try {
        const stored = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error reading collections from localStorage:', error);
        return [];
    }
}

// Save collections to localStorage
function saveCollectionsToStorage(collections: CollectionWithPreviewMap[]): void {
    const attemptWrite = (payload: CollectionWithPreviewMap[]) => {
        localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(payload));
    };
    const sanitizeForStorage = (input: CollectionWithPreviewMap[]): CollectionWithPreviewMap[] => {
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
                // mediaItems can be very large for carousel data URLs; keep only the first lightweight item.
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
    };
    const ultraCompactForStorage = (input: CollectionWithPreviewMap[]): CollectionWithPreviewMap[] => {
        return input.map((collection) => {
            const next: CollectionWithPreviewMap = {
                ...collection,
                // Preserve membership first; thumbnails/previews are optional.
                thumbnailUrl:
                    typeof collection.thumbnailUrl === 'string' &&
                    (collection.thumbnailUrl.startsWith('http://') ||
                        collection.thumbnailUrl.startsWith('https://') ||
                        collection.thumbnailUrl.startsWith('blob:'))
                        ? collection.thumbnailUrl
                        : undefined,
                postPreviewMap: undefined,
            };
            return next;
        });
    };

    try {
        attemptWrite(collections);
    } catch (error) {
        try {
            const compacted = sanitizeForStorage(collections);
            attemptWrite(compacted);
        } catch (retryError) {
            try {
                const ultraCompacted = ultraCompactForStorage(collections);
                attemptWrite(ultraCompacted);
            } catch (finalError) {
                console.error('Error saving collections to localStorage:', finalError);
                throw new Error('Failed to save collection data.');
            }
        }
    }
}

// Mock delay function
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function resolvePostThumbnail(post?: Partial<Post>): string | undefined {
    if (!post) return undefined;
    const firstMediaItem =
        Array.isArray(post.mediaItems) && post.mediaItems.length > 0
            ? post.mediaItems.find((item) => (item?.type === 'image' || item?.type === 'video') && !!item.url) || post.mediaItems[0]
            : undefined;
    return compactPersistedMediaUrl(post.videoPosterUrl || post.mediaUrl || firstMediaItem?.url || undefined);
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
    if (typeof window === 'undefined') return;
    const normalizedUserId = normalizeUserId(userId);
    window.dispatchEvent(new CustomEvent('collectionsUpdated', { detail: { userId: normalizedUserId } }));
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
    const resolvedMediaUrl = compactPersistedMediaUrl(post?.mediaUrl) || firstMediaItem?.url || compactPersistedMediaUrl(post?.videoPosterUrl);
    const resolvedMediaType =
        post?.mediaType ||
        (firstMediaItem?.type === 'video' || firstMediaItem?.type === 'image'
            ? firstMediaItem.type
            : ((resolvedMediaUrl || '').includes('video') ? 'video' : 'image'));
    return {
        id: post?.id || postId,
        userHandle: post?.userHandle || 'unknown@clips',
        locationLabel: post?.locationLabel || 'Unknown Location',
        tags: Array.isArray(post?.tags) ? post!.tags : [],
        mediaUrl: resolvedMediaUrl,
        mediaType: resolvedMediaType,
        videoPosterUrl: post?.videoPosterUrl,
        mediaItems: compactMediaItems.length > 0 ? compactMediaItems : undefined,
        // Keep collection preview lightweight to avoid localStorage bloat.
        // Full carousel media remains available from live in-memory posts.
        text: post?.text,
        caption: post?.caption,
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
        posts[existingIndex] = {
            ...posts[existingIndex],
            ...cached,
            id: postId,
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

    const collections = getCollectionsFromStorage();
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
    saveCollectionsToStorage(collections);
    emitCollectionsUpdated(normalizedUserId);
    return collection;
}

/**
 * Get all collections for a user
 */
export async function getUserCollections(userId: string): Promise<Collection[]> {
    await delay(100);
    const normalizedUserId = normalizeUserId(userId);

    const collections = getCollectionsFromStorage();
    ensureDefaultCollection(collections, normalizedUserId);
    saveCollectionsToStorage(collections);
    const userCollections = collections
        .filter(c => normalizeUserId(c.userId) === normalizedUserId)
        .map(c => {
            // Always update thumbnail from first post if available
            if (c.postIds.length > 0) {
                const firstPost = posts.find(p => p.id === c.postIds[0]);
                const resolved = resolvePostThumbnail(firstPost);
                if (resolved) {
                    c.thumbnailUrl = resolved;
                } else {
                    // If first post has no media, clear thumbnail
                    c.thumbnailUrl = undefined;
                }
            } else {
                // If collection is empty, clear thumbnail
                c.thumbnailUrl = undefined;
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
    await delay(150);

    const collections = getCollectionsFromStorage();
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

    saveCollectionsToStorage(collections);
    emitCollectionsUpdated(collection.userId);
    return collection;
}

/**
 * Remove a post from a collection
 */
export async function removePostFromCollection(collectionId: string, postId: string): Promise<Collection> {
    await delay(150);

    const collections = getCollectionsFromStorage();
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        throw new Error('Collection not found');
    }

    // Keep master collection immutable from per-collection removal, similar to Instagram's "all saved".
    if (collection.name === DEFAULT_COLLECTION_NAME) {
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

    saveCollectionsToStorage(collections);
    emitCollectionsUpdated(collection.userId);
    return collection;
}

export async function getCollection(collectionId: string): Promise<Collection | null> {
    await delay(50);
    const collections = getCollectionsFromStorage();
    return collections.find((c) => c.id === collectionId) || null;
}

export async function savePostToDefaultCollection(userId: string, postId: string, postSnapshot?: Partial<Post>): Promise<Collection> {
    await delay(120);
    const normalizedUserId = normalizeUserId(userId);
    const collections = getCollectionsFromStorage();
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
    saveCollectionsToStorage(collections);
    emitCollectionsUpdated(normalizedUserId);
    return defaults;
}

/**
 * Get all posts in a collection
 */
export async function getCollectionPosts(collectionId: string): Promise<Post[]> {
    await delay(100);

    const collections = getCollectionsFromStorage();
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        throw new Error('Collection not found');
    }

    const collectionWithPreview = collection as CollectionWithPreviewMap;
    const resolvedPosts = await Promise.all(
        collection.postIds.map(async (postId) => {
            const live = posts.find(p => p.id === postId);
            if (live) return live;

            const preview = collectionWithPreview.postPreviewMap?.[postId];
            const previewHasRenderableMedia = !!(
                preview?.mediaUrl ||
                (Array.isArray(preview?.mediaItems) && preview!.mediaItems!.length > 0)
            );
            if (!previewHasRenderableMedia) {
                try {
                    const fetched = await getPostById(postId);
                    if (fetched) return fetched;
                } catch (error) {
                    console.warn('Collection fallback fetch failed for post:', postId, error);
                }
            }

            if (!preview) return undefined;
            return buildPostPreview(preview, postId) as Post;
        })
    );

    const collectionPosts = resolvedPosts
        .filter((p): p is Post => p !== undefined)
        .sort((a, b) => b.createdAt - a.createdAt); // Newest first

    return collectionPosts;
}

/**
 * Check if a post is in a collection
 */
export async function isPostInCollection(collectionId: string, postId: string): Promise<boolean> {
    await delay(50);

    const collections = getCollectionsFromStorage();
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
    await delay(100);
    const normalizedUserId = normalizeUserId(userId);

    const collections = getCollectionsFromStorage();
    return collections
        .filter(c => normalizeUserId(c.userId) === normalizedUserId && c.postIds.includes(postId))
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId: string): Promise<void> {
    await delay(150);

    const collections = getCollectionsFromStorage();
    const index = collections.findIndex(c => c.id === collectionId);
    if (index === -1) {
        throw new Error('Collection not found');
    }

    const deleted = collections[index];
    collections.splice(index, 1);
    saveCollectionsToStorage(collections);
    emitCollectionsUpdated(deleted?.userId || '');
}

