import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { FeedCard } from '../screens/FeedScreen';
import PostCommentsSheet from './PostCommentsSheet';
import FeedShareModal from './FeedShareModal';
import type { Post } from '../types';
import { incrementViews, toggleLike } from '../api/posts';
import { postHasVideoMedia } from '../utils/postMedia';
import { setActiveFeedVideoPostId } from '../utils/feedActiveVideoNative';

type Props = {
    visible: boolean;
    onClose: () => void;
    posts: Post[];
    initialPostId?: string | null;
    profileName: string;
    profileHandle: string;
    navigation: { navigate: (screen: string, params?: object) => void };
    onPostUpdated?: (post: Post) => void;
};

export default function ViewProfilePostsSheet({
    visible,
    onClose,
    posts,
    initialPostId,
    profileName,
    profileHandle,
    navigation,
    onPostUpdated,
}: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const topInset = Math.max(
        insets.top,
        Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0,
    );
    const listRef = useRef<FlatList<Post>>(null);
    const [feedPosts, setFeedPosts] = useState<Post[]>(posts);
    const [commentsPost, setCommentsPost] = useState<Post | null>(null);
    const [sharePost, setSharePost] = useState<Post | null>(null);
    const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
    const activeVideoPostIdRef = useRef<string | null>(null);
    activeVideoPostIdRef.current = activeVideoPostId;

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
        if (!visible) {
            activateVideo(null);
        }
    }, [activateVideo, visible]);

    useEffect(() => {
        if (!visible || feedPosts.length === 0) return;
        if (activeVideoPostIdRef.current) return;
        const tapped = initialPostId
            ? feedPosts.find((p) => String(p.id) === String(initialPostId))
            : feedPosts[0];
        if (tapped && postHasVideoMedia(tapped)) {
            activateVideo(String(tapped.id));
            return;
        }
        const firstVideo = feedPosts.find((p) => postHasVideoMedia(p));
        activateVideo(firstVideo ? String(firstVideo.id) : null);
    }, [activateVideo, visible, initialPostId, feedPosts]);

    useEffect(() => {
        if (!visible || !initialPostId || feedPosts.length === 0) return;
        const index = feedPosts.findIndex((p) => String(p.id) === String(initialPostId));
        if (index <= 0) return;
        const t = setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
        }, 120);
        return () => clearTimeout(t);
    }, [visible, initialPostId, feedPosts]);

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

    const handleLike = useCallback(
        async (post: Post) => {
            if (!user?.id) return;
            const prevLiked = post.userLiked === true;
            const prevLikes = post.stats?.likes ?? 0;
            const optimistic: Post = {
                ...post,
                userLiked: !prevLiked,
                stats: {
                    ...post.stats,
                    likes: Math.max(0, prevLikes + (prevLiked ? -1 : 1)),
                },
            };
            setFeedPosts((prev) => prev.map((p) => (p.id === post.id ? optimistic : p)));
            onPostUpdated?.(optimistic);
            try {
                const updated = await toggleLike(user.id, post.id, optimistic);
                const merged: Post = {
                    ...optimistic,
                    ...updated,
                    stats: {
                        ...optimistic.stats,
                        ...updated.stats,
                        likes:
                            typeof updated.stats?.likes === 'number'
                                ? updated.stats.likes
                                : optimistic.stats.likes,
                    },
                    userLiked: updated.userLiked ?? optimistic.userLiked,
                };
                setFeedPosts((prev) => prev.map((p) => (p.id === post.id ? merged : p)));
                onPostUpdated?.(merged);
            } catch {
                setFeedPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
                onPostUpdated?.(post);
            }
        },
        [onPostUpdated, user?.id]
    );

    return (
        <>
            <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
                <View style={styles.screen}>
                    <View
                        style={[
                            styles.headerSafe,
                            { paddingTop: topInset, zIndex: 80, elevation: 80 },
                        ]}
                    >
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <Image source={require('../assets/gazetteer-splash-logo.png')} style={styles.logo} />
                                <View>
                                    <Text style={styles.title}>{profileName}</Text>
                                    <Text style={styles.subtitle}>@{profileHandle.replace(/^@/, '')}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Icon name="close" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.listClip}>
                    <FlatList
                        ref={listRef}
                        data={feedPosts}
                        extraData={activeVideoPostId}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        viewabilityConfig={viewabilityConfig}
                        onViewableItemsChanged={onViewableItemsChanged}
                        onScrollToIndexFailed={(info) => {
                            listRef.current?.scrollToOffset({
                                offset: Math.max(0, info.averageItemLength * info.index),
                                animated: false,
                            });
                        }}
                        renderItem={({ item }) => (
                            <View style={{ overflow: 'hidden', flexDirection: 'column', position: 'relative' }}>
                                <FeedCard
                                    post={item}
                                    isCurrentUser={false}
                                    viewerHandle={user?.handle}
                                    viewerUserId={user?.id}
                                    isVideoActive={
                                        postHasVideoMedia(item) &&
                                        String(activeVideoPostId) === String(item.id)
                                    }
                                    onLike={() => handleLike(item)}
                                    onView={async () => {
                                        if (!user?.id) return;
                                        await incrementViews(user.id, item.id);
                                    }}
                                    onComment={() => setCommentsPost(item)}
                                    onShare={async () => setSharePost(item)}
                                    onReclip={async () => {}}
                                    onBookmark={async () => {}}
                                    onPostPress={() =>
                                        navigation.navigate('PostDetail', { postId: item.id, initialPost: item })
                                    }
                                    onVisitProfile={() => {}}
                                    onVisitHandle={(h) => navigation.navigate('ViewProfile', { handle: h })}
                                />
                            </View>
                        )}
                        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <Text style={styles.emptyText}>No posts to show.</Text>
                            </View>
                        }
                    />
                    </View>
                </View>
            </Modal>

            <PostCommentsSheet
                postId={commentsPost?.id ?? ''}
                post={commentsPost}
                isOpen={commentsPost !== null}
                onClose={() => setCommentsPost(null)}
                commentAuthorHandle={user?.handle || ''}
                currentUserHandle={user?.handle}
                onCommentCountChange={(n) => {
                    const pid = commentsPost?.id;
                    if (!pid) return;
                    const patch = (p: Post) =>
                        String(p.id) === String(pid)
                            ? { ...p, stats: { ...p.stats, comments: Math.max(0, n) } }
                            : p;
                    setCommentsPost((prev) => (prev ? patch(prev) : prev));
                    setFeedPosts((prev) => prev.map(patch));
                    if (commentsPost) {
                        onPostUpdated?.({
                            ...commentsPost,
                            stats: { ...commentsPost.stats, comments: Math.max(0, n) },
                        });
                    }
                }}
            />

            <FeedShareModal
                post={sharePost}
                isOpen={sharePost !== null}
                onClose={() => setSharePost(null)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#020617',
        overflow: 'hidden',
    },
    headerSafe: {
        backgroundColor: '#020617',
        overflow: 'hidden',
        borderBottomWidth: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    logo: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    title: {
        color: '#F3F4F6',
        fontSize: 16,
        fontWeight: '700',
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    closeButton: {
        padding: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    listClip: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#020617',
        zIndex: 0,
    },
    listContent: {
        paddingBottom: 24,
    },
    emptyWrap: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
});
