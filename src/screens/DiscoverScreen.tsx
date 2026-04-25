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
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { searchLocations, type LocationSuggestion } from '../api/locations';
import { unifiedSearch, type SearchSections } from '../api/search';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserProfile } from '../api/client';

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

function readDiscoverHistory(key: string): DiscoverHistoryItem[] {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x: any) => x && typeof x.q === 'string' && typeof x.mode === 'string');
    } catch {
        return [];
    }
}

function writeDiscoverHistory(key: string, items: DiscoverHistoryItem[]) {
    try {
        localStorage.setItem(key, JSON.stringify(items));
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
    const [recentSearches, setRecentSearches] = useState<DiscoverHistoryItem[]>(() => readDiscoverHistory(DISCOVER_RECENT_KEY));
    const [savedSearches, setSavedSearches] = useState<DiscoverHistoryItem[]>(() => readDiscoverHistory(DISCOVER_SAVED_KEY));
    const [topSections, setTopSections] = useState<SearchSections>({});

    const results = popularCities.filter(city => 
        city.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (!query.trim()) {
            setSuggestions([]);
            return;
        }
        const ctrl = new AbortController();
        const id = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(query.trim(), 20);
                if (!ctrl.signal.aborted) setSuggestions(res);
            } catch (e) {
                if (!ctrl.signal.aborted) setSuggestions([]);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 200);
        return () => {
            clearTimeout(id);
            ctrl.abort();
        };
    }, [query]);

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
            writeDiscoverHistory(DISCOVER_RECENT_KEY, next);
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
            writeDiscoverHistory(DISCOVER_SAVED_KEY, next);
            return next;
        });
    };

    const selectLocation = async (name: string, type: 'location' | 'venue' | 'landmark' = 'location') => {
        try {
            addRecent(name, discoverMode);
            await AsyncStorage.setItem('pendingLocation', name);
            await AsyncStorage.setItem('pendingFilterType', type);
            // Navigate to feed with location
            navigation.navigate('Home', { location: name, filterType: type });
        } catch (err) {
            console.error('Error saving location:', err);
        }
    };

    const rawName = user?.name || 'Friend';
    const firstName = rawName.split('@')[0].trim().split(/\s+/)[0];
    const displayList = suggestions.length > 0 
        ? suggestions.slice(0, 8) 
        : results.slice(0, 6).map(r => ({ name: r, type: 'city' as const }));
    const topUsers = Array.isArray(topSections.users?.items) ? topSections.users!.items.slice(0, 3) : [];
    const topLocations = Array.isArray(topSections.locations?.items) ? topSections.locations!.items.slice(0, 3) : [];
    const topPosts = Array.isArray(topSections.posts?.items) ? topSections.posts!.items.slice(0, 3) : [];
    const isCurrentSaved = savedSearches.some((x) => x.q.toLowerCase() === query.trim().toLowerCase() && x.mode === discoverMode);

    const chooseFromQuery = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        const current = activeIndex >= 0 && displayList[activeIndex] ? displayList[activeIndex] : null;
        const selected = current?.name || trimmed;
        const type = discoverMode === 'venue' ? 'venue' : discoverMode === 'landmark' ? 'landmark' : 'location';
        void selectLocation(selected, type);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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
                                    onPress={() => selectLocation(city, 'location')}
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
                        <Text style={styles.greetingText}>
                            {`Hello, ${firstName}`}
                        </Text>
                        <Text style={styles.greetingSubtext}>Where to for your news?</Text>
                    </View>

                    {/* Search input */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputWrapper}>
                            <Icon name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                            <TextInput
                                value={query}
                                onChangeText={(text) => {
                                    setQuery(text);
                                    setActiveIndex(-1);
                                }}
                                placeholder="Discover other locations..."
                                placeholderTextColor="#6B7280"
                                style={styles.searchInput}
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

                        {/* Suggestions dropdown */}
                        {query && displayList.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                                <FlatList
                                    data={displayList}
                                    keyExtractor={(item, idx) => `${item.type}-${item.name}-${idx}`}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            onPress={() =>
                                                selectLocation(
                                                    item.name,
                                                    discoverMode === 'venue'
                                                        ? 'venue'
                                                        : discoverMode === 'landmark'
                                                            ? 'landmark'
                                                            : 'location'
                                                )
                                            }
                                            style={[
                                                styles.suggestionItem,
                                                activeIndex === index && styles.suggestionItemActive
                                            ]}
                                        >
                                            <Icon name="location" size={16} color="#3B82F6" />
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
                            </View>
                        )}
                    </View>
                    {!!query.trim() && (
                        <View style={styles.topResultsCard}>
                            <Text style={styles.topResultsTitle}>Top results</Text>
                            {topLocations.map((loc: any, idx: number) => (
                                <TouchableOpacity
                                    key={`loc-${loc.name}-${idx}`}
                                    style={styles.topResultRow}
                                    onPress={() => selectLocation(loc.name, discoverMode === 'venue' ? 'venue' : discoverMode === 'landmark' ? 'landmark' : 'location')}
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    keyboardView: {
        flex: 1,
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
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 12,
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
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1F2937',
        gap: 8,
    },
    cityButtonText: {
        color: '#F3F4F6',
        fontSize: 14,
        fontWeight: '500',
    },
    greetingContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    greetingText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#60A5FA',
        textAlign: 'center',
    },
    greetingSubtext: {
        color: '#E5E7EB',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
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
        backgroundColor: '#FFFFFF',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    saveBtn: {
        marginRight: 6,
    },
    loadingIndicator: {
        marginLeft: 8,
    },
    suggestionsContainer: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    suggestionItemActive: {
        backgroundColor: '#F3F4F6',
    },
    suggestionContent: {
        flex: 1,
    },
    suggestionName: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
        marginBottom: 2,
    },
    suggestionMeta: {
        fontSize: 11,
        color: '#6B7280',
        textTransform: 'capitalize',
    },
    topResultsCard: {
        marginTop: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#1F2937',
        backgroundColor: '#111827',
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
        borderWidth: 1,
        borderColor: '#1F2937',
        backgroundColor: '#111827',
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












