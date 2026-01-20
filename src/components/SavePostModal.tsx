import React from 'react';
import { Collection, Post } from '../types';
import { FiX, FiPlus, FiBookmark } from 'react-icons/fi';
import { createCollection, getUserCollections, addPostToCollection, removePostFromCollection, getCollectionsForPost } from '../api/collections';
import { posts } from '../api/posts';

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

    // Load collections and check which ones contain this post
    React.useEffect(() => {
        if (isOpen && userId) {
            loadCollections();
        }
    }, [isOpen, userId, post.id]);

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
            const newCollection = await createCollection(userId, newCollectionName.trim(), true, post.id);

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
                await addPostToCollection(collectionId, post.id);
            }

            // Refresh collections
            await loadCollections();

            // Notify that post was saved/unsaved
            window.dispatchEvent(new CustomEvent(`postSaved-${post.id}`));

            if (onSaved) {
                onSaved();
            }
        } catch (error) {
            console.error('Error toggling collection:', error);
        } finally {
            setIsSaving(null);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-end">
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
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-5 h-5 text-gray-300" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {/* Saved Section (Default collection) */}
                    <div className="mb-6">
                        <div
                            className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors cursor-pointer"
                            onClick={() => {
                                // Handle default "Saved" collection
                                const defaultCollection = collections.find(c => c.name === 'Saved');
                                if (defaultCollection) {
                                    handleToggleCollection(defaultCollection.id);
                                }
                            }}
                        >
                            <div className="w-16 h-16 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {post.mediaUrl && post.mediaUrl.trim() !== '' ? (
                                    post.mediaType === 'video' ? (
                                        <video
                                            src={post.mediaUrl}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                            preload="metadata"
                                        />
                                    ) : (
                                        <img
                                            src={post.mediaUrl}
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
                                <div className="font-semibold text-white">Saved</div>
                                <div className="text-sm text-gray-400">Private</div>
                            </div>
                            {postCollections.length > 0 && (
                                <FiBookmark className="w-5 h-5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
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
                                New collection
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
                        ) : collections.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                No collections yet. Create one to get started!
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {collections.map(collection => {
                                    const isInCollection = postCollections.includes(collection.id);
                                    const isSavingToThis = isSaving === collection.id;

                                    return (
                                        <div
                                            key={collection.id}
                                            className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors"
                                        >
                                            <div className="w-16 h-16 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {collection.thumbnailUrl ? (
                                                    (() => {
                                                        // Find the first post to check its mediaType
                                                        const firstPost = collection.postIds.length > 0
                                                            ? posts.find(p => p.id === collection.postIds[0])
                                                            : null;
                                                        const isVideo = firstPost?.mediaType === 'video' ||
                                                            collection.thumbnailUrl.toLowerCase().endsWith('.mp4') ||
                                                            collection.thumbnailUrl.toLowerCase().endsWith('.webm') ||
                                                            collection.thumbnailUrl.toLowerCase().endsWith('.mov');
                                                        return isVideo ? (
                                                            <video
                                                                src={collection.thumbnailUrl}
                                                                className="w-full h-full object-cover"
                                                                muted
                                                                playsInline
                                                                preload="metadata"
                                                                onLoadedMetadata={(e) => {
                                                                    // Ensure first frame is shown
                                                                    const video = e.currentTarget;
                                                                    video.currentTime = 0;
                                                                }}
                                                            />
                                                        ) : (
                                                            <img
                                                                src={collection.thumbnailUrl}
                                                                alt={collection.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        );
                                                    })()
                                                ) : collection.postIds.length > 0 ? (
                                                    (() => {
                                                        // Find the first post to show text preview
                                                        const firstPost = posts.find(p => p.id === collection.postIds[0]);
                                                        if (firstPost?.text) {
                                                            return (
                                                                <div className="w-full h-full p-2 flex items-center justify-center">
                                                                    <p className="text-xs text-gray-300 text-center line-clamp-3 leading-tight">
                                                                        {firstPost.text.length > 50 ? firstPost.text.substring(0, 50) + '...' : firstPost.text}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                        return <FiBookmark className="w-8 h-8 text-gray-400" />;
                                                    })()
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
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${isInCollection
                                                    ? 'bg-blue-500 hover:bg-blue-600'
                                                    : 'bg-gray-600 hover:bg-gray-500'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                aria-label={isInCollection ? 'Remove from collection' : 'Add to collection'}
                                            >
                                                {isSavingToThis ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : isInCollection ? (
                                                    <FiX className="w-5 h-5 text-white" />
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
            </div>
        </div>
    );
}

