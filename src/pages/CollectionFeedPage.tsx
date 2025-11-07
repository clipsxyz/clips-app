import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { getCollectionPosts } from '../api/collections';
import { decorateForUser, toggleLike, toggleFollowForPost, incrementViews, incrementShares, reclipPost } from '../api/posts';
import { useOnline } from '../hooks/useOnline';
import { enqueue } from '../utils/mutationQueue';
import type { Post } from '../types';
import { FeedCard } from '../App';
import { FiArrowLeft } from 'react-icons/fi';
import CommentsModal from '../components/CommentsModal';
import ShareModal from '../components/ShareModal';
import ScenesModal from '../components/ScenesModal';

export default function CollectionFeedPage() {
    const { collectionId } = useParams<{ collectionId: string }>();
    const nav = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const online = useOnline();
    const userId = user?.id || '';
    const [posts, setPosts] = React.useState<Post[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [collectionName, setCollectionName] = React.useState<string>('Collection');
    const [commentsModalOpen, setCommentsModalOpen] = React.useState(false);
    const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
    const [shareModalOpen, setShareModalOpen] = React.useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = React.useState<Post | null>(null);
    const [scenesOpen, setScenesOpen] = React.useState(false);
    const [selectedPostForScenes, setSelectedPostForScenes] = React.useState<Post | null>(null);

    function updateOne(id: string, updater: (post: Post) => Post) {
        setPosts(prev => prev.map(p => p.id === id ? updater(p) : p));
    }

    function handleOpenComments(postId: string) {
        setSelectedPostId(postId);
        setCommentsModalOpen(true);
    }

    // Get collection name from location state
    React.useEffect(() => {
        const state = location.state as any;
        if (state?.collectionName) {
            setCollectionName(state.collectionName);
        }
    }, [location.state]);

    // Load collection posts
    React.useEffect(() => {
        if (collectionId && user?.id) {
            loadCollectionPosts();
        }
    }, [collectionId, user?.id]);

    async function loadCollectionPosts() {
        if (!collectionId || !user?.id) return;

        setIsLoading(true);
        try {
            const collectionPosts = await getCollectionPosts(collectionId);
            const decorated = collectionPosts.map(p => decorateForUser(user.id, p));
            setPosts(decorated);
        } catch (error) {
            console.error('Error loading collection posts:', error);
        } finally {
            setIsLoading(false);
        }
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Not Signed In</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Please sign in to view collections</p>
                    <button
                        onClick={() => nav('/login')}
                        className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-xl shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => nav('/profile')}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Back"
                    >
                        <FiArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{collectionName}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Posts Feed */}
            <div className="max-w-2xl mx-auto pt-6">
                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="inline-block w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading posts...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400">No posts in this collection yet</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {posts.map(p => (
                            <FeedCard
                                key={p.id}
                                post={p}
                                onLike={async () => {
                                    if (!online) {
                                        updateOne(p.id, post => ({ ...post, userLiked: !post.userLiked }));
                                        await enqueue({ type: 'like', postId: p.id, userId });
                                        return;
                                    }
                                    const updated = await toggleLike(userId, p.id);
                                    updateOne(p.id, _post => ({ ...updated }));
                                    window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                                        detail: { liked: updated.userLiked, likes: updated.stats.likes }
                                    }));
                                }}
                                onFollow={async () => {
                                    if (!online) {
                                        await enqueue({ type: 'follow', postId: p.id, userId });
                                        return;
                                    }
                                    const updated = await toggleFollowForPost(userId, p.id);
                                    updateOne(p.id, _post => ({ ...updated }));
                                }}
                                onShare={async () => {
                                    setSelectedPostForShare(p);
                                    setShareModalOpen(true);
                                }}
                                onOpenComments={() => handleOpenComments(p.id)}
                                onView={async () => {
                                    if (!online) {
                                        await enqueue({ type: 'view', postId: p.id, userId });
                                        return;
                                    }
                                    const updated = await incrementViews(userId, p.id);
                                    updateOne(p.id, _post => ({ ...updated }));
                                    window.dispatchEvent(new CustomEvent(`viewAdded-${p.id}`));
                                }}
                                onReclip={async () => {
                                    if (p.userHandle === user?.handle) {
                                        console.log('Cannot reclip your own post');
                                        return;
                                    }
                                    if (p.userReclipped) {
                                        console.log('Post already reclipped by user, ignoring reclip request');
                                        return;
                                    }
                                    if (!online) {
                                        updateOne(p.id, post => ({
                                            ...post,
                                            userReclipped: true,
                                            stats: { ...post.stats, reclips: post.stats.reclips + 1 }
                                        }));
                                        await enqueue({ type: 'reclip', postId: p.id, userId, userHandle: user?.handle || 'Unknown@Unknown' });
                                        window.dispatchEvent(new CustomEvent(`reclipAdded-${p.id}`));
                                        return;
                                    }
                                    const { originalPost: updatedOriginalPost } = await reclipPost(userId, p.id, user?.handle || 'Unknown@Unknown');
                                    updateOne(p.id, _post => ({ ...updatedOriginalPost }));
                                    window.dispatchEvent(new CustomEvent(`reclipAdded-${p.id}`, {
                                        detail: { reclips: updatedOriginalPost.stats.reclips }
                                    }));
                                }}
                                onOpenScenes={() => {
                                    setSelectedPostForScenes(p);
                                    setScenesOpen(true);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {selectedPostId && (
                <CommentsModal
                    postId={selectedPostId}
                    isOpen={commentsModalOpen}
                    onClose={() => {
                        setCommentsModalOpen(false);
                        setSelectedPostId(null);
                    }}
                />
            )}
            {selectedPostForShare && (
                <ShareModal
                    post={selectedPostForShare}
                    isOpen={shareModalOpen}
                    onClose={() => {
                        setShareModalOpen(false);
                        setSelectedPostForShare(null);
                    }}
                />
            )}
            {selectedPostForScenes && (
                <ScenesModal
                    post={selectedPostForScenes}
                    isOpen={scenesOpen}
                    onClose={() => {
                        setScenesOpen(false);
                        setSelectedPostForScenes(null);
                    }}
                    onLike={async () => {
                        if (!online) {
                            updateOne(selectedPostForScenes.id, post => ({ ...post, userLiked: !post.userLiked }));
                            await enqueue({ type: 'like', postId: selectedPostForScenes.id, userId });
                            return;
                        }
                        const updated = await toggleLike(userId, selectedPostForScenes.id);
                        updateOne(selectedPostForScenes.id, _post => ({ ...updated }));
                        setSelectedPostForScenes(updated);
                        window.dispatchEvent(new CustomEvent(`likeToggled-${selectedPostForScenes.id}`, {
                            detail: { liked: updated.userLiked, likes: updated.stats.likes }
                        }));
                    }}
                    onFollow={async () => {
                        if (!online) {
                            await enqueue({ type: 'follow', postId: selectedPostForScenes.id, userId });
                            return;
                        }
                        const updated = await toggleFollowForPost(userId, selectedPostForScenes.id);
                        updateOne(selectedPostForScenes.id, _post => ({ ...updated }));
                        setSelectedPostForScenes(updated);
                    }}
                    onShare={async () => {
                        setSelectedPostForShare(selectedPostForScenes);
                        setShareModalOpen(true);
                    }}
                    onOpenComments={() => handleOpenComments(selectedPostForScenes.id)}
                    onReclip={async () => {
                        if (selectedPostForScenes.userHandle === user?.handle) {
                            console.log('Cannot reclip your own post');
                            return;
                        }
                        if (selectedPostForScenes.userReclipped) {
                            console.log('Post already reclipped by user, ignoring reclip request');
                            return;
                        }
                        if (!online) {
                            updateOne(selectedPostForScenes.id, post => ({
                                ...post,
                                userReclipped: true,
                                stats: { ...post.stats, reclips: post.stats.reclips + 1 }
                            }));
                            await enqueue({ type: 'reclip', postId: selectedPostForScenes.id, userId, userHandle: user?.handle || 'Unknown@Unknown' });
                            window.dispatchEvent(new CustomEvent(`reclipAdded-${selectedPostForScenes.id}`));
                            return;
                        }
                        const { originalPost: updatedOriginalPost } = await reclipPost(userId, selectedPostForScenes.id, user?.handle || 'Unknown@Unknown');
                        updateOne(selectedPostForScenes.id, _post => ({ ...updatedOriginalPost }));
                        setSelectedPostForScenes(updatedOriginalPost);
                        window.dispatchEvent(new CustomEvent(`reclipAdded-${selectedPostForScenes.id}`, {
                            detail: { reclips: updatedOriginalPost.stats.reclips }
                        }));
                    }}
                />
            )}
        </div>
    );
}

