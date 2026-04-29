import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedSearch, type SearchSections } from '../api/search';
import { fetchPostsByUser } from '../api/posts';
import { toggleFollow } from '../api/client';
import { useAuth } from '../context/Auth';
import type { Post } from '../types';
import Avatar from '../components/Avatar';

type SearchMode = 'locations' | 'venues' | 'landmarks' | 'users' | 'posts' | 'nearby';
type SearchRefinement = 'all' | 'local' | 'regional';
type NearbyScope = 'local' | 'regional';
type RecentSearchItem = { q: string; mode: SearchMode; ts: number };

const RECENT_SEARCHES_KEY = 'searchRecentQueriesV1';
const SAVED_SEARCHES_KEY = 'searchSavedQueriesV1';
const MAX_RECENT_SEARCHES = 8;
const POPULAR_LOCATIONS = ['Dublin', 'Cork', 'Galway', 'London', 'New York'];
const POPULAR_VENUES = ['Croke Park', 'Temple Bar', 'Aviva Stadium', 'The Brazen Head', '3Arena'];
const POPULAR_LANDMARKS = ['River Liffey', 'Phoenix Park', 'Ha\'penny Bridge', 'Spire', 'Trinity College'];

async function readSearchList(key: string): Promise<RecentSearchItem[]> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x: any) => x && typeof x.q === 'string' && typeof x.mode === 'string');
    } catch {
        return [];
    }
}

async function writeSearchList(key: string, items: RecentSearchItem[]) {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch {
        // ignore storage errors
    }
}

const SearchScreen: React.FC = ({ navigation }: any) => {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [sections, setSections] = useState<SearchSections>({});
    const [loading, setLoading] = useState(false);
    const [preloadPosts, setPreloadPosts] = useState<Post[]>([]);
    const [searchMode, setSearchMode] = useState<SearchMode>('locations');
    const [nearbyScope, setNearbyScope] = useState<NearbyScope>('local');
    const [refinement, setRefinement] = useState<SearchRefinement>('all');
    const [sectionLoadingMore, setSectionLoadingMore] = useState<{ users: boolean; locations: boolean; posts: boolean }>({
        users: false,
        locations: false,
        posts: false,
    });
    const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
    const [savedSearches, setSavedSearches] = useState<RecentSearchItem[]>([]);
    const [followBusyHandle, setFollowBusyHandle] = useState<string | null>(null);
    const [localFollowState, setLocalFollowState] = useState<Record<string, boolean>>({});
    const [suggestedUsers, setSuggestedUsers] = useState<Array<{ handle: string; display_name?: string; avatar_url?: string }>>([]);
    const modePlaceholder: Record<SearchMode, string> = {
        locations: 'Search by location',
        venues: 'Search by venue',
        landmarks: 'Search by landmark',
        users: 'Search users',
        posts: 'Search posts',
        nearby: 'Search nearby users',
    };

    useEffect(() => {
        fetchPostsByUser('Sarah@Artane', 30).then(setPreloadPosts).catch(() => setPreloadPosts([]));
    }, []);

    useEffect(() => {
        let mounted = true;
        Promise.all([readSearchList(RECENT_SEARCHES_KEY), readSearchList(SAVED_SEARCHES_KEY)])
            .then(([recent, saved]) => {
                if (!mounted) return;
                setRecentSearches(recent);
                setSavedSearches(saved);
            })
            .catch(() => {
                if (!mounted) return;
                setRecentSearches([]);
                setSavedSearches([]);
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const q = searchQuery.trim();
        if (!q) {
            setSections({});
            return;
        }
        setLoading(true);
        const id = setTimeout(() => {
            let types = 'users,locations,posts';
            if (searchMode === 'users' || searchMode === 'nearby') types = 'users';
            if (searchMode === 'posts') types = 'posts';
            if (searchMode === 'venues' || searchMode === 'landmarks') types = 'locations';
            unifiedSearch({ q, types, usersLimit: 10, locationsLimit: 10, postsLimit: 12 })
                .then((r) => {
                    setSections(r.sections || {});
                    setLoading(false);
                })
                .catch(() => {
                    setSections({});
                    setLoading(false);
                });
        }, 250);
        return () => clearTimeout(id);
    }, [searchQuery, searchMode]);

    useEffect(() => {
        const q = (user?.local || '').trim() || 'Dublin';
        unifiedSearch({ q, types: 'users', usersLimit: 8 })
            .then((r) => {
                const items = Array.isArray(r.sections?.users?.items) ? r.sections!.users!.items : [];
                setSuggestedUsers(items);
            })
            .catch(() => setSuggestedUsers([]));
    }, [user?.local]);

    useEffect(() => {
        if (searchMode === 'nearby') {
            const target = nearbyScope === 'regional' ? user?.regional : user?.local;
            if (target && target.trim().length > 0) {
                setSearchQuery(target);
            }
        }
    }, [searchMode, nearbyScope, user?.local, user?.regional]);

    const addRecentSearch = (q: string, mode: SearchMode) => {
        const query = q.trim();
        if (!query) return;
        setRecentSearches((prev) => {
            const next = [{ q: query, mode, ts: Date.now() }, ...prev.filter((x) => !(x.q.toLowerCase() === query.toLowerCase() && x.mode === mode))]
                .slice(0, MAX_RECENT_SEARCHES);
            void writeSearchList(RECENT_SEARCHES_KEY, next);
            return next;
        });
    };

    const toggleSaveSearch = (q: string, mode: SearchMode) => {
        const query = q.trim();
        if (!query) return;
        setSavedSearches((prev) => {
            const exists = prev.some((x) => x.q.toLowerCase() === query.toLowerCase() && x.mode === mode);
            const next = exists
                ? prev.filter((x) => !(x.q.toLowerCase() === query.toLowerCase() && x.mode === mode))
                : [{ q: query, mode, ts: Date.now() }, ...prev].slice(0, MAX_RECENT_SEARCHES);
            void writeSearchList(SAVED_SEARCHES_KEY, next);
            return next;
        });
    };

    const getUsers = () => (Array.isArray(sections.users?.items) ? sections.users!.items : []);
    const getLocations = () => (Array.isArray(sections.locations?.items) ? sections.locations!.items : []);
    const getPosts = () => (Array.isArray(sections.posts?.items) ? sections.posts!.items : []);

    const filteredLocations = useMemo(() => {
        const items = getLocations();
        if (refinement === 'all') return items;
        const local = (user?.local || '').toLowerCase();
        const regional = (user?.regional || '').toLowerCase();
        return items.filter((loc: any) => {
            const hay = `${loc?.name || ''} ${loc?.country || ''} ${loc?.type || ''}`.toLowerCase();
            if (refinement === 'local') return !!local && hay.includes(local);
            if (refinement === 'regional') return !!regional && hay.includes(regional);
            return true;
        });
    }, [sections.locations?.items, refinement, user?.local, user?.regional]);

    const filteredUsers = useMemo(() => {
        const items = getUsers();
        if (refinement === 'all') return items;
        const local = (user?.local || '').toLowerCase();
        const regional = (user?.regional || '').toLowerCase();
        return items.filter((u: any) => {
            const hay = [
                u?.handle,
                u?.display_name,
                u?.local,
                u?.regional,
                u?.national,
                u?.location,
                u?.city,
                u?.country,
            ].filter(Boolean).join(' ').toLowerCase();
            if (refinement === 'local') return !!local && hay.includes(local);
            if (refinement === 'regional') return !!regional && hay.includes(regional);
            return true;
        });
    }, [sections.users?.items, refinement, user?.local, user?.regional]);

    const filteredPosts = getPosts();
    const hasQuery = searchQuery.trim().length > 0;
    const isCurrentQuerySaved = savedSearches.some((x) => x.q.toLowerCase() === searchQuery.trim().toLowerCase() && x.mode === searchMode);

    const goToLocation = async (loc: string, kind: 'location' | 'venue' | 'landmark' = 'location') => {
        addRecentSearch(loc, searchMode);
        try {
            await AsyncStorage.setItem('pendingLocation', loc);
            await AsyncStorage.setItem('pendingFilterType', kind);
        } catch {
            // ignore storage errors and still navigate
        }
        navigation.navigate('Home', { location: loc, filterType: kind });
    };

    const goToUser = (handle: string) => {
        addRecentSearch(handle, searchMode);
        navigation.navigate('ViewProfile', { handle });
    };

    const goToPost = (postId: string) => {
        navigation.navigate('PostDetail', { postId });
    };

    const handleSubmitSearch = () => {
        const q = searchQuery.trim();
        if (!q) return;
        if (searchMode === 'locations') {
            void goToLocation(q, 'location');
            return;
        }
        if (searchMode === 'venues') {
            void goToLocation(q, 'venue');
            return;
        }
        if (searchMode === 'landmarks') {
            void goToLocation(q, 'landmark');
            return;
        }
        if (searchMode === 'users' || searchMode === 'nearby') {
            goToUser(q);
            return;
        }
        // For posts mode we keep results list behavior (open a specific post from results grid).
    };

    const loadMoreSection = async (section: 'users' | 'locations' | 'posts') => {
        const q = searchQuery.trim();
        if (!q || sectionLoadingMore[section]) return;
        const cursor = sections[section]?.nextCursor;
        if (cursor == null) return;
        setSectionLoadingMore((prev) => ({ ...prev, [section]: true }));
        try {
            const params: any = {
                q,
                types: section,
                usersLimit: section === 'users' ? 10 : undefined,
                locationsLimit: section === 'locations' ? 10 : undefined,
                postsLimit: section === 'posts' ? 12 : undefined,
            };
            if (section === 'users') params.usersCursor = cursor;
            if (section === 'locations') params.locationsCursor = cursor;
            if (section === 'posts') params.postsCursor = cursor;
            const r = await unifiedSearch(params);
            const incoming = r.sections?.[section];
            const incomingItems = Array.isArray(incoming?.items) ? incoming.items : [];
            setSections((prev) => {
                const prevItems = Array.isArray(prev?.[section]?.items) ? prev[section]!.items : [];
                const merged = [...prevItems];
                const seen = new Set(prevItems.map((i: any) => String(i?.id ?? i?.handle ?? i?.name ?? JSON.stringify(i))));
                incomingItems.forEach((item: any) => {
                    const key = String(item?.id ?? item?.handle ?? item?.name ?? JSON.stringify(item));
                    if (!seen.has(key)) {
                        merged.push(item);
                        seen.add(key);
                    }
                });
                return {
                    ...prev,
                    [section]: {
                        items: merged,
                        nextCursor: incoming?.nextCursor ?? null,
                        hasMore: incoming?.hasMore ?? false,
                    },
                };
            });
        } finally {
            setSectionLoadingMore((prev) => ({ ...prev, [section]: false }));
        }
    };

    const onToggleFollowSuggested = async (handle: string) => {
        setFollowBusyHandle(handle);
        try {
            const result = await toggleFollow(handle);
            const nextFollowing = result?.status === 'accepted' || result?.following === true;
            setLocalFollowState((prev) => ({ ...prev, [handle]: nextFollowing }));
        } catch {
            // no-op
        } finally {
            setFollowBusyHandle(null);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View style={styles.searchContainer}>
                    <Icon name="search" size={20} color="#6B7280" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={modePlaceholder[searchMode]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSubmitSearch}
                        returnKeyType="search"
                        placeholderTextColor="#9CA3AF"
                    />
                    {!!searchQuery && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="close-circle" size={18} color="#6B7280" />
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeChipsRow}>
                    {[
                        { id: 'locations', label: 'Locations' },
                        { id: 'venues', label: 'Venues' },
                        { id: 'landmarks', label: 'Landmarks' },
                        { id: 'users', label: 'Users' },
                        { id: 'posts', label: 'Posts' },
                        { id: 'nearby', label: 'Nearby' },
                    ].map((mode) => {
                        const active = searchMode === mode.id;
                        return (
                            <TouchableOpacity
                                key={mode.id}
                                onPress={() => setSearchMode(mode.id as SearchMode)}
                                style={[styles.modeChip, active && styles.modeChipActive]}
                            >
                                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{mode.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                {searchMode === 'nearby' && (
                    <View style={styles.nearbyScopeRow}>
                        <TouchableOpacity
                            onPress={() => setNearbyScope('local')}
                            style={[styles.nearbyScopeChip, nearbyScope === 'local' && styles.nearbyScopeChipActive]}
                        >
                            <Text style={[styles.nearbyScopeChipText, nearbyScope === 'local' && styles.nearbyScopeChipTextActive]}>
                                Local
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setNearbyScope('regional')}
                            style={[styles.nearbyScopeChip, nearbyScope === 'regional' && styles.nearbyScopeChipActive]}
                        >
                            <Text style={[styles.nearbyScopeChipText, nearbyScope === 'regional' && styles.nearbyScopeChipTextActive]}>
                                Regional
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.nearbyScopeHint}>
                            Searching near {nearbyScope === 'regional' ? (user?.regional || 'your region') : (user?.local || 'your local area')}
                        </Text>
                    </View>
                )}
                {hasQuery && (
                    <View style={styles.refinementRow}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'local', label: 'Local' },
                            { id: 'regional', label: 'Regional' },
                        ].map((r) => {
                            const active = refinement === r.id;
                            return (
                                <TouchableOpacity
                                    key={r.id}
                                    onPress={() => setRefinement(r.id as SearchRefinement)}
                                    style={[styles.refinementChip, active && styles.refinementChipActive]}
                                >
                                    <Text style={[styles.refinementChipText, active && styles.refinementChipTextActive]}>{r.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity
                            onPress={() => toggleSaveSearch(searchQuery, searchMode)}
                            style={styles.saveSearchBtn}
                        >
                            <Icon name={isCurrentQuerySaved ? 'bookmark' : 'bookmark-outline'} size={16} color="#F8D26A" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                </View>
            ) : hasQuery ? (
                <ScrollView style={styles.resultsList}>
                    {(searchMode === 'users' || searchMode === 'nearby') && (
                        <View>
                            {filteredUsers.map((u: any) => (
                                <TouchableOpacity key={u.handle} onPress={() => goToUser(u.handle)} style={styles.resultItem}>
                                    <Avatar src={u.avatar_url || u.avatarUrl} name={(u.handle || 'User').split('@')[0]} size={40} />
                                    <View style={styles.resultInfo}>
                                        <Text style={styles.resultName}>{u.handle}</Text>
                                        <Text style={styles.resultMeta}>{u.display_name || 'User'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {!!sections.users?.nextCursor && (
                                <TouchableOpacity style={styles.loadMoreButton} onPress={() => void loadMoreSection('users')}>
                                    {sectionLoadingMore.users ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.loadMoreText}>Load more users</Text>}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {(searchMode === 'locations' || searchMode === 'venues' || searchMode === 'landmarks') && (
                        <View>
                            {filteredLocations.map((loc: any) => {
                                const kind = searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
                                const iconName = kind === 'venue' ? 'business' : kind === 'landmark' ? 'flag' : 'location';
                                const kindLabel = kind === 'venue' ? 'Venue' : kind === 'landmark' ? 'Landmark' : 'Location';
                                return (
                                    <TouchableOpacity key={`${loc.name}-${loc.country || ''}`} onPress={() => goToLocation(loc.name, kind)} style={styles.resultItem}>
                                        <Icon name={iconName} size={20} color="#8B5CF6" />
                                        <View style={styles.resultInfo}>
                                            <Text style={styles.resultName}>{loc.name}</Text>
                                            <Text style={styles.resultMeta}>
                                                {kindLabel}
                                                {loc.type ? ` • ${loc.type}` : ''}
                                                {loc.country ? ` • ${loc.country}` : ''}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {!!sections.locations?.nextCursor && (
                                <TouchableOpacity style={styles.loadMoreButton} onPress={() => void loadMoreSection('locations')}>
                                    {sectionLoadingMore.locations ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.loadMoreText}>Load more places</Text>}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {searchMode === 'posts' && (
                        <View style={styles.postsGrid}>
                            {filteredPosts.map((post: any) => (
                                <TouchableOpacity key={post.id} onPress={() => goToPost(post.id)} style={styles.postResultItem}>
                                    {post.mediaUrl ? (
                                        <Image source={{ uri: post.mediaUrl }} style={styles.postThumbnail} />
                                    ) : (
                                        <View style={styles.postThumbnailPlaceholder}>
                                            <Icon name="text" size={24} color="#6B7280" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                            {!!sections.posts?.nextCursor && (
                                <TouchableOpacity style={styles.loadMoreButtonFull} onPress={() => void loadMoreSection('posts')}>
                                    {sectionLoadingMore.posts ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.loadMoreText}>Load more posts</Text>}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {filteredUsers.length === 0 && filteredLocations.length === 0 && filteredPosts.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No results found</Text>
                        </View>
                    )}
                </ScrollView>
            ) : (
                <ScrollView style={styles.emptyState}>
                    {searchMode === 'nearby' && (
                        <View style={styles.searchHistoryCard}>
                            <Text style={styles.sectionTitle}>Nearby scope</Text>
                            <Text style={styles.smallMuted}>Use your saved profile locations to discover nearby users quickly.</Text>
                            <View style={styles.quickPickWrap}>
                                <TouchableOpacity
                                    style={styles.quickPickChip}
                                    disabled={!user?.local}
                                    onPress={() => {
                                        if (!user?.local) return;
                                        setNearbyScope('local');
                                        setSearchQuery(String(user.local));
                                    }}
                                >
                                    <Text style={styles.quickPickChipText}>Local: {user?.local || 'Not set'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.quickPickChip}
                                    disabled={!user?.regional}
                                    onPress={() => {
                                        if (!user?.regional) return;
                                        setNearbyScope('regional');
                                        setSearchQuery(String(user.regional));
                                    }}
                                >
                                    <Text style={styles.quickPickChipText}>Regional: {user?.regional || 'Not set'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    {(searchMode === 'locations' || searchMode === 'venues' || searchMode === 'landmarks') && (
                        <View style={styles.searchHistoryCard}>
                            <Text style={styles.sectionTitle}>
                                {searchMode === 'venues'
                                    ? 'Popular venues'
                                    : searchMode === 'landmarks'
                                        ? 'Popular landmarks'
                                        : 'Popular locations'}
                            </Text>
                            <View style={styles.quickPickWrap}>
                                {(searchMode === 'venues'
                                    ? POPULAR_VENUES
                                    : searchMode === 'landmarks'
                                        ? POPULAR_LANDMARKS
                                        : POPULAR_LOCATIONS
                                ).map((name) => (
                                    <TouchableOpacity
                                        key={`${searchMode}-${name}`}
                                        style={styles.quickPickChip}
                                        onPress={() =>
                                            void goToLocation(
                                                name,
                                                searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location'
                                            )
                                        }
                                    >
                                        <Text style={styles.quickPickChipText}>{name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                    <View style={styles.searchHistoryCard}>
                        <Text style={styles.sectionTitle}>Recent</Text>
                        {recentSearches.length === 0 ? (
                            <Text style={styles.smallMuted}>No recent searches</Text>
                        ) : recentSearches.map((r, idx) => (
                            <TouchableOpacity
                                key={`${r.q}-${idx}`}
                                style={styles.historyRow}
                                onPress={() => {
                                    setSearchMode(r.mode);
                                    setSearchQuery(r.q);
                                }}
                            >
                                <Icon name="time-outline" size={16} color="#9CA3AF" />
                                <Text style={styles.historyText}>{r.q}</Text>
                            </TouchableOpacity>
                        ))}
                        {!!recentSearches.length && (
                            <TouchableOpacity onPress={() => { setRecentSearches([]); void writeSearchList(RECENT_SEARCHES_KEY, []); }}>
                                <Text style={styles.clearText}>Clear recent</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.searchHistoryCard}>
                        <Text style={styles.sectionTitle}>Saved</Text>
                        {savedSearches.length === 0 ? (
                            <Text style={styles.smallMuted}>No saved searches</Text>
                        ) : savedSearches.map((r, idx) => (
                            <TouchableOpacity
                                key={`${r.q}-${idx}`}
                                style={styles.historyRow}
                                onPress={() => {
                                    setSearchMode(r.mode);
                                    setSearchQuery(r.q);
                                }}
                            >
                                <Icon name="bookmark-outline" size={16} color="#9CA3AF" />
                                <Text style={styles.historyText}>{r.q}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.searchHistoryCard}>
                        <Text style={styles.sectionTitle}>Suggested users</Text>
                        {suggestedUsers.map((u) => (
                            <View key={u.handle} style={styles.suggestedRow}>
                                <TouchableOpacity style={styles.suggestedRowLeft} onPress={() => goToUser(u.handle)}>
                                    <Avatar src={u.avatar_url} name={(u.handle || 'User').split('@')[0]} size={36} />
                                    <View style={styles.resultInfo}>
                                        <Text style={styles.resultName}>{u.handle}</Text>
                                        <Text style={styles.resultMeta}>{u.display_name || 'User'}</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.suggestFollowBtn, localFollowState[u.handle] && styles.suggestFollowingBtn]}
                                    disabled={followBusyHandle === u.handle}
                                    onPress={() => void onToggleFollowSuggested(u.handle)}
                                >
                                    {followBusyHandle === u.handle ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.suggestFollowText}>{localFollowState[u.handle] ? 'Following' : 'Follow'}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                    <View style={styles.preloadGrid}>
                        {preloadPosts.map((post) => (
                            <TouchableOpacity key={post.id} onPress={() => goToPost(post.id)} style={styles.preloadItem}>
                                {post.mediaUrl ? (
                                    <Image source={{ uri: post.mediaUrl }} style={styles.preloadImage} />
                                ) : (
                                    <View style={styles.preloadPlaceholder}>
                                        <Icon name="text" size={20} color="#6B7280" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    modeChipsRow: {
        marginTop: 10,
        maxHeight: 36,
    },
    modeChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 8,
    },
    modeChipActive: {
        borderColor: '#8B5CF6',
        backgroundColor: '#2E1065',
    },
    modeChipText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '700',
    },
    modeChipTextActive: {
        color: '#DDD6FE',
    },
    refinementRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nearbyScopeRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    nearbyScopeChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    nearbyScopeChipActive: {
        borderColor: '#22D3EE',
        backgroundColor: '#083344',
    },
    nearbyScopeChipText: {
        color: '#D1D5DB',
        fontSize: 11,
        fontWeight: '700',
    },
    nearbyScopeChipTextActive: {
        color: '#A5F3FC',
    },
    nearbyScopeHint: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    refinementChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#111827',
    },
    refinementChipActive: {
        borderColor: '#F8D26A',
        backgroundColor: '#3F2B07',
    },
    refinementChipText: {
        color: '#D1D5DB',
        fontSize: 11,
        fontWeight: '700',
    },
    refinementChipTextActive: {
        color: '#F8D26A',
    },
    saveSearchBtn: {
        marginLeft: 'auto',
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#FFFFFF',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#8B5CF6',
    },
    tabText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#8B5CF6',
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultsList: {
        flex: 1,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        gap: 12,
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    resultMeta: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 2,
    },
    postResultItem: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    postThumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    postThumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    postsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 1,
    },
    emptyState: {
        flex: 1,
        padding: 16,
    },
    searchHistoryCard: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1F2937',
        backgroundColor: '#111827',
        padding: 12,
        marginBottom: 10,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    smallMuted: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
    },
    historyText: {
        color: '#D1D5DB',
        fontSize: 13,
    },
    clearText: {
        marginTop: 8,
        color: '#F8D26A',
        fontSize: 12,
        fontWeight: '700',
    },
    suggestedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 8,
    },
    suggestedRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    suggestFollowBtn: {
        borderRadius: 999,
        backgroundColor: '#2563EB',
        paddingHorizontal: 12,
        paddingVertical: 7,
        minWidth: 86,
        alignItems: 'center',
    },
    suggestFollowingBtn: {
        backgroundColor: '#374151',
    },
    suggestFollowText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    loadMoreButton: {
        margin: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#111827',
        alignItems: 'center',
        paddingVertical: 10,
    },
    loadMoreButtonFull: {
        width: '100%',
        marginTop: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#111827',
        alignItems: 'center',
        paddingVertical: 10,
    },
    loadMoreText: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '700',
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 40,
    },
    preloadGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
    },
    preloadItem: {
        width: '33.33%',
        aspectRatio: 1,
    },
    preloadImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    preloadPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickPickWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickPickChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#1F2937',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    quickPickChipText: {
        color: '#E5E7EB',
        fontSize: 12,
        fontWeight: '700',
    },
});

export default SearchScreen;
