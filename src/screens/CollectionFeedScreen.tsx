import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { getCollection, getCollectionPosts, type Collection } from '../api/collections';
import { decorateForUser } from '../api/posts';
import type { Post } from '../types';

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
            const decorated = collectionPosts.map(p => decorateForUser(user.id, p));
            setPosts(decorated);
        } catch (error) {
            console.error('Error loading collection:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{collectionName || 'Collection'}</Text>
                <View style={{ width: 24 }} />
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
                        {item.mediaUrl ? (
                            <Image source={{ uri: item.mediaUrl }} style={styles.postImage} />
                        ) : (
                            <View style={styles.postPlaceholder}>
                                <Icon name="image" size={24} color="#6B7280" />
                            </View>
                        )}
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="bookmark-outline" size={48} color="#6B7280" />
                        <Text style={styles.emptyText}>No posts in this collection yet</Text>
                    </View>
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
    infoContainer: {
        padding: 16,
    },
    postCount: {
        fontSize: 14,
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
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 16,
    },
});

