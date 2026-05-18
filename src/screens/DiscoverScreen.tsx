import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { searchLocations, type LocationSuggestion } from '../api/locations';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import PlaceFeedScopePickerModal from '../components/PlaceFeedScopePickerModal.native';
import { unifiedSearch, type SearchSections } from '../api/search';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel, glassSearch, glassSurface, greetingLight, greetingSubLight } from '../theme/gazetteerAmbientNative';

const popularCities = [
    'Dublin', 'Cork', 'Galway', 'Limerick', 'London', 'Manchester',
    'Paris', 'Berlin', 'Amsterdam', 'Rome', 'Madrid', 'Lisbon',
    'New York', 'Los Angeles', 'Toronto', 'Tokyo', 'Seoul', 'Sydney'
];

const DISCOVER_RECENT_KEY = 'discoverRecentQueriesV1';
const DISCOVER_SAVED_KEY = 'discoverSavedQueriesV1';
const MAX_DISCOVER_HISTORY = 8;

type DiscoverHistoryItem = {
    q: string;
    mode: 'city' | 'landmark' | 'venue';
    ts: number;
};

async function readDiscoverHistory(key: string): Promise<DiscoverHistoryItem[]> {
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

async function writeDiscoverHistory(key: string, items: DiscoverHistoryItem[]) {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch {
        // ignore
    }
}

export default function DiscoverScreen({ navigation }: any) {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const [discoverMode, setDiscoverMode] = useState<'city' | 'landmark' | 'venue'>('city');
    const [recentSearches, setRecentSearches] = useState<DiscoverHistoryItem[]>([]);
    const [savedSearches, setSavedSearches] = useState<DiscoverHistoryItem[]>([]);
    const [topSections, setTopSections] = useState<SearchSections>({});
    const [scopePicker, setScopePicker] = useState<LocationSuggestion | null>(null);
    const modePlaceholder: Record<'city' | 'landmark' | 'venue', string> = {
        city: 'Discover other locations...',
        landmark: 'Discover landmarks...',
        venue: 'Discover venues...',
    };

    const isTypeMatchForMode = (rawType: string | undefined, mode: 'city' | 'landmark' | 'venue') => {
        const normalized = String(rawType || '').toLowerCase();
        if (!normalized) return mode === 'city';
        if (mode === 'venue') return normalized.includes('venue');
        if (mode === 'landmark') return normalized.includes('landmark');
        return normalized.includes('city') || normalized.includes('location') || normalized.includes('town');
    };

    const results = popularCities.filter(city => 
        city.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        let mounted = true;
        Promise.all([readDiscoverHistory(DISCOVER_RECENT_KEY), readDiscoverHistory(DISCOVER_SAVED_KEY)])
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
        const q = query.trim();
        if (q.length < 2) {
            setSuggestions([]);
            setLoading(false);
            return;
        }
        const ctrl = new AbortController();
        const modeForApi = discoverMode === 'venue' ? 'venue' : discoverMode === 'landmark' ? 'landmark' : 'all';
        const id = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(q, 20, modeForApi, ctrl.signal);
                if (!ctrl.signal.aborted) setSuggestions(res);
            } catch (e) {
                if (!ctrl.signal.aborted && (e as Error)?.name !== 'AbortError') setSuggestions([]);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 200);
        return () => {
            clearTimeout(id);
            ctrl.abort();
        };
    }, [query, discoverMode]);

    useEffect(() => {
        const q = query.trim();
        if (!q) {
            setTopSections({});
            return;
        }
        const id = setTimeout(() => {
            unifiedSearch({ q, types: 'users,locations,posts', usersLimit: 3, locationsLimit: 4, postsLimit: 3 })
                .then((r) => setTopSections(r.sections || {}))
                .catch(() => setTopSections({}));
        }, 220);
        return () => clearTimeout(id);
    }, [query]);

    const addRecent = (q: string, mode: 'city' | 'landmark' | 'venue') => {
        const queryText = q.trim();
        if (!queryText) return;
        setRecentSearches((prev) => {
            const next = [{ q: queryText, mode, ts: Date.now() }, ...prev.filter((x) => !(x.q.toLowerCase() === queryText.toLowerCase() && x.mode === mode))]
                .slice(0, MAX_DISCOVER_HISTORY);
            void writeDiscoverHistory(DISCOVER_RECENT_KEY, next);
            return next;
        });
    };

    const toggleSaved = (q: string, mode: 'city' | 'landmark' | 'venue') => {
        const queryText = q.trim();
        if (!queryText) return;
        setSavedSearches((prev) => {
            const exists = prev.some((x) => x.q.toLowerCase() === queryText.toLowerCase() && x.mode === mode);
            const next = exists
                ? prev.filter((x) => !(x.q.toLowerCase() === queryText.toLowerCase() && x.mode === mode))
                : [{ q: queryText, mode, ts: Date.now() }, ...prev].slice(0, MAX_DISCOVER_HISTORY);
            void writeDiscoverHistory(DISCOVER_SAVED_KEY, next);
            return next;
        });
    };

    const openFeedSelection = async (
        selection: ReturnType<typeof resolvePlaceFeedSelection>,
        type: 'location' | 'venue' | 'landmark' = 'location'
    ) => {
        try {
            addRecent(selection.label, discoverMode);
            await AsyncStorage.setItem('pendingLocation', selection.filter);
            await AsyncStorage.setItem('pendingLocationLabel', selection.label);
            await AsyncStorage.setItem('pendingLocationScope', selection.scope);
            await AsyncStorage.setItem('pendingFilterType', type);
            if (selection.placeId) {
                await AsyncStorage.setItem('pendingLocationPlaceId', selection.placeId);
            } else {
                await AsyncStorage.removeItem('pendingLocationPlaceId');
            }
            navigation.navigate('Home', {
                location: selection.filter,
                locationLabel: selection.label,
                locationScope: selection.scope,
                filterType: type,
                placeId: selection.placeId || undefined,
            });
        } catch (err) {
            console.error('Error saving location:', err);
        }
    };

    const onPlaceSuggestionPress = (suggestion: LocationSuggestion) => {
        const kind =
            discoverMode === 'venue' ? 'venue' : discoverMode === 'landmark' ? 'landmark' : 'location';
        if (kind !== 'location') {
            void openFeedSelection(resolvePlaceFeedSelection(suggestion), kind);
            return;
        }
        if (getPlaceFeedPickerOptions(suggestion)) {
            setScopePicker(suggestion);
            return;
        }
        void openFeedSelection(resolvePlaceFeedSelection(suggestion), 'location');
    };

    const selectPopularCity = (name: string) => {
        const suggestion: LocationSuggestion = {
            name,
            type: 'location',
            country: name,
            national: name,
            local: name,
            regional: name,
        };
        const kind =
            discoverMode === 'venue' ? 'venue' : discoverMode === 'landmark' ? 'landmark' : 'location';
        if (kind === 'location' && getPlaceFeedPickerOptions(suggestion)) {
            setScopePicker(suggestion);
            return;
        }
        void openFeedSelection(resolvePlaceFeedSelection(suggestion), kind);
    };

    const rawName = user?.name || 'Friend';
    const firstName = rawName.split('@')[0].trim().split(/\s+/)[0];
    const filteredSuggestionList = suggestions.filter((s) => isTypeMatchForMode((s as any)?.type, discoverMode));
    const displayList = filteredSuggestionList.length > 0
        ? filteredSuggestionList.slice(0, 8)
        : suggestions.length > 0
            ? suggestions.slice(0, 8)
            : results.slice(0, 6).map(r => ({ name: r, type: 'city' as const }));
    const topUsers = Array.isArray(topSections.users?.items) ? topSections.users!.items.slice(0, 3) : [];
    const topLocations = Array.isArray(topSections.locations?.items)
        ? topSections.locations!.items.filter((loc: any) => isTypeMatchForMode(loc?.type, discoverMode)).slice(0, 3)
        : [];
    const topPosts = Array.isArray(topSections.posts?.items) ? topSections.posts!.items.slice(0, 3) : [];
    const isCurrentSaved = savedSearches.some((x) => x.q.toLowerCase() === query.trim().toLowerCase() && x.mode === discoverMode);

    const chooseFromQuery = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        const current = activeIndex >= 0 && displayList[activeIndex] ? displayList[activeIndex] : null;
        if (current) {
            onPlaceSuggestionPress(current as LocationSuggestion);
            return;
        }
        selectPopularCity(trimmed);
    };

    return (
        <>
        <GazetteerScreenShell edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeChipsRow}>
                        {[
                            { id: 'city', label: 'Cities' },
                            { id: 'landmark', label: 'Landmarks' },
                            { id: 'venue', label: 'Venues' },
                        ].map((mode) => {
                            const active = discoverMode === mode.id;
                            return (
                                <TouchableOpacity
                                    key={mode.id}
                                    onPress={() => setDiscoverMode(mode.id as 'city' | 'landmark' | 'venue')}
                                    style={[styles.modeChip, active && styles.modeChipActive]}
                                >
                                    <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{mode.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    {/* Popular cities */}
                    <View style={styles.citiesContainer}>
                        <View style={styles.citiesGrid}>
                            {popularCities.map((city, index) => {
                                const colors = [
                                    '#EC4899', '#3B82F6', '#8B5CF6', '#EF4444', '#EAB308', '#10B981',
                                    '#06B6D4', '#F97316', '#6366F1', '#22C55E', '#A855F7', '#F43F5E',
                                ];
                                return (
                                <TouchableOpacity
                                    key={city}
                                    onPress={() => selectPopularCity(city)}
                                    style={styles.cityButton}
                                >
                                    <Icon name="location" size={16} color={colors[index % colors.length]} />
                                    <Text style={styles.cityButtonText}>{city}</Text>
                                </TouchableOpacity>
                            );})}
                        </View>
                    </View>

                    {/* Greeting */}
                    <View style={styles.greetingContainer}>
                        <Text style={styles.greetingText}>{`Hi ${firstName},`}</Text>
                        <Text style={styles.greetingTextLine2}>let's go social traveling</Text>
                        <View style={styles.greetingSubRow}>
                            <Text style={styles.greetingSubtext}>Where to for your news?</Text>
                            <Icon name="location" size={16} color="rgba(227, 227, 227, 0.72)" />
                        </View>
                    </View>

                    {/* Search input */}
                    <View style={styles.searchContainer}>
                        {query.trim().length >= 2 && (
                            <View style={styles.suggestionsContainer}>
                                {loading && displayList.length === 0 && (
                                    <Text style={styles.suggestionEmpty}>Searching…</Text>
                                )}
                                {!loading && displayList.length === 0 && (
                                    <Text style={styles.suggestionEmpty}>No places found. Try another spelling.</Text>
                                )}
                                {displayList.length > 0 && (
                                <FlatList
                                    data={displayList}
                                    keyExtractor={(item, idx) => `${item.type}-${item.name}-${idx}`}
                                    keyboardShouldPersistTaps="handled"
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            onPress={() =>
                                                onPlaceSuggestionPress({
                                                    name: item.name,
                                                    type:
                                                        discoverMode === 'venue'
                                                            ? 'venue'
                                                            : discoverMode === 'landmark'
                                                                ? 'landmark'
                                                                : 'location',
                                                    country: (item as any).country,
                                                    local: (item as any).local,
                                                    regional: (item as any).regional,
                                                    national: (item as any).national,
                                                    display_name: (item as any).display_name,
                                                })
                                            }
                                            style={[
                                                styles.suggestionItem,
                                                activeIndex === index && styles.suggestionItemActive
                                            ]}
                                        >
                                            <Icon name="location" size={16} color="#f472b6" />
                                            <View style={styles.suggestionContent}>
                                                <Text style={styles.suggestionName}>{item.name}</Text>
                                                {item.country && (
                                                    <Text style={styles.suggestionMeta}>
                                                        {item.type} • {item.country}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                                )}
                            </View>
                        )}
                        <View style={styles.searchInputWrapper}>
                            <Icon name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                            <TextInput
                                value={query}
                                onChangeText={(text) => {
                                    setQuery(text);
                                    setActiveIndex(-1);
                                }}
                                placeholder={modePlaceholder[discoverMode]}
                                placeholderTextColor="#6B7280"
                                style={styles.searchInput}
                                selectionColor="#d91b5c"
                                onSubmitEditing={chooseFromQuery}
                                returnKeyType="search"
                            />
                            {!!query.trim() && (
                                <TouchableOpacity onPress={() => toggleSaved(query, discoverMode)} style={styles.saveBtn}>
                                    <Icon name={isCurrentSaved ? 'bookmark' : 'bookmark-outline'} size={16} color="#8B5CF6" />
                                </TouchableOpacity>
                            )}
                            {!!query && !loading && (
                                <TouchableOpacity onPress={() => { setQuery(''); setActiveIndex(-1); }}>
                                    <Icon name="close-circle" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                            {loading && (
                                <ActivityIndicator size="small" color="#8B5CF6" style={styles.loadingIndicator} />
                            )}
                        </View>
                    </View>
                    {!!query.trim() && (
                        <View style={styles.topResultsCard}>
                            <Text style={styles.topResultsTitle}>Top results</Text>
                            {topLocations.map((loc: any, idx: number) => (
                                <TouchableOpacity
                                    key={`loc-${loc.name}-${idx}`}
                                    style={styles.topResultRow}
                                    onPress={() =>
                                        onPlaceSuggestionPress({
                                            name: loc.name,
                                            type: loc.type || 'location',
                                            country: loc.country,
                                        })
                                    }
                                >
                                    <Icon name="location-outline" size={15} color="#93C5FD" />
                                    <Text style={styles.topResultText}>{loc.name}</Text>
                                </TouchableOpacity>
                            ))}
                            {topUsers.map((u: any, idx: number) => (
                                <TouchableOpacity
                                    key={`user-${u.handle}-${idx}`}
                                    style={styles.topResultRow}
                                    onPress={() => navigation.navigate('ViewProfile', { handle: u.handle })}
                                >
                                    <Icon name="person-outline" size={15} color="#A78BFA" />
                                    <Text style={styles.topResultText}>{u.handle}</Text>
                                </TouchableOpacity>
                            ))}
                            {topPosts.map((p: any, idx: number) => (
                                <TouchableOpacity
                                    key={`post-${p.id}-${idx}`}
                                    style={styles.topResultRow}
                                    onPress={() => navigation.navigate('PostDetail', { postId: p.id })}
                                >
                                    <Icon name="images-outline" size={15} color="#F9A8D4" />
                                    <Text style={styles.topResultText}>{p.text_content || p.caption || 'Post'}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {!query.trim() && (
                        <View style={styles.historyCardsWrap}>
                            <View style={styles.historyCard}>
                                <Text style={styles.historyTitle}>Recent</Text>
                                {recentSearches.length ? recentSearches.map((r, idx) => (
                                    <TouchableOpacity
                                        key={`${r.q}-${idx}`}
                                        style={styles.historyRow}
                                        onPress={() => {
                                            setDiscoverMode(r.mode);
                                            setQuery(r.q);
                                        }}
                                    >
                                        <Icon name="time-outline" size={14} color="#9CA3AF" />
                                        <Text style={styles.historyText}>{r.q}</Text>
                                    </TouchableOpacity>
                                )) : <Text style={styles.historyEmpty}>No recent discover searches</Text>}
                            </View>
                            <View style={styles.historyCard}>
                                <Text style={styles.historyTitle}>Saved</Text>
                                {savedSearches.length ? savedSearches.map((r, idx) => (
                                    <TouchableOpacity
                                        key={`${r.q}-${idx}`}
                                        style={styles.historyRow}
                                        onPress={() => {
                                            setDiscoverMode(r.mode);
                                            setQuery(r.q);
                                        }}
                                    >
                                        <Icon name="bookmark-outline" size={14} color="#9CA3AF" />
                                        <Text style={styles.historyText}>{r.q}</Text>
                                    </TouchableOpacity>
                                )) : <Text style={styles.historyEmpty}>No saved discover searches</Text>}
                            </View>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </GazetteerScreenShell>
        <PlaceFeedScopePickerModal
            visible={!!scopePicker}
            suggestion={scopePicker}
            onClose={() => setScopePicker(null)}
            onSelectScope={(scope) => {
                if (!scopePicker) return;
                void openFeedSelection(resolvePlaceFeedSelection(scopePicker, scope), 'location');
                setScopePicker(null);
            }}
        />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    keyboardView: {
        flex: 1,
        zIndex: 1,
    },
    content: {
        flex: 1,
        padding: 16,
        justifyContent: 'center',
        paddingBottom: 100,
    },
    modeChipsRow: {
        marginBottom: 14,
        maxHeight: 36,
    },
    modeChip: {
        borderRadius: 999,
        ...glassSurface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
    },
    modeChipActive: {
        borderColor: 'rgba(217, 27, 92, 0.55)',
        backgroundColor: 'rgba(217, 27, 92, 0.2)',
    },
    modeChipText: {
        color: '#E8E8E8',
        fontSize: 12,
        fontWeight: '600',
    },
    modeChipTextActive: {
        color: '#FBCFE8',
    },
    citiesContainer: {
        marginBottom: 32,
    },
    citiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    cityButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        ...glassSurface,
        gap: 8,
    },
    cityButtonText: {
        color: '#E8E8E8',
        fontSize: 13,
        fontWeight: '500',
    },
    greetingContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    greetingText: {
        ...greetingLight,
    },
    greetingTextLine2: {
        ...greetingLight,
        marginTop: 2,
    },
    greetingSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    greetingSubtext: {
        ...greetingSubLight,
    },
    searchContainer: {
        position: 'absolute',
        bottom: 40,
        left: 16,
        right: 16,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        ...glassSearch,
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#F3F4F6',
    },
    saveBtn: {
        marginRight: 6,
    },
    loadingIndicator: {
        marginLeft: 8,
    },
    suggestionsContainer: {
        marginBottom: 8,
        ...glassPanel,
        borderRadius: 16,
        maxHeight: 220,
        overflow: 'hidden',
    },
    suggestionEmpty: {
        color: '#9CA3AF',
        fontSize: 13,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    suggestionItemActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    suggestionContent: {
        flex: 1,
    },
    suggestionName: {
        fontSize: 14,
        color: '#F3F4F6',
        fontWeight: '500',
        marginBottom: 2,
    },
    suggestionMeta: {
        fontSize: 11,
        color: '#9CA3AF',
        textTransform: 'capitalize',
    },
    topResultsCard: {
        marginTop: 12,
        borderRadius: 14,
        ...glassPanel,
        padding: 12,
    },
    topResultsTitle: {
        color: '#F3F4F6',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 6,
    },
    topResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
    },
    topResultText: {
        color: '#D1D5DB',
        fontSize: 13,
        flex: 1,
    },
    historyCardsWrap: {
        marginTop: 14,
        gap: 10,
    },
    historyCard: {
        borderRadius: 12,
        ...glassPanel,
        padding: 12,
    },
    historyTitle: {
        color: '#F3F4F6',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 6,
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 5,
    },
    historyText: {
        color: '#D1D5DB',
        fontSize: 13,
    },
    historyEmpty: {
        color: '#9CA3AF',
        fontSize: 12,
    },
});












