// @ts-nocheck
// @ts-ignore
/* eslint-disable */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
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
import { getInstagramImageDimensions } from '../utils/imageDimensions';
import { FEED_UI } from '../constants/feedUiTokens';
import FeedPostMedia, { type FeedPostMediaHandle } from '../components/FeedPostMedia.native';
import ImageFullscreenModal from '../components/ImageFullscreenModal.native';
import { isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import { postHasVideoMedia } from '../utils/postMedia';
import NetInfo from '@react-native-community/netinfo';
import {
    getFeedAutoplayPref,
    resolveFeedAutoplayAllowed,
    subscribeFeedAutoplayPref,
    type FeedAutoplayPref,
} from '../utils/feedAutoplayPrefNative';
import { setActiveFeedVideoPostId } from '../utils/feedActiveVideoNative';
import {
    getGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';
import GazetteerAmbientBackground from '../components/GazetteerAmbientBackground';
import { glassPanel, glassSurface } from '../theme/gazetteerAmbientNative';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigateMainTab } from '../navigation/mainTabs';
import Stories24HeaderIcon from '../components/Stories24HeaderIcon.native';
import { Dimensions } from 'react-native';
import FeedEngagementRow from '../components/FeedEngagementRow';
import FeedPostHeader from '../components/FeedPostHeader.native';
import FeedCaptionText from '../components/FeedCaptionText.native';
import FeedPostTagRow from '../components/FeedPostTagRow.native';
import FeedMediaCarouselThumbs from '../components/FeedMediaCarouselThumbs.native';
import FeedNewsTicker from '../components/FeedNewsTicker.native';
import FeedHeartDrop from '../components/FeedHeartDrop.native';
import { imageFullscreenIndexForCarousel } from '../utils/feedImageFullscreen';
import FeedLikesSheet from '../components/FeedLikesSheet.native';
import FeedTaggedMediaBadge from '../components/FeedTaggedMediaBadge.native';
import TaggedUsersBottomSheet from '../components/TaggedUsersBottomSheet.native';
import { getPostDisplayCaption, getReclipDisplay } from '../utils/feedPostMeta';
import FeedShareModal from '../components/FeedShareModal';
import ShareToStoriesModal from '../components/ShareToStoriesModal.native';
import BoostMetricsPanel from '../components/BoostMetricsPanel.native';
import { subscribeStoriesRefresh } from '../utils/storiesRefreshNative';
import { getActiveBoost } from '../api/boost';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InterestsFeedCard from '../components/InterestsFeedCard.native';
import SuggestedFollowerFeedCard from '../components/SuggestedFollowerFeedCard.native';
import Stories24FeedRail, { type Stories24FeedRailHandle } from '../components/Stories24FeedRail.native';
import {
    buildStories24RailItems,
    consumeStories24RailReturn,
    persistStories24RailOpenHandle,
    buildStories24StoryNavParams,
    isStories24AddYoursHandle,
    resolveStories24OpenTarget,
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
    isFeedPostArchivedMobile,
    setPostNotificationsPrefMobile,
    hasPostNotificationsPrefMobile,
} from '../utils/feedEngagementPrefsMobile';
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
    getPendingFeedUploads,
    pendingUploadToPost,
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
import LocationPlaceSummaryModal from '../components/LocationPlaceSummaryModal';
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
import LocationPlaceSummaryCard from '../components/LocationPlaceSummaryCard';

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
        if (onHeaderPlacePick) {
            onHeaderPlacePick(suggestion, filterType);
            return;
        }
        onSearchLocation?.(suggestion.name, filterType, {
            label: suggestion.name,
            placeId: suggestion.place_id ?? null,
        });
    };
    const [menuOpen, setMenuOpen] = useState(false);
    const [showGazetteerTitle, setShowGazetteerTitle] = useState(true);
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
                    const mappedApi: HeaderSuggestion[] = allApiSuggestions.map((s) => {
                        const sel = resolvePlaceFeedSelection(s as LocationSuggestion);
                        const t = String((s as any)?.type || '').toLowerCase();
                        const kind: 'location' | 'venue' | 'landmark' = t.includes('venue')
                            ? 'venue'
                            : t.includes('landmark')
                                ? 'landmark'
                                : 'location';
                        return {
                            name: s.name,
                            country: (s as any).country,
                            type: kind,
                            filter: sel.filter,
                            label: sel.label,
                            placeId: sel.placeId,
                            scope: sel.scope,
                            source: s as LocationSuggestion,
                        };
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
        setMenuOpen(false);
    };

    return (
        <View style={styles.tabContainer}>
            <View style={styles.feedHeaderPickerRow}>
                <TouchableOpacity
                    onPress={() => onOpenStories24?.()}
                    style={styles.feedHeaderSideAction}
                    accessibilityLabel="Stories 24"
                >
                    <View style={styles.feedHeaderNotifWrap}>
                        <Stories24HeaderIcon size={32} />
                        <Text style={styles.feedHeaderPassportLabel}>Stories</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.feedHeaderCenter}>
                    <TouchableOpacity
                        onPress={() => setMenuOpen((prev) => !prev)}
                        style={styles.feedDropdownTrigger}
                        activeOpacity={0.85}
                    >
                        <Icon
                            name={customFilterType === 'venue' ? 'home-outline' : customFilterType === 'landmark' ? 'business-outline' : 'location'}
                            size={16}
                            color="#FFFFFF"
                            style={styles.feedDropdownActiveIcon}
                        />
                        <View style={[styles.feedDropdownActiveDot, { backgroundColor: activeIndicatorColor }]} />
                        <Text
                            style={styles.feedDropdownActiveText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {headerLabel}
                        </Text>
                        <Icon name={menuOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color="#E5E7EB" />
                    </TouchableOpacity>

                    {menuOpen && (
                        <View style={styles.feedDropdownMenu}>
                            <View style={styles.feedDropdownSearchWrap}>
                                <Icon name="search-outline" size={16} color="#CBD5E1" />
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
                                    style={styles.feedDropdownSearchInput}
                                />
                            </View>
                            <Text style={styles.feedDropdownSearchHint}>
                                Tip: use venue: or landmark:
                            </Text>
                            {locationQuery.trim().length >= 2 ? (
                                <View style={styles.feedDropdownSuggestionsWrap}>
                                    {loadingSuggestions ? (
                                        <Text style={styles.feedDropdownSuggestionsMeta}>Searching places...</Text>
                                    ) : locationSuggestions.length > 0 ? (
                                        locationSuggestions.map((s, idx) => (
                                            <TouchableOpacity
                                                key={`${s.name}-${idx}`}
                                                style={styles.feedDropdownSuggestionItem}
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
                                                    setLocationQuery(s.name);
                                                    commitHeaderPlace(
                                                        headerSuggestionToLocation(s, s.name),
                                                        mode
                                                    );
                                                    setMenuOpen(false);
                                                }}
                                            >
                                                <Text style={styles.feedDropdownSuggestionText}>
                                                    {s.name}
                                                    {s.type === 'venue'
                                                        ? ' · venue'
                                                        : s.type === 'landmark'
                                                            ? ' · landmark'
                                                            : (usingFallbackSuggestions ? ' · quick suggestion' : (s.country ? ` · ${s.country}` : ''))}
                                                </Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <Text style={styles.feedDropdownSuggestionsMeta}>No matches yet</Text>
                                    )}
                                </View>
                            ) : null}
                            {customLocation ? (
                                <TouchableOpacity
                                    style={styles.feedDropdownMenuItem}
                                    onPress={() => {
                                        onClearCustom?.();
                                        setMenuOpen(false);
                                    }}
                                >
                                    <Icon name="home-outline" size={18} color="#E5E7EB" />
                                    <Text style={styles.feedDropdownMenuText}>Back to home feed</Text>
                                </TouchableOpacity>
                            ) : null}
                            {menuItems.map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={styles.feedDropdownMenuItem}
                                    onPress={() => {
                                        item.onPress();
                                        setMenuOpen(false);
                                    }}
                                >
                                    <Icon name={item.icon} size={18} color={item.iconColor} />
                                    <Text style={styles.feedDropdownMenuText}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.feedHeaderRightActions}>
                    {customLocation ? (
                        <>
                            <TouchableOpacity
                                onPress={() => setPlaceInfoOpen(true)}
                                style={styles.feedHeaderIconButton}
                                accessibilityLabel={`About ${activeLabel}`}
                            >
                                <Icon name="information-circle-outline" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                            <LocationPlaceSummaryModal
                                open={placeInfoOpen}
                                onClose={() => setPlaceInfoOpen(false)}
                                locationLabel={customLocationLabel || customLocation}
                                placeId={customLocationPlaceId}
                            />
                        </>
                    ) : null}
                    <TouchableOpacity
                        onPress={onOpenPassport}
                        style={styles.feedHeaderSideAction}
                        accessibilityLabel="My Passport"
                    >
                        <View style={styles.feedHeaderNotifWrap}>
                            <View style={styles.feedHeaderPassportAvatarWrap}>
                                {user?.avatarUrl ? (
                                    <Image
                                        source={{ uri: user.avatarUrl }}
                                        style={styles.feedHeaderPassportAvatarImage}
                                    />
                                ) : (
                                    <Text style={styles.feedHeaderPassportInitials}>{passportInitials}</Text>
                                )}
                            </View>
                            <Text style={styles.feedHeaderPassportLabel}>Passport</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

function Avatar({
    src,
    name,
    size = 32,
    hasStory = false,
    onPress
}: {
    src?: string;
    name: string;
    size?: number;
    hasStory?: boolean;
    onPress?: () => void;
}) {
    const getInitials = (fullName: string): string => {
        const names = fullName.trim().split(' ');
        if (names.length === 1) {
            return names[0].charAt(0).toUpperCase();
        }
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    };

    const initials = getInitials(name);
    const Component = onPress ? TouchableOpacity : View;

    if (hasStory) {
        return (
            <Component onPress={onPress} style={styles.avatarContainer}>
                <LinearGradient
                    colors={['#a78bfa', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.storyBorder, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}
                >
                    <View style={[styles.avatarInner, { width: size, height: size }]}>
                        {src ? (
                            <Image source={{ uri: src }} style={styles.avatarImage} />
                        ) : (
                            <View style={[styles.avatarFallback, { width: size, height: size }]}>
                                <Text style={styles.avatarInitials}>{initials}</Text>
                            </View>
                        )}
                    </View>
                </LinearGradient>
            </Component>
        );
    }

    return (
        <Component onPress={onPress} style={styles.avatarContainer}>
            <View style={[styles.avatarInner, { width: size, height: size }]}>
                {src ? (
                    <Image source={{ uri: src }} style={styles.avatarImage} />
                ) : (
                    <View style={[styles.avatarFallback, { width: size, height: size }]}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                )}
            </View>
        </Component>
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
    viewerHandle,
    viewerUserId,
    onOpenDM,
    onRegisterDmAnchor,
    onOpenImageFullscreen,
    onOpenScenes,
    onShareSuccess,
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
    onOpenImageFullscreen?: (startIndex?: number) => void;
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
    viewerHandle?: string | null;
    viewerUserId?: string;
    onOpenDM?: (handle: string, postId: string) => void;
    onRegisterDmAnchor?: (key: string, ref: View | null) => void;
    onShareSuccess?: (postId: string) => void;
}) {
    const [imageDimensions, setImageDimensions] = React.useState<{ width: number; height: number } | null>(null);
    const [profileMenuVisible, setProfileMenuVisible] = React.useState(false);
    const [headerHasStory, setHeaderHasStory] = React.useState(false);
    const [carouselIndex, setCarouselIndex] = React.useState(0);
    const [heartDrop, setHeartDrop] = React.useState<{ startX: number; startY: number } | null>(null);
    const likeButtonRef = React.useRef<View>(null);
    const mediaWrapRef = React.useRef<View>(null);
    const [likesSheetVisible, setLikesSheetVisible] = React.useState(false);
    const [taggedSheetVisible, setTaggedSheetVisible] = React.useState(false);
    const [shareToStoriesVisible, setShareToStoriesVisible] = React.useState(false);
    const [isMetricsOpen, setIsMetricsOpen] = React.useState(false);
    const [boostMetricsActive, setBoostMetricsActive] = React.useState(Boolean(post.isBoosted));
    const isMutualFollow = useMutualFollow(post, isCurrentUser);
    const lastMediaTapRef = React.useRef(0);
    const singleMediaTapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoMediaRef = React.useRef<FeedPostMediaHandle>(null);
    const postViewRecordedRef = React.useRef(false);
    const screenWidth = Dimensions.get('window').width;
    const cardMediaWidth = screenWidth - 20;
    const DOUBLE_TAP_DELAY_MS = 260;

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

    /** Lock frame size to first carousel slide so swiping does not resize the card (web parity). */
    const mediaSizingUrl = React.useMemo(() => {
        if (!hasFeedMedia) return null;
        const first = carouselThumbItems[0];
        if (first?.type === 'video' && post.videoPosterUrl) return post.videoPosterUrl;
        if (first?.url) return first.url;
        if (isVideoPost(post) && post.videoPosterUrl) return post.videoPosterUrl;
        return post.mediaUrl || post.mediaItems?.[0]?.url || null;
    }, [hasFeedMedia, post, carouselThumbItems]);

    React.useEffect(() => {
        setImageDimensions(null);
    }, [post.id]);

    React.useEffect(() => {
        if (mediaSizingUrl && !imageDimensions) {
            Image.getSize(
                mediaSizingUrl,
                (width, height) => {
                    // Calculate Instagram-style dimensions with clamping
                    const dimensions = getInstagramImageDimensions(width, height, cardMediaWidth);
                    const minHeight = cardMediaWidth * FEED_UI.media.minAspect;
                    const maxHeight = cardMediaWidth * FEED_UI.media.maxAspect;
                    const portraitFirstHeight = Math.min(Math.max(dimensions.height, minHeight), maxHeight);
                    setImageDimensions({ width: dimensions.width, height: portraitFirstHeight });
                },
                (error) => {
                    console.error('Error getting image size:', error);
                    // Fallback to default dimensions
                    setImageDimensions({ width: cardMediaWidth, height: cardMediaWidth * FEED_UI.media.maxAspect });
                }
            );
        }
    }, [mediaSizingUrl, cardMediaWidth, imageDimensions]);

    // Calculate image style with Instagram clamping
    const imageStyle = React.useMemo(() => {
        if (imageDimensions) {
            return {
                width: imageDimensions.width,
                height: imageDimensions.height,
                backgroundColor: '#000000',
            };
        }
        // Default while loading
        return {
            width: cardMediaWidth,
            height: cardMediaWidth * FEED_UI.media.maxAspect, // Default to max portrait aspect ratio
            backgroundColor: '#000000',
        };
    }, [imageDimensions, cardMediaWidth]);

    const triggerHeartDrop = React.useCallback((pageX: number, pageY: number) => {
        setHeartDrop({ startX: pageX, startY: pageY });
    }, []);

    const resolveTapCoords = React.useCallback((pageX?: number, pageY?: number): Promise<{ x: number; y: number }> => {
        if (typeof pageX === 'number' && typeof pageY === 'number') {
            return Promise.resolve({ x: pageX, y: pageY });
        }
        return new Promise((resolve) => {
            mediaWrapRef.current?.measureInWindow((x, y, w, h) => {
                resolve({ x: x + w / 2, y: y + h / 2 });
            });
        });
    }, []);

    const handleMediaPress = React.useCallback(
        (event?: { nativeEvent?: { pageX?: number; pageY?: number } }) => {
            const now = Date.now();
            if (now - lastMediaTapRef.current <= DOUBLE_TAP_DELAY_MS) {
                if (singleMediaTapTimerRef.current) {
                    clearTimeout(singleMediaTapTimerRef.current);
                    singleMediaTapTimerRef.current = null;
                }
                lastMediaTapRef.current = 0;
                if (!post.userLiked) {
                    onLike().catch((error) => console.error('Error in media double-tap like:', error));
                }
                const { pageX, pageY } = event?.nativeEvent || {};
                void resolveTapCoords(pageX, pageY).then(({ x, y }) => triggerHeartDrop(x, y));
                return;
            }
            lastMediaTapRef.current = now;
            singleMediaTapTimerRef.current = setTimeout(() => {
                if (postHasVideoMedia(post)) {
                    videoMediaRef.current?.toggleVideoMute();
                } else {
                    const startIndex = imageFullscreenIndexForCarousel(post, carouselIndex);
                    onOpenImageFullscreen?.(startIndex);
                }
                singleMediaTapTimerRef.current = null;
            }, DOUBLE_TAP_DELAY_MS + 20);
        },
        [
            DOUBLE_TAP_DELAY_MS,
            carouselIndex,
            onLike,
            onOpenImageFullscreen,
            post,
            resolveTapCoords,
            triggerHeartDrop,
        ],
    );

    React.useEffect(() => {
        return () => {
            if (singleMediaTapTimerRef.current) {
                clearTimeout(singleMediaTapTimerRef.current);
            }
        };
    }, []);

    return (
        <View style={styles.feedCard}>
            <FeedPostTagRow tags={postTags} />

            {post.isBoosted && (
                <View style={styles.sponsoredBadge}>
                    <Text style={styles.sponsoredText}>Sponsored</Text>
                    {post.boostFeedType && (
                        <Text style={styles.sponsoredFeedType}>· {post.boostFeedType} boost</Text>
                    )}
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
                    onProfileMenuPress={() => setProfileMenuVisible(true)}
                    onOverflowPress={onOverflowPress}
                    onDoubleLike={() => {
                        if (!post.userLiked) {
                            void onLike();
                        }
                    }}
                    onHeartAnimation={(pageX, pageY) => triggerHeartDrop(pageX, pageY)}
                    onRegisterDmAnchor={onRegisterDmAnchor}
                    onShowTaggedUsers={() => setTaggedSheetVisible(true)}
                />
            ) : (
                <>
                    {hasFeedMedia ? (
                        <View style={styles.mediaWrap} ref={mediaWrapRef} collapsable={false}>
                            <FeedPostMedia
                                ref={videoMediaRef}
                                post={post}
                                carouselIndex={carouselIndex}
                                onCarouselIndexChange={setCarouselIndex}
                                stickers={post.stickers}
                                width={cardMediaWidth}
                                height={typeof imageStyle.height === 'number' ? imageStyle.height : cardMediaWidth}
                                onPress={isClientUploading || isClientUploadFailed ? undefined : handleMediaPress}
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
                                muted={feedVideoMuted}
                                onOpenScenes={
                                    isClientUploading || isClientUploadFailed ? undefined : onOpenScenes
                                }
                            />
                            <FeedPostHeader
                                post={post}
                                viewerHandle={viewerHandle}
                                isCurrentUser={isCurrentUser}
                                isOverlaid
                                onFollow={onFollow}
                                onOpenDM={onOpenDM}
                                onProfileMenuPress={() => setProfileMenuVisible(true)}
                                onHasStoryChange={setHeaderHasStory}
                                onOverflowPress={onOverflowPress}
                                onRegisterDmAnchor={onRegisterDmAnchor}
                            />
                            {isClientUploading ? (
                                <View style={styles.uploadingOverlay} pointerEvents="none">
                                    <ActivityIndicator size="large" color="#FFFFFF" />
                                    <Text style={styles.uploadingOverlayTitle}>Posting…</Text>
                                    <Text style={styles.uploadingOverlaySubtitle}>Preparing your post</Text>
                                </View>
                            ) : null}
                            {isClientUploadFailed ? (
                                <View style={styles.uploadingOverlay}>
                                    <Icon name="alert-circle-outline" size={28} color="#FCA5A5" />
                                    <Text style={styles.uploadingOverlayTitle}>Post failed</Text>
                                    <Text style={styles.uploadingOverlaySubtitle} numberOfLines={2}>
                                        {post.clientUploadError || 'Could not post. Tap to dismiss.'}
                                    </Text>
                                </View>
                            ) : null}
                            {hasTaggedUsers ? (
                                <FeedTaggedMediaBadge
                                    count={post.taggedUsers!.length}
                                    aboveMuteControl={showVideoMuteOnMedia}
                                    onPress={() => setTaggedSheetVisible(true)}
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
                            onProfileMenuPress={() => setProfileMenuVisible(true)}
                            onHasStoryChange={setHeaderHasStory}
                            onOverflowPress={onOverflowPress}
                            onRegisterDmAnchor={onRegisterDmAnchor}
                        />
                    )}

                    {carouselThumbItems.length > 1 ? (
                        <FeedMediaCarouselThumbs
                            items={carouselThumbItems}
                            activeIndex={carouselIndex}
                            onSelect={setCarouselIndex}
                        />
                    ) : null}

                </>
            )}

            {!textOnlyPost && displayCaption.length > 0 && hasFeedMedia ? (
                <View style={styles.captionWrap}>
                    <FeedCaptionText
                        caption={displayCaption}
                        onHandlePress={(handle) => {
                            if (onVisitHandle) onVisitHandle(handle);
                            else onVisitProfile?.();
                        }}
                    />
                </View>
            ) : null}

            <FeedHeartDrop
                visible={heartDrop != null}
                startX={heartDrop?.startX ?? 0}
                startY={heartDrop?.startY ?? 0}
                targetRef={likeButtonRef}
                onComplete={() => setHeartDrop(null)}
            />

            <View style={[styles.engagementBar, (isClientUploading || isClientUploadFailed) && styles.engagementBarDimmed]}>
                <View style={styles.actionButtons}>
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
                            if (post.stats.likes > 0) setLikesSheetVisible(true);
                        }}
                        onComment={onComment}
                        onShareToStories={() => setShareToStoriesVisible(true)}
                        onReclip={!isCurrentUser ? () => { void onReclip(); } : undefined}
                        onSave={() => { void onBookmark(); }}
                        showReclip={!isCurrentUser}
                        showViews
                        tone="feed"
                    />
                </View>

                <View style={styles.rightActions}>
                    {showBoostMetrics ? (
                        <TouchableOpacity
                            onPress={() => setIsMetricsOpen((v) => !v)}
                            style={styles.externalShareButton}
                            accessibilityLabel="Toggle boost metrics"
                        >
                            <Icon
                                name="bar-chart-outline"
                                size={24}
                                color={isMetricsOpen ? '#7A8AF0' : '#FFFFFF'}
                            />
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        onPress={() => { void onShare(); }}
                        style={styles.externalShareButton}
                        accessibilityLabel="Share post"
                    >
                        <Icon name="share-social-outline" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
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

            <FeedLikesSheet
                visible={likesSheetVisible}
                postId={String(post.id)}
                userId={viewerUserId || 'anon'}
                viewerHandle={viewerHandle}
                likeCount={post.stats.likes}
                viewCount={post.stats.views}
                onClose={() => setLikesSheetVisible(false)}
                onVisitProfile={onVisitHandle}
            />

            {hasTaggedUsers ? (
                <TaggedUsersBottomSheet
                    visible={taggedSheetVisible}
                    taggedUserHandles={post.taggedUsers!}
                    onClose={() => setTaggedSheetVisible(false)}
                    onVisitProfile={onVisitHandle}
                />
            ) : null}

            {/* Profile quick actions menu (Visit profile / Follow-Unfollow / View stories) */}
            {profileMenuVisible && (
                <View style={styles.profileMenuCard}>
                    <TouchableOpacity
                        style={styles.profileMenuItem}
                        onPress={() => {
                            setProfileMenuVisible(false);
                            if (onVisitHandle) onVisitHandle(profileHandle);
                            else onVisitProfile?.();
                        }}
                    >
                        <Icon name="person-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.profileMenuItemText}>Visit profile</Text>
                    </TouchableOpacity>

                    {!isCurrentUser && onFollow && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={async () => {
                                setProfileMenuVisible(false);
                                await onFollow();
                            }}
                        >
                            <Icon
                                name={post.isFollowing ? 'person-remove-outline' : 'person-add-outline'}
                                size={18}
                                color="#FFFFFF"
                            />
                            <Text style={styles.profileMenuItemText}>
                                {post.isFollowing ? 'Unfollow' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {onViewStories && headerHasStory && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={() => {
                                setProfileMenuVisible(false);
                                onViewStories();
                            }}
                        >
                            <Icon name="play-circle-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.profileMenuItemText}>View stories</Text>
                        </TouchableOpacity>
                    )}
                    {!isCurrentUser && isMutualFollow && onOpenDM && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={() => {
                                setProfileMenuVisible(false);
                                onOpenDM(post.userHandle, post.id);
                            }}
                        >
                            <Icon name="chatbubble-outline" size={18} color="#67E8F9" />
                            <Text style={[styles.profileMenuItemText, { color: '#A5F3FC' }]}>Message</Text>
                        </TouchableOpacity>
                    )}
                    {!isCurrentUser && onBlockUser && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={async () => {
                                setProfileMenuVisible(false);
                                await onBlockUser();
                            }}
                        >
                            <Icon name="ban-outline" size={18} color="#FCA5A5" />
                            <Text style={[styles.profileMenuItemText, { color: '#FCA5A5' }]}>Block user</Text>
                        </TouchableOpacity>
                    )}
                    {!isCurrentUser && onReportUser && (
                        <TouchableOpacity
                            style={styles.profileMenuItem}
                            onPress={async () => {
                                setProfileMenuVisible(false);
                                await onReportUser();
                            }}
                        >
                            <Icon name="flag-outline" size={18} color="#FDE68A" />
                            <Text style={[styles.profileMenuItemText, { color: '#FDE68A' }]}>Report</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
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
        a.stats.likes === b.stats.likes &&
        a.stats.comments === b.stats.comments &&
        a.stats.views === b.stats.views &&
        a.stats.reclips === b.stats.reclips &&
        a.stats.shares === b.stats.shares &&
        a.mediaUrl === b.mediaUrl &&
        a.videoPosterUrl === b.videoPosterUrl &&
        a.templateId === b.templateId &&
        a.text === b.text &&
        JSON.stringify(a.textStyle) === JSON.stringify(b.textStyle) &&
        a.isBoosted === b.isBoosted &&
        a.originalUserHandle === b.originalUserHandle &&
        prev.isCurrentUser === next.isCurrentUser &&
        prev.isVideoActive === next.isVideoActive &&
        prev.feedVideoMuted === next.feedVideoMuted &&
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
    | { kind: 'stories24'; id: string }
    | { kind: 'interests'; id: string }
    | { kind: 'suggested_follower'; suggestion: SuggestedFollowerSuggestion };

function FeedScreen({ navigation, route }: { navigation?: any; route?: any }) {
    const { user, login } = useAuth();
    const userId = user?.id ?? 'anon';
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
    const [loading, setLoading] = useState(false);
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
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasInbox, setHasInbox] = useState(false);
    const insets = useSafeAreaInsets();
    const [reloadTick, setReloadTick] = useState(0);
    const [showBoostPrompt, setShowBoostPrompt] = useState(false);
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
    const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
    const [feedAutoplayAllowed, setFeedAutoplayAllowed] = useState(true);
    const [feedVideoMuted, setFeedVideoMuted] = useState(true);
    const [pendingUploadTick, setPendingUploadTick] = useState(0);
    const requestTokenRef = useRef(0);
    const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFeedAutoplayAtMsRef = useRef(0);
    const viewabilityConfigRef = useRef({
        itemVisiblePercentThreshold: 55,
        minimumViewTime: 180,
    });

    const feedAutoplayPrefRef = useRef<FeedAutoplayPref>('wifi');

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
        const unsubNet = NetInfo.addEventListener(() => {
            void syncFeedAutoplayAllowed(feedAutoplayPrefRef.current);
        });
        return () => {
            cancelled = true;
            unsubPref();
            unsubMute();
            unsubNet();
        };
    }, [syncFeedAutoplayAllowed]);

    const feedAutoplayAllowedRef = useRef(feedAutoplayAllowed);
    feedAutoplayAllowedRef.current = feedAutoplayAllowed;

    const scheduleActiveFeedVideo = useCallback((postId: string | null) => {
        if (autoplayTimerRef.current) {
            clearTimeout(autoplayTimerRef.current);
            autoplayTimerRef.current = null;
        }
        if (!feedAutoplayAllowedRef.current || !postId) {
            setActiveVideoPostId(null);
            setActiveFeedVideoPostId(null);
            return;
        }
        const minGapMs = 320;
        const sinceLast = Date.now() - lastFeedAutoplayAtMsRef.current;
        const delayMs = sinceLast >= minGapMs ? 0 : minGapMs - sinceLast;
        autoplayTimerRef.current = setTimeout(() => {
            setActiveVideoPostId(postId);
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
        ({ viewableItems }: { viewableItems: Array<{ isViewable?: boolean; item?: Post; index?: number | null }> }) => {
            if (!feedAutoplayAllowedRef.current) {
                scheduleActiveFeedVideoRef.current(null);
                return;
            }
            let best: Post | null = null;
            let bestIndex = Number.POSITIVE_INFINITY;
            for (const token of viewableItems) {
                if (!token.isViewable || !token.item) continue;
                const candidate = token.item as Post;
                if (!postHasVideoMedia(candidate)) continue;
                const idx = token.index ?? 0;
                if (idx < bestIndex) {
                    best = candidate;
                    bestIndex = idx;
                }
            }
            scheduleActiveFeedVideoRef.current(best?.id ?? null);
        }
    ).current;

    useFocusEffect(
        useCallback(() => {
            setFooterActive('home');
            return () => {
                if (autoplayTimerRef.current) {
                    clearTimeout(autoplayTimerRef.current);
                    autoplayTimerRef.current = null;
                }
                setActiveVideoPostId(null);
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

    // Helper to update a post in pages
    const updatePost = (postId: string, updater: (post: Post) => Post) => {
        setPages(prev => prev.map(page =>
            page.map(p => p.id === postId ? updater(p) : p)
        ));
    };

    useFocusEffect(
        React.useCallback(() => {
            let cancelled = false;
            void loadFeedContentPrefsMobile(userId).then((prefs) => {
                if (cancelled) return;
                feedContentPrefsRef.current = prefs;
                setPages((prev) =>
                    prev
                        .map((page) => filterPostsByContentPrefs(page, prefs))
                        .filter((page) => page.length > 0)
                );
            });
            return () => {
                cancelled = true;
            };
        }, [userId])
    );

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
            if (!user || p.userHandle === user.handle) {
                Alert.alert('Cannot reclip', 'You cannot reclip your own post');
                return;
            }
            if (p.userReclipped) {
                Alert.alert('Already reclipped', 'You have already reclipped this post');
                return;
            }
            const confirmed = await new Promise<boolean>((resolve) => {
                Alert.alert(
                    'Reshare this to followers?',
                    'This post will be shared to your followers in their Following feed.',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'OK', onPress: () => resolve(true) },
                    ],
                );
            });
            if (!confirmed) return;
            const newReclips = p.stats.reclips + 1;
            setReclipState(userId, p.id, true);
            updatePost(p.id, (prev) => ({
                ...prev,
                userReclipped: true,
                stats: { ...prev.stats, reclips: newReclips },
            }));
            try {
                await reclipPost(userId, p.id, user.handle);
            } catch (err: any) {
                console.warn('Reclip failed (UI already updated):', err);
            }
        },
        [userId, user, updatePost]
    );

    useEffect(() => {
        if (user?.national) {
            const oldTabs = ['Finglas', 'Dublin', 'Ireland'];
            if (oldTabs.includes(active)) {
                setActive(user.national);
            }
        }
    }, [user?.national, user?.regional, user?.local]);

    useEffect(() => {
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
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
    }, [route?.params?.location, route?.params?.locationLabel, route?.params?.filterType, route?.params?.placeId]);

    useEffect(() => {
        setPages([]);
        setCursor(0);
        setEnd(false);
        setLoading(false);
        requestTokenRef.current++;
    }, [userId, currentFilter]);

    useEffect(() => {
        if (cursor !== null && pages.length === 0) {
            loadMore();
        }
    }, [cursor, currentFilter, reloadTick]);

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
        const interval = setInterval(updateUnreadCount, 10000);

        return () => {
            clearInterval(interval);
        };
    }, [user?.handle, updateUnreadCount]);

    // Refresh unread count when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            // Always refresh feed when returning to this screen (e.g. after creating a post)
            // so newly created mock-mode posts appear immediately.
            setPages([]);
            setCursor(0);
            setEnd(false);
            setError(null);
            requestTokenRef.current++;
            setReloadTick(prev => prev + 1);
            updateUnreadCount();
        }, [updateUnreadCount])
    );

    useEffect(() => {
        if (!route?.params?.forceRefreshAt) return;
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
        requestTokenRef.current++;
        setReloadTick(prev => prev + 1);
    }, [route?.params?.forceRefreshAt]);

    useEffect(() => {
        return subscribePendingFeedUploads(() => {
            setPendingUploadTick((tick) => tick + 1);
        });
    }, []);

    useEffect(() => {
        return subscribePendingFeedUploadComplete((tempId, createdPost) => {
            const decorated = decorateForUser(userId, createdPost);
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

    async function loadMore() {
        if (loading || end || cursor === null) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const token = requestTokenRef.current;
            const page = await fetchPostsPage(
                currentFilter,
                cursor,
                5,
                userId,
                user?.local || '',
                user?.regional || '',
                user?.national || '',
                user?.handle || ''
            );

            if (token !== requestTokenRef.current) {
                return;
            }

            let visibleItems = page.items;
            if (user?.handle) {
                const checks = await Promise.all(
                    page.items.map(async (item) => {
                        const blocked = await isUserBlocked(user.handle, item.userHandle);
                        return { item, blocked };
                    })
                );
                visibleItems = checks.filter((row) => !row.blocked).map((row) => row.item);
            }

            const archivedRows = await Promise.all(
                visibleItems.map(async (item) => ({
                    item,
                    archived: await isFeedPostArchivedMobile(userId, item.id),
                }))
            );
            visibleItems = archivedRows.filter((row) => !row.archived).map((row) => row.item);
            visibleItems = filterPostsByContentPrefs(visibleItems, feedContentPrefsRef.current);

            if (visibleItems.length === 0) {
                setEnd(true);
            } else {
                setPages(prev => [...prev, visibleItems]);
                setCursor(page.nextCursor);
            }
        } catch (err) {
            console.error('Error loading feed:', err);
            setError('Failed to load feed');
        } finally {
            setLoading(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        setPages([]);
        setCursor(0);
        setEnd(false);
        requestTokenRef.current++;
        await loadMore();
        setRefreshing(false);
    };

    const handleTabChange = (tab: Tab) => {
        // Reset pagination with the tab tap so load effects see cursor 0 (same race as web cache-first loader).
        setPages([]);
        setCursor(0);
        setEnd(false);
        setLoading(false);
        setError(null);
        requestTokenRef.current++;
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
    };

    const applyCustomLocationFeed = useCallback(
        (selection: PlaceFeedSelection, filterType: 'location' | 'venue' | 'landmark') => {
            setShowFollowingFeed(false);
            setCustomLocation(selection.filter);
            setCustomLocationLabel(selection.label);
            setCustomLocationPlaceId(selection.placeId?.trim() || null);
            setCustomFilterType(filterType);
            setPages([]);
            setCursor(0);
            setEnd(false);
            setError(null);
            requestTokenRef.current++;
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
        setCustomLocation(null);
        setCustomLocationLabel(null);
        setCustomLocationPlaceId(null);
        setCustomFilterType(null);
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
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
    };

    const pendingPosts = React.useMemo(
        () =>
            getPendingFeedUploads().map((job) => decorateForUser(userId, pendingUploadToPost(job))),
        [pendingUploadTick, userId],
    );

    const flat = React.useMemo(() => {
        const pendingIds = new Set(pendingPosts.map((p) => p.id));
        const loaded = pages.flat().filter((p) => !pendingIds.has(p.id));
        return [...pendingPosts, ...loaded];
    }, [pages, pendingPosts]);

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

    useFocusEffect(
        useCallback(() => {
            let active = true;
            void consumeStories24RailReturn().then((payload) => {
                if (active && payload) setStories24CollapsePayload(payload);
            });
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
        const interval = setInterval(load, 12000);
        const unsubRefresh = subscribeStoriesRefresh(load);
        return () => {
            cancelled = true;
            clearInterval(interval);
            unsubRefresh();
        };
    }, [user?.id, user?.handle, customLocation, showFollowingFeed]);

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
        return buildSuggestedFollowerFromPosts(flat, user, hiddenFollowerHandles);
    }, [flat, user, customLocation, suggestedFollowerDismissed, hiddenFollowerHandles]);

    const showSuggestedFollowerCard = Boolean(suggestedFollowerSuggestion);

    const showStories24Rail = !customLocation && !showFollowingFeed && stories24Items.length > 0;

    const openStoryFromRail = React.useCallback(
        (item: Stories24RailItem, railHandles: string[]) => {
            if (isStories24AddYoursHandle(item.handle)) {
                return;
            }
            void persistStories24RailOpenHandle(item.handle);
            navigation.navigate('Stories', buildStories24StoryNavParams(item, railHandles));
        },
        [navigation],
    );

    const openStories24FromHeader = React.useCallback(async () => {
        if (stories24RailRef.current?.openFirstStory()) {
            return;
        }

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

        if (!target) {
            navigation.navigate('Stories');
            return;
        }

        openStoryFromRail(target.item, target.railHandles);
    }, [stories24Items, user?.id, user?.handle, navigation, openStoryFromRail]);

    const flatForRender = React.useMemo((): FeedListRow[] => {
        const out: FeedListRow[] = [];
        let postCount = 0;
        let interestsInserted = false;
        let followerInserted = false;
        let stories24Inserted = false;
        for (const post of flat) {
            out.push({ kind: 'post', post });
            postCount += 1;
            if (!stories24Inserted && showStories24Rail && postCount === 1) {
                out.push({ kind: 'stories24', id: 'stories24-feed-rail' });
                stories24Inserted = true;
            }
            if (!followerInserted && showSuggestedFollowerCard && suggestedFollowerSuggestion && postCount === 3) {
                out.push({ kind: 'suggested_follower', suggestion: suggestedFollowerSuggestion });
                followerInserted = true;
            }
            if (!interestsInserted && showInterestsFeedCard && postCount === 4) {
                out.push({ kind: 'interests', id: 'interests-onboarding-feed-card' });
                interestsInserted = true;
            }
        }
        return out;
    }, [
        flat,
        showInterestsFeedCard,
        showSuggestedFollowerCard,
        suggestedFollowerSuggestion,
        showStories24Rail,
    ]);

    const videoPostsForScenes = React.useMemo(() => flat.filter(postHasVideoMedia), [flat]);

    const customLocationDisplay = customLocationLabel || customLocation;

    useEffect(() => {
        void loadLocationNotifyPrefs().then(setNotifyLocations);
    }, []);

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

    // Memoize renderItem to prevent recreation on every render
    const renderItem = React.useCallback(
        ({ item }: { item: FeedListRow }) => {
            if (item.kind === 'suggested_follower') {
                const sug = item.suggestion;
                return (
                    <SuggestedFollowerFeedCard
                        suggestion={sug}
                        onFollow={async (post) => {
                            if (!user) return;
                            try {
                                const updated = await toggleFollowForPost(userId, post.id, post.userHandle);
                                setPages((prev) =>
                                    prev.map((page) => page.map((p) => (p.id === post.id ? updated : p))),
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
                    />
                );
            }
            if (item.kind === 'stories24') {
                return (
                    <Stories24FeedRail
                        ref={stories24RailRef}
                        items={stories24Items}
                        onOpenStory={openStoryFromRail}
                        onAddYours={() => navigation.navigate('CreateComposer', { addYours: true })}
                        collapsePayload={stories24CollapsePayload}
                        onCollapseHandled={() => setStories24CollapsePayload(null)}
                    />
                );
            }
            if (item.kind === 'interests') {
                return (
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
                    />
                );
            }
            const post = item.post;
            const mergedPost: Post = {
                ...post,
                isBookmarked: savedByPostId[post.id] ?? post.isBookmarked,
            };
            const isPendingUpload =
                mergedPost.clientUploadStatus === 'uploading' ||
                mergedPost.clientUploadStatus === 'failed';
            return (
                <FeedCard
                    post={mergedPost}
                    isVideoActive={activeVideoPostId === mergedPost.id}
                    feedVideoMuted={feedVideoMuted}
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
                                mergedPost.userHandle
                            );
                            setPages((prev) =>
                                prev.map((page) =>
                                    page.map((p) => (p.id === mergedPost.id ? updated : p))
                                )
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
                            setPages([]);
                            setCursor(0);
                            setEnd(false);
                            setError(null);
                            requestTokenRef.current++;
                            setTimeout(() => {
                                loadMore();
                            }, 200);
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
                    onOpenImageFullscreen={(startIndex = 0) => {
                        if (isPendingUpload) return;
                        setImageFullscreenStartIndex(startIndex);
                        setImageFullscreenPost(mergedPost);
                    }}
                    onOpenScenes={() => {
                        if (isPendingUpload) return;
                        navigation.navigate('Scenes', {
                            initialPostId: mergedPost.id,
                            posts: videoPostsForScenes,
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
                        navigation.navigate('ViewProfile', { handle: mergedPost.userHandle })
                    }
                    onVisitHandle={(handle) =>
                        navigation.navigate('ViewProfile', { handle })
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
                />
            );
        },
        [
            userId,
            user,
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
            activeVideoPostId,
            feedVideoMuted,
            pendingUploadTick,
            videoPostsForScenes,
            interestsDraft,
            interestsSaving,
            saveInterests,
            stories24Items,
            openStoryFromRail,
            stories24CollapsePayload,
        ]
    );

    const syncFullscreenPost = React.useCallback(
        (updated: Post) => {
            setImageFullscreenPost((prev) => (prev?.id === updated.id ? updated : prev));
        },
        [],
    );

    return (
        <View style={styles.container}>
            <GazetteerAmbientBackground />
            <View style={styles.stickyTabsContainer}>
                <View style={styles.feedHeaderTopRow}>
                    <View style={styles.topHeaderRow}>
                        <Text style={styles.gazetteerText}>Gazetteer</Text>
                        <View style={styles.topHeaderActions}>
                            <TouchableOpacity style={[styles.headerMiniAction, styles.storiesHeaderAction]} onPress={() => navigation.navigate('Stories')}>
                                <Icon name="location" size={15} color="#D4AF37" />
                                <Text style={styles.storiesHeaderActionText}>Stories 24</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerMiniAction} onPress={() => navigation.navigate('CreateComposer', { addYours: true })}>
                                <Icon name="add-circle-outline" size={16} color="#F9FAFB" />
                                <Text style={styles.headerMiniActionText}>Add Yours</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <FlatList
                data={flatForRender}
                renderItem={renderItem}
                keyExtractor={(item) =>
                    item.kind === 'interests' || item.kind === 'stories24'
                        ? item.id
                        : item.kind === 'suggested_follower'
                          ? `suggested-follower-${item.suggestion.userHandle}`
                          : item.post.id
                }
                extraData={`${activeVideoPostId}-${pendingUploadTick}`}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfigRef.current}
                // Performance optimizations - Instagram-style
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={7}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews={Platform.OS === 'ios'}
                // Scroll performance
                scrollEventThrottle={16}           // Smooth scroll events (60fps)
                decelerationRate="fast"            // Faster deceleration for snappier feel
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                onEndReached={() => {
                    if (!loading && !end) {
                        loadMore();
                    }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#8B5CF6" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    !loading && end ? (
                        <View style={styles.emptyContainer}>
                            {customLocation ? (
                                <>
                                    <View style={styles.emptyFeedCard}>
                                        <Text style={styles.emptyFeedBadge}>
                                            {isVisitorInCustomLocation ? "YOU'RE EARLY TO THIS FEED" : 'YOUR HOME FEED'}
                                        </Text>
                                        <Text style={styles.emptyFeedTitle}>
                                            {isVisitorInCustomLocation
                                                ? `No locals are posting in ${customLocationDisplay} yet`
                                                : `No posts in your ${customLocationDisplay} feed yet`}
                                        </Text>
                                        <Text style={styles.emptyFeedSubtitle}>
                                            {isVisitorInCustomLocation
                                                ? `We'll light up this feed once people in ${customLocationDisplay} start sharing.`
                                                : 'You can be the first to post here. Share what’s happening around you.'}
                                        </Text>
                                        {isVisitorInCustomLocation ? (
                                            <>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.emptyFeedNotifyBtn,
                                                        isNotifyOnForCurrentLocation && styles.emptyFeedNotifyBtnActive,
                                                    ]}
                                                    onPress={toggleNotifyForCurrentLocation}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.emptyFeedNotifyBtnText,
                                                            isNotifyOnForCurrentLocation && styles.emptyFeedNotifyBtnTextActive,
                                                        ]}
                                                    >
                                                        {isNotifyOnForCurrentLocation
                                                            ? "You'll be notified"
                                                            : `Notify me when ${customLocationDisplay} wakes up`}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.emptyFeedSecondaryBtn}
                                                    onPress={clearCustomLocation}
                                                >
                                                    <Text style={styles.emptyFeedSecondaryBtnText}>Back to your home feed</Text>
                                                </TouchableOpacity>
                                                <Text style={styles.emptyFeedNotifyHint}>
                                                    Feed warming up · we'll only ping you when real clips from{' '}
                                                    {customLocationDisplay} start to appear.
                                                </Text>
                                            </>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.emptyFeedPrimaryBtn}
                                                onPress={() => navigation.navigate('CreateComposer')}
                                            >
                                                <Text style={styles.emptyFeedPrimaryBtnText}>Create a clip in this feed</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <LocationPlaceSummaryCard
                                        locationLabel={customLocationDisplay || customLocation}
                                        placeId={customLocationPlaceId}
                                    />
                                </>
                            ) : (
                                <Text style={styles.emptyText}>No posts found</Text>
                            )}
                        </View>
                    ) : null
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.feedContent,
                    { paddingBottom: Math.max(insets.bottom, 8) + 12 },
                ]}
            />

            <ImageFullscreenModal
                post={imageFullscreenPost}
                visible={Boolean(imageFullscreenPost)}
                initialIndex={imageFullscreenStartIndex}
                onClose={() => {
                    setImageFullscreenPost(null);
                    setImageFullscreenStartIndex(0);
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
            />

            <PostCommentsSheet
                postId={selectedPostId || ''}
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
                            }))
                        )
                        .catch(() => {});
                }}
                onClose={() => {
                    setCommentsModalOpen(false);
                    setSelectedPostId(null);
                    setSelectedPostForComments(null);
                }}
            />

            <FeedShareModal
                post={selectedPostForShare}
                isOpen={shareModalOpen}
                onClose={() => {
                    setShareModalOpen(false);
                    setSelectedPostForShare(null);
                }}
            />

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

            <FeedDmDeliveryFx fx={feedDmDeliveryFx} />

            <PlaceFeedScopePickerModal
                visible={!!headerScopePicker}
                suggestion={headerScopePicker}
                onClose={() => setHeaderScopePicker(null)}
                onSelectScope={(scope) => {
                    if (!headerScopePicker) return;
                    applyCustomLocationFeed(
                        resolvePlaceFeedSelection(headerScopePicker, scope),
                        headerScopePickerKind
                    );
                    setHeaderScopePicker(null);
                }}
            />

            <PostOverflowMenuModal
                visible={overflowVisible}
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
                        overflowPost.userHandle
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

            <CreateGroupModal
                visible={createGroupOpen}
                onClose={() => setCreateGroupOpen(false)}
                onCreated={(g) => {
                    setCreateGroupOpen(false);
                    navigation.navigate('Messages', { chatGroupId: g.id, kind: 'group' });
                }}
            />

            <PickGroupToInviteFeedUserModal
                visible={!!inviteGroupHandle}
                inviteeHandle={inviteGroupHandle || ''}
                onClose={() => setInviteGroupHandle(null)}
            />

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
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    stickyTabsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(11, 7, 17, 0.72)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        elevation: 10,
        width: '100%',
    },
    feedHeaderTopRow: {
        paddingTop: 12,
        paddingBottom: 4,
        alignItems: 'stretch',
        justifyContent: 'center',
        zIndex: 1,
        paddingHorizontal: 12,
    },
    topHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    topHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerMiniAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        ...glassSurface,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    boostHeaderAction: {
        borderColor: '#FDE68A',
        backgroundColor: '#FBBF24',
    },
    headerMiniActionText: {
        color: '#F9FAFB',
        fontSize: 11,
        fontWeight: '700',
    },
    storiesHeaderAction: {
        borderColor: '#6B7280',
        backgroundColor: '#0B1220',
    },
    storiesHeaderActionText: {
        color: '#E5E7EB',
        fontSize: 11,
        fontWeight: '700',
    },
    gazetteerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    gazetteerText: {
        fontSize: 18,
        fontWeight: '300',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    notificationButton: {
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: 'bold',
    },
    profileMenuCard: {
        marginTop: 60,
        marginLeft: 16,
        borderRadius: 12,
        paddingVertical: 4,
        minWidth: 170,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
        ...glassPanel,
    },
    profileMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        columnGap: 8,
    },
    profileMenuItemText: {
        fontSize: 14,
        color: '#F9FAFB',
        fontWeight: '500',
    },
    tabContainer: {
        backgroundColor: 'transparent',
        paddingVertical: 8,
        position: 'relative',
        zIndex: 1,
    },
    tabGrid: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        gap: 8,
    },
    feedHeaderPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        minHeight: 40,
        zIndex: 30,
    },
    feedHeaderIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedHeaderSideAction: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    feedHeaderRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    feedHeaderCenter: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        position: 'relative',
    },
    feedDropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        maxWidth: '100%',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#36454F',
    },
    feedDropdownActiveIcon: {
        marginTop: 1,
    },
    feedDropdownActiveDot: {
        width: 8,
        height: 8,
        borderRadius: 999,
    },
    feedDropdownActiveText: {
        flexShrink: 1,
        maxWidth: 160,
        fontSize: 18,
        fontWeight: '700',
        color: '#E5E7EB',
        letterSpacing: 0.2,
    },
    feedDropdownMenu: {
        position: 'absolute',
        top: 44,
        alignSelf: 'center',
        width: 232,
        backgroundColor: 'rgba(36, 40, 49, 0.94)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        paddingVertical: 7,
        zIndex: 60,
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 12 },
        elevation: 36,
    },
    feedDropdownSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12,
        marginTop: 8,
        marginBottom: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        backgroundColor: 'transparent',
    },
    feedDropdownSearchInput: {
        flex: 1,
        color: '#F9FAFB',
        fontSize: 14,
        marginLeft: 8,
        paddingVertical: 0,
        borderWidth: 0,
        includeFontPadding: false,
    },
    feedDropdownSearchHint: {
        marginTop: 5,
        marginBottom: 4,
        marginHorizontal: 14,
        color: 'rgba(255,255,255,0.48)',
        fontSize: 11,
    },
    feedDropdownSuggestionsWrap: {
        marginHorizontal: 12,
        marginBottom: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(0,0,0,0.2)',
        overflow: 'hidden',
    },
    feedDropdownSuggestionItem: {
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    feedDropdownSuggestionText: {
        color: '#F9FAFB',
        fontSize: 13,
    },
    feedDropdownSuggestionsMeta: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    feedDropdownMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingHorizontal: 15,
        paddingVertical: 11,
    },
    feedDropdownMenuText: {
        fontSize: 16,
        color: '#F9FAFB',
        fontWeight: '600',
    },
    feedHeaderNotifWrap: {
        position: 'relative',
        alignItems: 'center',
    },
    feedHeaderPassportAvatarWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#374151',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedHeaderPassportAvatarImage: {
        width: '100%',
        height: '100%',
    },
    feedHeaderPassportInitials: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    feedHeaderPassportLabel: {
        marginTop: 1,
        fontSize: 9,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    feedContent: {
        paddingTop: 92,
    },
    feedCard: {
        marginHorizontal: 10,
        marginBottom: FEED_UI.spacing.cardGap,
        borderRadius: 16,
        overflow: 'visible',
        ...glassPanel,
    },
    mediaWrap: {
        width: '100%',
        backgroundColor: '#000000',
        position: 'relative',
        overflow: 'hidden',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        gap: 6,
    },
    uploadingOverlayTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        marginTop: 4,
    },
    uploadingOverlaySubtitle: {
        color: '#D1D5DB',
        fontSize: 12,
        textAlign: 'center',
    },
    engagementBarDimmed: {
        opacity: 0.45,
    },
    captionWrap: {
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingTop: 8,
        paddingBottom: 4,
    },
    sponsoredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 6,
    },
    sponsoredText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F59E0B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sponsoredFeedType: {
        fontSize: 12,
        color: '#9CA3AF',
        textTransform: 'capitalize',
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingTop: 10,
        paddingBottom: 6,
    },
    postHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarWrapper: {
        position: 'relative',
        marginRight: 10,
    },
    avatarContainer: {
        position: 'relative',
    },
    storyBorder: {
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInner: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    followPlusButton: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#d91b5c',
        borderWidth: 2,
        borderColor: 'rgba(26, 21, 36, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    followCheckButton: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: 'rgba(26, 21, 36, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    postHeaderInfo: {
        flex: 1,
    },
    userHandle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    postMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
        gap: 4,
    },
    locationText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    separator: {
        fontSize: 12,
        color: '#6B7280',
    },
    timeText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    postHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    postOverflowButton: {
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gazetteerOverlayText: {
        fontSize: 12,
        fontWeight: '300',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    locationButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(217, 27, 92, 0.18)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    postImage: {
        width: '100%',
        height: 400,
        backgroundColor: '#111827',
    },
    textCardWrapper: {
        marginHorizontal: 16,
        marginVertical: 10,
        alignItems: 'center',
    },
    textCard: {
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        ...glassSurface,
    },
    textCardDecorativeLine: {
        width: 2,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        marginHorizontal: 8,
    },
    textCardContent: {
        flex: 1,
        fontSize: 16,
        color: '#F3F4F6',
        lineHeight: 22,
    },
    textCardTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'rgba(24, 24, 28, 0.65)',
        marginTop: -1,
    },
    engagementBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingVertical: 7,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: FEED_UI.spacing.groupGap,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: FEED_UI.spacing.groupGapTight,
    },
    externalShareButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorContainer: {
        padding: 16,
        backgroundColor: '#FEE2E2',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 24,
        alignItems: 'stretch',
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
        textAlign: 'center',
    },
    emptyFeedCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(55, 65, 81, 0.9)',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        paddingHorizontal: 20,
        paddingVertical: 24,
        alignItems: 'center',
    },
    emptyFeedBadge: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        color: '#9CA3AF',
        marginBottom: 12,
        textAlign: 'center',
    },
    emptyFeedTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyFeedSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 16,
    },
    emptyFeedPrimaryBtn: {
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#EF4444',
    },
    emptyFeedPrimaryBtnText: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '700',
    },
    emptyFeedSecondaryBtn: {
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
    },
    emptyFeedSecondaryBtnText: {
        color: '#D1D5DB',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyFeedNotifyBtn: {
        marginTop: 4,
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#0EA5E9',
        width: '100%',
        alignItems: 'center',
    },
    emptyFeedNotifyBtnActive: {
        backgroundColor: '#16A34A',
    },
    emptyFeedNotifyBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyFeedNotifyBtnTextActive: {
        color: '#FFFFFF',
    },
    emptyFeedNotifyHint: {
        marginTop: 12,
        fontSize: 11,
        lineHeight: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    boostPromptCard: {
        margin: 24,
        borderRadius: 14,
        padding: 16,
        gap: 10,
        ...glassPanel,
    },
    boostPromptTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    boostPromptText: {
        color: '#D1D5DB',
        fontSize: 13,
        lineHeight: 18,
    },
    boostPromptActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    boostPromptSecondaryBtn: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
        ...glassSurface,
    },
    boostPromptSecondaryText: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '700',
    },
    boostPromptPrimaryBtn: {
        flex: 1,
        borderRadius: 10,
        backgroundColor: '#d91b5c',
        paddingVertical: 10,
        alignItems: 'center',
    },
    boostPromptPrimaryText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
});

export default FeedScreen;
