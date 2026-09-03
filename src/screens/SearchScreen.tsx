import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedSearch, type SearchSections } from '../api/search';
import { searchLocations, searchLocalGazetteer, type LocationSuggestion } from '../api/locations';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection, type PlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import PlaceFeedScopePickerModal from '../components/PlaceFeedScopePickerModal.native';
import { followOrRequest } from '../utils/followOrRequest';
import { hasPendingFollowRequest } from '../api/privacy';
import { useAuth } from '../context/Auth';
import type { Post } from '../types';
import Avatar from '../components/Avatar.native';
import ProfileGridThumb from '../components/ProfileGridThumb.native';
import { ox } from '../constants/nativeOpticalScale';

type SearchMode = 'locations' | 'venues' | 'landmarks' | 'users' | 'posts' | 'nearby';
type SearchRefinement = 'all' | 'local' | 'regional';
type RecentSearchItem = { q: string; mode: SearchMode; ts: number };

const RECENT_SEARCHES_KEY = 'searchRecentQueriesV1';
const SAVED_SEARCHES_KEY = 'searchSavedQueriesV1';
const MAX_RECENT_SEARCHES = 8;

const QUICK_PICK_CITIES = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin',
    'Amsterdam', 'Lisbon', 'Vienna', 'Prague',
    'Dublin', 'Cork', 'Galway', 'Belfast',
    'New York', 'Los Angeles', 'Chicago',
];
const QUICK_PICK_PIN_COLORS = ['#38BDF8', '#F472B6', '#34D399', '#FBBF24', '#A78BFA', '#F87171'];

const POPULAR_VENUES = [
    'Madison Square Garden', 'Wembley Stadium', 'Camp Nou', 'Allianz Arena',
    'Accor Arena', 'Staples Center', 'Sydney Opera House', 'Croke Park',
];
const POPULAR_LANDMARKS = [
    'Phoenix Park', 'River Liffey', 'Eiffel Tower', 'Big Ben',
    'Statue of Liberty', 'Golden Gate Bridge',
];


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
    const [searchMode, setSearchMode] = useState<SearchMode>('locations');
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
    const [localRequestState, setLocalRequestState] = useState<Record<string, boolean>>({});
    const [suggestedUsers, setSuggestedUsers] = useState<Array<{ handle: string; display_name?: string; avatar_url?: string }>>([]);
    const [placeSuggestions, setPlaceSuggestions] = useState<LocationSuggestion[]>([]);
    const [placeSuggestionsLoading, setPlaceSuggestionsLoading] = useState(false);
    const [scopePicker, setScopePicker] = useState<LocationSuggestion | null>(null);
    const [hideSuggestions, setHideSuggestions] = useState(false);

    const modePlaceholder: Record<SearchMode, string> = {
        locations: 'Search by location',
        venues: 'Search by venue',
        landmarks: 'Search by landmark',
        users: 'Search users',
        posts: 'Search posts',
        nearby: 'Search nearby users',
    };

    const modeChips: Array<{ id: SearchMode; label: string; icon: string }> = [
        { id: 'locations', label: 'Location', icon: 'location-outline' },
        { id: 'venues', label: 'Venue', icon: 'business-outline' },
        { id: 'landmarks', label: 'Landmark', icon: 'flag-outline' },
        { id: 'nearby', label: 'Near me', icon: 'navigate-outline' },
        { id: 'users', label: 'Users', icon: 'people-outline' },
    ];

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

    const isPlaceSearchMode = searchMode === 'locations' || searchMode === 'venues' || searchMode === 'landmarks';

    useEffect(() => {
        const q = searchQuery.trim();
        if (!isPlaceSearchMode || q.length < 2) {
            setPlaceSuggestions([]);
            setPlaceSuggestionsLoading(false);
            return;
        }
        const ctrl = new AbortController();
        const modeForApi =
            searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
        // Instant local rows while (optional) network search completes.
        setPlaceSuggestions(searchLocalGazetteer(q, 8, modeForApi));
        const id = setTimeout(() => {
            setPlaceSuggestionsLoading(true);
            searchLocations(q, 8, modeForApi, ctrl.signal)
                .then((res) => {
                    if (!ctrl.signal.aborted) setPlaceSuggestions(res);
                })
                .catch((err) => {
                    if (!ctrl.signal.aborted && (err as Error)?.name !== 'AbortError') {
                        setPlaceSuggestions(searchLocalGazetteer(q, 8, modeForApi));
                    }
                })
                .finally(() => {
                    if (!ctrl.signal.aborted) setPlaceSuggestionsLoading(false);
                });
        }, 120);
        return () => {
            ctrl.abort();
            clearTimeout(id);
        };
    }, [searchQuery, searchMode, isPlaceSearchMode]);

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
            else if (searchMode === 'posts') types = 'users,posts';
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
                if (user?.handle) {
                    const nextRequests: Record<string, boolean> = {};
                    for (const item of items) {
                        if (item?.handle && hasPendingFollowRequest(user.handle, item.handle)) {
                            nextRequests[item.handle] = true;
                        }
                    }
                    if (Object.keys(nextRequests).length > 0) {
                        setLocalRequestState((prev) => ({ ...prev, ...nextRequests }));
                    }
                }
            })
            .catch(() => setSuggestedUsers([]));
    }, [user?.local, user?.handle]);

    useEffect(() => {
        if (searchMode === 'nearby') {
            const target = user?.local;
            if (target && target.trim().length > 0) {
                setSearchQuery(target);
            }
        }
    }, [searchMode, user?.local]);

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
                u?.location_local,
                u?.location_regional,
                u?.location_national,
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

    const openFeedSelection = async (
        selection: PlaceFeedSelection,
        kind: 'location' | 'venue' | 'landmark' = 'location'
    ) => {
        addRecentSearch(selection.label, searchMode);
        try {
            await AsyncStorage.setItem('pendingLocation', selection.filter);
            await AsyncStorage.setItem('pendingLocationLabel', selection.label);
            await AsyncStorage.setItem('pendingLocationScope', selection.scope);
            await AsyncStorage.setItem('pendingFilterType', kind);
            if (selection.placeId) {
                await AsyncStorage.setItem('pendingLocationPlaceId', selection.placeId);
            } else {
                await AsyncStorage.removeItem('pendingLocationPlaceId');
            }
        } catch {
            // ignore storage errors and still navigate
        }
        // Prefer nested MainTabs → Home → Feed so this works from tab or root stacks.
        navigation.navigate('MainTabs', {
            screen: 'Home',
            params: {
                screen: 'Feed',
                params: {
                    location: selection.filter,
                    locationLabel: selection.label,
                    locationScope: selection.scope,
                    filterType: kind,
                    placeId: selection.placeId || undefined,
                    resetHomeFeedAt: null,
                },
            },
        });
    };

    const goToLocation = (loc: string, kind: 'location' | 'venue' | 'landmark' = 'location') => {
        const suggestion: LocationSuggestion = {
            name: loc,
            type: kind,
            country: loc,
            national: loc,
            local: loc,
            regional: loc,
        };
        if (kind === 'location' && getPlaceFeedPickerOptions(suggestion)) {
            setScopePicker(suggestion);
            return;
        }
        void openFeedSelection(resolvePlaceFeedSelection(suggestion), kind);
    };

    const onPlaceSuggestionPress = (suggestion: LocationSuggestion) => {
        setHideSuggestions(true);
        const kind =
            searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
        const typed: LocationSuggestion =
            kind === 'venue' || kind === 'landmark' ? { ...suggestion, type: kind } : suggestion;
        if (kind !== 'location') {
            void openFeedSelection(resolvePlaceFeedSelection(typed), kind);
            return;
        }
        if (getPlaceFeedPickerOptions(typed)) {
            setScopePicker(typed);
            return;
        }
        void openFeedSelection(resolvePlaceFeedSelection(typed), 'location');
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
        if (searchMode === 'locations' || searchMode === 'venues' || searchMode === 'landmarks') {
            const kind =
                searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
            if (placeSuggestions.length > 0) {
                onPlaceSuggestionPress(placeSuggestions[0]);
                return;
            }
            void goToLocation(q, kind);
            return;
        }
        if (searchMode === 'users' || searchMode === 'nearby') {
            const first = filteredUsers.find((u: any) => String(u?.handle || '').trim());
            if (first?.handle) {
                goToUser(first.handle);
            }
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
        if (!user?.id || !user?.handle) {
            Alert.alert('Sign in required', 'Log in to follow people.');
            return;
        }
        setFollowBusyHandle(handle);
        try {
            const wasFollowing = localFollowState[handle] === true;
            const wasRequested =
                localRequestState[handle] === true ||
                Boolean(user.handle && hasPendingFollowRequest(user.handle, handle));
            const nextFollowing = wasFollowing ? false : wasRequested ? false : true;
            const result = await followOrRequest({
                userId: String(user.id),
                targetHandle: handle,
                viewerHandle: user.handle,
                nextFollowing,
            });
            setLocalFollowState((prev) => ({ ...prev, [handle]: result.following }));
            setLocalRequestState((prev) => ({ ...prev, [handle]: result.requested }));
            if (result.requested && !wasRequested) {
                Alert.alert(
                    'Follow Request Sent',
                    `Your follow request was sent to ${handle}. You'll be notified when they respond.`,
                );
            }
        } catch {
            Alert.alert('Action failed', 'Could not update follow status right now.');
        } finally {
            setFollowBusyHandle(null);
        }
    };

    const onModeChipPress = (id: SearchMode) => {
        if (id === 'nearby') {
            const local = user?.local || 'Local';
            void openFeedSelection(
                {
                    filter: local,
                    scope: 'local',
                    label: local,
                    fullName: local,
                },
                'location'
            );
            return;
        }
        setSearchMode(id);
    };

    return (
        <>
        <GazetteerScreenShell ambient={false} edges={['top']} contentStyle={styles.shell}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        style={styles.backBtn}
                    >
                        <Icon name="arrow-back" size={ox(22)} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Search</Text>
                </View>

                <View style={styles.searchBar}>
                    <Icon name="search" size={ox(18)} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={modePlaceholder[searchMode]}
                        value={searchQuery}
                        onChangeText={(text) => {
                            setSearchQuery(text);
                            setHideSuggestions(false);
                        }}
                        onSubmitEditing={handleSubmitSearch}
                        returnKeyType="search"
                        placeholderTextColor="#6B7280"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {!!searchQuery && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); setHideSuggestions(false); }} hitSlop={8}>
                            <Icon name="close-circle" size={ox(18)} color="#6B7280" />
                        </TouchableOpacity>
                    )}
                </View>

                {isPlaceSearchMode && searchQuery.trim().length >= 2 && !hideSuggestions && (
                    <View style={styles.placeSuggestionsContainer}>
                        {placeSuggestionsLoading && placeSuggestions.length === 0 && (
                            <Text style={styles.placeSuggestionLoading}>Searching…</Text>
                        )}
                        {!placeSuggestionsLoading && placeSuggestions.length === 0 && (
                            <Text style={styles.placeSuggestionLoading}>No places found. Try another spelling.</Text>
                        )}
                        {placeSuggestions.slice(0, 8).map((s, idx) => {
                            const kind = searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
                            const iconName = kind === 'venue' ? 'business' : kind === 'landmark' ? 'flag' : 'location';
                            return (
                                <TouchableOpacity
                                    key={`${s.type}-${s.name}-${idx}`}
                                    style={styles.placeSuggestionRow}
                                    onPress={() => onPlaceSuggestionPress(s)}
                                >
                                    <Icon name={iconName} size={ox(18)} color="#A78BFA" />
                                    <View style={styles.placeSuggestionTextWrap}>
                                        <Text style={styles.placeSuggestionName} numberOfLines={2}>{s.display_name || s.name}</Text>
                                        <Text style={styles.placeSuggestionMeta}>
                                            {kind === 'venue' ? 'Venue' : kind === 'landmark' ? 'Landmark' : 'Location'}
                                            {s.country ? ` · ${s.country}` : ''}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                >
                    {modeChips.map((chip) => {
                        const active = searchMode === chip.id;
                        return (
                            <TouchableOpacity
                                key={chip.id}
                                onPress={() => onModeChipPress(chip.id)}
                                style={[styles.chip, active && styles.chipActive]}
                            >
                                <Icon name={chip.icon as any} size={ox(14)} color={active ? '#111' : '#E5E7EB'} />
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {hasQuery && (searchMode === 'users' || searchMode === 'posts') && (
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
                            <Icon name={isCurrentQuerySaved ? 'bookmark' : 'bookmark-outline'} size={ox(16)} color="#F8D26A" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            ) : hasQuery ? (
                <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled">
                    {(searchMode === 'users' || searchMode === 'nearby' || filteredUsers.length > 0) && (
                        <View>
                            {searchMode !== 'users' && searchMode !== 'nearby' && filteredUsers.length > 0 ? (
                                <Text style={styles.sectionLabel}>PEOPLE</Text>
                            ) : null}
                            {filteredUsers.map((u: any) => (
                                <TouchableOpacity key={u.handle || u.id} onPress={() => goToUser(u.handle)} style={styles.resultItem}>
                                    <Avatar src={u.avatar_url || u.avatarUrl} name={(u.handle || 'User').split('@')[0]} size={ox(40)} />
                                    <View style={styles.resultInfo}>
                                        <Text style={styles.resultName}>{u.handle}</Text>
                                        <Text style={styles.resultMeta}>{u.display_name || 'User'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {!!sections.users?.nextCursor && (searchMode === 'users' || searchMode === 'nearby') && (
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
                                        <Icon name={iconName} size={ox(20)} color="#A78BFA" />
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
                            {filteredPosts.map((post: Post) => (
                                <TouchableOpacity key={post.id} onPress={() => goToPost(post.id)} style={styles.postResultItem}>
                                    <ProfileGridThumb post={post} />
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
                <ScrollView style={styles.idleScroll} contentContainerStyle={styles.idleContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.historyCard}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionLabel}>SAVED SEARCHES</Text>
                            {savedSearches.length > 0 ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSavedSearches([]);
                                        void writeSearchList(SAVED_SEARCHES_KEY, []);
                                    }}
                                >
                                    <Text style={styles.clearLink}>Clear</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        {savedSearches.length === 0 ? (
                            <Text style={styles.idleHint}>No saved searches yet.</Text>
                        ) : (
                            <View style={styles.pillWrap}>
                                {savedSearches.map((item) => (
                                    <TouchableOpacity
                                        key={`saved-${item.mode}-${item.q}-${item.ts}`}
                                        onPress={() => {
                                            setSearchMode(item.mode);
                                            setSearchQuery(item.q);
                                        }}
                                        style={styles.historyPill}
                                    >
                                        <Text style={styles.historyPillText} numberOfLines={1}>{item.q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View style={styles.historyDivider} />

                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionLabel}>RECENT SEARCHES</Text>
                            {recentSearches.length > 0 ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        setRecentSearches([]);
                                        void writeSearchList(RECENT_SEARCHES_KEY, []);
                                    }}
                                >
                                    <Text style={styles.clearLink}>Clear</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        {recentSearches.length === 0 ? (
                            <Text style={styles.idleHint}>Start searching to build recents.</Text>
                        ) : (
                            <View style={styles.pillWrap}>
                                {recentSearches.map((item) => (
                                    <TouchableOpacity
                                        key={`recent-${item.mode}-${item.q}-${item.ts}`}
                                        onPress={() => {
                                            setSearchMode(item.mode);
                                            setSearchQuery(item.q);
                                        }}
                                        style={[styles.historyPill, styles.recentPill]}
                                    >
                                        <Text style={styles.historyPillText} numberOfLines={1}>{item.q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {searchMode === 'locations' ? (
                        <>
                            <View style={styles.quickPicksHeader}>
                                <Text style={styles.sectionLabel}>QUICK PICKS</Text>
                                <Text style={styles.quickPicksHint}>Tap to jump feed.</Text>
                            </View>
                            <View style={styles.quickGrid}>
                                {QUICK_PICK_CITIES.map((name, idx) => (
                                    <TouchableOpacity
                                        key={name}
                                        onPress={() => goToLocation(name, 'location')}
                                        style={styles.quickCard}
                                    >
                                        <View style={styles.quickCardTitleRow}>
                                            <View style={styles.quickPinWrap}>
                                                <Icon
                                                    name="location"
                                                    size={ox(12)}
                                                    color={QUICK_PICK_PIN_COLORS[idx % QUICK_PICK_PIN_COLORS.length]}
                                                />
                                            </View>
                                            <Text style={styles.quickCardTitle} numberOfLines={1}>{name}</Text>
                                        </View>
                                        <Text style={styles.quickCardSub}>Live news near here</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {searchMode === 'venues' ? (
                        <>
                            <View style={styles.quickPicksHeader}>
                                <Text style={styles.sectionLabel}>POPULAR VENUES</Text>
                                <Text style={styles.quickPicksHint}>Tap to open venue feed</Text>
                            </View>
                            <View style={styles.popularGrid}>
                                {POPULAR_VENUES.map((name) => (
                                    <TouchableOpacity
                                        key={name}
                                        onPress={() => goToLocation(name, 'venue')}
                                        style={styles.popularCard}
                                    >
                                        <View style={styles.quickCardTitleRow}>
                                            <Icon name="business-outline" size={ox(14)} color="#fff" />
                                            <Text style={styles.quickCardTitle} numberOfLines={1}>{name}</Text>
                                        </View>
                                        <Text style={styles.quickCardSub}>Popular venue</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {searchMode === 'landmarks' ? (
                        <>
                            <View style={styles.quickPicksHeader}>
                                <Text style={styles.sectionLabel}>POPULAR LANDMARKS</Text>
                                <Text style={styles.quickPicksHint}>Tap to open landmark feed</Text>
                            </View>
                            <View style={styles.popularGrid}>
                                {POPULAR_LANDMARKS.map((name) => (
                                    <TouchableOpacity
                                        key={name}
                                        onPress={() => goToLocation(name, 'landmark')}
                                        style={styles.popularCard}
                                    >
                                        <View style={styles.quickCardTitleRow}>
                                            <Icon name="flag-outline" size={ox(14)} color="#fff" />
                                            <Text style={styles.quickCardTitle} numberOfLines={1}>{name}</Text>
                                        </View>
                                        <Text style={styles.quickCardSub}>Popular landmark</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {searchMode === 'users' ? (
                        <View style={styles.usersCard}>
                            <Text style={styles.sectionLabel}>SUGGESTED USERS</Text>
                            {suggestedUsers.length === 0 ? (
                                <Text style={styles.idleHint}>No suggestions yet.</Text>
                            ) : (
                                suggestedUsers.map((u) => (
                                    <View key={u.handle} style={styles.suggestedRow}>
                                        <TouchableOpacity style={styles.suggestedRowLeft} onPress={() => goToUser(u.handle)}>
                                            <Avatar src={u.avatar_url} name={(u.handle || 'User').split('@')[0]} size={ox(36)} />
                                            <View style={styles.resultInfo}>
                                                <Text style={styles.resultName}>{u.handle}</Text>
                                                <Text style={styles.resultMeta}>{u.display_name || 'User'}</Text>
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.suggestFollowBtn,
                                                (localFollowState[u.handle] || localRequestState[u.handle]) &&
                                                    styles.suggestFollowingBtn,
                                            ]}
                                            disabled={followBusyHandle === u.handle}
                                            onPress={() => void onToggleFollowSuggested(u.handle)}
                                        >
                                            {followBusyHandle === u.handle ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <Text style={styles.suggestFollowText}>
                                                    {localFollowState[u.handle]
                                                        ? 'Following'
                                                        : localRequestState[u.handle]
                                                          ? 'Requested'
                                                          : 'Follow'}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>
                    ) : null}
                </ScrollView>
            )}
        </GazetteerScreenShell>
        <PlaceFeedScopePickerModal
            visible={!!scopePicker}
            suggestion={scopePicker}
            onClose={() => {
                setHideSuggestions(false);
                setScopePicker(null);
            }}
            onSelectScope={(scope) => {
                if (!scopePicker) return;
                void openFeedSelection(resolvePlaceFeedSelection(scopePicker, scope), 'location');
                setScopePicker(null);
            }}
        />
        </>
    );
};

const styles = StyleSheet.create({
    shell: {
        backgroundColor: '#000',
    },
    header: {
        paddingHorizontal: ox(16),
        paddingTop: ox(8),
        paddingBottom: ox(10),
        gap: ox(10),
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
    },
    backBtn: {
        padding: ox(4),
        marginLeft: -4,
    },
    title: {
        color: '#FFFFFF',
        fontSize: ox(17),
        fontWeight: '700',
        letterSpacing: ox(-0.2),
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#101010',
        borderWidth: 1,
        borderColor: '#272727',
        borderRadius: ox(20),
        paddingHorizontal: ox(14),
        paddingVertical: ox(11),
        gap: ox(8),
    },
    searchInput: {
        flex: 1,
        fontSize: ox(14),
        color: '#F3F4F6',
        padding: 0,
    },
    chipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        paddingVertical: ox(2),
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        borderRadius: ox(999),
        backgroundColor: '#0d0d0f',
        borderWidth: 1,
        borderColor: '#2a2a2a',
        paddingHorizontal: ox(14),
        paddingVertical: ox(9),
    },
    chipActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    chipText: {
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#111827',
    },
    refinementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
    },
    refinementChip: {
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: '#2a2a2a',
        backgroundColor: '#0d0d0f',
        paddingHorizontal: ox(10),
        paddingVertical: ox(5),
    },
    refinementChipActive: {
        borderColor: '#F8D26A',
        backgroundColor: '#3F2B07',
    },
    refinementChipText: {
        color: '#D1D5DB',
        fontSize: ox(11),
        fontWeight: '700',
    },
    refinementChipTextActive: {
        color: '#F8D26A',
    },
    saveSearchBtn: {
        marginLeft: 'auto',
        padding: ox(4),
    },
    placeSuggestionsContainer: {
        borderRadius: ox(16),
        borderWidth: 1,
        borderColor: '#272727',
        backgroundColor: '#101010',
        maxHeight: ox(260),
        overflow: 'hidden',
    },
    placeSuggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        paddingHorizontal: ox(14),
        paddingVertical: ox(12),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    placeSuggestionTextWrap: {
        flex: 1,
    },
    placeSuggestionName: {
        color: '#F9FAFB',
        fontSize: ox(14),
        fontWeight: '600',
    },
    placeSuggestionMeta: {
        color: '#9CA3AF',
        fontSize: ox(11),
        marginTop: ox(2),
    },
    placeSuggestionLoading: {
        color: '#9CA3AF',
        fontSize: ox(13),
        paddingHorizontal: ox(14),
        paddingVertical: ox(12),
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
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        gap: ox(12),
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        fontSize: ox(15),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    resultMeta: {
        fontSize: ox(13),
        color: '#9CA3AF',
        marginTop: ox(2),
    },
    postResultItem: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    postsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 1,
    },
    emptyState: {
        padding: ox(16),
    },
    emptyText: {
        fontSize: ox(16),
        color: '#6B7280',
        textAlign: 'center',
        marginTop: ox(40),
    },
    idleScroll: {
        flex: 1,
    },
    idleContent: {
        paddingHorizontal: ox(16),
        paddingBottom: ox(28),
        gap: ox(14),
    },
    historyCard: {
        borderRadius: ox(24),
        backgroundColor: '#050505',
        borderWidth: 1,
        borderColor: '#181818',
        paddingHorizontal: ox(12),
        paddingTop: ox(12),
        paddingBottom: ox(14),
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ox(8),
    },
    sectionLabel: {
        color: '#9CA3AF',
        fontSize: ox(11),
        fontWeight: '700',
        letterSpacing: ox(1.6),
        textTransform: 'uppercase',
    },
    clearLink: {
        color: '#6B7280',
        fontSize: ox(11),
        fontWeight: '600',
    },
    idleHint: {
        color: '#6B7280',
        fontSize: ox(12),
    },
    historyDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#181818',
        marginVertical: ox(14),
    },
    pillWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(8),
    },
    historyPill: {
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: ox(14),
        paddingVertical: ox(8),
        maxWidth: '100%',
    },
    recentPill: {
        borderColor: '#2a2a2a',
        backgroundColor: '#101010',
    },
    historyPillText: {
        color: '#F3F4F6',
        fontSize: ox(12),
        fontWeight: '500',
    },
    quickPicksHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(2),
    },
    quickPicksHint: {
        color: '#6B7280',
        fontSize: ox(11),
    },
    quickGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(8),
    },
    quickCard: {
        width: '31.5%',
        borderRadius: ox(16),
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: ox(10),
        paddingVertical: ox(10),
        gap: ox(6),
    },
    popularGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(8),
    },
    popularCard: {
        width: '48.5%',
        borderRadius: ox(16),
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
        gap: ox(6),
    },
    quickCardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
    },
    quickPinWrap: {
        width: ox(20),
        height: ox(20),
        borderRadius: ox(10),
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickCardTitle: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '600',
    },
    quickCardSub: {
        color: '#6B7280',
        fontSize: ox(10),
    },
    usersCard: {
        borderRadius: ox(24),
        backgroundColor: '#050505',
        borderWidth: 1,
        borderColor: '#181818',
        padding: ox(12),
        gap: ox(10),
    },
    suggestedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ox(8),
    },
    suggestedRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: ox(10),
    },
    suggestFollowBtn: {
        borderRadius: ox(999),
        backgroundColor: '#2563EB',
        paddingHorizontal: ox(12),
        paddingVertical: ox(7),
        minWidth: ox(86),
        alignItems: 'center',
    },
    suggestFollowingBtn: {
        backgroundColor: '#374151',
    },
    suggestFollowText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '700',
    },
    loadMoreButton: {
        margin: ox(12),
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: '#2a2a2a',
        backgroundColor: '#0d0d0f',
        alignItems: 'center',
        paddingVertical: ox(10),
    },
    loadMoreButtonFull: {
        width: '100%',
        marginTop: ox(8),
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: '#2a2a2a',
        backgroundColor: '#0d0d0f',
        alignItems: 'center',
        paddingVertical: ox(10),
    },
    loadMoreText: {
        color: '#E5E7EB',
        fontSize: ox(13),
        fontWeight: '700',
    },
});

export default SearchScreen;
