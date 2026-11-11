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
import type { Comment, Post } from '../types';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import { getAvatarForHandle } from '../api/users';
import { evaluateCommentModeration, getCommentModerationPreferences, resolveCommentComposerAccess } from '../utils/commentModeration';

const SHEET_GRADIENT = 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)';

function commentSheetPreviewUrl(post: Post): string | undefined {
    const anyPost = post as Post & {
        posterUrl?: string;
        thumbnailUrl?: string;
        avatarUrl?: string;
        author?: { avatarUrl?: string };
    };
    const mediaPosters = (post.mediaItems || []).flatMap((item) => {
        const slide = item as { posterUrl?: string; thumbnailUrl?: string; url?: string; type?: string };
        return [slide.posterUrl, slide.thumbnailUrl, slide.type === 'image' ? slide.url : undefined];
    });
    const isVideo =
        post.mediaType === 'video' || (post.mediaItems || []).some((item) => item.type === 'video');
    const raw = [
        anyPost.posterUrl,
        post.videoPosterUrl,
        anyPost.thumbnailUrl,
        ...mediaPosters,
        !isVideo ? post.mediaUrl : undefined,
        anyPost.author?.avatarUrl,
        anyPost.avatarUrl,
        post.userHandle ? getAvatarForHandle(post.userHandle) : undefined,
    ].find((url): url is string => typeof url === 'string' && url.trim().length > 0);
    return raw ? rewriteMediaUrlForClient(raw) : undefined;
}

function sheetAvatarSrc(
    handle: string | undefined,
    explicit?: string | null,
    viewer?: { handle?: string; avatarUrl?: string } | null,
): string | undefined {
    const samePerson = Boolean(
        viewer?.handle &&
            handle &&
            viewer.handle.trim().toLowerCase() === handle.trim().toLowerCase(),
    );
    const raw = (samePerson ? viewer?.avatarUrl : undefined) || explicit || getAvatarForHandle(handle);
    return raw ? rewriteMediaUrlForClient(raw) : undefined;
}

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
                className="inline p-0 m-0 bg-transparent border-none font-semibold text-white hover:underline"
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
    const [showReplies, setShowReplies] = React.useState(true);

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
                src={sheetAvatarSrc(comment.userHandle, comment.avatarUrl, user)}
                name={comment.userHandle?.split('@')[0] || 'User'}
                size="sm"
                className="flex-shrink-0 ring-1 ring-white/12"
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-white">
                        {comment.userHandle}
                    </span>
                    <span className="text-xs text-[#D1E4FF]">
                        {formatTime(comment.createdAt)}
                    </span>
                </div>
                <p className="text-sm text-white mb-2">
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
                            className="text-[11px] font-medium text-[#D1E4FF] hover:text-white"
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
                        className={`text-xs text-white disabled:opacity-50 ${isReplyingTo ? 'font-semibold' : 'font-medium'}`}
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
                        className="flex items-center gap-1 text-[#D1E4FF] disabled:opacity-50 disabled:pointer-events-none"
                        aria-pressed={liked}
                        aria-label={liked ? 'Unlike comment' : 'Like comment'}
                    >
                        <FiThumbsUp className={`w-4 h-4 ${liked ? 'text-white' : ''}`} />
                        <span className="text-xs">{likes}</span>
                    </button>
                </div>

                {/* Replies Section (Scenes-style: View replies toggle + indented thread) */}
                {hasReplies && (
                    <div className="mt-2 ml-2">
                        <button
                            onClick={() => setShowReplies(!showReplies)}
                            className="flex items-center gap-1 text-xs text-[#D1E4FF]"
                        >
                            {showReplies ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                            {showReplies
                                ? `Hide replies (${replyCount})`
                                : `View replies (${replyCount})`}
                        </button>

                        {showReplies && visibleReplies.length > 0 && (
                            <div className="mt-2 pl-4 border-l-2 border-white/12 bg-[rgba(15,36,48,0.45)] rounded-r-md py-2 space-y-3">
                                {visibleReplies.map(reply => (
                                    <div key={reply.id} className="flex gap-2">
                                        <Avatar
                                            src={sheetAvatarSrc(reply.userHandle, reply.avatarUrl, user)}
                                            name={reply.userHandle?.split('@')[0] || 'User'}
                                            size="sm"
                                            className="flex-shrink-0 ring-1 ring-white/12 w-6 h-6"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="font-semibold text-xs text-white">
                                                    {reply.userHandle}
                                                </span>
                                                <span className="text-xs text-[#D1E4FF]">
                                                    {formatTime(reply.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-white mb-1">
                                                {renderTextWithMentions(reply.text, (handle) => navigate(`/user/${encodeURIComponent(handle)}`))}
                                            </p>
                                            <button
                                                onClick={() => onLikeReply(comment.id, reply.id)}
                                                className="flex items-center gap-1 text-xs text-[#D1E4FF]"
                                            >
                                                <FiThumbsUp className={`w-3.5 h-3.5 ${reply.userLiked ? 'text-white' : ''}`} />
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
        <div>
            {replyingToHandle ? (
                <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
                    <p className="text-xs font-medium text-[#D1E4FF] truncate">Replying to {replyingToHandle}</p>
                    <button type="button" onClick={onCancelReply} className="p-1 text-white" aria-label="Cancel reply">
                        <FiX size={16} />
                    </button>
                </div>
            ) : null}
            {showEmojiPicker && (
                <div className="max-h-24 overflow-y-auto border-b border-white/12 px-2 py-2">
                    <div className="flex flex-wrap">
                    {COMMENT_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => setText((prev) => prev + emoji)}
                            className="m-0.5 flex h-8 w-8 items-center justify-center rounded-md text-lg"
                            aria-label={`Add ${emoji}`}
                        >
                            {emoji}
                        </button>
                    ))}
                    </div>
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-3 py-3">
                <Avatar
                    src={sheetAvatarSrc(user?.handle, user?.avatarUrl, user)}
                    name={user?.name || 'User'}
                    size="sm"
                    className="ring-1 ring-white/12"
                />
                <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className={`flex-shrink-0 rounded-lg p-2 ${showEmojiPicker ? 'bg-white/12 text-white' : 'text-[#D1E4FF]'}`}
                    aria-label="Add emoji"
                >
                    <FiSmile size={20} />
                </button>
                <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={placeholder}
                    className="min-w-0 flex-1 rounded-lg border border-white/12 bg-[rgba(6,13,22,0.72)] px-3 py-2 text-sm text-white placeholder:text-[#94A3B8] focus:outline-none"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={!text.trim() || isLoading}
                    className="rounded-xl bg-white p-2.5 text-[#03091B] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send comment"
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
        if (!isOpen) {
            setReplyingTo(null);
            return;
        }
        if (!postId || !canLoadComments) return;
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
            avatarUrl: user.avatarUrl,
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

        const original = comments.find(comment => comment.id === commentId);

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

            const updatedComment = await toggleCommentLike(commentId, original);
            setComments(prev => prev.map(comment =>
                comment.id === commentId ? updatedComment : comment
            ));
        } catch (error) {
            console.error('Failed to like comment:', error);
            if (original) {
                setComments(prev => prev.map(comment =>
                    comment.id === commentId ? original : comment
                ));
            }
        }
    };

    const handleLikeReply = async (parentCommentId: string, replyId: string) => {
        if (!user) return;

        const originalParent = comments.find(comment => comment.id === parentCommentId);

        setComments(prev => prev.map(comment => {
            if (comment.id !== parentCommentId || !comment.replies) return comment;
            return {
                ...comment,
                replies: comment.replies.map(reply => {
                    if (reply.id !== replyId) return reply;
                    const newLiked = !reply.userLiked;
                    return { ...reply, userLiked: newLiked, likes: (reply.likes || 0) + (newLiked ? 1 : -1) };
                }),
            };
        }));

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

            const updatedParentComment = await toggleReplyLike(parentCommentId, replyId, originalParent);
            setComments(prev => prev.map(comment =>
                comment.id === parentCommentId ? updatedParentComment : comment
            ));
        } catch (error) {
            console.error('Failed to like reply:', error);
            if (originalParent) {
                setComments(prev => prev.map(comment =>
                    comment.id === parentCommentId ? originalParent : comment
                ));
            }
        }
    };

    const handleReplyToComment = async (parentId: string, text: string): Promise<boolean> => {
        if (!user) return false;
        const moderation = evaluateCommentModeration(text, getCommentModerationPreferences());
        if (moderation.level !== 'none') {
            const shouldContinue = window.confirm(
                moderation.level === 'hide'
                    ? 'This reply may violate safety filters and will be hidden from others. Post anyway?'
                    : 'This reply looks potentially harmful. Post anyway?'
            );
            if (!shouldContinue) return false;
        }

        // Always show an optimistic reply immediately
        const optimisticReply: Comment = {
            id: `temp-reply-${Date.now()}`,
            postId,
            userHandle: user.handle || 'Anonymous',
            avatarUrl: user.avatarUrl,
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
                return true;
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
            return true;
        } catch (error) {
            console.error('Failed to add reply:', error);
            // Keep optimistic reply in UI — still treat as posted locally.
            return true;
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
    const previewUrl = post ? commentSheetPreviewUrl(post) : undefined;
    const commentAccess = resolveCommentComposerAccess(post, user);

    return createPortal(
        <div className="fixed inset-0 z-[230] flex items-end justify-center">
            <button
                type="button"
                className="absolute inset-0 bg-black/55"
                onClick={onClose}
                aria-label="Dismiss comments"
            />

            <div
                className="relative flex h-[78%] w-full max-w-[min(400px,calc(100vw-32px))] min-h-0 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/15 text-white shadow-xl"
                style={{ background: SHEET_GRADIENT }}
            >
                {post && (post.mediaUrl || authorHandle) ? (
                    <div className="flex flex-shrink-0 items-center gap-4 border-b border-white/12 px-4 pb-2 pt-3">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-[rgba(15,36,48,0.72)]">
                            {previewUrl ? (
                                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-[#121212]">
                                    <Avatar name={authorHandle.split('@')[0] || 'User'} size="md" />
                                </div>
                            )}
                        </div>
                        {authorHandle ? (
                            <p className="truncate text-sm font-semibold text-white">{authorHandle}</p>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex flex-shrink-0 items-center justify-between border-b border-white/12 px-4 py-3">
                    <h2 className="text-base font-semibold text-white">
                        {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                    </h2>
                    <div className="flex items-center">
                        <div className="flex items-center rounded-lg border border-white/12 p-0.5">
                            <button
                                type="button"
                                onClick={() => setSortMode('top')}
                                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${sortMode === 'top' ? 'bg-[rgba(15,36,48,0.72)] text-white' : 'text-[#D1E4FF]'}`}
                            >
                                Top
                            </button>
                            <button
                                type="button"
                                onClick={() => setSortMode('newest')}
                                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${sortMode === 'newest' ? 'bg-[rgba(15,36,48,0.72)] text-white' : 'text-[#D1E4FF]'}`}
                            >
                                Newest
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="ml-2 p-1 text-white"
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
                            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 border-b border-white/12 px-4 pb-3 pt-4">
                                <Avatar
                                    src={sheetAvatarSrc(authorHandle, post?.avatarUrl, user)}
                                    name={authorHandle.split('@')[0] || 'User'}
                                    size="md"
                                    className="flex-shrink-0 ring-1 ring-white/12"
                                />
                                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                                    {authorHandle || 'Unknown'}
                                </p>
                                {showFollow && (
                                    <button
                                        type="button"
                                        onClick={handleFollowAuthor}
                                        disabled={followBusy}
                                        className={`flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${
                                            post?.isFollowing
                                                ? 'border border-white/12 bg-white/12'
                                                : 'bg-[rgba(15,36,48,0.72)]'
                                        }`}
                                    >
                                        {post?.isFollowing ? 'Following' : 'Follow'}
                                    </button>
                                )}
                            </div>

                            {storyText ? (
                                <div className="border-b border-white/12 px-4 py-3">
                                    <p className="whitespace-pre-wrap text-sm leading-5 text-white">
                                        {renderTextWithMentions(storyText, (handle) => navigate(`/user/${encodeURIComponent(handle)}`))}
                                    </p>
                                    {post?.createdAt != null && (
                                        <p className="mt-2 text-xs text-[#D1E4FF]">
                                            {formatPostRelative(post.createdAt)}
                                        </p>
                                    )}
                                </div>
                            ) : null}

                            <div className="p-4">
                                {filteredComments.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <FiMessageSquare size={48} className="mx-auto mb-4 text-[#D1E4FF] opacity-50" />
                                        <p className="text-[15px] font-semibold text-white">No comments yet</p>
                                        <p className="mt-2 text-sm text-[#94A3B8]">Be the first to comment!</p>
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
                                                    className="w-full min-h-[40px] rounded-lg border border-white/12 bg-[rgba(15,36,48,0.72)] text-sm font-semibold text-white disabled:opacity-60"
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

                <div className="flex-shrink-0 border-t border-white/12 bg-[rgba(6,13,22,0.92)]">
                    {commentAccess.canComment ? (
                    <CommentInput
                        placeholder={replyingTo ? 'Write a reply...' : 'Join the conversation...'}
                        onSubmit={async (text) => {
                            if (replyingTo) {
                                setSubmittingReply(true);
                                try {
                                    const ok = await handleReplyToComment(replyingTo.id, text);
                                    if (ok) setReplyingTo(null);
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
                    ) : (
                        <div className="mx-4 mb-2 mt-3 rounded-[14px] bg-white/[0.06] px-4 py-3.5 text-center text-sm font-semibold text-[#8B949E]">
                            {commentAccess.message}
                        </div>
                    )}
                </div>

                {!online && (
                    <div className="border-t border-amber-400/30 bg-amber-500/15 px-4 py-2 text-xs text-amber-100">
                        You're offline. Comments will sync when back online.
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
