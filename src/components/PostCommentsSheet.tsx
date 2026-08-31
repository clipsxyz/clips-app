import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    TextInput,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Keyboard,
    Platform,
    type ListRenderItem,
    type NativeSyntheticEvent,
    type NativeScrollEvent,
} from 'react-native';
import {
    BottomSheetFlatList,
    BottomSheetFooter,
    BottomSheetTextInput,
    type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import GazetteerBottomSheetModal, {
    GAZETTEER_SHEET_PASSPORT,
} from './GazetteerBottomSheetModal.native';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Avatar from './Avatar';
import FeedChevronIcon from './FeedChevronIcon.native';
import FeedCloseIcon from './FeedCloseIcon.native';
import FeedLikeThumbsIcon from './FeedLikeThumbsIcon.native';
import FeedMessageSquareIcon from './FeedMessageSquareIcon.native';
import FeedSendIcon from './FeedSendIcon.native';
import FeedSmileIcon from './FeedSmileIcon.native';
import { resolveAvatarDimensions } from './avatarProps';
import { getAvatarForHandle } from '../api/users';
import { isVideoPost } from '../utils/effectiveTextPostStyleNative';
import {
    addComment,
    addReply,
    deleteCommentById,
    fetchCommentsPage,
    getPostById,
    isFrontendOnlyPostId,
    setCommentModerationState,
    toggleCommentLike,
    toggleFollowForPost,
    toggleReplyLike,
} from '../api/posts';
import { useAuth } from '../context/Auth';
import { evaluateCommentModeration, getCommentModerationPreferences } from '../utils/commentModeration';
import type { Post, Comment } from '../types';

const COMMENT_EMOJIS = [
    '😀', '😃', '😄', '😊', '🥰', '😍', '🤩', '😘', '😂', '🤣', '😅', '🙂', '😉', '😎', '🤔',
    '👍', '👏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🔥', '✨', '🙌', '🙏',
];
const HANDLE_REGEX = /\b[A-Za-z0-9._-]+@[A-Za-z0-9_-]+\b/g;
const SHEET_HEIGHT = Math.min(Dimensions.get('window').height * 0.58, 520);
const BRAND_600 = PASSPORT_PALETTE.wavePrimary;
const COMMENT_LIKE_ACTIVE = '#FFFFFF';
const MENTION_COLOR = '#9fd4cb';
/** View Profile night-atlas chrome. */
const P = {
    text: '#e8eef2',
    muted: 'rgba(232, 238, 242, 0.62)',
    border: 'rgba(255,255,255,0.12)',
    chipBg: 'rgba(15, 36, 48, 0.72)',
    inputBg: 'rgba(6, 13, 22, 0.72)',
    handle: 'rgba(255,255,255,0.28)',
};

type Props = {
    postId: string;
    post?: Post | null;
    isOpen: boolean;
    onClose: () => void;
    commentAuthorHandle: string;
    currentUserHandle?: string;
    onAfterClose?: () => void;
    /** Called whenever the visible comment count changes so feed/profile cards stay in sync. */
    onCommentCountChange?: (comments: number) => void;
    /** `scenesEmbed` — no Modal; parent positions sheet (Scenes viewer). */
    variant?: 'modal' | 'scenesEmbed';
};

function formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
}

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

function renderTextWithMentions(
    text: string,
    onHandlePress: (handle: string) => void,
    textStyle?: object,
): React.ReactNode {
    const safeText = text || '';
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    HANDLE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = HANDLE_REGEX.exec(safeText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > cursor) {
            nodes.push(safeText.slice(cursor, start));
        }
        const handle = match[0];
        nodes.push(
            <Text
                key={`h-${key++}`}
                style={styles.mentionText}
                onPress={() => onHandlePress(handle)}
            >
                {handle}
            </Text>,
        );
        cursor = end;
    }
    if (cursor < safeText.length) nodes.push(safeText.slice(cursor));
    return <Text style={textStyle}>{nodes}</Text>;
}

/** Web Avatar ring-1 ring-gray-200 on comment thread avatars. */
function CommentAvatarRing({
    size,
    children,
    gap = 12,
}: {
    size: number | 'sm' | 'md' | 'lg' | 'xl';
    children: React.ReactNode;
    gap?: number;
}) {
    const { dim } = resolveAvatarDimensions(size);
    return (
        <View
            style={[
                styles.avatarRing,
                styles.avatarCol,
                {
                    width: dim + 2,
                    height: dim + 2,
                    borderRadius: (dim + 2) / 2,
                    marginRight: gap,
                },
            ]}
        >
            {children}
        </View>
    );
}

function CommentItem({
    comment,
    viewerHandle,
    isPostOwner,
    onLikeComment,
    onLikeReply,
    onStartReply,
    onModerateComment,
    onMentionPress,
    isReplyingTo,
}: {
    comment: Comment;
    viewerHandle: string;
    isPostOwner: boolean;
    onLikeComment: (commentId: string) => Promise<void>;
    onLikeReply: (parentCommentId: string, replyId: string) => Promise<void>;
    onStartReply: (commentId: string, handle: string) => void;
    onModerateComment: (commentId: string, action: 'hide' | 'unhide' | 'delete') => Promise<void>;
    onMentionPress: (handle: string) => void;
    isReplyingTo?: boolean;
}) {
    const { user } = useAuth();
    const [liked, setLiked] = useState(comment.userLiked);
    const [likes, setLikes] = useState(comment.likes ?? 0);
    const [busy, setBusy] = useState(false);
    const [showReplies, setShowReplies] = useState(false);

    useEffect(() => {
        setLiked(comment.userLiked);
        setLikes(comment.likes ?? 0);
    }, [comment.userLiked, comment.likes]);

    const normalizedViewer = viewerHandle.trim().toLowerCase();
    const isCommentAuthor =
        String(comment.userHandle || '').trim().toLowerCase() === normalizedViewer;
    const isHiddenForViewer = comment.moderationState === 'hidden_by_filter' && !isCommentAuthor;
    const replyCount = comment.replyCount || 0;
    const hasReplies = replyCount > 0;
    const visibleReplies = (comment.replies || []).filter((reply) => {
        if (reply.moderationState !== 'hidden_by_filter') return true;
        return String(reply.userHandle || '').trim().toLowerCase() === normalizedViewer;
    });

    const avatarSrc =
        comment.userHandle === user?.handle
            ? user?.avatarUrl || getAvatarForHandle(comment.userHandle)
            : getAvatarForHandle(comment.userHandle);

    return (
        <View style={styles.commentItem}>
            <CommentAvatarRing size="sm">
                <Avatar
                    src={avatarSrc}
                    name={comment.userHandle?.split('@')[0] || 'User'}
                    size="sm"
                />
            </CommentAvatarRing>
            <View style={styles.commentContent}>
                <View style={styles.commentHeaderRow}>
                    <Text style={styles.commentUser}>{comment.userHandle}</Text>
                    <Text style={styles.commentTime}>{formatTime(comment.createdAt)}</Text>
                </View>
                {isHiddenForViewer ? (
                    <Text style={styles.commentText}>Comment hidden for safety.</Text>
                ) : (
                    renderTextWithMentions(comment.text || '', onMentionPress, styles.commentText)
                )}
                {comment.moderationState === 'hidden_by_filter' && isCommentAuthor ? (
                    <Text style={styles.hiddenFromOthersNote}>Hidden from others by safety filter</Text>
                ) : null}
                {isPostOwner ? (
                    <View style={styles.moderationActionsRow}>
                        <TouchableOpacity
                            onPress={() =>
                                onModerateComment(
                                    comment.id,
                                    comment.moderationState === 'hidden_by_filter' ? 'unhide' : 'hide',
                                )
                            }
                        >
                            <Text style={styles.moderationActionText}>
                                {comment.moderationState === 'hidden_by_filter' ? 'Unhide' : 'Hide'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onModerateComment(comment.id, 'delete')}>
                            <Text style={[styles.moderationDeleteText, styles.moderationDeleteSpacing]}>
                                Delete
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
                <View style={styles.commentActionsRow}>
                    <TouchableOpacity
                        disabled={isHiddenForViewer}
                        onPress={() => onStartReply(comment.id, comment.userHandle || '')}
                    >
                        <Text
                            style={[
                                styles.commentReplyText,
                                isReplyingTo && styles.commentReplyTextActive,
                            ]}
                        >
                            {isReplyingTo ? 'Replying…' : 'Reply'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={busy || isHiddenForViewer}
                        style={styles.commentLikeRow}
                        onPress={async () => {
                            if (busy) return;
                            setBusy(true);
                            const nextLiked = !liked;
                            setLiked(nextLiked);
                            setLikes((prev) => prev + (nextLiked ? 1 : -1));
                            try {
                                await onLikeComment(comment.id);
                            } catch {
                                setLiked(comment.userLiked);
                                setLikes(comment.likes ?? 0);
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        <FeedLikeThumbsIcon
                            size={16}
                            filled={liked}
                            color={liked ? COMMENT_LIKE_ACTIVE : P.muted}
                        />
                        <Text style={styles.commentLikeCount}>{likes}</Text>
                    </TouchableOpacity>
                </View>

                {hasReplies ? (
                    <View style={styles.repliesToggleWrap}>
                        <TouchableOpacity
                            style={styles.repliesToggleButton}
                            onPress={() => setShowReplies((v) => !v)}
                        >
                            <FeedChevronIcon direction={showReplies ? 'up' : 'down'} size={14} />
                            <Text style={styles.repliesToggleText}>
                                {showReplies
                                    ? `Hide replies (${replyCount})`
                                    : `View replies (${replyCount})`}
                            </Text>
                        </TouchableOpacity>
                        {showReplies && visibleReplies.length > 0 ? (
                            <View style={styles.replyList}>
                                {visibleReplies.map((reply) => {
                                    const replyAvatarSrc =
                                        reply.userHandle === user?.handle
                                            ? user?.avatarUrl || getAvatarForHandle(reply.userHandle)
                                            : getAvatarForHandle(reply.userHandle);
                                    return (
                                        <View key={reply.id} style={styles.replyItem}>
                                            <CommentAvatarRing size={24} gap={8}>
                                                <Avatar
                                                    src={replyAvatarSrc}
                                                    name={reply.userHandle?.split('@')[0] || 'User'}
                                                    size={24}
                                                />
                                            </CommentAvatarRing>
                                            <View style={styles.replyContent}>
                                                <View style={styles.replyHeaderRow}>
                                                    <Text style={styles.replyUser}>{reply.userHandle}</Text>
                                                    <Text style={styles.replyTime}>
                                                        {formatTime(reply.createdAt)}
                                                    </Text>
                                                </View>
                                                {renderTextWithMentions(
                                                    reply.text || '',
                                                    onMentionPress,
                                                    styles.replyText,
                                                )}
                                                <TouchableOpacity
                                                    style={styles.replyLikeRow}
                                                    onPress={() => onLikeReply(comment.id, reply.id)}
                                                >
                                                    <FeedLikeThumbsIcon
                                                        size={14}
                                                        filled={Boolean(reply.userLiked)}
                                                        color={reply.userLiked ? COMMENT_LIKE_ACTIVE : P.muted}
                                                    />
                                                    <Text style={styles.replyLikeCount}>{reply.likes ?? 0}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </View>
        </View>
    );
}

function CommentInput({
    placeholder,
    onSubmit,
    isLoading,
    replyingToHandle,
    onCancelReply,
    useSheetTextInput = false,
    autoFocus = false,
}: {
    placeholder: string;
    onSubmit: (text: string) => void;
    isLoading: boolean;
    replyingToHandle?: string | null;
    onCancelReply?: () => void;
    useSheetTextInput?: boolean;
    autoFocus?: boolean;
}) {
    const { user } = useAuth();
    const [text, setText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (!replyingToHandle) return;
        setText('');
        const t = setTimeout(() => inputRef.current?.focus(), 80);
        return () => clearTimeout(t);
    }, [replyingToHandle]);

    useEffect(() => {
        if (!autoFocus) return;
        const t = setTimeout(() => inputRef.current?.focus(), 80);
        return () => clearTimeout(t);
    }, [autoFocus]);

    const handleSubmit = () => {
        if (!text.trim() || isLoading) return;
        onSubmit(text.trim());
        setText('');
    };

    const InputComponent = useSheetTextInput ? BottomSheetTextInput : TextInput;

    return (
        <View style={styles.commentInputShell}>
            {replyingToHandle ? (
                <View style={styles.replyingBanner}>
                    <Text style={styles.replyingBannerText} numberOfLines={1}>
                        Replying to {replyingToHandle}
                    </Text>
                    <TouchableOpacity onPress={onCancelReply} hitSlop={8} accessibilityLabel="Cancel reply">
                        <FeedCloseIcon size={16} color={P.muted} />
                    </TouchableOpacity>
                </View>
            ) : null}
            {showEmojiPicker ? (
                <View style={styles.emojiPickerWrap}>
                    <View style={styles.emojiPickerGrid}>
                        {COMMENT_EMOJIS.map((emoji) => (
                            <TouchableOpacity
                                key={emoji}
                                style={styles.emojiButton}
                                onPress={() => setText((prev) => prev + emoji)}
                            >
                                <Text style={styles.emojiButtonText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ) : null}
            <View style={styles.commentInputRow}>
                <CommentAvatarRing size="sm" gap={8}>
                    <Avatar src={user?.avatarUrl} name={user?.name || 'User'} size="sm" />
                </CommentAvatarRing>
                <TouchableOpacity
                    style={[styles.emojiToggle, showEmojiPicker && styles.emojiToggleActive]}
                    onPress={() => setShowEmojiPicker((v) => !v)}
                >
                    <FeedSmileIcon
                        size={20}
                        color={showEmojiPicker ? P.text : P.muted}
                    />
                </TouchableOpacity>
                <View style={styles.commentInputGradientWrap}>
                    <InputComponent
                        ref={inputRef as any}
                        style={styles.commentInput}
                        placeholder={placeholder}
                        placeholderTextColor={P.muted}
                        value={text}
                        onChangeText={setText}
                        editable={!isLoading}
                        returnKeyType="send"
                        onSubmitEditing={handleSubmit}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.sendButton, (!text.trim() || isLoading) && styles.sendButtonDisabled]}
                    disabled={!text.trim() || isLoading}
                    onPress={handleSubmit}
                >
                    <FeedSendIcon size={16} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function PostCommentsSheet({
    postId,
    post: postProp,
    isOpen,
    onClose,
    commentAuthorHandle,
    currentUserHandle,
    onAfterClose,
    onCommentCountChange,
    variant = 'modal',
}: Props) {
    const isScenesEmbed = variant === 'scenesEmbed';
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const insetsBottomRef = useRef(insets.bottom);
    insetsBottomRef.current = insets.bottom;
    const listRef = useRef<FlatList<Comment> | null>(null);

    const [post, setPost] = useState<Post | null>(postProp ?? null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
    const [commentsHasMore, setCommentsHasMore] = useState(false);
    const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [followBusy, setFollowBusy] = useState(false);
    const [sortMode, setSortMode] = useState<'top' | 'newest'>('top');
    const [replyingTo, setReplyingTo] = useState<{ id: string; handle: string } | null>(null);
    const [submittingReply, setSubmittingReply] = useState(false);

    const viewerHandle = String(currentUserHandle || user?.handle || commentAuthorHandle || '').trim();
    const normalizedViewerHandle = viewerHandle.toLowerCase();
    const postIdStr = String(postId || '');
    // Mock / collection snapshot ids can load without a Laravel user id.
    // Real backend post ids require an authenticated user before fetching comments.
    const canLoadComments =
        Boolean(postIdStr) && (isFrontendOnlyPostId(postIdStr) || Boolean(user?.id));
    const postPropRef = useRef(postProp);
    postPropRef.current = postProp;
    const loadGenRef = useRef(0);
    const onCommentCountChangeRef = useRef(onCommentCountChange);
    onCommentCountChangeRef.current = onCommentCountChange;

    const emitCommentCount = useCallback((next: number, mode: 'max' | 'set' = 'max') => {
        const n = Math.max(0, Math.floor(Number(next) || 0));
        setPost((prev) => {
            if (!prev) return prev;
            const comments = mode === 'set' ? n : Math.max(prev.stats.comments || 0, n);
            return { ...prev, stats: { ...prev.stats, comments } };
        });
        onCommentCountChangeRef.current?.(n);
    }, []);

    const onMentionPress = useCallback(
        (handle: string) => {
            navigation.navigate('ViewProfile', { handle: encodeURIComponent(handle) });
        },
        [navigation],
    );

    useEffect(() => {
        if (!isOpen) {
            setSortMode('top');
            return;
        }
        if (!postId || !canLoadComments) {
            // Still show the snapshot header when auth isn't ready / signed out.
            setPost(postPropRef.current ?? null);
            setComments([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        const req = ++loadGenRef.current;
        setComments([]);
        (async () => {
            setLoading(true);
            setPost(postPropRef.current ?? null);
            setCommentsCursor(null);
            setCommentsHasMore(false);
            setCommentsLoadingMore(false);
            try {
                const [fetchedPost, fetchedPage] = await Promise.all([
                    getPostById(postId, user?.id),
                    fetchCommentsPage(postId, null, 30, 5, user?.id),
                ]);
                if (cancelled || req !== loadGenRef.current) return;
                setPost(fetchedPost ?? postPropRef.current ?? null);
                setComments((prev) => {
                    const temps = prev.filter((c) => String(c.id).startsWith('temp-'));
                    const seen = new Set(fetchedPage.items.map((c) => String(c.id)));
                    const merged = [...fetchedPage.items];
                    for (const t of temps) {
                        if (!seen.has(String(t.id))) merged.push(t);
                    }
                    return merged;
                });
                setCommentsCursor(fetchedPage.nextCursor);
                setCommentsHasMore(fetchedPage.hasMore);
                const apiCount = Number(fetchedPost?.stats?.comments);
                const listCount = fetchedPage.items.length;
                emitCommentCount(
                    Number.isFinite(apiCount) ? Math.max(apiCount, listCount) : listCount,
                );
            } catch (err) {
                console.error('Failed to load comments sheet:', err);
                if (!cancelled && req === loadGenRef.current) {
                    setPost(postPropRef.current ?? null);
                }
            } finally {
                if (!cancelled && req === loadGenRef.current) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, postId, canLoadComments, user?.id, emitCommentCount]);

    const sortedComments = useMemo(() => {
        const next = [...comments];
        if (sortMode === 'newest') {
            next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return next;
        }
        next.sort((a, b) => {
            const likesDelta = (b.likes || 0) - (a.likes || 0);
            if (likesDelta !== 0) return likesDelta;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        return next;
    }, [comments, sortMode]);

    const authorHandle = post?.userHandle ?? '';
    const storyText = (post?.caption || post?.text || '').trim();
    const isPostOwner =
        Boolean(viewerHandle && authorHandle) &&
        String(authorHandle).trim().toLowerCase() === normalizedViewerHandle;
    const showFollow = Boolean(viewerHandle && authorHandle && viewerHandle !== authorHandle);

    const handleLoadMoreComments = useCallback(async () => {
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
        } catch (err) {
            console.error('Failed to load more comments:', err);
        } finally {
            setCommentsLoadingMore(false);
        }
    }, [commentsCursor, commentsHasMore, commentsLoadingMore, postId, user?.id]);

    const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (loading || commentsLoadingMore || !commentsHasMore || !commentsCursor) return;
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const remaining = contentSize.height - layoutMeasurement.height - contentOffset.y;
            if (remaining <= 180) {
                void handleLoadMoreComments();
            }
        },
        [commentsCursor, commentsHasMore, commentsLoadingMore, handleLoadMoreComments, loading],
    );

    const confirmModerationPost = (level: 'warn' | 'hide'): Promise<boolean> =>
        new Promise((resolve) => {
            Alert.alert(
                'Post comment?',
                level === 'hide'
                    ? 'This comment may violate safety filters and will be hidden from others. Post anyway?'
                    : 'This comment looks potentially harmful. Post anyway?',
                [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Post', onPress: () => resolve(true) },
                ],
            );
        });

    const handleAddComment = async (text: string) => {
        const handle = String(commentAuthorHandle || user?.handle || currentUserHandle || viewerHandle || '').trim();
        if (!handle) {
            Alert.alert('Sign in required', 'You need a profile handle to comment.');
            return;
        }
        const moderation = evaluateCommentModeration(text, getCommentModerationPreferences());
        if (moderation.level !== 'none') {
            const ok = await confirmModerationPost(moderation.level);
            if (!ok) return;
        }

        const optimisticComment: Comment = {
            id: `temp-${Date.now()}`,
            postId,
            userHandle: handle,
            text,
            createdAt: Date.now(),
            likes: 0,
            userLiked: false,
            moderationState: moderation.level === 'hide' ? 'hidden_by_filter' : 'visible',
            moderationReason: moderation.matched[0],
        };
        setComments((prev) => [...prev, optimisticComment]);
        const prevCount = post?.stats.comments ?? 0;
        emitCommentCount(prevCount + 1, 'set');
        setSubmitting(true);
        try {
            const newComment = await addComment(postId, handle, text);
            setComments((prev) => prev.map((c) => (c.id === optimisticComment.id ? newComment : c)));
            emitCommentCount(prevCount + 1, 'max');
        } catch (err) {
            console.error('Failed to add comment:', err);
            setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
            emitCommentCount(prevCount, 'set');
            Alert.alert('Error', 'Failed to add comment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLikeComment = async (commentId: string) => {
        setComments((prev) =>
            prev.map((comment) => {
                if (comment.id !== commentId) return comment;
                const nextLiked = !comment.userLiked;
                return {
                    ...comment,
                    userLiked: nextLiked,
                    likes: (comment.likes || 0) + (nextLiked ? 1 : -1),
                };
            }),
        );
        try {
            const updated = await toggleCommentLike(commentId);
            setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
        } catch (err) {
            console.error('Failed to like comment:', err);
        }
    };

    const handleLikeReply = async (parentCommentId: string, replyId: string) => {
        try {
            const updatedParent = await toggleReplyLike(parentCommentId, replyId);
            setComments((prev) => prev.map((c) => (c.id === parentCommentId ? updatedParent : c)));
        } catch (err) {
            console.error('Failed to like reply:', err);
        }
    };

    const handleReplyToComment = async (parentId: string, text: string): Promise<boolean> => {
        const handle = String(commentAuthorHandle || user?.handle || '').trim();
        if (!handle) {
            Alert.alert('Sign in required', 'You need a profile handle to reply.');
            return false;
        }
        const moderation = evaluateCommentModeration(text, getCommentModerationPreferences());
        if (moderation.level !== 'none') {
            const ok = await confirmModerationPost(moderation.level);
            if (!ok) return false;
        }

        const optimisticReply: Comment = {
            id: `temp-reply-${Date.now()}`,
            postId,
            userHandle: handle,
            text,
            createdAt: Date.now(),
            likes: 0,
            userLiked: false,
            parentId,
            moderationState: moderation.level === 'hide' ? 'hidden_by_filter' : 'visible',
            moderationReason: moderation.matched[0],
        };
        setComments((prev) =>
            prev.map((comment) => {
                if (comment.id !== parentId) return comment;
                return {
                    ...comment,
                    replies: [...(comment.replies || []), optimisticReply],
                    replyCount: (comment.replyCount || 0) + 1,
                };
            }),
        );

        try {
            const newReply = await addReply(postId, parentId, handle, text);
            setComments((prev) =>
                prev.map((comment) => {
                    if (comment.id !== parentId) return comment;
                    return {
                        ...comment,
                        replies: (comment.replies || []).map((r) =>
                            r.id === optimisticReply.id ? newReply : r,
                        ),
                    };
                }),
            );
            emitCommentCount((post?.stats.comments ?? 0) + 1, 'max');
            return true;
        } catch (err) {
            console.error('Failed to add reply:', err);
            throw err;
        }
    };

    const handleModerateComment = async (commentId: string, action: 'hide' | 'unhide' | 'delete') => {
        if (!isPostOwner) return;
        if (action === 'delete') {
            const ok = await deleteCommentById(commentId);
            if (!ok) return;
            setComments((prev) =>
                prev
                    .filter((comment) => comment.id !== commentId)
                    .map((comment) => ({
                        ...comment,
                        replies: (comment.replies || []).filter((reply) => reply.id !== commentId),
                        replyCount: (comment.replies || []).filter((reply) => reply.id !== commentId).length,
                    })),
            );
            return;
        }
        const nextState = action === 'hide' ? 'hidden_by_filter' : 'visible';
        const ok = await setCommentModerationState(commentId, nextState, 'creator_moderation');
        if (!ok) {
            Alert.alert('Could not update comment', 'The server did not save that change. Try again.');
            return;
        }
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
                                  moderationReason:
                                      nextState === 'hidden_by_filter' ? 'creator_moderation' : undefined,
                              }
                            : reply,
                    ),
                };
            }),
        );
    };

    const handleFollowAuthor = async () => {
        if (!user?.id || !post || user.handle === post.userHandle) return;
        setFollowBusy(true);
        try {
            const updated = await toggleFollowForPost(user.id, postId, post.userHandle, user.handle, post.isFollowing === true);
            setPost((prev) => (prev ? { ...prev, isFollowing: updated.isFollowing } : null));
        } catch (err) {
            console.error('Follow toggle failed:', err);
        } finally {
            setFollowBusy(false);
        }
    };

    const handleClose = () => {
        setReplyingTo(null);
        onAfterClose?.();
        onClose();
    };

    useEffect(() => {
        if (!isOpen) setReplyingTo(null);
    }, [isOpen]);

    const scrollReplyIntoView = useCallback(
        (commentId: string) => {
            const index = sortedComments.findIndex((c) => String(c.id) === String(commentId));
            if (index < 0) return;
            try {
                listRef.current?.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.2,
                    viewOffset: 24,
                });
            } catch {
                /* layout may not be ready yet */
            }
        },
        [sortedComments],
    );

    const startReply = useCallback(
        (commentId: string, handle: string) => {
            setReplyingTo({ id: commentId, handle });
            scrollReplyIntoView(commentId);
        },
        [scrollReplyIntoView],
    );

    const cancelReply = useCallback(() => {
        setReplyingTo(null);
    }, []);

    const handleComposerSubmit = useCallback(
        async (text: string) => {
            if (replyingTo) {
                setSubmittingReply(true);
                try {
                    const ok = await handleReplyToComment(replyingTo.id, text);
                    if (ok) setReplyingTo(null);
                } catch {
                    Alert.alert('Error', 'Failed to add reply');
                } finally {
                    setSubmittingReply(false);
                }
                return;
            }
            await handleAddComment(text);
        },
        [replyingTo, handleReplyToComment, handleAddComment],
    );

    const renderComment: ListRenderItem<Comment> = ({ item }) => (
        <CommentItem
            comment={item}
            viewerHandle={viewerHandle}
            isPostOwner={isPostOwner}
            onLikeComment={handleLikeComment}
            onLikeReply={handleLikeReply}
            onStartReply={startReply}
            onModerateComment={handleModerateComment}
            onMentionPress={onMentionPress}
            isReplyingTo={replyingTo?.id === item.id}
        />
    );

    const listHeader = loading ? null : (
        <>
            <View style={styles.authorRow}>
                <CommentAvatarRing size="md">
                    <Avatar
                        src={authorHandle ? getAvatarForHandle(authorHandle) : undefined}
                        name={authorHandle.split('@')[0] || 'User'}
                        size="md"
                    />
                </CommentAvatarRing>
                <Text style={styles.authorHandle} numberOfLines={1}>
                    {authorHandle || 'Unknown'}
                </Text>
                {showFollow ? (
                    <TouchableOpacity
                        style={[styles.followButton, post?.isFollowing && styles.followButtonFollowing]}
                        disabled={followBusy}
                        onPress={handleFollowAuthor}
                    >
                        <Text
                            style={[
                                styles.followButtonText,
                                post?.isFollowing && styles.followButtonTextFollowing,
                            ]}
                        >
                            {post?.isFollowing ? 'Following' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            {storyText ? (
                <View style={styles.captionBlock}>
                    {renderTextWithMentions(storyText, onMentionPress, styles.captionText)}
                    {post?.createdAt != null ? (
                        <Text style={styles.captionTime}>{formatPostRelative(post.createdAt)}</Text>
                    ) : null}
                </View>
            ) : null}
        </>
    );

    const sheetTitleBar = (
        <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </Text>
            <View style={styles.modalHeaderRight}>
                <View style={styles.commentSortToggle}>
                    <TouchableOpacity
                        onPress={() => setSortMode('top')}
                        style={[styles.commentSortButton, sortMode === 'top' && styles.commentSortButtonActive]}
                    >
                        <Text
                            style={[
                                styles.commentSortButtonText,
                                sortMode === 'top' && styles.commentSortButtonTextActive,
                            ]}
                        >
                            Top
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setSortMode('newest')}
                        style={[
                            styles.commentSortButton,
                            sortMode === 'newest' && styles.commentSortButtonActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.commentSortButtonText,
                                sortMode === 'newest' && styles.commentSortButtonTextActive,
                            ]}
                        >
                            Newest
                        </Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <FeedCloseIcon size={20} color={P.muted} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const sheetMediaPreview =
        post && (post.mediaUrl || isVideoPost(post) || authorHandle) ? (
            <View style={styles.mediaPreviewRow}>
                <View style={styles.mediaPreviewThumb}>
                    {(() => {
                        const postAny = post as {
                            posterUrl?: string;
                            thumbnailUrl?: string;
                            avatarUrl?: string;
                            author?: { avatarUrl?: string };
                        };
                        const mediaPosters = (post.mediaItems || []).flatMap((item) => {
                            const slide = item as {
                                posterUrl?: string;
                                thumbnailUrl?: string;
                                url?: string;
                                type?: string;
                            };
                            return [
                                slide.posterUrl,
                                slide.thumbnailUrl,
                                slide.type === 'image' ? slide.url : undefined,
                            ];
                        });
                        const previewUri = [
                            postAny.posterUrl,
                            post.videoPosterUrl,
                            postAny.thumbnailUrl,
                            ...mediaPosters,
                            !isVideoPost(post) ? post.mediaUrl : undefined,
                            postAny.author?.avatarUrl,
                            postAny.avatarUrl,
                            authorHandle ? getAvatarForHandle(authorHandle) : undefined,
                        ].find(
                            (u): u is string => typeof u === 'string' && u.trim().length > 0,
                        );

                        if (previewUri) {
                            return (
                                <Image
                                    source={{ uri: previewUri }}
                                    style={styles.mediaPreviewMedia}
                                    resizeMode="cover"
                                />
                            );
                        }

                        return (
                            <View style={styles.mediaPreviewAvatarFallback}>
                                <Avatar
                                    src={undefined}
                                    name={authorHandle.split('@')[0] || 'User'}
                                    size="md"
                                />
                            </View>
                        );
                    })()}
                </View>
                {authorHandle ? (
                    <Text style={styles.mediaPreviewHandle} numberOfLines={1}>
                        {authorHandle}
                    </Text>
                ) : null}
            </View>
        ) : null;

    const sheetChromeHeader = (
        <>
            {sheetMediaPreview}
            {sheetTitleBar}
            {listHeader}
        </>
    );

    const renderCommentsFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props} bottomInset={insetsBottomRef.current}>
                {/* Solid footer — animated Passport canvas remounts on keyboard resize and steals focus. */}
                <View style={styles.footerSolid}>
                    <CommentInput
                        placeholder={
                            replyingTo ? 'Write a reply...' : 'Join the conversation...'
                        }
                        onSubmit={(text) => {
                            void handleComposerSubmit(text);
                        }}
                        isLoading={submitting || submittingReply}
                        replyingToHandle={replyingTo?.handle}
                        onCancelReply={cancelReply}
                        useSheetTextInput
                        autoFocus={Boolean(replyingTo)}
                    />
                </View>
            </BottomSheetFooter>
        ),
        [cancelReply, handleComposerSubmit, replyingTo, submitting, submittingReply],
    );

    const commentsListProps = {
        ref: listRef,
        style: styles.commentsList,
        data: sortedComments,
        keyExtractor: (item: Comment) => item.id,
        renderItem: renderComment,
        ListHeaderComponent: sheetChromeHeader,
        ListEmptyComponent: (
            <View style={styles.emptyState}>
                <FeedMessageSquareIcon size={48} color={P.muted} opacity={0.5} />
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.emptySubtitle}>Be the first to comment!</Text>
            </View>
        ),
        ListFooterComponent: commentsHasMore ? (
            <TouchableOpacity
                style={styles.loadMoreButton}
                disabled={commentsLoadingMore}
                onPress={handleLoadMoreComments}
            >
                <Text style={styles.loadMoreText}>
                    {commentsLoadingMore ? 'Loading...' : 'Load more comments'}
                </Text>
            </TouchableOpacity>
        ) : null,
        contentContainerStyle: styles.commentsListContent,
        onScroll: handleScroll,
        scrollEventThrottle: 16 as const,
        keyboardShouldPersistTaps: 'handled' as const,
        keyboardDismissMode: 'on-drag' as const,
        automaticallyAdjustKeyboardInsets: false,
        onScrollToIndexFailed: (info: { index: number }) => {
            setTimeout(() => {
                listRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.15,
                    viewOffset: 24,
                });
            }, 160);
        },
    };

    const sheetBody = (
        <PassportSheetCanvas style={[styles.sheetCanvas, styles.sheetBodyFill]} contentStyle={styles.sheetBodyFill}>
            <View style={[styles.sheet, styles.sheetBodyFill]}>
                {/* Pin chrome outside FlatList so Android Modal height quirks can't blank the sheet. */}
                {sheetMediaPreview}
                {sheetTitleBar}
                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={BRAND_600} />
                    </View>
                ) : (
                    <FlatList {...commentsListProps} ListHeaderComponent={listHeader} />
                )}
                <View style={styles.footerSolid}>
                    <CommentInput
                        placeholder={replyingTo ? 'Write a reply...' : 'Join the conversation...'}
                        onSubmit={(text) => {
                            void handleComposerSubmit(text);
                        }}
                        isLoading={submitting || submittingReply}
                        replyingToHandle={replyingTo?.handle}
                        onCancelReply={cancelReply}
                        autoFocus={Boolean(replyingTo)}
                    />
                </View>
            </View>
        </PassportSheetCanvas>
    );

    if (isScenesEmbed) {
        if (!isOpen) return null;
        // Android: rely on adjustResize / Modal resize only. KAV `height` was
        // fighting the soft keyboard and collapsing the list (blank sheet) or
        // bouncing focus (keyboard pop then drop).
        if (Platform.OS === 'android') {
            return <View style={styles.scenesEmbedRoot}>{sheetBody}</View>;
        }
        return (
            <KeyboardAvoidingView
                style={styles.scenesEmbedRoot}
                behavior="padding"
                keyboardVerticalOffset={12}
            >
                {sheetBody}
            </KeyboardAvoidingView>
        );
    }

    return (
        <GazetteerBottomSheetModal
            visible={isOpen}
            onDismiss={handleClose}
            snapPoints={['75%']}
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_PASSPORT.background}
            handleIndicatorStyle={GAZETTEER_SHEET_PASSPORT.handle}
            footerComponent={renderCommentsFooter}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
        >
            <PassportSheetCanvas style={styles.sheetCanvas} contentStyle={styles.sheetCanvasContent}>
                <BottomSheetFlatList
                    {...((loading
                        ? {
                              data: [] as Comment[],
                              renderItem: () => null,
                              ListHeaderComponent: (
                                  <>
                                      {sheetChromeHeader}
                                      <View style={styles.loadingWrap}>
                                          <ActivityIndicator size="large" color={BRAND_600} />
                                      </View>
                                  </>
                              ),
                          }
                        : {
                              data: commentsListProps.data,
                              keyExtractor: commentsListProps.keyExtractor,
                              renderItem: commentsListProps.renderItem,
                              ListHeaderComponent: commentsListProps.ListHeaderComponent,
                              ListEmptyComponent: commentsListProps.ListEmptyComponent,
                              ListFooterComponent: commentsListProps.ListFooterComponent,
                              contentContainerStyle: commentsListProps.contentContainerStyle,
                              onScroll: commentsListProps.onScroll,
                              scrollEventThrottle: commentsListProps.scrollEventThrottle,
                              keyboardShouldPersistTaps: commentsListProps.keyboardShouldPersistTaps,
                              keyboardDismissMode: commentsListProps.keyboardDismissMode,
                              automaticallyAdjustKeyboardInsets: true,
                          }) as any)}
                    style={[styles.commentsList, styles.sheet]}
                />
            </PassportSheetCanvas>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    scenesEmbedRoot: {
        flex: 1,
    },
    sheetCanvas: {
        flex: 1,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    sheetCanvasContent: {
        flex: 1,
    },
    embedSolidBg: {
        backgroundColor: '#060d16',
    },
    footerCanvasContent: {
        backgroundColor: 'transparent',
    },
    footerSolid: {
        // Keep composer on a stable strip so keyboard resize doesn't remount the ambient canvas.
        backgroundColor: 'rgba(6, 13, 22, 0.92)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: P.border,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
        backgroundColor: 'transparent',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    sheetBodyFill: {
        flex: 1,
        minHeight: 240,
    },
    mediaPreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: P.border,
    },
    mediaPreviewThumb: {
        width: 56,
        height: 56,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: P.chipBg,
        marginRight: 12,
    },
    mediaPreviewMedia: {
        width: '100%',
        height: '100%',
    },
    mediaPreviewPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#121212',
    },
    mediaPreviewAvatarFallback: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
    mediaPreviewHandle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: P.text,
    },
    dragHandleRow: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 2,
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 999,
        backgroundColor: P.handle,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: P.border,
    },
    modalHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: P.text,
    },
    commentSortToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: P.border,
        borderRadius: 8,
        padding: 2,
    },
    commentSortButton: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    commentSortButtonActive: {
        backgroundColor: P.chipBg,
    },
    commentSortButtonText: {
        fontSize: 12,
        color: P.muted,
        fontWeight: '600',
    },
    commentSortButtonTextActive: {
        color: P.text,
    },
    closeButton: {
        padding: 4,
        marginLeft: 8,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentsListContent: {
        padding: 16,
        flexGrow: 1,
    },
    commentsList: {
        flex: 1,
    },
    avatarRing: {
        borderWidth: 1,
        borderColor: P.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarCol: {
        flexShrink: 0,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 12,
        marginBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: P.border,
    },
    authorHandle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: P.text,
    },
    followButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: P.chipBg,
    },
    followButtonFollowing: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: P.border,
    },
    followButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: P.text,
    },
    followButtonTextFollowing: {
        color: P.text,
    },
    captionBlock: {
        paddingBottom: 12,
        marginBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: P.border,
    },
    captionText: {
        fontSize: 14,
        color: P.text,
        lineHeight: 20,
    },
    captionTime: {
        fontSize: 12,
        color: P.muted,
        marginTop: 8,
    },
    mentionText: {
        color: MENTION_COLOR,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyTitle: {
        fontSize: 15,
        color: P.muted,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: P.muted,
        marginTop: 8,
    },
    loadMoreButton: {
        minHeight: 40,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: P.border,
        backgroundColor: P.chipBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    loadMoreText: {
        fontSize: 14,
        color: P.muted,
    },
    commentItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    commentContent: {
        flex: 1,
        minWidth: 0,
    },
    commentHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 2,
    },
    commentUser: {
        fontSize: 14,
        fontWeight: '600',
        color: P.text,
        marginRight: 8,
    },
    commentTime: {
        fontSize: 12,
        color: P.muted,
    },
    commentText: {
        fontSize: 14,
        color: P.text,
        marginBottom: 8,
    },
    hiddenFromOthersNote: {
        fontSize: 11,
        color: '#B45309',
        marginBottom: 8,
    },
    moderationActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    moderationActionText: {
        fontSize: 11,
        color: P.muted,
        fontWeight: '500',
    },
    moderationDeleteText: {
        fontSize: 11,
        color: '#DC2626',
        fontWeight: '500',
    },
    moderationDeleteSpacing: {
        marginLeft: 12,
    },
    commentActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    commentReplyText: {
        fontSize: 12,
        color: P.muted,
        fontWeight: '500',
    },
    commentReplyTextActive: {
        color: BRAND_600,
        fontWeight: '600',
    },
    replyingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 2,
        gap: 8,
    },
    replyingBannerText: {
        flex: 1,
        fontSize: 12,
        color: P.muted,
        fontWeight: '500',
    },
    commentLikeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    commentLikeCount: {
        fontSize: 12,
        color: P.muted,
        marginLeft: 4,
    },
    inlineReplyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    inlineReplyInput: {
        flex: 1,
        backgroundColor: P.inputBg,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: P.text,
        fontSize: 14,
    },
    inlineReplySendButton: {
        padding: 6,
        marginLeft: 8,
    },
    repliesToggleWrap: {
        marginTop: 8,
        marginLeft: 8,
    },
    repliesToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    repliesToggleText: {
        fontSize: 12,
        color: P.muted,
        marginLeft: 4,
    },
    replyList: {
        marginTop: 8,
        paddingLeft: 16,
        borderLeftWidth: 2,
        borderLeftColor: P.border,
        backgroundColor: 'rgba(15, 36, 48, 0.45)',
        borderTopRightRadius: 6,
        borderBottomRightRadius: 6,
        paddingVertical: 8,
    },
    replyItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    replyContent: {
        flex: 1,
        minWidth: 0,
    },
    replyHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 2,
    },
    replyUser: {
        fontSize: 12,
        fontWeight: '600',
        color: P.text,
        marginRight: 6,
    },
    replyTime: {
        fontSize: 12,
        color: P.muted,
    },
    replyText: {
        fontSize: 12,
        color: P.text,
        marginBottom: 4,
    },
    replyLikeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    replyLikeCount: {
        fontSize: 12,
        color: P.muted,
        marginLeft: 4,
    },
    commentInputShell: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: P.border,
        backgroundColor: 'rgba(6, 13, 22, 0.55)',
    },
    emojiPickerWrap: {
        maxHeight: 96,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: P.border,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    emojiPickerGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    emojiButton: {
        width: 32,
        height: 32,
        margin: 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    emojiButtonText: {
        fontSize: 18,
    },
    commentInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    emojiToggle: {
        padding: 8,
        borderRadius: 8,
        marginRight: 8,
    },
    emojiToggleActive: {
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    commentInputGradientWrap: {
        flex: 1,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: P.border,
        backgroundColor: P.inputBg,
        marginRight: 8,
    },
    commentInput: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: P.text,
        fontSize: 14,
    },
    sendButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: BRAND_600,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});
