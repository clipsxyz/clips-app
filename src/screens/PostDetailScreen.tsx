import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getAvatarForHandle } from '../api/users';
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
import { flushScenesPostUpdates, setScenesPostUpdate } from '../utils/scenesPostSyncNative';
import { ox } from '../constants/nativeOpticalScale';

export default function PostDetailScreen({ route, navigation }: any) {
    const { postId, openComments, fromCollection, initialPost } = route.params || {};
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const screenWidth = Dimensions.get('window').width;
    const hideSaveAction = Boolean(fromCollection);

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

    useFocusEffect(
        useCallback(() => {
            return () => {
                flushScenesPostUpdates();
            };
        }, []),
    );

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

            // Prefer the collection grid snapshot when present — getPostById can return a
            // thinner/stale in-memory row for videos after save-time caching.
            if (fromCollection && initialPost && String(initialPost.id) === String(postId)) {
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
                // Re-decorate after upsert so like/bookmark flags stay correct.
                const fresh = await getPostById(postId, userId);
                if (fresh) loadedPost = fresh;
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
        if (!post) return;
        try {
            const updated = await toggleLike(userId, post.id, post);
            setPost(updated);
            syncPostOut(updated);
        } catch (err) {
            console.error('Error liking post:', err);
        }
    };

    const tryReclip = async () => {
        if (!post || !user?.handle) return;
        const norm = (h?: string) => String(h || '').trim().toLowerCase();
        if (norm(post.userHandle) === norm(user.handle)) {
            Alert.alert('Cannot reclip', 'You cannot reclip your own post.');
            return;
        }
        if (post.userReclipped) {
            Alert.alert('Already reclipped', 'You have already reclipped this post.');
            return;
        }
        const prevReclips = post.stats.reclips;
        const newReclips = prevReclips + 1;
        setReclipState(userId, post.id, true);
        setPost((p) => {
            const next = p
                ? {
                      ...p,
                      userReclipped: true,
                      stats: { ...p.stats, reclips: newReclips },
                  }
                : null;
            syncPostOut(next);
            return next;
        });
        try {
            const result = await reclipPost(userId, post.id, user.handle);
            if (result.originalPost) setPost(result.originalPost);
        } catch (err: any) {
            console.warn('Reclip failed:', err);
            setReclipState(userId, post.id, false);
            setPost((p) =>
                p
                    ? {
                          ...p,
                          userReclipped: false,
                          stats: { ...p.stats, reclips: prevReclips },
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
            <GazetteerScreenShell ambientVariant="passport" contentStyle={styles.centeredShell}>
                <ActivityIndicator size="large" color="#f472b6" />
            </GazetteerScreenShell>
        );
    }

    if (!post) {
        return (
            <GazetteerScreenShell ambientVariant="passport" contentStyle={styles.centeredShell}>
                <Text style={styles.errorText}>Post not found</Text>
            </GazetteerScreenShell>
        );
    }

    const textOnlyPost = isTextOnlyPost(post);
    const hasPostMedia =
        textOnlyPost || Boolean(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0));
    const windowHeight = Dimensions.get('window').height;
    const detailMediaHeight = textOnlyPost
        ? Math.min(screenWidth * 0.55, windowHeight * 0.32)
        : fromCollection
          ? Math.min(mediaHeight, windowHeight * 0.46)
          : mediaHeight;

    return (
        <GazetteerScreenShell ambientVariant="passport">
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={ox(24)} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post</Text>
                <TouchableOpacity
                    onPress={() => setOverflowVisible(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Icon name="list-outline" size={ox(22)} color="#E5E7EB" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={[
                    styles.contentInner,
                    fromCollection ? styles.contentInnerCentered : null,
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={fromCollection ? styles.postStage : undefined}>
                    <View style={styles.postHeader}>
                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate('ViewProfile', { handle: post.userHandle })
                            }
                        >
                            <Avatar
                                src={getAvatarForHandle(post.userHandle)}
                                name={post.userHandle.split('@')[0]}
                                size={ox(40)}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.postHeaderInfo}
                            onPress={() =>
                                navigation.navigate('ViewProfile', { handle: post.userHandle })
                            }
                        >
                            <Text style={styles.userHandle}>{post.userHandle}</Text>
                            <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
                        </TouchableOpacity>
                    </View>

                    {hasPostMedia ? (
                        <>
                            <View
                                style={[
                                    styles.mediaWrap,
                                    fromCollection ? styles.mediaWrapCentered : null,
                                ]}
                            >
                                <FeedPostMedia
                                    post={post}
                                    carouselIndex={carouselIndex}
                                    onCarouselIndexChange={setCarouselIndex}
                                    width={
                                        fromCollection
                                            ? screenWidth - ox(24)
                                            : screenWidth
                                    }
                                    height={detailMediaHeight}
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
                                <Icon
                                    name="chatbubble-outline"
                                    size={FEED_UI.icon.action}
                                    color="#FFFFFF"
                                />
                                <Text style={styles.actionText}>{post.stats.comments}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={openShare} style={styles.actionButton}>
                                <Icon
                                    name="share-outline"
                                    size={FEED_UI.icon.action}
                                    color="#FFFFFF"
                                />
                                <Text style={styles.actionText}>{post.stats.shares}</Text>
                            </TouchableOpacity>
                        </View>

                        {!hideSaveAction ? (
                            <TouchableOpacity onPress={toggleCollectionsSave}>
                                <Icon
                                    name={post.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                                    size={FEED_UI.icon.action}
                                    color={post.isBookmarked ? '#8B5CF6' : '#FFFFFF'}
                                />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <View style={styles.statsContainer}>
                        <Text style={styles.statsText}>
                            {post.stats.views} views • {post.stats.reclips} reclips
                        </Text>
                    </View>
                </View>
            </ScrollView>

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
        paddingHorizontal: ox(16),
        paddingVertical: ox(14),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontSize: ox(18),
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    contentInner: {
        flexGrow: 1,
        paddingBottom: ox(28),
    },
    contentInnerCentered: {
        justifyContent: 'center',
        paddingVertical: ox(20),
    },
    postStage: {
        marginHorizontal: ox(12),
        borderRadius: ox(18),
        overflow: 'hidden',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingBottom: ox(8),
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
    mediaWrapCentered: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderRadius: ox(12),
        overflow: 'hidden',
        marginHorizontal: ox(10),
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
    commentsModalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    commentsModalBackdrop: {
        ...StyleSheet.absoluteFillObject,
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
