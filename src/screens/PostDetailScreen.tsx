import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    Modal,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { useAuth } from '../context/Auth';
import {
    getPostById,
    toggleLike,
    incrementViews,
    deletePost,
    reclipPost,
    setReclipState,
    fetchComments,
    upsertLocalPost,
} from '../api/posts';
import { blockUser } from '../api/messages';
import { getCollectionsForPost, getPostFromCollectionPreviews, savePostToDefaultCollection, unsavePost } from '../api/collections';
import {
    markFeedPostArchivedMobile,
    hasPostNotificationsPrefMobile,
    setPostNotificationsPrefMobile,
} from '../utils/feedEngagementPrefsMobile';
import { getInstagramImageDimensions, isLikelyImageUri } from '../utils/imageDimensions';
import { FEED_UI } from '../constants/feedUiTokens';
import FeedPostMedia from '../components/FeedPostMedia.native';
import FeedMediaCarouselThumbs from '../components/FeedMediaCarouselThumbs.native';
import FeedPostHeader from '../components/FeedPostHeader.native';
import FeedCaptionText from '../components/FeedCaptionText.native';
import FeedEngagementRow from '../components/FeedEngagementRow';
import FeedEngagementRightActions from '../components/FeedEngagementRightActions.native';
import FeedTextOnlyFeedLayout from '../components/FeedTextOnlyFeedLayout.native';
import {
    hideFeedPostMobile,
    markNotInterestedFeedPostMobile,
    muteFeedAuthorMobile,
} from '../utils/feedContentPrefsMobile';
import type { Post } from '../types';
import { isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import { getPostDisplayCaption } from '../utils/feedPostMeta';
import { feedMediaHeight } from '../utils/mediaAspectRatio';
import FeedShareModal from '../components/FeedShareModal';
import {
    FEED_CARD_BG,
    FEED_CARD_HEADER_WRAP,
    FEED_CARD_RADIUS,
    FEED_CARD_SHELL_BORDER_COLOR,
    FEED_CARD_SHELL_BORDER_WIDTH,
    FEED_PAGE_BG,
} from '../components/FeedPageLayout.native';
import PostOverflowMenuModal from '../components/PostOverflowMenuModal';
import EditPostModal from '../components/EditPostModal.native';
import SavePostModal from '../components/SavePostModal.native';
import QRCodeModal from '../components/QRCodeModal.native';
import CreateGroupModal from '../components/CreateGroupModal.native';
import PickGroupToInviteFeedUserModal from '../components/PickGroupToInviteFeedUserModal.native';
import PostCommentsSheet from '../components/PostCommentsSheet';
import { updatePost as apiUpdatePost } from '../api/client';
import { toggleFollowForPost } from '../api/posts';
import { flushScenesPostUpdates, setScenesPostUpdate } from '../utils/scenesPostSyncNative';
import { ox } from '../constants/nativeOpticalScale';
import { setActiveFeedVideoPostId } from '../utils/feedActiveVideoNative';

export default function PostDetailScreen({ route, navigation }: any) {
    const { postId, openComments, fromCollection, initialPost } = route.params || {};
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const screenWidth = Dimensions.get('window').width;
    const hideSaveAction = Boolean(fromCollection);

    const [post, setPost] = useState<Post | null>(() =>
        initialPost && String(initialPost.id) === String(postId) ? (initialPost as Post) : null,
    );
    /** Latest post for the fullscreen route's handlers (they outlive a single render). */
    const postRef = useRef<Post | null>(null);
    postRef.current = post;
    const [loading, setLoading] = useState(
        () => !(initialPost && String(initialPost.id) === String(postId)),
    );
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

    useEffect(() => {
        loadPost();
    }, [postId]);

    useEffect(() => {
        if (openComments) setCommentsOpen(true);
    }, [openComments, postId]);

    useEffect(() => {
        setCarouselIndex(0);
    }, [postId]);

    useFocusEffect(
        useCallback(() => {
            const current = postRef.current;
            if (current && isVideoPost(current)) {
                setActiveFeedVideoPostId(String(current.id));
            }
            return () => {
                flushScenesPostUpdates();
            };
        }, []),
    );

    useEffect(() => {
        if (!post || !isVideoPost(post)) return;
        setActiveFeedVideoPostId(String(post.id));
    }, [post]);

    const syncPostOut = useCallback((next: Post | null | undefined) => {
        if (next?.id) setScenesPostUpdate(next);
    }, []);

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
            let loadedPost: Post | null = null;

            // Prefer the grid snapshot so MP4 URLs from the profile list are not lost.
            if (initialPost && String(initialPost.id) === String(postId)) {
                loadedPost = initialPost as Post;
            }
            if (!loadedPost) {
                loadedPost = await getPostById(postId, userId);
            }
            if (!loadedPost) {
                loadedPost = await getPostFromCollectionPreviews(postId, userId);
            }
            if (loadedPost) {
                upsertLocalPost(loadedPost);
                const fresh = await getPostById(postId, userId);
                if (fresh) {
                    const snapshot = initialPost && String(initialPost.id) === String(postId)
                        ? (initialPost as Post)
                        : loadedPost;
                    loadedPost = {
                        ...fresh,
                        mediaUrl: fresh.mediaUrl || snapshot.mediaUrl,
                        mediaType: fresh.mediaType || snapshot.mediaType,
                        mediaItems:
                            fresh.mediaItems && fresh.mediaItems.length > 0
                                ? fresh.mediaItems
                                : snapshot.mediaItems,
                        finalVideoUrl: fresh.finalVideoUrl || snapshot.finalVideoUrl,
                        videoPosterUrl: fresh.videoPosterUrl || snapshot.videoPosterUrl,
                    };
                }
            }

            setPost(loadedPost);
            if (loadedPost) {
                syncPostOut(loadedPost);
                await incrementViews(userId, postId);
            }
        } catch (err) {
            console.error('Error loading post:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCollectionsSave = async () => {
        if (!post || hideSaveAction) return;
        try {
            const cols = await getCollectionsForPost(userId, post.id);
            if (cols.length > 0) {
                await unsavePost(userId, post.id);
                setPost((p) => {
                    const next = p ? { ...p, isBookmarked: false } : null;
                    syncPostOut(next);
                    return next;
                });
                setOverflowSaved(false);
            } else {
                await savePostToDefaultCollection(userId, post.id, post);
                setPost((p) => {
                    const next = p ? { ...p, isBookmarked: true } : null;
                    syncPostOut(next);
                    return next;
                });
                setOverflowSaved(true);
            }
        } catch (err) {
            console.error('Save toggle failed:', err);
        }
    };

    const openShare = async () => {
        if (!post) return;
        setShareModalOpen(true);
    };

    const handleLike = async () => {
        const p = postRef.current;
        if (!p) return;
        try {
            const updated = await toggleLike(userId, p.id, p);
            setPost(updated);
            upsertLocalPost(updated);
            syncPostOut(updated);
        } catch (err) {
            console.error('Error liking post:', err);
        }
    };

    const tryReclip = async () => {
        const p = postRef.current;
        if (!p || !user?.handle) return;
        const norm = (h?: string) => String(h || '').trim().toLowerCase();
        if (norm(p.userHandle) === norm(user.handle)) {
            Alert.alert('Cannot reclip', 'You cannot reclip your own post.');
            return;
        }
        if (p.userReclipped) {
            Alert.alert('Already reclipped', 'You have already reclipped this post.');
            return;
        }
        const prevReclips = p.stats.reclips;
        const newReclips = prevReclips + 1;
        setReclipState(userId, p.id, true);
        setPost((prev) => {
            const next = prev
                ? {
                      ...prev,
                      userReclipped: true,
                      stats: { ...prev.stats, reclips: newReclips },
                  }
                : null;
            syncPostOut(next);
            return next;
        });
        try {
            const result = await reclipPost(userId, p.id, user.handle);
            if (result.originalPost) {
                setPost(result.originalPost);
                upsertLocalPost(result.originalPost);
            }
        } catch (err: any) {
            console.warn('Reclip failed:', err);
            setReclipState(userId, p.id, false);
            setPost((prev) =>
                prev
                    ? {
                          ...prev,
                          userReclipped: false,
                          stats: { ...prev.stats, reclips: prevReclips },
                      }
                    : null,
            );
            Alert.alert('Could not reclip', err?.message || 'Please try again.');
        }
    };

    const hideAndPopAfterArchiveOrDelete = () => {
        navigation.goBack();
    };

    if (loading) {
        return (
            <GazetteerScreenShell
                ambient={false}
                ambientVariant="passport"
                contentStyle={styles.centeredShell}
            >
                <ActivityIndicator size="large" color="#f472b6" />
            </GazetteerScreenShell>
        );
    }

    if (!post) {
        return (
            <GazetteerScreenShell
                ambient={false}
                ambientVariant="passport"
                contentStyle={styles.centeredShell}
            >
                <Text style={styles.errorText}>Post not found</Text>
            </GazetteerScreenShell>
        );
    }

    const textOnlyPost = isTextOnlyPost(post);
    const hasVisualMedia = Boolean(
        post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0),
    );
    const windowHeight = Dimensions.get('window').height;
    const pageGutter = ox(16);
    const cardMediaWidth = fromCollection
        ? screenWidth - ox(48)
        : screenWidth - pageGutter * 2;
    const sizedHeight = feedMediaHeight(cardMediaWidth, post.width, post.height, {
        fitLandscape: true,
    });
    const detailMediaHeight = textOnlyPost
        ? Math.min(cardMediaWidth * 0.55, windowHeight * 0.32)
        : fromCollection
          ? Math.min(sizedHeight || mediaHeight, windowHeight * 0.46)
          : sizedHeight || mediaHeight;
    const isCurrentUser = Boolean(
        user?.handle &&
            String(user.handle).trim().toLowerCase() ===
                String(post.userHandle).trim().toLowerCase(),
    );
    const displayCaption = getPostDisplayCaption(post);
    const openProfile = () =>
        navigation.navigate('ViewProfile', { handle: post.userHandle });

    return (
        <GazetteerScreenShell
            ambient={false}
            ambientVariant="passport"
            contentStyle={styles.pageFill}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
                    <Icon name="arrow-back" size={ox(24)} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post</Text>
                <View style={styles.headerSide} />
            </View>

            <View style={styles.page}>
                <View style={styles.card} collapsable={false}>
                    {textOnlyPost ? (
                        <FeedTextOnlyFeedLayout
                            post={post}
                            viewerHandle={user?.handle}
                            cardWidth={cardMediaWidth}
                            isCurrentUser={isCurrentUser}
                            onAvatarPress={openProfile}
                            onProfileMenuPress={openProfile}
                            onOverflowPress={() => setOverflowVisible(true)}
                            onDoubleLike={() => {
                                void handleLike();
                            }}
                        />
                    ) : (
                    <>
                    <View style={FEED_CARD_HEADER_WRAP}>
                        <FeedPostHeader
                            post={post}
                            viewerHandle={user?.handle}
                            isCurrentUser={isCurrentUser}
                            onAvatarPress={openProfile}
                            onProfileMenuPress={openProfile}
                            onOverflowPress={() => setOverflowVisible(true)}
                        />
                    </View>
                    {hasVisualMedia ? (
                        <View
                            style={styles.mediaWrap}
                            collapsable={false}
                            renderToHardwareTextureAndroid={false}
                        >
                            <FeedPostMedia
                                post={post}
                                carouselIndex={carouselIndex}
                                onCarouselIndexChange={setCarouselIndex}
                                width={cardMediaWidth}
                                height={detailMediaHeight}
                                mode="detail"
                                isActive
                                immediateVideoSurface
                                muted={false}
                            />
                        </View>
                    ) : null}
                    {carouselThumbItems.length > 1 ? (
                        <FeedMediaCarouselThumbs
                            items={carouselThumbItems}
                            post={post}
                            activeIndex={carouselIndex}
                            onSelect={setCarouselIndex}
                        />
                    ) : null}
                    </>
                    )}

                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentInner}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                        removeClippedSubviews={false}
                    >
                        {!textOnlyPost && displayCaption.length > 0 && hasVisualMedia ? (
                            <View style={styles.captionWrap}>
                                <FeedCaptionText caption={displayCaption} />
                            </View>
                        ) : null}

                        <View style={styles.engagementBar}>
                            <View style={styles.engagementLeft}>
                                <FeedEngagementRow
                                    likes={post.stats?.likes ?? 0}
                                    comments={post.stats?.comments ?? 0}
                                    shares={post.stats?.shares ?? 0}
                                    reclips={post.stats?.reclips ?? 0}
                                    userLiked={post.userLiked}
                                    userReclipped={post.userReclipped}
                                    isSaved={post.isBookmarked}
                                    onLike={() => {
                                        void handleLike();
                                    }}
                                    onComment={() => setCommentsOpen(true)}
                                    onReclip={() => {
                                        void tryReclip();
                                    }}
                                    onSave={
                                        hideSaveAction
                                            ? undefined
                                            : () => {
                                                  void toggleCollectionsSave();
                                              }
                                    }
                                    showShareToStories={false}
                                    showReclip={!isCurrentUser}
                                    showSave={!hideSaveAction}
                                    showSaveLabel={!post.isBoosted}
                                    compact={Boolean(post.isBoosted)}
                                    tone="feed"
                                />
                            </View>
                            <FeedEngagementRightActions
                                shares={post.stats?.shares ?? 0}
                                onShare={() => {
                                    void openShare();
                                }}
                            />
                        </View>

                        <View style={styles.statsContainer}>
                            <Text style={styles.statsText}>
                                {post.stats.views} views • {post.stats.reclips} reclips
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </View>

            <Modal
                visible={commentsOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setCommentsOpen(false)}
                statusBarTranslucent
            >
                <KeyboardAvoidingView
                    style={styles.commentsModalRoot}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <Pressable
                        style={styles.commentsModalBackdrop}
                        onPress={() => setCommentsOpen(false)}
                    />
                    <View style={styles.commentsModalSheet}>
                        <PostCommentsSheet
                            postId={post.id}
                            post={post}
                            isOpen={commentsOpen}
                            variant="scenesEmbed"
                            commentAuthorHandle={user?.handle ?? ''}
                            currentUserHandle={user?.handle}
                            onAfterClose={() => {
                                fetchComments(post.id)
                                    .then((list) =>
                                        setPost((p) => {
                                            const next = p
                                                ? { ...p, stats: { ...p.stats, comments: list.length } }
                                                : null;
                                            syncPostOut(next);
                                            return next;
                                        }),
                                    )
                                    .catch(() => {});
                            }}
                            onClose={() => setCommentsOpen(false)}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <FeedShareModal
                post={post}
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                onShareSuccess={(postId) => {
                    setPost((p) =>
                        p && String(p.id) === String(postId)
                            ? { ...p, stats: { ...p.stats, shares: p.stats.shares + 1 } }
                            : p,
                    );
                }}
            />

            <PostOverflowMenuModal
                visible={overflowVisible}
                post={post}
                viewerUserId={userId}
                viewerHandle={user?.handle}
                isSaved={overflowSaved || hideSaveAction}
                hasNotifications={overflowNotify}
                onClose={() => setOverflowVisible(false)}
                onShare={openShare}
                onOpenSave={hideSaveAction ? undefined : () => setSaveModalVisible(true)}
                onSaveToggle={
                    hideSaveAction
                        ? undefined
                        : async () => {
                              await toggleCollectionsSave();
                              const cols = await getCollectionsForPost(userId, post.id);
                              setOverflowSaved(cols.length > 0);
                          }
                }
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
    pageFill: {
        flex: 1,
        backgroundColor: FEED_PAGE_BG,
    },
    centeredShell: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: FEED_PAGE_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.12)',
        backgroundColor: FEED_PAGE_BG,
    },
    headerSide: {
        width: ox(32),
        height: ox(32),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: ox(18),
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    page: {
        flex: 1,
        backgroundColor: FEED_PAGE_BG,
        paddingHorizontal: ox(16),
        paddingTop: ox(12),
        paddingBottom: ox(12),
    },
    card: {
        flex: 1,
        backgroundColor: FEED_CARD_BG,
        borderRadius: FEED_CARD_RADIUS,
        borderWidth: FEED_CARD_SHELL_BORDER_WIDTH,
        borderColor: FEED_CARD_SHELL_BORDER_COLOR,
        overflow: 'visible',
    },
    content: {
        flex: 1,
        backgroundColor: FEED_CARD_BG,
    },
    contentInner: {
        flexGrow: 1,
        paddingBottom: ox(20),
    },
    mediaWrap: {
        width: '100%',
        backgroundColor: '#000000',
        overflow: 'visible',
    },
    captionWrap: {
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
    },
    engagementBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(12),
        paddingVertical: ox(8),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.06)',
        minWidth: 0,
        backgroundColor: FEED_CARD_BG,
    },
    engagementLeft: {
        flex: 1,
        minWidth: 0,
        flexShrink: 1,
        marginRight: ox(8),
    },
    statsContainer: {
        paddingHorizontal: ox(12),
        paddingBottom: ox(12),
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
    commentsModalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    commentsModalBackdrop: {
        // Explicit rather than `...StyleSheet.absoluteFill`: that property is absent
        // from this RN version's StyleSheet type, and `absoluteFill` is a registered style ID
        // that cannot be spread inside StyleSheet.create.
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    commentsModalSheet: {
        height: '78%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
});
