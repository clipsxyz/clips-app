import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { useAuth } from '../context/Auth';
import { getCollection, getCollectionPosts } from '../api/collections';
import { upsertLocalPost } from '../api/posts';
import { subscribeScenesPostUpdates } from '../utils/scenesPostSyncNative';
import type { Collection, Post } from '../types';
import ProfileGridThumb from '../components/ProfileGridThumb.native';
import { ox } from '../constants/nativeOpticalScale';

export default function CollectionFeedScreen({ route, navigation }: any) {
    const collectionId = String(route.params?.collectionId ?? route.params?.slug ?? '').trim();
    const collectionName = typeof route.params?.collectionName === 'string' ? route.params.collectionName : undefined;
    const initialCollection =
        route.params?.initialCollection && typeof route.params.initialCollection === 'object'
            ? (route.params.initialCollection as Collection)
            : null;
    const { user } = useAuth();
    const [collection, setCollection] = useState<Collection | null>(initialCollection);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const loadCollection = useCallback(async () => {
        const lookupId = collectionId || String(initialCollection?.id ?? '').trim();
        if (!lookupId && !collectionName) {
            setCollection(initialCollection);
            setPosts([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const coll =
                (await getCollection(lookupId, collectionName)) ||
                initialCollection;
            setCollection(coll);
            const collectionPosts = await getCollectionPosts(lookupId, collectionName);
            setPosts(collectionPosts);
        } catch (error) {
            console.error('Error loading collection:', error);
            setCollection(initialCollection);
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, [collectionId, collectionName, initialCollection, user?.id]);

    useEffect(() => {
        void loadCollection();
    }, [loadCollection]);

    useEffect(
        () =>
            subscribeScenesPostUpdates((updates) => {
                if (!updates.length) return;
                setPosts((prev) =>
                    prev.map((p) => {
                        const next = updates.find((u) => u.id === p.id);
                        if (!next) return p;
                        return {
                            ...p,
                            ...next,
                            stats: { ...p.stats, ...next.stats },
                        };
                    }),
                );
            }),
        [],
    );

    useFocusEffect(
        useCallback(() => {
            const lookupId = collectionId || String(initialCollection?.id ?? '').trim();
            if (!lookupId && !collectionName) return;
            void getCollectionPosts(lookupId, collectionName)
                .then(setPosts)
                .catch(() => {});
        }, [collectionId, collectionName, initialCollection, user?.id]),
    );

    if (loading) {
        return (
            <GazetteerScreenShell ambientVariant="passport" contentStyle={styles.loadingShell}>
                <ActivityIndicator size="large" color="#f472b6" />
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell ambientVariant="passport">
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
                    <Icon name="arrow-back" size={ox(24)} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {collectionName || collection?.name || 'Collection'}
                </Text>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
                    <Icon name="close" size={ox(24)} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.postCount}>
                    {posts.length || collection?.postIds?.length || 0}{' '}
                    {(posts.length || collection?.postIds?.length || 0) === 1 ? 'post' : 'posts'}
                </Text>
            </View>

            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                numColumns={3}
                style={styles.list}
                contentContainerStyle={posts.length === 0 ? styles.listEmpty : undefined}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.postItem}
                        activeOpacity={0.85}
                        onPress={() => {
                            upsertLocalPost(item);
                            navigation.navigate('PostDetail', {
                                postId: item.id,
                                fromCollection: true,
                                collectionId,
                                initialPost: item,
                            });
                        }}
                    >
                        <ProfileGridThumb post={item} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="bookmark-outline" size={ox(48)} color="#9CA3AF" />
                        <Text style={styles.emptyText}>No posts in this collection yet</Text>
                    </View>
                }
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    loadingShell: {
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
        gap: ox(12),
    },
    headerTitle: {
        flex: 1,
        fontSize: ox(18),
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    infoContainer: {
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        backgroundColor: 'transparent',
    },
    postCount: {
        fontSize: ox(14),
        color: '#9CA3AF',
        fontWeight: '500',
    },
    list: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    listEmpty: {
        flexGrow: 1,
    },
    postItem: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(40),
    },
    emptyText: {
        fontSize: ox(16),
        color: '#9CA3AF',
        marginTop: ox(16),
        textAlign: 'center',
    },
});
