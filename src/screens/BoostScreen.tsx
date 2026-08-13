import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { chipActiveMagenta, chipActiveMagentaText, glassSurface, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, decorateForUser } from '../api/posts';
import type { Post } from '../types';
import BoostSelectionModal from '../components/BoostSelectionModal.native';
import BoostPostTile, { boostTileSize } from '../components/BoostPostTile.native';
import { getActiveBoost, getAllActiveBoostLabels } from '../api/boost';
import {
    classifyBoostStatus,
} from '../utils/boostPostGrid';

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
    const [boostFilter, setBoostFilter] = useState<'all' | 'ready' | 'active' | 'ended'>('all');
    const [boostSort, setBoostSort] = useState<'best' | 'recent'>('best');
    const [insightsRange, setInsightsRange] = useState<'24h' | '7d' | 'all'>('24h');
    const [insightsPost, setInsightsPost] = useState<Post | null>(null);
    const [insightsVisible, setInsightsVisible] = useState(false);

    const loadUserPosts = useCallback(async (opts?: { silent?: boolean }) => {
        if (!user?.handle) {
            setLoading(false);
            return;
        }
        if (!opts?.silent) {
            setLoading(true);
        }
        setError(null);
        try {
            const userPosts = await fetchPostsByUser(user.handle, 50);
            // One map lookup for all Sponsored flags — avoid N× getActiveBoost (was timing out on API in mock).
            const boostLabels = await getAllActiveBoostLabels();
            const decorated = userPosts.map((p) => {
                const base = decorateForUser(userId, p);
                const feedType = boostLabels.get(String(p.id));
                if (!feedType && !base.isBoosted) return base;
                return {
                    ...base,
                    isBoosted: true as const,
                    boostFeedType: base.boostFeedType ?? feedType ?? 'regional',
                };
            });
            setPosts(decorated);
        } catch (err) {
            console.error('Error loading user posts:', err);
            setError('Failed to load your posts');
        } finally {
            setLoading(false);
        }
    }, [user?.handle, userId]);

    useEffect(() => {
        void loadUserPosts();
    }, [loadUserPosts]);

    // Soft refresh on focus — keep existing tiles visible (no full-screen spinner).
    useFocusEffect(
        useCallback(() => {
            void loadUserPosts({ silent: true });
        }, [loadUserPosts]),
    );

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
    }, [posts, boostFilter]);

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
    }, [posts]);

    const openInsights = (post: Post) => {
        setInsightsPost(post);
        setInsightsVisible(true);
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
                        onPress={() => navigation.navigate('InstantCreate')}
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
                        return (
                            <View style={[styles.gridCell, { width: tileSize }]}>
                                <View style={[styles.tileWrap, { width: tileSize, height: tileSize }]}>
                                    <BoostPostTile
                                        post={item}
                                        size={tileSize}
                                        showBoostIcon
                                        onPress={() => {
                                            void openBoostModal(item);
                                        }}
                                    />
                                    <View style={styles.tileOverlayBadges} pointerEvents="none">
                                        <Text style={styles.tapToBoostPill} numberOfLines={1}>
                                            Tap to boost
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => openInsights(item)}
                                    style={styles.insightsBtn}
                                    hitSlop={6}
                                >
                                    <Text style={styles.insightsBtnText}>Insights</Text>
                                </TouchableOpacity>
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
        marginBottom: ox(10),
        alignItems: 'flex-start',
    },
    gridCell: {
        marginBottom: ox(4),
    },
    tileWrap: {
        borderRadius: ox(12),
        overflow: 'hidden',
        position: 'relative',
    },
    tileOverlayBadges: {
        position: 'absolute',
        left: ox(6),
        right: ox(6),
        bottom: ox(6),
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(4),
    },
    tapToBoostPill: {
        fontSize: ox(10),
        fontWeight: '700',
        paddingHorizontal: ox(8),
        paddingVertical: ox(4),
        borderRadius: ox(999),
        overflow: 'hidden',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    insightsBtn: {
        marginTop: ox(6),
        minHeight: ox(28),
        borderRadius: ox(8),
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.35)',
        backgroundColor: 'rgba(14, 165, 233, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: ox(6),
    },
    insightsBtnText: {
        color: '#7DD3FC',
        fontSize: ox(11),
        fontWeight: '700',
    },
    errorText: {
        fontSize: ox(16),
        color: '#EF4444',
        textAlign: 'center',
        marginTop: ox(40),
    },
});

export default BoostScreen;
