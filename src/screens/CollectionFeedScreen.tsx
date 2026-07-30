import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { getCollection, getCollectionPosts } from '../api/collections';
import type { Collection, Post } from '../types';
import ProfileGridThumb from '../components/ProfileGridThumb.native';
import { ox } from '../constants/nativeOpticalScale';

export default function CollectionFeedScreen({ route, navigation }: any) {
    const { collectionId, collectionName } = route.params;
    const { user } = useAuth();
    const [collection, setCollection] = useState<Collection | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCollection();
    }, [collectionId]);

    const loadCollection = async () => {
        if (!collectionId || !user?.id) return;
        setLoading(true);
        try {
            const coll = await getCollection(collectionId);
            setCollection(coll);
            
            // Fetch posts for this collection
            const collectionPosts = await getCollectionPosts(collectionId);
            setPosts(collectionPosts);
        } catch (error) {
            console.error('Error loading collection:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <GazetteerScreenShell contentStyle={styles.loadingShell}>
                <ActivityIndicator size="large" color="#f472b6" />
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={ox(24)} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{collectionName || 'Collection'}</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="close" size={ox(24)} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.postCount}>
                    {collection?.postIds?.length || 0} {collection?.postIds?.length === 1 ? 'post' : 'posts'}
                </Text>
            </View>

            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                numColumns={3}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.postItem}
                        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                    >
                        <ProfileGridThumb post={item} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="bookmark-outline" size={ox(48)} color="#6B7280" />
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
        padding: ox(16),
        ...gazetteerHeader,
    },
    headerTitle: {
        fontSize: ox(18),
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    infoContainer: {
        padding: ox(16),
    },
    postCount: {
        fontSize: ox(14),
        color: '#9CA3AF',
    },
    postItem: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    postImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    postPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(40),
    },
    emptyText: {
        fontSize: ox(16),
        color: '#6B7280',
        marginTop: ox(16),
    },
});

