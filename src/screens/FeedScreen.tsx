// @ts-nocheck
// @ts-ignore
/* eslint-disable */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    ScrollView,
    Modal,
    TextInput,
    Alert,
    Share,
    Linking,
    Pressable,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import {
    fetchPostsPage,
    toggleFollowForPost,
    toggleLike,
    incrementViews,
    toggleBookmark,
    reclipPost,
    setReclipState,
    addComment,
    fetchComments,
    incrementShares,
    toggleCommentLike,
    toggleReplyLike,
    addReply,
    deleteCommentById,
    setCommentModerationState,
} from '../api/posts';
import { userHasUnviewedStoriesByHandle, userHasStoriesByHandle } from '../api/stories';
import { getUnreadTotal } from '../api/messages';
import { blockUser } from '../api/messages';
import { isUserBlocked } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import { enqueue, drain } from '../utils/mutationQueue';
import type { Post, Comment } from '../types';
import { getInstagramImageDimensions } from '../utils/imageDimensions';
import { FEED_UI } from '../constants/feedUiTokens';
import { Dimensions } from 'react-native';

type Tab = string;

function PillTabs({
    active,
    onChange,
    userRegional = 'Dublin',
    userNational = 'Ireland'
}: {
    active: Tab;
    onChange: (t: Tab) => void;
    userRegional?: string;
    userNational?: string;
}) {
    const mainFeedTabs: Tab[] = [userRegional, userNational, 'Following'];
    const activeMainFeedTab = mainFeedTabs.includes(active) ? active : null;
    const orderedMainFeedTabs = activeMainFeedTab
        ? [activeMainFeedTab, ...mainFeedTabs.filter((tab) => tab !== activeMainFeedTab)]
        : mainFeedTabs;
    const tabs: Tab[] = [...orderedMainFeedTabs, 'Clips', 'Discover'];

    return (
        <View style={styles.tabContainer}>
            <View style={styles.tabGrid}>
                {tabs.map(t => {
                    const isActive = active === t;
                    const isMainFeedTab = mainFeedTabs.includes(t);
                    return (
                        <TouchableOpacity
                            key={t}
                            onPress={() => onChange(t)}
                            style={[
                                styles.tabButton,
                                isActive ? styles.activeTabButton : styles.inactiveTabButton,
                            ]}
                        >
                            <View style={styles.tabLabelRow}>
                                {isActive && isMainFeedTab && (
                                    <Icon
                                        name={t === 'Following' ? 'person-add' : 'location'}
                                        size={12}
                                        color={t === 'Following' ? '#4ADE80' : t === userRegional ? '#7A8AF0' : '#F87171'}
                                        style={styles.activeMainFeedLocationIcon}
                                    />
                                )}
                                <Text
                                    style={[
                                        styles.tabText,
                                        isActive ? styles.activeTabText : styles.inactiveTabText,
                                    ]}
                                >
                                    {t}
                                </Text>
                                {isActive && !isMainFeedTab && (
                                    <Icon name="eye" size={15} color="#FFFFFF" style={styles.eyeIcon} />
                                )}
                            </View>
                            {isActive && isMainFeedTab && (
                                <View style={styles.activeMainFeedTailOuter}>
                                    <View style={styles.activeMainFeedTailInner} />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

function Avatar({
    src,
    name,
    size = 32,
    hasStory = false,
    onPress
}: {
    src?: string;
    name: string;
    size?: number;
    hasStory?: boolean;
    onPress?: () => void;
}) {
    const getInitials = (fullName: string): string => {
        const names = fullName.trim().split(' ');
        if (names.length === 1) {
            return names[0].charAt(0).toUpperCase();
        }
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    };

    const initials = getInitials(name);
    const Component = onPress ? TouchableOpacity : View;

    if (hasStory) {
        return (
            <Component onPress={onPress} style={styles.avatarContainer}>
                <LinearGradient
                    colors={['#a78bfa', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.storyBorder, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}
                >
                    <View style={[styles.avatarInner, { width: size, height: size }]}>
                        {src ? (
                            <Image source={{ uri: src }} style={styles.avatarImage} />
                        ) : (
                            <View style={[styles.avatarFallback, { width: size, height: size }]}>
                                <Text style={styles.avatarInitials}>{initials}</Text>
                            </View>
                        )}
                    </View>
                </LinearGradient>
            </Component>
        );
    }

    return (
        <Component onPress={onPress} style={styles.avatarContainer}>
            <View style={[styles.avatarInner, { width: size, height: size }]}>
                {src ? (
                    <Image source={{ uri: src }} style={styles.avatarImage} />
                ) : (
                    <View style={[styles.avatarFallback, { width: size, height: size }]}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                )}
            </View>
        </Component>
    );
}

function PostHeader({
    post,
    onFollow,
    isCurrentUser,
    onProfileMenuPress,
    onHasStoryChange,
}: {
    post: Post;
    onFollow?: () => Promise<void>;
    isCurrentUser: boolean;
    onProfileMenuPress?: () => void;
    onHasStoryChange?: (hasStory: boolean) => void;
}) {
    const [hasStory, setHasStory] = useState(false);
    const [showFollowCheck, setShowFollowCheck] = useState(post.isFollowing === true);

    useEffect(() => {
        async function checkStory() {
            try {
                // For profile quick-actions, we want "View stories" whenever the user has
                // any active 24h story (not only unviewed).
                const hasAnyActiveStory = await userHasStoriesByHandle(post.userHandle);
                setHasStory(hasAnyActiveStory);
                onHasStoryChange?.(hasAnyActiveStory);
            } catch (error) {
                console.error('Error checking story:', error);
            }
        }
        checkStory();
    }, [post.userHandle, isCurrentUser]);

    // Show the follow checkmark briefly after following, then hide it
    useEffect(() => {
        let timer: any;
        if (!isCurrentUser && onFollow && post.isFollowing) {
            setShowFollowCheck(true);
            timer = setTimeout(() => {
                setShowFollowCheck(false);
            }, 2500);
        } else {
            setShowFollowCheck(false);
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [post.isFollowing, isCurrentUser, onFollow]);

    return (
        <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
                <TouchableOpacity 
                    style={styles.avatarWrapper}
                    onPress={onProfileMenuPress}
                >
                    <Avatar
                        src={undefined}
                        name={post.userHandle.split('@')[0]}
                        size={32}
                        hasStory={hasStory}
                    />
                    {/* + icon overlay on profile picture */}
                    {!isCurrentUser && onFollow && (post.isFollowing === false || post.isFollowing === undefined) && (
                        <TouchableOpacity
                            onPress={onFollow}
                            style={styles.followPlusButton}
                        >
                            <Icon name="add" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                    {/* Checkmark when following */}
                    {!isCurrentUser && onFollow && post.isFollowing === true && showFollowCheck && (
                        <View style={styles.followCheckButton}>
                            <Icon name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.postHeaderInfo}
                    onPress={onProfileMenuPress}
                >
                    <Text style={styles.userHandle}>{post.userHandle}</Text>
                    {post.createdAt && (
                        <View style={styles.postMeta}>
                            <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
                            {(post.locationLabel || post.venue) && (
                                <Text style={styles.locationText}>
                                    {post.locationLabel}
                                    {post.venue ? ` · ${post.venue}` : ''}
                                </Text>
                            )}
                        </View>
                    )}
                </TouchableOpacity>
            </View>
            <View style={styles.postHeaderRight}>
                {post.locationLabel && (
                    <TouchableOpacity style={styles.locationButton}>
                        <Icon name="location" size={12} color="#8B5CF6" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

function CommentsModal({
    postId,
    post,
    isOpen,
    onClose,
    userId,
    currentUserHandle,
}: {
    postId: string;
    post?: Post | null;
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    currentUserHandle?: string;
}) {
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
        try {
            const newComment = await addComment(postId, userId, commentText);
            // Keep ordering consistent with Scenes-style comments: newest at the bottom.
            setComments(prev => [...prev, newComment]);
            setCommentText('');
        } catch (err) {
            console.error('Error adding comment:', err);
            Alert.alert('Error', 'Failed to add comment');
        }
    };

    const handleToggleCommentLike = async (commentId: string) => {
        try {
            // Optimistic update
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
        try {
            const newReply = await addReply(postId, parentId, userId, text.trim());
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
            setComments((prev) =>
                prev
                    .filter((comment) => comment.id !== commentId)
                    .map((comment) => ({
                        ...comment,
                        replies: (comment.replies || []).filter((reply) => reply.id !== commentId),
                        replyCount: (comment.replies || []).filter((reply) => reply.id !== commentId).length,
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

    if (!isOpen) return null;

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
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
                                    style={[
                                        styles.commentSortButton,
                                        sortMode === 'top' && styles.commentSortButtonActive,
                                    ]}
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
                            <TouchableOpacity onPress={onClose}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="small" color="#8B5CF6" style={styles.modalLoading} />
                    ) : (
                        <FlatList
                            data={sortedComments}
                            keyExtractor={(item) => item.id}
                            style={styles.commentsList}
                            renderItem={({ item }) => (
                                <View style={styles.commentItem}>
                                    <Avatar
                                        src={undefined}
                                        name={item.userHandle.split('@')[0]}
                                        size={32}
                                    />
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
                                                            item.moderationState === 'hidden_by_filter' ? 'unhide' : 'hide'
                                                        )
                                                    }
                                                >
                                                    <Text style={styles.moderationActionText}>
                                                        {item.moderationState === 'hidden_by_filter' ? 'Unhide' : 'Hide'}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleModerateComment(item.id, 'delete')}>
                                                    <Text style={styles.moderationDeleteText}>Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        <View style={styles.commentActionsRow}>
                                            <TouchableOpacity
                                                disabled={
                                                    item.moderationState === 'hidden_by_filter' &&
                                                    String(item.userHandle || '').trim().toLowerCase() !== normalizedViewerHandle
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
                                                    String(item.userHandle || '').trim().toLowerCase() !== normalizedViewerHandle
                                                }
                                                onPress={() => handleToggleCommentLike(item.id)}
                                            >
                                                <Icon
                                                    name={item.userLiked ? 'heart' : 'heart-outline'}
                                                    size={16}
                                                    color={item.userLiked ? '#EF4444' : '#6B7280'}
                                                />
                                                <Text style={styles.commentLikeCount}>
                                                    {item.likes ?? 0}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Replies list */}
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
                                                                String(reply.userHandle || '').trim().toLowerCase() !== normalizedViewerHandle
                                                                    ? 'Comment hidden for safety.'
                                                                    : reply.text}
                                                            </Text>
                                                            {isPostOwner && (
                                                                <View style={styles.moderationActionsRow}>
                                                                    <TouchableOpacity
                                                                        onPress={() =>
                                                                            handleModerateComment(
                                                                                reply.id,
                                                                                reply.moderationState === 'hidden_by_filter' ? 'unhide' : 'hide'
                                                                            )
                                                                        }
                                                                    >
                                                                        <Text style={styles.moderationActionText}>
                                                                            {reply.moderationState === 'hidden_by_filter' ? 'Unhide' : 'Hide'}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity onPress={() => handleModerateComment(reply.id, 'delete')}>
                                                                        <Text style={styles.moderationDeleteText}>Delete</Text>
                                                                    </TouchableOpacity>
                                                                </View>
                                                            )}
                                                            <TouchableOpacity
                                                                style={styles.replyLikeRow}
                                                                disabled={
                                                                    reply.moderationState === 'hidden_by_filter' &&
                                                                    String(reply.userHandle || '').trim().toLowerCase() !== normalizedViewerHandle
                                                                }
                                                                onPress={() =>
                                                                    handleToggleReplyLike(item.id, reply.id)
                                                                }
                                                            >
                                                                <Icon
                                                                    name={
                                                                        reply.userLiked
                                                                            ? 'heart'
                                                                            : 'heart-outline'
                                                                    }
                                                                    size={14}
                                                                    color={
                                                                        reply.userLiked
                                                                            ? '#EF4444'
                                                                            : '#6B7280'
                                                                    }
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

                                        {/* Inline reply input (Scenes-style) */}
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

function ShareModal({
    post,
    isOpen,
    onClose,
}: {
    post: Post | null;
    isOpen: boolean;
    onClose: () => void;
}) {
    const handleShare = async () => {
        if (!post) return;
        try {
            await Share.share({
                message: post.text ? `${post.text} by ${post.userHandle}` : `Check out this post by ${post.userHandle}`,
                url: post.mediaUrl,
            });
        } catch (err: any) {
            console.error('Error sharing:', err);
        } finally {
            onClose();
        }
    };

    const handleCopyLink = async () => {
        if (!post) return;
        // In React Native, you'd use Clipboard API
        Alert.alert('Link copied', 'Post link copied to clipboard');
        onClose();
    };

    if (!isOpen || !post) return null;

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.shareModalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Share</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleShare} style={styles.shareOption}>
                        <Icon name="share-social" size={24} color="#FFFFFF" />
                        <Text style={styles.shareOptionText}>Share via...</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCopyLink} style={styles.shareOption}>
                        <Icon name="link" size={24} color="#FFFFFF" />
                        <Text style={styles.shareOptionText}>Copy Link</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// Memoized FeedCard for better performance - prevents unnecessary re-renders
const FeedCard = React.memo(function FeedCard({
    post,
    onLike,
    onFollow,
    onView,
    onComment,
    onShare,
    onReclip,
    onBookmark,
    onPostPress,
    onVisitProfile,
    onViewStories,
    onBlockUser,
    onReportUser,
    onNotificationsPress,
    unreadCount,
    hasInbox,
    isCurrentUser
}: {
    post: Post;
    onLike: () => Promise<void>;
    onFollow?: () => Promise<void>;
    onView: () => Promise<void>;
    onComment: () => void;
    onShare: () => Promise<void>;
    onReclip: () => Promise<void>;
    onBookmark: () => Promise<void>;
    onPostPress?: () => void;
    onVisitProfile?: () => void;
    onViewStories?: () => void;
    onBlockUser?: () => Promise<void>;
    onReportUser?: () => Promise<void>;
    onNotificationsPress?: () => void;
    unreadCount?: number;
    hasInbox?: boolean;
    isCurrentUser: boolean;
}) {
    const [imageDimensions, setImageDimensions] = React.useState<{ width: number; height: number } | null>(null);
    const [profileMenuVisible, setProfileMenuVisible] = React.useState(false);
    const [headerHasStory, setHeaderHasStory] = React.useState(false);
    const lastMediaTapRef = React.useRef(0);
    const singleMediaTapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const screenWidth = Dimensions.get('window').width;
    const DOUBLE_TAP_DELAY_MS = 260;

    // Auto-detect image dimensions if not provided
    React.useEffect(() => {
        if (post.mediaUrl && !imageDimensions) {
            Image.getSize(
                post.mediaUrl,
                (width, height) => {
                    // Calculate Instagram-style dimensions with clamping
                    const dimensions = getInstagramImageDimensions(width, height, screenWidth);
                    const minHeight = screenWidth * FEED_UI.media.minAspect;
                    const maxHeight = screenWidth * FEED_UI.media.maxAspect;
                    const portraitFirstHeight = Math.min(Math.max(dimensions.height, minHeight), maxHeight);
                    setImageDimensions({ width: dimensions.width, height: portraitFirstHeight });
                },
                (error) => {
                    console.error('Error getting image size:', error);
                    // Fallback to default dimensions
                    setImageDimensions({ width: screenWidth, height: screenWidth * FEED_UI.media.maxAspect });
                }
            );
        }
    }, [post.mediaUrl, screenWidth]);

    // Calculate image style with Instagram clamping
    const imageStyle = React.useMemo(() => {
        if (imageDimensions) {
            return {
                width: imageDimensions.width,
                height: imageDimensions.height,
                backgroundColor: '#111827',
            };
        }
        // Default while loading
        return {
            width: screenWidth,
            height: screenWidth * FEED_UI.media.maxAspect, // Default to max portrait aspect ratio
            backgroundColor: '#111827',
        };
    }, [imageDimensions, screenWidth]);

    const handleMediaPress = React.useCallback(() => {
        const now = Date.now();
        if (now - lastMediaTapRef.current <= DOUBLE_TAP_DELAY_MS) {
            if (singleMediaTapTimerRef.current) {
                clearTimeout(singleMediaTapTimerRef.current);
                singleMediaTapTimerRef.current = null;
            }
            lastMediaTapRef.current = 0;
            // Match web behavior: double tap should only like, not unlike.
            if (!post.userLiked) {
                onLike().catch((error) => console.error('Error in media double-tap like:', error));
            }
            return;
        }
        lastMediaTapRef.current = now;
        singleMediaTapTimerRef.current = setTimeout(() => {
            onPostPress?.();
            singleMediaTapTimerRef.current = null;
        }, DOUBLE_TAP_DELAY_MS + 20);
    }, [DOUBLE_TAP_DELAY_MS, onLike, onPostPress, post.userLiked]);

    React.useEffect(() => {
        return () => {
            if (singleMediaTapTimerRef.current) {
                clearTimeout(singleMediaTapTimerRef.current);
            }
        };
    }, []);

    return (
        <TouchableOpacity
            style={styles.feedCard}
            onPress={onPostPress}
            activeOpacity={0.95}
        >
            <PostHeader
                post={post}
                onFollow={onFollow}
                isCurrentUser={isCurrentUser}
                onProfileMenuPress={() => setProfileMenuVisible(true)}
                onHasStoryChange={setHeaderHasStory}
            />

            {post.isBoosted && (
                <View style={styles.sponsoredBadge}>
                    <Text style={styles.sponsoredText}>Sponsored</Text>
                    {post.boostFeedType && (
                        <Text style={styles.sponsoredFeedType}>· {post.boostFeedType} boost</Text>
                    )}
                </View>
            )}

            {post.mediaUrl && (
                <Pressable onPress={handleMediaPress}>
                    <Image
                        source={{ uri: post.mediaUrl }}
                        style={imageStyle}
                        onLoad={onView}
                        resizeMode="cover"
                    // Performance optimizations
                    // Note: React Native Image automatically caches and lazy loads
                    // Progressive rendering is handled by the platform
                    />
                </Pressable>
            )}

            {post.text && (
                <View style={styles.textCardWrapper}>
                    <View style={styles.textCard}>
                        <View style={styles.textCardDecorativeLine} />
                        <Text style={styles.textCardContent}>{post.text}</Text>
                        <View style={styles.textCardDecorativeLine} />
                    </View>
                    <View style={styles.textCardTail} />
                </View>
            )}

            <View style={styles.engagementBar}>
                <View style={styles.actionButtons}>
                    <TouchableOpacity onPress={onLike} style={styles.actionButton}>
                        <Icon
                            name={post.userLiked ? "heart" : "heart-outline"}
                            size={FEED_UI.icon.action}
                            color={post.userLiked ? "#EF4444" : "#6B7280"}
                        />
                        <Text style={styles.actionText}>{post.stats.likes}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onComment} style={styles.actionButton}>
                        <Icon name="chatbubble-outline" size={FEED_UI.icon.action} color="#6B7280" />
                        <Text style={styles.actionText}>{post.stats.comments}</Text>
                    </TouchableOpacity>

                    {!isCurrentUser && (
                        <TouchableOpacity onPress={onReclip} style={styles.actionButton}>
                            <Icon name="repeat" size={FEED_UI.icon.action} color={post.userReclipped ? "#8B5CF6" : "#6B7280"} />
                            <Text style={styles.actionText}>{post.stats.reclips}</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={onShare} style={styles.actionButton}>
                        <Icon name="share-outline" size={FEED_UI.icon.action} color="#6B7280" />
                    </TouchableOpacity>

                    <View style={styles.viewsContainer}>
                        <Icon name="eye-outline" size={16} color="#6B7280" />
                        <Text style={styles.actionText}>{post.stats.views}</Text>
                    </View>
                </View>

                <View style={styles.rightActions}>
                    {onNotificationsPress && (
                        <TouchableOpacity
                            onPress={onNotificationsPress}
                            style={styles.notificationButton}
                        >
                            <Icon
                                name="notifications"
                                size={FEED_UI.icon.action}
                                color={hasInbox ? "#3B82F6" : "#6B7280"}
                            />
                            {hasInbox && unreadCount && unreadCount > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.notificationBadgeText}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onBookmark}>
                        <Icon
                            name={post.isBookmarked ? "bookmark" : "bookmark-outline"}
                            size={FEED_UI.icon.action}
                            color={post.isBookmarked ? "#7A8AF0" : "#6B7280"}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Profile quick actions menu (Visit profile / Follow-Unfollow / View stories) */}
            {profileMenuVisible && (
                <View style={styles.profileMenuCard}>
                    <TouchableOpacity
                        style={styles.profileMenuItem}
                        onPress={() => {
                            setProfileMenuVisible(false);
                            onVisitProfile?.();
                        }}
                    >
                        <Icon name="person-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.profileMenuItemText}>Visit profile</Text>
                    </TouchableOpacity>

                    {!isCurrentUser && onFollow && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={async () => {
                                setProfileMenuVisible(false);
                                await onFollow();
                            }}
                        >
                            <Icon
                                name={post.isFollowing ? 'person-remove-outline' : 'person-add-outline'}
                                size={18}
                                color="#FFFFFF"
                            />
                            <Text style={styles.profileMenuItemText}>
                                {post.isFollowing ? 'Unfollow' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {onViewStories && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={() => {
                                setProfileMenuVisible(false);
                                onViewStories();
                            }}
                        >
                            <Icon name="play-circle-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.profileMenuItemText}>View stories</Text>
                        </TouchableOpacity>
                    )}
                    {!isCurrentUser && onBlockUser && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={async () => {
                                setProfileMenuVisible(false);
                                await onBlockUser();
                            }}
                        >
                            <Icon name="ban-outline" size={18} color="#FCA5A5" />
                            <Text style={[styles.profileMenuItemText, { color: '#FCA5A5' }]}>Block user</Text>
                        </TouchableOpacity>
                    )}
                    {!isCurrentUser && onReportUser && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={async () => {
                                setProfileMenuVisible(false);
                                await onReportUser();
                            }}
                        >
                            <Icon name="flag-outline" size={18} color="#FDE68A" />
                            <Text style={[styles.profileMenuItemText, { color: '#FDE68A' }]}>Report</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
});

function FeedScreen({ navigation, route }: { navigation?: any; route?: any }) {
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const defaultNational = user?.national || 'Ireland';
    const defaultRegional = user?.regional || 'Dublin';

    const [active, setActive] = useState<Tab>(defaultNational);
    const [pages, setPages] = useState<Post[][]>([]);
    const [cursor, setCursor] = useState<string | number | null>(0);
    const [loading, setLoading] = useState(false);
    const [end, setEnd] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showFollowingFeed, setShowFollowingFeed] = useState(false);
    const [commentsModalOpen, setCommentsModalOpen] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasInbox, setHasInbox] = useState(false);
    const [reloadTick, setReloadTick] = useState(0);
    const [showBoostPrompt, setShowBoostPrompt] = useState(false);
    const requestTokenRef = useRef(0);

    const currentFilter = showFollowingFeed ? 'discover' : active;

    // Helper to update a post in pages
    const updatePost = (postId: string, updater: (post: Post) => Post) => {
        setPages(prev => prev.map(page =>
            page.map(p => p.id === postId ? updater(p) : p)
        ));
    };

    const hideUserFromFeed = React.useCallback((handleToHide: string) => {
        const normalized = String(handleToHide || '').trim().toLowerCase();
        if (!normalized) return;
        setPages((prev) =>
            prev
                .map((page) => page.filter((p) => String(p.userHandle || '').trim().toLowerCase() !== normalized))
                .filter((page) => page.length > 0)
        );
        setSelectedPostForComments((prev) =>
            prev && String(prev.userHandle || '').trim().toLowerCase() === normalized ? null : prev
        );
        setSelectedPostForShare((prev) =>
            prev && String(prev.userHandle || '').trim().toLowerCase() === normalized ? null : prev
        );
    }, []);

    useEffect(() => {
        if (user?.national) {
            const oldTabs = ['Finglas', 'Dublin', 'Ireland'];
            if (oldTabs.includes(active)) {
                setActive(user.national);
            }
        }
    }, [user?.national, user?.regional, user?.local]);

    useEffect(() => {
        setPages([]);
        setCursor(0);
        setEnd(false);
        requestTokenRef.current++;
    }, [userId, currentFilter]);

    useEffect(() => {
        if (cursor !== null && pages.length === 0) {
            loadMore();
        }
    }, [cursor, currentFilter, reloadTick]);

    // Update unread count function
    const updateUnreadCount = React.useCallback(async () => {
        if (!user?.handle) return;
        try {
            const count = await getUnreadTotal(user.handle);
            setUnreadCount(count);
            setHasInbox(count > 0);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }, [user?.handle]);

    // Listen for unread messages count
    useEffect(() => {
        if (!user?.handle) return;

        // Initialize unread count
        updateUnreadCount();

        // Poll for updates every 10 seconds
        const interval = setInterval(updateUnreadCount, 10000);

        // Try to listen for events (works in React Native Web)
        const handleUnreadChanged = (event: any) => {
            const handle = event.detail?.handle;
            const unread = event.detail?.unread ?? 0;
            if (handle === user.handle) {
                setHasInbox(unread > 0);
                setUnreadCount(unread);
            }
        };

        // Only add listeners if window is available (React Native Web)
        if (typeof window !== 'undefined') {
            window.addEventListener('inboxUnreadChanged', handleUnreadChanged);
        }

        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('inboxUnreadChanged', handleUnreadChanged);
            }
        };
    }, [user?.handle, updateUnreadCount]);

    // Refresh unread count when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            // Always refresh feed when returning to this screen (e.g. after creating a post)
            // so newly created mock-mode posts appear immediately.
            setPages([]);
            setCursor(0);
            setEnd(false);
            setError(null);
            requestTokenRef.current++;
            setReloadTick(prev => prev + 1);
            updateUnreadCount();
        }, [updateUnreadCount])
    );

    useEffect(() => {
        if (!route?.params?.forceRefreshAt) return;
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
        requestTokenRef.current++;
        setReloadTick(prev => prev + 1);
    }, [route?.params?.forceRefreshAt]);

    async function loadMore() {
        if (loading || end || cursor === null) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const token = requestTokenRef.current;
            const page = await fetchPostsPage(
                currentFilter,
                cursor,
                5,
                userId,
                user?.local || '',
                user?.regional || '',
                user?.national || '',
                user?.handle || ''
            );

            if (token !== requestTokenRef.current) {
                return;
            }

            let visibleItems = page.items;
            if (user?.handle) {
                const checks = await Promise.all(
                    page.items.map(async (item) => {
                        const blocked = await isUserBlocked(user.handle, item.userHandle);
                        return { item, blocked };
                    })
                );
                visibleItems = checks.filter((row) => !row.blocked).map((row) => row.item);
            }

            if (visibleItems.length === 0) {
                setEnd(true);
            } else {
                setPages(prev => [...prev, visibleItems]);
                setCursor(page.nextCursor);
            }
        } catch (err) {
            console.error('Error loading feed:', err);
            setError('Failed to load feed');
        } finally {
            setLoading(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        setPages([]);
        setCursor(0);
        setEnd(false);
        requestTokenRef.current++;
        await loadMore();
        setRefreshing(false);
    };

    const handleTabChange = (tab: Tab) => {
        if (tab === 'Discover') {
            navigation.navigate('Discover');
            return;
        }
        if (tab === 'Clips') {
            navigation.navigate('Stories');
            return;
        }
        if (tab === 'Following') {
            setShowFollowingFeed(true);
            setActive('Following'); // Set active to Following so it's highlighted
        } else {
            setShowFollowingFeed(false);
            setActive(tab);
        }
    };

    const flat = pages.flat();

    // Memoize renderItem to prevent recreation on every render
    const renderItem = React.useCallback(({ item: post }: { item: Post }) => (
        <FeedCard
            post={post}
            onLike={async () => {
                const updated = await toggleLike(userId, post.id, post);
                // Update local state - find and update the post
                setPages(prev => prev.map(page =>
                    page.map(p => p.id === post.id ? updated : p)
                ));
            }}
            onFollow={async () => {
                if (!user) return;
                try {
                    // Use mock/local follow state as source of truth so it always works,
                    // even if the backend is offline or slow.
                    const updated = await toggleFollowForPost(userId, post.id, post.userHandle);
                    // Update the local feed state so Follow / Following changes immediately
                    setPages(prev =>
                        prev.map(page =>
                            page.map(p => (p.id === post.id ? updated : p))
                        )
                    );
                } catch (err) {
                    console.error('Error toggling follow in FeedScreen:', err);
                    // Fallback: optimistic toggle if something went wrong
                    setPages(prev =>
                        prev.map(page =>
                            page.map(p =>
                                p.id === post.id
                                    ? { ...p, isFollowing: !p.isFollowing }
                                    : p
                            )
                        )
                    );
                }
                // Refresh feed if viewing following feed
                if (showFollowingFeed || currentFilter.toLowerCase() === 'discover') {
                    setPages([]);
                    setCursor(0);
                    setEnd(false);
                    setError(null);
                    requestTokenRef.current++;
                    setTimeout(() => {
                        loadMore();
                    }, 200);
                }
            }}
            onView={async () => {
                await incrementViews(userId, post.id);
            }}
            onComment={() => {
                setSelectedPostId(post.id);
                setSelectedPostForComments(post);
                setCommentsModalOpen(true);
            }}
            onShare={async () => {
                setSelectedPostForShare(post);
                setShareModalOpen(true);
                try {
                    await incrementShares(userId, post.id);
                    updatePost(post.id, p => ({
                        ...p,
                        stats: { ...p.stats, shares: p.stats.shares + 1 }
                    }));
                } catch (err) {
                    console.error('Error sharing post:', err);
                }
            }}
            onReclip={async () => {
                if (!user || post.userHandle === user.handle) {
                    Alert.alert('Cannot reclip', 'You cannot reclip your own post');
                    return;
                }
                if (post.userReclipped) {
                    Alert.alert('Already reclipped', 'You have already reclipped this post');
                    return;
                }
                const newReclips = post.stats.reclips + 1;
                setReclipState(userId, post.id, true);
                updatePost(post.id, p => ({
                    ...p,
                    userReclipped: true,
                    stats: { ...p.stats, reclips: newReclips }
                }));
                try {
                    await reclipPost(userId, post.id, user.handle);
                } catch (err: any) {
                    console.warn('Reclip failed (UI already updated):', err);
                }
            }}
            onBookmark={async () => {
                try {
                    const updated = await toggleBookmark(userId, post.id);
                    updatePost(post.id, _p => updated);
                } catch (err) {
                    console.error('Error bookmarking post:', err);
                }
            }}
            onPostPress={() => navigation.navigate('PostDetail', { postId: post.id })}
            onVisitProfile={() => navigation.navigate('ViewProfile', { handle: post.userHandle })}
            onViewStories={() => navigation.navigate('Stories', { openUserHandle: post.userHandle })}
            onBlockUser={async () => {
                if (!user?.handle) return;
                Alert.alert('Block user?', `Hide ${post.userHandle} from your feed?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Block',
                        style: 'destructive',
                        onPress: async () => {
                            await blockUser(user.handle, post.userHandle);
                            hideUserFromFeed(post.userHandle);
                            Alert.alert('Blocked', `${post.userHandle} was blocked and removed from your feed.`);
                        },
                    },
                ]);
            }}
            onReportUser={async () => {
                Alert.alert('Reported', 'Thanks for reporting. We will review this content.');
            }}
            onNotificationsPress={() => navigation.navigate('Inbox')}
            unreadCount={unreadCount}
            hasInbox={hasInbox}
            isCurrentUser={user?.handle === post.userHandle}
        />
    ), [userId, user, showFollowingFeed, currentFilter, unreadCount, hasInbox, navigation, updatePost, loadMore]);

    return (
        <View style={styles.container}>
            <View style={styles.stickyTabsContainer}>
                <View style={styles.scrim} />
                <View style={styles.feedHeaderTopRow}>
                    <View style={styles.topHeaderRow}>
                        <Text style={styles.gazetteerText}>Gazetteer</Text>
                        <View style={styles.topHeaderActions}>
                            <TouchableOpacity style={[styles.headerMiniAction, styles.storiesHeaderAction]} onPress={() => navigation.navigate('Stories')}>
                                <Icon name="location" size={15} color="#D4AF37" />
                                <Text style={styles.storiesHeaderActionText}>Stories 24</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerMiniAction} onPress={() => navigation.navigate('CreateComposer', { addYours: true })}>
                                <Icon name="add-circle-outline" size={16} color="#F9FAFB" />
                                <Text style={styles.headerMiniActionText}>Add Yours</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.headerMiniAction, styles.boostHeaderAction]} onPress={() => setShowBoostPrompt(true)}>
                                <Icon name="flash" size={16} color="#111827" />
                                <Text style={[styles.headerMiniActionText, { color: '#111827' }]}>Boost</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                <PillTabs
                    active={showFollowingFeed ? 'Following' : active}
                    onChange={handleTabChange}
                    userRegional={defaultRegional}
                    userNational={defaultNational}
                />
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <FlatList
                data={flat}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                // Performance optimizations - Instagram-style
                initialNumToRender={3}              // Only render first 3 items on mount
                maxToRenderPerBatch={3}            // Render max 3 items per batch
                windowSize={5}                     // Keep ~5 screen heights of items in memory
                updateCellsBatchingPeriod={50}    // Batch updates every 50ms
                removeClippedSubviews={true}      // Remove off-screen views (test carefully)
                // Scroll performance
                scrollEventThrottle={16}           // Smooth scroll events (60fps)
                decelerationRate="fast"            // Faster deceleration for snappier feel
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                onEndReached={() => {
                    if (!loading && !end) {
                        loadMore();
                    }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#8B5CF6" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No posts found</Text>
                        </View>
                    ) : null
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedContent}
            />

            {/* Comments Modal */}
            <CommentsModal
                postId={selectedPostId || ''}
                post={selectedPostForComments}
                isOpen={commentsModalOpen}
                onClose={() => {
                    setCommentsModalOpen(false);
                    setSelectedPostId(null);
                    setSelectedPostForComments(null);
                }}
                userId={userId}
                currentUserHandle={user?.handle}
            />

            {/* Share Modal */}
            <ShareModal
                post={selectedPostForShare}
                isOpen={shareModalOpen}
                onClose={() => {
                    setShareModalOpen(false);
                    setSelectedPostForShare(null);
                }}
            />

            <Modal visible={showBoostPrompt} transparent animationType="fade" onRequestClose={() => setShowBoostPrompt(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.boostPromptCard}>
                        <Text style={styles.boostPromptTitle}>Boost your posts</Text>
                        <Text style={styles.boostPromptText}>Reach more people in local, regional, and national feeds.</Text>
                        <View style={styles.boostPromptActions}>
                            <TouchableOpacity style={styles.boostPromptSecondaryBtn} onPress={() => setShowBoostPrompt(false)}>
                                <Text style={styles.boostPromptSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.boostPromptPrimaryBtn}
                                onPress={() => {
                                    setShowBoostPrompt(false);
                                    navigation.navigate('Boost');
                                }}
                            >
                                <Text style={styles.boostPromptPrimaryText}>Open Boost</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    stickyTabsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#030712',
        elevation: 10,
        width: '100%',
    },
    feedHeaderTopRow: {
        paddingTop: 12,
        paddingBottom: 4,
        alignItems: 'stretch',
        justifyContent: 'center',
        zIndex: 1,
        paddingHorizontal: 12,
    },
    topHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    topHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerMiniAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    boostHeaderAction: {
        borderColor: '#FDE68A',
        backgroundColor: '#FBBF24',
    },
    headerMiniActionText: {
        color: '#F9FAFB',
        fontSize: 11,
        fontWeight: '700',
    },
    storiesHeaderAction: {
        borderColor: '#6B7280',
        backgroundColor: '#0B1220',
    },
    storiesHeaderActionText: {
        color: '#E5E7EB',
        fontSize: 11,
        fontWeight: '700',
    },
    scrim: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    gazetteerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    gazetteerText: {
        fontSize: 18,
        fontWeight: '300',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    notificationButton: {
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: 'bold',
    },
    profileMenuCard: {
        marginTop: 60,
        marginLeft: 16,
        backgroundColor: '#020617',
        borderRadius: 12,
        paddingVertical: 4,
        minWidth: 170,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F2937',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
    },
    profileMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        columnGap: 8,
    },
    profileMenuItemText: {
        fontSize: 14,
        color: '#F9FAFB',
        fontWeight: '500',
    },
    tabContainer: {
        backgroundColor: 'transparent',
        paddingVertical: 8,
        position: 'relative',
        zIndex: 1,
    },
    tabGrid: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        gap: 8,
    },
    tabButton: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
    },
    tabLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    activeTabButton: {
        backgroundColor: '#000000',
    },
    inactiveTabButton: {
        backgroundColor: '#000000',
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    inactiveTabText: {
        color: '#6B7280',
    },
    eyeIcon: {
        marginLeft: 4,
    },
    activeMainFeedLocationIcon: {
        marginRight: 2,
    },
    activeMainFeedTailOuter: {
        position: 'absolute',
        bottom: -7,
        left: '50%',
        marginLeft: -6,
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 7,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#FFFFFF',
    },
    activeMainFeedTailInner: {
        position: 'absolute',
        left: -5,
        top: -7,
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#000000',
    },
    feedContent: {
        paddingBottom: 20,
        paddingTop: 96,
    },
    feedCard: {
        backgroundColor: '#030712',
        marginBottom: FEED_UI.spacing.cardGap,
    },
    sponsoredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 6,
    },
    sponsoredText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F59E0B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sponsoredFeedType: {
        fontSize: 12,
        color: '#9CA3AF',
        textTransform: 'capitalize',
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingTop: FEED_UI.spacing.inset,
        paddingBottom: FEED_UI.spacing.compactV,
    },
    postHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarWrapper: {
        position: 'relative',
        marginRight: 12,
    },
    avatarContainer: {
        position: 'relative',
    },
    storyBorder: {
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInner: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    followPlusButton: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        borderColor: '#030712',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    followCheckButton: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: '#030712',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    postHeaderInfo: {
        flex: 1,
    },
    userHandle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    postMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    locationText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    separator: {
        fontSize: 12,
        color: '#6B7280',
    },
    timeText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    postHeaderRight: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
    },
    gazetteerOverlayText: {
        fontSize: 12,
        fontWeight: '300',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    locationButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    postImage: {
        width: '100%',
        height: 400,
        backgroundColor: '#111827',
    },
    textCardWrapper: {
        marginHorizontal: 16,
        marginVertical: 12,
        alignItems: 'center',
    },
    textCard: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    textCardDecorativeLine: {
        width: 2,
        height: 40,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    textCardContent: {
        flex: 1,
        fontSize: 16,
        color: '#000000',
    },
    textCardTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#FFFFFF',
        marginTop: -1,
    },
    engagementBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingVertical: FEED_UI.spacing.compactV,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: FEED_UI.spacing.groupGap,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: FEED_UI.spacing.groupGapTight,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionText: {
        fontSize: FEED_UI.type.actionCount,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    viewsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    errorContainer: {
        padding: 16,
        backgroundColor: '#FEE2E2',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
    },
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
    shareModalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
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
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    shareOptionText: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    boostPromptCard: {
        margin: 24,
        backgroundColor: '#030712',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#374151',
        padding: 16,
        gap: 10,
    },
    boostPromptTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    boostPromptText: {
        color: '#D1D5DB',
        fontSize: 13,
        lineHeight: 18,
    },
    boostPromptActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    boostPromptSecondaryBtn: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingVertical: 10,
        alignItems: 'center',
    },
    boostPromptSecondaryText: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '700',
    },
    boostPromptPrimaryBtn: {
        flex: 1,
        borderRadius: 10,
        backgroundColor: '#FBBF24',
        paddingVertical: 10,
        alignItems: 'center',
    },
    boostPromptPrimaryText: {
        color: '#111827',
        fontSize: 13,
        fontWeight: '800',
    },
});

export default FeedScreen;
