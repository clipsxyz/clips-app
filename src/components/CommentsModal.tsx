import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiX, FiSend, FiMessageSquare, FiThumbsUp, FiChevronDown, FiChevronUp, FiSmile } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { useOnline } from '../hooks/useOnline';
import {
    fetchCommentsPage,
    addComment,
    addReply,
    deleteCommentById,
    toggleCommentLike,
    toggleReplyLike,
    getPostById,
    isFrontendOnlyPostId,
    setCommentModerationState,
    toggleFollowForPost,
    setFollowState,
} from '../api/posts';
import { toggleFollow } from '../api/client';
import { isLaravelApiEnabled, isViteDevMode } from '../config/runtimeEnv';
import { enqueue } from '../utils/mutationQueue';
import Avatar from './Avatar';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas';
import type { Comment, Post } from '../types';
import { getAvatarForHandle } from '../api/users';
import { evaluateCommentModeration, getCommentModerationPreferences } from '../utils/commentModeration';

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

/** Relative time for post caption footer (e.g. "4 days ago"). */
function formatPostRelative(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

const HANDLE_REGEX = /\b[A-Za-z0-9._-]+@[A-Za-z0-9_-]+\b/g;

function renderTextWithMentions(
    text: string,
    onHandleClick: (handle: string) => void
): React.ReactNode[] {
    const safeText = text || '';
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    let match: RegExpExecArray | null;
    HANDLE_REGEX.lastIndex = 0;
    while ((match = HANDLE_REGEX.exec(safeText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > cursor) nodes.push(<React.Fragment key={`t-${key++}`}>{safeText.slice(cursor, start)}</React.Fragment>);
        const handle = match[0];
        nodes.push(
            <button
                key={`h-${key++}`}
                type="button"
                className="inline p-0 m-0 bg-transparent border-none text-[#7A8AF0] hover:underline"
                onClick={(e) => {
                    e.stopPropagation();
                    onHandleClick(handle);
                }}
                aria-label={`View ${handle} profile`}
            >
                {handle}
            </button>
        );
        cursor = end;
    }
    if (cursor < safeText.length) nodes.push(<React.Fragment key={`t-${key++}`}>{safeText.slice(cursor)}</React.Fragment>);
    return nodes;
}

function CommentItem({
    comment,
    onLikeComment,
    onLikeReply,
    onStartReply,
    onModerateComment,
    isPostOwner,
    isReplyingTo,
    userId: _userId,
    postId: _postId
}: {
    comment: Comment;
    onLikeComment: (commentId: string) => Promise<void>;
    onLikeReply: (parentCommentId: string, replyId: string) => Promise<void>;
    onStartReply: (commentId: string, handle: string) => void;
    onModerateComment: (commentId: string, action: 'hide' | 'unhide' | 'delete') => Promise<void>;
    isPostOwner: boolean;
    isReplyingTo?: boolean;
    userId: string;
    postId: string;
}) {
    const { user } = useAuth(); // Add useAuth hook
    const navigate = useNavigate();
    const [liked, setLiked] = React.useState(comment.userLiked);
    const [likes, setLikes] = React.useState(comment.likes);
    const [busy, setBusy] = React.useState(false);
    const [showReplies, setShowReplies] = React.useState(false);

    // Sync with comment data changes
    React.useEffect(() => {
        setLiked(comment.userLiked);
        setLikes(comment.likes);
    }, [comment.userLiked, comment.likes]);

    const replyCount = comment.replyCount || 0;
    const hasReplies = replyCount > 0;
    const isCommentAuthor = String(comment.userHandle || '').trim().toLowerCase() === String(user?.handle || '').trim().toLowerCase();
    const isHiddenForViewer = comment.moderationState === 'hidden_by_filter' && !isCommentAuthor;
    const visibleReplies = (comment.replies || []).filter((reply) => {
        if (reply.moderationState !== 'hidden_by_filter') return true;
        return String(reply.userHandle || '').trim().toLowerCase() === String(user?.handle || '').trim().toLowerCase();
    });

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
                className="flex-shrink-0 ring-1 ring-white/20"
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-[#e8eef2]">
                        {comment.userHandle}
                    </span>
                    <span className="text-xs text-white/55">
                        {formatTime(comment.createdAt)}
                    </span>
                </div>
                <p className="text-sm text-[#e8eef2] mb-2">
                    {isHiddenForViewer
                        ? 'Comment hidden for safety.'
                        : renderTextWithMentions(comment.text || '', (handle) => navigate(`/user/${encodeURIComponent(handle)}`))}
                </p>
                {comment.moderationState === 'hidden_by_filter' && String(comment.userHandle || '').trim().toLowerCase() === String(user?.handle || '').trim().toLowerCase() && (
                    <p className="mb-2 text-[11px] text-amber-700">Hidden from others by safety filter</p>
                )}
                {isPostOwner && (
                    <div className="mb-2 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onModerateComment(comment.id, comment.moderationState === 'hidden_by_filter' ? 'unhide' : 'hide')}
                            className="text-[11px] font-medium text-white/60 hover:text-[#e8eef2]"
                        >
                            {comment.moderationState === 'hidden_by_filter' ? 'Unhide' : 'Hide'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onModerateComment(comment.id, 'delete')}
                            className="text-[11px] font-medium text-red-600 hover:text-red-700"
                        >
                            Delete
                        </button>
                    </div>
                )}

                {/* Action row: Reply on left, like on right (Scenes style) */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => onStartReply(comment.id, comment.userHandle || '')}
                        className={`text-xs font-medium disabled:opacity-50 ${isReplyingTo ? 'text-[#3d9b8f]' : 'text-white/55 hover:text-[#e8eef2]'}`}
                        disabled={isHiddenForViewer}
                    >
                        {isReplyingTo ? 'Replying…' : 'Reply'}
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
                        disabled={busy || isHiddenForViewer}
                        className="flex items-center gap-1 text-white/55 hover:text-blue-500 disabled:opacity-50 disabled:pointer-events-none"
                        aria-pressed={liked}
                        aria-label={liked ? 'Unlike comment' : 'Like comment'}
                    >
                        <FiThumbsUp className={`w-4 h-4 ${liked ? 'text-blue-500' : ''}`} />
                        <span className="text-xs">{likes}</span>
                    </button>
                </div>

                {/* Replies Section (Scenes-style: View replies toggle + indented thread) */}
                {hasReplies && (
                    <div className="mt-2 ml-2">
                        <button
                            onClick={() => setShowReplies(!showReplies)}
                            className="flex items-center gap-1 text-xs text-white/55 hover:text-[#e8eef2]"
                        >
                            {showReplies ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                            {showReplies
                                ? `Hide replies (${replyCount})`
                                : `View replies (${replyCount})`}
                        </button>

                        {showReplies && visibleReplies.length > 0 && (
                            <div className="mt-2 pl-4 border-l-2 border-white/15 bg-[rgba(15,36,48,0.55)] rounded-r-md py-2 space-y-3">
                                {visibleReplies.map(reply => (
                                    <div key={reply.id} className="flex gap-2">
                                        <Avatar
                                            src={
                                                reply.userHandle === user?.handle
                                                    ? (user?.avatarUrl || getAvatarForHandle(reply.userHandle))
                                                    : getAvatarForHandle(reply.userHandle)
                                            }
                                            name={reply.userHandle?.split('@')[0] || 'User'}
                                            size="sm"
                                            className="flex-shrink-0 ring-1 ring-white/20 w-6 h-6"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="font-semibold text-xs text-[#e8eef2]">
                                                    {reply.userHandle}
                                                </span>
                                                <span className="text-xs text-white/45">
                                                    {formatTime(reply.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[#e8eef2] mb-1">
                                                {renderTextWithMentions(reply.text, (handle) => navigate(`/user/${encodeURIComponent(handle)}`))}
                                            </p>
                                            <button
                                                onClick={() => onLikeReply(comment.id, reply.id)}
                                                className="flex items-center gap-1 text-xs text-white/55 hover:text-red-500 transition-colors"
                                            >
                                                <FiThumbsUp className={`w-3.5 h-3.5 ${reply.userLiked ? 'text-blue-500' : ''}`} />
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
    isLoading,
    replyingToHandle,
    onCancelReply,
}: {
    placeholder: string;
    onSubmit: (text: string) => void;
    isLoading: boolean;
    replyingToHandle?: string | null;
    onCancelReply?: () => void;
}) {
    const { user } = useAuth();
    const [text, setText] = React.useState('');
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        if (!replyingToHandle) return;
        setText('');
        const t = window.setTimeout(() => inputRef.current?.focus(), 50);
        return () => window.clearTimeout(t);
    }, [replyingToHandle]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim() && !isLoading) {
            onSubmit(text.trim());
            setText('');
        }
    };

    return (
        <div className="border-t border-white/10 bg-[rgba(6,13,22,0.55)]">
            {replyingToHandle ? (
                <div className="flex items-center justify-between gap-2 px-3 pt-2">
                    <p className="text-xs text-white/55 truncate">Replying to {replyingToHandle}</p>
                    <button type="button" onClick={onCancelReply} className="p-1 text-white/55 hover:text-white" aria-label="Cancel reply">
                        <FiX size={14} />
                    </button>
                </div>
            ) : null}
            {showEmojiPicker && (
                <div className="p-2 border-b border-white/10 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {COMMENT_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => setText((prev) => prev + emoji)}
                            className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-transparent/10"
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
                    className={`p-2 rounded-lg flex-shrink-0 ${showEmojiPicker ? 'bg-transparent/15 text-white' : 'text-white/55 hover:text-white/70 hover:bg-transparent/10'}`}
                    aria-label="Add emoji"
                >
                    <FiSmile size={20} />
                </button>
                <div className="flex-1 rounded-lg p-[2px] bg-transparent/20 focus-within:bg-gradient-to-r focus-within:from-violet-600 focus-within:to-sky-300 transition-[background] duration-200">
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 rounded-[6px] border-0 bg-[rgba(6,13,22,0.72)] text-[#e8eef2] placeholder-white/45 focus:outline-none focus:ring-0"
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
    const navigate = useNavigate();
    const { user } = useAuth();
    const online = useOnline();
    const [post, setPost] = React.useState<Post | null>(null);
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [commentsCursor, setCommentsCursor] = React.useState<string | null>(null);
    const [commentsHasMore, setCommentsHasMore] = React.useState(false);
    const [commentsLoadingMore, setCommentsLoadingMore] = React.useState(false);
    const [sortMode, setSortMode] = React.useState<'top' | 'newest'>('top');
    const [loading, setLoading] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [replyingTo, setReplyingTo] = React.useState<{ id: string; handle: string } | null>(null);
    const [submittingReply, setSubmittingReply] = React.useState(false);
    const [followBusy, setFollowBusy] = React.useState(false);
    const commentsScrollRef = React.useRef<HTMLDivElement | null>(null);
    const filteredComments = React.useMemo(() => {
        const ordered = [...comments];
        if (sortMode === 'newest') {
            ordered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return ordered;
        }
        ordered.sort((a, b) => {
            const byLikes = (b.likes || 0) - (a.likes || 0);
            if (byLikes !== 0) return byLikes;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        return ordered;
    }, [comments, sortMode]);

    const postIdStr = String(postId || '');
    const isDemoPost = isFrontendOnlyPostId(postIdStr);
    const canLoadComments = isDemoPost || Boolean(user?.id);

    // Load post (author, caption) + comments when modal opens
    React.useEffect(() => {
        if (!isOpen || !postId || !canLoadComments) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setPost(null);
            setComments([]);
            setCommentsCursor(null);
            setCommentsHasMore(false);
            setCommentsLoadingMore(false);
            try {
                const [fetchedPost, fetchedCommentsPage] = await Promise.all([
                    getPostById(postId, user?.id),
                    fetchCommentsPage(postId, null, 30, 5, user?.id),
                ]);
                if (cancelled) return;
                setPost(fetchedPost);
                setComments(fetchedCommentsPage.items);
                setCommentsCursor(fetchedCommentsPage.nextCursor);
                setCommentsHasMore(fetchedCommentsPage.hasMore);
                requestAnimationFrame(() => {
                    commentsScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                });
            } catch (error) {
                console.error('Failed to load comments sheet:', error);
                if (!cancelled) {
                    setPost(null);
                    setComments([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, postId, canLoadComments]);

    const handleLoadMoreComments = React.useCallback(async () => {
        if (commentsLoadingMore || !commentsHasMore || !commentsCursor) return;
        setCommentsLoadingMore(true);
        try {
            const page = await fetchCommentsPage(postId, commentsCursor, 30, 5, user?.id);
            if (page.items.length > 0) {
                setComments((prev) => {
                    const seen = new Set(prev.map((c) => String(c.id)));
                    const merged = [...prev];
                    page.items.forEach((c) => {
                        if (!seen.has(String(c.id))) {
                            merged.push(c);
                            seen.add(String(c.id));
                        }
                    });
                    return merged;
                });
            }
            setCommentsCursor(page.nextCursor);
            setCommentsHasMore(page.hasMore);
        } catch (error) {
            console.error('Failed to load more comments:', error);
        } finally {
            setCommentsLoadingMore(false);
        }
    }, [commentsCursor, commentsHasMore, commentsLoadingMore, postId, user?.id]);

    const handleCommentsScroll = React.useCallback((el: HTMLDivElement) => {
        if (loading || commentsLoadingMore || !commentsHasMore || !commentsCursor) return;
        const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (remaining <= 180) {
            void handleLoadMoreComments();
        }
    }, [commentsCursor, commentsHasMore, commentsLoadingMore, handleLoadMoreComments, loading]);

    const handleFollowAuthor = async () => {
        if (!user?.id || !post || user.handle === post.userHandle) return;
        setFollowBusy(true);
        const authorHandle = post.userHandle;
        /** Match FeedCard: real API unless mock-only dev mode. */
        const useLaravelFollow =
            isLaravelApiEnabled() && !isViteDevMode();

        try {
            let newFollowing: boolean;

            if (useLaravelFollow) {
                try {
                    const result = await toggleFollow(authorHandle);
                    newFollowing =
                        result?.status === 'accepted' || result?.following === true;
                    setFollowState(user.id, authorHandle, newFollowing);
                } catch (apiError: any) {
                    const isConnection =
                        apiError?.message === 'CONNECTION_REFUSED' ||
                        apiError?.name === 'ConnectionRefused' ||
                        apiError?.message?.includes('Failed to fetch');
                    if (isConnection) {
                        const updated = await toggleFollowForPost(
                            user.id,
                            postId,
                            authorHandle
                        );
                        newFollowing = !!updated.isFollowing;
                    } else {
                        throw apiError;
                    }
                }
            } else {
                const updated = await toggleFollowForPost(
                    user.id,
                    postId,
                    authorHandle
                );
                newFollowing = !!updated.isFollowing;
            }

            setPost((prev) =>
                prev ? { ...prev, isFollowing: newFollowing } : null
            );
            // Keeps feed cards, stories rail, and other listeners in sync with profile/+ button
            window.dispatchEvent(
                new CustomEvent('followToggled', {
                    detail: { handle: authorHandle, isFollowing: newFollowing },
                })
            );
        } catch (e) {
            console.error('Follow toggle failed:', e);
        } finally {
            setFollowBusy(false);
        }
    };

    const handleAddComment = async (text: string) => {
        if (!user) return;
        const moderation = evaluateCommentModeration(text, getCommentModerationPreferences());
        if (moderation.level !== 'none') {
            const shouldContinue = window.confirm(
                moderation.level === 'hide'
                    ? 'This comment may violate safety filters and will be hidden from others. Post anyway?'
                    : 'This comment looks potentially harmful. Post anyway?'
            );
            if (!shouldContinue) return;
        }

        // Always show an optimistic comment immediately in the UI
        const optimisticComment: Comment = {
            id: `temp-${Date.now()}`,
            postId,
            userHandle: user.handle || 'Anonymous',
            text,
            createdAt: Date.now(),
            likes: 0,
            userLiked: false,
            moderationState: moderation.level === 'hide' ? 'hidden_by_filter' : 'visible',
            moderationReason: moderation.matched[0],
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
        const moderation = evaluateCommentModeration(text, getCommentModerationPreferences());
        if (moderation.level !== 'none') {
            const shouldContinue = window.confirm(
                moderation.level === 'hide'
                    ? 'This reply may violate safety filters and will be hidden from others. Post anyway?'
                    : 'This reply looks potentially harmful. Post anyway?'
            );
            if (!shouldContinue) return;
        }

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
            moderationState: moderation.level === 'hide' ? 'hidden_by_filter' : 'visible',
            moderationReason: moderation.matched[0],
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

    const handleModerateComment = async (commentId: string, action: 'hide' | 'unhide' | 'delete') => {
        if (!post || !user?.handle) return;
        const isOwner = String(post.userHandle || '').trim().toLowerCase() === String(user.handle || '').trim().toLowerCase();
        if (!isOwner) return;

        if (action === 'delete') {
            const ok = await deleteCommentById(commentId);
            if (!ok) return;
            setComments((prev) =>
                prev
                    .filter((comment) => comment.id !== commentId)
                    .map((comment) => ({
                        ...comment,
                        replies: (comment.replies || []).filter((reply) => reply.id !== commentId),
                        replyCount: Math.max(0, ((comment.replies || []).filter((reply) => reply.id !== commentId)).length),
                    }))
            );
            return;
        }

        const nextState = action === 'hide' ? 'hidden_by_filter' : 'visible';
        const ok = await setCommentModerationState(commentId, nextState, 'creator_moderation');
        if (!ok) return;
        setComments((prev) =>
            prev.map((comment) => {
                if (comment.id === commentId) {
                    return {
                        ...comment,
                        moderationState: nextState,
                        moderationReason: nextState === 'hidden_by_filter' ? 'creator_moderation' : undefined,
                    };
                }
                return {
                    ...comment,
                    replies: (comment.replies || []).map((reply) =>
                        reply.id === commentId
                            ? {
                                ...reply,
                                moderationState: nextState,
                                moderationReason: nextState === 'hidden_by_filter' ? 'creator_moderation' : undefined,
                            }
                            : reply
                    ),
                };
            })
        );
    };

    if (!isOpen) return null;

    const storyText = (post?.caption || post?.text || '').trim();
    const authorHandle = post?.userHandle ?? '';
    const isPostOwner = Boolean(user?.handle && authorHandle && String(user.handle).trim().toLowerCase() === String(authorHandle).trim().toLowerCase());
    const showFollow =
        Boolean(user?.handle && authorHandle && user.handle !== authorHandle);

    return createPortal(
        <div className="fixed inset-0 z-[230] flex items-end md:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />

            {/* Modal — View Profile passport canvas */}
            <div className="relative w-full h-[min(58dvh,520px)] md:max-w-md md:h-[80vh] rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col min-h-0 overflow-hidden border border-white/10 border-b-0 bg-[#060d16] text-[#e8eef2]">
                <DiscoverAmbientCanvas fixed={false} variant="passport" />
                <div className="relative z-10 flex flex-col min-h-0 flex-1">
                {post?.mediaUrl ? (
                    <div className="flex items-center gap-3 px-4 pt-3 pb-2 flex-shrink-0 border-b border-white/10">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-[rgba(15,36,48,0.88)] flex-shrink-0">
                            {post.mediaType === 'video' ? (
                                <video
                                    src={post.mediaUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={post.mediaUrl}
                                    alt="Post preview"
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                        {authorHandle ? (
                            <p className="text-sm font-semibold text-[#e8eef2] truncate">{authorHandle}</p>
                        ) : null}
                    </div>
                ) : null}
                {/* Mobile drag affordance */}
                <div className="flex justify-center pt-2 pb-0.5 flex-shrink-0 md:hidden">
                    <div className="w-10 h-1 bg-transparent/20 rounded-full" aria-hidden />
                </div>

                {/* Header: comment count + close */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                    <h2 className="text-base font-semibold text-[#e8eef2]">
                        {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-white/15 p-0.5">
                            <button
                                type="button"
                                onClick={() => setSortMode('top')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md ${sortMode === 'top' ? 'bg-[#3d9b8f]/35 text-white' : 'text-white/60 hover:bg-transparent/10'}`}
                            >
                                Top
                            </button>
                            <button
                                type="button"
                                onClick={() => setSortMode('newest')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md ${sortMode === 'newest' ? 'bg-[#3d9b8f]/35 text-white' : 'text-white/60 hover:bg-transparent/10'}`}
                            >
                                Newest
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-1 rounded-lg text-white/60 hover:text-[#e8eef2] hover:bg-transparent/10 transition-colors"
                            aria-label="Close comments"
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                </div>

                {/* Scrollable: author row → story text → comments (Instagram-style order) */}
                <div
                    ref={commentsScrollRef}
                    onScroll={(e) => handleCommentsScroll(e.currentTarget)}
                    className="flex-1 overflow-y-auto min-h-0 bg-transparent"
                >
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3d9b8f]" />
                        </div>
                    ) : (
                        <>
                            {/* 1 — Post author + Follow */}
                            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                                <Avatar
                                    src={authorHandle ? getAvatarForHandle(authorHandle) : undefined}
                                    name={authorHandle.split('@')[0] || 'User'}
                                    size="md"
                                    className="flex-shrink-0 ring-1 ring-white/20"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-[#e8eef2] truncate">
                                        {authorHandle || 'Unknown'}
                                    </p>
                                </div>
                                {showFollow && (
                                    <button
                                        type="button"
                                        onClick={handleFollowAuthor}
                                        disabled={followBusy}
                                        className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                                            post?.isFollowing
                                                ? 'bg-transparent/15 text-white'
                                                : 'bg-[#3d9b8f]/35 text-white hover:bg-[#3d9b8f]/45'
                                        }`}
                                    >
                                        {post?.isFollowing ? 'Following' : 'Follow'}
                                    </button>
                                )}
                            </div>

                            {/* 2 — Story / caption */}
                            {storyText ? (
                                <div className="px-4 py-3 border-b border-white/10">
                                    <p className="text-sm text-[#e8eef2] whitespace-pre-wrap leading-relaxed">
                                        {renderTextWithMentions(storyText, (handle) => navigate(`/user/${encodeURIComponent(handle)}`))}
                                    </p>
                                    {post?.createdAt != null && (
                                        <p className="text-xs text-white/55 mt-2">
                                            {formatPostRelative(post.createdAt)}
                                        </p>
                                    )}
                                </div>
                            ) : null}

                            {/* 3 — Comments list */}
                            <div className="p-4">
                                {filteredComments.length === 0 ? (
                                    <div className="text-center py-8 text-white/55">
                                        <FiMessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>No comments yet</p>
                                        <p className="text-sm">Be the first to comment!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredComments.map(comment => (
                                            <CommentItem
                                                key={comment.id}
                                                comment={comment}
                                                onLikeComment={handleLikeComment}
                                                onLikeReply={handleLikeReply}
                                                onStartReply={(id, handle) => setReplyingTo({ id, handle })}
                                                onModerateComment={handleModerateComment}
                                                isPostOwner={isPostOwner}
                                                isReplyingTo={replyingTo?.id === comment.id}
                                                userId={user?.id || ''}
                                                postId={postId}
                                            />
                                        ))}
                                        {commentsHasMore && (
                                            <div className="pt-1">
                                                <button
                                                    type="button"
                                                    onClick={handleLoadMoreComments}
                                                    disabled={commentsLoadingMore}
                                                    className="w-full min-h-[40px] rounded-lg border border-white/15 bg-[rgba(15,36,48,0.72)] text-sm text-white/70 disabled:opacity-60"
                                                >
                                                    {commentsLoadingMore ? 'Loading...' : 'Load more comments'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Comment Input */}
                <div className="flex-shrink-0">
                    <CommentInput
                        placeholder={replyingTo ? 'Write a reply...' : 'Join the conversation...'}
                        onSubmit={async (text) => {
                            if (replyingTo) {
                                setSubmittingReply(true);
                                try {
                                    await handleReplyToComment(replyingTo.id, text);
                                    setReplyingTo(null);
                                } finally {
                                    setSubmittingReply(false);
                                }
                                return;
                            }
                            await handleAddComment(text);
                        }}
                        isLoading={submitting || submittingReply}
                        replyingToHandle={replyingTo?.handle}
                        onCancelReply={() => setReplyingTo(null)}
                    />
                </div>

                {/* Offline indicator */}
                {!online && (
                    <div className="px-4 py-2 bg-amber-500/15 text-amber-100 text-xs border-t border-amber-400/30">
                        You're offline. Comments will sync when back online.
                    </div>
                )}
                </div>
            </div>
        </div>,
        document.body
    );
}
