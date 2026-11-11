import React from 'react';
import { Collection, Post } from '../types';
import { FiX, FiPlus, FiBookmark, FiCheck, FiChevronRight } from 'react-icons/fi';
import {
    createCollection,
    getUserCollections,
    addPostToCollection,
    removePostFromCollection,
    getCollectionsForPost,
    savePostToDefaultCollection,
} from '../api/collections';
import { showToast } from '../utils/toast';
import CollectionCoverThumb from './CollectionCoverThumb';
import { resolvePostThumbnail } from '../api/collections';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';

const SHEET_GRADIENT = 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)';
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
    const [thumbFailed, setThumbFailed] = React.useState(false);
    const autoSavedOnceRef = React.useRef(false);

    // Load collections and check which ones contain this post
    React.useEffect(() => {
        if (isOpen && userId) {
            loadCollections();
            autoSavedOnceRef.current = false;
            setThumbFailed(false);
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
                window.dispatchEvent(new CustomEvent(`postSaved-${post.id}`));
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

    const stillRaw = resolvePostThumbnail(post) || (previewType !== 'video' ? previewUrl : '');
    const thumbSrc = !thumbFailed && stillRaw ? rewriteMediaUrlForClient(stillRaw) : '';
    const videoRaw = previewType === 'video' ? (post.mediaUrl || firstPreviewMedia?.url) : '';
    const videoSrc = videoRaw ? rewriteMediaUrlForClient(videoRaw) : '';
    const postThumb = thumbSrc ? (
        <img src={thumbSrc} alt="" className="h-full w-full object-cover" onError={() => setThumbFailed(true)} />
    ) : videoSrc ? (
        <video src={videoSrc} className="h-full w-full object-cover" muted playsInline preload="metadata" />
    ) : post.text ? (
        <p className="line-clamp-5 px-1.5 text-center text-[11px] font-semibold leading-tight text-white">
            {post.text}
        </p>
    ) : (
        <FiBookmark className="h-8 w-8 text-[#D1E4FF]" />
    );

    return (
        <div className="fixed inset-0 z-[280] flex items-end justify-center">
            <button type="button" className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Dismiss save" />
            <div
                className="relative flex max-h-[78%] w-full max-w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-t-[20px] border border-b-0 border-white/15 pb-3"
                style={{ background: SHEET_GRADIENT }}
            >
                <div className="flex justify-center pb-1.5 pt-2.5">
                    <div className="h-1 w-10 rounded-full bg-white/30" />
                </div>
                <div className="relative flex min-h-11 items-center justify-center px-4 pb-2">
                    <h2 className="text-base font-semibold text-white">{isCreatingCollection ? 'New collection' : 'Save'}</h2>
                    <button type="button" onClick={onClose} className="absolute right-3.5 top-0 flex h-9 w-9 items-center justify-center text-white" aria-label="Close">
                        <FiX size={22} />
                    </button>
                </div>

                {isCreatingCollection ? (
                    <div className="px-4 pb-4">
                        <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-[rgba(15,36,48,0.88)]">
                            {postThumb}
                        </div>
                        <input
                            type="text"
                            value={newCollectionName}
                            onChange={(e) => setNewCollectionName(e.target.value)}
                            placeholder="Collection name"
                            maxLength={60}
                            className="mb-2 w-full rounded-lg border border-white/12 bg-[rgba(6,13,22,0.72)] px-3 py-2 text-sm text-white placeholder:text-[#94A3B8] focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateCollection();
                                else if (e.key === 'Escape') {
                                    setIsCreatingCollection(false);
                                    setNewCollectionName('');
                                }
                            }}
                        />
                        <p className="mb-4 text-[13px] text-[#94A3B8]">Collections are private. Only you can see them.</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleCreateCollection}
                                disabled={!newCollectionName.trim() || isLoading}
                                className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCreatingCollection(false);
                                    setNewCollectionName('');
                                }}
                                className="rounded-xl border border-white/35 px-4 py-2.5 text-sm font-semibold text-white"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {isInDefaultCollection ? (
                            <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-[10px] border border-white/12 bg-[rgba(15,36,48,0.72)] px-3 py-2.5">
                                <FiCheck className="text-[#00F2FF]" size={18} />
                                <span className="text-sm font-bold text-white">Saved</span>
                                <span className="text-sm font-medium text-[#D1E4FF]">to All Posts</span>
                            </div>
                        ) : null}
                        <p className="px-4 text-[15px] font-bold text-white">Collections</p>
                        <p className="mb-3.5 px-4 text-[13px] leading-[18px] text-[#94A3B8]">
                            Tap a collection to add this post, or create a new one.
                        </p>
                        {isLoading && collections.length === 0 ? (
                            <div className="py-8 text-center text-sm text-[#D1E4FF]">Loading collections...</div>
                        ) : (
                            <div className="flex gap-3.5 overflow-x-auto px-4 pb-2">
                                <button type="button" onClick={() => setIsCreatingCollection(true)} className="w-24 shrink-0 text-center">
                                    <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-white/12 bg-[rgba(15,36,48,0.72)]">
                                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[rgba(6,13,22,0.72)] text-white">
                                            <FiPlus size={28} />
                                        </span>
                                    </div>
                                    <span className="line-clamp-2 text-xs font-medium text-white">New collection</span>
                                </button>
                                {defaultCollection ? (
                                    <button
                                        type="button"
                                        onClick={() => handleToggleCollection(defaultCollection.id)}
                                        disabled={isSaving === defaultCollection.id}
                                        className="w-24 shrink-0 text-center"
                                    >
                                        <div className="relative mb-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-[rgba(15,36,48,0.88)]">
                                            {postThumb}
                                            {isInDefaultCollection ? (
                                                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white">
                                                    <FiCheck size={16} />
                                                </span>
                                            ) : null}
                                        </div>
                                        <span className="line-clamp-2 text-xs font-medium text-white">All Posts</span>
                                    </button>
                                ) : null}
                                {customCollections.map((collection) => {
                                    const isInCollection = postCollections.includes(collection.id);
                                    return (
                                        <button
                                            key={collection.id}
                                            type="button"
                                            onClick={() => handleToggleCollection(collection.id)}
                                            disabled={isSaving === collection.id}
                                            className="w-24 shrink-0 text-center"
                                        >
                                            <div className="relative mb-2 h-24 w-24 overflow-hidden rounded-xl">
                                                <CollectionCoverThumb
                                                    collection={collection}
                                                    className="h-24 w-24 rounded-xl"
                                                    iconClassName="h-7 w-7 text-[#D1E4FF]"
                                                />
                                                {isInCollection ? (
                                                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white">
                                                        <FiCheck size={16} />
                                                    </span>
                                                ) : null}
                                            </div>
                                            <span className="line-clamp-2 text-xs font-medium text-white">{collection.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsCreatingCollection(true)}
                            className="mx-4 mt-2 flex items-center gap-3 rounded-xl px-1 py-3 text-left"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-[rgba(15,36,48,0.72)] text-white">
                                <FiPlus size={20} />
                            </span>
                            <span className="flex-1 text-sm font-semibold text-white">New collection</span>
                            <FiChevronRight className="text-[#D1E4FF]" size={18} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

