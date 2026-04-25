import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, decorateForUser } from '../api/posts';
import type { Post } from '../types';
import BoostSelectionModal from '../components/BoostSelectionModal';
import { getBoostAnalytics, type BoostAnalytics } from '../api/boost';

const BoostScreen: React.FC = ({ navigation }: any) => {
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [analyticsByPostId, setAnalyticsByPostId] = useState<Record<string, BoostAnalytics>>({});
    const [analyticsLoadingPostId, setAnalyticsLoadingPostId] = useState<string | null>(null);

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
            const userPosts = await fetchPostsByUser(user.handle, 50);
            const decorated = userPosts.map(p => decorateForUser(userId, p));
            setPosts(decorated);
        } catch (err) {
            console.error('Error loading user posts:', err);
            setError('Failed to load your posts');
        } finally {
            setLoading(false);
        }
    };

    const openBoostModal = (post: Post) => {
        setSelectedPost(post);
        setShowBoostModal(true);
    };

    const closeBoostModal = () => {
        setShowBoostModal(false);
        setSelectedPost(null);
    };

    const handleLoadInsights = async (postId: string) => {
        setAnalyticsLoadingPostId(postId);
        try {
            const analytics = await getBoostAnalytics(postId);
            setAnalyticsByPostId((prev) => ({ ...prev, [postId]: analytics }));
        } catch (err) {
            console.error('Failed to load boost insights', err);
        } finally {
            setAnalyticsLoadingPostId(null);
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
                        onPress={() => navigation.navigate('CreateComposer')}
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
                        <View
                            style={[
                                styles.postCard,
                                showBoostModal && selectedPost?.id === item.id ? styles.postCardSelected : null,
                            ]}
                        >
                            <View style={styles.postHeader}>
                                {item.mediaUrl && (
                                    <Image source={{ uri: item.mediaUrl }} style={styles.postThumbnail} />
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
                                    {showBoostModal && selectedPost?.id === item.id ? (
                                        <Text style={styles.selectedHintText}>Selected for boost</Text>
                                    ) : null}
                                </View>
                            </View>
                            <View style={styles.postActionsRow}>
                                <TouchableOpacity
                                    onPress={() => {
                                        void handleLoadInsights(item.id);
                                    }}
                                    style={styles.secondaryButton}
                                >
                                    {analyticsLoadingPostId === item.id ? (
                                        <ActivityIndicator size="small" color="#93C5FD" />
                                    ) : (
                                        <>
                                            <Icon name="stats-chart" size={16} color="#93C5FD" />
                                            <Text style={styles.secondaryButtonText}>View Insights</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                            {analyticsByPostId[item.id] && (
                                <View style={styles.analyticsCard}>
                                    {analyticsByPostId[item.id]?.hasBoost && analyticsByPostId[item.id]?.analytics ? (
                                        <>
                                            <Text style={styles.analyticsTitle}>
                                                {analyticsByPostId[item.id]?.isActive ? 'Boost Insights (Active)' : 'Boost Insights'}
                                            </Text>
                                            <View style={styles.analyticsGrid}>
                                                <Text style={styles.analyticsMetric}>Impressions: {analyticsByPostId[item.id]?.analytics?.impressions ?? 0}</Text>
                                                <Text style={styles.analyticsMetric}>Likes: {analyticsByPostId[item.id]?.analytics?.likes ?? 0}</Text>
                                                <Text style={styles.analyticsMetric}>Comments: {analyticsByPostId[item.id]?.analytics?.comments ?? 0}</Text>
                                                <Text style={styles.analyticsMetric}>Shares: {analyticsByPostId[item.id]?.analytics?.shares ?? 0}</Text>
                                                <Text style={styles.analyticsMetric}>Profile visits: {analyticsByPostId[item.id]?.analytics?.profileVisits ?? 0}</Text>
                                                <Text style={styles.analyticsMetric}>
                                                    Spend: {analyticsByPostId[item.id]?.spendEur != null ? `EUR ${analyticsByPostId[item.id].spendEur!.toFixed(2)}` : '--'}
                                                </Text>
                                            </View>
                                        </>
                                    ) : (
                                        <Text style={styles.analyticsEmptyText}>No boost analytics yet for this post.</Text>
                                    )}
                                </View>
                            )}
                            <TouchableOpacity
                                onPress={() => {
                                    openBoostModal(item);
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
            <BoostSelectionModal
                isOpen={showBoostModal}
                post={selectedPost}
                onClose={closeBoostModal}
                onSelect={(feedType, price, meta) => {
                    setShowBoostModal(false);
                    navigation.navigate('Payment', {
                        postId: selectedPost?.id,
                        boostFeedType: feedType,
                        boostAmount: price,
                        boostMeta: meta,
                    });
                }}
            />
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
    postCardSelected: {
        borderColor: '#38BDF8',
        borderWidth: 1,
        borderRadius: 12,
        marginHorizontal: 10,
        marginVertical: 6,
        backgroundColor: 'rgba(14,165,233,0.08)',
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
    selectedHintText: {
        marginTop: 8,
        fontSize: 12,
        color: '#67E8F9',
        fontWeight: '600',
    },
    postActionsRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1D4ED8',
        backgroundColor: 'rgba(37,99,235,0.15)',
    },
    secondaryButtonText: {
        color: '#93C5FD',
        fontSize: 13,
        fontWeight: '600',
    },
    analyticsCard: {
        borderWidth: 1,
        borderColor: '#334155',
        backgroundColor: '#111827',
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    analyticsTitle: {
        color: '#E2E8F0',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 6,
    },
    analyticsGrid: {
        gap: 4,
    },
    analyticsMetric: {
        color: '#CBD5E1',
        fontSize: 12,
    },
    analyticsEmptyText: {
        color: '#94A3B8',
        fontSize: 12,
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
