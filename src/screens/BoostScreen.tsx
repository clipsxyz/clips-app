import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    DeviceEventEmitter,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import {
    gazetteerHeader,
    SCREEN_CANVAS_BASE,
    UEFA_PASSPORT_GRADIENT,
    UEFA_PASSPORT_GRADIENT_LOCATIONS,
} from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, decorateForUser, mapLaravelProfilePosts } from '../api/posts';
import type { Post } from '../types';
import BoostSelectionModal from '../components/BoostSelectionModal.native';
import BoostPostTile, {
    BOOST_POST_TILE_ASPECT_RATIO,
    boostTileSize,
} from '../components/BoostPostTile.native';
import {
    FEED_CARD_RADIUS,
} from '../components/FeedPageLayout.native';
import { fetchBoostPosts, getActiveBoost, getAllActiveBoostLabels } from '../api/boost';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import {
    classifyBoostStatus,
    type BoostPostCounts,
    type BoostPostFilter,
} from '../utils/boostPostGrid';

import BoostEmptyState from '../components/BoostEmptyState.native';
import BoostInsightsSheet from '../components/BoostInsightsSheet.native';
import { ox } from '../constants/nativeOpticalScale';
import { rootNavigationRef } from '../navigation/rootNavigationRef';
import { BOOST_STATUS_REFRESH_EVENT } from '../navigation/linking';

/** Minimum gap between silent focus-triggered refreshes (ms). Prevents API thrashing. */
const SILENT_REFRESH_MS = 3000;

const EMPTY_COUNTS: BoostPostCounts = { all: 0, ready: 0, active: 0, ended: 0 };

async function loadLocalBoostPosts(
    handle: string,
    userId: string,
    status: BoostPostFilter,
): Promise<{ posts: Post[]; counts: BoostPostCounts }> {
    const userPosts = await fetchPostsByUser(handle, 50);
    const boostLabels = await getAllActiveBoostLabels();
    const decorated = userPosts.map((post) => {
        const base = decorateForUser(userId, post);
        const feedType = boostLabels.get(String(post.id));
        const withFlag = !feedType && !base.isBoosted
            ? base
            : {
                ...base,
                isBoosted: true as const,
                boostFeedType: base.boostFeedType ?? feedType ?? 'regional',
            };
        return { ...withFlag, boostStatus: classifyBoostStatus(withFlag) };
    });
    const counts: BoostPostCounts = {
        all: decorated.length,
        ready: decorated.filter((post) => post.boostStatus === 'ready').length,
        active: decorated.filter((post) => post.boostStatus === 'active').length,
        ended: decorated.filter((post) => post.boostStatus === 'ended').length,
    };
    const posts = status === 'all'
        ? decorated
        : decorated.filter((post) => post.boostStatus === status);
    return { posts, counts };
}

function stampApiBoostPosts(raw: unknown[]): Post[] {
    const rows = Array.isArray(raw) ? raw : [];
    const mapped = mapLaravelProfilePosts(rows);
    const byId = new Map(rows.map((item) => [String((item as { id?: string })?.id), item as Record<string, unknown>]));
    return mapped.map((post) => {
        const item = byId.get(String(post.id));
        const rawStatus = item?.boost_status ?? item?.boostStatus;
        const boostStatus = rawStatus === 'active' || rawStatus === 'ended' || rawStatus === 'ready'
            ? rawStatus
            : undefined;
        const feedType = item?.boost_feed_type ?? item?.boostFeedType;
        return {
            ...post,
            boostStatus,
            isBoosted: boostStatus === 'active' || post.isBoosted,
            boostFeedType: (typeof feedType === 'string' ? feedType : post.boostFeedType) as Post['boostFeedType'],
        };
    });
}

/** Same inset and inter-card gap as the floating feed card (`marginHorizontal` 16, `marginVertical` 8). */
const BOOST_GRID_COLUMNS = 3;
const BOOST_GRID_GAP = 8;
const BOOST_GRID_PADDING = 16;

function BoostCanvas({
    children,
    contentStyle,
}: {
    children: React.ReactNode;
    contentStyle?: object;
}) {
    return (
        <View style={styles.shell}>
            <LinearGradient
                colors={[...UEFA_PASSPORT_GRADIENT]}
                locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />
            <GazetteerScreenShell ambient={false} style={styles.shellTransparent} contentStyle={contentStyle}>
                {children}
            </GazetteerScreenShell>
        </View>
    );
}

const BoostScreen: React.FC = ({ navigation, route }: any) => {
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [boostFilter, setBoostFilter] = useState<BoostPostFilter>('all');
    const [counts, setCounts] = useState<BoostPostCounts>(EMPTY_COUNTS);
    const [listLoading, setListLoading] = useState(false);
    const [boostSort, setBoostSort] = useState<'best' | 'recent'>('best');
    const [insightsRange, setInsightsRange] = useState<'24h' | '7d' | 'all'>('24h');
    const [insightsPost, setInsightsPost] = useState<Post | null>(null);
    const [insightsVisible, setInsightsVisible] = useState(false);

    // Latest request wins when the user switches tabs before the previous call returns.
    const requestGenRef = useRef(0);
    const hasLoadedRef = useRef(false);
    const lastLoadRef = useRef(0);

    const loadUserPosts = useCallback(async (opts?: { silent?: boolean }) => {
        if (!user?.handle) {
            setLoading(false);
            return;
        }
        // Debounce silent focus refreshes so rapid re-renders can't thrash the endpoint.
        if (opts?.silent && Date.now() - lastLoadRef.current < SILENT_REFRESH_MS) return;
        const status = boostFilter;
        const gen = ++requestGenRef.current;
        lastLoadRef.current = Date.now();
        if (!opts?.silent && !hasLoadedRef.current) {
            setLoading(true);
        } else if (!opts?.silent) {
            setListLoading(true);
            setPosts([]);
        }
        setError(null);
        try {
            let nextPosts: Post[] = [];
            let nextCounts = EMPTY_COUNTS;
            if (isLaravelApiEnabled()) {
                const page = await fetchBoostPosts(status);
                nextPosts = stampApiBoostPosts(page.posts).map((post) => decorateForUser(userId, post));
                nextCounts = page.counts;
            } else {
                const local = await loadLocalBoostPosts(user.handle, userId, status);
                nextPosts = local.posts;
                nextCounts = local.counts;
            }
            if (gen !== requestGenRef.current) return;
            setPosts(nextPosts);
            setCounts(nextCounts);
        } catch (err) {
            console.error('Error loading user posts:', err);
            try {
                const local = await loadLocalBoostPosts(user.handle, userId, status);
                if (gen !== requestGenRef.current) return;
                setPosts(local.posts);
                setCounts(local.counts);
            } catch (fallbackErr) {
                console.error('Error loading local boost posts:', fallbackErr);
                if (gen !== requestGenRef.current) return;
                setError('Failed to load your posts');
            }
        } finally {
            if (gen === requestGenRef.current) {
                hasLoadedRef.current = true;
                setLoading(false);
                setListLoading(false);
            }
        }
    }, [user?.handle, userId, boostFilter]);

    useEffect(() => {
        void loadUserPosts();
    }, [loadUserPosts]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener(BOOST_STATUS_REFRESH_EVENT, () => {
            setBoostFilter('active');
        });
        return () => sub.remove();
    }, []);

    const handledBoostSuccessRef = useRef<string | null>(null);
    useEffect(() => {
        const action = route?.params?.initialAction;
        if (action !== 'success') return;
        const sessionId = String(route?.params?.session_id || '');
        const key = `${action}:${sessionId}`;
        if (handledBoostSuccessRef.current === key) return;
        handledBoostSuccessRef.current = key;
        setBoostFilter('active');
        navigation.setParams?.({ initialAction: undefined });
    }, [navigation, route?.params?.initialAction, route?.params?.session_id]);

    /** Mount effect above covers the first load; skip the focus effect's first pass so
     *  mounting never issues a second (guarded) fetch. Later focuses refresh silently. */
    const boostFirstFocusRef = useRef(true);

    // Soft refresh on focus — keep existing tiles visible (no full-screen spinner).
    // Guarded by the in-flight flag + debounce above, so it never loops.
    useFocusEffect(
        useCallback(() => {
            if (boostFirstFocusRef.current) {
                boostFirstFocusRef.current = false;
                return;
            }
            void loadUserPosts({ silent: true });
        }, [loadUserPosts]),
    );

    const openInsights = (post: Post) => {
        setInsightsPost(post);
        setInsightsVisible(true);
    };

    const openBoostModal = useCallback(async (post: Post) => {
        if (classifyBoostStatus(post) === 'active') {
            openInsights(post);
            return;
        }
        setSelectedPost(post);
        setShowBoostModal(true);
        try {
            const existing = await getActiveBoost(post.id);
            if (existing?.isActive) {
                setShowBoostModal(false);
                setSelectedPost(null);
                openInsights({
                    ...post,
                    isBoosted: true,
                    boostStatus: 'active',
                    boostFeedType: existing.feedType ?? post.boostFeedType,
                    boostSpendEur: existing.price > 0 ? existing.price : post.boostSpendEur,
                });
            }
        } catch {
            // Keep modal open if status check fails offline
        }
    }, []);

    const closeBoostModal = () => {
        setShowBoostModal(false);
        setSelectedPost(null);
    };

    const tileWidth = useMemo(
        () => boostTileSize(BOOST_GRID_COLUMNS, BOOST_GRID_GAP, BOOST_GRID_PADDING),
        [],
    );
    const tileHeight = Math.max(1, Math.round(tileWidth / BOOST_POST_TILE_ASPECT_RATIO));

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

    const boostSummary = counts;

    const onSwitchToReady = useCallback(() => {
        setBoostFilter('ready');
    }, []);

    const onCreatePost = useCallback(() => {
        if (rootNavigationRef.isReady()) {
            rootNavigationRef.navigate('CreatePost' as never);
            return;
        }
        navigation.navigate('CreatePost');
    }, [navigation]);

    if (!user) {
        return (
            <BoostCanvas contentStyle={styles.centeredShell}>
                <Text style={styles.errorText}>Please sign in to view your posts</Text>
            </BoostCanvas>
        );
    }

    if (loading) {
        return (
            <BoostCanvas contentStyle={styles.centeredShell}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </BoostCanvas>
        );
    }

    if (error) {
        return (
            <BoostCanvas contentStyle={styles.centeredShell}>
                <Text style={styles.errorText}>{error}</Text>
            </BoostCanvas>
        );
    }

    return (
        <BoostCanvas>
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
                        { id: 'all' as const, label: `All: ${boostSummary.all}` },
                        { id: 'ready' as const, label: `Ready: ${boostSummary.ready}` },
                        { id: 'active' as const, label: `Active: ${boostSummary.active}` },
                        { id: 'ended' as const, label: `Ended: ${boostSummary.ended}` },
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

            {listLoading ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            ) : sortedPosts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <BoostEmptyState
                        tab={boostFilter}
                        onSwitchToReady={onSwitchToReady}
                        onCreatePost={onCreatePost}
                    />
                </View>
            ) : (
                <FlatList
                    data={sortedPosts}
                    keyExtractor={(item) => item.id}
                    numColumns={BOOST_GRID_COLUMNS}
                    columnWrapperStyle={styles.gridRow}
                    contentContainerStyle={styles.gridContent}
                    renderItem={({ item }) => {
                        const isSelected = showBoostModal && selectedPost?.id === item.id;
                        const isBoosting = classifyBoostStatus(item) === 'active';
                        return (
                            <View style={[styles.gridCell, { width: tileWidth }]}>
                                <View
                                    style={[
                                        styles.tileWrap,
                                        { width: tileWidth, height: tileHeight },
                                        isBoosting && styles.tileWrapBoosting,
                                        isSelected && styles.tileWrapSelected,
                                    ]}
                                >
                                    <BoostPostTile
                                        post={item}
                                        width={tileWidth}
                                        showBoostIcon
                                        onPress={() => {
                                            void openBoostModal(item);
                                        }}
                                    />
                                    <View style={styles.tileOverlayBadges} pointerEvents="none">
                                        <Text
                                            style={[styles.tapToBoostPill, isBoosting && styles.boostingPill]}
                                            numberOfLines={1}
                                        >
                                            {isBoosting ? 'Boosting' : 'Tap to boost'}
                                        </Text>
                                    </View>
                                    {isSelected ? (
                                        <View style={styles.selectedMark} pointerEvents="none">
                                            <Icon name="checkmark" size={16} color="#FFFFFF" />
                                        </View>
                                    ) : null}
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
                selectedPost={selectedPost}
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
        </BoostCanvas>
    );
};

const styles = StyleSheet.create({
    shell: {
        flex: 1,
        backgroundColor: SCREEN_CANVAS_BASE,
    },
    shellTransparent: {
        flex: 1,
        backgroundColor: 'transparent',
    },
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
        borderRadius: ox(16),
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    filterChipActive: {
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderColor: 'rgba(255,255,255,0.55)',
    },
    filterChipText: {
        fontSize: ox(11),
        color: '#CBD5E1',
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    smallChip: {
        paddingHorizontal: ox(9),
        paddingVertical: ox(5),
        borderRadius: ox(16),
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    smallChipActive: {
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderColor: 'rgba(255,255,255,0.55)',
    },
    rangeChipActive: {
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderColor: 'rgba(255,255,255,0.55)',
    },
    smallChipText: {
        fontSize: ox(10),
        color: '#CBD5E1',
        fontWeight: '700',
    },
    smallChipTextActive: {
        color: '#FFFFFF',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(40),
    },
    gridContent: {
        paddingHorizontal: BOOST_GRID_PADDING,
        paddingBottom: ox(24),
    },
    gridRow: {
        gap: BOOST_GRID_GAP,
        marginBottom: BOOST_GRID_GAP,
        alignItems: 'flex-start',
    },
    gridCell: {
        marginBottom: ox(4),
    },
    tileWrap: {
        borderRadius: FEED_CARD_RADIUS,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    tileWrapBoosting: {
        borderColor: 'rgba(255,255,255,0.85)',
    },
    tileWrapSelected: {
        borderColor: '#d91b5c',
        shadowColor: '#d91b5c',
        shadowOpacity: 0.9,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
    },
    selectedMark: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#d91b5c',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    tileOverlayBadges: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: ox(8),
    },
    boostingPill: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderColor: 'rgba(255,255,255,0.75)',
    },
    tapToBoostPill: {
        fontSize: ox(10),
        fontWeight: '700',
        textAlign: 'center',
        paddingHorizontal: ox(8),
        paddingVertical: ox(4),
        borderRadius: ox(8),
        overflow: 'hidden',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    insightsBtn: {
        marginTop: ox(6),
        minHeight: ox(28),
        borderRadius: ox(12),
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
