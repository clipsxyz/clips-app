import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    TextInput,
    Alert,
    Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar';
import { timeAgo } from '../utils/timeAgo';
import {
    addComment,
    fetchComments,
    toggleCommentLike,
    toggleReplyLike,
    addReply,
    deleteCommentById,
    setCommentModerationState,
} from '../api/posts';
import type { Post, Comment } from '../types';

type Props = {
    postId: string;
    post?: Post | null;
    isOpen: boolean;
    onClose: () => void;
    /** Display handle for new comments/replies (API expects handle, not numeric user id). */
    commentAuthorHandle: string;
    currentUserHandle?: string;
    /** Optional: refresh parent post (e.g. comment counts) after close. */
    onAfterClose?: () => void;
};

export default function PostCommentsSheet({
    postId,
    post,
    isOpen,
    onClose,
    commentAuthorHandle,
    currentUserHandle,
    onAfterClose,
}: Props) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
    const [replyInputText, setReplyInputText] = useState('');
    const [sortMode, setSortMode] = useState<'top' | 'newest'>('top');
    const normalizedViewerHandle = String(currentUserHandle || '').trim().toLowerCase();
    const isPostOwner =
        Boolean(post?.userHandle) &&
        String(post?.userHandle || '').trim().toLowerCase() === normalizedViewerHandle;

    useEffect(() => {
        if (isOpen && postId) {
            loadComments();
        }
    }, [isOpen, postId]);

    useEffect(() => {
        if (!isOpen) {
            setCommentText('');
            setReplyingToCommentId(null);
            setReplyInputText('');
            setSortMode('top');
        }
    }, [isOpen, postId]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const fetchedComments = await fetchComments(postId);
            setComments(fetchedComments);
        } catch (err) {
            console.error('Error loading comments:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        const handle = String(commentAuthorHandle || '').trim();
        if (!handle) {
            Alert.alert('Sign in required', 'You need a profile handle to comment.');
            return;
        }
        try {
            const newComment = await addComment(postId, handle, commentText);
            setComments(prev => [...prev, newComment]);
            setCommentText('');
        } catch (err) {
            console.error('Error adding comment:', err);
            Alert.alert('Error', 'Failed to add comment');
        }
    };

    const handleToggleCommentLike = async (commentId: string) => {
        try {
            setComments(prev =>
                prev.map(c => {
                    if (c.id !== commentId) return c;
                    const nextLiked = !c.userLiked;
                    const nextLikes = (c.likes || 0) + (nextLiked ? 1 : -1);
                    return { ...c, userLiked: nextLiked, likes: nextLikes };
                })
            );
            const updated = await toggleCommentLike(commentId);
            setComments(prev => prev.map(c => (c.id === commentId ? updated : c)));
        } catch (err) {
            console.error('Error toggling comment like:', err);
        }
    };

    const handleToggleReplyLike = async (parentCommentId: string, replyId: string) => {
        try {
            const updatedParent = await toggleReplyLike(parentCommentId, replyId);
            setComments(prev => prev.map(c => (c.id === parentCommentId ? updatedParent : c)));
        } catch (err) {
            console.error('Error toggling reply like:', err);
        }
    };

    const handleAddReply = async (parentId: string, text: string) => {
        if (!text.trim()) return;
        const handle = String(commentAuthorHandle || '').trim();
        if (!handle) {
            Alert.alert('Sign in required', 'You need a profile handle to reply.');
            return;
        }
        try {
            const newReply = await addReply(postId, parentId, handle, text.trim());
            setComments(prev =>
                prev.map(c => {
                    if (c.id !== parentId) return c;
                    const existingReplies = c.replies || [];
                    return {
                        ...c,
                        replies: [...existingReplies, newReply],
                        replyCount: (c.replyCount || existingReplies.length) + 1,
                    };
                })
            );
            setReplyInputText('');
            setReplyingToCommentId(null);
        } catch (err) {
            console.error('Error adding reply:', err);
            Alert.alert('Error', 'Failed to add reply');
        }
    };

    const handleModerateComment = async (commentId: string, action: 'hide' | 'unhide' | 'delete') => {
        if (!isPostOwner) return;
        if (action === 'delete') {
            const ok = await deleteCommentById(commentId);
            if (!ok) return;
            setComments(prev =>
                prev
                    .filter(comment => comment.id !== commentId)
                    .map(comment => ({
                        ...comment,
                        replies: (comment.replies || []).filter(reply => reply.id !== commentId),
                        replyCount: (comment.replies || []).filter(reply => reply.id !== commentId).length,
                    }))
            );
            return;
        }

        const nextState = action === 'hide' ? 'hidden_by_filter' : 'visible';
        const ok = await setCommentModerationState(commentId, nextState, 'creator_moderation');
        if (!ok) return;
        setComments(prev =>
            prev.map(comment => {
                if (comment.id === commentId) {
                    return {
                        ...comment,
                        moderationState: nextState,
                        moderationReason: nextState === 'hidden_by_filter' ? 'creator_moderation' : undefined,
                    };
                }
                return {
                    ...comment,
                    replies: (comment.replies || []).map(reply =>
                        reply.id === commentId
                            ? {
                                  ...reply,
                                  moderationState: nextState,
                                  moderationReason:
                                      nextState === 'hidden_by_filter' ? 'creator_moderation' : undefined,
                              }
                            : reply
                    ),
                };
            })
        );
    };

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

    const handleClose = () => {
        onAfterClose?.();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={handleClose}>
            <View style={styles.modalOverlay}>
                {post?.mediaUrl ? (
                    <View style={styles.commentsMiniPreviewWrap}>
                        <Image
                            source={{ uri: post.mediaUrl }}
                            style={styles.commentsMiniPreviewImage}
                            resizeMode="cover"
                        />
                    </View>
                ) : null}
                <View style={styles.modalContent}>
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
                            <TouchableOpacity onPress={handleClose}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="small" color="#8B5CF6" style={styles.modalLoading} />
                    ) : (
                        <FlatList
                            data={sortedComments}
                            keyExtractor={item => item.id}
                            style={styles.commentsList}
                            renderItem={({ item }) => (
                                <View style={styles.commentItem}>
                                    <Avatar src={undefined} name={item.userHandle.split('@')[0]} size={32} />
                                    <View style={styles.commentContent}>
                                        <View style={styles.commentHeaderRow}>
                                            <Text style={styles.commentUser}>{item.userHandle}</Text>
                                            <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
                                        </View>
                                        <Text style={styles.commentText}>
                                            {item.moderationState === 'hidden_by_filter' &&
                                            String(item.userHandle || '').trim().toLowerCase() !== normalizedViewerHandle
                                                ? 'Comment hidden for safety.'
                                                : item.text}
                                        </Text>
                                        {isPostOwner && (
                                            <View style={styles.moderationActionsRow}>
                                                <TouchableOpacity
                                                    onPress={() =>
                                                        handleModerateComment(
                                                            item.id,
                                                            item.moderationState === 'hidden_by_filter'
                                                                ? 'unhide'
                                                                : 'hide'
                                                        )
                                                    }
                                                >
                                                    <Text style={styles.moderationActionText}>
                                                        {item.moderationState === 'hidden_by_filter'
                                                            ? 'Unhide'
                                                            : 'Hide'}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => handleModerateComment(item.id, 'delete')}
                                                >
                                                    <Text style={styles.moderationDeleteText}>Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        <View style={styles.commentActionsRow}>
                                            <TouchableOpacity
                                                disabled={
                                                    item.moderationState === 'hidden_by_filter' &&
                                                    String(item.userHandle || '').trim().toLowerCase() !==
                                                        normalizedViewerHandle
                                                }
                                                onPress={() => {
                                                    setReplyingToCommentId(
                                                        replyingToCommentId === item.id ? null : item.id
                                                    );
                                                    setReplyInputText('');
                                                }}
                                            >
                                                <Text style={styles.commentReplyText}>
                                                    {replyingToCommentId === item.id ? 'Cancel reply' : 'Reply'}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.commentLikeRow}
                                                disabled={
                                                    item.moderationState === 'hidden_by_filter' &&
                                                    String(item.userHandle || '').trim().toLowerCase() !==
                                                        normalizedViewerHandle
                                                }
                                                onPress={() => handleToggleCommentLike(item.id)}
                                            >
                                                <Icon
                                                    name={item.userLiked ? 'heart' : 'heart-outline'}
                                                    size={16}
                                                    color={item.userLiked ? '#EF4444' : '#6B7280'}
                                                />
                                                <Text style={styles.commentLikeCount}>{item.likes ?? 0}</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {item.replies && item.replies.length > 0 && (
                                            <View style={styles.replyList}>
                                                {item.replies.map(reply => (
                                                    <View key={reply.id} style={styles.replyItem}>
                                                        <Avatar
                                                            src={undefined}
                                                            name={reply.userHandle.split('@')[0]}
                                                            size={24}
                                                        />
                                                        <View style={styles.replyContent}>
                                                            <View style={styles.replyHeaderRow}>
                                                                <Text style={styles.replyUser}>
                                                                    {reply.userHandle}
                                                                </Text>
                                                                <Text style={styles.replyTime}>
                                                                    {timeAgo(reply.createdAt)}
                                                                </Text>
                                                            </View>
                                                            <Text style={styles.replyText}>
                                                                {reply.moderationState === 'hidden_by_filter' &&
                                                                String(reply.userHandle || '').trim().toLowerCase() !==
                                                                    normalizedViewerHandle
                                                                    ? 'Comment hidden for safety.'
                                                                    : reply.text}
                                                            </Text>
                                                            {isPostOwner && (
                                                                <View style={styles.moderationActionsRow}>
                                                                    <TouchableOpacity
                                                                        onPress={() =>
                                                                            handleModerateComment(
                                                                                reply.id,
                                                                                reply.moderationState ===
                                                                                    'hidden_by_filter'
                                                                                    ? 'unhide'
                                                                                    : 'hide'
                                                                            )
                                                                        }
                                                                    >
                                                                        <Text style={styles.moderationActionText}>
                                                                            {reply.moderationState ===
                                                                            'hidden_by_filter'
                                                                                ? 'Unhide'
                                                                                : 'Hide'}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity
                                                                        onPress={() =>
                                                                            handleModerateComment(reply.id, 'delete')
                                                                        }
                                                                    >
                                                                        <Text style={styles.moderationDeleteText}>
                                                                            Delete
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                </View>
                                                            )}
                                                            <TouchableOpacity
                                                                style={styles.replyLikeRow}
                                                                disabled={
                                                                    reply.moderationState === 'hidden_by_filter' &&
                                                                    String(reply.userHandle || '')
                                                                        .trim()
                                                                        .toLowerCase() !== normalizedViewerHandle
                                                                }
                                                                onPress={() =>
                                                                    handleToggleReplyLike(item.id, reply.id)
                                                                }
                                                            >
                                                                <Icon
                                                                    name={
                                                                        reply.userLiked ? 'heart' : 'heart-outline'
                                                                    }
                                                                    size={14}
                                                                    color={reply.userLiked ? '#EF4444' : '#6B7280'}
                                                                />
                                                                <Text style={styles.replyLikeCount}>
                                                                    {reply.likes ?? 0}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {replyingToCommentId === item.id && (
                                            <View style={styles.inlineReplyContainer}>
                                                <TextInput
                                                    style={styles.inlineReplyInput}
                                                    placeholder="Write a reply..."
                                                    placeholderTextColor="#6B7280"
                                                    value={replyInputText}
                                                    onChangeText={setReplyInputText}
                                                    multiline
                                                />
                                                <TouchableOpacity
                                                    style={styles.inlineReplySendButton}
                                                    onPress={() => handleAddReply(item.id, replyInputText)}
                                                >
                                                    <Icon name="send" size={16} color="#8B5CF6" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        />
                    )}

                    <View style={styles.commentInputContainer}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Add a comment..."
                            placeholderTextColor="#6B7280"
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                        />
                        <TouchableOpacity onPress={handleAddComment} style={styles.sendButton}>
                            <Icon name="send" size={20} color="#8B5CF6" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    commentsMiniPreviewWrap: {
        alignSelf: 'center',
        width: Math.min(Dimensions.get('window').width * 0.56, 260),
        aspectRatio: 4 / 5,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#111827',
        marginBottom: 10,
    },
    commentsMiniPreviewImage: {
        width: '100%',
        height: '100%',
    },
    modalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '58%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    modalHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
    },
    commentSortToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111827',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
        padding: 2,
    },
    commentSortButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    commentSortButtonActive: {
        backgroundColor: '#8B5CF6',
    },
    commentSortButtonText: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    commentSortButtonTextActive: {
        color: '#FFFFFF',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalLoading: {
        padding: 20,
    },
    commentsList: {
        flex: 1,
        padding: 16,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
        columnGap: 12,
    },
    commentContent: {
        flex: 1,
        minHeight: 0,
    },
    commentHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'flex-start',
        columnGap: 8,
        marginBottom: 2,
    },
    commentUser: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    commentTime: {
        fontSize: 12,
        color: '#6B7280',
    },
    commentText: {
        fontSize: 14,
        color: '#D1D5DB',
        marginBottom: 8,
    },
    moderationActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 12,
        marginBottom: 8,
    },
    moderationActionText: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    moderationDeleteText: {
        fontSize: 11,
        color: '#F87171',
        fontWeight: '600',
    },
    commentActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    commentReplyText: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    commentLikeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
    },
    commentLikeCount: {
        fontSize: 12,
        color: '#D1D5DB',
    },
    replyList: {
        marginTop: 8,
        paddingLeft: 24,
        borderLeftWidth: 1,
        borderLeftColor: '#1F2937',
        rowGap: 8,
    },
    replyItem: {
        flexDirection: 'row',
        columnGap: 8,
    },
    replyContent: {
        flex: 1,
        minHeight: 0,
    },
    replyHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        columnGap: 6,
        marginBottom: 2,
    },
    replyUser: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    replyTime: {
        fontSize: 11,
        color: '#6B7280',
    },
    replyText: {
        fontSize: 13,
        color: '#E5E7EB',
        marginBottom: 4,
    },
    replyLikeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
    },
    replyLikeCount: {
        fontSize: 11,
        color: '#D1D5DB',
    },
    inlineReplyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
        marginTop: 8,
    },
    inlineReplyInput: {
        flex: 1,
        backgroundColor: '#111827',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: '#FFFFFF',
        fontSize: 13,
        maxHeight: 80,
    },
    inlineReplySendButton: {
        padding: 6,
    },
    commentInputContainer: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        alignItems: 'center',
        gap: 12,
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#1F2937',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 14,
        maxHeight: 100,
    },
    sendButton: {
        padding: 8,
    },
});
