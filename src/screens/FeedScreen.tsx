/* @refresh reset */
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
    AppState,
    ScrollView,
    Modal,
    TextInput,
    Alert,
    Linking,
    Pressable,
    Platform,
    useWindowDimensions,
    Animated,
    DeviceEventEmitter,
    InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Reanimated, {
    cancelAnimation,
    Easing,
    FadeIn,
    interpolate,
    ReduceMotion,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import DiscoverAmbientCanvas from '../components/DiscoverAmbientCanvas.native';
import FeedAmbientCanvas from '../components/FeedAmbientCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import type { HeaderFeedScope } from '../utils/headerGlassPalette';
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
    getLocalPostById,
    upsertLocalPost,
    mergeEngagementStats,
    postMatchesLocationTab,
    clearLocalFeedPostsStorage,
} from '../api/posts';
import { isMockMode } from '../api/apiMode';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { appendMessage, getUnreadTotal } from '../api/messages';
import {
    connectSocket,
    joinLocationFeed,
    leaveLocationFeed,
    locationFeedRoomKey,
} from '../services/socketio';
import { blockUser } from '../api/messages';
import { isUserBlocked } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import { enqueue, drain } from '../utils/mutationQueue';
import type { Post } from '../types';
import { safePositiveLayoutNumber } from '../utils/safeLayoutNative';
import { FEED_UI } from '../constants/feedUiTokens';
import FeedPostMedia, {
    type FeedPostMediaHandle,
    resolveFeedVideoPosterUri,
} from '../components/FeedPostMedia.native';
import FeedDoubleTapLikeBurst from '../components/FeedDoubleTapLikeBurst.native';
import {
    type ImageFullscreenOrigin,
} from '../components/ImageFullscreenModal.native';
import { isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import { postHasVideoMedia, currentFeedSlideIsVideo } from '../utils/postMedia';
import { feedMediaHeight, intrinsicRatio, resolveIntrinsicSize } from '../utils/mediaAspectRatio';
import {
    mediaItemsEqual,
    stickersEqual,
    stringArraysEqual,
    textStylesEqual,
} from '../utils/feedPostCompareNative';
import NetInfo from '@react-native-community/netinfo';
import {
    getFeedAutoplayPref,
    resolveFeedAutoplayAllowed,
    subscribeFeedAutoplayPref,
    type FeedAutoplayPref,
} from '../utils/feedAutoplayPrefNative';
import { setActiveFeedVideoPostId, forceActiveFeedVideoPostId, setFeedAudioFocusPostId, setFeedPreloadPostIds, subscribeActiveFeedVideo, subscribeFeedAudioFocusPostId } from '../utils/feedActiveVideoNative';
import { setFeedScrollBusy } from '../utils/feedScrollBusyNative';
import { peekFeedVideoHandoff, peekScenesReturnHandoff } from '../utils/feedScenesHandoffNative';
import { setScenesLaunchPayload } from '../utils/scenesLaunchNative';
import { subscribeScenesPostUpdates } from '../utils/scenesPostSyncNative';
import {
    isScenesViewerActive,
    setScenesViewerActive,
    subscribeScenesViewerActive,
} from '../utils/scenesViewerActiveNative';
import {
    getGlobalVideoMutedNative,
    setGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';

import FeedPageLayout, {
    FEED_CARD_BODY,
    FEED_CARD_CAPTION_PADDING,
    FEED_CARD_ENGAGEMENT_BAR_DIMMED,
    FEED_CARD_ENGAGEMENT_LEFT,
    FEED_CARD_HEADER_OVERLAY,
    FEED_CARD_MEDIA_WRAP,
    FEED_CARD_OVERLAY_HEADER_GRADIENT,
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
    FEED_HEADER_PASSPORT_AVATAR_RING,
    FEED_HEADER_PASSPORT_INITIALS,
    FEED_HEADER_PICKER_ROW,
    FEED_HEADER_RIGHT_ACTIONS,
    FEED_HEADER_SIDE_ACTION,
    FEED_HEADER_SIDE_LABEL,
FEED_PAGE_BG,
      FEED_POST_CARD_STYLE,
      FEED_CARD_FLOAT_WRAP,
      FEED_PINNED_CHROME_CONTENT_HEIGHT,
      FEED_TAB_BAR_CLEARANCE,
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
import { Dimensions } from 'react-native';
import FeedEngagementRow from '../components/FeedEngagementRow';
import FeedEngagementRightActions from '../components/FeedEngagementRightActions.native';
import FeedPostHeader from '../components/FeedPostHeader.native';
import FeedCaptionText from '../components/FeedCaptionText.native';
import FeedPostTagRow from '../components/FeedPostTagRow.native';
import FeedMediaCarouselThumbs from '../components/FeedMediaCarouselThumbs.native';
import FeedNewsTicker from '../components/FeedNewsTicker.native';
import FeedPostNewsTicker from '../components/FeedPostNewsTicker.native';
import { fullscreenSlideIndexForCarousel } from '../utils/feedImageFullscreen';
import {
    setImageFullscreenLaunch,
    updateImageFullscreenPost,
    type ImageFullscreenHandlers,
} from '../utils/imageFullscreenLaunchNative';
import FeedLikesSheet from '../components/FeedLikesSheet.native';
import FeedTaggedMediaBadge from '../components/FeedTaggedMediaBadge.native';
import TaggedUsersBottomSheet from '../components/TaggedUsersBottomSheet.native';
import { getPostDisplayCaption, getReclipDisplay } from '../utils/feedPostMeta';
import FeedShareModal from '../components/FeedShareModal';
import ShareToStoriesModal from '../components/ShareToStoriesModal.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import BoostMetricsPanel from '../components/BoostMetricsPanel.native';
import { subscribeStoriesRefresh } from '../utils/storiesRefreshNative';
import { getActiveBoost, getAllActiveBoostLabels } from '../api/boost';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InterestsFeedCard from '../components/InterestsFeedCard.native';
import SuggestedFollowerFeedCard from '../components/SuggestedFollowerFeedCard.native';
import Stories24FeedRail, { type Stories24FeedRailHandle } from '../components/Stories24FeedRail.native';
import StoriesPromoCard from '../components/StoriesPromoCard.native';
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
import {
    filterPostsForLocationFeed,
    findLocationFeedLeaks,
    isLocationScopedFeedTab,
} from '../utils/locationFeedGuard';
import type { FeedScope } from '../utils/placeFeedLevels';
import LocationPlaceSummaryModal from '../components/LocationPlaceSummaryModal.native';
import FeedTextOnlyFeedLayout from '../components/FeedTextOnlyFeedLayout.native';
import FeedDmSheet, { type FeedDmSheetHandle } from '../components/FeedDmSheet.native';
import {
    loadLocationNotifyPrefs,
    locationNotifyKey,
    saveLocationNotifyPrefs,
} from '../utils/locationNotifyPrefNative';
import { useMutualFollow } from '../hooks/useMutualFollow';
import { onFollowStatusChanged } from '../hooks/useFollowState';
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
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { getAuthToken } from '../utils/authTokenBridge';
import { ox } from '../constants/nativeOpticalScale';

/** Stronger wash for short sheets — flat #060d16 reads as unchanged black on Android. */
const FEED_SWITCH_PASSPORT_WASH = ['#060d16', '#0f3a42', '#1f6b63', '#164858', '#060d16'] as const;

/**
 * Content clearance for the floating glass tab bar. The bar is absolutely positioned and
 * no longer participates in layout, so the feed body reserves this band itself to keep the
 * final card (and its action row) tappable above the bar.
 */
const TAB_BAR_CLEARANCE = FEED_TAB_BAR_CLEARANCE;

/**
 * Inline Stories promo cadence. The rail now owns index 0, so the old header pill is
 * re-surfaced in-feed as a full-width promo every N posts instead of every post.
 */
const STORIES24_PROMO_EVERY_POSTS = 10;

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
    const [passportAvatarFailed, setPassportAvatarFailed] = React.useState(false);
    React.useEffect(() => {
        setPassportAvatarFailed(false);
    }, [user?.avatarUrl]);
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
    const locationPulse = useSharedValue(1);
    const pillPulse = useSharedValue(1);
    const pillRipple = useSharedValue(0);
    const pillIsFocused = useIsFocused();
    const reducedMotionEnabled = useReducedMotion();
    const [appState, setAppState] = useState(AppState.currentState);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            setAppState(nextAppState);
        });
        setAppState(AppState.currentState);
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        const isActive = appState === 'active';
        if (!pillIsFocused || reducedMotionEnabled || !isActive) {
            cancelAnimation(locationPulse);
            locationPulse.value = 1;
            return;
        }

        locationPulse.value = withRepeat(
            withSequence(
                withTiming(1.35, { duration: 800 }),
                withTiming(1, { duration: 800 })
            ),
            -1,
            true
        );
        return () => cancelAnimation(locationPulse);
    }, [pillIsFocused, reducedMotionEnabled, appState, locationPulse]);

    const locationDotAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: locationPulse.value }],
        opacity: interpolate(locationPulse.value, [1, 1.35], [1, 0.5]),
    }));

    // One-shot scale pulse + soft glow/ripple each time the active location changes.
    const locationKey = `${active}|${customFilterType ?? ''}|${customLocationPlaceId ?? ''}|${
        customLocationLabel ?? customLocation ?? ''
    }`;
    const prevLocationKeyRef = useRef(locationKey);
    useEffect(() => {
        if (prevLocationKeyRef.current === locationKey) return;
        prevLocationKeyRef.current = locationKey;
        if (reducedMotionEnabled) return;
        pillPulse.value = 1;
        pillPulse.value = withSequence(
            withTiming(1.08, { duration: 140, easing: Easing.out(Easing.ease) }),
            withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) })
        );
        pillRipple.value = 0;
        pillRipple.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.ease) });
    }, [locationKey, reducedMotionEnabled, pillPulse, pillRipple]);
    const pillPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pillPulse.value }],
    }));
    const pillRippleStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pillRipple.value, [0, 0.2, 1], [0, 0.55, 0]),
        transform: [{ scale: interpolate(pillRipple.value, [0, 1], [1, 1.35]) }],
    }));
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
                    onPress={onOpenDiscover}
                    style={FEED_HEADER_SIDE_ACTION}
                    accessibilityLabel="Discover"
                >
                    <View style={styles.feedHeaderNotifWrap}>
                        <View style={styles.feedHeaderDiscoverGlyph}>
                            <Icon
                                name="compass-outline"
                                size={ox(20)}
                                color="#FFFFFF"
                            />
                        </View>
                        <Text style={FEED_HEADER_SIDE_LABEL}>Discover</Text>
                    </View>
                </TouchableOpacity>

                <View style={FEED_HEADER_CENTER}>
                    <View style={styles.feedSwitchPillWrap}>
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
                                                    outputRange: [6, 0],
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
                                <View style={styles.feedSwitchBadgeInner}>
                                    <Icon name="location" size={ox(11)} color="#FFFFFF" />
                                    <Text style={styles.feedSwitchBadgeText}>Switch feed</Text>
                                </View>
                                <View style={styles.feedSwitchBadgeCaret} />
                            </Animated.View>
                        ) : null}
                        <Reanimated.View
                            pointerEvents="none"
                            style={[styles.feedSwitchPillRipple, pillRippleStyle]}
                        />
                        <Reanimated.View style={[styles.feedSwitchPillBorder, pillPulseStyle]}>
                            <TouchableOpacity
                                onPress={() => setMenuOpen((prev) => !prev)}
                                style={FEED_HEADER_LOCATION_PILL}
                                activeOpacity={0.85}
                                accessibilityLabel="Change feed"
                            >
                                <Icon
                                    name={customFilterType === 'venue' ? 'home-outline' : customFilterType === 'landmark' ? 'business-outline' : 'location'}
                                    size={FEED_UI.icon.headerLocation}
                                    color="#FFFFFF"
                                />
                                <Reanimated.View style={[FEED_HEADER_ACTIVE_DOT, locationDotAnimatedStyle]} />
                                <Text
                                    style={FEED_HEADER_LOCATION_TITLE}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {headerLabel}
                                </Text>
                                <Icon name={menuOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={Math.round(FEED_UI.icon.headerLocation * 0.9)} color="rgba(255,255,255,0.9)" />
                            </TouchableOpacity>
                        </Reanimated.View>
                    </View>

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
                                {user?.avatarUrl && !passportAvatarFailed ? (
                                    <Image
                                        source={{
                                            uri:
                                                resolvePublicMediaUrl(user.avatarUrl) ||
                                                user.avatarUrl,
                                        }}
                                        style={styles.feedHeaderPassportAvatarImage}
                                        onError={() => setPassportAvatarFailed(true)}
                                    />
                                ) : (
                                    <Text style={FEED_HEADER_PASSPORT_INITIALS}>{passportInitials}</Text>
                                )}
                                <View
                                    pointerEvents="none"
                                    style={FEED_HEADER_PASSPORT_AVATAR_RING}
                                />
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
    onLikePersisted,
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
    holdNativeVideo,
    viewerHandle,
    viewerUserId,
    onOpenDM,
    onOpenImageFullscreen,
    onOpenScenes,
    onOpenLikesSheet,
    onOpenTaggedSheet,
    onShareToStories,
    onShareToStoriesSuccess,
}: {
    post: Post;
    onLike: () => Promise<void>;
    /** No-op reconciliation target for locally-isolated media-card likes. */
    onLikePersisted?: (postId: string, updated: Post) => void;
    onFollow?: () => Promise<void>;
    onView: () => Promise<void>;
    onComment: () => void;
    onShare: () => Promise<void>;
    onReclip: () => Promise<void>;
    onBookmark: () => Promise<void>;
    onPostPress?: () => void;
    onOpenImageFullscreen?: (
        startIndex?: number,
        origin?: ImageFullscreenOrigin | null,
        engagement?: { liked: boolean; count: number },
    ) => void;
    onOpenScenes?: (engagement?: { liked: boolean; count: number }) => void;
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
    /** Feed: keep this card's native Video mounted (paused) under a viewer route. */
    holdNativeVideo?: boolean;
    viewerHandle?: string | null;
    viewerUserId?: string;
    onOpenDM?: (handle: string, postId: string, isMutual?: boolean) => void;
    onOpenLikesSheet?: () => void;
    onOpenTaggedSheet?: () => void;
    /** Window coords — parent keeps one Modal so Android doesn't jump the FlatList. */
    onLikeBurst?: (windowX: number, windowY: number) => void;
    /** Parent-owned share modal — per-card Modal show/hide jumps FlatList on Android. */
    onShareToStories?: () => void;
    onShareToStoriesSuccess?: (postId: string) => void;
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
    const [isMetricsOpen, setIsMetricsOpen] = React.useState(false);
    const [boostMetricsActive, setBoostMetricsActive] = React.useState(Boolean(post.isBoosted));
    const isMutualFollow = useMutualFollow(post, isCurrentUser);
    const videoMediaRef = React.useRef<FeedPostMediaHandle>(null);
    const postViewRecordedRef = React.useRef(false);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const cardMediaWidth = safePositiveLayoutNumber(windowWidth, 360);

    /**
     * Intrinsic size of the ACTIVE carousel slide.
     *
     * `apiMedia` is derived (not stored) so it can never go stale or be wiped -- the
     * dimensions come from the payload on every render, preferring the active slide's
     * own width/height over the primary post's. A mixed-orientation carousel therefore
     * re-sizes the card when the slide index changes instead of forcing every slide
     * into the primary item's box.
     */
    const activeMediaItem = React.useMemo(
        () =>
            (post.mediaItems || []).filter(
                (item) => item?.type === 'image' || item?.type === 'video',
            )[carouselIndex] ?? null,
        [post.mediaItems, carouselIndex],
    );

    const apiMedia = React.useMemo(() => {
        const w = Number(activeMediaItem?.width ?? post.width);
        const h = Number(activeMediaItem?.height ?? post.height);

        return intrinsicRatio(w, h) != null ? { width: w, height: h } : null;
    }, [activeMediaItem?.width, activeMediaItem?.height, post.width, post.height]);

    /**
     * Live measured size, tagged by post AND slide.
     *
     * When ExoPlayer `naturalSize` / Image `onLoad` reports the true dimensions, the
     * card adopts them IMMEDIATELY (state update -> re-render -> new height) instead of
     * freezing the first — often fallback — box for the life of the post and only
     * correcting it after the cell is recycled. The post+slide tag means a recycled
     * cell can never apply a neighbour's (or a sibling slide's) measurement: a stale
     * tag simply does not match, and the module cache below is keyed the same way so a
     * remount of the same slide paints at its measured height from frame 0.
     */
    const [measuredMedia, setMeasuredMedia] = React.useState<{
        postId: string;
        slideIndex: number;
        width: number;
        height: number;
    } | null>(null);

    const measuredCacheKey = `${String(post.id)}:${carouselIndex}`;

    const handleIntrinsicMedia = React.useCallback(
        (size: { width: number; height: number }) => {
            if (intrinsicRatio(size.width, size.height) == null) return;
            const key = `${String(post.id)}:${carouselIndex}`;
            const prev = measuredMediaSizeByPostId.get(key);
            if (!prev || prev.width !== size.width || prev.height !== size.height) {
                // Hoisted to module scope so the size survives cell recycling.
                measuredMediaSizeByPostId.set(key, size);
            }
            setMeasuredMedia((prevState) =>
                prevState &&
                prevState.postId === String(post.id) &&
                prevState.slideIndex === carouselIndex &&
                prevState.width === size.width &&
                prevState.height === size.height
                    ? prevState
                    : {
                          postId: String(post.id),
                          slideIndex: carouselIndex,
                          width: size.width,
                          height: size.height,
                      },
            );
        },
        [post.id, carouselIndex],
    );

    const measuredForActiveSlide =
        measuredMedia &&
        measuredMedia.postId === String(post.id) &&
        measuredMedia.slideIndex === carouselIndex
            ? measuredMedia
            : (measuredMediaSizeByPostId.get(measuredCacheKey) ?? null);

    const intrinsicMedia = resolveIntrinsicSize({
        api: apiMedia,
        measured: measuredForActiveSlide,
        measuredForId: post.id,
        postId: post.id,
    });

    /**
     * Height derived from the CONTENT, not a fixed token — and LIVE, not frozen.
     *
     * This is the letterbox fix. The wrapper used to be pinned to `feedCardMediaHeight()`
     * with both `height` AND `maxHeight` while the inner video independently shrank to the
     * real 16:9 size -- so on a 390x844 device a landscape clip sat in a ~487pt box filling
     * only ~219pt of it, and the rest was black. Now the box is sized from the intrinsic
     * ratio resolved by {@link resolveIntrinsicSize} (landscape at its TRUE ratio via
     * `feedCardAspectRatio`, portrait clamped to 4:5), and only then capped to the viewport
     * so a tall post cannot push the engagement row off screen.
     *
     * It recomputes whenever the resolved size changes: an API dimension arriving, the
     * active carousel slide changing, or a runtime measurement landing all update the
     * mounted card in the same commit instead of waiting for a recycle/remount. Unknown
     * media seeds at the neutral 16:9 feed box via `fitLandscape`, so an unmeasured
     * widescreen clip never starts life in a tall portrait frame.
     */
    const mediaFrameHeight = React.useMemo(() => {
        const contentHeight = feedMediaHeight(
            cardMediaWidth,
            intrinsicMedia?.width,
            intrinsicMedia?.height,
            // Landscapes take their TRUE intrinsic ratio (no 16:9 cap) so an ultra-wide
            // clip renders as a clean widescreen rectangle instead of being side-cropped
            // to fill a taller 16:9 box. Portrait keeps the 4:5 feed cap. Unknown media
            // takes the neutral 16:9 box (RATIO_FEED_UNKNOWN).
            { fitLandscape: true },
        );
        const viewportCap =
            safePositiveLayoutNumber(windowHeight, 720) * FEED_UI.media.maxViewportFraction;

        return Math.round(Math.min(contentHeight, viewportCap));
    }, [cardMediaWidth, intrinsicMedia?.width, intrinsicMedia?.height, windowHeight]);
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

    const mediaGesturesEnabled = !isClientUploading && !isClientUploadFailed;

    /**
     * Local like isolation for PLAYING media cards. A double-tap like used to flow
     * straight into the parent's optimistic `setPages`, swapping the FlatList `data`
     * identity and pushing a fresh `post` through FeedPostMedia — which churned the
     * memoized video on the exact frame of the tap and restarted ExoPlayer from 0.
     * Multi-Video-1 isolation: the tap frame must cost ZERO parent/FeedPostMedia
     * renders, so the like lives here in FeedCard state and the Video never sees it.
     */
    type LikeOverride = { liked: boolean; count: number };
    const [localLike, setLocalLike] = React.useState<LikeOverride | null>(null);
    const localLikeRef = React.useRef<LikeOverride | null>(null);

    const effectiveLiked = localLike?.liked ?? post.userLiked === true;
    const effectiveLikes = localLike?.count ?? post.stats?.likes ?? 0;

    const handleOpenScenesPress = React.useCallback(() => {
        onOpenScenes?.({ liked: effectiveLiked, count: effectiveLikes });
    }, [effectiveLiked, effectiveLikes, onOpenScenes]);

    const runLocalLike = React.useCallback(async () => {
        if (isClientUploading || isClientUploadFailed) return;
        const postId = String(post.id);
        const prevLiked = localLikeRef.current?.liked ?? post.userLiked === true;
        const prevCount = localLikeRef.current?.count ?? post.stats?.likes ?? 0;
        const nextLiked = !prevLiked;
        const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
        const optimistic: LikeOverride = { liked: nextLiked, count: nextCount };
        localLikeRef.current = optimistic;
        setLocalLike(optimistic);
        try {
            const updated = await toggleLike(viewerUserId ?? 'anon', postId, post);
            const settled: LikeOverride = {
                liked: updated.userLiked ?? nextLiked,
                count: Math.max(
                    0,
                    typeof updated.stats?.likes === 'number'
                        ? updated.stats.likes
                        : nextCount,
                ),
            };
            localLikeRef.current = settled;
            setLocalLike(settled);
            onLikePersisted?.(postId, updated);
        } catch {
            const revert: LikeOverride = { liked: prevLiked, count: prevCount };
            localLikeRef.current = revert;
            setLocalLike(revert);
        }
    }, [isClientUploadFailed, isClientUploading, onLikePersisted, post, viewerUserId]);

    /**
     * Reconcile the isolated media-card like with authoritative post state.
     *
     * The feed (`pages`), the in-feed fullscreen modal (`syncFullscreenPost`) and the
     * PostDetail bridge all write fresh like values back into `post`. Without this the
     * stale `localLike` override would mask them — e.g. unliking in the fullscreen modal
     * left the card's heart filled, and a like made in full screen/detail never reached
     * a card the user had already tapped.
     *
     * Keyed on the like VALUES, not the post object (the parent rebuilds `post` every
     * render for bookmarks). While a request is in flight the authoritative values are
     * unchanged, so the optimistic override is preserved; once `pages` settles — from
     * this card or any other surface — the override yields to `post`.
     */
    React.useEffect(() => {
        const override = localLikeRef.current;
        if (!override) return;
        const authoritativeLiked = post.userLiked === true;
        const authoritativeCount = post.stats?.likes ?? 0;
        if (override.liked === authoritativeLiked && override.count === authoritativeCount) {
            return;
        }
        localLikeRef.current = null;
        setLocalLike(null);
    }, [post.id, post.userLiked, post.stats?.likes]);

    const handleMediaDoubleLike = React.useCallback(() => {
        // Media cards (TextureView active) — local only, no parent setPages on the tap.
        void runLocalLike();
    }, [runLocalLike]);

    const handleFeedLike = React.useCallback(() => {
        // Text-only cards have no native video to resurface, so they keep the parent's
        // optimistic flow; media cards isolate the like so the player never re-renders.
        if (postHasVideoMedia(post)) {
            void runLocalLike();
            return;
        }
        void onLike();
    }, [onLike, post, runLocalLike]);

    /** Stable so a local like re-render can't hand FeedPostMedia a new prop and re-render it. */
    const handleMediaLoadOnce = React.useCallback(() => {
        if (postViewRecordedRef.current) return;
        postViewRecordedRef.current = true;
        void onView();
    }, [onView]);

    const openStillFullscreen = React.useCallback(() => {
        // Slide-aware, not image-only: a mixed carousel must open the slide that was tapped.
        // No measureInWindow: the native route ignores the origin rect (the store takes no
        // origin and the fade needs none), so the async native round-trip was dead work on
        // the tap frame.
        const startIndex = fullscreenSlideIndexForCarousel(post, carouselIndex);
        onOpenImageFullscreen?.(startIndex, null, {
            liked: effectiveLiked,
            count: effectiveLikes,
        });
    }, [carouselIndex, effectiveLiked, effectiveLikes, onOpenImageFullscreen, post]);

    const handleMediaSingleTap = React.useCallback(() => {
        // One tap → fullscreen (Scenes for video, still viewer for images). Mute is the icon.
        if (currentFeedSlideIsVideo(post, carouselIndex)) {
            handleOpenScenesPress();
            return;
        }
        openStillFullscreen();
    }, [carouselIndex, handleOpenScenesPress, openStillFullscreen, post]);

    return (
        <View style={textOnlyPost ? styles.textOnlyFloatWrap : FEED_CARD_FLOAT_WRAP}>
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
                <>
                <FeedTextOnlyFeedLayout
                    post={post}
                    viewerHandle={viewerHandle}
                    cardWidth={cardMediaWidth}
                    isCurrentUser={isCurrentUser}
                    onFollow={onFollow}
                    onOpenDM={onOpenDM}
                    onProfileMenuPress={openProfileMenu}
                    onAvatarPress={(hasStory) => {
                        if (hasStory && onViewStories) {
                            onViewStories();
                            return;
                        }
                        if (onVisitHandle) onVisitHandle(profileHandle);
                        else onVisitProfile?.();
                    }}
                    onOverflowPress={onOverflowPress}
                    onDoubleLike={() => {
                        void onLike();
                    }}
                    onShowTaggedUsers={() => onOpenTaggedSheet?.()}
                    menuAnchorRef={profileMenuAnchorRef}
                />
                <FeedPostNewsTicker post={post} carouselIndex={carouselIndex} />
                <View style={styles.textOnlyEngagementRow}>
                    <View style={styles.textOnlyEngagementLeft}>
                        <FeedEngagementRow
                            likeButtonRef={likeButtonRef}
                            likes={effectiveLikes}
                            comments={post.stats.comments}
                            shares={post.stats.shares}
                            reclips={post.stats.reclips}
                            views={post.stats.views}
                            userLiked={effectiveLiked}
                            userReclipped={post.userReclipped}
                            isSaved={post.isBookmarked}
                            onLike={handleFeedLike}
                            onLikesPress={() => {
                                if (post.stats.likes > 0) onOpenLikesSheet?.();
                            }}
                            onComment={onComment}
                            onShareToStories={() => onShareToStories?.()}
                            onReclip={!isCurrentUser ? () => { void onReclip(); } : undefined}
                            reclipDisabled={isCurrentUser}
                            onSave={() => {
                                void onBookmark();
                            }}
                            showReclip
                            showSaveLabel={!showBoostMetrics}
                            compact={showBoostMetrics}
                            tone="feed"
                        />
                    </View>
                    <FeedEngagementRightActions
                        showMetrics={showBoostMetrics}
                        metricsOpen={isMetricsOpen}
                        onToggleMetrics={() => setIsMetricsOpen((v) => !v)}
                        shares={post.stats.shares}
                        onShare={() => {
                            void onShare();
                        }}
                    />
                </View>
                </>
            ) : (
                <View style={FEED_CARD_BODY}>
                    {hasFeedMedia ? (
                        <View
                            style={[
                                FEED_CARD_MEDIA_WRAP,
                                {
                                    height: mediaFrameHeight,
                                    maxHeight: mediaFrameHeight,
                                },
                            ]}
                            collapsable={false}
                        >
                            <FeedPostMedia
                                ref={videoMediaRef}
                                post={post}
                                onIntrinsicSize={handleIntrinsicMedia}
                                carouselIndex={carouselIndex}
                                onCarouselIndexChange={setCarouselIndex}
                                stickers={post.stickers}
                                width={cardMediaWidth}
                                height={mediaFrameHeight}
                                onDoubleLike={mediaGesturesEnabled ? handleMediaDoubleLike : undefined}
                                onSingleTap={mediaGesturesEnabled ? handleMediaSingleTap : undefined}
                                onMediaLoad={isClientUploading ? undefined : handleMediaLoadOnce}
                                mode="feed"
                                isActive={isVideoActive && !isClientUploading}
                                suspendNativeVideo={suspendNativeVideo}
                                holdNativeVideo={holdNativeVideo}
                                muted={feedVideoMuted}
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

                            <View style={FEED_CARD_HEADER_OVERLAY} pointerEvents="box-none">
                                <LinearGradient
                                    colors={[...FEED_CARD_OVERLAY_HEADER_GRADIENT]}
                                    style={StyleSheet.absoluteFill}
                                    pointerEvents="none"
                                />
                                <FeedPostHeader
                                    post={post}
                                    viewerHandle={viewerHandle}
                                    isCurrentUser={isCurrentUser}
                                    isOverlaid
                                    onFollow={onFollow}
                                    onOpenDM={onOpenDM}
                                    onProfileMenuPress={openProfileMenu}
                                    onAvatarPress={(hasStory) => {
                                        if (hasStory && onViewStories) {
                                            onViewStories();
                                            return;
                                        }
                                        if (onVisitHandle) onVisitHandle(profileHandle);
                                        else onVisitProfile?.();
                                    }}
                                    onHasStoryChange={setHeaderHasStory}
                                    onOverflowPress={onOverflowPress}
                                    menuAnchorRef={profileMenuAnchorRef}
                                />
                            </View>

                            {hasTaggedUsers ? (
                                <FeedTaggedMediaBadge
                                    count={post.taggedUsers!.length}
                                    onPress={() => onOpenTaggedSheet?.()}
                                />
                            ) : null}
                            {showVideoMuteOnMedia &&
                            currentFeedSlideIsVideo(post, carouselIndex) &&
                            !isClientUploading ? (
                                <Pressable
                                    style={styles.feedMuteButton}
                                    onPress={() => {
                                        videoMediaRef.current?.toggleVideoMute();
                                    }}
                                    hitSlop={10}
                                    accessibilityRole="button"
                                    accessibilityLabel={feedVideoMuted ? 'Unmute video' : 'Mute video'}
                                >
                                    <Icon
                                        name={feedVideoMuted ? 'volume-mute' : 'volume-high'}
                                        size={13}
                                        color="#FFFFFF"
                                    />
                                </Pressable>
                            ) : null}
                        </View>
                    ) : null}

                    {hasFeedMedia ? (
                        <FeedPostNewsTicker post={post} carouselIndex={carouselIndex} />
                    ) : null}

                    {hasFeedMedia ? (
                        <View
                            style={[
                                styles.mediaEngagementBelow,
                                (isClientUploading || isClientUploadFailed) &&
                                    FEED_CARD_ENGAGEMENT_BAR_DIMMED,
                            ]}
                        >
                            <View style={FEED_CARD_ENGAGEMENT_LEFT}>
                                <FeedEngagementRow
                                    likeButtonRef={likeButtonRef}
                                    likes={effectiveLikes}
                                    comments={post.stats.comments}
                                    shares={post.stats.shares}
                                    reclips={post.stats.reclips}
                                    views={post.stats.views}
                                    userLiked={effectiveLiked}
                                    userReclipped={post.userReclipped}
                                    isSaved={post.isBookmarked}
                                    onLike={handleFeedLike}
                                    onLikesPress={() => {
                                        if (post.stats.likes > 0) onOpenLikesSheet?.();
                                    }}
                                    onComment={onComment}
                                    onShareToStories={() => onShareToStories?.()}
                                    onReclip={!isCurrentUser ? () => { void onReclip(); } : undefined}
                                    reclipDisabled={isCurrentUser}
                                    onSave={() => {
                                        void onBookmark();
                                    }}
                                    showReclip
                                    showSaveLabel={!showBoostMetrics}
                                    compact={showBoostMetrics}
                                    tone="slate"
                                />
                            </View>
                            <FeedEngagementRightActions
                                showMetrics={showBoostMetrics}
                                metricsOpen={isMetricsOpen}
                                onToggleMetrics={() => setIsMetricsOpen((v) => !v)}
                                shares={post.stats.shares}
                                onShare={() => {
                                    void onShare();
                                }}
                                tone="slate"
                            />
                        </View>
                    ) : null}

                    {carouselThumbItems.length > 1 ? (
                        <FeedMediaCarouselThumbs
                            items={carouselThumbItems}
                            post={post}
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

            {showBoostMetrics ? (
                <BoostMetricsPanel post={post} isOpen={isMetricsOpen} />
            ) : null}

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
                    onOpenDM
                        ? (handle) => {
                              const target = (handle || profileHandle || post.userHandle || '').trim();
                              closeProfileMenu();
                              if (!target) return;
                              onOpenDM(target, String(post.id), true);
                          }
                        : undefined
                }
onBlock={onBlockUser}
                  onReport={onReportUser}
              />
          </View>
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
        // Dimension-only updates MUST break the memo: a width/height/aspectRatio
        // arriving for the same post (or for the active carousel slide, via
        // mediaItemsEqual below) changes the card's height even when every
        // engagement field is identical. Without these, `extraData` could signal
        // the change and the comparator would still skip the re-render.
        a.width === b.width &&
        a.height === b.height &&
        a.aspectRatio === b.aspectRatio &&
        a.videoPosterUrl === b.videoPosterUrl &&
        a.templateId === b.templateId &&
        a.text === b.text &&
        textStylesEqual(a.textStyle, b.textStyle) &&
        a.isBoosted === b.isBoosted &&
        a.originalUserHandle === b.originalUserHandle &&
        prev.isCurrentUser === next.isCurrentUser &&
        prev.isVideoActive === next.isVideoActive &&
        prev.feedVideoMuted === next.feedVideoMuted &&
        prev.suspendNativeVideo === next.suspendNativeVideo &&
        prev.holdNativeVideo === next.holdNativeVideo &&
        prev.viewerHandle === next.viewerHandle &&
        Boolean(prev.onOpenDM) === Boolean(next.onOpenDM) &&
        a.clientUploadStatus === b.clientUploadStatus &&
        a.clientUploadError === b.clientUploadError &&
        a.clientLocalMediaUri === b.clientLocalMediaUri &&
        mediaItemsEqual(a.mediaItems, b.mediaItems) &&
        stringArraysEqual(a.taggedUsers, b.taggedUsers) &&
        stringArraysEqual(a.tags, b.tags) &&
        a.bannerText === b.bannerText &&
        stickersEqual(a.stickers, b.stickers)
    );
});

export { FeedCard };

/**
 * Measured media sizes live at MODULE scope, not in per-cell state.
 *
 * A FlatList cell that unmounts (windowing / Android removeClippedSubviews) discards its
 * local state. When it remounts, the media box previously fell back to RATIO_FALLBACK, the
 * video re-measured on `onLoad`, and the card resized at the exact moment playback began —
 * pushing every row below it and snapping the scroll offset by whole posts. Hoisting the
 * measurement keyed by `postId:slideIndex` means a recycled cell remounts at the SAME
 * height it had when it unloaded, so no row below ever moves, and a mixed-orientation
 * carousel never inherits a sibling slide's size. API dimensions still win on first
 * render; this cache only fills the gap for posts that predate the dimensions columns
 * or for local/demo uploads. The live card additionally adopts a measurement the moment
 * it lands (see `measuredMedia` in FeedCard) — the cache is the remount seed, not the
 * only path to the correct height.
 */
const measuredMediaSizeByPostId = new Map<string, { width: number; height: number }>();

type FeedListRow =
    | { kind: 'post'; post: Post }
    | { kind: 'ad'; ad: Ad }
    | { kind: 'local_business'; posts: Post[]; pinnedPaidPostId?: string; useMockPreview?: boolean }
    | { kind: 'suggested_places'; bundleKey: string; suggestions: PlaceMatchedPost[] }
    | { kind: 'stories24'; id: string }
    | { kind: 'stories24_divider'; id: string }
    | { kind: 'stories_promo'; id: string }
    | { kind: 'interests'; id: string }
    | { kind: 'suggested_follower'; suggestion: SuggestedFollowerSuggestion };

/**
 * Closest upcoming video post AFTER `primaryPostId` in the flattened feed rows.
 *
 * Strict cap of ONE neighbor: the silent preload mounts at most a single extra ExoPlayer,
 * so we never fan out codecs. Returns [] when the primary is unknown or nothing video follows.
 */
function nextPreloadNeighborIds(rows: FeedListRow[], primaryPostId: string | null): string[] {
    if (!primaryPostId) return [];
    const idx = rows.findIndex(
        (row) => row.kind === 'post' && String(row.post.id) === String(primaryPostId),
    );
    if (idx < 0) return [];
    for (let i = idx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.kind !== 'post') continue;
        if (!postHasVideoMedia(row.post)) continue;
        return [String(row.post.id)];
    }
    return [];
}

function useFeedDmComposer(viewerHandle: string | undefined) {
    const dmSheetRef = useRef<FeedDmSheetHandle>(null);
    const [dmSheetOpen, setDmSheetOpen] = useState(false);
    const [dmSheetRecipientHandle, setDmSheetRecipientHandle] = useState<string | null>(null);
    const [dmSheetAnchorPostId, setDmSheetAnchorPostId] = useState<string | null>(null);
    const [dmSheetMessage, setDmSheetMessage] = useState('');
    const [dmSheetSending, setDmSheetSending] = useState(false);
    const [pendingDmUser, setPendingDmUser] = useState<string | null>(null);
    const [pendingDmPostId, setPendingDmPostId] = useState<string | null>(null);
    const [dmSheetEpoch, setDmSheetEpoch] = useState(0);
    const dmSessionRef = useRef(0);
    const suppressDismissRef = useRef(false);
    const unlockDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openDmThread = useCallback(
        (handle: string, postId: string, isMutual?: boolean) => {
            if (isMutual === false) {
                Alert.alert(
                    'Cannot message',
                    'You must mutually follow each other to send a direct message',
                );
                return;
            }
            const nextHandle = (handle || '').trim();
            if (!nextHandle) return;
            // Stash the recipient now; present() waits until Quick Actions has unmounted.
            dmSessionRef.current += 1;
            suppressDismissRef.current = true;
            setPendingDmUser(nextHandle);
            setPendingDmPostId(postId ? String(postId) : null);
            setDmSheetRecipientHandle(nextHandle);
            setDmSheetAnchorPostId(postId ? String(postId) : null);
            setDmSheetMessage('');
            setDmSheetSending(false);
        },
        [],
    );

    useEffect(() => {
        if (!pendingDmUser) return undefined;
        const session = dmSessionRef.current;
        const t = setTimeout(() => {
            if (session !== dmSessionRef.current) return;
            setDmSheetOpen(true);
            setPendingDmUser(null);
            setPendingDmPostId(null);
            dmSheetRef.current?.present();
            if (unlockDismissTimerRef.current) clearTimeout(unlockDismissTimerRef.current);
            unlockDismissTimerRef.current = setTimeout(() => {
                if (session === dmSessionRef.current) suppressDismissRef.current = false;
            }, 400);
        }, 250);
        return () => clearTimeout(t);
    }, [pendingDmUser, pendingDmPostId]);

    const sendDmFromSheet = useCallback(async () => {
        const text = dmSheetMessage.trim();
        const recipient = dmSheetRecipientHandle;
        if (!text || !viewerHandle || !recipient || dmSheetSending) return;
        setDmSheetSending(true);
        try {
            await appendMessage(viewerHandle, recipient, {
                text,
                sourcePostId: dmSheetAnchorPostId ?? undefined,
            });
            dmSheetRef.current?.dismiss();
        } catch (err) {
            Alert.alert(
                'Could not send',
                err instanceof Error ? err.message : 'Please try again.',
            );
        } finally {
            setDmSheetSending(false);
        }
    }, [dmSheetAnchorPostId, dmSheetMessage, dmSheetRecipientHandle, dmSheetSending, viewerHandle]);

    // Gorhom already tore the sheet down. Calling dismiss() again here leaves
    // status=DISMISSING, so the next present() never paints.
    const closeDmSheet = useCallback(() => {
        if (suppressDismissRef.current) return;
        setDmSheetOpen(false);
        setPendingDmUser(null);
        setPendingDmPostId(null);
        setDmSheetRecipientHandle(null);
        setDmSheetAnchorPostId(null);
        setDmSheetMessage('');
        setDmSheetSending(false);
        setTimeout(() => setDmSheetEpoch((n) => n + 1), 0);
    }, []);

    return {
        dmSheetRef,
        dmSheetEpoch,
        dmSheetOpen,
        dmSheetRecipientHandle,
        dmSheetMessage,
        setDmSheetMessage,
        dmSheetSending,
        openDmThread,
        sendDmFromSheet,
        closeDmSheet,
    };
}

function FeedScreen({ navigation, route }: { navigation?: any; route?: any }) {
    const { user, login } = useAuth();
    const userId = user?.id ?? 'anon';
    const isFeedFocused = useIsFocused();
    const {
        dmSheetRef,
        dmSheetEpoch,
        dmSheetOpen,
        dmSheetRecipientHandle,
        dmSheetMessage,
        setDmSheetMessage,
        dmSheetSending,
        openDmThread,
        sendDmFromSheet,
        closeDmSheet,
    } = useFeedDmComposer(user?.handle);
    const [scenesViewerActive, setScenesViewerActiveState] = useState(() => isScenesViewerActive());
    useEffect(() => {
        // Keep feed ExoPlayer dead for the whole Scenes session (focus blur is unreliable).
        return subscribeScenesViewerActive((active) => {
            setScenesViewerActiveState(active);
            if (active) {
                activeVideoPostIdRef.current = null;
                setActiveFeedVideoPostId(null);
            }
        });
    }, []);
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

    // Legal: keep Sponsored visible on any actively boosted post in the loaded feed.
    const applySponsoredLabels = useCallback(async () => {
        try {
            const labels = await getAllActiveBoostLabels();
            if (labels.size === 0) return;
            setPages((prev) =>
                prev.map((page) =>
                    page.map((p) => {
                        const ft = labels.get(String(p.id));
                        if (!ft) return p;
                        if (p.isBoosted && p.boostFeedType === ft) return p;
                        return {
                            ...p,
                            isBoosted: true,
                            boostFeedType: p.boostFeedType ?? ft,
                        };
                    }),
                ),
            );
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener(
            'boostActivated',
            (payload: { postId?: string; feedType?: 'local' | 'regional' | 'national' }) => {
                const postId = payload?.postId ? String(payload.postId) : '';
                if (!postId) return;
                setPages((prev) =>
                    prev.map((page) =>
                        page.map((p) =>
                            String(p.id) === postId
                                ? {
                                      ...p,
                                      isBoosted: true,
                                      boostFeedType: payload.feedType ?? p.boostFeedType ?? 'regional',
                                  }
                                : p,
                        ),
                    ),
                );
            },
        );
        return () => sub.remove();
    }, []);

    useEffect(() => {
        const rewrite = (h: string | undefined, oldNorm: string, nextHandle: string) => {
            if (!h) return h;
            return String(h).replace(/^@/, '').trim().toLowerCase() === oldNorm ? nextHandle : h;
        };
        const sub = DeviceEventEmitter.addListener(
            'userHandleChanged',
            (payload: { oldHandle?: string; newHandle?: string }) => {
                const oldNorm = String(payload?.oldHandle || '')
                    .replace(/^@/, '')
                    .trim()
                    .toLowerCase();
                const nextHandle = String(payload?.newHandle || '').replace(/^@/, '').trim();
                if (!oldNorm || !nextHandle) return;
                setPages((prev) =>
                    prev.map((page) =>
                        page.map((p) => ({
                            ...p,
                            userHandle: rewrite(p.userHandle, oldNorm, nextHandle) || p.userHandle,
                            originalUserHandle: p.originalUserHandle
                                ? rewrite(p.originalUserHandle, oldNorm, nextHandle) || p.originalUserHandle
                                : p.originalUserHandle,
                        })),
                    ),
                );
            },
        );
        return () => sub.remove();
    }, []);

    useFocusEffect(
        useCallback(() => {
            void applySponsoredLabels();
        }, [applySponsoredLabels]),
    );
    const [cursor, setCursor] = useState<string | number | null>(0);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    /** Synchronous lock so two onEndReached in one frame cannot both pass the loadingMore state guard. */
    const loadingMoreRef = useRef(false);
    const [end, setEnd] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showFollowingFeed, setShowFollowingFeed] = useState(false);
    const [customLocation, setCustomLocation] = useState<string | null>(null);
    const [customLocationLabel, setCustomLocationLabel] = useState<string | null>(null);
    const [customLocationPlaceId, setCustomLocationPlaceId] = useState<string | null>(null);
    const [customFilterType, setCustomFilterType] = useState<'location' | 'venue' | 'landmark' | null>(null);
    const [customFeedScope, setCustomFeedScope] = useState<'local' | 'regional' | 'national' | null>(null);
    const [commentsModalOpen, setCommentsModalOpen] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
    const [imageFullscreenPost, setImageFullscreenPost] = useState<Post | null>(null);
    const [imageFullscreenStartIndex, setImageFullscreenStartIndex] = useState(0);
    /**
     * Feed card whose native Video surface is kept mounted (paused) while a full-screen
     * viewer route (Scenes / ImageFullscreen) covers the feed. Without this the ExoPlayer
     * is torn down on open and reallocated on return, so the MP4 restarted from 0. Set on
     * open, cleared when Feed regains focus.
     */
    const [heldVideoPostId, setHeldVideoPostId] = useState<string | null>(null);
    /** Feed under Scenes / image fullscreen / comments — kill ExoPlayer so audio cannot leak. */
    const feedNativeVideoSuspended =
        commentsModalOpen ||
        ((!isFeedFocused || scenesViewerActive || Boolean(imageFullscreenPost)) &&
            !heldVideoPostId);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
    const [shareToStoriesPost, setShareToStoriesPost] = useState<Post | null>(null);
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
    const [notifyLocations, setNotifyLocations] = useState<string[]>([]);
    const [headerScopePicker, setHeaderScopePicker] = useState<LocationSuggestion | null>(null);
    const [headerScopePickerKind, setHeaderScopePickerKind] = useState<'location' | 'venue' | 'landmark'>(
        'location'
    );
    /** Local overrides keyed by post id so bookmark rail matches collections without refetching whole feed. */
    const [savedByPostId, setSavedByPostId] = useState<Record<string, boolean>>({});
    const savedByPostIdRef = useRef(savedByPostId);
    savedByPostIdRef.current = savedByPostId;
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
    const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
    useEffect(() => subscribeActiveFeedVideo(setActiveVideoPostId), []);
    const [feedAutoplayAllowed, setFeedAutoplayAllowed] = useState(true);
    const [feedVideoMuted, setFeedVideoMuted] = useState(false);
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
    /** Incoming live drops that arrived while the list was scrolled away from top. */
    const [liveDropBadge, setLiveDropBadge] = useState(0);
    const stories24RailRef = React.useRef<Stories24FeedRailHandle>(null);
    const flatListRef = useRef<FlatList<FeedListRow>>(null);
    const feedScrollYRef = useRef(0);
    const pinFeedScrollSoon = useCallback((explicitY?: number | null) => {
        const y = explicitY ?? feedScrollYRef.current;
        const apply = () => {
            flatListRef.current?.scrollToOffset({ offset: y, animated: false });
        };
        apply();
        requestAnimationFrame(() => {
            apply();
            requestAnimationFrame(apply);
        });
    }, []);
    /** One feed-level burst Modal — per-card Modal show/hide jumps FlatList on Android. */
    const [feedLikeBurst, setFeedLikeBurst] = useState<{ x: number; y: number; key: number } | null>(
        null,
    );
    const feedLikeBurstClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showFeedLikeBurst = useCallback((windowX: number, windowY: number) => {
        const y = feedScrollYRef.current;
        setFeedLikeBurst({ x: windowX, y: windowY, key: Date.now() });
        pinFeedScrollSoon(y);
        if (feedLikeBurstClearRef.current) clearTimeout(feedLikeBurstClearRef.current);
        feedLikeBurstClearRef.current = setTimeout(() => {
            const pinY = feedScrollYRef.current;
            setFeedLikeBurst(null);
            pinFeedScrollSoon(pinY);
            feedLikeBurstClearRef.current = null;
        }, 750);
    }, [pinFeedScrollSoon]);
    useEffect(
        () => () => {
            if (feedLikeBurstClearRef.current) clearTimeout(feedLikeBurstClearRef.current);
        },
        [],
    );
    const flatForRenderRef = useRef<FeedListRow[]>([]);
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
    const lastEngagementByIdRef = useRef(
        new Map<string, { stats: Post['stats']; userLiked?: boolean }>(),
    );
    const recordedFeedViewIdsRef = useRef(new Set<string>());
    const recordFeedViewRef = useRef<(postId: string) => void>(() => {});
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
        // Play only a post that is at least 60% on screen (in-cell Video, no portal).
        itemVisiblePercentThreshold: 60,
        minimumViewTime: 20,
    });

    const feedScrollingRef = useRef(false);
    const feedScrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Gate was released at rest; ignore throttled trailing onScroll at the same offset. */
    const feedScrollRestingRef = useRef(false);
    const feedScrollRestOffsetRef = useRef(0);
    /** Offset at touch-down and whether the finger has actually displaced the list. */
    const feedScrollDragOriginRef = useRef(0);
    const feedScrollDragMovedRef = useRef(false);
    const lastViewableVideoPostIdRef = useRef<string | null>(null);
    /** Video that was playing (or the video card under the overlay) — restore on overlay close. */
    const overlayResumeVideoPostIdRef = useRef<string | null>(null);

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
        void (async () => {
            try {
                const migrated = await AsyncStorage.getItem('clips:feedAudioDefaultUnmuted_v1');
                if (migrated !== '1') {
                    await setGlobalVideoMutedNative(false);
                    await AsyncStorage.setItem('clips:feedAudioDefaultUnmuted_v1', '1');
                }
            } catch {
                /* ignore */
            }
            if (cancelled) return;
            const muted = await getGlobalVideoMutedNative();
            if (!cancelled) setFeedVideoMuted(muted);
        })();
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
        if (!user?.id) {
            setStories24Items([]);
            return;
        }
        let cancelled = false;
        const load = () => {
            void buildStories24RailItems(user.id, user.handle, user.avatarUrl).then((items) => {
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
    }, [user?.id, user?.handle, user?.avatarUrl]);

    useFocusEffect(
        React.useCallback(() => {
            if (!user?.id) return;
            void buildStories24RailItems(user.id, user.handle, user.avatarUrl).then(setStories24Items);
        }, [user?.id, user?.handle, user?.avatarUrl]),
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

    const scenesViewerActiveRef = useRef(scenesViewerActive);
    scenesViewerActiveRef.current = scenesViewerActive;

    const imageFullscreenOpenRef = useRef(Boolean(imageFullscreenPost));
    imageFullscreenOpenRef.current = Boolean(imageFullscreenPost);

    /** Latest open post — the viewer's handlers read this so a fresh handler invocation
     *  always acts on the current post (the route screen holds them across renders). */
    const imageFullscreenPostRef = useRef<Post | null>(null);
    imageFullscreenPostRef.current = imageFullscreenPost;

    /** Id the fullscreen viewer was last opened for — guards deferred decoration work
     *  from bleeding into a newer open (or a viewer the user already closed). */
    const imageFullscreenOpenIdRef = useRef<string | null>(null);

    const commentsModalOpenRef = useRef(commentsModalOpen);
    commentsModalOpenRef.current = commentsModalOpen;

    /** True after the first viewability pass — list data patches must never invent a player. */
    const feedViewabilitySeenRef = useRef(false);

    const feedAutoplayOverlayBlocks = () =>
        scenesViewerActiveRef.current ||
        imageFullscreenOpenRef.current ||
        commentsModalOpenRef.current;

    const captureOverlayVideoResume = useCallback((fallbackPost?: Post | null) => {
        const active = activeVideoPostIdRef.current;
        if (active) {
            overlayResumeVideoPostIdRef.current = String(active);
            return;
        }
        if (fallbackPost && postHasVideoMedia(fallbackPost)) {
            overlayResumeVideoPostIdRef.current = String(fallbackPost.id);
            return;
        }
        overlayResumeVideoPostIdRef.current = null;
    }, []);

    const restoreFeedVideoAfterOverlay = useCallback(() => {
        // Release any held viewer surface before re-arming, otherwise the card would stay
        // mounted-but-paused and never resume.
        setHeldVideoPostId(null);
        const resumeId = overlayResumeVideoPostIdRef.current;
        if (!resumeId || !feedAutoplayAllowedRef.current) {
            if (!feedAutoplayOverlayBlocks()) {
                overlayResumeVideoPostIdRef.current = null;
            }
            return;
        }
        // Another overlay still open (e.g. comments under image fullscreen) — keep resume id.
        if (feedAutoplayOverlayBlocks()) return;
        overlayResumeVideoPostIdRef.current = null;
        lastViewableVideoPostIdRef.current = resumeId;
        // Force a clean remount — suspend unmounts TextureView and leaves a blank frame
        // if we only flip suspend without re-arming the active id.
        activeVideoPostIdRef.current = null;
        setActiveFeedVideoPostId(null);
        requestAnimationFrame(() => {
            if (feedAutoplayOverlayBlocks()) {
                overlayResumeVideoPostIdRef.current = resumeId;
                return;
            }
            if (!feedAutoplayAllowedRef.current) return;
            scheduleActiveFeedVideoRef.current(resumeId, true);
        });
    }, []);

    useEffect(() => {
        if (!scenesViewerActive && !imageFullscreenPost && !commentsModalOpen) return;
        if (autoplayTimerRef.current) {
            clearTimeout(autoplayTimerRef.current);
            autoplayTimerRef.current = null;
        }
        activeVideoPostIdRef.current = null;
        setActiveFeedVideoPostId(null);
    }, [scenesViewerActive, imageFullscreenPost, commentsModalOpen]);

    const scheduleActiveFeedVideo = useCallback((postId: string | null, force = false) => {
        if (autoplayTimerRef.current) {
            clearTimeout(autoplayTimerRef.current);
            autoplayTimerRef.current = null;
        }
        // Any in-flight scroll owns the decoder. Remember the candidate and return
        // before setActive / forceActive — both mount or destroy ExoPlayer.
        if (feedScrollingRef.current) {
            if (feedAutoplayAllowedRef.current && postId && !feedAutoplayOverlayBlocks()) {
                lastViewableVideoPostIdRef.current = String(postId);
            } else if (!feedAutoplayAllowedRef.current || !postId) {
                lastViewableVideoPostIdRef.current = null;
            }
            return;
        }
        // Overlays / comments: never re-arm from list re-renders or stale viewability.
        if (feedAutoplayOverlayBlocks()) {
            activeVideoPostIdRef.current = null;
            setActiveFeedVideoPostId(null);
            return;
        }
        if (!feedAutoplayAllowedRef.current || !postId) {
            activeVideoPostIdRef.current = null;
            setActiveFeedVideoPostId(null);
            return;
        }
        // Same id already active — do not force-notify (that remounts/resumes ExoPlayer
        // when like/comment merely re-renders the FlatList / re-fires viewability).
        if (!force && String(activeVideoPostIdRef.current) === String(postId)) {
            return;
        }
        if (force && String(activeVideoPostIdRef.current) === String(postId)) {
            // Explicit scroll/focus restore of the same card — re-broadcast once.
            forceActiveFeedVideoPostId(postId);
            return;
        }
        const apply = () => {
            autoplayTimerRef.current = null;
            if (feedScrollingRef.current) return;
            if (feedAutoplayOverlayBlocks()) {
                activeVideoPostIdRef.current = null;
                setActiveFeedVideoPostId(null);
                return;
            }
            activeVideoPostIdRef.current = postId;
            if (force) {
                forceActiveFeedVideoPostId(postId);
            } else {
                setActiveFeedVideoPostId(postId);
            }
            lastFeedAutoplayAtMsRef.current = Date.now();
        };
        if (force) {
            apply();
            return;
        }
        const minGapMs = 0;
        const sinceLast = Date.now() - lastFeedAutoplayAtMsRef.current;
        const delayMs = sinceLast >= minGapMs ? 0 : minGapMs - sinceLast;
        autoplayTimerRef.current = setTimeout(apply, delayMs);
    }, []);

    const scheduleActiveFeedVideoRef = useRef(scheduleActiveFeedVideo);
    scheduleActiveFeedVideoRef.current = scheduleActiveFeedVideo;

    /** Longer than scrollEventThrottle (32ms) so throttled onScroll events cannot look like rest. */
    const FEED_SCROLL_SETTLE_MS = 60;

    /**
     * Drag-release velocity (points/ms, per Android VelocityHelper / UIKit) below which the
     * finger was lifted at rest — safe to start playback immediately without waiting a frame.
     * Above it a fling/momentum is likely, so we keep the gate and let momentum-end release it.
     */
    const FEED_SCROLL_REST_VELOCITY = 0.1;

    /**
     * Vertical displacement (points) the finger must travel before the list counts as
     * scrolling. Raw touch-down or light pressure must not gate the active decoder.
     */
    const FEED_SCROLL_TOUCH_SLOP = 6;

    const releaseFeedScroll = () => {
        if (feedScrollIdleTimerRef.current) {
            clearTimeout(feedScrollIdleTimerRef.current);
            feedScrollIdleTimerRef.current = null;
        }
        feedScrollingRef.current = false;
        feedScrollRestingRef.current = true;
        feedScrollRestOffsetRef.current = feedScrollYRef.current;
        // Re-baseline the strict displacement guard on every release path (including the
        // settle fallback for slow drags that never emit a momentum end) so a stale origin
        // can never make the next touch look like a large displacement.
        feedScrollDragOriginRef.current = feedScrollYRef.current;
        feedScrollDragMovedRef.current = false;
        if (feedAutoplayOverlayBlocks()) {
            // Release synchronously: a held player must resume on the same tick the gate
            // clears. Deferring it through a frame handed the resume to whichever work the
            // UI thread happened to be stuck on (measured ~200ms after a short drag).
            setFeedScrollBusy(false);
            return;
        }
        scheduleActiveFeedVideoRef.current(
            feedAutoplayAllowedRef.current ? lastViewableVideoPostIdRef.current : null,
            false,
        );
        setFeedScrollBusy(false);
    };

    /** Fallback for continuous slow drags that never emit a scroll/momentum end. */
    const armFeedScrollSettle = () => {
        if (feedScrollIdleTimerRef.current) clearTimeout(feedScrollIdleTimerRef.current);
        feedScrollIdleTimerRef.current = setTimeout(() => {
            feedScrollIdleTimerRef.current = null;
            releaseFeedScroll();
        }, FEED_SCROLL_SETTLE_MS);
    };

    const markFeedScrolling = (scrolling: boolean = true) => {
        if (autoplayTimerRef.current) {
            clearTimeout(autoplayTimerRef.current);
            autoplayTimerRef.current = null;
        }
        if (!scrolling) {
            // Definitive rest (momentum/scroll end): drop the fallback debounce and
            // hand playback to the top-most visible card now instead of waiting out
            // the trailing timer.
            releaseFeedScroll();
            return;
        }
        feedScrollRestingRef.current = false;
        // Deliberately do NOT clear the silent preload neighbor here. Trailing settle
        // scroll events (OPPO emits SCROLL_STATE_SETTLING ~200ms after the finger lifts)
        // re-enter this path and were dropping the just-warmed neighbor, forcing an
        // ExoPlayer Release + re-Init on the next settle (measured: an extra decode alloc
        // and a transient third decoder). The neighbor is anchored to the settled owner
        // instead (owner effect + releaseFeedScroll) and only changes when the owner
        // actually changes, so it never churns during a fling.
        // Deliberately do NOT pause the active card's decoder here. Dragging the list
        // must not interrupt the playing video; single-card playback is already
        // enforced by the viewport tracker (`setActiveFeedVideoPostId`), which stays
        // frozen while `feedScrollingRef` is true and re-picks the active card on
        // release. `feedScrollingRef` is still raised to suppress mid-drag remounts.
        feedScrollingRef.current = true;
        armFeedScrollSettle();
    };

    useEffect(() => {
        if (!feedAutoplayAllowed) {
            scheduleActiveFeedVideo(null);
        }
    }, [feedAutoplayAllowed, scheduleActiveFeedVideo]);

    // Silent preload surfaces must not exist while feed video is suspended (comments modal,
    // Scenes / image fullscreen, blurred feed) or autoplay is off. Clearing the store drops
    // the neighbor; the `suspendNativeVideo` prop independently gates the mount in FeedPostMedia.
    useEffect(() => {
        if (feedNativeVideoSuspended || !feedAutoplayAllowed) {
            setFeedPreloadPostIds([]);
        }
    }, [feedNativeVideoSuspended, feedAutoplayAllowed]);

    // Drop any warm neighbor when the feed unmounts so a later mount cannot inherit a stale id.
    useEffect(() => {
        return () => {
            setFeedPreloadPostIds([]);
        };
    }, []);

    const onViewableItemsChanged = useRef(
        ({
            viewableItems,
        }: {
            viewableItems: Array<{ isViewable?: boolean; item?: FeedListRow; index?: number | null }>;
        }) => {
            if (suppressFeedViewabilityRef.current) return;

            for (const token of viewableItems) {
                if (!token.isViewable || !token.item || token.item.kind !== 'post') continue;
                recordFeedViewRef.current(String(token.item.post.id));
            }
            if (!feedAutoplayAllowedRef.current) {
                setFeedAudioFocusPostId(null);
                setFeedPreloadPostIds([]);
                scheduleActiveFeedVideoRef.current(null);
                return;
            }
            feedViewabilitySeenRef.current = true;
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
            // While scrolling, always track the top-most qualifying video (no sticky) so
            // settle lands on what the user scrolled to. When idle, stick on the playing
            // card while it remains viewable so a peek of the next row can't steal it.
            let nextId: string | null = null;
            if (
                !feedScrollingRef.current &&
                currentId &&
                visibleVideos.some((v) => String(v.post.id) === String(currentId))
            ) {
                nextId = currentId;
            } else if (visibleVideos.length > 0) {
                nextId = visibleVideos[0].post.id;
            }

            lastViewableVideoPostIdRef.current = nextId;
            // Publish LIVE audio focus on every pass, including mid-fling. This is a
            // separate signal from the decoder/mount owner: it lets the outgoing card be
            // cut the instant it leaves primary focus and the incoming card start promptly,
            // without churning TextureViews (mount stays on the settle-driven active id).
            setFeedAudioFocusPostId(nextId);
            // NOTE: the silent preload neighbor is NOT published here. Viewability only
            // fires once a card is already ~60% on screen, so warming off it mounts the
            // neighbor far too late to matter and off the mid-fling candidate rather than
            // the settled owner. It is owner-anchored instead (see the preload effect near
            // `flatForRender`) and cleared while the list is in motion (markFeedScrolling).
            // While the finger is down or the list is flinging, only remember the
            // candidate. Mounting here creates and destroys ExoPlayer on every card.
            if (feedScrollingRef.current) return;
            scheduleActiveFeedVideoRef.current(nextId);
        }
    ).current;

    const viewabilityConfigCallbackPairs = useRef([
        {
            viewabilityConfig: viewabilityConfigRef.current,
            onViewableItemsChanged,
        },
    ]);

    useFocusEffect(
        useCallback(() => {
            // Scroll flags can stick true across navigations on some Android OEMs.
            feedScrollingRef.current = false;
            feedScrollRestingRef.current = false;
            feedScrollDragMovedRef.current = false;
            feedScrollDragOriginRef.current = feedScrollYRef.current;
            if (feedScrollIdleTimerRef.current) {
                clearTimeout(feedScrollIdleTimerRef.current);
                feedScrollIdleTimerRef.current = null;
            }
            setFeedScrollBusy(false);
            suppressFeedViewabilityRef.current = false;
            // Feed is frontmost again: release any held (paused) viewer surface so the
            // restore below can resume playback on this card instead of leaving it paused.
            setHeldVideoPostId(null);

            const scenesReturn = peekScenesReturnHandoff();
            // Prefer the post Scenes just closed on — not sticky pre-Scenes autoplay.
            if (scenesReturn?.postId) {
                lastViewableVideoPostIdRef.current = scenesReturn.postId;
                activeVideoPostIdRef.current = null; // force re-notify below
            }

            const restoreId =
                scenesReturn?.postId ?? lastViewableVideoPostIdRef.current;
            const pinnedY = scenesReturnScrollYRef.current;
            scenesReturnScrollYRef.current = null;

            const finishRestore = () => {
                if (feedAutoplayOverlayBlocks()) return;
                if (restoreId && feedAutoplayAllowedRef.current) {
                    // Force so blur→focus with the same post still remounts/plays.
                    activeVideoPostIdRef.current = null;
                    scheduleActiveFeedVideoRef.current(restoreId, true);
                }
                setTimeout(() => {
                    suppressFeedViewabilityRef.current = false;
                }, 160);
            };

            if (scenesReturn?.postId || pinnedY != null) {
                suppressFeedViewabilityRef.current = true;
                pinFeedScrollSoon(pinnedY ?? feedScrollYRef.current);
                requestAnimationFrame(() => {
                    pinFeedScrollSoon(pinnedY ?? feedScrollYRef.current);
                    finishRestore();
                });
            } else {
                // Resume autoplay immediately — do not wait for FlatList viewability
                // (that caused multi-second Scenes→feed MP4 lag).
                finishRestore();
            }
            return () => {
                if (autoplayTimerRef.current) {
                    clearTimeout(autoplayTimerRef.current);
                    autoplayTimerRef.current = null;
                }
                // Pause decode while covered (Scenes / profile). Keep lastViewable /
                // scenes handoff so focus restore is instant.
                activeVideoPostIdRef.current = null;
                setActiveFeedVideoPostId(null);
            };
        }, [pinFeedScrollSoon])
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

    const headerFeedScope = useMemo((): HeaderFeedScope => {
        if (showFollowingFeed || active === 'Following') return 'following';
        if (customLocation) return customFeedScope ?? 'national';
        const local = user?.local || 'Finglas';
        const regional = user?.regional || 'Dublin';
        const national = user?.national || 'Ireland';
        if (active === local) return 'local';
        if (active === regional) return 'regional';
        if (active === national) return 'national';
        return 'national';
    }, [
        active,
        customFeedScope,
        customLocation,
        showFollowingFeed,
        user?.local,
        user?.national,
        user?.regional,
    ]);

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

    // Reset to the top when the feed scope changes (e.g. Following -> Ireland).
    //
    // Implementation note: scrollToOffset alone is NOT sufficient here. The reload is
    // async, so a filter change scrolls the OLD rows to 0 first, and a second pass keyed
    // to the new row count also loses the race — the rows are variable height, so they
    // keep re-measuring as images/video metadata arrive and VirtualizedList re-anchors
    // contentOffset. Observed on device: both passes ran (traced), no scroll-pin path
    // interfered, and the list still settled mid-feed.
    //
    // So the list is remounted per scope via `key={feedScopeListKey}` below. A remount
    // guarantees a clean list whose contentOffset starts at 0, with no race against row
    // measurement. The scroll state this discards is the previous scope's position, which
    // we want gone; within-feed position (Scenes return, rail collapse snapshot, video
    // autoplay handoff) is owned by its own refs and re-establishes itself on return.
    const feedScopeListKey = feedFetchFilter;

    // Keep the mirrored offset honest across the remount so any pin/return path that
    // reads it cannot re-apply the previous scope's position.
    const feedScopeResetSeenRef = useRef(false);
    useEffect(() => {
        if (!feedScopeResetSeenRef.current) {
            feedScopeResetSeenRef.current = true;
            return;
        }
        feedScrollYRef.current = 0;
        feedScrollingRef.current = false;
        feedScrollRestingRef.current = false;
        if (feedScrollIdleTimerRef.current) {
            clearTimeout(feedScrollIdleTimerRef.current);
            feedScrollIdleTimerRef.current = null;
        }
    }, [feedFetchFilter]);

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

    // Helper to update a post in pages. Stable identity so bookmark/like callbacks
    // (and renderItem) do not churn when only one post's engagement fields change.
    const updatePost = React.useCallback((postId: string, updater: (post: Post) => Post) => {
        setPages(prev => prev.map(page =>
            page.map(p => p.id === postId ? updater(p) : p)
        ));
    }, []);

    const recordFeedView = useCallback(
        (postId: string) => {
            const id = String(postId || '');
            if (!id || recordedFeedViewIdsRef.current.has(id)) return;
            recordedFeedViewIdsRef.current.add(id);
            void incrementViews(userId, id)
                .then((updated) => {
                    const nextViews = updated?.stats?.views;
                    if (typeof nextViews !== 'number') return;
                    updatePost(id, (p) => ({
                        ...p,
                        stats: { ...p.stats, views: nextViews },
                    }));
                })
                .catch(() => {
                    recordedFeedViewIdsRef.current.delete(id);
                });
        },
        [userId],
    );
    recordFeedViewRef.current = recordFeedView;

/** Follow is per-author — keep every visible post for that handle in sync. */
      const patchFollowForHandle = React.useCallback(
          (handle: string | undefined, isFollowing: boolean, extras?: Partial<Post>) => {
              const lower = String(handle || '')
                  .trim()
                  .toLowerCase();
              if (!lower) return;
              setPages((prev) =>
                  prev.map((page) =>
                      page.map((p) =>
                          String(p.userHandle || '')
                              .trim()
                              .toLowerCase() === lower
                              ? ({ ...p, ...extras, isFollowing } as Post)
                              : p,
                      ),
                  ),
              );
          },
          [],
      );

      // Global follow-state bus: a follow/unfollow on View Profile (or anywhere else)
      // patches every visible post for that author so headers, quick menus and DM
      // gates stay in sync without a feed refetch.
      useEffect(() => {
          return onFollowStatusChanged((payload) => {
              patchFollowForHandle(payload.handle, payload.isFollowing === true, {
                  ...(payload.hasPendingRequest != null
                      ? { isFollowRequested: payload.hasPendingRequest }
                      : {}),
              } as Partial<Post>);
          });
      }, [patchFollowForHandle]);

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
            const idKey = String(target.id);
            const prevSaved = savedByPostIdRef.current[idKey] ?? target.isBookmarked === true;
            const nextSaved = !prevSaved;
            // Optimistic flip: reflect the tap in the card icon immediately, before the
            // Laravel request round-trips. Rolled back below if the request fails.
            setSavedByPostId((prev) => {
                const next = { ...prev, [idKey]: nextSaved };
                savedByPostIdRef.current = next;
                return next;
            });
            updatePost(target.id, (p) => ({ ...p, isBookmarked: nextSaved }));
            try {
                if (nextSaved) {
                    await savePostToDefaultCollection(userId, target.id, target);
                } else {
                    await unsavePost(userId, target.id);
                }
            } catch (err) {
                console.error('Collections save toggle failed:', err);
                setSavedByPostId((prev) => {
                    const next = { ...prev, [idKey]: prevSaved };
                    savedByPostIdRef.current = next;
                    return next;
                });
                updatePost(target.id, (p) => ({ ...p, isBookmarked: prevSaved }));
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

    const openShareToStoriesForPost = React.useCallback(
        (post: Post) => {
            pinFeedScrollSoon();
            setShareToStoriesPost(post);
        },
        [pinFeedScrollSoon],
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

    /**
     * Last `resetHomeFeedAt` token this screen has already acted on.
     *
     * The reset token is normally cleared again below, but React Navigation can leave it on
     * the route when `setParams` is dispatched while this navigator is detached — which is
     * exactly what happens as the Home stack is rebuilt on the way back from Stories. A token
     * that survives then re-runs this effect on every remount (re-fetching and clearing the
     * feed repeatedly) *and* re-dispatches the unhandled `SET_PARAMS`, so consumption is
     * tracked separately from the navigator-facing clear.
     */
    const consumedResetHomeFeedTokenRef = React.useRef<number | string | null>(null);

    /** Footer Home tab — same as web `goHomeFeed` / `resetFeed`. */
    useEffect(() => {
        const token = route?.params?.resetHomeFeedAt;
        if (token == null) return;
        if (consumedResetHomeFeedTokenRef.current === token) return;
        consumedResetHomeFeedTokenRef.current = token;
        void (async () => {
            await clearPendingLocationFeed();
            setShowFollowingFeed(false);
            setActive(user?.national || defaultNational);
            setCustomLocation(null);
            setCustomLocationLabel(null);
            setCustomLocationPlaceId(null);
            setCustomFilterType(null);
            setCustomFeedScope(null);
            setPages([]);
            setCursor(0);
            setEnd(false);
            setError(null);
            setReloadTick((t) => t + 1);
        })();
    }, [route?.params?.resetHomeFeedAt, user?.national, defaultNational]);

    /**
     * Clear the reset/location params once this screen is focused again.
     *
     * `SET_PARAMS` only reaches a navigator while the route is attached to it. Dispatching
     * while the Home stack is detached (mid-return from Stories) produces React Navigation's
     * "was not handled by any navigator" warning, so the clear waits for focus — at which
     * point the navigator is guaranteed to be mounted and consuming params again. Deferring
     * is safe because the reset itself is idempotent and already handled above.
     */
    useEffect(() => {
        if (!isFeedFocused) return;
        const token = route?.params?.resetHomeFeedAt;
        if (token == null) return;
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
    }, [isFeedFocused, route?.params?.resetHomeFeedAt, navigation]);

    useEffect(() => {
        // A live Home-tab reset token must win; null/undefined means apply location.
        if (route?.params?.resetHomeFeedAt != null) return;
        const requestedLocation = route?.params?.location;
        const requestedLabel = route?.params?.locationLabel;
        const requestedPlaceId = route?.params?.placeId;
        const requestedFilterType = route?.params?.filterType as 'location' | 'venue' | 'landmark' | undefined;
        const requestedScope = route?.params?.locationScope;
        const feedScope =
            requestedScope === 'local' || requestedScope === 'regional' || requestedScope === 'national'
                ? requestedScope
                : null;
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
        setCustomFeedScope(feedScope);
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
        // Drop previous feed cards immediately so home posts never flash under a foreign place header.
        setPages([]);
        setCursor(0);
        setEnd(false);
        setReloadTick((t) => t + 1);
    }, [
        route?.params?.location,
        route?.params?.locationLabel,
        route?.params?.filterType,
        route?.params?.locationScope,
        route?.params?.placeId,
        route?.params?.resetHomeFeedAt,
    ]);

    const pendingLivePostsRef = useRef<Post[]>([]);

    const flushLiveDrops = useCallback(() => {
        const incoming = pendingLivePostsRef.current;
        if (incoming.length === 0) {
            setLiveDropBadge(0);
            return;
        }
        pendingLivePostsRef.current = [];
        setLiveDropBadge(0);
        setPages((prev) => {
            const seen = new Set(prev.flat().map((p) => String(p.id)));
            const fresh = incoming.filter((p) => !seen.has(String(p.id)));
            if (fresh.length === 0) return prev;
            if (prev.length === 0) return [fresh];
            const [first, ...rest] = prev;
            return [[...fresh, ...first], ...rest];
        });
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, []);

    useEffect(() => {
        pendingLivePostsRef.current = [];
        setLiveDropBadge(0);
    }, [customLocation, customLocationPlaceId, active, showFollowingFeed]);

    useEffect(() => {
        if (!user?.handle || showFollowingFeed) return;
        const room = customLocationPlaceId
            ? { placeId: customLocationPlaceId }
            : { location: customLocation || active };
        if (!locationFeedRoomKey(room)) return;
        const socket = connectSocket(user.handle);
        joinLocationFeed(room);

        const onNewFeedPost = (data: any) => {
            const raw = data?.post;
            if (!raw || typeof raw !== 'object' || !raw.id) return;
            const post = decorateForUser(userId, raw);
            const feedTab = String(customLocation || active || '').trim();
            if (feedTab && feedTab.toLowerCase() !== 'discover') {
                const placeMatch =
                    customLocationPlaceId &&
                    String(post.placeId || '').trim() === String(customLocationPlaceId).trim();
                if (!placeMatch && !postMatchesLocationTab(post, feedTab)) return;
            }
            const alreadyVisible = pagesRef.current
                .flat()
                .some((p) => String(p.id) === String(post.id));
            if (alreadyVisible) return;
            if (pendingLivePostsRef.current.some((p) => String(p.id) === String(post.id))) return;
            if (feedScrollYRef.current < 80) {
                setPages((prev) => {
                    if (prev.flat().some((p) => String(p.id) === String(post.id))) return prev;
                    if (prev.length === 0) return [[post]];
                    const [first, ...rest] = prev;
                    return [[post, ...first], ...rest];
                });
                return;
            }
            pendingLivePostsRef.current = [post, ...pendingLivePostsRef.current];
            setLiveDropBadge(pendingLivePostsRef.current.length);
        };

        socket?.on('newFeedPost', onNewFeedPost);
        const busSub = DeviceEventEmitter.addListener('newFeedPost', onNewFeedPost);
        return () => {
            socket?.off('newFeedPost', onNewFeedPost);
            busSub.remove();
            leaveLocationFeed(room);
        };
    }, [
        user?.handle,
        userId,
        showFollowingFeed,
        customLocation,
        customLocationPlaceId,
        active,
    ]);

    useEffect(() => {
        pagesRef.current = pages;
        for (const p of pages.flat()) {
            lastEngagementByIdRef.current.set(String(p.id), {
                stats: p.stats,
                userLiked: p.userLiked,
            });
        }
    }, [pages]);

    // Live mode: strip cached Sarah/Bob seed posts once on mount, then refresh.
    useEffect(() => {
        if (isMockMode()) return;
        let cancelled = false;
        void (async () => {
            try {
                await clearLocalFeedPostsStorage();
            } catch {
                /* ignore */
            }
            if (!cancelled) setReloadTick((t) => t + 1);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

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
                    const next = updates.find((u) => String(u.id) === String(p.id));
                    if (!next) return p;
                    return {
                        ...p,
                        ...next,
                        userLiked: next.userLiked === true,
                        stats: { ...p.stats, ...next.stats },
                    };
                }),
            ),
        );
        for (const next of updates) {
            upsertLocalPost(next);
            syncFullscreenPost(next);
        }
        // Keep the same viewport after post patches remount/remeasure rows.
        pinFeedScrollSoon(pinnedY);
    }, [pinFeedScrollSoon, syncFullscreenPost]);

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
            const feedTab = String(feedFetchCtxRef.current.filter || '').trim();
            // Never pin a new post onto a foreign location feed (Rome/Berlin ≠ Finglas).
            if (feedTab && feedTab.toLowerCase() !== 'discover' && !postMatchesLocationTab(decorated, feedTab)) {
                setPendingUploadTick((tick) => tick + 1);
                return;
            }
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
            const feedTab = String(feedFetchCtxRef.current.filter || '').trim();
            const recent = recentCreatedPostsRef.current
                .map((p) => {
                    const live = getLocalPostById(p.id);
                    const merged = live
                        ? {
                              ...p,
                              ...live,
                              stats: { ...p.stats, ...live.stats },
                          }
                        : p;
                    return decorateForUser(userId, merged);
                })
                .filter((p) => {
                    if (!feedTab || feedTab.toLowerCase() === 'discover') return true;
                    return postMatchesLocationTab(p, feedTab);
                });
            recentCreatedPostsRef.current = recent;
            const recentIds = new Set(recent.map((p) => String(p.id)));
            const withoutDupes = items.filter((p) => !recentIds.has(String(p.id)));
            let merged = recent.length > 0 ? [...recent, ...withoutDupes] : items;
            // Keep counters already shown this session when Laravel still returns 0.
            // Home clears `pages` before refetch, so do not read pagesRef here.
            merged = merged.map((p) => {
                const prev = lastEngagementByIdRef.current.get(String(p.id));
                if (!prev) return p;
                return {
                    ...p,
                    userLiked: p.userLiked === true || prev.userLiked === true,
                    stats: mergeEngagementStats(p.stats, prev.stats),
                };
            });
            // Hard guard: never render a card on a place feed unless author location matches.
            if (isLocationScopedFeedTab(feedTab)) {
                const leaks = findLocationFeedLeaks(merged, feedTab);
                if (leaks.length > 0) {
                    console.warn(
                        `[location-guard] blocked ${leaks.length} post(s) from "${feedTab}":`,
                        leaks.slice(0, 8).join(', '),
                    );
                }
                merged = filterPostsForLocationFeed(merged, feedTab);
            }
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
        [userId],
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
                // Soft-fail only: don't poison the whole session so login/upload keep working.
                console.warn('[FeedScreen] feed load failed (Laravel still enabled for auth/upload)');
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
        if (loadingMoreRef.current) return;
        if (initialLoading || end || cursor === null) {
            return;
        }
        loadingMoreRef.current = true;
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
                const feedTab = String(feedFetchCtxRef.current.filter || '').trim();
                const safeAppended = isLocationScopedFeedTab(feedTab)
                    ? filterPostsForLocationFeed(appended, feedTab)
                    : appended;
                if (safeAppended.length === 0) {
                    setCursor(walkCursor);
                    setEnd(walkCursor == null);
                    return;
                }
                setPages((prev) => [...prev, safeAppended]);
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
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [buildFeedFetchParams, cursor, end, initialLoading]);

    // Mask the previous scope the instant the location/scope changes: clear the cards and
    // show the pulsing skeleton until the new page lands. The list is keyed by
    // `feedScopeListKey`, so this never leaves stale posts under the new location pill.
    const prevFeedScopeRef = useRef(feedFetchFilter);
    useEffect(() => {
        if (prevFeedScopeRef.current === feedFetchFilter) return;
        prevFeedScopeRef.current = feedFetchFilter;
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
        setInitialLoading(true);
    }, [feedFetchFilter]);

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
            setCustomFeedScope(null);
            setActive('Following'); // Set active to Following so it's highlighted
        } else {
            setShowFollowingFeed(false);
            setCustomLocation(null);
            setCustomLocationLabel(null);
            setCustomLocationPlaceId(null);
            setCustomFilterType(null);
            setCustomFeedScope(null);
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
            setCustomFeedScope(selection.scope);
            setCustomLocation(selection.filter);
            setCustomLocationLabel(selection.label);
            setCustomLocationPlaceId(selection.placeId?.trim() || null);
            setCustomFilterType(filterType);
            setError(null);
            setPages([]);
            setCursor(0);
            setEnd(false);
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
            const typed: LocationSuggestion =
                filterType === 'venue' || filterType === 'landmark'
                    ? { ...suggestion, type: filterType }
                    : suggestion;
            if (filterType === 'location' && getPlaceFeedPickerOptions(typed)) {
                setHeaderScopePicker(typed);
                setHeaderScopePickerKind(filterType);
                return;
            }
            applyCustomLocationFeed(resolvePlaceFeedSelection(typed), filterType);
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
        setCustomFeedScope(null);
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

    const showStories24Rail = stories24Items.length > 0;

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
                items = await buildStories24RailItems(user.id, user.handle, user.avatarUrl);
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
        return [...source]
            .sort((a, b) => String(a.id).localeCompare(String(b.id)))
            .slice(0, 8);
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
            return [...matched]
                .sort((a, b) => String(a.post.id).localeCompare(String(b.post.id)))
                .slice(0, 3);
        }
        return [...posts]
            .sort((a, b) => String(a.id).localeCompare(String(b.id)))
            .slice(0, 3)
            .map((post) => ({
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
        // Rail is pinned to index 0 (above post #1), so it is never injected mid-loop.
        if (showStories24Rail) {
            out.push({ kind: 'stories24', id: 'stories24-feed-rail' });
            out.push({ kind: 'stories24_divider', id: 'stories24-feed-divider' });
        }
        for (const item of flatWithSuggested) {
            if (item.type === 'post') {
                out.push({ kind: 'post', post: item.item });
                postCount += 1;
                // Inline Stories promo replaces the old header pill: every 10 posts.
                if (
                    !customLocation &&
                    postCount > STORIES24_PROMO_EVERY_POSTS &&
                    postCount % STORIES24_PROMO_EVERY_POSTS === 0
                ) {
                    out.push({ kind: 'stories_promo', id: `stories-promo-${postCount}` });
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

    /**
     * FlatList `extraData` signature: row ids PLUS every post's intrinsic dims.
     *
     * `extraData` is the list's "the data didn't change identity but the cells must
     * re-render anyway" signal. Encoding each post's width/height (and per-slide
     * dims) means a dimension arriving or changing for one post re-renders its cell
     * with the correct aspect box instead of letting a recycled landscape height
     * bleed onto the following portrait rows. Keys stay per-post (`post:<id>` in
     * keyExtractor), and there is deliberately NO getItemLayout: card heights are
     * content-driven/dynamic, so a fixed layout map would snap offsets.
     */
    const feedExtraData = React.useMemo(() => {
        const dims = flatForRender
            .map((row) =>
                row.kind === 'post'
                    ? `${row.post.id}:${row.post.width ?? ''}x${row.post.height ?? ''}:` +
                      (row.post.mediaItems ?? [])
                          .map((i) => `${i.width ?? ''}x${i.height ?? ''}`)
                          .join(',')
                    : row.kind,
            )
            .join('|');
        return `${pendingUploadTick}-${refreshing}-${isFeedFocused}-${commentsModalOpen}-${dims}`;
    }, [flatForRender, pendingUploadTick, refreshing, isFeedFocused, commentsModalOpen]);

    flatForRenderRef.current = flatForRender;

    // Track the LIVE audio focus so the silent preload can be anchored to whatever card the
    // viewport currently considers primary (the same signal that drives playback). The
    // neighbor is always "the card after the focused one", so it can never disagree with
    // the playing card and a handoff never has to clear + re-warm the surface.
    const feedAudioFocusPostIdRef = useRef<string | null>(null);

    // Focus-anchored silent preload: keep exactly ONE upcoming video neighbor's native
    // surface warming (mounted, prepared, buffered — paused + muted) so settling onto it
    // plays instantly from frame 0 with no re-create / re-buffer. Anchored to the LIVE
    // audio focus (the same signal that drives playback), so the warm target always agrees
    // with the playing card; the neighbor is simply "the next video after the focused one".
    // It is republished only when focus moves — `setFeedPreloadPostIds` bails on identical
    // content — so there is no per-frame state thrash.
    useEffect(() => {
        if (!feedAutoplayAllowed) return;
        if (feedNativeVideoSuspended || feedAutoplayOverlayBlocks()) return;
        const anchor = feedAudioFocusPostIdRef.current;
        if (!anchor) return;
        setFeedPreloadPostIds(nextPreloadNeighborIds(flatForRender, anchor));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        activeVideoPostId,
        flatForRender,
        feedAutoplayAllowed,
        feedNativeVideoSuspended,
        feedAutoplayOverlayBlocks,
    ]);

    // Re-run the focus-anchored preload whenever the live audio focus changes. During a
    // fling focus changes every frame; publishing the (often empty) mid-travel neighbor set
    // churned the warm surface off and on and forced a decoder re-Init on the next settle.
    // So we only publish a NON-empty neighbor here; an empty result leaves the last warm
    // target in place until the next real anchor. The set is still cleared explicitly on
    // suspend / autoplay-off / unmount.
    useEffect(
        () =>
            subscribeFeedAudioFocusPostId((id) => {
                feedAudioFocusPostIdRef.current = id;
                if (!feedAutoplayAllowedRef.current) return;
                const next = nextPreloadNeighborIds(flatForRenderRef.current, id);
                if (next.length === 0) return;
                setFeedPreloadPostIds(next);
            }),
        [],
    );

    // Recover an empty/errored feed once the connection comes back. NetInfo stays
    // "connected" when only a local port-forward (adb reverse) drops, so we also retry
    // whenever the screen refocuses or the app returns to the foreground with no posts.
    // Guarded on an empty feed so we never clobber a populated one — resetting the feed
    // on focus previously raced loadMore and left the feed blank. We check the post rows
    // (not the rendered list) because chrome rows like the Stories rail are always present.
    const feedPostCountRef = React.useRef(0);
    feedPostCountRef.current = pages.flat().length;

    const prevOnlineRef = React.useRef(online);
    React.useEffect(() => {
        const reconnected = prevOnlineRef.current === false && online;
        prevOnlineRef.current = online;
        if (reconnected && feedPostCountRef.current === 0) {
            setReloadTick((t) => t + 1);
        }
    }, [online]);

    const feedFocusPrimedRef = React.useRef(false);
    useFocusEffect(
        React.useCallback(() => {
            if (!feedFocusPrimedRef.current) {
                // The mount fetch effect already loads the first page.
                feedFocusPrimedRef.current = true;
                return;
            }
            if (feedPostCountRef.current === 0) {
                setReloadTick((t) => t + 1);
            }
        }, []),
    );

    const feedAppStateRef = React.useRef(AppState.currentState);
    React.useEffect(() => {
        const sub = AppState.addEventListener('change', (next) => {
            const resumed = feedAppStateRef.current !== 'active' && next === 'active';
            feedAppStateRef.current = next;
            if (resumed && feedPostCountRef.current === 0) {
                setReloadTick((t) => t + 1);
            }
        });
        return () => sub.remove();
    }, []);

    // First-paint bootstrap only. Like/comment patch `pages` → new `flat` identity;
    // that must NEVER re-arm a player. After viewability has spoken, it owns autoplay.
    const feedHasPosts = flat.length > 0;
    React.useEffect(() => {
        if (feedHasPosts) return;
        feedViewabilitySeenRef.current = false;
        lastViewableVideoPostIdRef.current = null;
    }, [feedHasPosts]);

    // Warm the poster cache while a post is still several screens away. FeedPostMedia also
    // prefetches on cell mount, but that races the first paint: starting the prefetch when
    // the row ENTERS the render window is too late for a cold thumbnail. Kicking it off the
    // moment the feed data lands means by the time a card scrolls into view its poster is
    // already in memory, so the overlay paints instantly and the crossfade has no stall.
    const prefetchedPosterUrlsRef = useRef<Set<string>>(new Set());
    React.useEffect(() => {
        for (const row of flatForRender) {
            if (row.kind !== 'post') continue;
            for (const item of row.post.mediaItems ?? []) {
                const poster = resolveFeedVideoPosterUri(item, row.post);
                if (!poster || !/^https?:\/\//i.test(poster)) continue;
                if (prefetchedPosterUrlsRef.current.has(poster)) continue;
                prefetchedPosterUrlsRef.current.add(poster);
                void Image.prefetch(poster).catch(() => {});
            }
        }
        // Dedupe runs forever: a poster is fetched once per app session, and this effect
        // re-runs on every `flatForRender` change (likes, comment counts, pagination).
    }, [flatForRender]);
    React.useEffect(() => {
        if (!isFeedFocused || scenesViewerActive || Boolean(imageFullscreenPost) || commentsModalOpen) {
            return;
        }
        if (!feedAutoplayAllowed || !feedHasPosts) return;
        if (activeVideoPostIdRef.current) return;
        // Once FlatList viewability has run, stay quiet — do not invent playback from data updates.
        if (feedViewabilitySeenRef.current) return;
        const preferred = lastViewableVideoPostIdRef.current;
        if (!preferred) return;
        const t = setTimeout(() => {
            if (activeVideoPostIdRef.current) return;
            if (feedAutoplayOverlayBlocks()) return;
            if (!feedAutoplayAllowedRef.current) return;
            if (feedViewabilitySeenRef.current) return;
            scheduleActiveFeedVideoRef.current(String(preferred), true);
        }, 200);
        return () => clearTimeout(t);
    }, [
        isFeedFocused,
        scenesViewerActive,
        imageFullscreenPost,
        commentsModalOpen,
        feedAutoplayAllowed,
        feedHasPosts,
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
    // id → position in videoPostsForScenes. Lets onOpenScenes patch the tapped post in a
    // single slice() instead of an O(n) .some()+.map() sweep on the tap frame.
    const videoPostIndexById = React.useMemo(() => {
        const index = new Map<string, number>();
        videoPostsForScenes.forEach((p, i) => index.set(String(p.id), i));
        return index;
    }, [videoPostsForScenes]);

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
                patchFollowForHandle(post.userHandle, updated.isFollowing === true, {
                    isFollowRequested,
                } as Partial<Post>);
            } catch (err) {
                console.error('Follow from suggestion card failed:', err);
            }
        },
        [user, userId, patchFollowForHandle],
    );

    const syncFullscreenPost = React.useCallback((updated: Post) => {
        const updatedId = String(updated.id);
        setImageFullscreenPost((prev) =>
            prev && String(prev.id) === updatedId ? { ...prev, ...updated } : prev,
        );
        setSelectedPostForComments((prev) =>
            prev && String(prev.id) === updatedId ? { ...prev, ...updated } : prev,
        );
    }, []);

    /** Write a like through the feed rows, the open modal, and the in-memory store. */
    const patchFeedPostLike = React.useCallback(
        (postId: string, userLiked: boolean, likes: number, source?: Post | null) => {
            const id = String(postId);
            const count = Math.max(0, likes);
            setPages((prev) =>
                prev.map((page) =>
                    page.map((p) =>
                        String(p.id) === id
                            ? {
                                  ...p,
                                  userLiked,
                                  stats: { ...p.stats, likes: count },
                              }
                            : p,
                    ),
                ),
            );
            recentCreatedPostsRef.current = recentCreatedPostsRef.current.map((p) =>
                String(p.id) === id
                    ? { ...p, userLiked, stats: { ...p.stats, likes: count } }
                    : p,
            );
            const base = source ?? getLocalPostById(id);
            if (base) {
                const settled = {
                    ...base,
                    userLiked,
                    stats: { ...base.stats, likes: count },
                };
                upsertLocalPost(settled);
                syncFullscreenPost(settled);
            } else {
                setImageFullscreenPost((prev) =>
                    prev && String(prev.id) === id
                        ? { ...prev, userLiked, stats: { ...prev.stats, likes: count } }
                        : prev,
                );
            }
        },
        [syncFullscreenPost],
    );

    /**
     * Host wiring for the fullscreen route. Built once per open and handed to the viewer
     * through the in-memory bridge; each handler reads `imageFullscreenPostRef` so it always
     * acts on the current post even though the closure was captured at open time.
     */
    const buildFullscreenHandlers = React.useCallback(
        (): ImageFullscreenHandlers => ({
            onClose: () => {
                imageFullscreenOpenRef.current = false;
                imageFullscreenOpenIdRef.current = null;
                const y = feedScrollYRef.current;
                setImageFullscreenPost(null);
                setImageFullscreenStartIndex(0);
                restoreFeedVideoAfterOverlay();
                pinFeedScrollSoon(y);
            },
            onLike: async () => {
                const p = imageFullscreenPostRef.current;
                if (!p) return;
                const postId = String(p.id);
                const prevLiked = p.userLiked === true;
                const prevLikes = p.stats?.likes ?? 0;
                const nextLiked = !prevLiked;
                const nextLikes = Math.max(0, prevLikes + (nextLiked ? 1 : -1));
                patchFeedPostLike(postId, nextLiked, nextLikes, p);
                try {
                    const updated = await toggleLike(userId, p.id, p);
                    const settledLiked = updated.userLiked ?? nextLiked;
                    const settledLikes = Math.max(
                        0,
                        typeof updated.stats?.likes === 'number' ? updated.stats.likes : nextLikes,
                    );
                    patchFeedPostLike(postId, settledLiked, settledLikes, updated);
                } catch {
                    patchFeedPostLike(postId, prevLiked, prevLikes, p);
                }
            },
            onComment: () => {
                const p = imageFullscreenPostRef.current;
                if (!p) return;
                captureOverlayVideoResume(p);
                commentsModalOpenRef.current = true;
                setSelectedPostId(p.id);
                setSelectedPostForComments(p);
                setCommentsModalOpen(true);
            },
            onReclip: async () => {
                const p = imageFullscreenPostRef.current;
                if (!p) return;
                await tryReclipPost(p);
                const refreshed = getLocalPostById(p.id);
                if (refreshed) syncFullscreenPost(refreshed);
            },
            onShare: () => {
                const p = imageFullscreenPostRef.current;
                if (!p) return;
                void openShareForPost(p);
            },
            onFollow: async () => {
                const p = imageFullscreenPostRef.current;
                if (!p || !user?.handle || p.userHandle === user.handle) return;
                const updated = await toggleFollowForPost(userId, p.id, p.userHandle, user.handle);
                const nextFollowing = updated.isFollowing === true;
                const isFollowRequested = Boolean(
                    !nextFollowing &&
                        user.handle &&
                        isProfilePrivate(p.userHandle) &&
                        hasPendingFollowRequest(user.handle, p.userHandle),
                );
                patchFollowForHandle(p.userHandle, nextFollowing, {
                    isFollowRequested,
                } as Partial<Post>);
                syncFullscreenPost({
                    ...p,
                    ...updated,
                    isFollowing: nextFollowing,
                    isFollowRequested,
                } as Post);
            },
            onVisitProfile: () => {
                const p = imageFullscreenPostRef.current;
                if (!p) return;
                const handle = p.userHandle;
                const sourcePostId = p.id;
                const isFollowing = p.isFollowing === true;
                navigation.goBack();
                navigation.navigate('ViewProfile', { handle, sourcePostId, isFollowing });
            },
            onMenu: () => {
                const p = imageFullscreenPostRef.current;
                if (!p) return;
                setOverflowPost(p);
                setOverflowVisible(true);
            },
        }),
        [
            captureOverlayVideoResume,
            navigation,
            openShareForPost,
            patchFeedPostLike,
            patchFollowForHandle,
            pinFeedScrollSoon,
            restoreFeedVideoAfterOverlay,
            syncFullscreenPost,
            tryReclipPost,
            userId,
            user?.handle,
        ],
    );

    // Mirror live post mutations into the bridge so an open viewer re-renders (like/follow/reclip).
    React.useEffect(() => {
        if (imageFullscreenPost) {
            updateImageFullscreenPost(imageFullscreenPost);
        }
    }, [imageFullscreenPost]);

    // Memoize renderItem to prevent recreation on every render
    const renderItem = React.useCallback(
        ({ item, index }: { item: FeedListRow; index: number }) => {
            const prevKind = flatForRenderRef.current[index - 1]?.kind;
            const afterStoriesDivider = prevKind === 'stories24_divider';
            const wrapRow = (row: React.ReactElement, extraStyle?: object) => (
                <Reanimated.View
                    collapsable={false}
                    entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
                    style={[
                        styles.feedListRow,
                        item.kind === 'stories24' ? styles.feedListRowStories : null,
                        item.kind === 'stories24_divider' ? styles.feedListRowStoriesDivider : null,
                        afterStoriesDivider ? styles.feedListRowAfterStories : null,
                        extraStyle,
                    ]}
                >
                    {row}
                </Reanimated.View>
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
                                patchFollowForHandle(post.userHandle, updated.isFollowing === true, {
                                    isFollowRequested,
                                } as Partial<Post>);
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
            if (item.kind === 'stories_promo') {
                return wrapRow(
                    <StoriesPromoCard
                        onPress={() => {
                            void openStories24FromHeader();
                        }}
                        storyCount={stories24Items.length}
                        stories={stories24Items.filter(
                            (s) => !isStories24AddYoursHandle(s.handle),
                        )}
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
            if (item.kind === 'stories24_divider') {
                return wrapRow(
                    <View
                        collapsable={false}
                        pointerEvents="none"
                        style={styles.storiesRailSeparator}
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
                isBookmarked: savedByPostIdRef.current[post.id] ?? post.isBookmarked,
            };
            const isPendingUpload =
                mergedPost.clientUploadStatus === 'uploading' ||
                mergedPost.clientUploadStatus === 'failed';
            return wrapRow(
                <FeedCard
                    key={mergedPost.id}
                    post={mergedPost}
                    feedVideoMuted={feedVideoMuted}
                    suspendNativeVideo={feedNativeVideoSuspended}
                    holdNativeVideo={
                        heldVideoPostId != null &&
                        String(mergedPost.id) === heldVideoPostId
                    }
                    onLike={async () => {
                        if (isPendingUpload) return;
                        const postId = String(mergedPost.id);
                        const prevLiked = mergedPost.userLiked === true;
                        const prevLikes = mergedPost.stats?.likes ?? 0;
                        // Freeze viewability scheduling while this like commits. The optimistic
                        // setPages swaps FlatList data identity and can re-fire
                        // onViewableItemsChanged while a just-mounted card is still settling in
                        // the render window; if that pass reads the card as momentarily
                        // non-viewable, the active id blips to null/neighbor → TextureView
                        // unmount/remount → clip restarts from 0 (nothing ≥0.05s to resume on
                        // first double-tap). Suppressing for one frame keeps the player in place.
                        suppressFeedViewabilityRef.current = true;
                        requestAnimationFrame(() => {
                            suppressFeedViewabilityRef.current = false;
                        });
                        // Optimistic like-only patch — avoid full post replace (layout churn).
                        setPages((prev) =>
                            prev.map((page) =>
                                page.map((p) =>
                                    String(p.id) === postId
                                        ? {
                                              ...p,
                                              userLiked: !prevLiked,
                                              stats: {
                                                  ...p.stats,
                                                  likes: Math.max(0, prevLikes + (prevLiked ? -1 : 1)),
                                              },
                                          }
                                        : p,
                                ),
                            ),
                        );
                        try {
                            const updated = await toggleLike(userId, mergedPost.id, mergedPost);
                            const nextLiked = updated.userLiked ?? !prevLiked;
                            const nextLikes = Math.max(
                                0,
                                typeof updated.stats?.likes === 'number'
                                    ? updated.stats.likes
                                    : prevLikes + (prevLiked ? -1 : 1),
                            );
                            setPages((prev) =>
                                prev.map((page) =>
                                    page.map((p) =>
                                        String(p.id) === postId
                                            ? {
                                                  ...p,
                                                  userLiked: nextLiked,
                                                  stats: {
                                                      ...p.stats,
                                                      likes: nextLikes,
                                                  },
                                              }
                                            : p,
                                    ),
                                ),
                            );
                            recentCreatedPostsRef.current = recentCreatedPostsRef.current.map((p) =>
                                String(p.id) === postId
                                    ? {
                                          ...p,
                                          userLiked: nextLiked,
                                          stats: { ...p.stats, likes: nextLikes },
                                      }
                                    : p,
                            );
                            const settledPost = {
                                ...mergedPost,
                                ...updated,
                                userLiked: nextLiked,
                                stats: { ...mergedPost.stats, ...updated.stats, likes: nextLikes },
                            };
                            syncFullscreenPost(settledPost);
                            // Keep the shared in-memory store fresh so PostDetail's
                            // getPostById resolves this like without a server round trip.
                            upsertLocalPost(settledPost);
                        } catch {
                            setPages((prev) =>
                                prev.map((page) =>
                                    page.map((p) =>
                                        String(p.id) === postId
                                            ? {
                                                  ...p,
                                                  userLiked: prevLiked,
                                                  stats: { ...p.stats, likes: prevLikes },
                                              }
                                            : p,
                                    ),
                                ),
                            );
                        }
                    }}
                    onLikePersisted={(likePostId, updated) => {
                        // Media-card double-taps toggle locally in FeedCard and only touch
                        // `pages` here, once the backend has answered — never on the tap frame.
                        const userLiked = updated.userLiked === true;
                        setPages((prev) =>
                            prev.map((page) =>
                                page.map((p) =>
                                    String(p.id) === likePostId
                                        ? {
                                              ...p,
                                              userLiked,
                                              stats: { ...p.stats, ...updated.stats },
                                          }
                                        : p,
                                ),
                            ),
                        );
                        recentCreatedPostsRef.current = recentCreatedPostsRef.current.map((p) =>
                            String(p.id) === likePostId
                                ? { ...p, userLiked, stats: { ...p.stats, ...updated.stats } }
                                : p,
                        );
                        const settledPost = {
                            ...mergedPost,
                            ...updated,
                            userLiked,
                            stats: { ...mergedPost.stats, ...updated.stats },
                        };
                        syncFullscreenPost(settledPost);
                        // Same as above: give PostDetail's getPostById a fresh local copy.
                        upsertLocalPost(settledPost);
                    }}
                    onLikeBurst={showFeedLikeBurst}
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
                            patchFollowForHandle(mergedPost.userHandle, updated.isFollowing === true, {
                                isFollowRequested,
                            } as Partial<Post>);
                        } catch (err) {
                            console.error('Error toggling follow in FeedScreen:', err);
                            patchFollowForHandle(
                                mergedPost.userHandle,
                                !(mergedPost.isFollowing === true),
                            );
                        }
                        if (showFollowingFeed || currentFilter.toLowerCase() === 'discover') {
                            setReloadTick((t) => t + 1);
                        }
                    }}
                    onView={async () => {
                        if (isPendingUpload) return;
                        recordFeedView(mergedPost.id);
                    }}
                    onComment={() => {
                        if (isPendingUpload) return;
                        captureOverlayVideoResume(mergedPost);
                        commentsModalOpenRef.current = true;
                        activeVideoPostIdRef.current = null;
                        setActiveFeedVideoPostId(null);
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
                    onOpenImageFullscreen={(startIndex = 0, origin = null, engagement) => {
                        if (isPendingUpload) return;
                        // Stop any feed video audio before image fullscreen / like re-renders.
                        if (autoplayTimerRef.current) {
                            clearTimeout(autoplayTimerRef.current);
                            autoplayTimerRef.current = null;
                        }
                        const opened: Post = engagement
                            ? {
                                  ...mergedPost,
                                  userLiked: engagement.liked,
                                  stats: { ...mergedPost.stats, likes: engagement.count },
                              }
                            : mergedPost;
                        captureOverlayVideoResume(opened);
                        imageFullscreenOpenRef.current = true;
                        imageFullscreenOpenIdRef.current = String(opened.id);
                        imageFullscreenPostRef.current = opened;
                        activeVideoPostIdRef.current = null;
                        setActiveFeedVideoPostId(null);
                        // Hold this card's player only when it actually has video media (a
                        // mixed carousel can reach a video slide); image-only posts let every
                        // feed surface suspend as before.
                        setHeldVideoPostId(
                            postHasVideoMedia(opened) ? String(opened.id) : null,
                        );
                        setImageFullscreenStartIndex(startIndex);
                        // Seed the bridge with the lightweight card post on THIS frame so the
                        // tap feels instant, then push the native transparentModal route. The
                        // store merge + decorateForUser below is real synchronous JS; running
                        // it here blocked the open.
                        setImageFullscreenLaunch({
                            post: opened,
                            startIndex,
                            handlers: buildFullscreenHandlers(),
                        });
                        setImageFullscreenPost(opened);
                        navigation.navigate('ImageFullscreenModal', { postId: String(opened.id) });
                        // Defer the heavy decoration off the interaction/tap path. Guarded by
                        // the open-token so a viewer the user already closed (or reopened for a
                        // different post) is never clobbered by stale work.
                        InteractionManager.runAfterInteractions(() => {
                            if (!imageFullscreenOpenRef.current) return;
                            if (imageFullscreenOpenIdRef.current !== String(opened.id)) return;
                            // Card like wins over a stale store snapshot so the modal opens on
                            // the same heart and count the feed row is showing.
                            const live = getLocalPostById(opened.id);
                            const latest = live
                                ? {
                                      ...opened,
                                      ...live,
                                      stats: { ...opened.stats, ...live.stats, likes: opened.stats.likes },
                                      userLiked: opened.userLiked,
                                  }
                                : opened;
                            const snapshot = decorateForUser(userId, latest);
                            const aligned: Post = {
                                ...snapshot,
                                userLiked: opened.userLiked === true,
                                stats: { ...snapshot.stats, likes: opened.stats.likes },
                            };
                            setImageFullscreenLaunch({ post: aligned, startIndex });
                            setImageFullscreenPost(aligned);
                        });
                    }}
                    onOpenScenes={(engagement) => {
                        if (isPendingUpload) return;
                        const opened: Post = engagement
                            ? {
                                  ...mergedPost,
                                  userLiked: engagement.liked,
                                  stats: { ...mergedPost.stats, likes: engagement.count },
                              }
                            : mergedPost;
                        scenesReturnScrollYRef.current = feedScrollYRef.current;
                        // Mark Scenes active before navigate — Feed often stays "focused"
                        // under fullScreenModal and would otherwise re-arm ExoPlayer.
                        setScenesViewerActive(true);
                        setScenesViewerActiveState(true);
                        // Keep this card's ExoPlayer mounted (paused) under the Scenes route
                        // so returning resumes in place instead of re-allocating/restarting.
                        setHeldVideoPostId(String(opened.id));
                        activeVideoPostIdRef.current = null;
                        setActiveFeedVideoPostId(null);
                        const handoff = peekFeedVideoHandoff(opened.id);
                        const scenesFeedLabel = showFollowingFeed
                            ? 'Following'
                            : String(active || user?.national || 'Ireland');
                        // NOTE: the `scenesPosts` rebuild must stay synchronous — the Scenes
                        // screen resolves its initial posts from this launch payload at mount
                        // (ScenesScreen.tsx:59-64), which runs after the current task, so
                        // deferring it would mount the viewer with an empty/incomplete list.
                        // Single slice() + index write instead of a full .some()+.map() sweep.
                        const openedIndex = videoPostIndexById.get(String(opened.id));
                        const scenesPosts = (() => {
                            if (openedIndex == null) return [opened, ...videoPostsForScenes];
                            const next = videoPostsForScenes.slice();
                            const base = videoPostsForScenes[openedIndex];
                            next[openedIndex] = {
                                ...base,
                                ...opened,
                                stats: { ...base.stats, ...opened.stats },
                            };
                            return next;
                        })();
                        // `upsertLocalPost` is an O(n) store scan and is not needed for the
                        // Scenes mount (the payload already carries `scenesPosts`), so run it
                        // after the navigation transition instead of blocking the open frame.
                        InteractionManager.runAfterInteractions(() => {
                            upsertLocalPost(opened);
                        });
                        setScenesLaunchPayload({
                            initialPostId: opened.id,
                            posts: scenesPosts,
                            initialVideoTime: handoff?.currentTime,
                            initialMuted: handoff?.muted ?? feedVideoMuted,
                            feedLabel: scenesFeedLabel,
                        });
                        navigation.navigate('Scenes', {
                            initialPostId: opened.id,
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
                              isFollowing: mergedPost.isFollowing === true,
                          })
                      }
                      onVisitHandle={(handle) =>
                          navigation.navigate('ViewProfile', {
                              handle,
                              sourcePostId: mergedPost.id,
                              isFollowing: mergedPost.isFollowing === true,
                          })
                      }
                    onViewStories={() =>
                        navigation.navigate('Stories', {
                            openUserHandle: mergedPost.userHandle,
                            targetHandle: mergedPost.userHandle,
                            soloMode: true,
                        })
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
                    onShareToStories={() => openShareToStoriesForPost(mergedPost)}
                    isCurrentUser={user?.handle === mergedPost.userHandle}
                    viewerHandle={user?.handle}
                    viewerUserId={userId}
                    onOpenDM={user?.handle ? openDmThread : undefined}
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
            openShareToStoriesForPost,
            updatePost,
            loadMore,
            openShareForPost,
            tryReclipPost,
            toggleCollectionsSaveForPost,
            hideUserFromFeed,
            isFeedFocused,
            feedVideoMuted,
            commentsModalOpen,
            scenesViewerActive,
            feedNativeVideoSuspended,
            heldVideoPostId,
            pendingUploadTick,
            videoPostsForScenes,
            videoPostIndexById,
            interestsDraft,
            interestsSaving,
            saveInterests,
            stories24Items,
            openStoryFromRail,
            scrollStories24RailIntoView,
            stories24CollapsePayload,
            patchFollowForHandle,
            showFeedLikeBurst,
            syncFullscreenPost,
            captureOverlayVideoResume,
        ]
    );

    const closeCommentsSheet = React.useCallback(() => {
        commentsModalOpenRef.current = false;
        const y = feedScrollYRef.current;
        setCommentsModalOpen(false);
        setSelectedPostId(null);
        setSelectedPostForComments(null);
        restoreFeedVideoAfterOverlay();
        pinFeedScrollSoon(y);
    }, [restoreFeedVideoAfterOverlay, pinFeedScrollSoon]);

    // Sibling overlay (not ListEmptyComponent) so the first loading commit paints
    // skeleton cards immediately — VirtualizedList can leave one empty layout frame
    // before ListEmptyComponent mounts.
    const showFeedSkeleton = initialLoading && flatForRender.length === 0 && !error;

    return (
        <View style={styles.container}>
            <FeedPageLayout
                online={online}
                error={error}
                backdrop={<FeedAmbientCanvas />}
                headerScope={headerFeedScope}
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
<View style={[styles.feedListShell, { paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}>
              {liveDropBadge > 0 ? (
                <TouchableOpacity
                    style={styles.liveDropBadge}
                    onPress={flushLiveDrops}
                    activeOpacity={0.88}
                    accessibilityLabel={`${liveDropBadge} new drops`}
                >
                    <Icon name="arrow-up" size={14} color="#04110f" />
                    <Text style={styles.liveDropBadgeText}>
                        {liveDropBadge === 1 ? '1 new drop' : `${liveDropBadge} new drops`}
                    </Text>
                </TouchableOpacity>
              ) : null}
              <FlatList
                // Remount per feed scope so switching tabs always lands on post #1.
                key={feedScopeListKey}
                ref={flatListRef}
                style={styles.feedList}
                data={flatForRender}
                renderItem={renderItem}
                keyExtractor={(item) => {
                    if (item.kind === 'post') return `post:${item.post.id}`;
                    // stories_promo MUST be keyed here: it previously fell through to the
                    // 'feed-row' fallback, so two promos in the render window collided and
                    // React duplicated/omitted rows.
                    if (
                        item.kind === 'interests' ||
                        item.kind === 'stories24' ||
                        item.kind === 'stories24_divider' ||
                        item.kind === 'stories_promo'
                    ) {
                        return `${item.kind}:${item.id}`;
                    }
                    if (item.kind === 'suggested_follower') {
                        return `suggested-follower:${item.suggestion.userHandle}`;
                    }
                    if (item.kind === 'ad') return `ad:${item.ad.id}`;
                    if (item.kind === 'local_business') {
                        return `local-business:${item.posts.map((p) => p.id).join('-')}`;
                    }
                    if (item.kind === 'suggested_places') {
                        return `suggested-places:${item.bundleKey}`;
                    }
                    return 'feed-row';
                }}
                extraData={feedExtraData}
                viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
                // Fill the first viewport on cold start (2 left a blank strip under post #2).
                // 3 cards cover a 16:9 + peek of the next; 4:5 portrait already fills the screen.
                initialNumToRender={3}
                // Keep batch size in lockstep with the first paint so lower-end Android
                // does not mount extra TextureViews in the same JS frame as the first 3.
                maxToRenderPerBatch={3}
                // Tight window: enough for the playing card + one-ahead silent preload
                // without keeping ~9 viewports of decoders alive on mid-range phones.
                windowSize={5}
                updateCellsBatchingPeriod={50}
                // Android-only clipping freed off-screen cell memory while flinging, but with
                // content-driven heights (no getItemLayout) clipped cells remount at the wrong
                // height during a video mount, and the offset snaps 3-4 posts. Disabled so the
                // list holds its frames; the measured-size cache keeps recycled cells stable.
                removeClippedSubviews={false}
                onScrollBeginDrag={() => {
                    // Raw touch-down: arm the displacement guard only. Nothing pauses here —
                    // the playing card keeps running while the list is dragged.
                    feedScrollDragOriginRef.current = feedScrollYRef.current;
                    feedScrollDragMovedRef.current = false;
                }}
                onMomentumScrollBegin={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    feedScrollYRef.current = y;
                    // Momentum can begin from a settle / page-align even when the list never
                    // really moved (Android emits SCROLL_STATE_SETTLING after a near-stationary
                    // touch). Only treat it as a real scroll when the list travelled past the
                    // touch slop from the touch-down origin; a resting finger must not freeze
                    // the active-id (which would block the settle handoff).
                    if (
                        Math.abs(y - feedScrollDragOriginRef.current) <
                        FEED_SCROLL_TOUCH_SLOP
                    ) {
                        feedScrollDragMovedRef.current = false;
                        return;
                    }
                    feedScrollDragMovedRef.current = true;
                    markFeedScrolling();
                }}
                onMomentumScrollEnd={(e) => {
                    // Momentum has stopped — release the scroll freeze immediately rather
                    // than waiting out the trailing debounce. Re-baseline the drag origin
                    // and clear the moved flag so the next touch-down starts clean.
                    feedScrollYRef.current = e.nativeEvent.contentOffset.y;
                    feedScrollDragOriginRef.current = feedScrollYRef.current;
                    feedScrollDragMovedRef.current = false;
                    markFeedScrolling(false);
                }}
                onScrollEndDrag={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    feedScrollYRef.current = y;
                    // Force-clear the moved flag on every release. Keeping it sticky across
                    // gestures was bypassing the displacement guard and letting a resting
                    // finger look like a real scroll on the next touch.
                    const moved = feedScrollDragMovedRef.current;
                    feedScrollDragMovedRef.current = false;
                    feedScrollDragOriginRef.current = y;
                    if (!moved) {
                        // Finger lifted without displacing the list — no scroll ever happened,
                        // so stay silent instead of re-running release/autoplay.
                        return;
                    }
                    // Gate on release velocity: if the finger lifted at rest (vy ~ 0),
                    // hand the active slot to the top-most visible card instantly. If it
                    // still had velocity, treat as a fling — keep the freeze so
                    // onMomentumScrollEnd lands the handoff when momentum actually stops
                    // (the 60ms settle stays as fallback if momentum never starts).
                    const vy = e.nativeEvent.velocity?.y;
                    const isFlinging =
                        vy === undefined || Math.abs(vy) >= FEED_SCROLL_REST_VELOCITY;
                    markFeedScrolling(isFlinging);
                }}
                // Scroll performance. Every real offset change freezes the active-video
                // handoff (never pauses playback); armFeedScrollSettle / momentum-end
                // release it.
                onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    feedScrollYRef.current = y;
                    // After a rest release, the throttled trailing onScroll repeats the
                    // resting offset — ignore it so it cannot re-arm the debounce and
                    // delay playback.
                    if (
                        feedScrollRestingRef.current &&
                        Math.abs(y - feedScrollRestOffsetRef.current) < 1
                    ) {
                        return;
                    }
                    // Strict displacement guard (applies on every event, not just before the
                    // first move): the active-video handoff is frozen only once the list has
                    // actually travelled past the touch slop from the touch-down origin. A
                    // resting or pressing finger emits sub-slop offset churn that must never
                    // be treated as a scroll.
                    if (
                        Math.abs(y - feedScrollDragOriginRef.current) <
                        FEED_SCROLL_TOUCH_SLOP
                    ) {
                        return;
                    }
                    feedScrollDragMovedRef.current = true;
                    markFeedScrolling();
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
                    if (loadingMoreRef.current) return;
                    if (!initialLoading && !end) {
                        loadMore();
                    }
                }}
                onScrollToIndexFailed={() => {
                    pinFeedScrollSoon();
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
                    ) : showFeedSkeleton ? null : flatForRender.length === 0 && !end ? (
                        <FeedPostSkeleton count={3} />
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
                                                onPress={() => navigation.navigate('InstantCreate')}
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
                                                onPress={() => navigation.navigate('InstantCreate')}
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
                        // Absolute glass header overlays the list — pad content so the
                        // first card starts fully below Stories / Ireland / Passport.
                        paddingTop: insets.top + FEED_PINNED_CHROME_CONTENT_HEIGHT,
                        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
                    },
                ]}
            />
            {showFeedSkeleton ? (
                <View
                    pointerEvents="none"
                    style={[
                        styles.feedSkeletonOverlay,
                        { paddingTop: insets.top + FEED_PINNED_CHROME_CONTENT_HEIGHT },
                    ]}
                >
                    <FeedPostSkeleton count={3} />
                </View>
            ) : null}
            </View>
            </FeedPageLayout>

            <Modal
                visible={commentsModalOpen && Boolean(selectedPostId)}
                transparent
                animationType="slide"
                statusBarTranslucent
                hardwareAccelerated
                onRequestClose={closeCommentsSheet}
                onShow={() => pinFeedScrollSoon()}
            >
                    <View style={styles.fullscreenOverlayRoot}>
                        <Pressable
                            style={styles.fullscreenOverlayBackdrop}
                            onPress={closeCommentsSheet}
                            accessibilityLabel="Dismiss comments"
                        />
                        <View style={styles.fullscreenCommentsSheet}>
                            {selectedPostId ? (
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
                            ) : null}
                        </View>
                    </View>
                </Modal>

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

            <FeedDmSheet
                key={dmSheetEpoch}
                ref={dmSheetRef}
                open={dmSheetOpen}
                recipientHandle={dmSheetRecipientHandle}
                message={dmSheetMessage}
                onChangeMessage={setDmSheetMessage}
                onClose={closeDmSheet}
                onSend={() => {
                    void sendDmFromSheet();
                }}
                sending={dmSheetSending}
            />

            {shareModalOpen && selectedPostForShare ? (
                <FeedShareModal
                    post={selectedPostForShare}
                    isOpen
                    onClose={() => {
                        const y = feedScrollYRef.current;
                        setShareModalOpen(false);
                        setSelectedPostForShare(null);
                        pinFeedScrollSoon(y);
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
                    const nextFollowing = updated?.isFollowing === true;
                    patchFollowForHandle(overflowPost.userHandle, nextFollowing);
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
                    onSaved={async (saved?: boolean) => {
                        const sp = saveModalPost;
                        if (!sp) return;
                        const v =
                            saved !== undefined
                                ? saved
                                : ((await getCollectionsForPost(userId, sp.id)).length > 0);
                        setSavedByPostId((prev) => ({ ...prev, [sp.id]: v }));
                        updatePost(sp.id, (p) => ({ ...p, isBookmarked: v }));
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

            {/* Feed-level share-to-stories. Per-card Modal mount/unmount jumps FlatList on Android. */}
            <ShareToStoriesModal
                visible={shareToStoriesPost != null}
                post={shareToStoriesPost}
                onClose={() => {
                    const y = feedScrollYRef.current;
                    setShareToStoriesPost(null);
                    pinFeedScrollSoon(y);
                }}
                onShareSuccess={handleShareToStoriesSuccess}
                onShow={() => pinFeedScrollSoon()}
                onDismiss={() => pinFeedScrollSoon()}
            />

            {/* Feed-level burst (not per-card). Pin scroll when it opens/closes — Android
                Modal visibility changes otherwise nudge FlatList content. */}
            <Modal
                visible={feedLikeBurst != null}
                transparent
                animationType="none"
                statusBarTranslucent
                hardwareAccelerated
                onRequestClose={() => setFeedLikeBurst(null)}
                onShow={() => {
                    const y = feedScrollYRef.current;
                    requestAnimationFrame(() => {
                        flatListRef.current?.scrollToOffset({ offset: y, animated: false });
                    });
                }}
                onDismiss={() => {
                    const y = feedScrollYRef.current;
                    requestAnimationFrame(() => {
                        flatListRef.current?.scrollToOffset({ offset: y, animated: false });
                    });
                }}
            >
                <View style={styles.mediaBurstPortal} pointerEvents="none">
                    {feedLikeBurst ? (
                        <FeedDoubleTapLikeBurst
                            key={feedLikeBurst.key}
                            x={feedLikeBurst.x}
                            y={feedLikeBurst.y}
                        />
                    ) : null}
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    /** Outside TextureView — sibling of FeedPostMedia so mute stays visible on Android. */
    feedMuteButton: {
        position: 'absolute',
        right: 12,
        bottom: 12,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.55)',
        zIndex: 80,
        elevation: Platform.OS === 'android' ? 80 : 0,
    },
    /** Action bar sits under media as a sibling — never absolute over the poster. */
    mediaEngagementBelow: {
        position: 'relative',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: 'transparent',
        minWidth: 0,
        zIndex: 0,
    },
    /** Text posts: bounded card so consecutive items don't blend into one block. */
    textOnlyFloatWrap: {
        marginHorizontal: 16,
        marginVertical: 6,
        marginBottom: 12,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: '#121721',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 12,
        overflow: 'hidden' as const,
        borderBottomWidth: 1,
        borderBottomColor: '#21262D',
    },
    textOnlyEngagementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 4,
        paddingBottom: 10,
        backgroundColor: 'transparent',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#1F2937',
    },
    textOnlyEngagementLeft: {
        flex: 1,
        minWidth: 0,
        marginRight: 8,
    },
    mediaBurstPortal: {
        ...StyleSheet.absoluteFill,
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    container: {
        flex: 1,
        // Transparent so FeedAmbientCanvas (inside FeedPageLayout) can bleed under
        // the absolute tab bar — sceneContainerStyle is also transparent.
        backgroundColor: 'transparent',
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
        // Transparent: the ambient canvas is mounted at FeedPageLayout root so it can paint
        // behind the pinned header as well as this scroll body. FeedPageLayout's own opaque
        // backdrop still owns the base colour if the canvas ever fails to mount.
        backgroundColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
    },
    liveDropBadge: {
        position: 'absolute',
        top: 10,
        alignSelf: 'center',
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#3D9B8F',
    },
    liveDropBadgeText: {
        color: '#04110f',
        fontSize: 13,
        fontWeight: '700',
    },
    feedSkeletonOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 2,
        backgroundColor: 'transparent',
    },
    feedList: {
        flex: 1,
        // Transparent so the root FeedAmbientCanvas (FeedPageLayout backdrop) shows
        // through the gaps between floating cards.
        backgroundColor: 'transparent',
        elevation: 0,
    },
    feedListRow: {
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 16,
        // Transparent so the ambient canvas shows in the gap beside each floating card.
        // This wrapper spans the FULL row width, so leaving it opaque painted over the
        // 16px margins and hid the canvas completely.
        backgroundColor: 'transparent',
    },
    /** Stories rail — keep wrap spacing tight; divider row owns the rule + gap. */
    feedListRowStories: {
        marginBottom: 0,
        paddingTop: 8,
        paddingBottom: 8,
    },
    feedListRowStoriesDivider: {
        marginBottom: 16,
        overflow: 'visible',
    },
    storiesRailSeparator: {
        alignSelf: 'stretch',
        height: 1,
        marginHorizontal: 16,
        // Stronger than raw #1E232A so the rule reads on ambient black.
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    /** Extra air between Stories divider and the first feed card. */
    feedListRowAfterStories: {
        marginTop: 8,
    },
    feedListContent: {
        // Same reason as feedListRow: the content container covers the whole scroll area
        // and would otherwise bury the canvas behind an opaque page colour.
        backgroundColor: 'transparent',
        flexGrow: 1,
    },
    tabContainer: {
        backgroundColor: 'transparent',
    },
    feedHeaderNotifWrap: {
        alignItems: 'center',
    },
    /**
     * Discover glyph container. Deliberately translucent (not a solid fill) so the
     * header's ambient background gradient reads through, matching how the Passport
     * avatar on the right sits on its ring rather than on an opaque plate.
     */
    feedHeaderDiscoverGlyph: {
        width: FEED_HEADER_PASSPORT_AVATAR.width,
        height: FEED_HEADER_PASSPORT_AVATAR.width,
        borderRadius: FEED_HEADER_PASSPORT_AVATAR.borderRadius,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
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
        left: 0,
        right: 0,
        bottom: '100%',
        marginBottom: ox(6),
        zIndex: 50,
        alignItems: 'center',
    },
    feedSwitchPillWrap: {
        position: 'relative',
        alignSelf: 'center',
        maxWidth: '100%',
        zIndex: 50,
        overflow: 'visible',
    },
    feedSwitchPillRipple: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.9)',
        backgroundColor: 'rgba(139, 92, 246, 0.18)',
    },
feedSwitchPillBorder: {
          borderRadius: 10,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.3)',
          overflow: 'hidden',
          zIndex: 1,
      },
    feedSwitchBadgeInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(4),
        paddingHorizontal: ox(10),
        paddingVertical: ox(4),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: '#FFFFFF',
        backgroundColor: '#000000',
    },
    feedSwitchBadgeText: {
        color: '#FFFFFF',
        fontSize: ox(11),
        fontWeight: '700',
    },
    feedSwitchBadgeCaret: {
        width: 7,
        height: 7,
        marginTop: ox(-4),
        backgroundColor: '#000000',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#FFFFFF',
        transform: [{ rotate: '45deg' }],
        borderRadius: ox(1),
        zIndex: 1,
        alignSelf: 'center',
    },
    feedSwitchSheetOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    feedSwitchSheetBackdrop: {
        ...StyleSheet.absoluteFill,
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
        ...StyleSheet.absoluteFill,
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
