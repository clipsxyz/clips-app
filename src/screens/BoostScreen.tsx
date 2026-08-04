import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { chipActiveMagenta, chipActiveMagentaText, glassPanel, glassSurface, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, decorateForUser } from '../api/posts';
import type { Post } from '../types';
import BoostSelectionModal from '../components/BoostSelectionModal.native';
import BoostPostTile, { boostTileSize } from '../components/BoostPostTile.native';
import { getActiveBoost, getBoostAnalytics, type BoostAnalytics } from '../api/boost';
import {
    classifyBoostStatus,
    getQualityLabel,
    getQualityReason,
    estimateReachTeaser,
    boostStatusLabel,
} from '../utils/boostPostGrid';

import { buildInstantAnalytics } from '../utils/boostInsightsNative';
import BoostInsightsSheet from '../components/BoostInsightsSheet.native';
import { ox } from '../constants/nativeOpticalScale';

const BoostScreen: React.FC = ({ navigation }: any) => {
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [analyticsByPostId, setAnalyticsByPostId] = useState<Record<string, BoostAnalytics>>({});
    const [boostFilter, setBoostFilter] = useState<'all' | 'ready' | 'active' | 'ended'>('all');
    const [boostSort, setBoostSort] = useState<'best' | 'recent'>('best');
    const [insightsRange, setInsightsRange] = useState<'24h' | '7d' | 'all'>('24h');
    const [insightsPost, setInsightsPost] = useState<Post | null>(null);
    const [insightsVisible, setInsightsVisible] = useState(false);
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

    const openBoostModal = useCallback(async (post: Post) => {
        setSelectedPost(post);
        setShowBoostModal(true);
        try {
            const existing = await getActiveBoost(post.id);
            if (existing?.isActive) {
                setShowBoostModal(false);
                setSelectedPost(null);
                Alert.alert(
                    'Already boosted',
                    'This post is already boosted. It will expire in 6 hours.',
                );
            }
        } catch {
            // Keep modal open if status check fails offline
        }
    }, []);

    const closeBoostModal = () => {
        setShowBoostModal(false);
        setSelectedPost(null);
    };

    const tileSize = useMemo(() => boostTileSize(3, 6, 8), []);

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

    const openInsights = (post: Post) => {
        setInsightsPost(post);
        setInsightsVisible(true);
        setAnalyticsByPostId((prev) => ({
            ...prev,
            [post.id]: prev[post.id] || buildInstantAnalytics(post),
        }));
    };

    if (!user) {
        return (
            <GazetteerScreenShell ambientVariant="passport" contentStyle={styles.centeredShell}>
                <Text style={styles.errorText}>Please sign in to view your posts</Text>
            </GazetteerScreenShell>
        );
    }

    if (loading) {
        return (
            <GazetteerScreenShell ambientVariant="passport" contentStyle={styles.centeredShell}>
                <ActivityIndicator size="large" color="#3d9b8f" />
            </GazetteerScreenShell>
        );
    }

    if (error) {
        return (
            <GazetteerScreenShell ambientVariant="passport" contentStyle={styles.centeredShell}>
                <Text style={styles.errorText}>{error}</Text>
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell ambientVariant="passport">
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
                    numColumns={3}
                    columnWrapperStyle={styles.gridRow}
                    contentContainerStyle={styles.gridContent}
                    renderItem={({ item }) => {
                        const status = classifyBoostStatus(item);
                        const quality = getQualityLabel(item);
                        const qualityToneStyle =
                            quality.tone === 'emerald'
                                ? styles.qualityEmerald
                                : quality.tone === 'sky'
                                  ? styles.qualitySky
                                  : styles.qualityAmber;
                        const statusToneStyle =
                            status === 'active'
                                ? styles.statusActive
                                : status === 'ended'
                                  ? styles.statusEnded
                                  : styles.statusReady;

                        return (
                            <View style={[styles.gridCell, { width: tileSize }]}>
                                <View style={styles.tileMetaCard}>
                                    <View style={styles.tileMetaRow}>
                                        <Text style={[styles.qualityPill, qualityToneStyle]}>
                                            {quality.label}
                                        </Text>
                                        <Text style={[styles.statusPill, statusToneStyle]}>
                                            {boostStatusLabel(status)}
                                        </Text>
                                    </View>
                                    <Text style={styles.tileMetaReason} numberOfLines={2}>
                                        {getQualityReason(item)}
                                    </Text>
                                    <Text style={styles.tileMetaReach} numberOfLines={1}>
                                        {estimateReachTeaser(item)} from base EUR 4.99
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => openInsights(item)}
                                    style={styles.insightsBtn}
                                >
                                    <Text style={styles.insightsBtnText}>View insights</Text>
                                </TouchableOpacity>
                                {analyticsByPostId[item.id]?.hasBoost &&
                                analyticsByPostId[item.id]?.analytics ? (
                                    <Text style={styles.tileInsightsHint} numberOfLines={1}>
                                        {analyticsByPostId[item.id]?.analytics?.impressions ?? 0} imp ·{' '}
                                        {analyticsByPostId[item.id]?.analytics?.likes ?? 0} likes
                                    </Text>
                                ) : null}
                                <BoostPostTile
                                    post={item}
                                    size={tileSize}
                                    showBoostIcon
                                    onPress={() => {
                                        void openBoostModal(item);
                                    }}
                                />
                            </View>
                        );
                    }}
                />
            )}
            <BoostInsightsSheet
                visible={insightsVisible}
                post={insightsPost}
                range={insightsRange}
                onClose={() => {
                    setInsightsVisible(false);
                    setInsightsPost(null);
                }}
            />
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
        </GazetteerScreenShell>
    );
};

const styles = StyleSheet.create({
    centeredShell: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(24),
    },
    header: {
        padding: ox(16),
        ...gazetteerHeader,
    },
    title: {
        fontSize: ox(20),
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: ox(4),
    },
    subtitle: {
        fontSize: ox(14),
        color: '#9CA3AF',
    },
    summaryRow: {
        flexDirection: 'row',
        gap: ox(12),
        marginTop: ox(8),
    },
    summaryText: {
        fontSize: ox(11),
        color: '#94A3B8',
        fontWeight: '600',
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(8),
        marginTop: ox(8),
    },
    filterChip: {
        paddingHorizontal: ox(10),
        paddingVertical: ox(6),
        borderRadius: ox(999),
        ...glassSurface,
    },
    filterChipActive: {
        ...chipActiveMagenta,
    },
    filterChipText: {
        fontSize: ox(11),
        color: '#CBD5E1',
        fontWeight: '700',
    },
    filterChipTextActive: {
        ...chipActiveMagentaText,
    },
    smallChip: {
        paddingHorizontal: ox(9),
        paddingVertical: ox(5),
        borderRadius: ox(999),
        ...glassSurface,
    },
    smallChipActive: {
        ...chipActiveMagenta,
    },
    rangeChipActive: {
        borderColor: 'rgba(244, 114, 182, 0.55)',
        backgroundColor: 'rgba(217, 27, 92, 0.25)',
    },
    smallChipText: {
        fontSize: ox(10),
        color: '#CBD5E1',
        fontWeight: '700',
    },
    smallChipTextActive: {
        ...chipActiveMagentaText,
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
        marginBottom: ox(24),
        textAlign: 'center',
    },
    createButton: {
        paddingHorizontal: ox(24),
        paddingVertical: ox(12),
        backgroundColor: '#d91b5c',
        borderRadius: ox(8),
    },
    createButtonText: {
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '600',
    },
    gridContent: {
        paddingHorizontal: ox(8),
        paddingBottom: ox(24),
    },
    gridRow: {
        gap: ox(6),
        marginBottom: ox(6),
    },
    gridCell: {
        marginBottom: ox(10),
    },
    tileMetaCard: {
        borderRadius: ox(10),
        padding: ox(8),
        marginBottom: ox(6),
        ...glassPanel,
    },
    tileMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(4),
        marginBottom: ox(4),
    },
    qualityPill: {
        fontSize: ox(9),
        fontWeight: '700',
        paddingHorizontal: ox(6),
        paddingVertical: ox(2),
        borderRadius: ox(999),
        borderWidth: 1,
        overflow: 'hidden',
    },
    qualityEmerald: {
        color: '#6EE7B7',
        borderColor: 'rgba(52, 211, 153, 0.4)',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
    },
    qualitySky: {
        color: '#7DD3FC',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        backgroundColor: 'rgba(14, 165, 233, 0.12)',
    },
    qualityAmber: {
        color: '#FCD34D',
        borderColor: 'rgba(251, 191, 36, 0.4)',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    statusPill: {
        fontSize: ox(9),
        fontWeight: '700',
        paddingHorizontal: ox(6),
        paddingVertical: ox(2),
        borderRadius: ox(999),
        borderWidth: 1,
    },
    statusActive: {
        color: '#6EE7B7',
        borderColor: 'rgba(52, 211, 153, 0.4)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    statusEnded: {
        color: '#D1D5DB',
        borderColor: 'rgba(156, 163, 175, 0.35)',
        backgroundColor: 'rgba(107, 114, 128, 0.15)',
    },
    statusReady: {
        color: '#7DD3FC',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        backgroundColor: 'rgba(14, 165, 233, 0.12)',
    },
    tileMetaReason: {
        fontSize: ox(9),
        color: '#6B7280',
        lineHeight: ox(12),
    },
    tileMetaReach: {
        fontSize: ox(9),
        color: '#9CA3AF',
        marginTop: ox(2),
    },
    insightsBtn: {
        minHeight: ox(30),
        borderRadius: ox(8),
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.35)',
        backgroundColor: 'rgba(14, 165, 233, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: ox(6),
        paddingHorizontal: ox(6),
    },
    insightsBtnText: {
        color: '#BAE6FD',
        fontSize: ox(10),
        fontWeight: '700',
    },
    tileInsightsHint: {
        fontSize: ox(9),
        color: '#94A3B8',
        marginBottom: ox(4),
    },
    errorText: {
        fontSize: ox(16),
        color: '#EF4444',
        textAlign: 'center',
        marginTop: ox(40),
    },
});

export default BoostScreen;
