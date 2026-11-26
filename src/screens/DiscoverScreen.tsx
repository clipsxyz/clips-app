import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Keyboard,
    Platform,
    KeyboardAvoidingView,
    DeviceEventEmitter,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/Auth';
import { searchLocations, searchLocalGazetteer, type LocationSuggestion } from '../api/locations';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection, type PlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import PlaceFeedScopePickerModal from '../components/PlaceFeedScopePickerModal.native';
import Avatar from '../components/Avatar.native';
import {
    UCL_TEXT_ACTIVE,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
    UCL_TEXT_SECONDARY,
} from '../theme/gazetteerAmbientNative';
import { navigateMainTab, navigatePassport } from '../navigation/mainTabs';
import { clearPendingLocationFeed, writePendingLocationFeed } from '../utils/pendingLocationNative';
import { ox } from '../constants/nativeOpticalScale';
import { connectSocket, joinLocationFeed, leaveLocationFeed } from '../services/socketio';
import {
    buildDiscoverPrompts,
    discoverDisplayName,
    discoverGreeting,
    DISCOVER_GREETINGS,
    loadDiscoverActivePlaces,
    type DiscoverActivePlaces,
} from '../utils/discoverHomeRotation';

const POPULAR = [
    'Dublin', 'Cork', 'London', 'Paris', 'Berlin', 'New York', 'Tokyo', 'Sydney',
];

const ROTATING_CITIES = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo',
    'Dublin', 'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam',
];
const PLACEHOLDER_ROTATE_MS = 2800;
/** Pitch black through the hero; deep violet glow only in the bottom third. */
const DISCOVER_CANVAS_COLORS = ['#000000', '#060609', '#140D2E', '#1E1344'] as const;
const DISCOVER_CANVAS_LOCATIONS = [0, 0.65, 0.84, 1] as const;

const AVATAR = ox(68);
const AVATAR_RING_COLOR = 'rgba(255, 255, 255, 0.22)';

export default function DiscoverScreen({ navigation }: any) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [scopePicker, setScopePicker] = useState<LocationSuggestion | null>(null);
    const [hideSuggestions, setHideSuggestions] = useState(false);
    const [placeholderCityIndex, setPlaceholderCityIndex] = useState(0);
    const [greetingIndex, setGreetingIndex] = useState(() => Math.floor(Math.random() * DISCOVER_GREETINGS.length));
    const [promptTick, setPromptTick] = useState(() => Math.floor(Math.random() * DISCOVER_GREETINGS.length));
    const [activePlaces, setActivePlaces] = useState<DiscoverActivePlaces>({ cities: [], streets: [], neighborhoods: [] });
    const greetingIndexRef = useRef(greetingIndex);
    const promptTickRef = useRef(promptTick);
    const hasFocusedDiscover = useRef(false);
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const [liveDropCount, setLiveDropCount] = useState(0);
    const inputRef = useRef<TextInput>(null);

    const popularResults = useMemo(
        () => POPULAR.filter((name) => name.toLowerCase().includes(query.toLowerCase())),
        [query],
    );

    const hasSearchQuery = query.trim().length > 0;
    const showSuggestionsPanel = query.trim().length >= 2 && !scopePicker && !hideSuggestions;
    const keyboardLayout = keyboardOpen;

    const displayName = discoverDisplayName(user?.handle, user?.name);
    const greetingLine = discoverGreeting(greetingIndex, displayName);
    const promptSuggestions = useMemo(
        () => buildDiscoverPrompts(activePlaces, promptTick),
        [activePlaces, promptTick],
    );
    const pillCities = useMemo(() => {
        const blocked = new Set(promptSuggestions.map((item) => item.city.toLowerCase()));
        const open = ROTATING_CITIES.filter((city) => !blocked.has(city.toLowerCase()));
        return open.length > 0 ? open : ROTATING_CITIES;
    }, [promptSuggestions]);
    const placeholderCity = pillCities[placeholderCityIndex % pillCities.length];

    useFocusEffect(
        React.useCallback(() => {
            let cancelled = false;
            const returning = hasFocusedDiscover.current;
            hasFocusedDiscover.current = true;
            if (returning) {
                const nextGreeting = (greetingIndexRef.current + 1) % DISCOVER_GREETINGS.length;
                const nextTick = promptTickRef.current + 1;
                greetingIndexRef.current = nextGreeting;
                promptTickRef.current = nextTick;
                setGreetingIndex(nextGreeting);
                setPromptTick(nextTick);
            }
            void loadDiscoverActivePlaces().then((places) => {
                if (!cancelled) setActivePlaces(places);
            });
            return () => {
                cancelled = true;
            };
        }, []),
    );

    useEffect(() => {
        if (hasSearchQuery || pillCities.length === 0) return;
        const id = setInterval(() => {
            setPlaceholderCityIndex((i) => (i + 1) % pillCities.length);
        }, PLACEHOLDER_ROTATE_MS);
        return () => clearInterval(id);
    }, [hasSearchQuery, pillCities.length]);

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardOpen(true),
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardOpen(false),
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (!scopePicker) return;
        inputRef.current?.blur();
        Keyboard.dismiss();
    }, [scopePicker]);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setSuggestions([]);
            setLoading(false);
            return;
        }
        // Paint local matches immediately so the dropdown never waits on network.
        setSuggestions(searchLocalGazetteer(q, 20, 'all'));
        const ctrl = new AbortController();
        const id = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(q, 20, 'all', ctrl.signal);
                if (!ctrl.signal.aborted) setSuggestions(res);
            } catch (e) {
                if (!ctrl.signal.aborted && (e as Error)?.name !== 'AbortError') {
                    setSuggestions(searchLocalGazetteer(q, 20, 'all'));
                }
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 120);
        return () => {
            clearTimeout(id);
            ctrl.abort();
        };
    }, [query]);

    useEffect(() => {
        if (!user?.handle) return;
        const rooms = [user.local, user.regional, user.national]
            .map((loc) => (typeof loc === 'string' ? loc.trim() : ''))
            .filter((loc, i, all) => loc.length > 0 && all.indexOf(loc) === i)
            .map((location) => ({ location }));
        if (rooms.length === 0) return;
        const socket = connectSocket(user.handle);
        rooms.forEach((room) => joinLocationFeed(room));
        const seen = new Set<string>();
        const onNewFeedPost = (data: { post?: { id?: string } }) => {
            const id = data?.post?.id;
            if (!id || seen.has(String(id))) return;
            seen.add(String(id));
            setLiveDropCount((n) => n + 1);
        };
        socket?.on('newFeedPost', onNewFeedPost);
        const busSub = DeviceEventEmitter.addListener('newFeedPost', onNewFeedPost);
        return () => {
            socket?.off('newFeedPost', onNewFeedPost);
            busSub.remove();
            rooms.forEach((room) => leaveLocationFeed(room));
        };
    }, [user?.handle, user?.local, user?.regional, user?.national]);

    const openFeedSelection = (selection: PlaceFeedSelection) => {
        if (typeof writePendingLocationFeed === 'function') {
            void writePendingLocationFeed({
                filter: selection.filter,
                label: selection.label,
                scope: selection.scope,
                placeId: selection.placeId || null,
                filterType: 'location',
            });
        } else {
            console.warn('writePendingLocationFeed is not defined');
        }
        // Discover is a root stack screen — "Home" lives under MainTabs → Feed.
        // Explicitly null out resetHomeFeedAt so a prior Home-tab reset doesn't
        // win the param merge and wipe this Discover/Local location.
        navigateMainTab(navigation, 'Home', {
            screen: 'Feed',
            params: {
                location: selection.filter,
                locationLabel: selection.label,
                locationScope: selection.scope,
                filterType: 'location',
                placeId: selection.placeId || undefined,
                resetHomeFeedAt: null,
            },
        });
    };

    const dismissSuggestionList = () => {
        setHideSuggestions(true);
        setActiveIndex(-1);
        inputRef.current?.blur();
        Keyboard.dismiss();
    };

    const onSuggestionSelected = (suggestion: LocationSuggestion) => {
        dismissSuggestionList();
        if (getPlaceFeedPickerOptions(suggestion)) {
            setScopePicker(suggestion);
            return;
        }
        openFeedSelection(resolvePlaceFeedSelection(suggestion));
    };

    const selectPopularCity = (name: string) => {
        dismissSuggestionList();
        openFeedSelection(
            resolvePlaceFeedSelection({
                name,
                type: 'location',
                country: name,
                national: name,
                local: name,
                regional: name,
            }),
        );
    };

    const clearSearch = () => {
        setQuery('');
        setSuggestions([]);
        setActiveIndex(-1);
        setHideSuggestions(false);
        inputRef.current?.blur();
        Keyboard.dismiss();
    };

    const chooseFromQuery = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        if (suggestions.length > 0) {
            const chosen = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
            if (chosen) onSuggestionSelected(chosen);
            return;
        }
        selectPopularCity(trimmed);
    };

    const openScopedFeed = (scope: 'local' | 'regional' | 'national', place: string) => {
        const name = place.trim();
        if (!name) return;
        setLiveDropCount(0);
        void (async () => {
            await clearPendingLocationFeed();
            navigateMainTab(navigation, 'Home', {
                screen: 'Feed',
                params: {
                    nativeHomeScope: scope,
                    location: null,
                    locationLabel: null,
                    locationScope: null,
                    filterType: null,
                    placeId: null,
                    resetHomeFeedAt: null,
                },
            });
        })();
    };

    const nearbyPlace = (user?.local || 'Finglas').trim();
    const regionalPlace = (user?.regional || '').trim();
    const nationalPlace = (user?.national || '').trim();
    const scopePills = [
        { key: 'nearby', label: 'Nearby', place: nearbyPlace, scope: 'local' as const, icon: 'locate-outline' },
        { key: 'regional', label: regionalPlace || 'Regional', place: regionalPlace, scope: 'regional' as const, icon: 'business-outline' },
        { key: 'national', label: nationalPlace || 'National', place: nationalPlace, scope: 'national' as const, icon: 'globe-outline' },
    ];

    const showApiRows = suggestions.length > 0;
    const showPopularFallback = !loading && suggestions.length === 0 && popularResults.length > 0;
    const showEmpty = !loading && suggestions.length === 0 && popularResults.length === 0;

    const avatarName = (user?.handle || user?.name || 'User').split('@')[0];

    const ui = (
        <View
            style={[
                styles.ui,
                keyboardLayout ? styles.uiKeyboard : null,
                { paddingBottom: Math.max(insets.bottom, 12) + 10 },
            ]}
            collapsable={false}
        >
            {!keyboardLayout ? (
                <View style={styles.hero}>
                    <View style={styles.heroAvatarWrap}>
                        <TouchableOpacity
                            onPress={() => navigatePassport(navigation, 'Home')}
                            accessibilityLabel="Open Passport"
                            style={styles.heroAvatar}
                        >
                            <Avatar
                                src={user?.avatarUrl}
                                name={avatarName}
                                handle={user?.handle}
                                size={AVATAR}
                                borderWidth={1.5}
                                ringColor={AVATAR_RING_COLOR}
                            />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.greetingText}>{greetingLine}</Text>
                </View>
            ) : (
                <View style={styles.heroSpacer} />
            )}

            <View style={styles.searchDock}>
                {showSuggestionsPanel ? (
                    <View
                        style={[
                            styles.resultsPanel,
                            keyboardLayout ? styles.resultsPanelKeyboard : styles.resultsPanelOpen,
                        ]}
                    >
                        <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled bounces={false}>
                            {loading && suggestions.length === 0 && popularResults.length === 0 ? (
                                <Text style={styles.suggestionEmpty}>Searching…</Text>
                            ) : null}
                            {showEmpty ? (
                                <Text style={styles.suggestionEmpty}>
                                    No places found. Try another spelling.
                                </Text>
                            ) : null}
                            {showApiRows
                                ? suggestions.slice(0, 8).map((s, idx) => {
                                      const primary = s.display_name || s.name.split(',')[0];
                                      return (
                                          <TouchableOpacity
                                              key={`api-${s.type}-${s.place_id || s.name}-${idx}`}
                                              onPress={() => onSuggestionSelected(s)}
                                              style={styles.resultRow}
                                          >
                                              <Icon name="location-outline" size={ox(16)} color={UCL_TEXT_PRIMARY} style={styles.listIcon} />
                                              <View style={styles.resultCopy}>
                                                  <Text style={styles.resultPrimary}>{primary}</Text>
                                                  <Text style={styles.resultSecondary}>{s.name}</Text>
                                              </View>
                                          </TouchableOpacity>
                                      );
                                  })
                                : null}
                            {showPopularFallback
                                ? popularResults.slice(0, 6).map((name) => (
                                      <TouchableOpacity
                                          key={name}
                                          onPress={() => selectPopularCity(name)}
                                          style={styles.resultRow}
                                      >
                                          <Icon name="location-outline" size={ox(16)} color={UCL_TEXT_PRIMARY} style={styles.listIcon} />
                                          <Text style={styles.resultPrimary}>{name}</Text>
                                      </TouchableOpacity>
                                  ))
                                : null}
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.promptList}>
                        {promptSuggestions.map((item) => (
                            <TouchableOpacity
                                key={item.city}
                                onPress={() => selectPopularCity(item.city)}
                                style={styles.promptRow}
                                accessibilityLabel={item.label}
                            >
                                <Icon name="return-down-forward-outline" size={ox(18)} color="#C4C7C5" />
                                <Icon name={item.icon} size={ox(18)} color="#C4C7C5" style={styles.listIcon} />
                                <Text style={styles.promptText}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {liveDropCount > 0 ? (
                    <TouchableOpacity
                        style={styles.liveDropBadge}
                        onPress={() => {
                            setLiveDropCount(0);
                            openScopedFeed('local', nearbyPlace);
                        }}
                        activeOpacity={0.88}
                        accessibilityLabel={`${liveDropCount} new drops nearby`}
                    >
                        <Icon name="sparkles-outline" size={ox(14)} color="#04110f" />
                        <Text style={styles.liveDropBadgeText}>
                            {liveDropCount === 1
                                ? '1 new drop nearby'
                                : `${liveDropCount} new drops nearby`}
                        </Text>
                    </TouchableOpacity>
                ) : null}
                <View style={styles.searchPill}>
                    <Icon name="add" size={ox(22)} color={UCL_TEXT_PRIMARY} style={styles.searchIcon} />
                    <Text style={styles.searchPrefix} numberOfLines={1} ellipsizeMode="tail">
                        Discover ·
                    </Text>
                    <TextInput
                        ref={inputRef}
                        value={query}
                        onChangeText={(text) => {
                            setQuery(text);
                            setActiveIndex(-1);
                            setHideSuggestions(false);
                        }}
                        placeholder={hasSearchQuery ? '' : placeholderCity}
                        placeholderTextColor={UCL_TEXT_PLACEHOLDER}
                        style={styles.searchInput}
                        selectionColor={UCL_TEXT_ACTIVE}
                        onSubmitEditing={chooseFromQuery}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        underlineColorAndroid="transparent"
                    />
                    {hasSearchQuery ? (
                        <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                            <Icon name="close" size={ox(16)} color={UCL_TEXT_PLACEHOLDER} />
                        </TouchableOpacity>
                    ) : null}
                    {loading ? <ActivityIndicator size="small" color={UCL_TEXT_ACTIVE} /> : null}
                    <TouchableOpacity
                        onPress={chooseFromQuery}
                        style={styles.goBtn}
                        accessibilityLabel="Search places"
                    >
                        <Icon name="arrow-forward" size={ox(18)} color="#D8B4FE" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <>
            {/* Page canvas only — black hero, soft violet glow behind the prompts. */}
            <LinearGradient
                colors={[...DISCOVER_CANVAS_COLORS]}
                locations={[...DISCOVER_CANVAS_LOCATIONS]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.root}
            >
                <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) + 32 }]}>
                    {scopePills.map((pill) => (
                        <TouchableOpacity
                            key={pill.key}
                            onPress={() => openScopedFeed(pill.scope, pill.place)}
                            style={styles.scopePill}
                            accessibilityLabel={`Open ${pill.label} feed`}
                        >
                            <Icon name="return-down-forward-outline" size={ox(18)} color="#C4C7C5" />
                            <Icon name={pill.icon} size={ox(18)} color="#C4C7C5" />
                            <Text style={styles.scopePillText} numberOfLines={1}>
                                {pill.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {ui}
                </KeyboardAvoidingView>
            </LinearGradient>

            <PlaceFeedScopePickerModal
                visible={!!scopePicker}
                suggestion={scopePicker}
                onClose={() => {
                    setHideSuggestions(false);
                    setScopePicker(null);
                }}
                onSelectScope={(scope) => {
                    if (!scopePicker) return;
                    openFeedSelection(resolvePlaceFeedSelection(scopePicker, scope));
                    setScopePicker(null);
                }}
            />
        </>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    root: {
        flex: 1,
        backgroundColor: '#000000',
    },
    ui: {
        flex: 1,
        paddingHorizontal: ox(20),
        justifyContent: 'space-between',
    },
    uiKeyboard: {
        justifyContent: 'flex-start',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        minHeight: ox(44),
        paddingHorizontal: ox(20),
        flexShrink: 0,
    },
    scopePill: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(4),
    },
    scopePillText: {
        flex: 1,
        minWidth: 0,
        color: '#D2D5DA',
        fontSize: ox(15),
        lineHeight: ox(20),
        fontWeight: '400',
    },
    hero: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: ox(36),
    },
    heroSpacer: {
        height: ox(8),
    },
    heroAvatarWrap: {
        width: AVATAR,
        height: AVATAR,
        marginBottom: ox(22),
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroAvatar: {
        width: AVATAR,
        height: AVATAR,
        alignItems: 'center',
        justifyContent: 'center',
    },
    greetingText: {
        color: '#E8EAED',
        fontSize: ox(28),
        lineHeight: ox(35),
        fontWeight: '400',
        letterSpacing: -0.4,
        textAlign: 'center',
        alignSelf: 'stretch',
        includeFontPadding: false,
    },
    searchDock: {
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
        paddingBottom: ox(8),
    },
    promptList: {
        marginBottom: ox(22),
        paddingHorizontal: ox(4),
        gap: ox(22),
    },
    promptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(14),
        paddingVertical: ox(2),
    },
    promptText: {
        flex: 1,
        color: '#C4C7C5',
        fontSize: ox(15),
        lineHeight: ox(21),
        fontWeight: '400',
        includeFontPadding: false,
    },
    resultsPanel: {
        borderRadius: ox(16),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(8, 18, 16, 0.88)',
        overflow: 'hidden',
        marginBottom: ox(10),
    },
    resultsPanelOpen: { maxHeight: 256 },
    resultsPanelKeyboard: { maxHeight: 180 },
    suggestionEmpty: {
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(14),
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    resultCopy: { flex: 1, minWidth: 0 },
    listIcon: { marginRight: ox(6) },
    resultPrimary: { color: UCL_TEXT_PRIMARY, fontSize: ox(14), fontWeight: '600' },
    resultSecondary: { color: UCL_TEXT_SECONDARY, fontSize: ox(11), marginTop: ox(2) },
    liveDropBadge: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        marginBottom: ox(12),
        paddingHorizontal: ox(14),
        paddingVertical: ox(8),
        borderRadius: ox(999),
        backgroundColor: '#3D9B8F',
    },
    liveDropBadgeText: {
        color: '#04110f',
        fontSize: ox(13),
        fontWeight: '700',
    },
    searchPill: {
        width: '100%',
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: ox(30),
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(216, 180, 254, 0.12)',
        paddingLeft: ox(18),
        paddingRight: ox(8),
        minHeight: ox(60),
    },
    searchIcon: { marginRight: ox(14) },
    searchPrefix: {
        flexShrink: 0,
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(16),
        lineHeight: ox(22),
        fontWeight: '400',
        marginRight: ox(8),
        includeFontPadding: false,
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '600',
        paddingVertical: 0,
        marginRight: ox(12),
        backgroundColor: 'transparent',
        includeFontPadding: false,
        ...(Platform.OS === 'android' ? { textAlignVertical: 'center' as const } : null),
    },
    clearBtn: {
        width: ox(28),
        height: ox(28),
        borderRadius: ox(14),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: ox(4),
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    goBtn: {
        width: ox(40),
        height: ox(40),
        borderRadius: ox(20),
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: ox(6),
        backgroundColor: 'rgba(139, 92, 246, 0.24)',
    },
});
