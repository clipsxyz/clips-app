import React from 'react';
import { FiX, FiSend, FiMessageSquare, FiHeart, FiChevronDown, FiChevronUp, FiSmile } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import { useAuth } from '../context/Auth';
import { useOnline } from '../hooks/useOnline';
import { fetchComments, addComment, addReply, toggleCommentLike, toggleReplyLike } from '../api/posts';
import { enqueue } from '../utils/mutationQueue';
import Avatar from './Avatar';
import type { Comment } from '../types';
import { getAvatarForHandle } from '../api/users';

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
    userId: _userId,
    postId: _postId
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
        <div className="flex gap-3">
            <Avatar
                src={
                    comment.userHandle === user?.handle
                        ? (user?.avatarUrl || getAvatarForHandle(comment.userHandle))
                        : getAvatarForHandle(comment.userHandle)
                }
                name={comment.userHandle?.split('@')[0] || 'User'}
                size="sm"
                className="flex-shrink-0 ring-1 ring-gray-200"
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-gray-900">
                        {comment.userHandle}
                    </span>
                    <span className="text-xs text-gray-500">
                        {formatTime(comment.createdAt)}
                    </span>
                </div>
                <p className="text-sm text-gray-900 mb-2">{comment.text}</p>

                {/* Action row: Reply on left, like on right (Scenes style) */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowReplyInput(!showReplyInput)}
                        className="text-xs text-gray-500 hover:text-gray-900 font-medium"
                    >
                        Reply
                    </button>
                    <button
                        onClick={async () => {
                            if (busy) return;
                            setBusy(true);
                            // Optimistic toggle like state
                            const nextLiked = !liked;
                            setLiked(nextLiked);
                            setLikes((prevLikes) => (prevLikes || 0) + (nextLiked ? 1 : -1));
                            try {
                                await onLikeComment(comment.id);
                            } catch (err) {
                                // Revert on failure
                                setLiked(comment.userLiked);
                                setLikes(comment.likes);
                            } finally {
                                setBusy(false);
                            }
                        }}
                        disabled={busy}
                        className="flex items-center gap-1 text-gray-500 hover:text-red-500 disabled:opacity-50 disabled:pointer-events-none"
                        aria-pressed={liked}
                        aria-label={liked ? 'Unlike comment' : 'Like comment'}
                    >
                        {liked ? (
                            <AiFillHeart className="w-4 h-4 text-red-500" />
                        ) : (
                            <FiHeart className="w-4 h-4" />
                        )}
                        <span className="text-xs">{likes}</span>
                    </button>
                </div>

                {/* Inline reply input under this comment */}
                {showReplyInput && (
                    <div className="mt-2 flex items-center gap-2">
                        <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 min-w-0 px-3 py-2 rounded-full bg-gray-100 text-gray-900 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            disabled={submittingReply}
                        />
                        <button
                            onClick={handleReply}
                            disabled={!replyText.trim() || submittingReply}
                            className="p-2 text-gray-900 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <FiSend size={16} />
                        </button>
                    </div>
                )}

                {/* Replies Section (Scenes-style: View replies toggle + indented thread) */}
                {hasReplies && (
                    <div className="mt-2 ml-2">
                        <button
                            onClick={() => setShowReplies(!showReplies)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                        >
                            {showReplies ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                            {showReplies
                                ? `Hide replies (${replyCount})`
                                : `View replies (${replyCount})`}
                        </button>

                        {showReplies && comment.replies && (
                            <div className="mt-2 pl-4 border-l-2 border-gray-200 bg-gray-50/80 rounded-r-md py-2 space-y-3">
                                {comment.replies.map(reply => (
                                    <div key={reply.id} className="flex gap-2">
                                        <Avatar
                                            src={
                                                reply.userHandle === user?.handle
                                                    ? (user?.avatarUrl || getAvatarForHandle(reply.userHandle))
                                                    : getAvatarForHandle(reply.userHandle)
                                            }
                                            name={reply.userHandle?.split('@')[0] || 'User'}
                                            size="sm"
                                            className="flex-shrink-0 ring-1 ring-gray-200 w-6 h-6"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="font-semibold text-xs text-gray-900">
                                                    {reply.userHandle}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {formatTime(reply.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-900 mb-1">{reply.text}</p>
                                            <button
                                                onClick={() => onLikeReply(comment.id, reply.id)}
                                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
                                            >
                                                {reply.userLiked ? (
                                                    <AiFillHeart className="w-3.5 h-3.5 text-red-500" />
                                                ) : (
                                                    <FiHeart className="w-3.5 h-3.5" />
                                                )}
                                                <span className="text-xs">{reply.likes ?? 0}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const COMMENT_EMOJIS = ['😀', '😃', '😄', '😊', '🥰', '😍', '🤩', '😘', '😂', '🤣', '😅', '🙂', '😉', '😎', '🤔', '👍', '👏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🔥', '✨', '🙌', '🙏'];

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
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim() && !isLoading) {
            onSubmit(text.trim());
            setText('');
        }
    };

    return (
        <div className="border-t border-gray-200 bg-white">
            {showEmojiPicker && (
                <div className="p-2 border-b border-gray-100 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {COMMENT_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => setText((prev) => prev + emoji)}
                            className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-gray-100"
                            aria-label={`Add ${emoji}`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
                <Avatar
                    src={user?.avatarUrl}
                    name={user?.name || 'User'}
                    size="sm"
                />
                <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className={`p-2 rounded-lg flex-shrink-0 ${showEmojiPicker ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    aria-label="Add emoji"
                >
                    <FiSmile size={20} />
                </button>
                <div className="flex-1 rounded-lg p-[2px] bg-gray-300 focus-within:bg-gradient-to-r focus-within:from-violet-600 focus-within:to-sky-300 transition-[background] duration-200">
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 rounded-[6px] border-0 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0"
                        disabled={isLoading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!text.trim() || isLoading}
                    className="p-2 rounded-lg bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
                >
                    <FiSend size={16} />
                </button>
            </form>
        </div>
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

            {/* Modal - always light theme (no dark mode) */}
            <div className="relative bg-white w-full h-full md:max-w-md md:h-[80vh] rounded-none md:rounded-2xl md:rounded-b-2xl rounded-t-2xl shadow-xl flex flex-col text-gray-900">
                {/* Header - match Scenes/TikTok style: "X comments" + close */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-base font-semibold text-gray-900">
                        {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-1 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        aria-label="Close comments"
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {/* Comments List - Scenes-style spacing */}
                <div className="flex-1 overflow-y-auto p-4 bg-white">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
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
                    <div className="px-4 py-2 bg-amber-50 text-amber-900 text-xs border-t border-amber-200">
                        You're offline. Comments will sync when back online.
                    </div>
                )}
            </div>
        </div>
    );
}
