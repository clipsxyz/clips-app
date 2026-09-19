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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/Auth';
import { searchLocations, searchLocalGazetteer, type LocationSuggestion } from '../api/locations';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection, type PlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import PlaceFeedScopePickerModal from '../components/PlaceFeedScopePickerModal.native';
import Avatar from '../components/Avatar.native';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import { navigateMainTab, navigatePassport } from '../navigation/mainTabs';
import {
    clearPendingLocationFeed,
    writePendingLocationFeed,
} from '../utils/pendingLocationNative';
import { ox } from '../constants/nativeOpticalScale';

const POPULAR = [
    'Dublin', 'Cork', 'London', 'Paris', 'Berlin', 'New York', 'Tokyo', 'Sydney',
];

const ROTATING_CITIES = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo',
    'Dublin', 'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam',
];
const PLACEHOLDER_ROTATE_MS = 2800;

/** Gemini-style canvas: black field, Gazetteer sea-glass only in the lower third. */
const DISCOVER_WASH = ['#000000', '#020807', '#0a2e28', '#14756a'] as const;

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
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const inputRef = useRef<TextInput>(null);

    const popularResults = useMemo(
        () => POPULAR.filter((name) => name.toLowerCase().includes(query.toLowerCase())),
        [query],
    );

    const hasSearchQuery = query.trim().length > 0;
    const showSuggestionsPanel = query.trim().length >= 2 && !scopePicker && !hideSuggestions;
    const keyboardLayout = keyboardOpen;
    const placeholderLabel = `Discover · ${ROTATING_CITIES[placeholderCityIndex]}`;

    useEffect(() => {
        if (hasSearchQuery) return;
        const id = setInterval(() => {
            setPlaceholderCityIndex((i) => (i + 1) % ROTATING_CITIES.length);
        }, PLACEHOLDER_ROTATE_MS);
        return () => clearInterval(id);
    }, [hasSearchQuery]);

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

    const openFeedSelection = (selection: PlaceFeedSelection) => {
        writePendingLocationFeed({
            filter: selection.filter,
            label: selection.label,
            scope: selection.scope,
            placeId: selection.placeId || null,
            filterType: 'location',
        });
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

    const goHomeFeed = () => {
        void clearPendingLocationFeed();
        navigateMainTab(navigation, 'Home', {
            screen: 'Feed',
            params: {
                resetHomeFeedAt: Date.now(),
                location: null,
                locationLabel: null,
                locationScope: null,
                filterType: null,
                placeId: null,
            },
        });
    };

    const goLocalFeed = () => {
        // Web TopBar: pendingLocation = user.local, navigate /feed?location=local
        // Do not run resolvePlaceFeedSelection — with local+regional+national set it
        // often defaults to national and looks like "just Home".
        const local = (user?.local || 'Finglas').trim();
        if (!local) return;
        void openFeedSelection({
            filter: local,
            label: local,
            scope: 'local',
            fullName: local,
            placeId: null,
        });
    };

    const rawName = user?.name || 'Friend';
    const firstName = rawName.split('@')[0].trim().split(/\s+/)[0];
    const username = (user?.handle || '').replace(/^@/, '').trim() || firstName;
    const promptSuggestions = useMemo(() => {
        const local = (user?.local || '').trim();
        const third =
            local && !/^paris|new york$/i.test(local)
                ? { city: local, label: `Drop into ${local}` }
                : { city: 'Dublin', label: 'Drop into Dublin' };
        return [
            { city: 'Paris', label: "Let's go to the Paris feed" },
            { city: 'New York', label: "What's happening in New York" },
            third,
        ];
    }, [user?.local]);

    const showApiRows = suggestions.length > 0;
    const showPopularFallback = !loading && suggestions.length === 0 && popularResults.length > 0;
    const showEmpty = !loading && suggestions.length === 0 && popularResults.length === 0;

    const avatarName = (user?.handle || user?.name || 'User').split('@')[0];

    const ui = (
        <View
            style={[
                styles.ui,
                keyboardLayout ? styles.uiKeyboard : null,
                { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
            collapsable={false}
        >
            <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
                <TouchableOpacity
                    onPress={() => goHomeFeed()}
                    style={styles.topBarBtn}
                    accessibilityLabel="Back to Feed"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Icon name="home-outline" size={ox(22)} color="#E5E7EB" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={goLocalFeed}
                    style={styles.localChip}
                    accessibilityLabel="View nearby feed"
                >
                    <Text style={styles.localChipText} numberOfLines={1}>
                        Nearby
                    </Text>
                </TouchableOpacity>
            </View>

            {!keyboardLayout ? (
                <View style={styles.hero}>
                    <TouchableOpacity
                        onPress={() => navigatePassport(navigation, 'Home')}
                        accessibilityLabel="Open Passport"
                        style={styles.heroAvatar}
                    >
                        <Avatar
                            src={user?.avatarUrl}
                            name={avatarName}
                            handle={user?.handle}
                            size={ox(72)}
                        />
                    </TouchableOpacity>
                    <Text style={styles.greetingText}>Let's go social traveling,</Text>
                    <Text style={styles.greetingText}>{username}</Text>
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
                                              <Icon name="location-outline" size={ox(16)} color={PASSPORT_PALETTE.wavePrimary} />
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
                                          <Icon name="location-outline" size={ox(16)} color={PASSPORT_PALETTE.wavePrimary} />
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
                                <Icon name="return-down-forward-outline" size={ox(18)} color="rgba(255,255,255,0.72)" />
                                <Text style={styles.promptText}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={styles.searchPill}>
                    <Icon name="add" size={ox(22)} color="#E5E7EB" style={styles.searchIcon} />
                    <TextInput
                        ref={inputRef}
                        value={query}
                        onChangeText={(text) => {
                            setQuery(text);
                            setActiveIndex(-1);
                            setHideSuggestions(false);
                        }}
                        placeholder={hasSearchQuery ? '' : placeholderLabel}
                        placeholderTextColor="rgba(229,231,235,0.55)"
                        style={styles.searchInput}
                        selectionColor={PASSPORT_PALETTE.wavePrimary}
                        onSubmitEditing={chooseFromQuery}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                        underlineColorAndroid="transparent"
                    />
                    {hasSearchQuery ? (
                        <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                            <Icon name="close" size={ox(16)} color="#9CA3AF" />
                        </TouchableOpacity>
                    ) : null}
                    {loading ? <ActivityIndicator size="small" color={PASSPORT_PALETTE.wavePrimary} /> : null}
                    <TouchableOpacity
                        onPress={chooseFromQuery}
                        style={styles.goBtn}
                        accessibilityLabel="Search places"
                    >
                        <Icon name="arrow-forward" size={ox(18)} color="#04110f" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <>
            <LinearGradient
                colors={[...DISCOVER_WASH]}
                locations={[0, 0.38, 0.74, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.root}
            >
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
        justifyContent: 'space-between',
        minHeight: ox(44),
    },
    topBarBtn: {
        padding: ox(8),
        marginLeft: -4,
    },
    localChip: {
        paddingHorizontal: ox(12),
        paddingVertical: ox(6),
        borderRadius: ox(8),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        maxWidth: 140,
    },
    localChipText: {
        color: '#E5E7EB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    hero: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: ox(12),
    },
    heroSpacer: {
        height: ox(8),
    },
    heroAvatar: {
        marginBottom: ox(18),
    },
    greetingText: {
        color: '#F3F4F6',
        fontSize: ox(28),
        lineHeight: ox(36),
        fontWeight: '400',
        textAlign: 'center',
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
        color: 'rgba(243,244,246,0.92)',
        fontSize: ox(16),
        lineHeight: ox(22),
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
        color: '#9CA3AF',
        fontSize: ox(14),
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    resultCopy: { flex: 1, minWidth: 0 },
    resultPrimary: { color: '#F3F4F6', fontSize: ox(14), fontWeight: '500' },
    resultSecondary: { color: '#6B7280', fontSize: ox(11), marginTop: ox(2) },
    searchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: ox(999),
        backgroundColor: '#1c1c1e',
        paddingLeft: ox(14),
        paddingRight: ox(6),
        minHeight: ox(54),
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '400',
        paddingVertical: ox(12),
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
        backgroundColor: PASSPORT_PALETTE.wavePrimary,
    },
});
