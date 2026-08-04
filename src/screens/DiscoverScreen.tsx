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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/Auth';
import { searchLocations, type LocationSuggestion } from '../api/locations';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection, type PlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import PlaceFeedScopePickerModal from '../components/PlaceFeedScopePickerModal.native';
import DiscoverAmbientCanvas from '../components/DiscoverAmbientCanvas.native';
import Avatar from '../components/Avatar.native';
import { PASSPORT_ABYSS } from '../utils/discoverAmbientPalette';
import { navigateMainTab, navigatePassport } from '../navigation/mainTabs';
import { clearPendingLocationFeed } from '../utils/pendingLocationNative';
import { ox } from '../constants/nativeOpticalScale';

const POPULAR = [
    'Dublin', 'Cork', 'London', 'Paris', 'Berlin', 'New York', 'Tokyo', 'Sydney',
];

const ROTATING_CITIES = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo',
    'Dublin', 'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam',
];
const PLACEHOLDER_ROTATE_MS = 2800;

/** Same wash as View Profile / GazetteerScreenShell passport (Android parent gradient). */
const ANDROID_WASH = ['#060d16', '#0f2430', '#1a3f3c', '#12263a', '#060d16'] as const;

/**
 * iOS: animated canvas behind UI.
 * Android: LinearGradient as PARENT of UI (absolute ambient siblings hide all text on Nokia).
 */
export default function DiscoverScreen({ navigation }: any) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [scopePicker, setScopePicker] = useState<LocationSuggestion | null>(null);
    const [placeholderCityIndex, setPlaceholderCityIndex] = useState(0);
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const inputRef = useRef<TextInput>(null);

    const popularResults = useMemo(
        () => POPULAR.filter((name) => name.toLowerCase().includes(query.toLowerCase())),
        [query],
    );

    const hasSearchQuery = query.trim().length > 0;
    const showSuggestionsPanel = query.trim().length >= 2 && !scopePicker;
    const keyboardLayout = keyboardOpen && hasSearchQuery;
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
        const ctrl = new AbortController();
        const id = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(q, 20, 'all', ctrl.signal);
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
    }, [query]);

    const openFeedSelection = async (selection: PlaceFeedSelection) => {
        try {
            await AsyncStorage.setItem('pendingLocation', selection.filter);
            await AsyncStorage.setItem('pendingLocationLabel', selection.label);
            await AsyncStorage.setItem('pendingLocationScope', selection.scope);
            await AsyncStorage.setItem('pendingFilterType', 'location');
            if (selection.placeId) {
                await AsyncStorage.setItem('pendingLocationPlaceId', selection.placeId);
            } else {
                await AsyncStorage.removeItem('pendingLocationPlaceId');
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
        } catch (err) {
            console.error('Error saving location:', err);
        }
    };

    const onSuggestionSelected = (suggestion: LocationSuggestion) => {
        if (getPlaceFeedPickerOptions(suggestion)) {
            setScopePicker(suggestion);
            return;
        }
        void openFeedSelection(resolvePlaceFeedSelection(suggestion));
    };

    const selectPopularCity = (name: string) => {
        void openFeedSelection(
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

    const goHomeFeed = async () => {
        try {
            await clearPendingLocationFeed();
        } catch {
            // ignore
        }
        navigateMainTab(navigation, 'Home', {
            screen: 'Feed',
            params: { resetHomeFeedAt: Date.now() },
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
    const localLabel = user?.local || 'Local';

    const showApiRows = suggestions.length > 0;
    const showPopularFallback = !loading && suggestions.length === 0 && popularResults.length > 0;
    const showEmpty = !loading && suggestions.length === 0 && popularResults.length === 0;

    const ui = (
        <View
            style={[
                styles.ui,
                { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
            collapsable={false}
        >
            {/* Web TopBar discover chrome: Home · Local · Avatar */}
            <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
                <TouchableOpacity
                    onPress={() => void goHomeFeed()}
                    style={styles.topBarBtn}
                    accessibilityLabel="Back to Feed"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Icon name="home-outline" size={ox(22)} color="#E5E7EB" />
                </TouchableOpacity>
                <View style={styles.topBarRight}>
                    <TouchableOpacity
                        onPress={goLocalFeed}
                        style={styles.localChip}
                        accessibilityLabel={`View ${localLabel} feed`}
                    >
                        <Text style={styles.localChipText} numberOfLines={1}>
                            {localLabel}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigatePassport(navigation, 'Home')}
                        accessibilityLabel="Open Passport"
                    >
                        <Avatar
                            src={user?.avatarUrl}
                            name={(user?.handle || user?.name || 'User').split('@')[0]}
                            size="sm"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.greetingBlock, keyboardLayout && styles.greetingBlockCompact]}>
                <Text style={styles.greetingText}>{`Hi ${firstName},`}</Text>
                {!keyboardLayout ? (
                    <Text style={styles.greetingText}>let's go social traveling</Text>
                ) : null}
                <Text style={styles.greetingSub}>Where to for your news?</Text>
            </View>

            <View style={styles.searchDock}>
                {showSuggestionsPanel ? (
                    <View
                        style={[
                            styles.suggestionsPanel,
                            keyboardLayout
                                ? styles.suggestionsPanelKeyboard
                                : styles.suggestionsPanelAbove,
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
                                              style={styles.suggestionItem}
                                          >
                                              <Icon name="location" size={ox(16)} color="#f472b6" />
                                              <View style={styles.suggestionContent}>
                                                  <Text style={styles.suggestionPrimary}>{primary}</Text>
                                                  <Text style={styles.suggestionSecondary}>{s.name}</Text>
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
                                          style={styles.suggestionItem}
                                      >
                                          <Icon name="location" size={ox(16)} color="#f472b6" />
                                          <Text style={styles.suggestionPrimary}>{name}</Text>
                                      </TouchableOpacity>
                                  ))
                                : null}
                        </ScrollView>
                    </View>
                ) : null}

                <View style={styles.searchPill}>
                    <Icon name="search" size={ox(20)} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        ref={inputRef}
                        value={query}
                        onChangeText={(text) => {
                            setQuery(text);
                            setActiveIndex(-1);
                        }}
                        placeholder={hasSearchQuery ? '' : placeholderLabel}
                        placeholderTextColor="#B0B0B0"
                        style={styles.searchInput}
                        selectionColor="#d91b5c"
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
                    {loading ? <ActivityIndicator size="small" color="#d91b5c" /> : null}
                </View>
            </View>
        </View>
    );

    return (
        <>
            {Platform.OS === 'ios' ? (
                <View style={styles.root} collapsable={false}>
                    <View style={styles.ambientBack} pointerEvents="none" collapsable={false}>
                        <DiscoverAmbientCanvas variant="passport" fillParent />
                    </View>
                    {ui}
                </View>
            ) : (
                <LinearGradient
                    colors={[...ANDROID_WASH]}
                    locations={[0, 0.28, 0.55, 0.78, 1]}
                    start={{ x: 0.1, y: 1 }}
                    end={{ x: 0.9, y: 0 }}
                    style={styles.root}
                >
                    {ui}
                </LinearGradient>
            )}

            <PlaceFeedScopePickerModal
                visible={!!scopePicker}
                suggestion={scopePicker}
                onClose={() => setScopePicker(null)}
                onSelectScope={(scope) => {
                    if (!scopePicker) return;
                    void openFeedSelection(resolvePlaceFeedSelection(scopePicker, scope));
                    setScopePicker(null);
                }}
            />
        </>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: PASSPORT_ABYSS,
    },
    ambientBack: {
        ...StyleSheet.absoluteFillObject,
    },
    ui: {
        flex: 1,
        paddingHorizontal: ox(16),
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: ox(44),
        marginBottom: ox(4),
    },
    topBarBtn: {
        padding: ox(8),
        marginLeft: -4,
    },
    topBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
    },
    localChip: {
        paddingHorizontal: ox(12),
        paddingVertical: ox(6),
        borderRadius: ox(8),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.85)',
        backgroundColor: 'rgba(3, 7, 18, 0.55)',
        maxWidth: 140,
    },
    localChipText: {
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    greetingBlock: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    greetingBlockCompact: {
        flex: 0,
        paddingTop: ox(8),
        justifyContent: 'flex-start',
    },
    greetingText: {
        color: '#FFFFFF',
        fontSize: ox(30),
        lineHeight: ox(38),
        fontWeight: '400',
        textAlign: 'center',
        includeFontPadding: false,
    },
    greetingSub: {
        marginTop: ox(12),
        color: '#EEEEEE',
        fontSize: ox(14),
        fontWeight: '400',
        textAlign: 'center',
        includeFontPadding: false,
    },
    searchDock: {
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
    },
    suggestionsPanel: {
        borderRadius: ox(16),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: '#1a1524',
        overflow: 'hidden',
        marginBottom: ox(8),
    },
    suggestionsPanelAbove: { maxHeight: 256 },
    suggestionsPanelKeyboard: { maxHeight: 180 },
    suggestionEmpty: {
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        color: '#9CA3AF',
        fontSize: ox(14),
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    suggestionContent: { flex: 1, minWidth: 0 },
    suggestionPrimary: { color: '#F3F4F6', fontSize: ox(14), fontWeight: '500' },
    suggestionSecondary: { color: '#6B7280', fontSize: ox(11), marginTop: ox(2) },
    searchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: ox(999),
        backgroundColor: '#1c1624',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: ox(14),
        minHeight: ox(52),
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: ox(15),
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
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
});
