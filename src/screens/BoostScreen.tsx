import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { fetchPostsByUserFromApi, decorateForUser } from '../api/posts';
import type { Post } from '../types';

const BoostScreen: React.FC = ({ navigation }: any) => {
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadUserPosts();
    }, [user?.handle]);

    const loadUserPosts = async () => {
        if (!user?.handle) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Prefer real backend posts when Laravel API is available,
            // but fall back to mock/local posts when offline so Boost stays fast while you build.
            const userPosts = await fetchPostsByUserFromApi(user.handle, 50);
            const decorated = userPosts.map(p => decorateForUser(userId, p));
            setPosts(decorated);
        } catch (err) {
            console.error('Error loading user posts:', err);
            setError('Failed to load your posts');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Please sign in to view your posts</Text>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>{error}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Your Posts</Text>
                <Text style={styles.subtitle}>Boost your posts to reach more people</Text>
            </View>

            {posts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>You haven't created any posts yet.</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Create')}
                        style={styles.createButton}
                    >
                        <Text style={styles.createButtonText}>Create Your First Post</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.postCard}>
                            <View style={styles.postHeader}>
                                {item.mediaUrl && !item.mediaUrl.startsWith('blob:') ? (
                                    <Image source={{ uri: item.mediaUrl }} style={styles.postThumbnail} />
                                ) : (
                                    <View style={[styles.postThumbnail, { alignItems: 'center', justifyContent: 'center' }]}>
                                        <Icon name="videocam" size={24} color="#6B7280" />
                                    </View>
                                )}
                                <View style={styles.postInfo}>
                                    <Text style={styles.postText} numberOfLines={2}>
                                        {item.text || 'No caption'}
                                    </Text>
                                    <View style={styles.postStats}>
                                        <Icon name="eye" size={16} color="#9CA3AF" />
                                        <Text style={styles.statText}>{item.stats.views} views</Text>
                                        <Icon name="heart" size={16} color="#9CA3AF" />
                                        <Text style={styles.statText}>{item.stats.likes} likes</Text>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    // Navigate to boost modal
                                    navigation.navigate('PostDetail', { postId: item.id });
                                }}
                                style={styles.boostButton}
                            >
                                <Icon name="flash" size={20} color="#FFFFFF" />
                                <Text style={styles.boostButtonText}>
                                    {item.isBoosted ? 'Boosted' : 'Boost Post'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#9CA3AF',
        marginBottom: 24,
        textAlign: 'center',
    },
    createButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
    },
    createButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    postCard: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    postHeader: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    postThumbnail: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#111827',
    },
    postInfo: {
        flex: 1,
    },
    postText: {
        fontSize: 14,
        color: '#FFFFFF',
        marginBottom: 8,
    },
    postStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    boostButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        backgroundColor: '#8B5CF6',
        borderRadius: 8,
    },
    boostButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
        marginTop: 40,
    },
});

export default BoostScreen;
