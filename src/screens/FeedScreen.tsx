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
    addComment,
    fetchComments,
    incrementShares,
    toggleCommentLike,
    toggleReplyLike,
    addReply,
} from '../api/posts';
import { userHasUnviewedStoriesByHandle, userHasStoriesByHandle } from '../api/stories';
import { getUnreadTotal } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import { enqueue, drain } from '../utils/mutationQueue';
import type { Post, Comment } from '../types';
import { getInstagramImageDimensions } from '../utils/imageDimensions';
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
    const tabs: Tab[] = [userRegional, userNational, 'Clips', 'Discover', 'Following'];

    return (
        <View style={styles.tabContainer}>
            <View style={styles.tabGrid}>
                {tabs.map(t => {
                    const isActive = active === t;
                    return (
                        <TouchableOpacity
                            key={t}
                            onPress={() => onChange(t)}
                            style={[
                                styles.tabButton,
                                isActive ? styles.activeTabButton : styles.inactiveTabButton,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isActive ? styles.activeTabText : styles.inactiveTabText,
                                ]}
                            >
                                {t}
                            </Text>
                            {isActive && (
                                <Icon name="eye" size={15} color="#FFFFFF" style={styles.eyeIcon} />
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
    onAvatarPress,
    onStoryPress
}: {
    post: Post;
    onFollow?: () => Promise<void>;
    isCurrentUser: boolean;
    onAvatarPress?: () => void;
    onStoryPress?: () => void;
}) {
    const [hasStory, setHasStory] = useState(false);
    const [showFollowCheck, setShowFollowCheck] = useState(post.isFollowing === true);

    useEffect(() => {
        async function checkStory() {
            try {
                let result;
                if (isCurrentUser) {
                    result = await userHasStoriesByHandle(post.userHandle);
                } else {
                    result = await userHasUnviewedStoriesByHandle(post.userHandle);
                }
                setHasStory(result);
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
                    onPress={hasStory ? onStoryPress : onAvatarPress}
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
                    onPress={onAvatarPress}
                >
                    <Text style={styles.userHandle}>{post.userHandle}</Text>
                    {post.createdAt && (
                        <View style={styles.postMeta}>
                            <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
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
    isOpen,
    onClose,
    userId,
}: {
    postId: string;
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
    const [replyInputText, setReplyInputText] = useState('');

    useEffect(() => {
        if (isOpen && postId) {
            loadComments();
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

    if (!isOpen) return null;

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="small" color="#8B5CF6" style={styles.modalLoading} />
                    ) : (
                        <FlatList
                            data={comments}
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
                                        <Text style={styles.commentText}>{item.text}</Text>
                                        <View style={styles.commentActionsRow}>
                                            <TouchableOpacity
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
                                                                {reply.text}
                                                            </Text>
                                                            <TouchableOpacity
                                                                style={styles.replyLikeRow}
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
            const result = await Share.share({
                message: post.text ? `${post.text} by ${post.userHandle}` : `Check out this post by ${post.userHandle}`,
                url: post.mediaUrl,
            });
            if (result.action === Share.sharedAction) {
                onClose();
            }
        } catch (err: any) {
            console.error('Error sharing:', err);
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
    onAvatarPress,
    onStoryPress,
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
    onAvatarPress?: () => void;
    onStoryPress?: () => void;
    onNotificationsPress?: () => void;
    unreadCount?: number;
    hasInbox?: boolean;
    isCurrentUser: boolean;
}) {
    const [imageDimensions, setImageDimensions] = React.useState<{ width: number; height: number } | null>(null);
    const screenWidth = Dimensions.get('window').width;

    // Auto-detect image dimensions if not provided
    React.useEffect(() => {
        if (post.mediaUrl && !imageDimensions) {
            Image.getSize(
                post.mediaUrl,
                (width, height) => {
                    // Calculate Instagram-style dimensions with clamping
                    const dimensions = getInstagramImageDimensions(width, height, screenWidth);
                    setImageDimensions({ width: dimensions.width, height: dimensions.height });
                },
                (error) => {
                    console.error('Error getting image size:', error);
                    // Fallback to default dimensions
                    setImageDimensions({ width: screenWidth, height: screenWidth * (4 / 5) });
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
            height: screenWidth * (4 / 5), // Default to max portrait aspect ratio
            backgroundColor: '#111827',
        };
    }, [imageDimensions, screenWidth]);

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
                onAvatarPress={onAvatarPress}
                onStoryPress={onStoryPress}
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
                <Image
                    source={{ uri: post.mediaUrl }}
                    style={imageStyle}
                    onLoad={onView}
                    resizeMode="cover"
                // Performance optimizations
                // Note: React Native Image automatically caches and lazy loads
                // Progressive rendering is handled by the platform
                />
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
                            size={18}
                            color={post.userLiked ? "#EF4444" : "#6B7280"}
                        />
                        <Text style={styles.actionText}>{post.stats.likes}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onComment} style={styles.actionButton}>
                        <Icon name="chatbubble-outline" size={18} color="#6B7280" />
                        <Text style={styles.actionText}>{post.stats.comments}</Text>
                    </TouchableOpacity>

                    {!isCurrentUser && (
                        <TouchableOpacity onPress={onReclip} style={styles.actionButton}>
                            <Icon name="repeat" size={18} color={post.userReclipped ? "#8B5CF6" : "#6B7280"} />
                            <Text style={styles.actionText}>{post.stats.reclips}</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={onShare} style={styles.actionButton}>
                        <Icon name="share-outline" size={18} color="#6B7280" />
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
                                size={18}
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
                            size={18}
                            color={post.isBookmarked ? "#8B5CF6" : "#6B7280"}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
});

function FeedScreen({ navigation }: { navigation?: any }) {
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const defaultNational = user?.national || 'Ireland';
    const defaultRegional = user?.regional || 'Dublin';

    const [active, setActive] = useState<Tab>(defaultNational);
    const [pages, setPages] = useState<Post[][]>([]);
    const [cursor, setCursor] = useState<number | null>(0);
    const [loading, setLoading] = useState(false);
    const [end, setEnd] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showFollowingFeed, setShowFollowingFeed] = useState(false);
    const [commentsModalOpen, setCommentsModalOpen] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasInbox, setHasInbox] = useState(false);
    const requestTokenRef = useRef(0);

    const currentFilter = showFollowingFeed ? 'discover' : active;

    // Helper to update a post in pages
    const updatePost = (postId: string, updater: (post: Post) => Post) => {
        setPages(prev => prev.map(page =>
            page.map(p => p.id === postId ? updater(p) : p)
        ));
    };

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
    }, [cursor, currentFilter]);

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
            updateUnreadCount();
        }, [updateUnreadCount])
    );

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

            if (page.items.length === 0) {
                setEnd(true);
            } else {
                setPages(prev => [...prev, page.items]);
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
                const updated = await toggleLike(userId, post.id);
                // Update local state - find and update the post
                setPages(prev => prev.map(page =>
                    page.map(p => p.id === post.id ? updated : p)
                ));
            }}
            onFollow={async () => {
                if (!user) return;
                const updated = await toggleFollowForPost(userId, post.id);
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
                try {
                    const { originalPost, reclippedPost } = await reclipPost(userId, post.id, user.handle);
                    updatePost(post.id, p => ({
                        ...p,
                        userReclipped: originalPost.userReclipped,
                        stats: originalPost.stats
                    }));
                    // Note: Reclipped posts only appear in the Following feed for users who follow the reclipper
                    // They should NOT be added to the current feed to avoid duplicates
                } catch (err: any) {
                    Alert.alert('Error', err.message || 'Failed to reclip post');
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
            onAvatarPress={() => navigation.navigate('ViewProfile', { handle: post.userHandle })}
            onStoryPress={() => navigation.navigate('Stories', { openUserHandle: post.userHandle })}
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
                    <Text style={styles.gazetteerText}>Gazetteer</Text>
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
                isOpen={commentsModalOpen}
                onClose={() => {
                    setCommentsModalOpen(false);
                    setSelectedPostId(null);
                }}
                userId={userId}
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
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
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
    feedContent: {
        paddingBottom: 20,
        paddingTop: 96,
    },
    feedCard: {
        backgroundColor: '#030712',
        marginBottom: 16,
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
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
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
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionText: {
        fontSize: 14,
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
    modalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
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
});

export default FeedScreen;
