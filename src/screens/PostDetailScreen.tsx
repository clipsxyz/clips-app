import React, { useEffect, useState, useMemo } from 'react';
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
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { gazetteerHeader } from '../theme/gazetteerAmbientNative';
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
import { getInstagramImageDimensions, isLikelyImageUri } from '../utils/imageDimensions';
import { FEED_UI } from '../constants/feedUiTokens';
import FeedPostMedia from '../components/FeedPostMedia.native';
import FeedMediaCarouselThumbs from '../components/FeedMediaCarouselThumbs.native';
import ImageFullscreenModal from '../components/ImageFullscreenModal.native';
import { imageFullscreenIndexForCarousel } from '../utils/feedImageFullscreen';
import {
    hideFeedPostMobile,
    markNotInterestedFeedPostMobile,
    muteFeedAuthorMobile,
} from '../utils/feedContentPrefsMobile';
import type { Post } from '../types';
import { isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import Avatar from '../components/Avatar';
import FeedShareModal from '../components/FeedShareModal';
import PostOverflowMenuModal from '../components/PostOverflowMenuModal';
import EditPostModal from '../components/EditPostModal.native';
import SavePostModal from '../components/SavePostModal.native';
import QRCodeModal from '../components/QRCodeModal.native';
import CreateGroupModal from '../components/CreateGroupModal.native';
import PickGroupToInviteFeedUserModal from '../components/PickGroupToInviteFeedUserModal.native';
import PostCommentsSheet from '../components/PostCommentsSheet';
import { updatePost as apiUpdatePost } from '../api/client';
import { toggleFollowForPost } from '../api/posts';
import { ox } from '../constants/nativeOpticalScale';

export default function PostDetailScreen({ route, navigation }: any) {
    const { postId, openComments } = route.params || {};
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const screenWidth = Dimensions.get('window').width;

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [mediaHeight, setMediaHeight] = useState(screenWidth * FEED_UI.media.maxAspect);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(!!openComments);
    const [overflowVisible, setOverflowVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [qrVisible, setQrVisible] = useState(false);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [inviteGroupOpen, setInviteGroupOpen] = useState(false);
    const [overflowSaved, setOverflowSaved] = useState(false);
    const [overflowNotify, setOverflowNotify] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [imageFullscreenOpen, setImageFullscreenOpen] = useState(false);

    useEffect(() => {
        loadPost();
    }, [postId]);

    useEffect(() => {
        if (openComments) setCommentsOpen(true);
    }, [openComments, postId]);

    useEffect(() => {
        setCarouselIndex(0);
    }, [postId]);

    const carouselThumbItems = useMemo(
        () =>
            (post?.mediaItems || []).filter(
                (item) => item?.type === 'image' || item?.type === 'video',
            ),
        [post?.mediaItems],
    );

    const mediaSizingUrl = useMemo(() => {
        if (!post || isTextOnlyPost(post)) return null;
        const first = carouselThumbItems[0];
        if (first?.type === 'video' && post.videoPosterUrl) return post.videoPosterUrl;
        if (first?.url) return first.url;
        if (isVideoPost(post) && post.videoPosterUrl) return post.videoPosterUrl;
        return post.mediaUrl || post.mediaItems?.[0]?.url || null;
    }, [post, carouselThumbItems]);

    useEffect(() => {
        if (!mediaSizingUrl || !isLikelyImageUri(mediaSizingUrl)) {
            setMediaHeight(screenWidth * FEED_UI.media.maxAspect);
            return;
        }
        Image.getSize(
            mediaSizingUrl,
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
    }, [mediaSizingUrl, screenWidth, postId]);

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
            <GazetteerScreenShell contentStyle={styles.centeredShell}>
                <ActivityIndicator size="large" color="#f472b6" />
            </GazetteerScreenShell>
        );
    }

    if (!post) {
        return (
            <GazetteerScreenShell contentStyle={styles.centeredShell}>
                <Text style={styles.errorText}>Post not found</Text>
            </GazetteerScreenShell>
        );
    }

    const textOnlyPost = isTextOnlyPost(post);
    const hasPostMedia =
        textOnlyPost || Boolean(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0));

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={ox(24)} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post</Text>
                <TouchableOpacity
                    onPress={() => setOverflowVisible(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Icon name="ellipsis-horizontal" size={ox(22)} color="#E5E7EB" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.postHeader}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('ViewProfile', { handle: post.userHandle })}
                    >
                        <Avatar src={undefined} name={post.userHandle.split('@')[0]} size={ox(40)} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.postHeaderInfo}
                        onPress={() => navigation.navigate('ViewProfile', { handle: post.userHandle })}
                    >
                        <Text style={styles.userHandle}>{post.userHandle}</Text>
                        <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
                    </TouchableOpacity>
                </View>

                {hasPostMedia ? (
                    <>
                        <View style={styles.mediaWrap}>
                            <FeedPostMedia
                                post={post}
                                carouselIndex={carouselIndex}
                                onCarouselIndexChange={setCarouselIndex}
                                width={screenWidth}
                                height={textOnlyPost ? screenWidth * 0.5 : mediaHeight}
                                mode="detail"
                                onPress={() => setImageFullscreenOpen(true)}
                            />
                        </View>
                        {carouselThumbItems.length > 1 ? (
                            <FeedMediaCarouselThumbs
                                items={carouselThumbItems}
                                activeIndex={carouselIndex}
                                onSelect={setCarouselIndex}
                            />
                        ) : null}
                    </>
                ) : null}

                {!textOnlyPost && post.text?.trim() ? (
                    <View style={styles.textContainer}>
                        <Text style={styles.textContent}>{post.text}</Text>
                    </View>
                ) : null}

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
                onOpenSave={() => setSaveModalVisible(true)}
                onSaveToggle={async () => {
                    await toggleCollectionsSave();
                    const cols = await getCollectionsForPost(userId, post.id);
                    setOverflowSaved(cols.length > 0);
                }}
                onCreateGroup={() => setCreateGroupOpen(true)}
                onInviteToGroup={() => setInviteGroupOpen(true)}
                onShowQRCode={() => setQrVisible(true)}
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
                isFollowing={!!post.isFollowing}
                onEdit={() => {
                    setOverflowVisible(false);
                    setEditModalVisible(true);
                }}
                onUnfollow={async () => {
                    const updated = await toggleFollowForPost(userId, post.id, post.userHandle, user?.handle);
                    setPost((p) =>
                        p ? { ...p, isFollowing: updated?.isFollowing ?? !p.isFollowing } : null
                    );
                }}
                onMute={async () => {
                    await muteFeedAuthorMobile(userId, post.userHandle);
                    Alert.alert('Muted', `${post.userHandle} was muted.`);
                    navigation.goBack();
                }}
                onHide={async () => {
                    await hideFeedPostMobile(userId, post.id);
                    navigation.goBack();
                }}
                onNotInterested={async () => {
                    await markNotInterestedFeedPostMobile(userId, post.id);
                    navigation.goBack();
                }}
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
                    if (!post) return;
                    const { promptReportPostNative } = await import('../utils/promptReportPostNative');
                    promptReportPostNative(post.id, () => setOverflowVisible(false));
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

            {post && saveModalVisible ? (
                <SavePostModal
                    post={post}
                    userId={userId}
                    visible={saveModalVisible}
                    onClose={() => setSaveModalVisible(false)}
                    onSaved={async () => {
                        const cols = await getCollectionsForPost(userId, post.id);
                        setOverflowSaved(cols.length > 0);
                        setPost((p) => (p ? { ...p, isBookmarked: cols.length > 0 } : null));
                    }}
                />
            ) : null}

            {post && qrVisible ? (
                <QRCodeModal post={post} visible={qrVisible} onClose={() => setQrVisible(false)} />
            ) : null}

            <CreateGroupModal
                visible={createGroupOpen}
                onClose={() => setCreateGroupOpen(false)}
                onCreated={(g) => {
                    setCreateGroupOpen(false);
                    navigation.navigate('Messages', { chatGroupId: g.id, kind: 'group' });
                }}
            />

            <PickGroupToInviteFeedUserModal
                visible={inviteGroupOpen}
                inviteeHandle={post?.userHandle || ''}
                onClose={() => setInviteGroupOpen(false)}
            />

            <ImageFullscreenModal
                post={post}
                visible={imageFullscreenOpen}
                initialIndex={imageFullscreenIndexForCarousel(post, carouselIndex)}
                onClose={() => setImageFullscreenOpen(false)}
                onLike={handleLike}
                onComment={() => setCommentsOpen(true)}
                onReclip={tryReclip}
                onMenu={() => setOverflowVisible(true)}
            />

            {post && editModalVisible ? (
                <EditPostModal
                    post={post}
                    visible={editModalVisible}
                    onClose={() => setEditModalVisible(false)}
                    onSave={async (text, location, venue, landmark) => {
                        try {
                            await apiUpdatePost(post.id, {
                                text,
                                location,
                                venue: venue || undefined,
                                landmark: landmark || undefined,
                            });
                        } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : '';
                            const offline =
                                msg.includes('Failed to fetch') ||
                                msg.includes('Network') ||
                                msg === 'CONNECTION_REFUSED';
                            if (!offline) throw err;
                        }
                        setPost((p) =>
                            p
                                ? {
                                      ...p,
                                      text,
                                      caption: text,
                                      locationLabel: location || p.locationLabel || '',
                                      venue: venue || undefined,
                                      landmark: landmark || undefined,
                                  }
                                : null
                        );
                    }}
                />
            ) : null}
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    centeredShell: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: ox(16),
        ...gazetteerHeader,
    },
    headerTitle: {
        fontSize: ox(18),
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
        fontSize: ox(16),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    timeText: {
        fontSize: ox(12),
        color: '#9CA3AF',
        marginTop: ox(2),
    },
    mediaWrap: {
        width: '100%',
        backgroundColor: '#000000',
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
        fontSize: ox(16),
        color: '#F9FAFB',
        lineHeight: ox(24),
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
        gap: ox(4),
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
        fontSize: ox(14),
        color: '#9CA3AF',
    },
    errorText: {
        fontSize: ox(16),
        color: '#EF4444',
        textAlign: 'center',
        marginTop: ox(40),
    },
});
