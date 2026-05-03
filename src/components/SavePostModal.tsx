import React from 'react';
import { Collection, Post } from '../types';
import { FiX, FiPlus, FiBookmark, FiCheck } from 'react-icons/fi';
import {
    createCollection,
    getUserCollections,
    addPostToCollection,
    removePostFromCollection,
    getCollectionsForPost,
    savePostToDefaultCollection,
    getCollectionThumbnailUrl,
} from '../api/collections';
import { posts } from '../api/posts';
import { showToast } from '../utils/toast';
const DEFAULT_COLLECTION_NAME = 'All Posts';

interface SavePostModalProps {
    post: Post;
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onSaved?: () => void;
}

export default function SavePostModal({ post, userId, isOpen, onClose, onSaved }: SavePostModalProps) {
    const [collections, setCollections] = React.useState<Collection[]>([]);
    const [postCollections, setPostCollections] = React.useState<string[]>([]); // Collection IDs that contain this post
    const [isCreatingCollection, setIsCreatingCollection] = React.useState(false);
    const [newCollectionName, setNewCollectionName] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState<string | null>(null); // Collection ID being saved to
    const [showSavedToast, setShowSavedToast] = React.useState(false);
    const autoSavedOnceRef = React.useRef(false);
    /** Collection IDs whose thumbnail URL failed to load — fall back to text preview / bookmark icon */
    const [brokenCollectionThumbs, setBrokenCollectionThumbs] = React.useState<Record<string, true>>({});

    // Load collections and check which ones contain this post
    React.useEffect(() => {
        if (isOpen && userId) {
            loadCollections();
            autoSavedOnceRef.current = false;
        }
    }, [isOpen, userId, post.id]);

    React.useEffect(() => {
        if (!isOpen || !userId || isLoading || autoSavedOnceRef.current) return;
        const defaultCollection = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
        if (!defaultCollection) return;
        const alreadySaved = postCollections.includes(defaultCollection.id);
        if (alreadySaved) return;
        autoSavedOnceRef.current = true;
        (async () => {
            try {
                await savePostToDefaultCollection(userId, post.id, post);
                await loadCollections();
                setShowSavedToast(true);
                window.dispatchEvent(new CustomEvent(`postSaved-${post.id}`));
                window.setTimeout(() => setShowSavedToast(false), 2200);
            } catch (error) {
                console.error('Error auto-saving post to default collection:', error);
            }
        })();
    }, [isOpen, userId, post.id, collections, postCollections, isLoading]);

    async function loadCollections() {
        setIsLoading(true);
        try {
            const userCollections = await getUserCollections(userId);
            setCollections(userCollections);

            // Check which collections contain this post
            const collectionsWithPost = await getCollectionsForPost(userId, post.id);
            setPostCollections(collectionsWithPost.map(c => c.id));
        } catch (error) {
            console.error('Error loading collections:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCreateCollection() {
        if (!newCollectionName.trim()) return;

        setIsLoading(true);
        try {
            // Create collection with the post already added (so thumbnail is set immediately)
            const newCollection = await createCollection(userId, newCollectionName.trim(), true, post.id, post);

            // Refresh collections
            await loadCollections();

            // Notify that post was saved
            window.dispatchEvent(new CustomEvent(`postSaved-${post.id}`));

            setNewCollectionName('');
            setIsCreatingCollection(false);

            if (onSaved) {
                onSaved();
            }
        } catch (error) {
            console.error('Error creating collection:', error);
            showToast('Could not create collection. Try a shorter name or smaller media.');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleToggleCollection(collectionId: string) {
        const isInCollection = postCollections.includes(collectionId);
        setIsSaving(collectionId);

        try {
            if (isInCollection) {
                await removePostFromCollection(collectionId, post.id);
            } else {
                await addPostToCollection(collectionId, post.id, post);
            }

            // Refresh collections
            await loadCollections();

            // Notify that post was saved/unsaved
            window.dispatchEvent(new CustomEvent(`postSaved-${post.id}`));

            if (onSaved) {
                onSaved();
            }
            setShowSavedToast(true);
            window.setTimeout(() => setShowSavedToast(false), 2200);
        } catch (error) {
            console.error('Error toggling collection:', error);
            showToast('Could not save this post to collection.');
        } finally {
            setIsSaving(null);
        }
    }

    if (!isOpen) return null;
    const isLikelyVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
    const firstPreviewMedia =
        post.mediaItems?.find((item) => (item.type === 'image' || item.type === 'video') && !!item.url) || post.mediaItems?.[0];
    const previewUrl = post.videoPosterUrl || post.mediaUrl || firstPreviewMedia?.url;
    const previewType: 'image' | 'video' =
        post.mediaType ||
        (firstPreviewMedia?.type === 'video' || firstPreviewMedia?.type === 'image'
            ? firstPreviewMedia.type
            : (isLikelyVideoUrl(previewUrl || '') ? 'video' : 'image'));
    const defaultCollection = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
    const customCollections = collections.filter((c) => c.name !== DEFAULT_COLLECTION_NAME);
    const isInDefaultCollection = !!defaultCollection && postCollections.includes(defaultCollection.id);

    return (
        <div className="fixed inset-0 z-[280] flex items-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Sheet */}
            <div className="relative w-full bg-gray-800 dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1 bg-gray-600 dark:bg-gray-700 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-700 dark:border-gray-600 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Save Post</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCreatingCollection(true)}
                            className="p-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                            aria-label="New collection"
                            title="New collection"
                        >
                            <FiPlus className="w-5 h-5 text-gray-300" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                            aria-label="Close"
                            title="Close"
                        >
                            <FiX className="w-5 h-5 text-gray-300" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {/* Saved Section (Default collection) */}
                    <div className="mb-6" id={`save-collections-${post.id}`}>
                        <div
                            className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors cursor-pointer"
                            onClick={() => {
                                if (defaultCollection) {
                                    handleToggleCollection(defaultCollection.id);
                                }
                            }}
                        >
                            <div className="w-16 h-16 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {previewUrl && previewUrl.trim() !== '' ? (
                                    previewType === 'video' ? (
                                        <video
                                            src={previewUrl}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                            preload="metadata"
                                        />
                                    ) : (
                                        <img
                                            src={previewUrl}
                                            alt="Post thumbnail"
                                            className="w-full h-full object-cover"
                                        />
                                    )
                                ) : post.text ? (
                                    <div className="w-full h-full p-2 flex items-center justify-center">
                                        <p className="text-xs text-gray-300 text-center line-clamp-3 leading-tight">
                                            {post.text.length > 50 ? post.text.substring(0, 50) + '...' : post.text}
                                        </p>
                                    </div>
                                ) : (
                                    <FiBookmark className="w-8 h-8 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-white">All Posts</div>
                                <div className="text-sm text-gray-400">Private - every saved post</div>
                            </div>
                            {isInDefaultCollection && (
                                <FiBookmark className="w-5 h-5 text-[#7A8AF0] fill-[#7A8AF0] flex-shrink-0" />
                            )}
                        </div>
                    </div>

                    {/* Collections Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Collections</h3>
                            <button
                                onClick={() => setIsCreatingCollection(true)}
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                            >
                                Create new
                            </button>
                        </div>

                        {/* Create New Collection Form */}
                        {isCreatingCollection && (
                            <div className="mb-4 p-4 bg-gray-700/50 dark:bg-gray-600/50 rounded-xl">
                                <input
                                    type="text"
                                    value={newCollectionName}
                                    onChange={(e) => setNewCollectionName(e.target.value)}
                                    placeholder="Collection name"
                                    className="w-full px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white placeholder-gray-400 rounded-lg border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCreateCollection();
                                        } else if (e.key === 'Escape') {
                                            setIsCreatingCollection(false);
                                            setNewCollectionName('');
                                        }
                                    }}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCreateCollection}
                                        disabled={!newCollectionName.trim() || isLoading}
                                        className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Create
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsCreatingCollection(false);
                                            setNewCollectionName('');
                                        }}
                                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Collections List */}
                        {isLoading && collections.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">Loading collections...</div>
                        ) : customCollections.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                No collections yet. Create one to get started!
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {customCollections.map(collection => {
                                    const isInCollection = postCollections.includes(collection.id);
                                    const isSavingToThis = isSaving === collection.id;
                                    const thumbSrc = getCollectionThumbnailUrl(collection);
                                    const firstPost =
                                        collection.postIds.length > 0 ? posts.find((p) => p.id === collection.postIds[0]) : null;
                                    const isVideoThumb =
                                        !!thumbSrc &&
                                        (isLikelyVideoUrl(thumbSrc) ||
                                            firstPost?.mediaType === 'video' ||
                                            firstPost?.finalVideoUrl !== undefined);
                                    const thumbBroken = !!brokenCollectionThumbs[collection.id];
                                    const textFallback =
                                        firstPost?.text || firstPost?.caption || firstPost?.text_content;

                                    return (
                                        <div
                                            key={collection.id}
                                            className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors"
                                        >
                                            <div className="w-16 h-16 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {thumbSrc && !thumbBroken ? (
                                                    isVideoThumb ? (
                                                        <video
                                                            src={thumbSrc}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                            playsInline
                                                            preload="metadata"
                                                            onError={() =>
                                                                setBrokenCollectionThumbs((prev) => ({
                                                                    ...prev,
                                                                    [collection.id]: true,
                                                                }))
                                                            }
                                                            onLoadedMetadata={(e) => {
                                                                const video = e.currentTarget;
                                                                video.currentTime = 0;
                                                            }}
                                                        />
                                                    ) : (
                                                        <img
                                                            src={thumbSrc}
                                                            alt={collection.name}
                                                            className="w-full h-full object-cover"
                                                            onError={() =>
                                                                setBrokenCollectionThumbs((prev) => ({
                                                                    ...prev,
                                                                    [collection.id]: true,
                                                                }))
                                                            }
                                                        />
                                                    )
                                                ) : collection.postIds.length > 0 && textFallback ? (
                                                    <div className="w-full h-full p-2 flex items-center justify-center">
                                                        <p className="text-xs text-gray-300 text-center line-clamp-3 leading-tight">
                                                            {textFallback.length > 50
                                                                ? textFallback.substring(0, 50) + '...'
                                                                : textFallback}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <FiBookmark className="w-8 h-8 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-white">{collection.name}</div>
                                                <div className="text-sm text-gray-400">
                                                    {collection.isPrivate ? 'Private' : 'Public'}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleToggleCollection(collection.id)}
                                                disabled={isSavingToThis}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 border ${isInCollection
                                                    ? 'bg-blue-500 hover:bg-blue-600 border-blue-500'
                                                    : 'bg-gray-600 hover:bg-gray-500'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                aria-label={isInCollection ? 'Remove from collection' : 'Add to collection'}
                                            >
                                                {isSavingToThis ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : isInCollection ? (
                                                    <FiCheck className="w-5 h-5 text-white" />
                                                ) : (
                                                    <FiPlus className="w-5 h-5 text-white" />
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Add New Collection Button (Bottom) */}
                    <button
                        onClick={() => setIsCreatingCollection(true)}
                        className="w-full py-4 rounded-full bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 transition-colors flex items-center justify-center gap-2"
                    >
                        <FiPlus className="w-6 h-6 text-white" />
                        <span className="text-white font-medium">Add New Collection</span>
                    </button>
                </div>
                {showSavedToast && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/90 border border-white/15 px-4 py-2 flex items-center gap-3 shadow-xl">
                        <span className="text-sm font-medium text-white">Saved</span>
                        <button
                            onClick={() => {
                                setShowSavedToast(false);
                                const section = document.getElementById(`save-collections-${post.id}`);
                                section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className="text-sm font-semibold text-blue-300 hover:text-blue-200"
                        >
                            Save to collection
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

