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
} from '../api/posts';
import { userHasUnviewedStoriesByHandle, userHasStoriesByHandle } from '../api/stories';
import { getUnreadTotal } from '../api/messages';
import { blockUser } from '../api/messages';
import { isUserBlocked } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import { enqueue, drain } from '../utils/mutationQueue';
import type { Post } from '../types';
import { getInstagramImageDimensions } from '../utils/imageDimensions';
import { FEED_UI } from '../constants/feedUiTokens';
import { Dimensions } from 'react-native';
import FeedPostMeta from '../components/FeedPostMeta';
import FeedEngagementRow from '../components/FeedEngagementRow';
import FeedShareModal from '../components/FeedShareModal';
import PostOverflowMenuModal from '../components/PostOverflowMenuModal';
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

type Tab = string;

function PillTabs({
    active,
    onChange,
    customLocation = null,
    customFilterType = null,
    userLocal = 'Finglas',
    userRegional = 'Dublin',
    userNational = 'Ireland',
    hasNotifications = false,
    onOpenBoost,
    onOpenPassport,
    onOpenDiscover,
    onSearchLocation,
    onClearCustom,
}: {
    active: Tab;
    onChange: (t: Tab) => void;
    customLocation?: string | null;
    customFilterType?: 'location' | 'venue' | 'landmark' | null;
    userLocal?: string;
    userRegional?: string;
    userNational?: string;
    hasNotifications?: boolean;
    onOpenBoost: () => void;
    onOpenPassport: () => void;
    onOpenDiscover: () => void;
    onSearchLocation?: (location: string, filterType: 'location' | 'venue' | 'landmark') => void;
    onClearCustom?: () => void;
}) {
    type HeaderSuggestion = { name: string; type: 'location' | 'venue' | 'landmark'; country?: string };
    const [menuOpen, setMenuOpen] = useState(false);
    const [showGazetteerTitle, setShowGazetteerTitle] = useState(true);
    const [locationQuery, setLocationQuery] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<HeaderSuggestion[]>([]);
    const [usingFallbackSuggestions, setUsingFallbackSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [searchHintIndex, setSearchHintIndex] = useState(0);
    const [searchInputFocused, setSearchInputFocused] = useState(false);
    const searchHints = useMemo(() => ['Search any city', 'Search any country', 'Search any region'], []);
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
    const activeLabel = customLocation || (active === userLocal ? 'Nearby' : active);
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
                        const t = String((s as any)?.type || '').toLowerCase();
                        const kind: 'location' | 'venue' | 'landmark' = t.includes('venue')
                            ? 'venue'
                            : t.includes('landmark')
                                ? 'landmark'
                                : 'location';
                        return { name: s.name, country: (s as any).country, type: kind };
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
        onSearchLocation?.(next, filterType);
        setMenuOpen(false);
    };

    return (
        <View style={styles.tabContainer}>
            <View style={styles.feedHeaderPickerRow}>
                <TouchableOpacity onPress={onOpenBoost} style={styles.feedHeaderIconButton}>
                    <Icon name="flash" size={18} color="#FBBF24" />
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
                        <Text style={styles.feedDropdownActiveText}>{headerLabel}</Text>
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
                                                    onSearchLocation?.(s.name, mode);
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

                <TouchableOpacity onPress={onOpenPassport} style={styles.feedHeaderIconButton}>
                    <View style={styles.feedHeaderNotifWrap}>
                        <Icon name="person-circle-outline" size={22} color="#FFFFFF" />
                        <Text style={styles.feedHeaderPassportLabel}>Passport</Text>
                    </View>
                </TouchableOpacity>
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

function PostHeader({
    post,
    onFollow,
    isCurrentUser,
    onProfileMenuPress,
    onHasStoryChange,
    onOverflowPress,
}: {
    post: Post;
    onFollow?: () => Promise<void>;
    isCurrentUser: boolean;
    onProfileMenuPress?: () => void;
    onHasStoryChange?: (hasStory: boolean) => void;
    onOverflowPress?: () => void;
}) {
    const [hasStory, setHasStory] = useState(false);
    const [showFollowCheck, setShowFollowCheck] = useState(post.isFollowing === true);

    useEffect(() => {
        async function checkStory() {
            try {
                // For profile quick-actions, we want "View stories" whenever the user has
                // any active 24h story (not only unviewed).
                const hasAnyActiveStory = await userHasStoriesByHandle(post.userHandle);
                setHasStory(hasAnyActiveStory);
                onHasStoryChange?.(hasAnyActiveStory);
            } catch (error) {
                console.error('Error checking story:', error);
            }
        }
        checkStory();
    }, [post.userHandle, isCurrentUser]);

    // Show the follow checkmark briefly after following, then hide it
    useEffect(() => {
        let timer: any;
        if (!isCurrentUser && onFollow && post.isFollowing) {
            setShowFollowCheck(true);
            timer = setTimeout(() => {
                setShowFollowCheck(false);
            }, 2500);
        } else {
            setShowFollowCheck(false);
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [post.isFollowing, isCurrentUser, onFollow]);

    return (
        <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
                <TouchableOpacity 
                    style={styles.avatarWrapper}
                    onPress={onProfileMenuPress}
                >
                    <Avatar
                        src={undefined}
                        name={post.userHandle.split('@')[0]}
                        size={32}
                        hasStory={hasStory}
                    />
                    {/* + icon overlay on profile picture */}
                    {!isCurrentUser && onFollow && (post.isFollowing === false || post.isFollowing === undefined) && (
                        <TouchableOpacity
                            onPress={onFollow}
                            style={styles.followPlusButton}
                        >
                            <Icon name="add" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                    {/* Checkmark when following */}
                    {!isCurrentUser && onFollow && post.isFollowing === true && showFollowCheck && (
                        <View style={styles.followCheckButton}>
                            <Icon name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.postHeaderInfo}
                    onPress={onProfileMenuPress}
                >
                    <FeedPostMeta
                        handle={post.userHandle}
                        timeText={post.createdAt ? timeAgo(post.createdAt) : undefined}
                        locationText={
                            (post.locationLabel || post.venue)
                                ? `${post.locationLabel || ''}${post.venue ? ` · ${post.venue}` : ''}`.trim()
                                : undefined
                        }
                    />
                </TouchableOpacity>
            </View>
            <View style={styles.postHeaderRight}>
                {onOverflowPress ? (
                    <TouchableOpacity
                        onPress={(e) => {
                            e?.stopPropagation?.();
                            onOverflowPress();
                        }}
                        style={styles.postOverflowButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Icon name="ellipsis-horizontal" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                ) : null}
                {post.locationLabel && (
                    <TouchableOpacity style={styles.locationButton}>
                        <Icon name="location" size={12} color="#8B5CF6" />
                    </TouchableOpacity>
                )}
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
    onViewStories,
    onBlockUser,
    onReportUser,
    onNotificationsPress,
    unreadCount,
    hasInbox,
    isCurrentUser,
    onOverflowPress,
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
    onVisitProfile?: () => void;
    onViewStories?: () => void;
    onBlockUser?: () => Promise<void>;
    onReportUser?: () => Promise<void>;
    onNotificationsPress?: () => void;
    unreadCount?: number;
    hasInbox?: boolean;
    isCurrentUser: boolean;
    onOverflowPress?: () => void;
}) {
    const [imageDimensions, setImageDimensions] = React.useState<{ width: number; height: number } | null>(null);
    const [profileMenuVisible, setProfileMenuVisible] = React.useState(false);
    const [headerHasStory, setHeaderHasStory] = React.useState(false);
    const lastMediaTapRef = React.useRef(0);
    const singleMediaTapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const screenWidth = Dimensions.get('window').width;
    const DOUBLE_TAP_DELAY_MS = 260;

    // Auto-detect image dimensions if not provided
    React.useEffect(() => {
        if (post.mediaUrl && !imageDimensions) {
            Image.getSize(
                post.mediaUrl,
                (width, height) => {
                    // Calculate Instagram-style dimensions with clamping
                    const dimensions = getInstagramImageDimensions(width, height, screenWidth);
                    const minHeight = screenWidth * FEED_UI.media.minAspect;
                    const maxHeight = screenWidth * FEED_UI.media.maxAspect;
                    const portraitFirstHeight = Math.min(Math.max(dimensions.height, minHeight), maxHeight);
                    setImageDimensions({ width: dimensions.width, height: portraitFirstHeight });
                },
                (error) => {
                    console.error('Error getting image size:', error);
                    // Fallback to default dimensions
                    setImageDimensions({ width: screenWidth, height: screenWidth * FEED_UI.media.maxAspect });
                }
            );
        }
    }, [post.mediaUrl, screenWidth]);

    // Calculate image style with Instagram clamping
    const imageStyle = React.useMemo(() => {
        if (imageDimensions) {
            return {
                width: imageDimensions.width,
                height: imageDimensions.height,
                backgroundColor: '#111827',
            };
        }
        // Default while loading
        return {
            width: screenWidth,
            height: screenWidth * FEED_UI.media.maxAspect, // Default to max portrait aspect ratio
            backgroundColor: '#111827',
        };
    }, [imageDimensions, screenWidth]);

    const handleMediaPress = React.useCallback(() => {
        const now = Date.now();
        if (now - lastMediaTapRef.current <= DOUBLE_TAP_DELAY_MS) {
            if (singleMediaTapTimerRef.current) {
                clearTimeout(singleMediaTapTimerRef.current);
                singleMediaTapTimerRef.current = null;
            }
            lastMediaTapRef.current = 0;
            // Match web behavior: double tap should only like, not unlike.
            if (!post.userLiked) {
                onLike().catch((error) => console.error('Error in media double-tap like:', error));
            }
            return;
        }
        lastMediaTapRef.current = now;
        singleMediaTapTimerRef.current = setTimeout(() => {
            onPostPress?.();
            singleMediaTapTimerRef.current = null;
        }, DOUBLE_TAP_DELAY_MS + 20);
    }, [DOUBLE_TAP_DELAY_MS, onLike, onPostPress, post.userLiked]);

    React.useEffect(() => {
        return () => {
            if (singleMediaTapTimerRef.current) {
                clearTimeout(singleMediaTapTimerRef.current);
            }
        };
    }, []);

    return (
        <TouchableOpacity
            style={styles.feedCard}
            onPress={onPostPress}
            activeOpacity={0.95}
        >
            <PostHeader
                post={post}
                onFollow={onFollow}
                isCurrentUser={isCurrentUser}
                onProfileMenuPress={() => setProfileMenuVisible(true)}
                onHasStoryChange={setHeaderHasStory}
                onOverflowPress={onOverflowPress}
            />

            {post.isBoosted && (
                <View style={styles.sponsoredBadge}>
                    <Text style={styles.sponsoredText}>Sponsored</Text>
                    {post.boostFeedType && (
                        <Text style={styles.sponsoredFeedType}>· {post.boostFeedType} boost</Text>
                    )}
                </View>
            )}

            {post.mediaUrl && (
                <Pressable onPress={handleMediaPress}>
                    <Image
                        source={{ uri: post.mediaUrl }}
                        style={imageStyle}
                        onLoad={onView}
                        resizeMode="cover"
                    // Performance optimizations
                    // Note: React Native Image automatically caches and lazy loads
                    // Progressive rendering is handled by the platform
                    />
                </Pressable>
            )}

            {post.text && (
                <View style={styles.textCardWrapper}>
                    <View style={styles.textCard}>
                        <View style={styles.textCardDecorativeLine} />
                        <Text style={styles.textCardContent}>{post.text}</Text>
                        <View style={styles.textCardDecorativeLine} />
                    </View>
                    <View style={styles.textCardTail} />
                </View>
            )}

            <View style={styles.engagementBar}>
                <View style={styles.actionButtons}>
                    <FeedEngagementRow
                        likes={post.stats.likes}
                        comments={post.stats.comments}
                        reclips={post.stats.reclips}
                        views={post.stats.views}
                        userLiked={post.userLiked}
                        userReclipped={post.userReclipped}
                        onLike={() => { void onLike(); }}
                        onComment={onComment}
                        onReclip={!isCurrentUser ? () => { void onReclip(); } : undefined}
                        onShare={() => { void onShare(); }}
                        showReclip={!isCurrentUser}
                        showShare
                        showViews
                    />
                </View>

                <View style={styles.rightActions}>
                    {onNotificationsPress && (
                        <TouchableOpacity
                            onPress={onNotificationsPress}
                            style={styles.notificationButton}
                        >
                            <Icon
                                name="notifications"
                                size={FEED_UI.icon.action}
                                color={hasInbox ? "#3B82F6" : "#6B7280"}
                            />
                            {hasInbox && unreadCount && unreadCount > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.notificationBadgeText}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onBookmark}>
                        <Icon
                            name={post.isBookmarked ? "bookmark" : "bookmark-outline"}
                            size={FEED_UI.icon.action}
                            color={post.isBookmarked ? "#7A8AF0" : "#6B7280"}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Profile quick actions menu (Visit profile / Follow-Unfollow / View stories) */}
            {profileMenuVisible && (
                <View style={styles.profileMenuCard}>
                    <TouchableOpacity
                        style={styles.profileMenuItem}
                        onPress={() => {
                            setProfileMenuVisible(false);
                            onVisitProfile?.();
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

                    {onViewStories && (
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
        </TouchableOpacity>
    );
});

function FeedScreen({ navigation, route }: { navigation?: any; route?: any }) {
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const defaultLocal = user?.local || 'Finglas';
    const defaultNational = user?.national || 'Ireland';
    const defaultRegional = user?.regional || 'Dublin';

    const [active, setActive] = useState<Tab>(defaultNational);
    const [pages, setPages] = useState<Post[][]>([]);
    const [cursor, setCursor] = useState<string | number | null>(0);
    const [loading, setLoading] = useState(false);
    const [end, setEnd] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showFollowingFeed, setShowFollowingFeed] = useState(false);
    const [customLocation, setCustomLocation] = useState<string | null>(null);
    const [customFilterType, setCustomFilterType] = useState<'location' | 'venue' | 'landmark' | null>(null);
    const [commentsModalOpen, setCommentsModalOpen] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [footerActive, setFooterActive] = useState<'home' | 'discover' | 'create' | 'search' | 'inbox'>('home');
    const [hasInbox, setHasInbox] = useState(false);
    const [reloadTick, setReloadTick] = useState(0);
    const [showBoostPrompt, setShowBoostPrompt] = useState(false);
    /** Local overrides keyed by post id so bookmark rail matches collections without refetching whole feed. */
    const [savedByPostId, setSavedByPostId] = useState<Record<string, boolean>>({});
    const [overflowVisible, setOverflowVisible] = useState(false);
    const [overflowPost, setOverflowPost] = useState<Post | null>(null);
    const [overflowSaved, setOverflowSaved] = useState(false);
    const [overflowNotify, setOverflowNotify] = useState(false);
    const requestTokenRef = useRef(0);

    useFocusEffect(
        useCallback(() => {
            setFooterActive('home');
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

    const hideUserFromFeed = React.useCallback((handleToHide: string) => {
        const normalized = String(handleToHide || '').trim().toLowerCase();
        if (!normalized) return;
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

    const openShareForPost = React.useCallback(
        async (p: Post) => {
            setSelectedPostForShare(p);
            setShareModalOpen(true);
            try {
                await incrementShares(userId, p.id);
                updatePost(p.id, (prev) => ({
                    ...prev,
                    stats: { ...prev.stats, shares: prev.stats.shares + 1 },
                }));
            } catch (err) {
                console.error('Error sharing post:', err);
            }
        },
        [userId, updatePost]
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
        const requestedFilterType = route?.params?.filterType as 'location' | 'venue' | 'landmark' | undefined;
        if (!requestedLocation || typeof requestedLocation !== 'string') return;
        const next = requestedLocation.trim();
        if (!next) return;
        setShowFollowingFeed(false);
        setCustomLocation(next);
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
    }, [route?.params?.location, route?.params?.filterType]);

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
            setCustomFilterType(null);
            setActive('Following'); // Set active to Following so it's highlighted
        } else {
            setShowFollowingFeed(false);
            setCustomLocation(null);
            setCustomFilterType(null);
            setActive(tab);
        }
    };

    const handleHeaderLocationSearch = (location: string, filterType: 'location' | 'venue' | 'landmark' = 'location') => {
        const next = location.trim();
        if (!next) return;
        setShowFollowingFeed(false);
        setCustomLocation(next);
        setCustomFilterType(filterType);
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
    };

    const clearCustomLocation = () => {
        setCustomLocation(null);
        setCustomFilterType(null);
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
    };

    const flat = pages.flat();

    // Memoize renderItem to prevent recreation on every render
    const renderItem = React.useCallback(
        ({ item: post }: { item: Post }) => {
            const mergedPost: Post = {
                ...post,
                isBookmarked: savedByPostId[post.id] ?? post.isBookmarked,
            };
            return (
                <FeedCard
                    post={mergedPost}
                    onLike={async () => {
                        const updated = await toggleLike(userId, mergedPost.id, mergedPost);
                        setPages((prev) =>
                            prev.map((page) => page.map((p) => (p.id === mergedPost.id ? updated : p)))
                        );
                    }}
                    onFollow={async () => {
                        if (!user) return;
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
                        await incrementViews(userId, mergedPost.id);
                    }}
                    onComment={() => {
                        setSelectedPostId(mergedPost.id);
                        setSelectedPostForComments(mergedPost);
                        setCommentsModalOpen(true);
                    }}
                    onShare={async () => {
                        await openShareForPost(mergedPost);
                    }}
                    onReclip={async () => {
                        await tryReclipPost(mergedPost);
                    }}
                    onBookmark={async () => {
                        await toggleCollectionsSaveForPost(mergedPost);
                    }}
                    onOverflowPress={() => {
                        setOverflowPost(mergedPost);
                        setOverflowVisible(true);
                    }}
                    onPostPress={() => navigation.navigate('PostDetail', { postId: mergedPost.id })}
                    onVisitProfile={() =>
                        navigation.navigate('ViewProfile', { handle: mergedPost.userHandle })
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
                        Alert.alert('Reported', 'Thanks for reporting. We will review this content.');
                    }}
                    onNotificationsPress={() => navigation.navigate('Inbox')}
                    unreadCount={unreadCount}
                    hasInbox={hasInbox}
                    isCurrentUser={user?.handle === mergedPost.userHandle}
                />
            );
        },
        [
            userId,
            user,
            showFollowingFeed,
            currentFilter,
            unreadCount,
            hasInbox,
            navigation,
            updatePost,
            loadMore,
            savedByPostId,
            openShareForPost,
            tryReclipPost,
            toggleCollectionsSaveForPost,
            hideUserFromFeed,
        ]
    );

    return (
        <View style={styles.container}>
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
                    customFilterType={customFilterType}
                    userLocal={defaultLocal}
                    userRegional={defaultRegional}
                    userNational={defaultNational}
                    hasNotifications={hasInbox || unreadCount > 0}
                    onOpenBoost={() => setShowBoostPrompt(true)}
                    onOpenPassport={() => navigation.navigate('Profile')}
                    onOpenDiscover={() => navigation.navigate('Discover')}
                    onSearchLocation={handleHeaderLocationSearch}
                    onClearCustom={clearCustomLocation}
                />
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <FlatList
                data={flat}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                // Performance optimizations - Instagram-style
                initialNumToRender={3}              // Only render first 3 items on mount
                maxToRenderPerBatch={3}            // Render max 3 items per batch
                windowSize={5}                     // Keep ~5 screen heights of items in memory
                updateCellsBatchingPeriod={50}    // Batch updates every 50ms
                removeClippedSubviews={true}      // Remove off-screen views (test carefully)
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
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No posts found</Text>
                        </View>
                    ) : null
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedContent}
            />

            <View style={styles.bottomFooterNav}>
                <TouchableOpacity style={[styles.bottomFooterItem, footerActive === 'home' && styles.bottomFooterItemActive]} onPress={() => { setFooterActive('home'); navigation.navigate('Home'); }}>
                    <Icon name="home" size={18} color={footerActive === 'home' ? '#F9FAFB' : '#FFFFFF'} />
                    <Text style={[styles.bottomFooterLabel, footerActive === 'home' && styles.bottomFooterLabelActive]}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bottomFooterItem, footerActive === 'discover' && styles.bottomFooterItemActive]} onPress={() => { setFooterActive('discover'); navigation.navigate('Discover'); }}>
                    <Icon name="compass-outline" size={18} color={footerActive === 'discover' ? '#F9FAFB' : '#FFFFFF'} />
                    <Text style={[styles.bottomFooterLabel, footerActive === 'discover' && styles.bottomFooterLabelActive]}>Discover</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bottomFooterItem, footerActive === 'create' && styles.bottomFooterItemActive]} onPress={() => { setFooterActive('create'); navigation.navigate('CreateComposer', { addYours: true }); }}>
                    <Icon name="add-circle-outline" size={18} color={footerActive === 'create' ? '#F9FAFB' : '#FFFFFF'} />
                    <Text style={[styles.bottomFooterLabel, footerActive === 'create' && styles.bottomFooterLabelActive]}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bottomFooterItem, footerActive === 'search' && styles.bottomFooterItemActive]} onPress={() => { setFooterActive('search'); navigation.navigate('Search'); }}>
                    <Icon name="search-outline" size={18} color={footerActive === 'search' ? '#F9FAFB' : '#FFFFFF'} />
                    <Text style={[styles.bottomFooterLabel, footerActive === 'search' && styles.bottomFooterLabelActive]}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bottomFooterItem, footerActive === 'inbox' && styles.bottomFooterItemActive]} onPress={() => { setFooterActive('inbox'); navigation.navigate('Inbox'); }}>
                    <View style={styles.bottomFooterInboxIconWrap}>
                        <Icon name="chatbox-ellipses-outline" size={18} color={footerActive === 'inbox' ? '#F9FAFB' : '#FFFFFF'} />
                        {unreadCount > 0 ? (
                            <View style={styles.bottomFooterBadge}>
                                <Text style={styles.bottomFooterBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={[styles.bottomFooterLabel, footerActive === 'inbox' && styles.bottomFooterLabelActive]}>Inbox</Text>
                </TouchableOpacity>
            </View>

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
                onSaveToggle={async () => {
                    if (!overflowPost) return;
                    await toggleCollectionsSaveForPost(overflowPost);
                    const cols = await getCollectionsForPost(userId, overflowPost.id);
                    setOverflowSaved(cols.length > 0);
                }}
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
                    Alert.alert('Reported', 'Thanks for reporting. We will review this content.');
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
        backgroundColor: '#000000',
    },
    stickyTabsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#000000',
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
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
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
        backgroundColor: '#020617',
        borderRadius: 12,
        paddingVertical: 4,
        minWidth: 170,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1F2937',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
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
    feedHeaderCenter: {
        flex: 1,
        alignItems: 'center',
        position: 'relative',
    },
    feedDropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
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
        fontSize: 20,
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
    feedHeaderPassportLabel: {
        marginTop: 1,
        fontSize: 9,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    feedContent: {
        paddingBottom: 92,
        paddingTop: 92,
    },
    bottomFooterNav: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(0,0,0,0.92)',
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        paddingTop: 6,
        paddingBottom: 10,
        paddingHorizontal: 6,
        zIndex: 1200,
    },
    bottomFooterItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        rowGap: 2,
        borderRadius: 12,
        paddingVertical: 3,
    },
    bottomFooterItemActive: {
        backgroundColor: '#111827',
    },
    bottomFooterLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    bottomFooterLabelActive: {
        color: '#F9FAFB',
    },
    bottomFooterInboxIconWrap: {
        position: 'relative',
    },
    bottomFooterBadge: {
        position: 'absolute',
        top: -6,
        right: -10,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    bottomFooterBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '700',
    },
    feedCard: {
        backgroundColor: '#000000',
        marginBottom: FEED_UI.spacing.cardGap,
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
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        borderColor: '#030712',
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
        borderColor: '#030712',
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
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
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
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    textCardDecorativeLine: {
        width: 2,
        height: 40,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    textCardContent: {
        flex: 1,
        fontSize: 16,
        color: '#000000',
    },
    textCardTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#FFFFFF',
        marginTop: -1,
    },
    engagementBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingVertical: 7,
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
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    boostPromptCard: {
        margin: 24,
        backgroundColor: '#030712',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#374151',
        padding: 16,
        gap: 10,
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
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingVertical: 10,
        alignItems: 'center',
    },
    boostPromptSecondaryText: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '700',
    },
    boostPromptPrimaryBtn: {
        flex: 1,
        borderRadius: 10,
        backgroundColor: '#FBBF24',
        paddingVertical: 10,
        alignItems: 'center',
    },
    boostPromptPrimaryText: {
        color: '#111827',
        fontSize: 13,
        fontWeight: '800',
    },
});

export default FeedScreen;
