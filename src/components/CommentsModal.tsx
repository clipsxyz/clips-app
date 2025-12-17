import React from 'react';
import { FiX, FiSend, FiMessageSquare, FiHeart, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import { useAuth } from '../context/Auth';
import { useOnline } from '../hooks/useOnline';
import { fetchComments, addComment, addReply, toggleCommentLike, toggleReplyLike } from '../api/posts';
import { enqueue } from '../utils/mutationQueue';
import Avatar from './Avatar';
import type { Comment } from '../types';

interface CommentsModalProps {
    postId: string;
    isOpen: boolean;
    onClose: () => void;
}

function formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
}

function CommentItem({
    comment,
    onLikeComment,
    onLikeReply,
    onReply,
    userId,
    postId
}: {
    comment: Comment;
    onLikeComment: (commentId: string) => Promise<void>;
    onLikeReply: (parentCommentId: string, replyId: string) => Promise<void>;
    onReply: (parentId: string, text: string) => Promise<void>;
    userId: string;
    postId: string;
}) {
    const { user } = useAuth(); // Add useAuth hook
    const [liked, setLiked] = React.useState(comment.userLiked);
    const [likes, setLikes] = React.useState(comment.likes);
    const [busy, setBusy] = React.useState(false);
    const [showReplies, setShowReplies] = React.useState(false);
    const [showReplyInput, setShowReplyInput] = React.useState(false);
    const [replyText, setReplyText] = React.useState('');
    const [submittingReply, setSubmittingReply] = React.useState(false);

    // Sync with comment data changes
    React.useEffect(() => {
        setLiked(comment.userLiked);
        setLikes(comment.likes);
    }, [comment.userLiked, comment.likes]);


    const handleReply = async () => {
        if (!replyText.trim() || submittingReply) return;

        setSubmittingReply(true);
        try {
            await onReply(comment.id, replyText.trim());
            setReplyText('');
            setShowReplyInput(false);
        } catch (error) {
            console.error('Failed to add reply:', error);
        } finally {
            setSubmittingReply(false);
        }
    };

    const replyCount = comment.replyCount || 0;
    const hasReplies = replyCount > 0;

    return (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Avatar
                            src={user?.handle === comment.userHandle ? user?.avatarUrl : undefined}
                            name={comment.userHandle?.split('@')[0] || 'User'} // Extract name from handle
                            size="sm"
                        />
                        <span className="font-medium text-sm">{comment.userHandle}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(comment.createdAt)}
                        </span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mb-3">{comment.text}</p>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4">
                        {/* Like Button */}
                        <button
                            onClick={() => onLikeComment(comment.id)}
                            disabled={busy}
                            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                            aria-pressed={liked}
                            aria-label={liked ? 'Unlike comment' : 'Like comment'}
                        >
                            {liked ? (
                                <AiFillHeart className="text-red-500" size={16} />
                            ) : (
                                <FiHeart size={16} />
                            )}
                            <span className="text-xs text-gray-600 dark:text-gray-400">{likes}</span>
                        </button>

                        {/* Reply Button */}
                        <button
                            onClick={() => setShowReplyInput(!showReplyInput)}
                            className="text-xs text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                        >
                            Reply
                        </button>
                    </div>

                    {/* Reply Input */}
                    {showReplyInput && (
                        <div className="mt-3 ml-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Write a reply..."
                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                                    disabled={submittingReply}
                                />
                                <button
                                    onClick={handleReply}
                                    disabled={!replyText.trim() || submittingReply}
                                    className="p-2 rounded-lg bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
                                >
                                    <FiSend size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Replies Section */}
                    {hasReplies && (
                        <div className="mt-3 ml-4">
                            <button
                                onClick={() => setShowReplies(!showReplies)}
                                className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                            >
                                {showReplies ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                                View {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                            </button>

                            {/* Nested Replies */}
                            {showReplies && comment.replies && (
                                <div className="mt-2 space-y-3">
                                    {comment.replies.map(reply => (
                                        <div key={reply.id} className="border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Avatar
                                                    src={user?.handle === reply.userHandle ? user?.avatarUrl : undefined}
                                                    name={reply.userHandle?.split('@')[0] || 'User'} // Extract name from handle
                                                    size="sm"
                                                />
                                                <span className="font-medium text-xs">{reply.userHandle}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatTime(reply.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-800 dark:text-gray-200 mb-2">{reply.text}</p>

                                            {/* Reply Like Button */}
                                            <button
                                                onClick={() => onLikeReply(comment.id, reply.id)}
                                                className="flex items-center gap-1 px-1 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                {reply.userLiked ? (
                                                    <AiFillHeart className="text-red-500" size={12} />
                                                ) : (
                                                    <FiHeart size={12} />
                                                )}
                                                <span className="text-xs text-gray-600 dark:text-gray-400">{reply.likes}</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CommentInput({
    placeholder,
    onSubmit,
    isLoading
}: {
    placeholder: string;
    onSubmit: (text: string) => void;
    isLoading: boolean;
}) {
    const { user } = useAuth();
    const [text, setText] = React.useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim() && !isLoading) {
            onSubmit(text.trim());
            setText('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
            <Avatar
                src={user?.avatarUrl}
                name={user?.name || 'User'}
                size="sm"
            />
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                disabled={isLoading}
            />
            <button
                type="submit"
                disabled={!text.trim() || isLoading}
                className="p-2 rounded-lg bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
            >
                <FiSend size={16} />
            </button>
        </form>
    );
}

export default function CommentsModal({ postId, isOpen, onClose }: CommentsModalProps) {
    const { user } = useAuth();
    const online = useOnline();
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);

    // Load comments when modal opens
    React.useEffect(() => {
        if (isOpen) {
            loadComments();
        }
    }, [isOpen, postId]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const fetchedComments = await fetchComments(postId);
            setComments(fetchedComments);
        } catch (error) {
            console.error('Failed to load comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async (text: string) => {
        if (!user) return;

        // Always show an optimistic comment immediately in the UI
        const optimisticComment: Comment = {
            id: `temp-${Date.now()}`,
            postId,
            userHandle: user.handle || 'Anonymous',
            text,
            createdAt: Date.now(),
            likes: 0,
            userLiked: false,
        };
        setComments(prev => [...prev, optimisticComment]);

        setSubmitting(true);
        try {
            if (!online) {
                // Queue for offline sync only
                await enqueue({
                    type: 'comment',
                    postId,
                    userId: user.id,
                    text
                });
                return;
            }

            const newComment = await addComment(postId, user.handle || 'darraghdublin', text);

            // Replace optimistic comment with real one from API/mock store
            setComments(prev => prev.map(c => c.id === optimisticComment.id ? newComment : c));

            // Notify EngagementBar to update comment count
            window.dispatchEvent(new CustomEvent(`commentAdded-${postId}`));
        } catch (error) {
            console.error('Failed to add comment:', error);
            // If API fails, keep the optimistic comment in UI
        } finally {
            setSubmitting(false);
        }
    };

    const handleLikeComment = async (commentId: string) => {
        if (!user) return;

        // Optimistically update like state in UI
        setComments(prev => prev.map(comment => {
            if (comment.id !== commentId) return comment;
            const currentlyLiked = comment.userLiked;
            const newLiked = !currentlyLiked;
            const newLikes = (comment.likes || 0) + (newLiked ? 1 : -1);
            return { ...comment, userLiked: newLiked, likes: newLikes };
        }));

        try {
            if (!online) {
                // Queue for offline
                await enqueue({
                    type: 'commentLike',
                    commentId,
                    userId: user.id
                });
                return;
            }

            const updatedComment = await toggleCommentLike(commentId);
            setComments(prev => prev.map(comment =>
                comment.id === commentId ? updatedComment : comment
            ));
        } catch (error) {
            console.error('Failed to like comment:', error);
        }
    };

    const handleLikeReply = async (parentCommentId: string, replyId: string) => {
        if (!user) return;

        try {
            if (!online) {
                // Queue for offline
                await enqueue({
                    type: 'replyLike',
                    parentCommentId,
                    replyId,
                    userId: user.id
                });
                return;
            }

            const updatedParentComment = await toggleReplyLike(parentCommentId, replyId);
            setComments(prev => prev.map(comment =>
                comment.id === parentCommentId ? updatedParentComment : comment
            ));
        } catch (error) {
            console.error('Failed to like reply:', error);
        }
    };

    const handleReplyToComment = async (parentId: string, text: string) => {
        if (!user) return;

        // Always show an optimistic reply immediately
        const optimisticReply: Comment = {
            id: `temp-reply-${Date.now()}`,
            postId,
            userHandle: user.handle || 'Anonymous',
            text,
            createdAt: Date.now(),
            likes: 0,
            userLiked: false,
            parentId,
        };

        setComments(prevComments =>
            prevComments.map(comment => {
                if (comment.id === parentId) {
                    return {
                        ...comment,
                        replies: [...(comment.replies || []), optimisticReply],
                        replyCount: (comment.replyCount || 0) + 1
                    };
                }
                return comment;
            })
        );

        try {
            if (!online) {
                // Queue for offline sync only
                await enqueue({
                    type: 'reply',
                    postId,
                    parentId,
                    userId: user.id,
                    text
                });
                return;
            }

            const newReply = await addReply(postId, parentId, user.handle || 'darraghdublin', text);

            // Replace optimistic reply with real one from API/mock store
            setComments(prevComments =>
                prevComments.map(comment => {
                    if (comment.id === parentId) {
                        return {
                            ...comment,
                            replies: (comment.replies || []).map(r => r.id === optimisticReply.id ? newReply : r),
                            replyCount: (comment.replyCount || 0) + 0 // already incremented optimistically
                        };
                    }
                    return comment;
                })
            );

            // Notify EngagementBar to update comment count
            window.dispatchEvent(new CustomEvent(`commentAdded-${postId}`));
        } catch (error) {
            console.error('Failed to add reply:', error);
            // If API fails, keep optimistic reply in UI
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-950 w-full max-w-md h-[80vh] md:h-[70vh] rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Comments
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Close comments"
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <FiMessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No comments yet</p>
                            <p className="text-sm">Be the first to comment!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {comments.map(comment => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    onLikeComment={handleLikeComment}
                                    onLikeReply={handleLikeReply}
                                    onReply={handleReplyToComment}
                                    userId={user?.id || ''}
                                    postId={postId}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Comment Input */}
                <CommentInput
                    placeholder="Write a comment..."
                    onSubmit={handleAddComment}
                    isLoading={submitting}
                />

                {/* Offline indicator */}
                {!online && (
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs border-t border-amber-200 dark:border-amber-800">
                        You're offline. Comments will sync when back online.
                    </div>
                )}
            </div>
        </div>
    );
}
