import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { FeedCard } from '../screens/FeedScreen';
import PostCommentsSheet from './PostCommentsSheet';
import FeedShareModal from './FeedShareModal';
import type { Post } from '../types';
import { incrementViews, toggleLike } from '../api/posts';

type Props = {
    visible: boolean;
    onClose: () => void;
    posts: Post[];
    initialPostId?: string | null;
    profileName: string;
    profileHandle: string;
    navigation: { navigate: (screen: string, params?: object) => void };
};

export default function ViewProfilePostsSheet({
    visible,
    onClose,
    posts,
    initialPostId,
    profileName,
    profileHandle,
    navigation,
}: Props) {
    const { user } = useAuth();
    const listRef = useRef<FlatList<Post>>(null);
    const [feedPosts, setFeedPosts] = useState<Post[]>(posts);
    const [commentsPost, setCommentsPost] = useState<Post | null>(null);
    const [sharePost, setSharePost] = useState<Post | null>(null);

    useEffect(() => {
        if (visible) setFeedPosts(posts);
    }, [visible, posts]);

    useEffect(() => {
        if (!visible || !initialPostId || feedPosts.length === 0) return;
        const index = feedPosts.findIndex((p) => String(p.id) === String(initialPostId));
        if (index <= 0) return;
        const t = setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
        }, 120);
        return () => clearTimeout(t);
    }, [visible, initialPostId, feedPosts]);

    const handleLike = useCallback(
        async (post: Post) => {
            if (!user?.id) return;
            const updated = await toggleLike(user.id, post.id, post);
            setFeedPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
        },
        [user?.id]
    );

    return (
        <>
            <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
                <SafeAreaView style={styles.screen}>
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

                    <FlatList
                        ref={listRef}
                        data={feedPosts}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        onScrollToIndexFailed={(info) => {
                            listRef.current?.scrollToOffset({
                                offset: Math.max(0, info.averageItemLength * info.index),
                                animated: false,
                            });
                        }}
                        renderItem={({ item }) => (
                            <FeedCard
                                post={item}
                                isCurrentUser={false}
                                viewerHandle={user?.handle}
                                viewerUserId={user?.id}
                                onLike={() => handleLike(item)}
                                onView={async () => {
                                    if (!user?.id) return;
                                    await incrementViews(user.id, item.id);
                                }}
                                onComment={() => setCommentsPost(item)}
                                onShare={async () => setSharePost(item)}
                                onReclip={async () => {}}
                                onBookmark={async () => {}}
                                onPostPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                                onVisitProfile={() => {}}
                                onVisitHandle={(h) => navigation.navigate('ViewProfile', { handle: h })}
                            />
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <Text style={styles.emptyText}>No posts to show.</Text>
                            </View>
                        }
                    />
                </SafeAreaView>
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
