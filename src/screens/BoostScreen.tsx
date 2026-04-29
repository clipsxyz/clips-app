import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, decorateForUser } from '../api/posts';
import type { Post } from '../types';
import BoostSelectionModal from '../components/BoostSelectionModal';
import { getBoostAnalytics, type BoostAnalytics } from '../api/boost';

function buildInstantAnalytics(post: Post): BoostAnalytics {
    return {
        hasBoost: !!post.isBoosted || !!post.boostFeedType,
        isActive: !!post.isBoosted,
        postId: post.id,
        range: 'all',
        feedType: (post.boostFeedType as any) || null,
        activatedAt: null,
        expiresAt: null,
        spendEur: 0,
        analytics: {
            impressions: Number(post.stats.views || 0),
            likes: Number(post.stats.likes || 0),
            comments: Number(post.stats.comments || 0),
            shares: Number(post.stats.shares || 0),
            profileVisits: 0,
            messageStarts: 0,
            costPerProfileVisit: null,
            costPerMessageStart: null,
            trend: { impressions: [] },
            sourceMatchedEventsCount: 0,
        },
    };
}

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
    const [boostFilter, setBoostFilter] = useState<'all' | 'ready' | 'active' | 'ended'>('all');
    const [boostSort, setBoostSort] = useState<'best' | 'recent'>('best');
    const [insightsRange, setInsightsRange] = useState<'24h' | '7d' | 'all'>('24h');
    const analyticsCacheRef = useRef<Map<string, { data: BoostAnalytics; ts: number }>>(new Map());

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

    const classifyBoostStatus = useCallback((p: Post): 'ready' | 'active' | 'ended' => {
        if (p.isBoosted) return 'active';
        if (p.boostFeedType && !p.isBoosted) return 'ended';
        return 'ready';
    }, []);

    const qualityScore = useCallback((p: Post): number => {
        const views = Math.max(1, p.stats.views || 1);
        const engagement = (p.stats.likes + p.stats.comments + p.stats.shares) / views;
        const recencyBoost = Math.max(0, 1 - ((Date.now() - (p.createdAt || 0)) / (1000 * 60 * 60 * 24 * 14)));
        return engagement * 100 + recencyBoost * 10 + Math.log10(views + 10);
    }, []);

    const filteredPosts = useMemo(() => {
        if (boostFilter === 'all') return posts;
        return posts.filter((p) => classifyBoostStatus(p) === boostFilter);
    }, [posts, boostFilter, classifyBoostStatus]);

    const sortedPosts = useMemo(() => {
        const next = [...filteredPosts];
        if (boostSort === 'recent') {
            next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return next;
        }
        next.sort((a, b) => qualityScore(b) - qualityScore(a));
        return next;
    }, [filteredPosts, boostSort, qualityScore]);

    const boostSummary = useMemo(() => {
        const active = posts.filter((p) => classifyBoostStatus(p) === 'active').length;
        const ready = posts.filter((p) => classifyBoostStatus(p) === 'ready').length;
        const ended = posts.filter((p) => classifyBoostStatus(p) === 'ended').length;
        return { active, ready, ended, total: posts.length };
    }, [posts, classifyBoostStatus]);

    const getInsightsCached = useCallback(async (postId: string) => {
        const key = `${insightsRange}:${postId}`;
        const cached = analyticsCacheRef.current.get(key);
        const ttlMs = 60 * 1000;
        if (cached && Date.now() - cached.ts < ttlMs) return cached.data;
        const data = await getBoostAnalytics(postId, insightsRange);
        analyticsCacheRef.current.set(key, { data, ts: Date.now() });
        return data;
    }, [insightsRange]);

    useEffect(() => {
        sortedPosts.slice(0, 8).forEach((p) => {
            void getInsightsCached(p.id)
                .then((analytics) => {
                    setAnalyticsByPostId((prev) => ({ ...prev, [p.id]: prev[p.id] || analytics }));
                })
                .catch(() => {});
        });
    }, [sortedPosts, getInsightsCached]);

    const handleLoadInsights = async (postId: string) => {
        const post = posts.find((p) => p.id === postId);
        if (post) {
            setAnalyticsByPostId((prev) => ({ ...prev, [postId]: prev[postId] || buildInstantAnalytics(post) }));
        }
        setAnalyticsLoadingPostId(postId);
        try {
            const analytics = await getInsightsCached(postId);
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
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryText}>Active: {boostSummary.active}</Text>
                    <Text style={styles.summaryText}>Ready: {boostSummary.ready}</Text>
                    <Text style={styles.summaryText}>Ended: {boostSummary.ended}</Text>
                </View>
                <View style={styles.chipsRow}>
                    {([
                        { id: 'all' as const, label: `All (${boostSummary.total})` },
                        { id: 'ready' as const, label: `Ready (${boostSummary.ready})` },
                        { id: 'active' as const, label: `Active (${boostSummary.active})` },
                        { id: 'ended' as const, label: `Ended (${boostSummary.ended})` },
                    ]).map((chip) => {
                        const active = boostFilter === chip.id;
                        return (
                            <TouchableOpacity
                                key={chip.id}
                                onPress={() => setBoostFilter(chip.id)}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                            >
                                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <View style={styles.chipsRow}>
                    {([
                        { id: 'best' as const, label: 'Best' },
                        { id: 'recent' as const, label: 'Recent' },
                    ]).map((chip) => {
                        const active = boostSort === chip.id;
                        return (
                            <TouchableOpacity
                                key={chip.id}
                                onPress={() => setBoostSort(chip.id)}
                                style={[styles.smallChip, active && styles.smallChipActive]}
                            >
                                <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{chip.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                    {([
                        { id: '24h' as const, label: '24h' },
                        { id: '7d' as const, label: '7d' },
                        { id: 'all' as const, label: 'All' },
                    ]).map((chip) => {
                        const active = insightsRange === chip.id;
                        return (
                            <TouchableOpacity
                                key={chip.id}
                                onPress={() => setInsightsRange(chip.id)}
                                style={[styles.smallChip, active && styles.rangeChipActive]}
                            >
                                <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{chip.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {sortedPosts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>{posts.length === 0 ? "You haven't created any posts yet." : 'No posts in this filter.'}</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('CreateComposer')}
                        style={styles.createButton}
                    >
                        <Text style={styles.createButtonText}>Create Your First Post</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={sortedPosts}
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
                                    {analyticsLoadingPostId === item.id ? (
                                        <Text style={styles.analyticsUpdatingText}>Updating with latest analytics...</Text>
                                    ) : null}
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
    summaryRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    summaryText: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#334155',
        backgroundColor: '#111827',
    },
    filterChipActive: {
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
    },
    filterChipText: {
        fontSize: 11,
        color: '#CBD5E1',
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: '#0F172A',
    },
    smallChip: {
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#334155',
        backgroundColor: '#111827',
    },
    smallChipActive: {
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
    },
    rangeChipActive: {
        borderColor: '#38BDF8',
        backgroundColor: 'rgba(14,165,233,0.20)',
    },
    smallChipText: {
        fontSize: 10,
        color: '#CBD5E1',
        fontWeight: '700',
    },
    smallChipTextActive: {
        color: '#0F172A',
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
    analyticsUpdatingText: {
        color: '#7DD3FC',
        fontSize: 11,
        marginBottom: 6,
        fontWeight: '600',
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
