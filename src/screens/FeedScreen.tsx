// @ts-nocheck
// @ts-ignore
/* eslint-disable */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
// @refresh reset — FeedScreen is large; full remount on edit avoids hook-order HMR glitches.
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    ScrollView,
    Modal,
    TextInput,
    Alert,
    Linking,
    Pressable,
    Platform,
    useWindowDimensions,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import DiscoverAmbientCanvas from '../components/DiscoverAmbientCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import { useAuth } from '../context/Auth';
import { searchLocations } from '../api/locations';
import {
    fetchPostsPage,
    toggleFollowForPost,
    toggleLike,
    incrementViews,
    reclipPost,
    deletePost,
    setReclipState,
    addComment,
    fetchComments,
    incrementShares,
    toggleCommentLike,
    toggleReplyLike,
    addReply,
    deleteCommentById,
    setCommentModerationState,
    decorateForUser,
} from '../api/posts';
import { getUnreadTotal } from '../api/messages';
import { blockUser } from '../api/messages';
import { isUserBlocked } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import { enqueue, drain } from '../utils/mutationQueue';
import type { Post } from '../types';
import { safePositiveLayoutNumber } from '../utils/safeLayoutNative';
import { FEED_UI } from '../constants/feedUiTokens';
import FeedPostMedia, { type FeedPostMediaHandle } from '../components/FeedPostMedia.native';
import FeedDoubleTapLikeBurst from '../components/FeedDoubleTapLikeBurst.native';
import ImageFullscreenModal, {
    type ImageFullscreenOrigin,
} from '../components/ImageFullscreenModal.native';
import { isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import { postHasVideoMedia, currentFeedSlideIsVideo } from '../utils/postMedia';
import NetInfo from '@react-native-community/netinfo';
import {
    getFeedAutoplayPref,
    resolveFeedAutoplayAllowed,
    subscribeFeedAutoplayPref,
    type FeedAutoplayPref,
} from '../utils/feedAutoplayPrefNative';
import { setActiveFeedVideoPostId } from '../utils/feedActiveVideoNative';
import { setFeedScrollBusy } from '../utils/feedScrollBusyNative';
import { peekFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { subscribeScenesPostUpdates } from '../utils/scenesPostSyncNative';
import {
    getGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';

import FeedPageLayout, {
    FEED_CARD_BODY,
    FEED_CARD_CAPTION_PADDING,
    FEED_CARD_ENGAGEMENT_BAR,
    FEED_CARD_ENGAGEMENT_BAR_DIMMED,
    FEED_CARD_ENGAGEMENT_LEFT,
    FEED_CARD_MEDIA_FRAME,
    FEED_CARD_MEDIA_WRAP,
    FEED_CARD_SPONSORED_FEED_TYPE,
    FEED_CARD_SPONSORED_PILL,
    FEED_CARD_SPONSORED_ROW,
    FEED_CARD_SPONSORED_TEXT,
    FEED_CARD_UPLOAD_OVERLAY,
    FEED_CARD_UPLOAD_SUBTITLE,
    FEED_CARD_UPLOAD_TITLE,
    FEED_HEADER_ACTIVE_DOT,
    FEED_HEADER_CENTER,
    FEED_HEADER_DROPDOWN_MENU,
    FEED_HEADER_DROPDOWN_MENU_ITEM,
    FEED_HEADER_DROPDOWN_MENU_TEXT,
    FEED_HEADER_DROPDOWN_META,
    FEED_HEADER_DROPDOWN_SEARCH_HINT,
    FEED_HEADER_DROPDOWN_SEARCH_INPUT,
    FEED_HEADER_DROPDOWN_SEARCH_WRAP,
    FEED_HEADER_DROPDOWN_SUGGESTION_ITEM,
    FEED_HEADER_DROPDOWN_SUGGESTION_TEXT,
    FEED_HEADER_DROPDOWN_SUGGESTIONS_WRAP,
    FEED_HEADER_ICON_BUTTON,
    FEED_HEADER_LOCATION_PILL,
    FEED_HEADER_LOCATION_TITLE,
    FEED_HEADER_PASSPORT_AVATAR,
    FEED_HEADER_PASSPORT_INITIALS,
    FEED_HEADER_PICKER_ROW,
    FEED_HEADER_RIGHT_ACTIONS,
    FEED_HEADER_SIDE_ACTION,
    FEED_HEADER_SIDE_LABEL,
    FEED_PAGE_BG,
    FEED_POST_CARD_STYLE,
    FEED_EMPTY_BADGE,
    FEED_EMPTY_CARD,
    FEED_EMPTY_CREATE_GRADIENT,
    FEED_EMPTY_FOLLOWING_SUBTITLE,
    FEED_EMPTY_FOLLOWING_TITLE,
    FEED_EMPTY_GRADIENT_BTN,
    FEED_EMPTY_GRADIENT_BTN_TEXT,
    FEED_EMPTY_NOTIFY_GRADIENT,
    FEED_EMPTY_SUBTITLE,
    FEED_EMPTY_TITLE,
} from '../components/FeedPageLayout.native';
import FeedPostProfileQuickMenu, {
    type ProfileQuickMenuAnchor,
} from '../components/FeedPostProfileQuickMenu.native';
import { isDevMockFeedVideoPost } from '../api/posts';
import { glassPanel, glassSurface } from '../theme/gazetteerAmbientNative';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigateMainTab } from '../navigation/mainTabs';
import Stories24HeaderIcon from '../components/Stories24HeaderIcon.native';
import { Dimensions } from 'react-native';
import FeedEngagementRow from '../components/FeedEngagementRow';
import FeedEngagementRightActions from '../components/FeedEngagementRightActions.native';
import FeedPostHeader from '../components/FeedPostHeader.native';
import FeedCaptionText from '../components/FeedCaptionText.native';
import FeedPostTagRow from '../components/FeedPostTagRow.native';
import FeedMediaCarouselThumbs from '../components/FeedMediaCarouselThumbs.native';
import FeedNewsTicker from '../components/FeedNewsTicker.native';
import { imageFullscreenIndexForCarousel } from '../utils/feedImageFullscreen';
import FeedLikesSheet from '../components/FeedLikesSheet.native';
import FeedTaggedMediaBadge from '../components/FeedTaggedMediaBadge.native';
import TaggedUsersBottomSheet from '../components/TaggedUsersBottomSheet.native';
import { getPostDisplayCaption, getReclipDisplay } from '../utils/feedPostMeta';
import FeedShareModal from '../components/FeedShareModal';
import ShareToStoriesModal from '../components/ShareToStoriesModal.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import BoostMetricsPanel from '../components/BoostMetricsPanel.native';
import { subscribeStoriesRefresh } from '../utils/storiesRefreshNative';
import { getActiveBoost } from '../api/boost';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InterestsFeedCard from '../components/InterestsFeedCard.native';
import SuggestedFollowerFeedCard from '../components/SuggestedFollowerFeedCard.native';
import Stories24FeedRail, { type Stories24FeedRailHandle } from '../components/Stories24FeedRail.native';
import { getInboxUnreadPollMs, getStoriesRailPollMs } from '../utils/backgroundPollMs';
import {
    buildStories24RailItems,
    consumeStories24FeedScrollRestore,
    consumeStories24RailReturn,
    persistStories24RailOpenHandle,
    buildStories24StoryNavParams,
    isStories24AddYoursHandle,
    normalizeStories24Handle,
    resolveStories24OpenTarget,
    snapshotStories24FeedScroll,
    takeStories24RailReturnSync,
    STORIES24_RAIL_RETURN_KEY,
    type Stories24RailItem,
    type Stories24RailReturnPayload,
} from '../utils/stories24Rail';
import { INTERESTS_ONBOARDING_DISMISSED_KEY, MAX_INTEREST_SELECTIONS } from '../constants/interestOptions';
import {
    SUGGESTED_FOLLOWER_DISMISSED_KEY,
    SUGGESTED_FOLLOWER_HIDDEN_HANDLES_KEY,
    buildSuggestedFollowerFromPosts,
    type SuggestedFollowerSuggestion,
} from '../utils/suggestedFollowerFeed';
import PostOverflowMenuModal from '../components/PostOverflowMenuModal';
import EditPostModal from '../components/EditPostModal.native';
import SavePostModal from '../components/SavePostModal.native';
import QRCodeModal from '../components/QRCodeModal.native';
import CreateGroupModal from '../components/CreateGroupModal.native';
import PickGroupToInviteFeedUserModal from '../components/PickGroupToInviteFeedUserModal.native';
import { updatePost as apiUpdatePost } from '../api/client';
import PostCommentsSheet from '../components/PostCommentsSheet';
import {
    getCollectionsForPost,
    savePostToDefaultCollection,
    unsavePost,
} from '../api/collections';
import {
    markFeedPostArchivedMobile,
    setPostNotificationsPrefMobile,
    hasPostNotificationsPrefMobile,
} from '../utils/feedEngagementPrefsMobile';
import {
    fetchInitialVisibleFeed,
    fetchVisibleFeedPage,
} from '../utils/nativeFeedLoader';
import {
    filterPostsByContentPrefs,
    hideFeedPostMobile,
    loadFeedContentPrefsMobile,
    markNotInterestedFeedPostMobile,
    muteFeedAuthorMobile,
    blockFeedAuthorMobile,
    type FeedContentPrefs,
} from '../utils/feedContentPrefsMobile';
import {
    dismissPendingFeedUpload,
    subscribePendingFeedUploadComplete,
    subscribePendingFeedUploads,
} from '../utils/pendingFeedUploadNative';
import { feedHeaderLabelFromSuggestion } from '../utils/placeFeedLevels';
import type { LocationSuggestion } from '../api/locations';
import {
    getPlaceFeedPickerOptions,
    resolvePlaceFeedSelection,
    type PlaceFeedSelection,
} from '../utils/pickPlaceFeedScope';
import PlaceFeedScopePickerModal from '../components/PlaceFeedScopePickerModal.native';
import { clearPendingLocationFeed, readPendingLocationFeed } from '../utils/pendingLocationNative';
import type { FeedScope } from '../utils/placeFeedLevels';
import LocationPlaceSummaryModal from '../components/LocationPlaceSummaryModal.native';
import FeedTextOnlyFeedLayout from '../components/FeedTextOnlyFeedLayout.native';
import FeedDmSheet from '../components/FeedDmSheet.native';
import FeedDmDeliveryFx, { type FeedDmDeliveryFxState } from '../components/FeedDmDeliveryFx.native';
import { appendMessage } from '../api/messages';
import {
    loadLocationNotifyPrefs,
    locationNotifyKey,
    saveLocationNotifyPrefs,
} from '../utils/locationNotifyPrefNative';
import { useMutualFollow } from '../hooks/useMutualFollow';
import { hasPendingFollowRequest, isProfilePrivate } from '../api/privacy';
import LocationPlaceSummaryCard from '../components/LocationPlaceSummaryCard.native';
import SuggestedPlacesFeedSection from '../components/SuggestedPlacesFeedSection.native';
import LocalBusinessSuggestionCard from '../components/LocalBusinessSuggestionCard.native';
import FeedAdCard from '../components/FeedAdCard.native';
import FeedPostSkeleton from '../components/FeedPostSkeleton.native';
import { getActiveAds, trackAdImpression, trackAdClick } from '../api/ads';
import type { Ad } from '../types';
import { buildFlatWithSuggested, type FeedStreamRow } from '../utils/feedStreamInjection';
import {
    hideBusinessSuggestion,
    likeBusinessSuggestion,
    loadBusinessLastShown,
    loadBusinessStripEligible,
    loadHiddenBusinesses,
    loadLikedBusinesses,
    markBusinessStripInserted,
    unhideBusinessSuggestion,
} from '../utils/feedBusinessPrefsNative';
import { loadSuggestedPlacesPrefs } from '../utils/suggestedPlacesPrefsNative';
import {
    findPlaceMatchedPosts,
    suggestedPlacesBundleKey,
    type PlaceMatchedPost,
} from '../utils/suggestedPlaces';
import { fetchSuggestedPostsByPlaces, transformLaravelPost } from '../api/posts';
import { isLaravelApiEnabled, markLaravelUnreachable } from '../config/runtimeEnv';
import { getAuthToken } from '../utils/authTokenBridge';
import { ox } from '../constants/nativeOpticalScale';

/** Stronger wash for short sheets — flat #060d16 reads as unchanged black on Android. */
const FEED_SWITCH_PASSPORT_WASH = ['#060d16', '#0f3a42', '#1f6b63', '#164858', '#060d16'] as const;

type Tab = string;

function PillTabs({
    active,
    onChange,
    customLocation = null,
    customLocationLabel = null,
    customLocationPlaceId = null,
    customFilterType = null,
    userLocal = 'Finglas',
    userRegional = 'Dublin',
    userNational = 'Ireland',
    hasNotifications = false,
    onOpenStories24,
    onOpenPassport,
    onOpenDiscover,
    onSearchLocation,
    onHeaderPlacePick,
    onClearCustom,
}: {
    active: Tab;
    onChange: (t: Tab) => void;
    customLocation?: string | null;
    customLocationLabel?: string | null;
    customLocationPlaceId?: string | null;
    customFilterType?: 'location' | 'venue' | 'landmark' | null;
    userLocal?: string;
    userRegional?: string;
    userNational?: string;
    hasNotifications?: boolean;
    onOpenStories24?: () => void;
    onOpenPassport: () => void;
    onOpenDiscover: () => void;
    onSearchLocation?: (
        location: string,
        filterType: 'location' | 'venue' | 'landmark',
        meta?: { label?: string; placeId?: string | null; scope?: string }
    ) => void;
    onHeaderPlacePick?: (
        suggestion: LocationSuggestion,
        filterType: 'location' | 'venue' | 'landmark'
    ) => void;
    onClearCustom?: () => void;
}) {
    const { user } = useAuth();
    const passportInitials = ((user?.name || user?.handle || 'U').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('') || 'U').toUpperCase();
    const onHeaderPlacePickRef = useRef(onHeaderPlacePick);
    const onSearchLocationRef = useRef(onSearchLocation);
    onHeaderPlacePickRef.current = onHeaderPlacePick;
    onSearchLocationRef.current = onSearchLocation;

    type HeaderSuggestion = {
        name: string;
        type: 'location' | 'venue' | 'landmark';
        country?: string;
        filter?: string;
        label?: string;
        placeId?: string | null;
        scope?: string;
        source?: LocationSuggestion;
    };

    const headerSuggestionToLocation = (
        s: HeaderSuggestion,
        fallbackName: string
    ): LocationSuggestion => {
        if (s.source) return s.source;
        const name = s.name || fallbackName;
        const country = s.country || name;
        return {
            name,
            type: s.type === 'venue' ? 'venue' : s.type === 'landmark' ? 'landmark' : 'location',
            country,
            national: country,
            local: name,
            regional: name,
        };
    };

    const commitHeaderPlace = (
        suggestion: LocationSuggestion,
        filterType: 'location' | 'venue' | 'landmark'
    ) => {
        const pickHandler = onHeaderPlacePickRef.current;
        if (typeof pickHandler === 'function') {
            pickHandler(suggestion, filterType);
            return;
        }
        onSearchLocationRef.current?.(suggestion.name, filterType, {
            label: suggestion.name,
            placeId: suggestion.place_id ?? null,
        });
    };
    const [menuOpen, setMenuOpen] = useState(false);
    const [showFeedSwitchCue, setShowFeedSwitchCue] = useState(false);
    const feedSwitchBadgeAnim = useRef(new Animated.Value(0)).current;
    const [showGazetteerTitle, setShowGazetteerTitle] = useState(true);
    const sheetInsets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const sheetWidth = Math.min(windowWidth - 32, 400);
    const sheetMarginH = Math.max(16, Math.floor((windowWidth - sheetWidth) / 2));
    const [locationQuery, setLocationQuery] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<HeaderSuggestion[]>([]);
    const [usingFallbackSuggestions, setUsingFallbackSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [searchHintIndex, setSearchHintIndex] = useState(0);
    const [searchInputFocused, setSearchInputFocused] = useState(false);
    const [placeInfoOpen, setPlaceInfoOpen] = useState(false);
    const searchHints = useMemo(() => ['Search any city', 'Search any country', 'Search any region'], []);

    useEffect(() => {
        if (!customLocation) setPlaceInfoOpen(false);
    }, [customLocation]);
    const fallbackPlaces = useMemo(
        () => [
            'Brazil', 'France', 'Germany', 'Italy', 'Spain', 'Portugal', 'Ireland', 'United Kingdom', 'USA',
            'Canada', 'Australia', 'India', 'Japan', 'South Korea', 'Mexico', 'Netherlands',
            'Paris', 'London', 'Dublin', 'Berlin', 'Madrid', 'Rome', 'Lisbon', 'Amsterdam', 'Tokyo',
            'Sao Paulo', 'Rio de Janeiro', 'New York', 'Los Angeles', 'Toronto', 'Sydney',
        ],
        []
    );
    const fallbackVenues = useMemo(
        () => ['Wembley Stadium', '3Arena', 'Phoenix Park Cafe', 'Madison Square Garden', 'O2 Arena', 'Louvre Cafe', 'Croke Park', 'Aviva Stadium'],
        []
    );
    const fallbackLandmarks = useMemo(
        () => ['Eiffel Tower', 'Colosseum', 'Big Ben', 'Statue of Liberty', 'Christ the Redeemer'],
        []
    );
    const activeLabel = customLocationLabel || customLocation || (active === userLocal ? 'Nearby' : active);
    const headerLabel = showGazetteerTitle ? 'Gazetteer' : activeLabel;
    const activeIndicatorColor =
        customLocation
            ? '#EF4444'
            : active === userLocal
            ? '#34D399'
            : active === userRegional
                ? '#7A8AF0'
                : active === userNational
                    ? '#93C5FD'
                    : active === 'Following'
                        ? '#F472B6'
                        : '#E5E7EB';

    const menuItems = [
        {
            key: 'nearby',
            label: 'Nearby',
            icon: 'navigate-outline',
            iconColor: '#34D399',
            onPress: () => onChange(userLocal),
        },
        {
            key: 'regional',
            label: userRegional,
            icon: 'location-outline',
            iconColor: '#7A8AF0',
            onPress: () => onChange(userRegional),
        },
        {
            key: 'national',
            label: userNational,
            icon: 'earth-outline',
            iconColor: '#93C5FD',
            onPress: () => onChange(userNational),
        },
        {
            key: 'discover',
            label: 'Discover',
            icon: 'compass-outline',
            iconColor: '#FFFFFF',
            onPress: onOpenDiscover,
        },
        {
            key: 'following',
            label: 'Following',
            icon: 'person-add-outline',
            iconColor: '#F472B6',
            onPress: () => onChange('Following'),
        },
    ];

    useEffect(() => {
        const timeout = setTimeout(() => setShowGazetteerTitle(false), 2000);
        return () => clearTimeout(timeout);
    }, []);

    useEffect(() => {
        const appears = setTimeout(() => {
            setShowFeedSwitchCue(true);
            Animated.spring(feedSwitchBadgeAnim, {
                toValue: 1,
                friction: 6,
                tension: 120,
                useNativeDriver: true,
            }).start();
        }, 700);
        const bursts = setTimeout(() => {
            Animated.timing(feedSwitchBadgeAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setShowFeedSwitchCue(false);
            });
        }, 3900);
        return () => {
            clearTimeout(appears);
            clearTimeout(bursts);
        };
    }, [feedSwitchBadgeAnim]);

    useEffect(() => {
        if (!menuOpen) return;
        setLocationQuery(customLocation || '');
        setLocationSuggestions([]);
    }, [menuOpen, customLocation]);

    useEffect(() => {
        if (!menuOpen) return;
        if (searchInputFocused || locationQuery.trim().length > 0) return;
        const timer = setInterval(() => {
            setSearchHintIndex((prev) => (prev + 1) % searchHints.length);
        }, 2000);
        return () => clearInterval(timer);
    }, [menuOpen, searchInputFocused, locationQuery, searchHints.length]);

    useEffect(() => {
        if (!menuOpen) {
            setLocationSuggestions([]);
            setUsingFallbackSuggestions(false);
            setLoadingSuggestions(false);
            return;
        }
        const raw = locationQuery.trim();
        const parsedVenue = raw.match(/^venue\b\s*:?\s*(.*)$/i);
        const parsedLandmark = raw.match(/^landmark\b\s*:?\s*(.*)$/i);
        const venueIntent = /^venue\b/i.test(raw) || /\b(cafe|coffee|bar|pub|restaurant|hotel|stadium|arena|mall|club|gym)\b/i.test(raw);
        const landmarkIntent = /^landmark\b/i.test(raw) || /\b(landmark|tower|bridge|monument|statue|temple|cathedral|museum|palace)\b/i.test(raw);
        const preferredType: 'location' | 'venue' | 'landmark' = venueIntent ? 'venue' : landmarkIntent ? 'landmark' : 'location';
        const q = (parsedVenue?.[1] || parsedLandmark?.[1] || raw).trim();
        if (q.length < 2) {
            if (parsedVenue || parsedLandmark || preferredType === 'venue' || preferredType === 'landmark') {
                const seedSource = preferredType === 'venue' ? fallbackVenues : fallbackLandmarks;
                const seeded = seedSource.slice(0, 6).map((name) => ({
                    name,
                    type: preferredType,
                }));
                setUsingFallbackSuggestions(true);
                setLocationSuggestions(seeded);
                setLoadingSuggestions(false);
                return;
            }
            setLocationSuggestions([]);
            setUsingFallbackSuggestions(false);
            setLoadingSuggestions(false);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                setLoadingSuggestions(true);
                const modeForApi = parsedVenue ? 'venue' : parsedLandmark ? 'landmark' : 'all';
                const res = await searchLocations(q, 6, modeForApi);
                if (!cancelled) {
                    const allApiSuggestions = Array.isArray(res) ? res : [];
                    const mappedApi: HeaderSuggestion[] = allApiSuggestions.flatMap((raw) => {
                        if (!raw || typeof raw !== 'object') return [];
                        const s = raw as LocationSuggestion;
                        const name = String(s.name || s.display_name || '').trim();
                        if (!name) return [];
                        try {
                            const normalized: LocationSuggestion = {
                                ...s,
                                name,
                                country: s.country != null ? String(s.country) : undefined,
                                type: s.type || 'location',
                            };
                            const sel = resolvePlaceFeedSelection(normalized);
                            const t = String(normalized.type || '').toLowerCase();
                            const kind: 'location' | 'venue' | 'landmark' = t.includes('venue')
                                ? 'venue'
                                : t.includes('landmark')
                                    ? 'landmark'
                                    : 'location';
                            return [{
                                name,
                                country: normalized.country,
                                type: kind,
                                filter: sel.filter,
                                label: sel.label,
                                placeId: sel.placeId,
                                scope: sel.scope,
                                source: normalized,
                            }];
                        } catch {
                            return [];
                        }
                    });
                    const fallbackCombined: HeaderSuggestion[] = [
                        ...fallbackPlaces.map((name) => ({ name, type: 'location' as const })),
                        ...fallbackVenues.map((name) => ({ name, type: 'venue' as const })),
                        ...fallbackLandmarks.map((name) => ({ name, type: 'landmark' as const })),
                    ];
                    const filteredFallback = fallbackCombined.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
                    const merged = [...mappedApi, ...filteredFallback];
                    const deduped = merged
                        .filter((item, idx) => merged.findIndex((x) => x.name.toLowerCase() === item.name.toLowerCase()) === idx);
                    const ordered = [...deduped].sort((a, b) => {
                        const aBoost = a.type === preferredType ? 1 : 0;
                        const bBoost = b.type === preferredType ? 1 : 0;
                        return bBoost - aBoost;
                    }).slice(0, 6);
                    if (ordered.length > 0) {
                        setUsingFallbackSuggestions(false);
                        setLocationSuggestions(ordered);
                    } else {
                        const fallback = [...fallbackPlaces, ...fallbackVenues, ...fallbackLandmarks]
                            .filter((name) => name.toLowerCase().includes(q.toLowerCase()))
                            .slice(0, 6)
                            .map((name) => ({
                                name,
                                type: fallbackVenues.includes(name) ? 'venue' as const : fallbackLandmarks.includes(name) ? 'landmark' as const : 'location' as const,
                            }));
                        setUsingFallbackSuggestions(fallback.length > 0);
                        setLocationSuggestions(fallback);
                    }
                }
            } catch {
                if (!cancelled) {
                    const fallback = [...fallbackPlaces, ...fallbackVenues, ...fallbackLandmarks]
                        .filter((name) => name.toLowerCase().includes(q.toLowerCase()))
                        .slice(0, 6)
                        .map((name) => ({
                            name,
                            type: fallbackVenues.includes(name) ? 'venue' as const : fallbackLandmarks.includes(name) ? 'landmark' as const : 'location' as const,
                        }));
                    setUsingFallbackSuggestions(fallback.length > 0);
                    setLocationSuggestions(fallback);
                }
            } finally {
                if (!cancelled) setLoadingSuggestions(false);
            }
        }, 220);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [menuOpen, locationQuery, fallbackPlaces, fallbackVenues, fallbackLandmarks]);

    const submitLocationSearch = () => {
        const raw = locationQuery.trim();
        if (!raw) return;
        let filterType: 'location' | 'venue' | 'landmark' = 'location';
        let next = raw;
        if (/^venue\s*:/i.test(raw)) {
            filterType = 'venue';
            next = raw.replace(/^venue\s*:/i, '').trim();
        } else if (/^landmark\s*:/i.test(raw)) {
            filterType = 'landmark';
            next = raw.replace(/^landmark\s*:/i, '').trim();
        } else if (/\b(cafe|coffee|bar|pub|restaurant|hotel|stadium|arena|mall|club|gym)\b/i.test(raw)) {
            filterType = 'venue';
        } else if (/\b(landmark|tower|bridge|monument|statue|temple|cathedral|museum|palace)\b/i.test(raw)) {
            filterType = 'landmark';
        }
        if (!next) return;
        setMenuOpen(false);
        setTimeout(() => {
            commitHeaderPlace(
                {
                    name: next,
                    type: filterType === 'venue' ? 'venue' : filterType === 'landmark' ? 'landmark' : 'location',
                    country: next,
                    national: next,
                    local: next,
                    regional: next,
                },
                filterType
            );
        }, 80);
    };

    return (
        <View style={styles.tabContainer}>
            <View style={FEED_HEADER_PICKER_ROW}>
                <TouchableOpacity
                    onPress={() => onOpenStories24?.()}
                    style={FEED_HEADER_SIDE_ACTION}
                    accessibilityLabel="Stories 24"
                >
                    <View style={styles.feedHeaderNotifWrap}>
                        <Stories24HeaderIcon size={FEED_UI.icon.headerStories} />
                        <Text style={FEED_HEADER_SIDE_LABEL}>Stories</Text>
                    </View>
                </TouchableOpacity>

                <View style={FEED_HEADER_CENTER}>
                    <TouchableOpacity
                        onPress={() => setMenuOpen((prev) => !prev)}
                        style={FEED_HEADER_LOCATION_PILL}
                        activeOpacity={0.85}
                        accessibilityLabel="Change feed"
                    >
                        {showFeedSwitchCue && !menuOpen ? (
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    styles.feedSwitchBadge,
                                    {
                                        opacity: feedSwitchBadgeAnim,
                                        transform: [
                                            {
                                                translateY: feedSwitchBadgeAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [-8, 0],
                                                }),
                                            },
                                            {
                                                scale: feedSwitchBadgeAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0.86, 1],
                                                }),
                                            },
                                        ],
                                    },
                                ]}
                            >
                                <View style={styles.feedSwitchBadgeCaret} />
                                <View style={styles.feedSwitchBadgeInner}>
                                    <Icon name="location" size={ox(14)} color="#FFFFFF" />
                                    <Text style={styles.feedSwitchBadgeText}>Switch feed</Text>
                                </View>
                            </Animated.View>
                        ) : null}
                        <Icon
                            name={customFilterType === 'venue' ? 'home-outline' : customFilterType === 'landmark' ? 'business-outline' : 'location'}
                            size={FEED_UI.icon.headerLocation}
                            color="#FFFFFF"
                        />
                        <View style={[FEED_HEADER_ACTIVE_DOT, { backgroundColor: activeIndicatorColor }]} />
                        <Text
                            style={FEED_HEADER_LOCATION_TITLE}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {headerLabel}
                        </Text>
                        <Icon name={menuOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={Math.round(FEED_UI.icon.headerLocation * 0.9)} color="rgba(255,255,255,0.9)" />
                    </TouchableOpacity>

                    <Modal
                        visible={menuOpen}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setMenuOpen(false)}
                        statusBarTranslucent
                    >
                        <View style={styles.feedSwitchSheetOverlay}>
                            <Pressable style={styles.feedSwitchSheetBackdrop} onPress={() => setMenuOpen(false)} />
                            <View
                                style={[
                                    styles.feedSwitchSheet,
                                    {
                                        width: sheetWidth,
                                        marginHorizontal: sheetMarginH,
                                        paddingBottom: Math.max(sheetInsets.bottom, 16),
                                    },
                                ]}
                            >
                                {(() => {
                                    const sheetBody = (
                                        <>
                                            <View style={styles.feedSwitchSheetHandle} />
                                            <View style={styles.feedSwitchSheetHeader}>
                                                <View style={styles.feedSwitchSheetHeaderSpacer} />
                                                <TouchableOpacity
                                                    onPress={() => setMenuOpen(false)}
                                                    style={styles.feedSwitchSheetClose}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    accessibilityLabel="Close"
                                                >
                                                    <Icon name="close" size={ox(24)} color="#FFFFFF" />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.feedSwitchSheetGazetteer}>Gazetteer says</Text>
                                            <Text style={styles.feedSwitchSheetTitle}>Switch feed</Text>
                                            <Text style={styles.feedSwitchSheetSub}>
                                                Nearby, city, country, Discover, or Following
                                            </Text>
                                            <View style={styles.feedSwitchSearchWrap}>
                                                <Icon name="search-outline" size={ox(18)} color="rgba(255,255,255,0.75)" />
                                                <TextInput
                                                    value={locationQuery}
                                                    onChangeText={setLocationQuery}
                                                    placeholder={searchHints[searchHintIndex]}
                                                    placeholderTextColor="rgba(255,255,255,0.45)"
                                                    underlineColorAndroid="transparent"
                                                    onFocus={() => setSearchInputFocused(true)}
                                                    onBlur={() => setSearchInputFocused(false)}
                                                    onSubmitEditing={submitLocationSearch}
                                                    returnKeyType="search"
                                                    autoCapitalize="words"
                                                    style={styles.feedSwitchSearchInput}
                                                />
                                            </View>
                                            <Text style={styles.feedSwitchSearchHint}>
                                                Tip: use venue: or landmark:
                                            </Text>
                                            <ScrollView
                                                style={styles.feedSwitchSheetScroll}
                                                contentContainerStyle={styles.feedSwitchSheetScrollContent}
                                                keyboardShouldPersistTaps="handled"
                                                showsVerticalScrollIndicator={false}
                                            >
                                                {locationQuery.trim().length >= 2 ? (
                                                    <View style={styles.feedSwitchSuggestionsWrap}>
                                                        {loadingSuggestions ? (
                                                            <Text style={FEED_HEADER_DROPDOWN_META}>Searching places...</Text>
                                                        ) : locationSuggestions.length > 0 ? (
                                                            locationSuggestions.map((s, idx) => {
                                                                const suggestionName = String(s.name || '').trim();
                                                                if (!suggestionName) return null;
                                                                const countryLabel = s.country != null ? String(s.country) : '';
                                                                const metaLabel =
                                                                    s.type === 'venue'
                                                                        ? ' · venue'
                                                                        : s.type === 'landmark'
                                                                            ? ' · landmark'
                                                                            : usingFallbackSuggestions
                                                                                ? ' · quick suggestion'
                                                                                : countryLabel
                                                                                    ? ` · ${countryLabel}`
                                                                                    : '';
                                                                return (
                                                                <TouchableOpacity
                                                                    key={`${suggestionName}-${idx}`}
                                                                    style={FEED_HEADER_DROPDOWN_SUGGESTION_ITEM}
                                                                    onPress={() => {
                                                                        const raw = locationQuery.trim();
                                                                        const mode: 'location' | 'venue' | 'landmark' = s.type || (/^venue\s*:/i.test(raw)
                                                                            ? 'venue'
                                                                            : /^landmark\s*:/i.test(raw)
                                                                                ? 'landmark'
                                                                                : /\b(cafe|coffee|bar|pub|restaurant|hotel|stadium|arena|mall|club|gym)\b/i.test(raw)
                                                                                    ? 'venue'
                                                                                    : /\b(landmark|tower|bridge|monument|statue|temple|cathedral|museum|palace)\b/i.test(raw)
                                                                                        ? 'landmark'
                                                                                        : 'location');
                                                                        setLocationQuery(suggestionName);
                                                                        setMenuOpen(false);
                                                                        // Defer so the feed-switch Modal unmounts before scope picker opens (Android nested Modal crash).
                                                                        setTimeout(() => {
                                                                            commitHeaderPlace(
                                                                                headerSuggestionToLocation(s, suggestionName),
                                                                                mode
                                                                            );
                                                                        }, 80);
                                                                    }}
                                                                >
                                                                    <Text style={FEED_HEADER_DROPDOWN_SUGGESTION_TEXT}>
                                                                        {suggestionName}
                                                                        {metaLabel}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                                );
                                                            })
                                                        ) : (
                                                            <Text style={FEED_HEADER_DROPDOWN_META}>No matches yet</Text>
                                                        )}
                                                    </View>
                                                ) : null}
                                                {customLocation ? (
                                                    <TouchableOpacity
                                                        style={styles.feedSwitchMenuItem}
                                                        onPress={() => {
                                                            onClearCustom?.();
                                                            setMenuOpen(false);
                                                        }}
                                                    >
                                                        <Icon name="home-outline" size={ox(22)} color="rgba(255,255,255,0.8)" />
                                                        <Text style={FEED_HEADER_DROPDOWN_MENU_TEXT}>Back to home feed</Text>
                                                    </TouchableOpacity>
                                                ) : null}
                                                {menuItems.map((item) => (
                                                    <TouchableOpacity
                                                        key={item.key}
                                                        style={styles.feedSwitchMenuItem}
                                                        onPress={() => {
                                                            item.onPress();
                                                            setMenuOpen(false);
                                                        }}
                                                    >
                                                        <Icon name={item.icon} size={ox(22)} color={item.iconColor} />
                                                        <Text style={FEED_HEADER_DROPDOWN_MENU_TEXT}>{item.label}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </>
                                    );
                                    if (Platform.OS === 'ios') {
                                        return (
                                            <View style={styles.feedSwitchSheetCanvas} collapsable={false}>
                                                <View style={styles.feedSwitchSheetAmbient} pointerEvents="none" collapsable={false}>
                                                    <DiscoverAmbientCanvas variant="passport" fillParent />
                                                </View>
                                                <View style={styles.feedSwitchSheetContent} collapsable={false}>
                                                    {sheetBody}
                                                </View>
                                            </View>
                                        );
                                    }
                                    return (
                                        <LinearGradient
                                            colors={[...FEED_SWITCH_PASSPORT_WASH]}
                                            locations={[0, 0.28, 0.55, 0.78, 1]}
                                            start={{ x: 0.1, y: 1 }}
                                            end={{ x: 0.9, y: 0 }}
                                            style={styles.feedSwitchSheetCanvas}
                                        >
                                            <View style={styles.feedSwitchSheetContent} collapsable={false}>
                                                {sheetBody}
                                            </View>
                                        </LinearGradient>
                                    );
                                })()}
                            </View>
                        </View>
                    </Modal>
                </View>

                <View style={FEED_HEADER_RIGHT_ACTIONS}>
                    {customLocation ? (
                        <View style={styles.feedHeaderIconGroup}>
                            <TouchableOpacity
                                onPress={() => setPlaceInfoOpen(true)}
                                style={FEED_HEADER_ICON_BUTTON}
                                accessibilityLabel={`About ${activeLabel}`}
                            >
                                <Icon name="information-circle-outline" size={ox(24)} color="#FFFFFF" />
                            </TouchableOpacity>
                            <LocationPlaceSummaryModal
                                open={placeInfoOpen}
                                onClose={() => setPlaceInfoOpen(false)}
                                locationLabel={customLocationLabel || customLocation}
                                placeId={customLocationPlaceId}
                            />
                        </View>
                    ) : null}
                    <TouchableOpacity
                        onPress={onOpenPassport}
                        style={FEED_HEADER_SIDE_ACTION}
                        accessibilityLabel="My Passport"
                    >
                        <View style={styles.feedHeaderNotifWrap}>
                            <View style={FEED_HEADER_PASSPORT_AVATAR}>
                                {user?.avatarUrl ? (
                                    <Image
                                        source={{ uri: user.avatarUrl }}
                                        style={styles.feedHeaderPassportAvatarImage}
                                    />
                                ) : (
                                    <Text style={FEED_HEADER_PASSPORT_INITIALS}>{passportInitials}</Text>
                                )}
                            </View>
                            <Text style={FEED_HEADER_SIDE_LABEL}>Passport</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// Memoized FeedCard for better performance - prevents unnecessary re-renders
const FeedCard = React.memo(function FeedCard({
    post,
    onLike,
    onFollow,
    onView,
    onComment,
    onShare,
    onReclip,
    onBookmark,
    onPostPress,
    onVisitProfile,
    onVisitHandle,
    onViewStories,
    onBlockUser,
    onReportUser,
    isCurrentUser,
    onOverflowPress,
    isVideoActive,
    feedVideoMuted,
    suspendNativeVideo,
    viewerHandle,
    viewerUserId,
    onOpenDM,
    onRegisterDmAnchor,
    onOpenImageFullscreen,
    onOpenScenes,
    onShareSuccess,
    onOpenLikesSheet,
    onOpenTaggedSheet,
}: {
    post: Post;
    onLike: () => Promise<void>;
    onFollow?: () => Promise<void>;
    onView: () => Promise<void>;
    onComment: () => void;
    onShare: () => Promise<void>;
    onReclip: () => Promise<void>;
    onBookmark: () => Promise<void>;
    onPostPress?: () => void;
    onOpenImageFullscreen?: (startIndex?: number, origin?: ImageFullscreenOrigin | null) => void;
    onOpenScenes?: () => void;
    onVisitProfile?: () => void;
    onVisitHandle?: (handle: string) => void;
    onViewStories?: () => void;
    onBlockUser?: () => Promise<void>;
    onReportUser?: () => Promise<void>;
    isCurrentUser: boolean;
    onOverflowPress?: () => void;
    isVideoActive?: boolean;
    feedVideoMuted?: boolean;
    suspendNativeVideo?: boolean;
    viewerHandle?: string | null;
    viewerUserId?: string;
    onOpenDM?: (handle: string, postId: string) => void;
    onRegisterDmAnchor?: (key: string, ref: View | null) => void;
    onShareSuccess?: (postId: string) => void;
    onOpenLikesSheet?: () => void;
    onOpenTaggedSheet?: () => void;
}) {
    const [profileMenuVisible, setProfileMenuVisible] = React.useState(false);
    const [profileMenuAnchor, setProfileMenuAnchor] = React.useState<ProfileQuickMenuAnchor | null>(null);
    const profileMenuAnchorRef = React.useRef<View>(null);
    const openProfileMenu = React.useCallback(() => {
        profileMenuAnchorRef.current?.measureInWindow((x, y, width, height) => {
            setProfileMenuAnchor({ x, y, width, height });
            setProfileMenuVisible(true);
        });
    }, []);
    const closeProfileMenu = React.useCallback(() => {
        setProfileMenuVisible(false);
        setProfileMenuAnchor(null);
    }, []);
    const [headerHasStory, setHeaderHasStory] = React.useState(false);
    const [carouselIndex, setCarouselIndex] = React.useState(0);
    const likeButtonRef = React.useRef<View>(null);
    const [shareToStoriesVisible, setShareToStoriesVisible] = React.useState(false);
    const [isMetricsOpen, setIsMetricsOpen] = React.useState(false);
    const [boostMetricsActive, setBoostMetricsActive] = React.useState(Boolean(post.isBoosted));
    const isMutualFollow = useMutualFollow(post, isCurrentUser);
    const videoMediaRef = React.useRef<FeedPostMediaHandle>(null);
    const mediaWrapRef = React.useRef<View>(null);
    const postViewRecordedRef = React.useRef(false);
    const mediaBurstClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [mediaBurst, setMediaBurst] = React.useState<{ x: number; y: number; key: number } | null>(
        null,
    );
    /** Window-space burst — Android TextureView/Image punch through in-tree overlays. */
    const showMediaLikeBurst = React.useCallback((localX: number, localY: number) => {
        const place = (windowX: number, windowY: number) => {
            setMediaBurst({ x: windowX, y: windowY, key: Date.now() });
            if (mediaBurstClearRef.current) clearTimeout(mediaBurstClearRef.current);
            mediaBurstClearRef.current = setTimeout(() => {
                setMediaBurst(null);
                mediaBurstClearRef.current = null;
            }, 750);
        };
        const node = mediaWrapRef.current;
        if (node?.measureInWindow) {
            node.measureInWindow((wx, wy, w, h) => {
                const x = (w > 8 ? wx : 0) + localX;
                const y = (h > 8 ? wy : 0) + localY;
                place(x, y);
            });
            return;
        }
        place(localX, localY);
    }, []);
    React.useEffect(
        () => () => {
            if (mediaBurstClearRef.current) clearTimeout(mediaBurstClearRef.current);
        },
        [],
    );
    const { width: windowWidth } = useWindowDimensions();
    const cardMediaWidth = safePositiveLayoutNumber(windowWidth, 360);
    // Fixed 4:5 (height/width) feed frame — measuring poster/image aspect on enter
    // reflows the card and reads as a shake when scrolling post-to-post.
    const MEDIA_MAX_ASPECT = FEED_UI.media.maxAspect;
    const mediaFrameHeight = cardMediaWidth * MEDIA_MAX_ASPECT;
    const imageStyle = React.useMemo(
        () => ({
            width: cardMediaWidth,
            height: mediaFrameHeight,
            ...FEED_CARD_MEDIA_FRAME,
        }),
        [MEDIA_MAX_ASPECT, cardMediaWidth, mediaFrameHeight],
    );

    // Auto-detect image dimensions if not provided
    const isClientUploading = post.clientUploadStatus === 'uploading';
    const isClientUploadFailed = post.clientUploadStatus === 'failed';
    const textOnlyPost = isTextOnlyPost(post);
    const hasFeedMedia = !textOnlyPost && Boolean(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0));
    const hasTaggedUsers = Boolean(post.taggedUsers && post.taggedUsers.length > 0);
    const showVideoMuteOnMedia = hasFeedMedia && postHasVideoMedia(post);
    const carouselThumbItems = React.useMemo(
        () =>
            (post.mediaItems || []).filter(
                (item) => item?.type === 'image' || item?.type === 'video',
            ),
        [post.mediaItems],
    );
    const displayCaption = React.useMemo(() => getPostDisplayCaption(post), [post]);
    const { profileHandle } = getReclipDisplay(post, viewerHandle);
    const isRequested = Boolean(
        !isCurrentUser &&
            !post.isFollowing &&
            viewerHandle &&
            isProfilePrivate(profileHandle) &&
            hasPendingFollowRequest(viewerHandle, profileHandle),
    );
    const postTags = Array.isArray(post.tags) ? post.tags : [];
    const showBoostMetrics =
        isCurrentUser && !post.originalUserHandle && (post.isBoosted || boostMetricsActive);

    React.useEffect(() => {
        setCarouselIndex(0);
        postViewRecordedRef.current = false;
    }, [post.id]);

    React.useEffect(() => {
        if (!isCurrentUser || post.originalUserHandle) {
            setBoostMetricsActive(false);
            return;
        }
        let cancelled = false;
        void getActiveBoost(post.id).then((boost) => {
            if (!cancelled) setBoostMetricsActive(Boolean(boost?.isActive));
        });
        return () => {
            cancelled = true;
        };
    }, [post.id, isCurrentUser, post.originalUserHandle, post.isBoosted]);

    const handleOpenScenesPress = React.useCallback(() => {
        onOpenScenes?.();
    }, [onOpenScenes]);

    const mediaGesturesEnabled = !isClientUploading && !isClientUploadFailed;

    const handleMediaDoubleLike = React.useCallback(
        (x?: number, y?: number) => {
            const localX = Number.isFinite(x) ? (x as number) : cardMediaWidth / 2;
            const localY = Number.isFinite(y) ? (y as number) : mediaFrameHeight / 2;
            // Window-level Modal burst — visible above Android TextureView / tap overlay.
            showMediaLikeBurst(localX, localY);
            void onLike();
        },
        [cardMediaWidth, mediaFrameHeight, onLike, showMediaLikeBurst],
    );

    const openStillFullscreen = React.useCallback(() => {
        const startIndex = imageFullscreenIndexForCarousel(post, carouselIndex);
        const open = (origin?: ImageFullscreenOrigin | null) => {
            onOpenImageFullscreen?.(startIndex, origin ?? null);
        };
        const node = mediaWrapRef.current;
        if (!node?.measureInWindow) {
            open(null);
            return;
        }
        node.measureInWindow((x, y, width, height) => {
            if (width > 8 && height > 8) {
                open({ x, y, width, height });
            } else {
                open(null);
            }
        });
    }, [carouselIndex, onOpenImageFullscreen, post]);

    const handleMediaSingleTap = React.useCallback(() => {
        // Mute flash only on the active video slide — stills open fullscreen (web Media parity).
        if (currentFeedSlideIsVideo(post, carouselIndex)) {
            videoMediaRef.current?.flashMuteControl();
            return;
        }
        openStillFullscreen();
    }, [carouselIndex, openStillFullscreen, post]);

    return (
        <View style={FEED_POST_CARD_STYLE}>
            <FeedPostTagRow tags={postTags} />

            {post.isBoosted && (
                <View style={FEED_CARD_SPONSORED_ROW}>
                    <View style={FEED_CARD_SPONSORED_PILL}>
                        <Text style={FEED_CARD_SPONSORED_TEXT}>Sponsored</Text>
                    </View>
                    {post.boostFeedType ? (
                        <Text style={FEED_CARD_SPONSORED_FEED_TYPE}>· {post.boostFeedType} boost</Text>
                    ) : null}
                </View>
            )}

            {textOnlyPost ? (
                <FeedTextOnlyFeedLayout
                    post={post}
                    viewerHandle={viewerHandle}
                    cardWidth={cardMediaWidth}
                    isCurrentUser={isCurrentUser}
                    onFollow={onFollow}
                    onOpenDM={onOpenDM}
                    onProfileMenuPress={openProfileMenu}
                    onOverflowPress={onOverflowPress}
                    onDoubleLike={() => {
                        void onLike();
                    }}
                    onRegisterDmAnchor={onRegisterDmAnchor}
                    onShowTaggedUsers={() => onOpenTaggedSheet?.()}
                    menuAnchorRef={profileMenuAnchorRef}
                />
            ) : (
                <View style={FEED_CARD_BODY}>
                    {hasFeedMedia ? (
                        <View style={FEED_CARD_MEDIA_WRAP} ref={mediaWrapRef} collapsable={false}>
                            <FeedPostMedia
                                ref={videoMediaRef}
                                post={post}
                                carouselIndex={carouselIndex}
                                onCarouselIndexChange={setCarouselIndex}
                                stickers={post.stickers}
                                width={cardMediaWidth}
                                height={mediaFrameHeight}
                                onDoubleLike={mediaGesturesEnabled ? handleMediaDoubleLike : undefined}
                                onSingleTap={mediaGesturesEnabled ? handleMediaSingleTap : undefined}
                                onMediaLoad={
                                    isClientUploading
                                        ? undefined
                                        : () => {
                                              if (postViewRecordedRef.current) return;
                                              postViewRecordedRef.current = true;
                                              void onView();
                                          }
                                }
                                mode="feed"
                                isActive={isVideoActive && !isClientUploading}
                                suspendNativeVideo={suspendNativeVideo}
                                muted={feedVideoMuted}
                                onOpenScenes={
                                    mediaGesturesEnabled ? handleOpenScenesPress : undefined
                                }
                            />
                            <FeedPostHeader
                                post={post}
                                viewerHandle={viewerHandle}
                                isCurrentUser={isCurrentUser}
                                isOverlaid
                                onFollow={onFollow}
                                onOpenDM={onOpenDM}
                                onProfileMenuPress={openProfileMenu}
                                onHasStoryChange={setHeaderHasStory}
                                onOverflowPress={onOverflowPress}
                                onRegisterDmAnchor={onRegisterDmAnchor}
                                menuAnchorRef={profileMenuAnchorRef}
                            />
                            {isClientUploading ? (
                                <View style={FEED_CARD_UPLOAD_OVERLAY} pointerEvents="none">
                                    <ActivityIndicator size="large" color="#FFFFFF" />
                                    <Text style={FEED_CARD_UPLOAD_TITLE}>Posting…</Text>
                                    <Text style={FEED_CARD_UPLOAD_SUBTITLE}>Preparing your post</Text>
                                </View>
                            ) : null}
                            {isClientUploadFailed ? (
                                <View style={FEED_CARD_UPLOAD_OVERLAY}>
                                    <Icon name="alert-circle-outline" size={ox(28)} color="#FCA5A5" />
                                    <Text style={FEED_CARD_UPLOAD_TITLE}>Post failed</Text>
                                    <Text style={FEED_CARD_UPLOAD_SUBTITLE} numberOfLines={2}>
                                        {post.clientUploadError || 'Could not post. Tap to dismiss.'}
                                    </Text>
                                </View>
                            ) : null}
                            {hasTaggedUsers ? (
                                <FeedTaggedMediaBadge
                                    count={post.taggedUsers!.length}
                                    aboveMuteControl={showVideoMuteOnMedia}
                                    onPress={() => onOpenTaggedSheet?.()}
                                />
                            ) : null}
                        </View>
                    ) : (
                        <FeedPostHeader
                            post={post}
                            viewerHandle={viewerHandle}
                            isCurrentUser={isCurrentUser}
                            onFollow={onFollow}
                            onOpenDM={onOpenDM}
                            onProfileMenuPress={openProfileMenu}
                            onHasStoryChange={setHeaderHasStory}
                            onOverflowPress={onOverflowPress}
                            onRegisterDmAnchor={onRegisterDmAnchor}
                            menuAnchorRef={profileMenuAnchorRef}
                        />
                    )}

                    {carouselThumbItems.length > 1 ? (
                        <FeedMediaCarouselThumbs
                            items={carouselThumbItems}
                            activeIndex={carouselIndex}
                            onSelect={setCarouselIndex}
                        />
                    ) : null}

                </View>
            )}

            {!textOnlyPost && displayCaption.length > 0 && hasFeedMedia ? (
                <Pressable
                    style={FEED_CARD_CAPTION_PADDING}
                    onPress={onPostPress}
                    disabled={!onPostPress}
                    accessibilityRole="button"
                    accessibilityLabel="Open post"
                >
                    <FeedCaptionText
                        caption={displayCaption}
                        onHandlePress={(handle) => {
                            if (onVisitHandle) onVisitHandle(handle);
                            else onVisitProfile?.();
                        }}
                    />
                </Pressable>
            ) : null}

            <View
                style={[
                    FEED_CARD_ENGAGEMENT_BAR,
                    (isClientUploading || isClientUploadFailed) && FEED_CARD_ENGAGEMENT_BAR_DIMMED,
                ]}
            >
                <View style={FEED_CARD_ENGAGEMENT_LEFT}>
                    <FeedEngagementRow
                        likeButtonRef={likeButtonRef}
                        likes={post.stats.likes}
                        comments={post.stats.comments}
                        shares={post.stats.shares}
                        reclips={post.stats.reclips}
                        views={post.stats.views}
                        userLiked={post.userLiked}
                        userReclipped={post.userReclipped}
                        isSaved={post.isBookmarked}
                        onLike={() => { void onLike(); }}
                        onLikesPress={() => {
                            if (post.stats.likes > 0) onOpenLikesSheet?.();
                        }}
                        onComment={onComment}
                        onShareToStories={() => setShareToStoriesVisible(true)}
                        onReclip={!isCurrentUser ? () => { void onReclip(); } : undefined}
                        reclipDisabled={isCurrentUser}
                        onSave={() => { void onBookmark(); }}
                        showReclip
                        tone="feed"
                    />
                </View>

                <FeedEngagementRightActions
                    showMetrics={showBoostMetrics}
                    metricsOpen={isMetricsOpen}
                    onToggleMetrics={() => setIsMetricsOpen((v) => !v)}
                    shares={post.stats.shares}
                    onShare={() => { void onShare(); }}
                />
            </View>

            {showBoostMetrics ? (
                <BoostMetricsPanel post={post} isOpen={isMetricsOpen} />
            ) : null}

            <ShareToStoriesModal
                visible={shareToStoriesVisible}
                post={post}
                onClose={() => setShareToStoriesVisible(false)}
                onShareSuccess={() => {
                    onShareSuccess?.(post.id);
                }}
            />

            {post.bannerText ? <FeedNewsTicker text={post.bannerText} /> : null}

            {/* Profile quick actions menu (Visit profile / Follow-Unfollow / View stories) */}
            <FeedPostProfileQuickMenu
                visible={profileMenuVisible}
                anchor={profileMenuAnchor}
                profileHandle={profileHandle}
                isCurrentUser={isCurrentUser}
                isMutualFollow={isMutualFollow}
                hasStory={headerHasStory}
                isFollowing={post.isFollowing === true}
                isRequested={isRequested}
                onClose={closeProfileMenu}
                onVisitProfile={() => {
                    if (onVisitHandle) onVisitHandle(profileHandle);
                    else onVisitProfile?.();
                }}
                onFollow={onFollow}
                onViewStories={onViewStories ? () => onViewStories() : undefined}
                onMessage={
                    onOpenDM ? () => onOpenDM(post.userHandle, post.id) : undefined
                }
                onBlock={onBlockUser}
                onReport={onReportUser}
            />
            {/* Modal sits above Android TextureView/Image punch-through layers. */}
            <Modal
                visible={mediaBurst != null}
                transparent
                animationType="none"
                statusBarTranslucent
                hardwareAccelerated
                onRequestClose={() => setMediaBurst(null)}
            >
                <View style={styles.mediaBurstPortal} pointerEvents="none">
                    {mediaBurst ? (
                        <FeedDoubleTapLikeBurst
                            key={mediaBurst.key}
                            x={mediaBurst.x}
                            y={mediaBurst.y}
                        />
                    ) : null}
                </View>
            </Modal>
        </View>
    );
}, (prev, next) => {
    const a = prev.post;
    const b = next.post;
    return (
        a.id === b.id &&
        a.userLiked === b.userLiked &&
        a.isBookmarked === b.isBookmarked &&
        a.isFollowing === b.isFollowing &&
        (a as { isFollowRequested?: boolean }).isFollowRequested ===
            (b as { isFollowRequested?: boolean }).isFollowRequested &&
        a.stats.likes === b.stats.likes &&
        a.stats.comments === b.stats.comments &&
        a.stats.views === b.stats.views &&
        a.stats.reclips === b.stats.reclips &&
        a.stats.shares === b.stats.shares &&
        a.mediaUrl === b.mediaUrl &&
        a.mediaType === b.mediaType &&
        a.videoPosterUrl === b.videoPosterUrl &&
        a.templateId === b.templateId &&
        a.text === b.text &&
        JSON.stringify(a.textStyle) === JSON.stringify(b.textStyle) &&
        a.isBoosted === b.isBoosted &&
        a.originalUserHandle === b.originalUserHandle &&
        prev.isCurrentUser === next.isCurrentUser &&
        prev.isVideoActive === next.isVideoActive &&
        prev.feedVideoMuted === next.feedVideoMuted &&
        prev.suspendNativeVideo === next.suspendNativeVideo &&
        prev.viewerHandle === next.viewerHandle &&
        a.clientUploadStatus === b.clientUploadStatus &&
        a.clientUploadError === b.clientUploadError &&
        a.clientLocalMediaUri === b.clientLocalMediaUri &&
        JSON.stringify(a.mediaItems) === JSON.stringify(b.mediaItems) &&
        JSON.stringify(a.taggedUsers) === JSON.stringify(b.taggedUsers) &&
        JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
        a.bannerText === b.bannerText &&
        JSON.stringify(a.stickers) === JSON.stringify(b.stickers)
    );
});

export { FeedCard };

type FeedListRow =
    | { kind: 'post'; post: Post }
    | { kind: 'ad'; ad: Ad }
    | { kind: 'local_business'; posts: Post[]; pinnedPaidPostId?: string; useMockPreview?: boolean }
    | { kind: 'suggested_places'; bundleKey: string; suggestions: PlaceMatchedPost[] }
    | { kind: 'stories24'; id: string }
    | { kind: 'interests'; id: string }
    | { kind: 'suggested_follower'; suggestion: SuggestedFollowerSuggestion };

function FeedScreen({ navigation, route }: { navigation?: any; route?: any }) {
    const { user, login } = useAuth();
    const userId = user?.id ?? 'anon';
    const isFeedFocused = useIsFocused();
    const defaultLocal = user?.local || 'Finglas';
    const defaultNational = user?.national || 'Ireland';
    const defaultRegional = user?.regional || 'Dublin';

    const [active, setActive] = useState<Tab>(defaultNational);
    const [pages, setPages] = useState<Post[][]>([]);
    const feedContentPrefsRef = useRef<FeedContentPrefs>({
        mutedHandles: new Set(),
        blockedHandles: new Set(),
        hiddenPostIds: new Set(),
        notInterestedPostIds: new Set(),
    });
    const [cursor, setCursor] = useState<string | number | null>(0);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [end, setEnd] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showFollowingFeed, setShowFollowingFeed] = useState(false);
    const [customLocation, setCustomLocation] = useState<string | null>(null);
    const [customLocationLabel, setCustomLocationLabel] = useState<string | null>(null);
    const [customLocationPlaceId, setCustomLocationPlaceId] = useState<string | null>(null);
    const [customFilterType, setCustomFilterType] = useState<'location' | 'venue' | 'landmark' | null>(null);
    const [commentsModalOpen, setCommentsModalOpen] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
    const [imageFullscreenPost, setImageFullscreenPost] = useState<Post | null>(null);
    const [imageFullscreenStartIndex, setImageFullscreenStartIndex] = useState(0);
    const [imageFullscreenOrigin, setImageFullscreenOrigin] = useState<ImageFullscreenOrigin | null>(
        null,
    );
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
    const [reclipConfirmPost, setReclipConfirmPost] = useState<Post | null>(null);
    const [feedGazetteerAlert, setFeedGazetteerAlert] = useState<{
        title: string;
        message: string;
        icon?: 'alert' | 'success' | 'info';
    } | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasInbox, setHasInbox] = useState(false);
    const insets = useSafeAreaInsets();
    const [reloadTick, setReloadTick] = useState(0);
    const [showBoostPrompt, setShowBoostPrompt] = useState(false);
    const [likesSheetPost, setLikesSheetPost] = useState<Post | null>(null);
    const [taggedSheetPost, setTaggedSheetPost] = useState<Post | null>(null);
    const [dmSheetOpen, setDmSheetOpen] = useState(false);
    const [dmSheetRecipientHandle, setDmSheetRecipientHandle] = useState<string | null>(null);
    const [dmSheetAnchorPostId, setDmSheetAnchorPostId] = useState<string | null>(null);
    const [dmSheetMessage, setDmSheetMessage] = useState('');
    const [feedDmDeliveryFx, setFeedDmDeliveryFx] = useState<FeedDmDeliveryFxState | null>(null);
    const [notifyLocations, setNotifyLocations] = useState<string[]>([]);
    const [headerScopePicker, setHeaderScopePicker] = useState<LocationSuggestion | null>(null);
    const [headerScopePickerKind, setHeaderScopePickerKind] = useState<'location' | 'venue' | 'landmark'>(
        'location'
    );
    const dmAnchorRefs = useRef<Record<string, View>>({});
    /** Local overrides keyed by post id so bookmark rail matches collections without refetching whole feed. */
    const [savedByPostId, setSavedByPostId] = useState<Record<string, boolean>>({});
    const [overflowVisible, setOverflowVisible] = useState(false);
    const [overflowPost, setOverflowPost] = useState<Post | null>(null);
    const [editPost, setEditPost] = useState<Post | null>(null);
    const [saveModalPost, setSaveModalPost] = useState<Post | null>(null);
    const [qrPost, setQrPost] = useState<Post | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [inviteGroupHandle, setInviteGroupHandle] = useState<string | null>(null);
    const [overflowSaved, setOverflowSaved] = useState(false);
    const [overflowNotify, setOverflowNotify] = useState(false);
    const activeVideoPostIdRef = useRef<string | null>(null);
    const [feedAutoplayAllowed, setFeedAutoplayAllowed] = useState(true);
    const [feedVideoMuted, setFeedVideoMuted] = useState(true);
    const [pendingUploadTick, setPendingUploadTick] = useState(0);
    const [ads, setAds] = useState<Ad[]>([]);
    const [online, setOnline] = useState(true);
    const [suggestedPlacesPrefs, setSuggestedPlacesPrefs] = useState({
        dismissAll: false,
        dismissedBundles: [] as string[],
        includePosterLocale: false,
    });
    const [businessLastShown, setBusinessLastShown] = useState<Record<string, number>>({});
    const [hiddenBusinesses, setHiddenBusinesses] = useState<Set<string>>(new Set());
    const [likedBusinesses, setLikedBusinesses] = useState<Set<string>>(new Set());
    const [businessStripEligible, setBusinessStripEligible] = useState(true);
    const [serverPlaceSuggestions, setServerPlaceSuggestions] = useState<PlaceMatchedPost[] | undefined>(
        undefined,
    );
    const [interestsDraft, setInterestsDraft] = React.useState<string[]>([]);
    const [interestsSaving, setInterestsSaving] = React.useState(false);
    const [interestsCardDismissed, setInterestsCardDismissed] = React.useState(false);
    const [onboardingDismissed, setOnboardingDismissed] = React.useState<boolean | null>(null);
    const [suggestedFollowerDismissed, setSuggestedFollowerDismissed] = React.useState(false);
    const [hiddenFollowerHandles, setHiddenFollowerHandles] = React.useState<Set<string>>(new Set());
    const [stories24Items, setStories24Items] = React.useState<Stories24RailItem[]>([]);
    const [stories24CollapsePayload, setStories24CollapsePayload] =
        React.useState<Stories24RailReturnPayload | null>(null);
    const stories24RailRef = React.useRef<Stories24FeedRailHandle>(null);
    const flatListRef = useRef<FlatList<FeedListRow>>(null);
    const feedScrollYRef = useRef(0);
    /** Scroll Y captured when opening Scenes — restored on return to avoid jump. */
    const scenesReturnScrollYRef = useRef<number | null>(null);
    const suppressFeedViewabilityRef = useRef(false);
    const pendingFeedScrollRestoreRef = useRef<number | null>(null);
    const pendingStories24CollapseRef = useRef<Stories24RailReturnPayload | null>(null);
    const feedLoadGenRef = useRef(0);
    /** Keeps freshly created posts visible if a force-refresh finishes after upload complete. */
    const recentCreatedPostsRef = useRef<Post[]>([]);
    const feedRetryBusyRef = useRef(false);
    const pagesRef = useRef<Post[][]>([]);
    const feedFetchCtxRef = useRef({
        filter: 'ireland',
        viewerUserId: 'anon',
        viewerHandle: undefined as string | undefined,
        userLocal: 'Finglas',
        userRegional: 'Dublin',
        userNational: 'Ireland',
    });
    const reloadFeedFromStartRef = useRef<(opts?: { quiet?: boolean }) => Promise<void>>(
        async () => {},
    );
    const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFeedAutoplayAtMsRef = useRef(0);
    const viewabilityConfigRef = useRef({
        // High enough that a peek of the next card doesn't steal autoplay.
        itemVisiblePercentThreshold: 72,
        minimumViewTime: 120,
    });
    const feedScrollingRef = useRef(false);
    const feedScrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastViewableVideoPostIdRef = useRef<string | null>(null);

    const feedAutoplayPrefRef = useRef<FeedAutoplayPref>('always');

    const syncFeedAutoplayAllowed = useCallback(async (pref: FeedAutoplayPref) => {
        feedAutoplayPrefRef.current = pref;
        const allowed = await resolveFeedAutoplayAllowed(pref);
        setFeedAutoplayAllowed(allowed);
    }, []);

    useEffect(() => {
        let cancelled = false;
        void getFeedAutoplayPref().then((pref) => {
            if (cancelled) return;
            void syncFeedAutoplayAllowed(pref);
        });
        void getGlobalVideoMutedNative().then((muted) => {
            if (!cancelled) setFeedVideoMuted(muted);
        });
        const unsubPref = subscribeFeedAutoplayPref((pref) => {
            void syncFeedAutoplayAllowed(pref);
        });
        const unsubMute = subscribeGlobalVideoMuted(setFeedVideoMuted);
        const unsubNet = NetInfo.addEventListener((state) => {
            setOnline(Boolean(state.isConnected));
            void syncFeedAutoplayAllowed(feedAutoplayPrefRef.current);
        });
        void NetInfo.fetch().then((state) => setOnline(Boolean(state.isConnected)));
        return () => {
            cancelled = true;
            unsubPref();
            unsubMute();
            unsubNet();
        };
    }, [syncFeedAutoplayAllowed]);

    React.useEffect(() => {
        void loadSuggestedPlacesPrefs().then(setSuggestedPlacesPrefs);
        void Promise.all([
            loadBusinessLastShown(),
            loadHiddenBusinesses(),
            loadLikedBusinesses(),
            loadBusinessStripEligible(),
        ]).then(([lastShown, hidden, liked, stripEligible]) => {
            setBusinessLastShown(lastShown);
            setHiddenBusinesses(hidden);
            setLikedBusinesses(liked);
            setBusinessStripEligible(stripEligible);
        });
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            // Sync first — mount shrink overlay in the same turn as Stories dismiss.
            const sync = takeStories24RailReturnSync();
            if (sync) {
                pendingStories24CollapseRef.current = null;
                setStories24CollapsePayload((prev) =>
                    prev && normalizeStories24Handle(prev.handle) === normalizeStories24Handle(sync.handle)
                        ? prev
                        : sync,
                );
                void AsyncStorage.removeItem(STORIES24_RAIL_RETURN_KEY).catch(() => {});
            }
            void (async () => {
                const [payload, scrollY] = await Promise.all([
                    sync ? Promise.resolve(null) : consumeStories24RailReturn(),
                    consumeStories24FeedScrollRestore(),
                ]);
                if (!active) return;
                if (payload) {
                    pendingStories24CollapseRef.current = null;
                    setStories24CollapsePayload((prev) =>
                        prev &&
                        normalizeStories24Handle(prev.handle) === normalizeStories24Handle(payload.handle)
                            ? prev
                            : payload,
                    );
                }
                if (scrollY != null) pendingFeedScrollRestoreRef.current = scrollY;
            })();
            return () => {
                active = false;
            };
        }, []),
    );

    React.useEffect(() => {
        if (!user?.id || customLocation || showFollowingFeed) {
            setStories24Items([]);
            return;
        }
        let cancelled = false;
        const load = () => {
            void buildStories24RailItems(user.id, user.handle).then((items) => {
                if (!cancelled) setStories24Items(items);
            });
        };
        load();
        const pollMs = getStoriesRailPollMs();
        const interval = pollMs != null ? setInterval(load, pollMs) : null;
        const unsubRefresh = subscribeStoriesRefresh(load);
        return () => {
            cancelled = true;
            if (interval) clearInterval(interval);
            unsubRefresh();
        };
    }, [user?.id, user?.handle, customLocation, showFollowingFeed]);

    useFocusEffect(
        React.useCallback(() => {
            if (!user?.id || customLocation || showFollowingFeed) return;
            void buildStories24RailItems(user.id, user.handle).then(setStories24Items);
        }, [user?.id, user?.handle, customLocation, showFollowingFeed]),
    );

    React.useEffect(() => {
        void AsyncStorage.getItem(SUGGESTED_FOLLOWER_DISMISSED_KEY).then((v) => {
            if (v === '1') setSuggestedFollowerDismissed(true);
        });
        void AsyncStorage.getItem(SUGGESTED_FOLLOWER_HIDDEN_HANDLES_KEY).then((raw) => {
            try {
                setHiddenFollowerHandles(new Set(raw ? JSON.parse(raw) : []));
            } catch {
                setHiddenFollowerHandles(new Set());
            }
        });
    }, []);

    React.useEffect(() => {
        setInterestsDraft(user?.interests ?? []);
        setInterestsCardDismissed(false);
    }, [user?.id]);

    React.useEffect(() => {
        if (!user?.id) {
            setOnboardingDismissed(null);
            return;
        }
        void AsyncStorage.getItem(INTERESTS_ONBOARDING_DISMISSED_KEY).then((v) => {
            setOnboardingDismissed(v === '1');
        });
    }, [user?.id]);

    useEffect(() => {
        void loadLocationNotifyPrefs().then(setNotifyLocations);
    }, []);

    const feedAutoplayAllowedRef = useRef(feedAutoplayAllowed);
    feedAutoplayAllowedRef.current = feedAutoplayAllowed;

    const scheduleActiveFeedVideo = useCallback((postId: string | null) => {
        if (autoplayTimerRef.current) {
            clearTimeout(autoplayTimerRef.current);
            autoplayTimerRef.current = null;
        }
        if (!feedAutoplayAllowedRef.current || !postId) {
            activeVideoPostIdRef.current = null;
            setActiveFeedVideoPostId(null);
            return;
        }
        // Store-only updates — do not setState on FeedScreen (that re-renders FlatList
        // and causes a settle jump on every post, image or video).
        if (String(activeVideoPostIdRef.current) === String(postId)) {
            setActiveFeedVideoPostId(postId);
            return;
        }
        const minGapMs = 40;
        const sinceLast = Date.now() - lastFeedAutoplayAtMsRef.current;
        const delayMs = sinceLast >= minGapMs ? 0 : minGapMs - sinceLast;
        autoplayTimerRef.current = setTimeout(() => {
            activeVideoPostIdRef.current = postId;
            setActiveFeedVideoPostId(postId);
            lastFeedAutoplayAtMsRef.current = Date.now();
            autoplayTimerRef.current = null;
        }, delayMs);
    }, []);

    const scheduleActiveFeedVideoRef = useRef(scheduleActiveFeedVideo);
    scheduleActiveFeedVideoRef.current = scheduleActiveFeedVideo;

    useEffect(() => {
        if (!feedAutoplayAllowed) {
            scheduleActiveFeedVideo(null);
        }
    }, [feedAutoplayAllowed, scheduleActiveFeedVideo]);

    const onViewableItemsChanged = useRef(
        ({
            viewableItems,
        }: {
            viewableItems: Array<{ isViewable?: boolean; item?: FeedListRow; index?: number | null }>;
        }) => {
            if (suppressFeedViewabilityRef.current) return;
            if (!feedAutoplayAllowedRef.current) {
                scheduleActiveFeedVideoRef.current(null);
                return;
            }
            const visibleVideos: Array<{ post: Post; index: number }> = [];
            for (const token of viewableItems) {
                if (!token.isViewable || !token.item) continue;
                const row = token.item;
                if (row.kind !== 'post') continue;
                const candidate = row.post;
                if (!postHasVideoMedia(candidate)) continue;
                visibleVideos.push({ post: candidate, index: token.index ?? 0 });
            }
            visibleVideos.sort((a, b) => a.index - b.index);

            const currentId = activeVideoPostIdRef.current;
            let nextId: string | null = null;
            if (currentId && visibleVideos.some((v) => String(v.post.id) === String(currentId))) {
                // Stick on the playing card while it remains viewable — stops the
                // "land on a post then flick to the next" jump when the next peeks in.
                nextId = currentId;
            } else if (visibleVideos.length > 0) {
                // Otherwise prefer the top-most qualifying video (reading position).
                nextId = visibleVideos[0].post.id;
            }

            lastViewableVideoPostIdRef.current = nextId;
            // While the user is flinging, only track the candidate — swapping the
            // active Video mid-scroll remounts TextureViews and feels sticky.
            if (!feedScrollingRef.current) {
                scheduleActiveFeedVideoRef.current(nextId);
            }
        }
    ).current;

    useFocusEffect(
        useCallback(() => {
            const pinnedY = scenesReturnScrollYRef.current;
            if (pinnedY != null) {
                scenesReturnScrollYRef.current = null;
                suppressFeedViewabilityRef.current = true;
                flatListRef.current?.scrollToOffset({ offset: pinnedY, animated: false });
                requestAnimationFrame(() => {
                    flatListRef.current?.scrollToOffset({ offset: pinnedY, animated: false });
                    const restoreId = lastViewableVideoPostIdRef.current;
                    if (restoreId && feedAutoplayAllowedRef.current) {
                        scheduleActiveFeedVideoRef.current(restoreId);
                    }
                    setTimeout(() => {
                        suppressFeedViewabilityRef.current = false;
                    }, 120);
                });
            } else {
                // Resume the same autoplay target immediately — do not wait for FlatList
                // viewability to re-fire (that caused multi-second Scenes→feed MP4 lag).
                const restoreId = lastViewableVideoPostIdRef.current;
                if (restoreId && feedAutoplayAllowedRef.current) {
                    scheduleActiveFeedVideoRef.current(restoreId);
                }
            }
            return () => {
                if (autoplayTimerRef.current) {
                    clearTimeout(autoplayTimerRef.current);
                    autoplayTimerRef.current = null;
                }
                // Pause decode while covered (Scenes / profile). Keep `activeVideoPostId`
                // so focus restore is instant without a cold viewability wait.
                setActiveFeedVideoPostId(null);
            };
        }, [])
    );

    // Custom Gazetteer search must win over Following: otherwise the UI can show "Wembley Stadium"
    // while `currentFilter` stays `discover` if `showFollowingFeed` were ever still true.
    const currentFilter =
        customLocation != null && String(customLocation).trim() !== ''
            ? customFilterType === 'venue'
                ? `venue:${customLocation}`
                : customFilterType === 'landmark'
                    ? `landmark:${customLocation}`
                    : customLocation
            : showFollowingFeed
                ? 'discover'
                : active;

    const feedFetchFilter = useMemo(() => {
        if (customLocation != null && String(customLocation).trim() !== '') {
            return currentFilter;
        }
        if (showFollowingFeed) return 'discover';
        const tab = String(active || user?.national || 'Ireland').trim();
        return tab.toLowerCase() === 'following' ? 'discover' : tab;
    }, [active, customLocation, currentFilter, showFollowingFeed, user?.national]);

    useEffect(() => {
        feedFetchCtxRef.current = {
            filter: feedFetchFilter,
            viewerUserId: userId,
            viewerHandle: user?.handle,
            userLocal: user?.local || 'Finglas',
            userRegional: user?.regional || 'Dublin',
            userNational: user?.national || 'Ireland',
        };
    }, [feedFetchFilter, userId, user?.handle, user?.local, user?.regional, user?.national]);

    React.useEffect(() => {
        if (!user) {
            setAds([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const userLocation = user.local || user.regional || user.national || '';
                const activeAds = await getActiveAds(userLocation, []);
                if (!cancelled) setAds(activeAds);
            } catch (err) {
                console.error('Error loading ads:', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user, feedFetchFilter]);

    React.useEffect(() => {
        let cancelled = false;
        const laravelApiActive = isLaravelApiEnabled() && !!getAuthToken();
        if (!laravelApiActive || !user || customLocation) {
            setServerPlaceSuggestions(undefined);
            return () => {
                cancelled = true;
            };
        }
        void fetchSuggestedPostsByPlaces({
            limit: 9,
            include_poster_regional: suggestedPlacesPrefs.includePosterLocale,
            places_traveled: Array.isArray(user.placesTraveled) ? user.placesTraveled : undefined,
        })
            .then((res) => {
                if (cancelled) return;
                const rows = res.suggestions || [];
                const mapped: PlaceMatchedPost[] = rows.map((row) => ({
                    post: decorateForUser(userId, transformLaravelPost(row.post as Record<string, unknown>)),
                    matchedPlace: row.matched_place,
                    reason: row.reason === 'places_traveled' ? 'places_traveled' : 'home_area',
                }));
                setServerPlaceSuggestions(mapped);
            })
            .catch(() => {
                if (!cancelled) setServerPlaceSuggestions(undefined);
            });
        return () => {
            cancelled = true;
        };
    }, [user, userId, customLocation, suggestedPlacesPrefs.includePosterLocale]);

    const buildFeedFetchParams = React.useCallback((fetchCursor: string | number | null) => {
        const ctx = feedFetchCtxRef.current;
        return {
            filter: ctx.filter,
            cursor: fetchCursor,
            viewerUserId: ctx.viewerUserId,
            viewerHandle: ctx.viewerHandle,
            userLocal: ctx.userLocal,
            userRegional: ctx.userRegional,
            userNational: ctx.userNational,
            prefs: feedContentPrefsRef.current,
        };
    }, []);

    // Helper to update a post in pages
    const updatePost = (postId: string, updater: (post: Post) => Post) => {
        setPages(prev => prev.map(page =>
            page.map(p => p.id === postId ? updater(p) : p)
        ));
    };

    useEffect(() => {
        let cancelled = false;
        void loadFeedContentPrefsMobile(userId)
            .then((prefs) => {
                if (cancelled) return;
                feedContentPrefsRef.current = prefs;
                setPages((prev) => {
                    const next = prev
                        .map((page) =>
                            filterPostsByContentPrefs(page, prefs, {
                                isProtectedDevMockVideo: isDevMockFeedVideoPost,
                            }),
                        )
                        .filter((page) => page.length > 0);
                    // Avoid wiping a loaded feed if prefs were empty on first paint.
                    if (next.flat().length === 0 && prev.flat().length > 0) {
                        return prev;
                    }
                    return next;
                });
            })
            .catch(() => {
                feedContentPrefsRef.current = {
                    mutedHandles: new Set(),
                    blockedHandles: new Set(),
                    hiddenPostIds: new Set(),
                    notInterestedPostIds: new Set(),
                };
            });
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const hideUserFromFeed = React.useCallback((handleToHide: string) => {
        const normalized = String(handleToHide || '').replace(/^@/, '').trim().toLowerCase();
        if (!normalized) return;
        feedContentPrefsRef.current.mutedHandles.add(normalized);
        void muteFeedAuthorMobile(userId, handleToHide);
        setPages((prev) =>
            prev
                .map((page) => page.filter((p) => String(p.userHandle || '').trim().toLowerCase() !== normalized))
                .filter((page) => page.length > 0)
        );
        setSelectedPostForComments((prev) =>
            prev && String(prev.userHandle || '').trim().toLowerCase() === normalized ? null : prev
        );
        setSelectedPostForShare((prev) =>
            prev && String(prev.userHandle || '').trim().toLowerCase() === normalized ? null : prev
        );
        setOverflowPost((prev) =>
            prev && String(prev.userHandle || '').trim().toLowerCase() === normalized ? null : prev
        );
        setOverflowVisible(false);
    }, []);

    const removePostFromFeed = React.useCallback((postId: string) => {
        setPages((prev) =>
            prev.map((page) => page.filter((p) => p.id !== postId)).filter((page) => page.length > 0)
        );
        setOverflowVisible(false);
        setOverflowPost((prev) => (prev?.id === postId ? null : prev));
    }, []);

    const hidePostFromFeed = React.useCallback(
        (postId: string) => {
            feedContentPrefsRef.current.hiddenPostIds.add(postId);
            void hideFeedPostMobile(userId, postId);
            removePostFromFeed(postId);
        },
        [removePostFromFeed, userId]
    );

    const markPostNotInterested = React.useCallback(
        (postId: string) => {
            feedContentPrefsRef.current.notInterestedPostIds.add(postId);
            void markNotInterestedFeedPostMobile(userId, postId);
            removePostFromFeed(postId);
        },
        [removePostFromFeed, userId]
    );

    const applyPostEditToFeed = React.useCallback(
        (postId: string, fields: { text: string; location: string; venue: string; landmark: string }) => {
            const patch = (p: Post): Post => ({
                ...p,
                text: fields.text,
                caption: fields.text,
                locationLabel: fields.location || undefined,
                venue: fields.venue || undefined,
                landmark: fields.landmark || undefined,
            });
            updatePost(postId, patch);
            setEditPost((prev) => (prev?.id === postId ? patch(prev) : prev));
            setOverflowPost((prev) => (prev?.id === postId ? patch(prev) : prev));
        },
        []
    );

    const toggleCollectionsSaveForPost = React.useCallback(
        async (target: Post) => {
            try {
                const cols = await getCollectionsForPost(userId, target.id);
                if (cols.length > 0) {
                    await unsavePost(userId, target.id);
                    setSavedByPostId((prev) => ({ ...prev, [target.id]: false }));
                    updatePost(target.id, (p) => ({ ...p, isBookmarked: false }));
                } else {
                    await savePostToDefaultCollection(userId, target.id, target);
                    setSavedByPostId((prev) => ({ ...prev, [target.id]: true }));
                    updatePost(target.id, (p) => ({ ...p, isBookmarked: true }));
                }
            } catch (err) {
                console.error('Collections save toggle failed:', err);
            }
        },
        [userId, updatePost]
    );

    useEffect(() => {
        if (!overflowVisible || !overflowPost) return;
        let cancelled = false;
        (async () => {
            try {
                const cols = await getCollectionsForPost(userId, overflowPost.id);
                const n = await hasPostNotificationsPrefMobile(userId, overflowPost.id);
                if (!cancelled) {
                    setOverflowSaved(cols.length > 0);
                    setOverflowNotify(n);
                }
            } catch {
                if (!cancelled) {
                    setOverflowSaved(false);
                    setOverflowNotify(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [overflowVisible, overflowPost?.id, userId]);

    const openShareForPost = React.useCallback(async (p: Post) => {
        setSelectedPostForShare(p);
        setShareModalOpen(true);
    }, []);

    const handleShareToStoriesSuccess = React.useCallback(
        (postId: string) => {
            updatePost(postId, (prev) => ({
                ...prev,
                stats: { ...prev.stats, shares: prev.stats.shares + 1 },
            }));
        },
        [updatePost],
    );

    const tryReclipPost = React.useCallback(
        async (p: Post) => {
            const norm = (h?: string) => String(h || '').trim().toLowerCase();
            if (!user || norm(p.userHandle) === norm(user.handle)) {
                setFeedGazetteerAlert({
                    title: 'Cannot reclip',
                    message: 'You cannot reclip your own post',
                    icon: 'alert',
                });
                return;
            }
            if (p.userReclipped) {
                setFeedGazetteerAlert({
                    title: 'Already reclipped',
                    message: 'You have already reclipped this post',
                    icon: 'info',
                });
                return;
            }
            setReclipConfirmPost(p);
        },
        [user],
    );

    const confirmReclipPost = React.useCallback(async () => {
        const p = reclipConfirmPost;
        setReclipConfirmPost(null);
        if (!p || !user) return;
        const prevReclips = p.stats.reclips;
        const newReclips = prevReclips + 1;
        setReclipState(userId, p.id, true);
        updatePost(p.id, (prev) => ({
            ...prev,
            userReclipped: true,
            stats: { ...prev.stats, reclips: newReclips },
        }));
        try {
            const result = await reclipPost(userId, p.id, user.handle);
            if (result.originalPost) {
                updatePost(p.id, () => result.originalPost);
            }
            // Following feed should pick up your reclip on next load.
            if (showFollowingFeed || currentFilter.toLowerCase() === 'discover') {
                setReloadTick((t) => t + 1);
            }
        } catch (err: any) {
            console.warn('Reclip failed:', err);
            setReclipState(userId, p.id, false);
            updatePost(p.id, (prev) => ({
                ...prev,
                userReclipped: false,
                stats: { ...prev.stats, reclips: prevReclips },
            }));
            setFeedGazetteerAlert({
                title: 'Could not reclip',
                message: err?.message || 'Please try again.',
                icon: 'alert',
            });
        }
    }, [reclipConfirmPost, user, userId, updatePost, showFollowingFeed, currentFilter]);

    useEffect(() => {
        if (user?.national) {
            const oldTabs = ['Finglas', 'Dublin', 'Ireland'];
            if (oldTabs.includes(active)) {
                setActive(user.national);
            }
        }
    }, [user?.national, user?.regional, user?.local]);

    /** Footer Home tab — same as web `goHomeFeed` / `resetFeed`. */
    useEffect(() => {
        const token = route?.params?.resetHomeFeedAt;
        if (token == null) return;
        void (async () => {
            await clearPendingLocationFeed();
            setShowFollowingFeed(false);
            setActive(user?.national || defaultNational);
            setCustomLocation(null);
            setCustomLocationLabel(null);
            setCustomLocationPlaceId(null);
            setCustomFilterType(null);
            setPages([]);
            setCursor(0);
            setEnd(false);
            setError(null);
            setReloadTick((t) => t + 1);
            try {
                navigation?.setParams?.({
                    resetHomeFeedAt: null,
                    location: undefined,
                    locationLabel: undefined,
                    locationScope: undefined,
                    filterType: undefined,
                    placeId: undefined,
                });
            } catch {
                // ignore
            }
        })();
    }, [route?.params?.resetHomeFeedAt, navigation, user?.national, defaultNational]);

    useEffect(() => {
        // A live Home-tab reset token must win; null/undefined means apply location.
        if (route?.params?.resetHomeFeedAt != null) return;
        const requestedLocation = route?.params?.location;
        const requestedLabel = route?.params?.locationLabel;
        const requestedPlaceId = route?.params?.placeId;
        const requestedFilterType = route?.params?.filterType as 'location' | 'venue' | 'landmark' | undefined;
        if (!requestedLocation || typeof requestedLocation !== 'string') return;
        const next = requestedLocation.trim();
        if (!next) return;
        const label =
            typeof requestedLabel === 'string' && requestedLabel.trim()
                ? requestedLabel.trim()
                : feedHeaderLabelFromSuggestion({
                      name: next,
                      type:
                          requestedFilterType === 'venue'
                              ? 'venue'
                              : requestedFilterType === 'landmark'
                                ? 'landmark'
                                : 'location',
                  } as LocationSuggestion);
        const placeId =
            typeof requestedPlaceId === 'string' && requestedPlaceId.trim()
                ? requestedPlaceId.trim()
                : null;
        setShowFollowingFeed(false);
        setCustomLocation(next);
        setCustomLocationLabel(label);
        setCustomLocationPlaceId(placeId);
        setCustomFilterType(
            requestedFilterType === 'venue'
                ? 'venue'
                : requestedFilterType === 'landmark'
                    ? 'landmark'
                    : 'location'
        );
        setReloadTick((t) => t + 1);
    }, [
        route?.params?.location,
        route?.params?.locationLabel,
        route?.params?.filterType,
        route?.params?.placeId,
        route?.params?.resetHomeFeedAt,
    ]);

    useEffect(() => {
        pagesRef.current = pages;
    }, [pages]);

    // Update unread count function
    const updateUnreadCount = React.useCallback(async () => {
        if (!user?.handle) return;
        try {
            const count = await getUnreadTotal(user.handle);
            setUnreadCount(count);
            setHasInbox(count > 0);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }, [user?.handle]);

    // Listen for unread messages count
    useEffect(() => {
        if (!user?.handle) return;

        // Initialize unread count
        updateUnreadCount();

        // Poll for updates every 10 seconds
        const interval = setInterval(updateUnreadCount, getInboxUnreadPollMs());

        return () => {
            clearInterval(interval);
        };
    }, [user?.handle, updateUnreadCount]);

    // Inbox badge only on focus — do not reset feed here (that raced loadMore and left an empty feed).
    useFocusEffect(
        React.useCallback(() => {
            updateUnreadCount();
        }, [updateUnreadCount])
    );

    const applyScenesPostUpdates = React.useCallback((updates: Post[]) => {
        if (!updates.length) return;
        const pinnedY = feedScrollYRef.current;
        setPages((prev) =>
            prev.map((page) =>
                page.map((p) => {
                    const next = updates.find((u) => u.id === p.id);
                    if (!next) return p;
                    return {
                        ...p,
                        ...next,
                        stats: { ...p.stats, ...next.stats },
                    };
                }),
            ),
        );
        // Keep the same viewport after post patches remount/remeasure rows.
        requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({ offset: pinnedY, animated: false });
            requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({ offset: pinnedY, animated: false });
            });
        });
    }, []);

    useEffect(() => subscribeScenesPostUpdates(applyScenesPostUpdates), [applyScenesPostUpdates]);

    useEffect(() => {
        if (!route?.params?.forceRefreshAt) return;
        setReloadTick((prev) => prev + 1);
    }, [route?.params?.forceRefreshAt]);

    useEffect(() => {
        return subscribePendingFeedUploads(() => {
            setPendingUploadTick((tick) => tick + 1);
        });
    }, []);

    // Avoid leaking another account's just-created posts into this viewer's feed.
    useEffect(() => {
        recentCreatedPostsRef.current = [];
    }, [userId]);

    useEffect(() => {
        return subscribePendingFeedUploadComplete((tempId, createdPost) => {
            const decorated = decorateForUser(userId, createdPost);
            recentCreatedPostsRef.current = [
                decorated,
                ...recentCreatedPostsRef.current.filter((p) => String(p.id) !== String(decorated.id)),
            ].slice(0, 20);
            setPages((prev) => {
                if (prev.length === 0) {
                    return [[decorated]];
                }
                const [first, ...rest] = prev;
                const nextFirst = [
                    decorated,
                    ...first.filter(
                        (p) =>
                            String(p.id) !== String(tempId) &&
                            String(p.id) !== String(decorated.id),
                    ),
                ];
                return [nextFirst, ...rest];
            });
            setPendingUploadTick((tick) => tick + 1);
        });
    }, [userId]);

    const applyFeedPageResult = React.useCallback(
        (items: Post[], nextCursor: string | number | null) => {
            const recent = recentCreatedPostsRef.current;
            const recentIds = new Set(recent.map((p) => String(p.id)));
            const withoutDupes = items.filter((p) => !recentIds.has(String(p.id)));
            const merged = recent.length > 0 ? [...recent, ...withoutDupes] : items;
            if (merged.length > 0) {
                setPages([merged]);
                setCursor(nextCursor);
                setEnd(nextCursor == null);
            } else {
                setPages([]);
                setCursor(0);
                setEnd(true);
            }
        },
        [],
    );

    const reloadFeedFromStart = React.useCallback(async (opts?: { quiet?: boolean }) => {
        const gen = ++feedLoadGenRef.current;
        setEnd(false);
        // Pull-to-refresh keeps existing cards visible (quiet); cold load shows skeleton.
        if (!opts?.quiet) {
            setInitialLoading(true);
        }
        setError(null);
        const timeoutMs = Platform.OS === 'web' ? 12000 : 15000;

        const makeLoadTimeout = () => {
            let loadTimeoutId: ReturnType<typeof setTimeout> | undefined;
            const promise = new Promise<never>((_, reject) => {
                loadTimeoutId = setTimeout(
                    () => reject(new Error('Feed load timed out')),
                    timeoutMs,
                );
            });
            return { promise, clear: () => loadTimeoutId && clearTimeout(loadTimeoutId) };
        };

        const runFetch = () => fetchInitialVisibleFeed(buildFeedFetchParams(0));
        const firstTimeout = makeLoadTimeout();
        try {
            const result = await Promise.race([runFetch(), firstTimeout.promise]);
            if (gen !== feedLoadGenRef.current) return;
            applyFeedPageResult(result.items, result.nextCursor);
        } catch (err) {
            if (gen !== feedLoadGenRef.current) return;
            console.error('Error loading feed:', err);
            const errMsg = err instanceof Error ? err.message : String(err ?? '');
            const looksLikeCorruptJson =
                err instanceof SyntaxError ||
                /JSON\s*Parse|Unexpected .* position|at position \d+/i.test(errMsg);

            // Only clear posts cache on corrupt JSON — never wipe collections on timeouts.
            if (looksLikeCorruptJson) {
                try {
                    const { clearCorruptPostsStorageNative } = await import('../api/postsStorage.native');
                    await clearCorruptPostsStorageNative();
                } catch {
                    /* ignore */
                }
                try {
                    if (typeof localStorage !== 'undefined') {
                        localStorage.removeItem('clips_app_posts');
                    }
                } catch {
                    /* ignore */
                }
            }

            if (isLaravelApiEnabled()) {
                markLaravelUnreachable();
            }

            const retryTimeout = makeLoadTimeout();
            try {
                const retryResult = await Promise.race([runFetch(), retryTimeout.promise]);
                if (gen !== feedLoadGenRef.current) return;
                applyFeedPageResult(retryResult.items, retryResult.nextCursor);
                return;
            } catch (retryErr) {
                console.error('Feed recover retry failed:', retryErr);
            } finally {
                retryTimeout.clear();
            }

            const msg = err instanceof Error ? err.message : '';
            setError(
                msg.includes('timed out')
                    ? 'Feed load timed out — tap Retry'
                    : msg
                      ? `Failed to load feed (${msg.slice(0, 100)})`
                      : 'Failed to load feed',
            );
            // Keep just-created posts visible even when the feed fetch fails/times out.
            applyFeedPageResult([], null);
        } finally {
            firstTimeout.clear();
            if (gen === feedLoadGenRef.current) {
                setInitialLoading(false);
            }
        }
    }, [applyFeedPageResult, buildFeedFetchParams]);

    reloadFeedFromStartRef.current = reloadFeedFromStart;

    const loadMore = React.useCallback(async () => {
        if (initialLoading || loadingMore || end || cursor === null) {
            return;
        }
        const gen = feedLoadGenRef.current;
        setLoadingMore(true);
        setError(null);
        try {
            let walkCursor: string | number | null = cursor;
            let appended: Post[] = [];
            for (let step = 0; step < 16; step += 1) {
                if (gen !== feedLoadGenRef.current) return;
                const page = await fetchVisibleFeedPage(buildFeedFetchParams(walkCursor));
                if (page.items.length > 0) {
                    appended = page.items;
                    walkCursor = page.nextCursor;
                    break;
                }
                if (page.nextCursor == null) {
                    setEnd(true);
                    return;
                }
                walkCursor = page.nextCursor;
            }
            if (gen !== feedLoadGenRef.current) return;
            if (appended.length > 0) {
                setPages((prev) => [...prev, appended]);
                setCursor(walkCursor);
                setEnd(walkCursor == null);
            } else {
                setEnd(true);
            }
        } catch (err) {
            if (gen !== feedLoadGenRef.current) return;
            console.error('Error loading feed:', err);
            setError('Failed to load feed');
        } finally {
            setLoadingMore(false);
        }
    }, [buildFeedFetchParams, cursor, end, initialLoading, loadingMore]);

    useEffect(() => {
        const t = setTimeout(() => {
            void reloadFeedFromStartRef.current();
        }, 0);
        return () => clearTimeout(t);
    }, [reloadTick, feedFetchFilter, userId]);

    const feedPostCount = useMemo(() => pages.flat().length, [pages]);

    const retryFeedLoad = React.useCallback(() => {
        if (feedRetryBusyRef.current) return;
        feedRetryBusyRef.current = true;
        setError(null);
        setReloadTick((t) => t + 1);
        setTimeout(() => {
            feedRetryBusyRef.current = false;
        }, 800);
    }, []);

    const refreshingLockRef = useRef(false);

    const onRefresh = React.useCallback(async () => {
        if (refreshingLockRef.current) return;
        refreshingLockRef.current = true;
        setRefreshing(true);
        try {
            await reloadFeedFromStartRef.current({ quiet: true });
        } catch (err) {
            console.error('Feed pull-to-refresh failed:', err);
        } finally {
            refreshingLockRef.current = false;
            setRefreshing(false);
        }
    }, []);

    const handleTabChange = (tab: Tab) => {
        setError(null);
        if (tab === 'Following') {
            setShowFollowingFeed(true);
            setCustomLocation(null);
            setCustomLocationLabel(null);
            setCustomLocationPlaceId(null);
            setCustomFilterType(null);
            setActive('Following'); // Set active to Following so it's highlighted
        } else {
            setShowFollowingFeed(false);
            setCustomLocation(null);
            setCustomLocationLabel(null);
            setCustomLocationPlaceId(null);
            setCustomFilterType(null);
            setActive(tab);
        }
        try {
            navigation?.setParams?.({
                location: undefined,
                locationLabel: undefined,
                locationScope: undefined,
                filterType: undefined,
                placeId: undefined,
            });
        } catch {
            // ignore
        }
        setReloadTick((t) => t + 1);
    };

    const applyCustomLocationFeed = useCallback(
        (selection: PlaceFeedSelection, filterType: 'location' | 'venue' | 'landmark') => {
            setShowFollowingFeed(false);
            setCustomLocation(selection.filter);
            setCustomLocationLabel(selection.label);
            setCustomLocationPlaceId(selection.placeId?.trim() || null);
            setCustomFilterType(filterType);
            setError(null);
            setReloadTick((t) => t + 1);
            try {
                navigation?.setParams?.({
                    location: selection.filter,
                    locationLabel: selection.label,
                    locationScope: selection.scope,
                    filterType,
                    placeId: selection.placeId || undefined,
                });
            } catch {
                // ignore
            }
        },
        [navigation]
    );

    const handleHeaderLocationSearch = useCallback(
        (
            location: string,
            filterType: 'location' | 'venue' | 'landmark' = 'location',
            meta?: { label?: string; placeId?: string | null; scope?: string }
        ) => {
            const filter = location.trim();
            if (!filter) return;
            const label = (meta?.label ?? filter).trim() || filter;
            const scope =
                meta?.scope === 'local' || meta?.scope === 'regional' || meta?.scope === 'national'
                    ? meta.scope
                    : 'national';
            applyCustomLocationFeed(
                {
                    filter,
                    label,
                    fullName: filter,
                    scope,
                    placeId: meta?.placeId?.trim() || null,
                },
                filterType
            );
        },
        [applyCustomLocationFeed]
    );

    const handleHeaderPlacePick = useCallback(
        (suggestion: LocationSuggestion, filterType: 'location' | 'venue' | 'landmark') => {
            if (filterType === 'location' && getPlaceFeedPickerOptions(suggestion)) {
                setHeaderScopePicker(suggestion);
                setHeaderScopePickerKind(filterType);
                return;
            }
            applyCustomLocationFeed(resolvePlaceFeedSelection(suggestion), filterType);
        },
        [applyCustomLocationFeed]
    );

    useFocusEffect(
        React.useCallback(() => {
            let cancelled = false;
            void (async () => {
                const pending = await readPendingLocationFeed();
                if (!pending || cancelled) return;
                await clearPendingLocationFeed();
                const scope: FeedScope =
                    pending.scope === 'local' || pending.scope === 'regional' || pending.scope === 'national'
                        ? pending.scope
                        : 'national';
                setShowFollowingFeed(false);
                setActive((prev) => (prev === 'Following' ? defaultNational : prev));
                applyCustomLocationFeed(
                    {
                        filter: pending.filter,
                        label: pending.label,
                        fullName: pending.filter,
                        scope,
                        placeId: pending.placeId ?? null,
                    },
                    pending.filterType
                );
            })();
            return () => {
                cancelled = true;
            };
        }, [applyCustomLocationFeed, defaultNational])
    );

    const clearCustomLocation = () => {
        void clearPendingLocationFeed();
        setShowFollowingFeed(false);
        setActive(user?.national || defaultNational);
        setCustomLocation(null);
        setCustomLocationLabel(null);
        setCustomLocationPlaceId(null);
        setCustomFilterType(null);
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
        setReloadTick((t) => t + 1);
        try {
            navigation?.setParams?.({
                location: undefined,
                locationLabel: undefined,
                locationScope: undefined,
                filterType: undefined,
                placeId: undefined,
                resetHomeFeedAt: undefined,
            });
        } catch {
            // ignore
        }
    };

    // Uploading/failed placeholders live in UploadProgressToast only — not in the feed list.
    const pendingPosts = React.useMemo(() => [], [pendingUploadTick]);

    const flatPosts = React.useMemo(() => {
        const pendingIds = new Set(pendingPosts.map((p) => p.id));
        const seen = new Set<string>();
        const loaded = pages
            .flat()
            .filter((p) => !pendingIds.has(p.id))
            .filter((p) => {
                const key = String(p.id);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        return [...pendingPosts, ...loaded];
    }, [pages, pendingPosts]);

    const flatStream = React.useMemo((): FeedStreamRow[] => {
        const feedItems: FeedStreamRow[] = [
            ...flatPosts.map((p) => ({ type: 'post' as const, item: p, createdAt: p.createdAt || 0 })),
            ...ads.map((a) => ({ type: 'ad' as const, item: a, createdAt: a.createdAt || 0 })),
        ];
        feedItems.sort((a, b) => b.createdAt - a.createdAt);
        return feedItems;
    }, [flatPosts, ads]);

    const previewSuggestedCards =
        !customLocation &&
        !showFollowingFeed &&
        String(active || '').trim().toLowerCase() === 'ireland';

    const flatWithSuggested = React.useMemo(
        () =>
            buildFlatWithSuggested({
                flat: flatStream,
                user: user ?? null,
                userId,
                activeTab: String(active || user?.national || 'Ireland'),
                customLocation,
                suggestedCardsV2Enabled: true,
                previewSuggestedCards,
                suggestedPlacesPrefs,
                serverPlaceSuggestions,
                businessStripEligible,
                businessLastShown,
                hiddenBusinesses,
                likedBusinesses,
            }),
        [
            flatStream,
            user,
            userId,
            active,
            customLocation,
            previewSuggestedCards,
            suggestedPlacesPrefs,
            serverPlaceSuggestions,
            businessStripEligible,
            businessLastShown,
            hiddenBusinesses,
            likedBusinesses,
        ],
    );

    const flat = flatPosts;

    const showInterestsFeedCard = React.useMemo(() => {
        if (!user || interestsCardDismissed) return false;
        if ((user.interests?.length ?? 0) >= MAX_INTEREST_SELECTIONS) return false;
        if (onboardingDismissed === null || onboardingDismissed) return false;
        return true;
    }, [user, interestsCardDismissed, onboardingDismissed]);

    const saveInterests = React.useCallback(
        (next: string[]) => {
            if (!user) return;
            login({ ...user, interests: next });
            void AsyncStorage.removeItem(INTERESTS_ONBOARDING_DISMISSED_KEY);
        },
        [login, user],
    );

    const suggestedFollowerSuggestion = React.useMemo((): SuggestedFollowerSuggestion | null => {
        if (!user || customLocation || suggestedFollowerDismissed) return null;
        const posts = flatWithSuggested
            .filter((x): x is { type: 'post'; item: Post; createdAt: number } => x.type === 'post')
            .map((x) => x.item);
        return buildSuggestedFollowerFromPosts(posts, user, hiddenFollowerHandles);
    }, [flatWithSuggested, user, customLocation, suggestedFollowerDismissed, hiddenFollowerHandles]);

    const showSuggestedFollowerCard = Boolean(suggestedFollowerSuggestion);

    const showStories24Rail = !customLocation && !showFollowingFeed && stories24Items.length > 0;

    React.useEffect(() => {
        const pending = pendingStories24CollapseRef.current;
        if (!pending) return;
        if (!showStories24Rail) {
            pendingStories24CollapseRef.current = null;
            return;
        }
        const handleKey = normalizeStories24Handle(pending.handle);
        const hasCard = stories24Items.some(
            (item) => normalizeStories24Handle(item.handle) === handleKey,
        );
        if (!hasCard) {
            pendingStories24CollapseRef.current = null;
            return;
        }
        pendingStories24CollapseRef.current = null;
        setStories24CollapsePayload((prev) =>
            prev && normalizeStories24Handle(prev.handle) === handleKey ? prev : pending,
        );
    }, [showStories24Rail, stories24Items]);

    const openStoryFromRail = React.useCallback(
        (item: Stories24RailItem, railHandles: string[]) => {
            if (isStories24AddYoursHandle(item.handle)) {
                return;
            }
            void snapshotStories24FeedScroll(feedScrollYRef.current);
            void persistStories24RailOpenHandle(item.handle);
            navigation.navigate('Stories', buildStories24StoryNavParams(item, railHandles));
        },
        [navigation],
    );

    const openStories24FromHeader = React.useCallback(async () => {
        let items = stories24Items;
        let target = resolveStories24OpenTarget(items);

        if (!target && user?.id) {
            try {
                items = await buildStories24RailItems(user.id, user.handle);
                setStories24Items(items);
                target = resolveStories24OpenTarget(items);
            } catch (err) {
                console.warn('Stories24 header: failed to refresh rail items', err);
            }
        }

        void snapshotStories24FeedScroll(feedScrollYRef.current);

        if (!target) {
            navigation.navigate('Stories', { fromStories24Rail: true, forceRefreshAt: Date.now() });
            return;
        }

        void persistStories24RailOpenHandle(target.item.handle);
        navigation.navigate('Stories', buildStories24StoryNavParams(target.item, target.railHandles));
    }, [stories24Items, user?.id, user?.handle, navigation]);

    const previewLocalBusinessPosts = React.useMemo(() => {
        const posts = flatStream
            .filter((x): x is { type: 'post'; item: Post; createdAt: number } => x.type === 'post')
            .map((x) => x.item);
        const business = posts.filter((p) => p.userAccountType === 'business');
        const source = business.length > 0 ? business : posts;
        const shuffled = [...source];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, 8);
    }, [flatStream]);

    const previewSuggestedPlaces = React.useMemo((): PlaceMatchedPost[] => {
        const posts = flatStream
            .filter((x): x is { type: 'post'; item: Post; createdAt: number } => x.type === 'post')
            .map((x) => x.item);
        if (!user || posts.length === 0) return [];
        const matched = findPlaceMatchedPosts(user, posts, {
            max: 3,
            excludeOwn: true,
            includePosterRegionalNational: suggestedPlacesPrefs.includePosterLocale,
        });
        if (matched.length > 0) {
            const shuffledMatched = [...matched];
            for (let i = shuffledMatched.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledMatched[i], shuffledMatched[j]] = [shuffledMatched[j], shuffledMatched[i]];
            }
            return shuffledMatched.slice(0, 3);
        }
        const shuffledPosts = [...posts];
        for (let i = shuffledPosts.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledPosts[i], shuffledPosts[j]] = [shuffledPosts[j], shuffledPosts[i]];
        }
        return shuffledPosts.slice(0, 3).map((post) => ({
            post,
            matchedPlace: post.venue || post.landmark || post.locationLabel || user.local || 'Your area',
            reason: 'home_area' as const,
            confidence: 'medium' as const,
        }));
    }, [flatStream, user, suggestedPlacesPrefs.includePosterLocale]);

    const flatForRender = React.useMemo((): FeedListRow[] => {
        const out: FeedListRow[] = [];
        let postCount = 0;
        let interestsInserted = false;
        let followerInserted = false;
        let stories24Inserted = false;
        for (const item of flatWithSuggested) {
            if (item.type === 'post') {
                out.push({ kind: 'post', post: item.item });
                postCount += 1;
                if (!stories24Inserted && showStories24Rail && postCount === 1) {
                    out.push({ kind: 'stories24', id: 'stories24-feed-rail' });
                    stories24Inserted = true;
                }
                if (
                    previewSuggestedCards &&
                    !customLocation &&
                    previewLocalBusinessPosts.length > 0 &&
                    postCount === 2
                ) {
                    out.push({ kind: 'local_business', posts: previewLocalBusinessPosts, useMockPreview: true });
                }
                if (!followerInserted && showSuggestedFollowerCard && suggestedFollowerSuggestion && postCount === 3) {
                    out.push({ kind: 'suggested_follower', suggestion: suggestedFollowerSuggestion });
                    followerInserted = true;
                }
                if (
                    previewSuggestedCards &&
                    !customLocation &&
                    previewSuggestedPlaces.length > 0 &&
                    postCount === 4
                ) {
                    out.push({
                        kind: 'suggested_places',
                        bundleKey: 'preview-suggestions',
                        suggestions: previewSuggestedPlaces,
                    });
                }
                if (!interestsInserted && showInterestsFeedCard && postCount === 4) {
                    out.push({ kind: 'interests', id: 'interests-onboarding-feed-card' });
                    interestsInserted = true;
                }
            } else if (item.type === 'ad') {
                out.push({ kind: 'ad', ad: item.item });
            } else if (item.type === 'local_business') {
                out.push({
                    kind: 'local_business',
                    posts: item.item.posts,
                    pinnedPaidPostId: item.item.pinnedPaidPostId,
                });
            } else if (item.type === 'suggested') {
                out.push({
                    kind: 'suggested_places',
                    bundleKey: suggestedPlacesBundleKey(item.item.suggestions),
                    suggestions: item.item.suggestions,
                });
            }
        }
        return out;
    }, [
        flatWithSuggested,
        showInterestsFeedCard,
        showSuggestedFollowerCard,
        suggestedFollowerSuggestion,
        showStories24Rail,
        previewSuggestedCards,
        customLocation,
        previewLocalBusinessPosts,
        previewSuggestedPlaces,
    ]);

    React.useEffect(() => {
        const pendingY = pendingFeedScrollRestoreRef.current;
        if (pendingY == null || flatForRender.length === 0) return;
        if (stories24CollapsePayload) return;
        pendingFeedScrollRestoreRef.current = null;
        requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({ offset: pendingY, animated: false });
        });
    }, [flatForRender.length, stories24CollapsePayload]);

    const scrollStories24RailIntoView = React.useCallback(async () => {
        const idx = flatForRender.findIndex((row) => row.kind === 'stories24');
        if (idx < 0) return;
        await new Promise<void>((resolve) => {
            flatListRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
            setTimeout(resolve, 80);
        });
    }, [flatForRender]);

    const videoPostsForScenes = React.useMemo(() => flat.filter(postHasVideoMedia), [flat]);

    const customLocationDisplay = customLocationLabel || customLocation;

    const isNotifyOnForCurrentLocation = useMemo(() => {
        if (!customLocation) return false;
        const key = locationNotifyKey(customLocation);
        return key !== '' && notifyLocations.includes(key);
    }, [customLocation, notifyLocations]);

    const toggleNotifyForCurrentLocation = useCallback(() => {
        if (!customLocation) return;
        const key = locationNotifyKey(customLocation);
        if (!key) return;
        setNotifyLocations((prev) => {
            const exists = prev.includes(key);
            const next = exists ? prev.filter((k) => k !== key) : [...prev, key];
            void saveLocationNotifyPrefs(next);
            return next;
        });
    }, [customLocation]);

    const registerDmAnchor = useCallback((key: string, ref: View | null) => {
        if (ref) {
            dmAnchorRefs.current[key] = ref;
        } else {
            delete dmAnchorRefs.current[key];
        }
    }, []);

    const measureDmTarget = useCallback(
        (toHandle: string, anchorPostId: string | null, cb: (targetX: number, targetY: number) => void) => {
            const keys: string[] = [];
            if (anchorPostId) keys.push(`post:${anchorPostId}`);
            keys.push(`handle:${toHandle}`);
            const tryKey = (index: number) => {
                if (index >= keys.length) {
                    cb(40, 42);
                    return;
                }
                const view = dmAnchorRefs.current[keys[index]];
                if (!view?.measureInWindow) {
                    tryKey(index + 1);
                    return;
                }
                view.measureInWindow((x, y, w, h) => {
                    cb(x + w / 2, y + h / 2);
                });
            };
            tryKey(0);
        },
        []
    );

    const startFeedDmDeliveryFx = useCallback(
        (toHandle: string, anchorPostId: string | null) => {
            const { width, height } = Dimensions.get('window');
            const startX = width / 2;
            const startY = height - 112;
            measureDmTarget(toHandle, anchorPostId, (targetX, targetY) => {
                setFeedDmDeliveryFx({
                    toHandle,
                    startX,
                    startY,
                    targetX,
                    targetY,
                    phase: 'start',
                });
                setTimeout(() => {
                    setFeedDmDeliveryFx((prev) => (prev ? { ...prev, phase: 'fly' } : null));
                }, 14);
                setTimeout(() => setFeedDmDeliveryFx(null), 4300);
            });
        },
        [measureDmTarget]
    );

    const openDmSheet = useCallback((handle: string, postId: string) => {
        setDmSheetRecipientHandle(handle);
        setDmSheetAnchorPostId(postId);
        setDmSheetMessage('');
        setDmSheetOpen(true);
    }, []);

    const sendDmFromSheet = useCallback(() => {
        const text = dmSheetMessage.trim();
        if (!text || !user?.handle || !dmSheetRecipientHandle) return;
        const recipient = dmSheetRecipientHandle;
        const anchorId = dmSheetAnchorPostId;
        appendMessage(user.handle, recipient, { text, sourcePostId: anchorId ?? undefined })
            .then(() => {
                setDmSheetMessage('');
                setDmSheetOpen(false);
                setDmSheetRecipientHandle(null);
                setDmSheetAnchorPostId(null);
                setTimeout(() => startFeedDmDeliveryFx(recipient, anchorId), 50);
            })
            .catch((err) => console.error('Send DM failed:', err));
    }, [dmSheetMessage, user?.handle, dmSheetRecipientHandle, dmSheetAnchorPostId, startFeedDmDeliveryFx]);

    const isVisitorInCustomLocation = useMemo(() => {
        if (!customLocation || !user) return false;
        const loc = customLocation.trim().toLowerCase();
        const local = (user.local || '').trim().toLowerCase();
        const regional = (user.regional || '').trim().toLowerCase();
        const national = (user.national || '').trim().toLowerCase();
        return loc !== '' && loc !== local && loc !== regional && loc !== national;
    }, [customLocation, user?.local, user?.regional, user?.national]);

    const scrollToFeedPost = React.useCallback(
        (postId: string) => {
            const idx = flatForRender.findIndex(
                (row) => row.kind === 'post' && String(row.post.id) === String(postId),
            );
            if (idx >= 0) {
                flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
            }
        },
        [flatForRender],
    );

    const handleSuggestedCardFollow = React.useCallback(
        async (post: Post) => {
            if (!user) return;
            try {
                const updated = await toggleFollowForPost(userId, post.id, post.userHandle, user.handle);
                const isFollowRequested = Boolean(
                    !updated.isFollowing &&
                        user.handle &&
                        isProfilePrivate(post.userHandle) &&
                        hasPendingFollowRequest(user.handle, post.userHandle),
                );
                setPages((prev) =>
                    prev.map((page) =>
                        page.map((p) =>
                            p.id === post.id ? ({ ...updated, isFollowRequested } as Post) : p,
                        ),
                    ),
                );
            } catch (err) {
                console.error('Follow from suggestion card failed:', err);
            }
        },
        [user, userId],
    );

    // Memoize renderItem to prevent recreation on every render
    const renderItem = React.useCallback(
        ({ item }: { item: FeedListRow }) => {
            const wrapRow = (row: React.ReactElement) => (
                <View collapsable={false}>{row}</View>
            );
            if (item.kind === 'suggested_follower') {
                const sug = item.suggestion;
                return wrapRow(
                    <SuggestedFollowerFeedCard
                        suggestion={sug}
                        onFollow={async (post) => {
                            if (!user) return;
                            try {
                                const updated = await toggleFollowForPost(
                                    userId,
                                    post.id,
                                    post.userHandle,
                                    user?.handle,
                                );
                                const isFollowRequested = Boolean(
                                    !updated.isFollowing &&
                                        user?.handle &&
                                        isProfilePrivate(post.userHandle) &&
                                        hasPendingFollowRequest(user.handle, post.userHandle),
                                );
                                setPages((prev) =>
                                    prev.map((page) =>
                                        page.map((p) =>
                                            p.id === post.id
                                                ? ({ ...updated, isFollowRequested } as Post)
                                                : p,
                                        ),
                                    ),
                                );
                            } catch (err) {
                                console.error('Follow from suggested card failed:', err);
                            }
                        }}
                        onDismiss={() => {
                            void AsyncStorage.setItem(SUGGESTED_FOLLOWER_DISMISSED_KEY, '1');
                            setSuggestedFollowerDismissed(true);
                        }}
                        onNotInterested={() => {
                            const key = String(sug.userHandle || '').trim().toLowerCase();
                            setHiddenFollowerHandles((prev) => {
                                const next = new Set(prev);
                                next.add(key);
                                void AsyncStorage.setItem(
                                    SUGGESTED_FOLLOWER_HIDDEN_HANDLES_KEY,
                                    JSON.stringify([...next]),
                                );
                                return next;
                            });
                        }}
                        onOpenProfile={(handle) => navigation.navigate('ViewProfile', { handle })}
                    />,
                );
            }
            if (item.kind === 'stories24') {
                return wrapRow(
                    <Stories24FeedRail
                        ref={stories24RailRef}
                        items={stories24Items}
                        previewVideosPaused={false}
                        onOpenStory={openStoryFromRail}
                        onAddYours={() => navigation.navigate('Clip')}
                        onScrollCardIntoView={scrollStories24RailIntoView}
                        collapsePayload={stories24CollapsePayload}
                        onCollapseHandled={() => setStories24CollapsePayload(null)}
                    />,
                );
            }
            if (item.kind === 'interests') {
                return wrapRow(
                    <InterestsFeedCard
                        selected={interestsDraft}
                        saving={interestsSaving}
                        onToggle={(interest) => {
                            setInterestsDraft((prev) => {
                                const next = prev.includes(interest)
                                    ? prev.filter((i) => i !== interest)
                                    : prev.length < MAX_INTEREST_SELECTIONS
                                      ? [...prev, interest]
                                      : prev;
                                if (next.length === MAX_INTEREST_SELECTIONS) {
                                    saveInterests(next);
                                }
                                return next;
                            });
                        }}
                        onSave={() => {
                            if (!interestsDraft.length) return;
                            setInterestsSaving(true);
                            saveInterests(interestsDraft);
                            setInterestsSaving(false);
                        }}
                        onSkip={() => {
                            void AsyncStorage.setItem(INTERESTS_ONBOARDING_DISMISSED_KEY, '1');
                            setInterestsCardDismissed(true);
                        }}
                    />,
                );
            }
            if (item.kind === 'ad') {
                const ad = item.ad;
                return wrapRow(
                    <FeedAdCard
                        ad={ad}
                        onImpression={async () => {
                            try {
                                await trackAdImpression(ad.id, userId);
                            } catch (err) {
                                console.error('Error tracking ad impression:', err);
                            }
                        }}
                        onClick={async () => {
                            try {
                                await trackAdClick(ad.id, userId);
                            } catch (err) {
                                console.error('Error tracking ad click:', err);
                            }
                        }}
                    />,
                );
            }
            if (item.kind === 'local_business') {
                return wrapRow(
                    <LocalBusinessSuggestionCard
                        posts={item.posts}
                        userLocal={user?.local}
                        useMockBusinesses={Boolean(item.useMockPreview)}
                        pinnedPaidPostId={item.pinnedPaidPostId}
                        viewerHandle={user?.handle ?? null}
                        onFollowPost={handleSuggestedCardFollow}
                        onHideBusiness={(key) => {
                            void hideBusinessSuggestion(key);
                            setHiddenBusinesses((prev) => new Set([...prev, key]));
                        }}
                        onUnhideBusiness={(key) => {
                            void unhideBusinessSuggestion(key);
                            setHiddenBusinesses((prev) => {
                                const next = new Set(prev);
                                next.delete(key);
                                return next;
                            });
                        }}
                        onLikeBusiness={(key) => {
                            void likeBusinessSuggestion(key);
                            setLikedBusinesses((prev) => new Set([...prev, key]));
                        }}
                        onOpenProfile={(handle) => navigation.navigate('ViewProfile', { handle })}
                        onScrollToPost={scrollToFeedPost}
                        onStripShown={() => {
                            void markBusinessStripInserted().then(() => setBusinessStripEligible(false));
                        }}
                    />,
                );
            }
            if (item.kind === 'suggested_places') {
                return wrapRow(
                    <SuggestedPlacesFeedSection
                        bundleKey={item.bundleKey}
                        suggestions={item.suggestions}
                        viewerHandle={user?.handle ?? null}
                        includePosterLocale={suggestedPlacesPrefs.includePosterLocale}
                        onFollowPost={handleSuggestedCardFollow}
                        onOpenProfile={(handle) => navigation.navigate('ViewProfile', { handle })}
                        onScrollToPost={scrollToFeedPost}
                        onAdjust={() => navigation.navigate('ContentPreferences')}
                    />,
                );
            }
            if (item.kind !== 'post') {
                return null;
            }
            const post = item.post;
            const mergedPost: Post = {
                ...post,
                isBookmarked: savedByPostId[post.id] ?? post.isBookmarked,
            };
            const isPendingUpload =
                mergedPost.clientUploadStatus === 'uploading' ||
                mergedPost.clientUploadStatus === 'failed';
            const isVideoPostRow = postHasVideoMedia(mergedPost);
            return wrapRow(
                <FeedCard
                    key={mergedPost.id}
                    post={mergedPost}
                    isVideoActive={
                        isFeedFocused && isVideoPostRow && !commentsModalOpen
                    }
                    feedVideoMuted={feedVideoMuted}
                    suspendNativeVideo={commentsModalOpen}
                    onLike={async () => {
                        if (isPendingUpload) return;
                        const updated = await toggleLike(userId, mergedPost.id, mergedPost);
                        setPages((prev) =>
                            prev.map((page) => page.map((p) => (p.id === mergedPost.id ? updated : p)))
                        );
                    }}
                    onFollow={async () => {
                        if (isPendingUpload || !user) return;
                        try {
                            const updated = await toggleFollowForPost(
                                userId,
                                mergedPost.id,
                                mergedPost.userHandle,
                                user.handle,
                            );
                            const isFollowRequested = Boolean(
                                !updated.isFollowing &&
                                    user.handle &&
                                    isProfilePrivate(mergedPost.userHandle) &&
                                    hasPendingFollowRequest(user.handle, mergedPost.userHandle),
                            );
                            setPages((prev) =>
                                prev.map((page) =>
                                    page.map((p) =>
                                        p.id === mergedPost.id
                                            ? ({ ...updated, isFollowRequested } as Post)
                                            : p,
                                    ),
                                ),
                            );
                        } catch (err) {
                            console.error('Error toggling follow in FeedScreen:', err);
                            setPages((prev) =>
                                prev.map((page) =>
                                    page.map((p) =>
                                        p.id === mergedPost.id ? { ...p, isFollowing: !p.isFollowing } : p
                                    )
                                )
                            );
                        }
                        if (showFollowingFeed || currentFilter.toLowerCase() === 'discover') {
                            setReloadTick((t) => t + 1);
                        }
                    }}
                    onView={async () => {
                        if (isPendingUpload) return;
                        await incrementViews(userId, mergedPost.id);
                    }}
                    onComment={() => {
                        if (isPendingUpload) return;
                        setSelectedPostId(mergedPost.id);
                        setSelectedPostForComments(mergedPost);
                        setCommentsModalOpen(true);
                    }}
                    onShare={async () => {
                        if (isPendingUpload) return;
                        await openShareForPost(mergedPost);
                    }}
                    onReclip={async () => {
                        if (isPendingUpload) return;
                        await tryReclipPost(mergedPost);
                    }}
                    onBookmark={async () => {
                        if (isPendingUpload) return;
                        setSaveModalPost(mergedPost);
                    }}
                    onOverflowPress={() => {
                        if (isPendingUpload) {
                            if (mergedPost.clientUploadStatus === 'failed') {
                                dismissPendingFeedUpload(mergedPost.id);
                            }
                            return;
                        }
                        setOverflowPost(mergedPost);
                        setOverflowVisible(true);
                    }}
                    onOpenImageFullscreen={(startIndex = 0, origin = null) => {
                        if (isPendingUpload) return;
                        setImageFullscreenStartIndex(startIndex);
                        setImageFullscreenOrigin(origin);
                        setImageFullscreenPost(mergedPost);
                    }}
                    onOpenScenes={() => {
                        if (isPendingUpload) return;
                        scenesReturnScrollYRef.current = feedScrollYRef.current;
                        const handoff = peekFeedVideoHandoff(mergedPost.id);
                        const scenesFeedLabel = showFollowingFeed
                            ? 'Following'
                            : String(active || user?.national || 'Ireland');
                        const scenesPosts = videoPostsForScenes.some((p) => p.id === mergedPost.id)
                            ? videoPostsForScenes
                            : [mergedPost, ...videoPostsForScenes];
                        navigation.navigate('Scenes', {
                            initialPostId: mergedPost.id,
                            posts: scenesPosts,
                            initialVideoTime: handoff?.currentTime,
                            initialMuted: handoff?.muted ?? feedVideoMuted,
                            feedLabel: scenesFeedLabel,
                        });
                    }}
                    onPostPress={() => {
                        if (isPendingUpload) {
                            if (mergedPost.clientUploadStatus === 'failed') {
                                dismissPendingFeedUpload(mergedPost.id);
                            }
                            return;
                        }
                        navigation.navigate('PostDetail', { postId: mergedPost.id });
                    }}
                    onVisitProfile={() =>
                        navigation.navigate('ViewProfile', {
                            handle: mergedPost.userHandle,
                            sourcePostId: mergedPost.id,
                        })
                    }
                    onVisitHandle={(handle) =>
                        navigation.navigate('ViewProfile', {
                            handle,
                            sourcePostId: mergedPost.id,
                        })
                    }
                    onViewStories={() =>
                        navigation.navigate('Stories', { openUserHandle: mergedPost.userHandle })
                    }
                    onBlockUser={async () => {
                        if (!user?.handle) return;
                        Alert.alert('Block user?', `Hide ${mergedPost.userHandle} from your feed?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Block',
                                style: 'destructive',
                                onPress: async () => {
                                    await blockUser(user.handle, mergedPost.userHandle);
                                    await blockFeedAuthorMobile(userId, mergedPost.userHandle);
                                    feedContentPrefsRef.current.blockedHandles.add(
                                        String(mergedPost.userHandle || '').replace(/^@/, '').trim().toLowerCase(),
                                    );
                                    hideUserFromFeed(mergedPost.userHandle);
                                    Alert.alert(
                                        'Blocked',
                                        `${mergedPost.userHandle} was blocked and removed from your feed.`
                                    );
                                },
                            },
                        ]);
                    }}
                    onReportUser={async () => {
                        const { promptReportPostNative } = await import('../utils/promptReportPostNative');
                        promptReportPostNative(mergedPost.id);
                    }}
                    onShareSuccess={handleShareToStoriesSuccess}
                    isCurrentUser={user?.handle === mergedPost.userHandle}
                    viewerHandle={user?.handle}
                    viewerUserId={userId}
                    onOpenDM={user?.handle ? openDmSheet : undefined}
                    onRegisterDmAnchor={registerDmAnchor}
                    onOpenLikesSheet={() => setLikesSheetPost(mergedPost)}
                    onOpenTaggedSheet={() => setTaggedSheetPost(mergedPost)}
                />,
            );
        },
        [
            userId,
            user,
            active,
            showFollowingFeed,
            currentFilter,
            navigation,
            handleShareToStoriesSuccess,
            updatePost,
            loadMore,
            savedByPostId,
            openShareForPost,
            tryReclipPost,
            toggleCollectionsSaveForPost,
            hideUserFromFeed,
            isFeedFocused,
            feedVideoMuted,
            commentsModalOpen,
            pendingUploadTick,
            videoPostsForScenes,
            interestsDraft,
            interestsSaving,
            saveInterests,
            stories24Items,
            openStoryFromRail,
            scrollStories24RailIntoView,
            stories24CollapsePayload,
        ]
    );

    const syncFullscreenPost = React.useCallback((updated: Post) => {
        setImageFullscreenPost((prev) => (prev?.id === updated.id ? updated : prev));
        setSelectedPostForComments((prev) => (prev?.id === updated.id ? updated : prev));
    }, []);

    const closeCommentsSheet = React.useCallback(() => {
        setCommentsModalOpen(false);
        setSelectedPostId(null);
        setSelectedPostForComments(null);
    }, []);

    return (
        <View style={styles.container}>
            <FeedPageLayout
                online={online}
                error={error}
                onRetry={() => {
                    setError(null);
                    void reloadFeedFromStartRef.current();
                }}
                header={
                    <PillTabs
                        active={showFollowingFeed && !customLocation ? 'Following' : active}
                        onChange={handleTabChange}
                        customLocation={customLocation}
                        customLocationLabel={customLocationLabel}
                        customLocationPlaceId={customLocationPlaceId}
                        customFilterType={customFilterType}
                        userLocal={defaultLocal}
                        userRegional={defaultRegional}
                        userNational={defaultNational}
                        hasNotifications={hasInbox || unreadCount > 0}
                        onOpenStories24={openStories24FromHeader}
                        onOpenPassport={() => navigation.navigate('Profile')}
                        onOpenDiscover={() => navigation.navigate('Discover')}
                        onSearchLocation={handleHeaderLocationSearch}
                        onHeaderPlacePick={handleHeaderPlacePick}
                        onClearCustom={clearCustomLocation}
                    />
                }
            >
            <View style={styles.feedListShell}>
            <FlatList
                ref={flatListRef}
                style={styles.feedList}
                data={flatForRender}
                renderItem={renderItem}
                keyExtractor={(item, index) => {
                    const baseKey =
                        item.kind === 'interests' || item.kind === 'stories24'
                            ? item.id
                            : item.kind === 'suggested_follower'
                              ? `suggested-follower-${item.suggestion.userHandle}`
                              : item.kind === 'ad'
                                ? `ad-${item.ad.id}`
                                : item.kind === 'local_business'
                                  ? `local-business-${item.posts.map((p) => p.id).join('-')}`
                                  : item.kind === 'suggested_places'
                                    ? `suggested-places-${item.bundleKey}`
                                    : item.post.id;
                    if (item.kind === 'post') {
                        return `post:${baseKey}`;
                    }
                    return `${item.kind}:${baseKey}:${index}`;
                }}
                extraData={`${pendingUploadTick}-${refreshing}-${commentsModalOpen}-${isFeedFocused}`}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfigRef.current}
                // Performance — fewer offscreen mounts; clip offscreen rows now that only
                // the active card mounts a native Video surface.
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={7}
                updateCellsBatchingPeriod={80}
                removeClippedSubviews={false}
                onScrollBeginDrag={() => {
                    feedScrollingRef.current = true;
                    setFeedScrollBusy(true);
                    if (feedScrollIdleTimerRef.current) {
                        clearTimeout(feedScrollIdleTimerRef.current);
                        feedScrollIdleTimerRef.current = null;
                    }
                }}
                onMomentumScrollBegin={() => {
                    if (feedScrollIdleTimerRef.current) {
                        clearTimeout(feedScrollIdleTimerRef.current);
                        feedScrollIdleTimerRef.current = null;
                    }
                    feedScrollingRef.current = true;
                    setFeedScrollBusy(true);
                }}
                onMomentumScrollEnd={() => {
                    feedScrollingRef.current = false;
                    if (feedScrollIdleTimerRef.current) clearTimeout(feedScrollIdleTimerRef.current);
                    feedScrollIdleTimerRef.current = setTimeout(() => {
                        setFeedScrollBusy(false);
                        if (feedAutoplayAllowedRef.current && lastViewableVideoPostIdRef.current) {
                            scheduleActiveFeedVideoRef.current(lastViewableVideoPostIdRef.current);
                        }
                    }, 64);
                }}
                onScrollEndDrag={(e) => {
                    feedScrollYRef.current = e.nativeEvent.contentOffset.y;
                    if (feedScrollIdleTimerRef.current) clearTimeout(feedScrollIdleTimerRef.current);
                    feedScrollIdleTimerRef.current = setTimeout(() => {
                        feedScrollingRef.current = false;
                        setFeedScrollBusy(false);
                        if (feedAutoplayAllowedRef.current && lastViewableVideoPostIdRef.current) {
                            scheduleActiveFeedVideoRef.current(lastViewableVideoPostIdRef.current);
                        }
                    }, 120);
                }}
                // Scroll performance
                onScroll={(e) => {
                    feedScrollYRef.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={32}
                decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.985}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                        tintColor="#FFFFFF"
                        colors={['#FFFFFF']}
                        progressBackgroundColor="#030712"
                        progressViewOffset={Platform.OS === 'android' ? 12 : 0}
                    />
                }
                onEndReached={() => {
                    if (!initialLoading && !loadingMore && !end) {
                        loadMore();
                    }
                }}
                onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToOffset({
                        offset: Math.max(0, info.averageItemLength * info.index),
                        animated: true,
                    });
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loadingMore ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#8B5CF6" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    error && flatForRender.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyFeedTitle}>Could not load feed</Text>
                            <Text style={styles.emptyFeedSubtitle}>{error}</Text>
                            <TouchableOpacity style={styles.emptyFeedSecondaryBtn} onPress={retryFeedLoad}>
                                <Text style={styles.emptyFeedSecondaryBtnText}>Try again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : flatForRender.length === 0 && (initialLoading || !end) ? (
                        <FeedPostSkeleton count={2} />
                    ) : end && flatForRender.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            {customLocation ? (
                                <View style={styles.emptyDefaultWrap}>
                                    <View style={FEED_EMPTY_CARD}>
                                        <Text style={FEED_EMPTY_BADGE}>
                                            {isVisitorInCustomLocation ? "You're early to this feed" : 'Your home feed'}
                                        </Text>
                                        <Text style={FEED_EMPTY_TITLE}>
                                            {isVisitorInCustomLocation
                                                ? `No locals are posting in ${customLocationDisplay} yet`
                                                : `No posts in your ${customLocationDisplay} feed yet`}
                                        </Text>
                                        <Text style={FEED_EMPTY_SUBTITLE}>
                                            {isVisitorInCustomLocation
                                                ? `We'll light up this feed once people in ${customLocationDisplay} start sharing.`
                                                : 'You can be the first to post here. Share what\'s happening around you to start this feed.'}
                                        </Text>
                                        {isVisitorInCustomLocation ? (
                                            <View style={styles.emptyCustomActions}>
                                                <TouchableOpacity
                                                    activeOpacity={0.85}
                                                    onPress={toggleNotifyForCurrentLocation}
                                                    style={styles.emptyNotifyBtnWrap}
                                                >
                                                    {isNotifyOnForCurrentLocation ? (
                                                        <View
                                                            style={[
                                                                FEED_EMPTY_GRADIENT_BTN,
                                                                styles.emptyFeedNotifyBtnActive,
                                                            ]}
                                                        >
                                                            <Text style={styles.emptyFeedNotifyBtnTextActive}>
                                                                You&apos;ll be notified
                                                            </Text>
                                                        </View>
                                                    ) : (
                                                        <LinearGradient
                                                            colors={[...FEED_EMPTY_NOTIFY_GRADIENT]}
                                                            start={{ x: 0, y: 0.5 }}
                                                            end={{ x: 1, y: 0.5 }}
                                                            style={FEED_EMPTY_GRADIENT_BTN}
                                                        >
                                                            <Text style={styles.emptyFeedNotifyBtnText}>
                                                                {`Notify me when ${customLocationDisplay} wakes up`}
                                                            </Text>
                                                        </LinearGradient>
                                                    )}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.emptyFeedSecondaryBtn}
                                                    onPress={clearCustomLocation}
                                                >
                                                    <Text style={styles.emptyFeedSecondaryBtnText}>Back to your home feed</Text>
                                                </TouchableOpacity>
                                                <Text style={styles.emptyFeedNotifyHint}>
                                                    Feed warming up · we&apos;ll only ping you when real clips from{' '}
                                                    {customLocationDisplay} start to appear.
                                                </Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => navigation.navigate('CreateComposer')}
                                            >
                                                <LinearGradient
                                                    colors={[...FEED_EMPTY_CREATE_GRADIENT]}
                                                    start={{ x: 0, y: 0.5 }}
                                                    end={{ x: 1, y: 0.5 }}
                                                    style={FEED_EMPTY_GRADIENT_BTN}
                                                >
                                                    <Text style={FEED_EMPTY_GRADIENT_BTN_TEXT}>
                                                        Create a clip in this feed
                                                    </Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <LocationPlaceSummaryCard
                                        locationLabel={customLocationDisplay || customLocation}
                                        placeId={customLocationPlaceId}
                                    />
                                </View>
                            ) : (
                                <View style={styles.emptyDefaultWrap}>
                                    {showFollowingFeed || String(currentFilter).toLowerCase() === 'discover' ? (
                                        <View style={FEED_EMPTY_CARD}>
                                            <Text style={FEED_EMPTY_FOLLOWING_TITLE}>
                                                Unlock Your Following News Feed
                                            </Text>
                                            <Text style={FEED_EMPTY_FOLLOWING_SUBTITLE}>
                                                This feed only populates with the accounts you follow. Start
                                                tapping Follow to personalize your stream.
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={FEED_EMPTY_CARD}>
                                            <Text style={FEED_EMPTY_BADGE}>Your home feed</Text>
                                            <Text style={FEED_EMPTY_TITLE}>
                                                {currentFilter
                                                    ? `No posts in your ${currentFilter} feed yet`
                                                    : 'No posts yet'}
                                            </Text>
                                            <Text style={FEED_EMPTY_SUBTITLE}>
                                                You can be the first to post here. Share what&apos;s happening
                                                around you to start this feed.
                                            </Text>
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => navigation.navigate('CreateComposer')}
                                            >
                                                <LinearGradient
                                                    colors={[...FEED_EMPTY_CREATE_GRADIENT]}
                                                    start={{ x: 0, y: 0.5 }}
                                                    end={{ x: 1, y: 0.5 }}
                                                    style={FEED_EMPTY_GRADIENT_BTN}
                                                >
                                                    <Text style={FEED_EMPTY_GRADIENT_BTN_TEXT}>
                                                        Create a clip in this feed
                                                    </Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    ) : null
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.feedListContent,
                    {
                        paddingBottom: Math.max(insets.bottom, 8) + 12,
                    },
                ]}
            />
            </View>
            </FeedPageLayout>

            <ImageFullscreenModal
                post={imageFullscreenPost}
                visible={Boolean(imageFullscreenPost)}
                initialIndex={imageFullscreenStartIndex}
                originRect={imageFullscreenOrigin}
                onClose={() => {
                    setImageFullscreenPost(null);
                    setImageFullscreenStartIndex(0);
                    setImageFullscreenOrigin(null);
                }}
                onLike={
                    imageFullscreenPost
                        ? async () => {
                              const updated = await toggleLike(userId, imageFullscreenPost.id, imageFullscreenPost);
                              setPages((prev) =>
                                  prev.map((page) =>
                                      page.map((p) => (p.id === updated.id ? updated : p)),
                                  ),
                              );
                              syncFullscreenPost(updated);
                          }
                        : undefined
                }
                onComment={
                    imageFullscreenPost
                        ? () => {
                              setSelectedPostId(imageFullscreenPost.id);
                              setSelectedPostForComments(imageFullscreenPost);
                              setCommentsModalOpen(true);
                          }
                        : undefined
                }
                onReclip={
                    imageFullscreenPost
                        ? async () => {
                              await tryReclipPost(imageFullscreenPost);
                              const refreshed = flat.find((p) => p.id === imageFullscreenPost.id);
                              if (refreshed) syncFullscreenPost(refreshed);
                          }
                        : undefined
                }
                onShare={
                    imageFullscreenPost
                        ? () => {
                              void openShareForPost(imageFullscreenPost);
                          }
                        : undefined
                }
                onFollow={
                    imageFullscreenPost &&
                    user?.handle &&
                    imageFullscreenPost.userHandle !== user.handle
                        ? async () => {
                              const updated = await toggleFollowForPost(
                                  userId,
                                  imageFullscreenPost.id,
                                  imageFullscreenPost.userHandle,
                                  user.handle,
                              );
                              setPages((prev) =>
                                  prev.map((page) =>
                                      page.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
                                  ),
                              );
                              syncFullscreenPost({ ...imageFullscreenPost, ...updated });
                          }
                        : undefined
                }
                onVisitProfile={
                    imageFullscreenPost
                        ? () => {
                              const handle = imageFullscreenPost.userHandle;
                              const sourcePostId = imageFullscreenPost.id;
                              setImageFullscreenPost(null);
                              setImageFullscreenStartIndex(0);
                              setImageFullscreenOrigin(null);
                              navigation.navigate('ViewProfile', {
                                  handle,
                                  sourcePostId,
                              });
                          }
                        : undefined
                }
                onMenu={
                    imageFullscreenPost
                        ? () => {
                              setOverflowPost(imageFullscreenPost);
                              setOverflowVisible(true);
                          }
                        : undefined
                }
            />

            {commentsModalOpen && selectedPostId ? (
                <Modal
                    visible
                    transparent
                    animationType="slide"
                    statusBarTranslucent
                    onRequestClose={closeCommentsSheet}
                >
                    <View style={styles.fullscreenOverlayRoot}>
                        <Pressable
                            style={styles.fullscreenOverlayBackdrop}
                            onPress={closeCommentsSheet}
                            accessibilityLabel="Dismiss comments"
                        />
                        <View style={styles.fullscreenCommentsSheet}>
                            <PostCommentsSheet
                                variant="scenesEmbed"
                                postId={selectedPostId}
                                post={selectedPostForComments}
                                isOpen={commentsModalOpen}
                                commentAuthorHandle={user?.handle ?? ''}
                                currentUserHandle={user?.handle}
                                onAfterClose={() => {
                                    const pid = selectedPostId;
                                    if (!pid) return;
                                    fetchComments(pid)
                                        .then((list) =>
                                            updatePost(pid, (p) => ({
                                                ...p,
                                                stats: { ...p.stats, comments: list.length },
                                            })),
                                        )
                                        .catch(() => {});
                                }}
                                onClose={closeCommentsSheet}
                            />
                        </View>
                    </View>
                </Modal>
            ) : null}

            {likesSheetPost && likesSheetPost.stats.likes > 0 ? (
                <FeedLikesSheet
                    visible={true}
                    postId={String(likesSheetPost.id)}
                    userId={userId}
                    viewerHandle={user?.handle}
                    likeCount={likesSheetPost.stats.likes}
                    viewCount={likesSheetPost.stats.views}
                    onClose={() => setLikesSheetPost(null)}
                    onVisitProfile={(handle) =>
                        navigation.navigate('ViewProfile', { handle })
                    }
                />
            ) : null}

            {taggedSheetPost?.taggedUsers && taggedSheetPost.taggedUsers.length > 0 ? (
                <TaggedUsersBottomSheet
                    visible={true}
                    taggedUserHandles={taggedSheetPost.taggedUsers}
                    onClose={() => setTaggedSheetPost(null)}
                    onVisitProfile={(handle) =>
                        navigation.navigate('ViewProfile', { handle })
                    }
                />
            ) : null}

            {shareModalOpen && selectedPostForShare ? (
                <FeedShareModal
                    post={selectedPostForShare}
                    isOpen
                    onClose={() => {
                        setShareModalOpen(false);
                        setSelectedPostForShare(null);
                    }}
                    onShareSuccess={handleShareToStoriesSuccess}
                />
            ) : null}

            <GazetteerAlertSheet
                visible={reclipConfirmPost != null}
                title="Reshare this to followers?"
                message="This post will be shared to your followers in their Following feed."
                icon="alert"
                showCancelButton
                confirmButtonText="OK"
                cancelButtonText="Cancel"
                onConfirm={() => {
                    void confirmReclipPost();
                }}
                onDismiss={() => setReclipConfirmPost(null)}
            />

            <GazetteerAlertSheet
                visible={feedGazetteerAlert != null}
                title={feedGazetteerAlert?.title || ''}
                message={feedGazetteerAlert?.message}
                icon={feedGazetteerAlert?.icon || 'alert'}
                confirmButtonText="OK"
                onConfirm={() => setFeedGazetteerAlert(null)}
                onDismiss={() => setFeedGazetteerAlert(null)}
            />

            {dmSheetOpen && dmSheetRecipientHandle ? (
                <FeedDmSheet
                    open={dmSheetOpen}
                    recipientHandle={dmSheetRecipientHandle}
                    message={dmSheetMessage}
                    onChangeMessage={setDmSheetMessage}
                    onClose={() => {
                        setDmSheetOpen(false);
                        setDmSheetRecipientHandle(null);
                        setDmSheetAnchorPostId(null);
                        setDmSheetMessage('');
                    }}
                    onSend={sendDmFromSheet}
                />
            ) : null}

            <FeedDmDeliveryFx fx={feedDmDeliveryFx} />

            {headerScopePicker ? (
                <PlaceFeedScopePickerModal
                    visible
                    suggestion={headerScopePicker}
                    onClose={() => setHeaderScopePicker(null)}
                    onSelectScope={(scope) => {
                        applyCustomLocationFeed(
                            resolvePlaceFeedSelection(headerScopePicker, scope),
                            headerScopePickerKind
                        );
                        setHeaderScopePicker(null);
                    }}
                />
            ) : null}

            {overflowVisible && overflowPost ? (
            <PostOverflowMenuModal
                visible
                post={overflowPost}
                viewerUserId={userId}
                viewerHandle={user?.handle}
                isSaved={overflowSaved}
                hasNotifications={overflowNotify}
                onClose={() => {
                    setOverflowVisible(false);
                    setOverflowPost(null);
                }}
                onShare={async () => {
                    if (!overflowPost) return;
                    await openShareForPost(overflowPost);
                }}
                onOpenSave={() => {
                    if (!overflowPost) return;
                    setSaveModalPost(overflowPost);
                }}
                onSaveToggle={async () => {
                    if (!overflowPost) return;
                    await toggleCollectionsSaveForPost(overflowPost);
                    const cols = await getCollectionsForPost(userId, overflowPost.id);
                    setOverflowSaved(cols.length > 0);
                }}
                onCreateGroup={
                    overflowPost &&
                    user?.handle &&
                    overflowPost.userHandle.replace(/^@/, '').trim().toLowerCase() ===
                        user.handle.replace(/^@/, '').trim().toLowerCase()
                        ? () => setCreateGroupOpen(true)
                        : undefined
                }
                onInviteToGroup={
                    overflowPost &&
                    user?.handle &&
                    overflowPost.userHandle.replace(/^@/, '').trim().toLowerCase() !==
                        user.handle.replace(/^@/, '').trim().toLowerCase()
                        ? () => setInviteGroupHandle(overflowPost.userHandle)
                        : undefined
                }
                onShowQRCode={
                    overflowPost ? () => setQrPost(overflowPost) : undefined
                }
                onBoost={() => {
                    setShowBoostPrompt(true);
                }}
                onArchive={async () => {
                    if (!overflowPost) return;
                    await markFeedPostArchivedMobile(userId, overflowPost.id);
                    removePostFromFeed(overflowPost.id);
                }}
                onToggleNotifications={async () => {
                    if (!overflowPost) return;
                    const next = !overflowNotify;
                    await setPostNotificationsPrefMobile(userId, overflowPost.id, next);
                    setOverflowNotify(next);
                }}
                onReclip={async () => {
                    if (!overflowPost) return;
                    await tryReclipPost(overflowPost);
                }}
                isFollowing={!!overflowPost?.isFollowing}
                onEdit={() => {
                    if (!overflowPost) return;
                    setEditPost(overflowPost);
                }}
                onUnfollow={async () => {
                    if (!overflowPost || !userId) return;
                    const updated = await toggleFollowForPost(
                        userId,
                        overflowPost.id,
                        overflowPost.userHandle,
                        user?.handle,
                    );
                    updatePost(overflowPost.id, (p) => ({
                        ...p,
                        isFollowing: updated?.isFollowing ?? !p.isFollowing,
                    }));
                }}
                onMute={async () => {
                    if (!overflowPost) return;
                    hideUserFromFeed(overflowPost.userHandle);
                    Alert.alert('Muted', `${overflowPost.userHandle} was muted and hidden from your feed.`);
                }}
                onHide={() => {
                    if (!overflowPost) return;
                    hidePostFromFeed(overflowPost.id);
                }}
                onNotInterested={() => {
                    if (!overflowPost) return;
                    markPostNotInterested(overflowPost.id);
                }}
                onDelete={() =>
                    new Promise<void>((resolve) => {
                        if (!overflowPost || !user?.handle) {
                            resolve();
                            return;
                        }
                        const targetId = overflowPost.id;
                        const handleVal = user.handle;
                        Alert.alert('Delete post?', 'This cannot be undone.', [
                            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => {
                                    void (async () => {
                                        try {
                                            await deletePost(userId, targetId, handleVal);
                                            removePostFromFeed(targetId);
                                        } catch (e) {
                                            console.error('Delete post failed:', e);
                                            Alert.alert('Error', 'Could not delete this post.');
                                        } finally {
                                            resolve();
                                        }
                                    })();
                                },
                            },
                        ]);
                    })
                }
                onReport={async () => {
                    if (!overflowPost) return;
                    const { promptReportPostNative } = await import('../utils/promptReportPostNative');
                    promptReportPostNative(overflowPost.id, () => setOverflowVisible(false));
                }}
                onBlock={() =>
                    new Promise<void>((resolve) => {
                        if (!overflowPost || !user?.handle) {
                            resolve();
                            return;
                        }
                        const blockedHandle = overflowPost.userHandle;
                        Alert.alert('Block user?', `Hide ${blockedHandle} from your feed?`, [
                            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
                            {
                                text: 'Block',
                                style: 'destructive',
                                onPress: () => {
                                    void (async () => {
                                        await blockUser(user.handle, blockedHandle);
                                        await blockFeedAuthorMobile(userId, blockedHandle);
                                        hideUserFromFeed(blockedHandle);
                                        Alert.alert(
                                            'Blocked',
                                            `${blockedHandle} was blocked and removed from your feed.`
                                        );
                                        resolve();
                                    })();
                                },
                            },
                        ]);
                    })
                }
            />
            ) : null}

            {saveModalPost ? (
                <SavePostModal
                    post={saveModalPost}
                    userId={userId}
                    visible={!!saveModalPost}
                    onClose={() => setSaveModalPost(null)}
                    onSaved={async () => {
                        const cols = await getCollectionsForPost(userId, saveModalPost.id);
                        const saved = cols.length > 0;
                        setSavedByPostId((prev) => ({ ...prev, [saveModalPost.id]: saved }));
                        updatePost(saveModalPost.id, (p) => ({ ...p, isBookmarked: saved }));
                    }}
                />
            ) : null}

            {qrPost ? (
                <QRCodeModal
                    post={qrPost}
                    visible={!!qrPost}
                    onClose={() => setQrPost(null)}
                />
            ) : null}

            {createGroupOpen ? (
                <CreateGroupModal
                    visible
                    onClose={() => setCreateGroupOpen(false)}
                    onCreated={(g) => {
                        setCreateGroupOpen(false);
                        navigation.navigate('Messages', { chatGroupId: g.id, kind: 'group' });
                    }}
                />
            ) : null}

            {inviteGroupHandle ? (
                <PickGroupToInviteFeedUserModal
                    visible
                    inviteeHandle={inviteGroupHandle}
                    onClose={() => setInviteGroupHandle(null)}
                />
            ) : null}

            {editPost ? (
                <EditPostModal
                    post={editPost}
                    visible={!!editPost}
                    onClose={() => setEditPost(null)}
                    onSave={async (text, location, venue, landmark) => {
                        const target = editPost;
                        if (!target) return;
                        const fields = { text, location, venue, landmark };
                        try {
                            await apiUpdatePost(target.id, {
                                text,
                                location,
                                venue: venue || undefined,
                                landmark: landmark || undefined,
                            });
                        } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : '';
                            const offline =
                                msg.includes('Failed to fetch') ||
                                msg.includes('Network') ||
                                msg === 'CONNECTION_REFUSED';
                            if (!offline) throw err;
                        }
                        applyPostEditToFeed(target.id, fields);
                    }}
                />
            ) : null}

            <Modal visible={showBoostPrompt} transparent animationType="fade" onRequestClose={() => setShowBoostPrompt(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.boostPromptCard}>
                        <Text style={styles.boostPromptTitle}>Boost your posts</Text>
                        <Text style={styles.boostPromptText}>Reach more people in local, regional, and national feeds.</Text>
                        <View style={styles.boostPromptActions}>
                            <TouchableOpacity style={styles.boostPromptSecondaryBtn} onPress={() => setShowBoostPrompt(false)}>
                                <Text style={styles.boostPromptSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.boostPromptPrimaryBtn}
                                onPress={() => {
                                    setShowBoostPrompt(false);
                                    navigation.navigate('Boost');
                                }}
                            >
                                <Text style={styles.boostPromptPrimaryText}>Open Boost</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    mediaBurstPortal: {
        ...StyleSheet.absoluteFillObject,
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    container: {
        flex: 1,
        backgroundColor: FEED_PAGE_BG,
    },
    fullscreenOverlayRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    fullscreenOverlayBackdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    fullscreenCommentsSheet: {
        height: Math.round(Dimensions.get('window').height * 0.78),
        backgroundColor: 'transparent',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    feedListShell: {
        flex: 1,
        backgroundColor: FEED_PAGE_BG,
        position: 'relative',
        overflow: 'hidden',
    },
    feedList: {
        flex: 1,
        backgroundColor: FEED_PAGE_BG,
        elevation: 0,
    },
    feedListContent: {
        backgroundColor: FEED_PAGE_BG,
        flexGrow: 1,
    },
    tabContainer: {
        backgroundColor: 'transparent',
    },
    feedHeaderNotifWrap: {
        alignItems: 'center',
    },
    feedHeaderIconGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    feedHeaderPassportAvatarImage: {
        width: '100%',
        height: '100%',
    },
    feedSwitchBadge: {
        position: 'absolute',
        top: 44,
        left: 0,
        right: 0,
        marginTop: ox(10),
        zIndex: 20,
        alignItems: 'center',
    },
    feedSwitchBadgeInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        paddingHorizontal: ox(16),
        paddingVertical: ox(7),
        borderRadius: ox(18),
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        backgroundColor: '#000000',
    },
    feedSwitchBadgeText: {
        color: '#FFFFFF',
        fontSize: ox(13),
        fontWeight: '700',
    },
    feedSwitchBadgeCaret: {
        width: 10,
        height: 10,
        marginBottom: ox(-5),
        backgroundColor: '#000000',
        borderLeftWidth: 1.5,
        borderTopWidth: 1.5,
        borderColor: '#FFFFFF',
        transform: [{ rotate: '45deg' }],
        borderRadius: ox(2),
        zIndex: 1,
    },
    feedSwitchSheetOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    feedSwitchSheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    feedSwitchSheet: {
        alignSelf: 'center',
        backgroundColor: PASSPORT_ABYSS,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        maxHeight: '78%',
        paddingTop: ox(4),
        overflow: 'hidden',
    },
    feedSwitchSheetCanvas: {
        backgroundColor: PASSPORT_ABYSS,
        overflow: 'hidden',
    },
    feedSwitchSheetAmbient: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    feedSwitchSheetContent: {
        position: 'relative',
        zIndex: 1,
        backgroundColor: 'transparent',
    },
    feedSwitchSheetHandle: {
        alignSelf: 'center',
        width: ox(44),
        height: 5,
        borderRadius: ox(3),
        backgroundColor: 'rgba(255,255,255,0.28)',
        marginTop: ox(8),
        marginBottom: ox(6),
    },
    feedSwitchSheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: ox(12),
        minHeight: ox(40),
    },
    feedSwitchSheetHeaderSpacer: {
        flex: 1,
    },
    feedSwitchSheetClose: {
        width: ox(40),
        height: ox(40),
        borderRadius: ox(20),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    feedSwitchSheetGazetteer: {
        textAlign: 'center',
        color: PASSPORT_PALETTE.wavePrimary,
        fontSize: ox(13),
        fontWeight: '700',
        letterSpacing: ox(1.4),
        textTransform: 'uppercase',
        marginBottom: ox(12),
        paddingHorizontal: ox(20),
    },
    feedSwitchSheetTitle: {
        textAlign: 'center',
        color: '#FFFFFF',
        fontSize: ox(24),
        fontWeight: '700',
        paddingHorizontal: ox(20),
    },
    feedSwitchSheetSub: {
        textAlign: 'center',
        color: '#A3A3A3',
        fontSize: ox(15),
        lineHeight: ox(22),
        marginTop: ox(8),
        marginBottom: ox(18),
        paddingHorizontal: ox(20),
    },
    feedSwitchSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: ox(16),
        marginBottom: ox(8),
        paddingHorizontal: ox(14),
        paddingVertical: ox(12),
        borderRadius: ox(999),
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        backgroundColor: 'transparent',
    },
    feedSwitchSearchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: ox(16),
        marginLeft: 10,
        paddingVertical: 0,
        borderWidth: 0,
    },
    feedSwitchSearchHint: {
        marginHorizontal: ox(20),
        marginBottom: ox(10),
        color: 'rgba(255,255,255,0.45)',
        fontSize: ox(12),
    },
    feedSwitchSheetScroll: {
        maxHeight: 360,
    },
    feedSwitchSheetScrollContent: {
        paddingBottom: ox(10),
    },
    feedSwitchSuggestionsWrap: {
        marginHorizontal: ox(16),
        marginBottom: ox(8),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.2)',
        overflow: 'hidden',
    },
    feedSwitchMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        paddingHorizontal: ox(20),
        paddingVertical: ox(16),
        minHeight: ox(52),
    },
    errorContainer: {
        padding: ox(16),
        backgroundColor: '#FEE2E2',
    },
    errorText: {
        color: '#DC2626',
        fontSize: ox(14),
    },
    loadingContainer: {
        padding: ox(20),
        alignItems: 'center',
    },
    emptyContainer: {
        padding: ox(24),
        alignItems: 'stretch',
    },
    emptyDefaultWrap: {
        alignItems: 'center',
        width: '100%',
    },
    emptyCustomActions: {
        width: '100%',
        alignItems: 'stretch',
        gap: ox(12),
    },
    emptyNotifyBtnWrap: {
        width: '100%',
    },
    emptyLoadingText: {
        marginTop: ox(12),
        color: '#9CA3AF',
        fontSize: ox(15),
        textAlign: 'center',
    },
    emptyFeedTitle: {
        fontSize: ox(20),
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: ox(8),
    },
    emptyFeedSubtitle: {
        fontSize: ox(14),
        lineHeight: ox(20),
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: ox(16),
    },
    emptyFeedSecondaryBtn: {
        borderRadius: ox(999),
        paddingHorizontal: ox(20),
        paddingVertical: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
    },
    emptyFeedSecondaryBtnText: {
        color: '#D1D5DB',
        fontSize: ox(14),
        fontWeight: '600',
    },
    emptyFeedNotifyBtnActive: {
        backgroundColor: '#16A34A',
        width: '100%',
    },
    emptyFeedNotifyBtnText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyFeedNotifyBtnTextActive: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyFeedNotifyHint: {
        marginTop: ox(12),
        fontSize: ox(11),
        lineHeight: ox(16),
        color: '#6B7280',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    boostPromptCard: {
        margin: ox(24),
        borderRadius: ox(14),
        padding: ox(16),
        gap: ox(10),
        ...glassPanel,
    },
    boostPromptTitle: {
        color: '#FFFFFF',
        fontSize: ox(18),
        fontWeight: '800',
    },
    boostPromptText: {
        color: '#D1D5DB',
        fontSize: ox(13),
        lineHeight: ox(18),
    },
    boostPromptActions: {
        flexDirection: 'row',
        gap: ox(8),
        marginTop: ox(4),
    },
    boostPromptSecondaryBtn: {
        flex: 1,
        borderRadius: ox(10),
        paddingVertical: ox(10),
        alignItems: 'center',
        ...glassSurface,
    },
    boostPromptSecondaryText: {
        color: '#E5E7EB',
        fontSize: ox(13),
        fontWeight: '700',
    },
    boostPromptPrimaryBtn: {
        flex: 1,
        borderRadius: ox(10),
        backgroundColor: '#d91b5c',
        paddingVertical: ox(10),
        alignItems: 'center',
    },
    boostPromptPrimaryText: {
        color: '#FFFFFF',
        fontSize: ox(13),
        fontWeight: '800',
    },
});

export default FeedScreen;
