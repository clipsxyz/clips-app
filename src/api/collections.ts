import { Collection, Post } from '../types';
import { posts } from './posts';

// Mock storage for collections
const collections: Collection[] = [];

// Mock delay function
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a new collection
 */
export async function createCollection(userId: string, name: string, isPrivate: boolean = true, initialPostId?: string): Promise<Collection> {
    await delay(200);

    let thumbnailUrl: string | undefined;

    // If an initial post is provided, set it as the thumbnail
    if (initialPostId) {
        const post = posts.find(p => p.id === initialPostId);
        if (post?.mediaUrl) {
            thumbnailUrl = post.mediaUrl;
        }
    }

    const collection: Collection = {
        id: `collection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        name,
        isPrivate,
        postIds: initialPostId ? [initialPostId] : [],
        thumbnailUrl,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    collections.push(collection);
    return collection;
}

/**
 * Get all collections for a user
 */
export async function getUserCollections(userId: string): Promise<Collection[]> {
    await delay(100);

    const userCollections = collections
        .filter(c => c.userId === userId)
        .map(c => {
            // Always update thumbnail from first post if available
            if (c.postIds.length > 0) {
                const firstPost = posts.find(p => p.id === c.postIds[0]);
                if (firstPost?.mediaUrl) {
                    c.thumbnailUrl = firstPost.mediaUrl;
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
export async function addPostToCollection(collectionId: string, postId: string): Promise<Collection> {
    await delay(150);

    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        throw new Error('Collection not found');
    }

    // Don't add if already in collection
    if (!collection.postIds.includes(postId)) {
        // If this is the first post being added, set it as the thumbnail
        const isFirstPost = collection.postIds.length === 0;
        collection.postIds.push(postId);
        collection.updatedAt = Date.now();

        // Update thumbnail if this is the first post or collection has no thumbnail
        if (isFirstPost || !collection.thumbnailUrl) {
            const post = posts.find(p => p.id === postId);
            if (post?.mediaUrl) {
                collection.thumbnailUrl = post.mediaUrl;
            }
        }
    }

    return collection;
}

/**
 * Remove a post from a collection
 */
export async function removePostFromCollection(collectionId: string, postId: string): Promise<Collection> {
    await delay(150);

    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        throw new Error('Collection not found');
    }

    collection.postIds = collection.postIds.filter(id => id !== postId);
    collection.updatedAt = Date.now();

    // Update thumbnail if collection becomes empty
    if (collection.postIds.length === 0) {
        collection.thumbnailUrl = undefined;
    } else if (collection.thumbnailUrl) {
        // Update thumbnail to first post if current thumbnail was removed
        const firstPost = posts.find(p => p.id === collection.postIds[0]);
        if (firstPost?.mediaUrl) {
            collection.thumbnailUrl = firstPost.mediaUrl;
        }
    }

    return collection;
}

/**
 * Get all posts in a collection
 */
export async function getCollectionPosts(collectionId: string): Promise<Post[]> {
    await delay(100);

    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        throw new Error('Collection not found');
    }

    const collectionPosts = collection.postIds
        .map(postId => posts.find(p => p.id === postId))
        .filter((p): p is Post => p !== undefined)
        .sort((a, b) => b.createdAt - a.createdAt); // Newest first

    return collectionPosts;
}

/**
 * Check if a post is in a collection
 */
export async function isPostInCollection(collectionId: string, postId: string): Promise<boolean> {
    await delay(50);

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

    return collections
        .filter(c => c.userId === userId && c.postIds.includes(postId))
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId: string): Promise<void> {
    await delay(150);

    const index = collections.findIndex(c => c.id === collectionId);
    if (index === -1) {
        throw new Error('Collection not found');
    }

    collections.splice(index, 1);
}

