import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    Dimensions,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import {
    getPostById,
    toggleLike,
    incrementViews,
    incrementShares,
    deletePost,
    reclipPost,
    setReclipState,
    fetchComments,
} from '../api/posts';
import { blockUser } from '../api/messages';
import { getCollectionsForPost, savePostToDefaultCollection, unsavePost } from '../api/collections';
import {
    markFeedPostArchivedMobile,
    hasPostNotificationsPrefMobile,
    setPostNotificationsPrefMobile,
} from '../utils/feedEngagementPrefsMobile';
import { timeAgo } from '../utils/timeAgo';
import { getInstagramImageDimensions } from '../utils/imageDimensions';
import { FEED_UI } from '../constants/feedUiTokens';
import type { Post } from '../types';
import Avatar from '../components/Avatar';
import FeedShareModal from '../components/FeedShareModal';
import PostOverflowMenuModal from '../components/PostOverflowMenuModal';
import PostCommentsSheet from '../components/PostCommentsSheet';

export default function PostDetailScreen({ route, navigation }: any) {
    const { postId } = route.params;
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const screenWidth = Dimensions.get('window').width;

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [mediaHeight, setMediaHeight] = useState(screenWidth * FEED_UI.media.maxAspect);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [overflowVisible, setOverflowVisible] = useState(false);
    const [overflowSaved, setOverflowSaved] = useState(false);
    const [overflowNotify, setOverflowNotify] = useState(false);

    useEffect(() => {
        loadPost();
    }, [postId]);

    useEffect(() => {
        if (!post?.mediaUrl) return;
        Image.getSize(
            post.mediaUrl,
            (width, height) => {
                const dimensions = getInstagramImageDimensions(width, height, screenWidth);
                const minHeight = screenWidth * FEED_UI.media.minAspect;
                const maxHeight = screenWidth * FEED_UI.media.maxAspect;
                setMediaHeight(Math.min(Math.max(dimensions.height, minHeight), maxHeight));
            },
            () => {
                setMediaHeight(screenWidth * FEED_UI.media.maxAspect);
            }
        );
    }, [post?.mediaUrl, screenWidth]);

    useEffect(() => {
        if (!overflowVisible || !post) return;
        let cancelled = false;
        (async () => {
            try {
                const cols = await getCollectionsForPost(userId, post.id);
                const n = await hasPostNotificationsPrefMobile(userId, post.id);
                if (!cancelled) {
                    setOverflowSaved(cols.length > 0);
                    setOverflowNotify(n);
                }
            } catch {
                if (!cancelled) {
                    setOverflowSaved(false);
                    setOverflowNotify(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [overflowVisible, post?.id, userId]);

    const loadPost = async () => {
        try {
            const loadedPost = await getPostById(postId);
            setPost(loadedPost);
            if (loadedPost) {
                await incrementViews(userId, postId);
            }
        } catch (err) {
            console.error('Error loading post:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCollectionsSave = async () => {
        if (!post) return;
        try {
            const cols = await getCollectionsForPost(userId, post.id);
            if (cols.length > 0) {
                await unsavePost(userId, post.id);
                setPost((p) => (p ? { ...p, isBookmarked: false } : null));
                setOverflowSaved(false);
            } else {
                await savePostToDefaultCollection(userId, post.id, post);
                setPost((p) => (p ? { ...p, isBookmarked: true } : null));
                setOverflowSaved(true);
            }
        } catch (err) {
            console.error('Save toggle failed:', err);
        }
    };

    const openShare = async () => {
        if (!post) return;
        setShareModalOpen(true);
        try {
            await incrementShares(userId, post.id);
            setPost((p) =>
                p ? { ...p, stats: { ...p.stats, shares: p.stats.shares + 1 } } : null
            );
        } catch (err) {
            console.error('Error incrementing shares:', err);
        }
    };

    const handleLike = async () => {
        if (!post) return;
        try {
            const updated = await toggleLike(userId, post.id, post);
            setPost(updated);
        } catch (err) {
            console.error('Error liking post:', err);
        }
    };

    const tryReclip = async () => {
        if (!post || !user?.handle) return;
        if (post.userHandle === user.handle) {
            Alert.alert('Cannot reclip', 'You cannot reclip your own post.');
            return;
        }
        if (post.userReclipped) {
            Alert.alert('Already reclipped', 'You have already reclipped this post.');
            return;
        }
        const newReclips = post.stats.reclips + 1;
        setReclipState(userId, post.id, true);
        setPost((p) =>
            p
                ? {
                      ...p,
                      userReclipped: true,
                      stats: { ...p.stats, reclips: newReclips },
                  }
                : null
        );
        try {
            await reclipPost(userId, post.id, user.handle);
        } catch (err: any) {
            console.warn('Reclip failed (UI already updated):', err);
        }
    };

    const hideAndPopAfterArchiveOrDelete = () => {
        navigation.goBack();
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    if (!post) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Post not found</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post</Text>
                <TouchableOpacity
                    onPress={() => setOverflowVisible(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Icon name="ellipsis-horizontal" size={22} color="#E5E7EB" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.postHeader}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('ViewProfile', { handle: post.userHandle })}
                    >
                        <Avatar src={undefined} name={post.userHandle.split('@')[0]} size={40} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.postHeaderInfo}
                        onPress={() => navigation.navigate('ViewProfile', { handle: post.userHandle })}
                    >
                        <Text style={styles.userHandle}>{post.userHandle}</Text>
                        <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
                    </TouchableOpacity>
                </View>

                {post.mediaUrl && (
                    <Image source={{ uri: post.mediaUrl }} style={[styles.media, { height: mediaHeight }]} />
                )}

                {post.text && (
                    <View style={styles.textContainer}>
                        <Text style={styles.textContent}>{post.text}</Text>
                    </View>
                )}

                <View style={styles.engagementBar}>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                            <Icon
                                name={post.userLiked ? 'heart' : 'heart-outline'}
                                size={FEED_UI.icon.action}
                                color={post.userLiked ? '#EF4444' : '#FFFFFF'}
                            />
                            <Text style={styles.actionText}>{post.stats.likes}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setCommentsOpen(true)}
                            style={styles.actionButton}
                        >
                            <Icon name="chatbubble-outline" size={FEED_UI.icon.action} color="#FFFFFF" />
                            <Text style={styles.actionText}>{post.stats.comments}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={openShare} style={styles.actionButton}>
                            <Icon name="share-outline" size={FEED_UI.icon.action} color="#FFFFFF" />
                            <Text style={styles.actionText}>{post.stats.shares}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={toggleCollectionsSave}>
                        <Icon
                            name={post.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                            size={FEED_UI.icon.action}
                            color={post.isBookmarked ? '#8B5CF6' : '#FFFFFF'}
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>
                        {post.stats.views} views • {post.stats.reclips} reclips
                    </Text>
                </View>
            </ScrollView>

            <PostCommentsSheet
                postId={post.id}
                post={post}
                isOpen={commentsOpen}
                commentAuthorHandle={user?.handle ?? ''}
                currentUserHandle={user?.handle}
                onAfterClose={() => {
                    fetchComments(post.id)
                        .then((list) =>
                            setPost((p) =>
                                p ? { ...p, stats: { ...p.stats, comments: list.length } } : null
                            )
                        )
                        .catch(() => {});
                }}
                onClose={() => setCommentsOpen(false)}
            />

            <FeedShareModal post={post} isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} />

            <PostOverflowMenuModal
                visible={overflowVisible}
                post={post}
                viewerUserId={userId}
                viewerHandle={user?.handle}
                isSaved={overflowSaved}
                hasNotifications={overflowNotify}
                onClose={() => setOverflowVisible(false)}
                onShare={openShare}
                onSaveToggle={async () => {
                    await toggleCollectionsSave();
                    const cols = await getCollectionsForPost(userId, post.id);
                    setOverflowSaved(cols.length > 0);
                }}
                onBoost={() => {
                    setOverflowVisible(false);
                    navigation.navigate('Boost');
                }}
                onArchive={async () => {
                    await markFeedPostArchivedMobile(userId, post.id);
                    hideAndPopAfterArchiveOrDelete();
                }}
                onToggleNotifications={async () => {
                    const next = !overflowNotify;
                    await setPostNotificationsPrefMobile(userId, post.id, next);
                    setOverflowNotify(next);
                }}
                onReclip={tryReclip}
                onDelete={() =>
                    new Promise<void>((resolve) => {
                        if (!user?.handle) {
                            resolve();
                            return;
                        }
                        Alert.alert('Delete post?', 'This cannot be undone.', [
                            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => {
                                    void (async () => {
                                        try {
                                            await deletePost(userId, post.id, user.handle);
                                            hideAndPopAfterArchiveOrDelete();
                                        } catch (e) {
                                            console.error('Delete post failed:', e);
                                            Alert.alert('Error', 'Could not delete this post.');
                                        } finally {
                                            resolve();
                                        }
                                    })();
                                },
                            },
                        ]);
                    })
                }
                onReport={async () => {
                    Alert.alert('Reported', 'Thanks for reporting. We will review this content.');
                }}
                onBlock={() =>
                    new Promise<void>((resolve) => {
                        if (!user?.handle) {
                            resolve();
                            return;
                        }
                        Alert.alert('Block user?', `Hide ${post.userHandle} from your feed?`, [
                            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
                            {
                                text: 'Block',
                                style: 'destructive',
                                onPress: () => {
                                    void (async () => {
                                        await blockUser(user.handle, post.userHandle);
                                        Alert.alert(
                                            'Blocked',
                                            `${post.userHandle} was blocked.`,
                                            [{ text: 'OK', onPress: () => navigation.goBack() }]
                                        );
                                        resolve();
                                    })();
                                },
                            },
                        ]);
                    })
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingVertical: FEED_UI.spacing.normalV,
        gap: FEED_UI.spacing.groupGapTight,
    },
    postHeaderInfo: {
        flex: 1,
    },
    userHandle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    timeText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    media: {
        width: '100%',
        backgroundColor: '#111827',
    },
    textContainer: {
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingVertical: FEED_UI.spacing.normalV,
    },
    textContent: {
        fontSize: 16,
        color: '#F9FAFB',
        lineHeight: 24,
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
        gap: FEED_UI.spacing.groupGap,
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
    statsContainer: {
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingVertical: FEED_UI.spacing.normalV,
        paddingTop: 0,
    },
    statsText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
        marginTop: 40,
    },
});
