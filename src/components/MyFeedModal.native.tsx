import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import MyFeedPostCard from './MyFeedPostCard.native';
import PostCommentsSheet from './PostCommentsSheet';
import FeedShareModal from './FeedShareModal';
import PostOverflowMenuModal from './PostOverflowMenuModal';
import SavePostModal from './SavePostModal.native';
import EditPostModal from './EditPostModal.native';
import CreateGroupModal from './CreateGroupModal.native';
import type { Post } from '../types';
import { toggleLike, deletePost } from '../api/posts';
import { getCollectionsForPost } from '../api/collections';
import { updatePost as apiUpdatePost } from '../api/client';
import {
    markFeedPostArchivedMobile,
    setPostNotificationsPrefMobile,
    hasPostNotificationsPrefMobile,
} from '../utils/feedEngagementPrefsMobile';
import { postHasVideoMedia } from '../utils/postMedia';
import { setActiveFeedVideoPostId } from '../utils/feedActiveVideoNative';
import { ox } from '../constants/nativeOpticalScale';
import { GAZETTEER_ABYSS, gazetteerHeader, glassSurface } from '../theme/gazetteerAmbientNative';

type Props = {
    visible: boolean;
    onClose: () => void;
    posts: Post[];
    navigation: { navigate: (screen: string, params?: object) => void };
    onPostUpdated?: (post: Post) => void;
    onPostRemoved?: (postId: string) => void;
};

function MyFeedModal({
    visible,
    onClose,
    posts,
    navigation,
    onPostUpdated,
    onPostRemoved,
}: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const topInset = Math.max(
        insets.top,
        Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
        44,
    );

    const [feedPosts, setFeedPosts] = useState<Post[]>(posts);
    const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
    const activeVideoPostIdRef = useRef<string | null>(null);
    activeVideoPostIdRef.current = activeVideoPostId;

    const [commentsPost, setCommentsPost] = useState<Post | null>(null);
    const [sharePost, setSharePost] = useState<Post | null>(null);
    const [overflowPost, setOverflowPost] = useState<Post | null>(null);
    const [overflowVisible, setOverflowVisible] = useState(false);
    const [overflowSaved, setOverflowSaved] = useState(false);
    const [overflowNotify, setOverflowNotify] = useState(false);
    const [savePost, setSavePost] = useState<Post | null>(null);
    const [editPost, setEditPost] = useState<Post | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);

    const activateVideo = useCallback((postId: string | null) => {
        const next = postId ? String(postId) : null;
        activeVideoPostIdRef.current = next;
        setActiveVideoPostId(next);
        setActiveFeedVideoPostId(next);
    }, []);

    useEffect(() => {
        if (visible) setFeedPosts(posts);
    }, [visible, posts]);

    useEffect(() => {
        if (!visible) activateVideo(null);
    }, [activateVideo, visible]);

    useLayoutEffect(() => {
        if (!visible) return;
        const source = posts.length > 0 ? posts : feedPosts;
        if (source.length === 0) return;
        if (activeVideoPostIdRef.current) return;
        const firstVideo = source.find((p) => postHasVideoMedia(p));
        activateVideo(firstVideo ? String(firstVideo.id) : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activateVideo, visible]);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 60,
        minimumViewTime: 80,
    }).current;

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
            const visibleVideos = viewableItems
                .filter((token) => token.isViewable && token.item && postHasVideoMedia(token.item as Post))
                .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
            const next = visibleVideos[0]?.item as Post | undefined;
            if (next) activateVideo(String(next.id));
        },
    ).current;

    const applyLocalPost = useCallback(
        (updated: Post) => {
            setFeedPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            onPostUpdated?.(updated);
        },
        [onPostUpdated],
    );

    const removeLocalPost = useCallback(
        (postId: string) => {
            setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
            onPostRemoved?.(postId);
        },
        [onPostRemoved],
    );

    const handleClose = useCallback(() => {
        activateVideo(null);
        onClose();
    }, [activateVideo, onClose]);

    const handleLike = useCallback(
        async (post: Post) => {
            if (!user?.id) return;
            const updated = await toggleLike(user.id, post.id, post);
            applyLocalPost(updated);
        },
        [applyLocalPost, user?.id],
    );

    const renderItem = useCallback(
        ({ item }: { item: Post }) => {
            const active =
                postHasVideoMedia(item) && String(activeVideoPostId) === String(item.id);
            return (
                <MyFeedPostCard
                    post={item}
                    user={user}
                    isActive={active && visible}
                    onPress={() =>
                        navigation.navigate('PostDetail', { postId: item.id, initialPost: item })
                    }
                    onLikePress={() => void handleLike(item)}
                    onCommentPress={() => setCommentsPost(item)}
                    onBookmarkPress={() => setSavePost(item)}
                    onOverflowPress={() => {
                        setOverflowPost(item);
                        setOverflowVisible(true);
                        void getCollectionsForPost(user?.id || 'anon', item.id).then((cols) =>
                            setOverflowSaved(cols.length > 0),
                        );
                        void hasPostNotificationsPrefMobile(user?.id || 'anon', item.id).then(
                            setOverflowNotify,
                        );
                    }}
                    onShareToStoriesSuccess={(postId) => {
                        const current = feedPosts.find((p) => p.id === postId);
                        if (!current) return;
                        applyLocalPost({
                            ...current,
                            stats: {
                                ...current.stats,
                                shares: (current.stats?.shares ?? 0) + 1,
                            },
                        });
                    }}
                />
            );
        },
        [activeVideoPostId, applyLocalPost, feedPosts, handleLike, navigation, user, visible],
    );

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                transparent={false}
                statusBarTranslucent
                onRequestClose={handleClose}
            >
                <View style={styles.screen}>
                    <View style={[styles.headerSafe, { paddingTop: topInset }]}>
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <Image
                                    source={require('../assets/gazetteer-splash-logo.png')}
                                    style={styles.logo}
                                />
                                <Text style={styles.title}>My feed</Text>
                            </View>
                            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                                <Icon name="close" size={ox(22)} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {visible ? (
                        <FlatList
                            style={styles.list}
                            data={feedPosts}
                            extraData={activeVideoPostId}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            viewabilityConfig={viewabilityConfig}
                            onViewableItemsChanged={onViewableItemsChanged}
                            initialNumToRender={4}
                            maxToRenderPerBatch={4}
                            windowSize={5}
                            removeClippedSubviews={false}
                            ListEmptyComponent={
                                <View style={styles.emptyWrap}>
                                    <Text style={styles.emptyText}>You have not posted anything yet.</Text>
                                </View>
                            }
                        />
                    ) : null}
                </View>
            </Modal>

            <PostCommentsSheet
                postId={commentsPost?.id ?? ''}
                post={commentsPost}
                isOpen={commentsPost !== null}
                onClose={() => setCommentsPost(null)}
                commentAuthorHandle={user?.handle || ''}
                currentUserHandle={user?.handle}
            />

            <FeedShareModal
                post={sharePost || ({} as Post)}
                isOpen={!!sharePost}
                onClose={() => setSharePost(null)}
                onShareSuccess={(postId) => {
                    const current = feedPosts.find((p) => p.id === postId);
                    if (!current) return;
                    applyLocalPost({
                        ...current,
                        stats: {
                            ...current.stats,
                            shares: (current.stats?.shares ?? 0) + 1,
                        },
                    });
                }}
            />

            <PostOverflowMenuModal
                visible={overflowVisible}
                post={overflowPost}
                viewerUserId={user?.id || 'anon'}
                viewerHandle={user?.handle}
                isSaved={overflowSaved}
                hasNotifications={overflowNotify}
                onClose={() => {
                    setOverflowVisible(false);
                    setOverflowPost(null);
                }}
                onOpenSave={() => overflowPost && setSavePost(overflowPost)}
                onShare={async () => {
                    if (!overflowPost) return;
                    setSharePost(overflowPost);
                }}
                onBoost={() => {
                    setOverflowVisible(false);
                    navigation.navigate('Boost');
                }}
                onEdit={() => overflowPost && setEditPost(overflowPost)}
                onCreateGroup={() => setCreateGroupOpen(true)}
                onArchive={async () => {
                    if (!overflowPost || !user?.id) return;
                    await markFeedPostArchivedMobile(user.id, overflowPost.id);
                    removeLocalPost(overflowPost.id);
                }}
                onToggleNotifications={async () => {
                    if (!overflowPost || !user?.id) return;
                    const next = !overflowNotify;
                    await setPostNotificationsPrefMobile(user.id, overflowPost.id, next);
                    setOverflowNotify(next);
                }}
                onDelete={() =>
                    new Promise<void>((resolve) => {
                        if (!overflowPost || !user?.handle) {
                            resolve();
                            return;
                        }
                        const target = overflowPost;
                        Alert.alert('Delete post?', 'This cannot be undone.', [
                            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => {
                                    void (async () => {
                                        try {
                                            await deletePost(user.id, target.id, user.handle);
                                            removeLocalPost(target.id);
                                        } finally {
                                            resolve();
                                        }
                                    })();
                                },
                            },
                        ]);
                    })
                }
            />

            {savePost ? (
                <SavePostModal
                    post={savePost}
                    userId={user?.id || 'anon'}
                    visible={!!savePost}
                    onClose={() => setSavePost(null)}
                    onSaved={async () => {
                        const cols = await getCollectionsForPost(user?.id || 'anon', savePost.id);
                        applyLocalPost({ ...savePost, isBookmarked: cols.length > 0 });
                    }}
                />
            ) : null}

            {editPost ? (
                <EditPostModal
                    post={editPost}
                    visible={!!editPost}
                    onClose={() => setEditPost(null)}
                    onSave={async (text, location, venue, landmark) => {
                        await apiUpdatePost(editPost.id, {
                            text,
                            location,
                            venue: venue || undefined,
                            landmark: landmark || undefined,
                        });
                        applyLocalPost({
                            ...editPost,
                            text,
                            caption: text,
                            locationLabel: location,
                            venue,
                            landmark,
                        });
                    }}
                />
            ) : null}

            <CreateGroupModal
                visible={createGroupOpen}
                onClose={() => setCreateGroupOpen(false)}
                onCreated={(g) => {
                    setCreateGroupOpen(false);
                    navigation.navigate('Messages', { chatGroupId: g.id, kind: 'group' });
                }}
            />
        </>
    );
}

export default React.memo(MyFeedModal);

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: GAZETTEER_ABYSS,
    },
    list: {
        flex: 1,
    },
    headerSafe: {
        backgroundColor: GAZETTEER_ABYSS,
        zIndex: 80,
        elevation: 80,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(14),
        paddingVertical: ox(10),
        ...gazetteerHeader,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    logo: {
        width: ox(32),
        height: ox(32),
        borderRadius: ox(8),
    },
    title: {
        fontSize: ox(22),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButton: {
        borderRadius: ox(999),
        padding: ox(8),
        ...glassSurface,
    },
    listContent: {
        paddingHorizontal: ox(12),
        paddingBottom: ox(28),
        rowGap: ox(12),
    },
    emptyWrap: {
        padding: ox(40),
        alignItems: 'center',
    },
    emptyText: {
        fontSize: ox(16),
        color: '#6B7280',
    },
});
