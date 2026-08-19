import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Linking,
    Dimensions,
    ActivityIndicator,
    Modal,
    Alert,
    Pressable,
} from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import StoriesPopIcon from '../components/StoriesPopIcon.native';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import StoryViewerMedia from '../components/stories/StoryViewerMedia.native';
import StorySharedPostViewer from '../components/stories/StorySharedPostViewer.native';
import StoryProfileCard from '../components/stories/StoryProfileCard.native';
import StoryDeliveryFx, {
    type StoryDeliveryFxState,
} from '../components/stories/StoryDeliveryFx.native';
import StorySwipeLayer from '../components/stories/StorySwipeLayer.native';
import StoryShareSheet from '../components/stories/StoryShareSheet.native';
import StoryInsightsSheet from '../components/stories/StoryInsightsSheet.native';
import StoryBottomBar from '../components/stories/StoryBottomBar.native';
import StoryViewerHeader from '../components/stories/StoryViewerHeader.native';
import StoryTextOverlay from '../components/stories/StoryTextOverlay.native';
import { gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { 
    fetchFollowedUsersStoryGroups,
    fetchStoryGroupByHandle,
    fetchUserStories, 
    markStoryViewed, 
    incrementStoryViews,
    addStoryReaction,
    addStoryReply,
    voteOnPoll,
} from '../api/stories';
import StoryPollOverlay from '../components/stories/StoryPollOverlay.native';
import {
    STORIES24_LOADING_HOLD_MS,
    clearStories24RailOpenHandle,
    persistStories24RailReturn,
    readStories24RailOpenHandle,
} from '../utils/stories24Rail';
import { isGazetteerWorldGroup, withGazetteerWorldGroup } from '../utils/gazetteerWorldStories';
import { isStoryVideo, resolveStoryVideoPlaybackUrl } from '../utils/storyMediaNative';
import {
    deliverStoryReactionToInbox,
    deliverStoryReplyToInbox,
} from '../utils/sendStoryInteractionToInbox';
import {
    buildStoryMetadataItems,
    getStoryOverlayText,
    shouldShowSharedStoryCredit,
} from '../utils/storyViewerMeta';
import {
    getGlobalVideoMutedNative,
    setGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';
import { getFollowedUsers, getPostById, getState, getFollowState, getAccountTypeForHandle, toggleLike, reclipPost, fetchComments } from '../api/posts';
import { getAvatarForHandle } from '../api/users';
import { followOrRequest } from '../utils/followOrRequest';
import { hasPendingFollowRequest } from '../api/privacy';
import { getCollectionsForPost } from '../api/collections';
import type { Post, Story, StoryGroup } from '../types';
import Avatar from '../components/Avatar';
import ImageFullscreenModal from '../components/ImageFullscreenModal.native';
import PostCommentsSheet from '../components/PostCommentsSheet';
import FeedShareModal from '../components/FeedShareModal';
import SavePostModal from '../components/SavePostModal.native';
import { postHasVideoMedia } from '../utils/postMedia';
import { setScenesLaunchPayload } from '../utils/scenesLaunchNative';
import { collectFeedImageUrls } from '../utils/feedImageFullscreen';
import { isTextOnlyPost } from '../utils/effectiveTextPostStyleNative';
import { ox } from '../constants/nativeOpticalScale';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 15000; // 15 seconds
const STORY_SAFE_ZONE_TOP = 18;
const STORY_SAFE_ZONE_BOTTOM = 82;
/** Clean fade-out for MP4 close — no half-slide that looks like a stuck nudge. */
const STORY_DISMISS_MS = 280;
const STORY_DISMISS_EASE = Easing.out(Easing.cubic);

export default function StoriesScreen({ route, navigation }: any) {
    const {
        openUserHandle,
        openStoryId,
        fromStories24Rail,
        railHandles: railHandlesParam,
        previewThumb: routePreviewThumb,
        previewVideoUrl: routePreviewVideoUrl,
        skipStories24RailReturn,
        forceRefreshAt,
    } = route.params || {};
    const railHandles = Array.isArray(railHandlesParam) ? railHandlesParam : [];
    const railHandlesKey = railHandles.join('|');
    const shouldReturnToStories24Rail = skipStories24RailReturn !== true;
    const normalizedOpenUserHandle = React.useMemo(() => {
        if (!openUserHandle || typeof openUserHandle !== 'string') return '';
        try {
            return decodeURIComponent(openUserHandle);
        } catch {
            return openUserHandle;
        }
    }, [openUserHandle]);
    const { user } = useAuth();
    const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
    const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [viewingStories, setViewingStories] = useState(false);
    const [stories24OpenFromFeedRail, setStories24OpenFromFeedRail] = useState(fromStories24Rail === true);
    const [stories24HoldMinReady, setStories24HoldMinReady] = useState(false);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showInlineReplyComposer, setShowInlineReplyComposer] = useState(false);
    const [optimisticPollVote, setOptimisticPollVote] = useState<
        'option1' | 'option2' | 'option3' | null
    >(null);
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [showStoryShareModal, setShowStoryShareModal] = useState(false);
    const [showInsightsSheet, setShowInsightsSheet] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [insightsAvatarMap, setInsightsAvatarMap] = useState<Record<string, string | undefined>>({});
    const [isHoldingToPause, setIsHoldingToPause] = useState(false);
    const [originalPost, setOriginalPost] = useState<Post | null>(null);
    const [sharedPostFetchFailed, setSharedPostFetchFailed] = useState(false);
    const [showStoryProfileCard, setShowStoryProfileCard] = useState(false);
    const [isFollowingStoryUser, setIsFollowingStoryUser] = useState(false);
    const [storyFollowRequested, setStoryFollowRequested] = useState(false);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [showSharedPostModal, setShowSharedPostModal] = useState(false);
    /** Tear down story ExoPlayer before Scenes mounts the same URL (avoids lagged audio). */
    const [suspendStoryMedia, setSuspendStoryMedia] = useState(false);
    const [imageFullscreenPost, setImageFullscreenPost] = useState<Post | null>(null);
    const [fullscreenCommentsPost, setFullscreenCommentsPost] = useState<Post | null>(null);
    const [fullscreenSharePost, setFullscreenSharePost] = useState<Post | null>(null);
    const [fullscreenSavePost, setFullscreenSavePost] = useState<Post | null>(null);
    const [fullscreenPostSaved, setFullscreenPostSaved] = useState(false);
    const [deliveryFx, setDeliveryFx] = useState<StoryDeliveryFxState | null>(null);
    const [localReactionByStoryId, setLocalReactionByStoryId] = useState<Record<string, string>>({});
    const avatarRef = useRef<View>(null);
    const lastLikeTapAtRef = useRef(0);
    const lastMuteToggleAtRef = useRef(0);
    const openedFullPostRef = useRef(false);
    const fullscreenHoldRef = useRef<Post | null>(null);
    const deliveryFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deliveryFxFlyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showInlineReplyComposerRef = useRef(false);
    const isSendingReplyRef = useRef(false);
    const pausedRef = useRef(false);
    const dismissingRef = useRef(false);
    const dismissProgress = useSharedValue(0);
    const screenHSv = useSharedValue(Dimensions.get('window').height);

    const dismissShellStyle = useAnimatedStyle(() => {
        const p = dismissProgress.value;
        return {
            flex: 1,
            opacity: interpolate(p, [0, 1], [1, 0]),
        };
    });
    const dismissBackdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(dismissProgress.value, [0, 1], [1, 0]),
    }));
    const progressRef = useRef(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const currentStoryIndexRef = useRef(0);
    const currentGroupIndexRef = useRef(0);
    const storyGroupsRef = useRef(storyGroups);
    currentStoryIndexRef.current = currentStoryIndex;
    currentGroupIndexRef.current = currentGroupIndex;
    storyGroupsRef.current = storyGroups;
    const formatRelativeTime = (timestamp?: number) => {
        if (!timestamp || Number.isNaN(timestamp)) return 'just now';
        const diffMs = Date.now() - timestamp;
        const diffMin = Math.max(1, Math.floor(diffMs / 60000));
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        return `${diffDay}d ago`;
    };

    useEffect(() => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory) return;

        const handles = new Set<string>();
        (currentStory.viewerHandles || []).forEach((h) => {
            if (h) handles.add(h);
        });
        (currentStory.replies || []).forEach((r) => {
            if (r?.userHandle) handles.add(r.userHandle);
        });

        if (handles.size === 0) return;
        const updates: Record<string, string | undefined> = {};
        handles.forEach((handle) => {
            updates[handle] = getAvatarForHandle(handle);
        });
        setInsightsAvatarMap((prev) => ({ ...prev, ...updates }));
    }, [storyGroups, currentGroupIndex, currentStoryIndex]);

    useEffect(() => {
        let mounted = true;
        void getGlobalVideoMutedNative().then((muted) => {
            if (mounted) setIsMuted(muted);
        });
        return subscribeGlobalVideoMuted((muted) => setIsMuted(muted));
    }, []);

    const currentGroup = storyGroups[currentGroupIndex];
    const currentStory = currentGroup?.stories[currentStoryIndex];
    const isViewingOwnStory = Boolean(
        user?.id &&
            currentStory &&
            currentGroup &&
            (currentStory.userId === user.id || currentGroup.userHandle === user.handle),
    );

    useEffect(() => {
        if (!viewingStories || !currentStory?.sharedFromPost || !user?.id) {
            setOriginalPost(null);
            setSharedPostFetchFailed(false);
            return;
        }
        setSharedPostFetchFailed(false);
        let cancelled = false;
        const timeoutId = setTimeout(() => {
            if (!cancelled) {
                setOriginalPost(null);
                setSharedPostFetchFailed(true);
            }
        }, 8000);
        void getPostById(currentStory.sharedFromPost, user.id)
            .then((post) => {
                if (cancelled) return;
                clearTimeout(timeoutId);
                if (post) setOriginalPost(post);
                else {
                    setOriginalPost(null);
                    setSharedPostFetchFailed(true);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    clearTimeout(timeoutId);
                    setOriginalPost(null);
                    setSharedPostFetchFailed(true);
                }
            });
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [viewingStories, currentStory?.sharedFromPost, currentStory?.id, user?.id]);

    useEffect(() => {
        if (!viewingStories || !currentGroup?.userHandle || !user?.id) {
            setIsFollowingStoryUser(false);
            setStoryFollowRequested(false);
            return;
        }
        if (currentGroup.userHandle === user.handle) {
            setIsFollowingStoryUser(false);
            setStoryFollowRequested(false);
            return;
        }
        if (user?.id) {
            const cached = getFollowState(getState(user.id).follows || {}, currentGroup.userHandle);
            setIsFollowingStoryUser(cached);
            setStoryFollowRequested(
                Boolean(
                    user.handle &&
                        !cached &&
                        hasPendingFollowRequest(user.handle, currentGroup.userHandle),
                ),
            );
        }
    }, [viewingStories, currentGroup?.userHandle, user?.id, user?.handle]);

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    const storyPauseLocked = Boolean(
        showInsightsSheet ||
            showStoryShareModal ||
            showSharedPostModal ||
            imageFullscreenPost ||
            fullscreenCommentsPost ||
            fullscreenSharePost ||
            fullscreenSavePost ||
            showStoryProfileCard ||
            deliveryFx ||
            showInlineReplyComposer ||
            isSendingReply ||
            isHoldingToPause,
    );

    useEffect(() => {
        if (!viewingStories) return;
        setPaused(storyPauseLocked);
    }, [viewingStories, storyPauseLocked]);

    useEffect(() => {
        showInlineReplyComposerRef.current = showInlineReplyComposer;
    }, [showInlineReplyComposer]);

    useEffect(() => {
        isSendingReplyRef.current = isSendingReply;
    }, [isSendingReply]);

    const clearDeliveryFx = useCallback(() => {
        if (deliveryFxTimerRef.current) {
            clearTimeout(deliveryFxTimerRef.current);
            deliveryFxTimerRef.current = null;
        }
        if (deliveryFxFlyTimerRef.current) {
            clearTimeout(deliveryFxFlyTimerRef.current);
            deliveryFxFlyTimerRef.current = null;
        }
        setDeliveryFx(null);
    }, []);

    const handleDeliveryFxComplete = useCallback(() => {
        clearDeliveryFx();
    }, [clearDeliveryFx]);

    useEffect(() => {
        return () => {
            if (deliveryFxTimerRef.current) clearTimeout(deliveryFxTimerRef.current);
            if (deliveryFxFlyTimerRef.current) clearTimeout(deliveryFxFlyTimerRef.current);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        if (fromStories24Rail === true) {
            setStories24OpenFromFeedRail(true);
            return;
        }
        if (!normalizedOpenUserHandle) {
            setStories24OpenFromFeedRail(false);
            return;
        }
        void readStories24RailOpenHandle().then((stored) => {
            if (cancelled) return;
            const match =
                !!stored &&
                stored.trim().toLowerCase() === normalizedOpenUserHandle.trim().toLowerCase();
            setStories24OpenFromFeedRail(match);
        });
        return () => {
            cancelled = true;
        };
    }, [forceRefreshAt, fromStories24Rail, normalizedOpenUserHandle]);

    useEffect(() => {
        if (!stories24OpenFromFeedRail || !normalizedOpenUserHandle) {
            setStories24HoldMinReady(false);
            return;
        }
        setStories24HoldMinReady(false);
        const t = setTimeout(() => setStories24HoldMinReady(true), STORIES24_LOADING_HOLD_MS);
        return () => clearTimeout(t);
    }, [forceRefreshAt, stories24OpenFromFeedRail, normalizedOpenUserHandle]);

    const stories24ContentReady = !loading && viewingStories;
    const showStories24HoldScreen =
        stories24OpenFromFeedRail &&
        !!normalizedOpenUserHandle &&
        (!stories24ContentReady || !stories24HoldMinReady);

    useEffect(() => {
        loadStories();
    }, [user?.id, normalizedOpenUserHandle, railHandlesKey]);

    useEffect(() => {
        if (normalizedOpenUserHandle && storyGroups.length > 0) {
            const targetGroup = storyGroups.find(g => g.userHandle === normalizedOpenUserHandle);
            if (targetGroup) {
                startViewingStories(targetGroup, openStoryId);
            }
        }
    }, [normalizedOpenUserHandle, openStoryId, storyGroups.length]);

    const loadStories = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const requestedHandles = Array.from(
                new Set(
                    [...railHandles, ...(normalizedOpenUserHandle ? [normalizedOpenUserHandle] : [])]
                        .map((h) => (h || '').trim())
                        .filter(Boolean),
                ),
            );

            const followedUserHandles = await getFollowedUsers(user.id);

            const [mainGroups, requestedGroupsResults] = await Promise.all([
                fetchFollowedUsersStoryGroups(user.id, followedUserHandles),
                requestedHandles.length > 0
                    ? Promise.all(requestedHandles.map((handle) => fetchStoryGroupByHandle(handle)))
                    : Promise.resolve([] as (StoryGroup | null)[]),
            ]);

            let groups = mainGroups;
            for (const storyGroup of requestedGroupsResults) {
                if (!storyGroup) continue;
                const existingGroupIndex = groups.findIndex((g) => g.userHandle === storyGroup.userHandle);
                if (existingGroupIndex === -1) {
                    groups.push(storyGroup);
                } else {
                    groups[existingGroupIndex] = storyGroup;
                }
            }

            if (requestedHandles.length > 0) {
                const orderMap = new Map<string, number>(
                    requestedHandles.map((h, idx) => [h.toLowerCase(), idx]),
                );
                groups = [...groups].sort((a, b) => {
                    const aRank = orderMap.get((a.userHandle || '').toLowerCase());
                    const bRank = orderMap.get((b.userHandle || '').toLowerCase());
                    if (aRank === undefined && bRank === undefined) return 0;
                    if (aRank === undefined) return 1;
                    if (bRank === undefined) return -1;
                    return aRank - bRank;
                });
            }

            // Match web StoriesPage: mock handles (e.g. Ava@galway) resolve via getAvatarForHandle
            const groupsWithAvatars = await Promise.all(
                groups.map(async (group) => {
                    if (group.userId === user.id && user.avatarUrl) {
                        return { ...group, avatarUrl: user.avatarUrl };
                    }
                    let avatarUrl = group.avatarUrl || getAvatarForHandle(group.userHandle);
                    if (!avatarUrl) {
                        try {
                            const { fetchUserProfile } = await import('../api/client');
                            const profile = await fetchUserProfile(group.userHandle, user.id);
                            if (profile && (profile.avatar_url || profile.avatarUrl)) {
                                avatarUrl = profile.avatar_url || profile.avatarUrl;
                            }
                        } catch {
                            /* keep undefined — Avatar shows initials */
                        }
                    }
                    return { ...group, avatarUrl };
                }),
            );

            setStoryGroups(withGazetteerWorldGroup(groupsWithAvatars));
        } catch (error) {
            console.error('Error loading stories:', error);
        } finally {
            setLoading(false);
        }
    };

    const startViewingStories = async (group: StoryGroup, preferredStoryId?: string) => {
        if (!group || !user?.id || !group.stories || group.stories.length === 0) return;

        if (isGazetteerWorldGroup(group)) {
            const groupIndex = storyGroups.findIndex((g) => isGazetteerWorldGroup(g));
            if (groupIndex === -1) return;
            const initialStoryIndex = preferredStoryId
                ? Math.max(0, (group.stories || []).findIndex((s) => s.id === preferredStoryId))
                : 0;
            setCurrentGroupIndex(groupIndex);
            setCurrentStoryIndex(initialStoryIndex);
            setViewingStories(true);
            setProgress(0);
            setPaused(false);
            progressRef.current = 0;
            startProgress();
            return;
        }

        const followedUserHandles = await getFollowedUsers(user.id);
        const stories = await fetchUserStories(user.id, group.userId, followedUserHandles || []);
        if (!stories || stories.length === 0) return;

        const groupIndex = storyGroups.findIndex(g => g.userId === group.userId);
        if (groupIndex === -1) return;

        setStoryGroups(prev => {
            const updated = [...prev];
            updated[groupIndex] = { ...group, stories, avatarUrl: group.avatarUrl };
            return updated;
        });

        const initialStoryIndex = preferredStoryId
            ? Math.max(0, stories.findIndex((s) => s.id === preferredStoryId))
            : 0;
        setCurrentGroupIndex(groupIndex);
        setCurrentStoryIndex(initialStoryIndex);
        setViewingStories(true);
        setProgress(0);
        setPaused(false);
        progressRef.current = 0;
        startProgress();
    };

    const startProgress = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        timerRef.current = setInterval(() => {
            if (pausedRef.current) return;

            progressRef.current += 50;
            const newProgress = Math.min((progressRef.current / STORY_DURATION) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                nextStory();
            }
        }, 50);
    };

    const nextStory = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        const groups = storyGroupsRef.current;
        const groupIndex = currentGroupIndexRef.current;
        const storyIndex = currentStoryIndexRef.current;
        const currentGroup = groups[groupIndex];
        if (!currentGroup) return;

        if (storyIndex < currentGroup.stories.length - 1) {
            const nextIndex = storyIndex + 1;
            currentStoryIndexRef.current = nextIndex;
            setCurrentStoryIndex(nextIndex);
            setProgress(0);
            progressRef.current = 0;
            startProgress();
        } else if (groupIndex < groups.length - 1) {
            const nextGroup = groupIndex + 1;
            currentGroupIndexRef.current = nextGroup;
            currentStoryIndexRef.current = 0;
            setCurrentGroupIndex(nextGroup);
            setCurrentStoryIndex(0);
            setProgress(0);
            progressRef.current = 0;
            startProgress();
        } else {
            closeStories();
        }
    };

    const previousStory = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        const groups = storyGroupsRef.current;
        const groupIndex = currentGroupIndexRef.current;
        const storyIndex = currentStoryIndexRef.current;

        if (storyIndex > 0) {
            const prevIndex = storyIndex - 1;
            currentStoryIndexRef.current = prevIndex;
            setCurrentStoryIndex(prevIndex);
            setProgress(0);
            progressRef.current = 0;
            startProgress();
        } else if (groupIndex > 0) {
            const prevGroupIndex = groupIndex - 1;
            const prevGroup = groups[prevGroupIndex];
            const prevIndex = prevGroup?.stories.length - 1 || 0;
            currentGroupIndexRef.current = prevGroupIndex;
            currentStoryIndexRef.current = prevIndex;
            setCurrentGroupIndex(prevGroupIndex);
            setCurrentStoryIndex(prevIndex);
            setProgress(0);
            progressRef.current = 0;
            startProgress();
        }
    };

    const finalizeCloseNavigation = useCallback(() => {
        setViewingStories(false);
        setProgress(0);
        setPaused(false);
        progressRef.current = 0;
        dismissingRef.current = false;
        dismissProgress.value = 0;
        navigation.goBack();
    }, [dismissProgress, navigation]);

    const closeStories = () => {
        if (dismissingRef.current) return;
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        const currentStory = storyGroups[currentGroupIndex]?.stories?.[currentStoryIndex];
        const mediaUrl = currentStory?.mediaUrl;
        const isVideo =
            currentStory?.mediaType === 'video' ||
            (!!mediaUrl && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl));

        // MP4 from Stories 24 rail: cut straight back to feed (no fade-to-black gap).
        if (stories24OpenFromFeedRail && isVideo && viewingStories) {
            navigation.setOptions({ animation: 'none' });
            void clearStories24RailOpenHandle();
            finalizeCloseNavigation();
            return;
        }

        if (stories24OpenFromFeedRail && normalizedOpenUserHandle) {
            const avatarUrl = getAvatarForHandle(normalizedOpenUserHandle);
            const rawThumb =
                routePreviewThumb ||
                (!isVideo && mediaUrl ? mediaUrl : undefined) ||
                undefined;
            // Don't shrink back onto a profile pic for shared/video stories.
            const previewThumb =
                rawThumb && avatarUrl && rawThumb === avatarUrl ? undefined : rawThumb;
            const previewVideoUrl =
                routePreviewVideoUrl ||
                (isVideo ? resolveStoryVideoPlaybackUrl(mediaUrl) : undefined);

            // Disable native modal dismiss — custom Apple-TV shrink runs on the feed rail.
            navigation.setOptions({ animation: 'none' });
            if (shouldReturnToStories24Rail) {
                void persistStories24RailReturn({
                    handle: normalizedOpenUserHandle,
                    previewThumb,
                    previewVideoUrl,
                });
            }
            void clearStories24RailOpenHandle();
        }

        finalizeCloseNavigation();
    };

    const openStoryLink = async (rawUrl?: string) => {
        if (!rawUrl) return;
        const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        Alert.alert(
            'Visit link?',
            'You are about to open this link in your browser.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Visit link',
                    onPress: async () => {
                        try {
                            await Linking.openURL(withProtocol);
                        } catch (error) {
                            console.error('Failed to open story link:', error);
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    };

    const pauseForHold = () => {
        setIsHoldingToPause(true);
    };

    const releaseHold = () => {
        setIsHoldingToPause(false);
    };

    const toggleGlobalMute = useCallback(() => {
        const now = Date.now();
        if (now - lastLikeTapAtRef.current < 420) return;
        if (now - lastMuteToggleAtRef.current < 260) return;
        lastMuteToggleAtRef.current = now;
        setIsMuted((prev) => {
            const next = !prev;
            void setGlobalVideoMutedNative(next);
            return next;
        });
    }, []);

    const handleStoryFollowQuickToggle = async () => {
        if (!currentGroup?.userHandle || !user?.id || !user?.handle || isFollowLoading) return;
        const handle = currentGroup.userHandle;
        const wasRequested = storyFollowRequested;
        const nextFollowing = isFollowingStoryUser ? false : wasRequested ? false : true;
        setIsFollowLoading(true);
        setShowStoryProfileCard(false);
        try {
            const result = await followOrRequest({
                userId: String(user.id),
                targetHandle: handle,
                viewerHandle: user.handle,
                nextFollowing,
            });
            setIsFollowingStoryUser(result.following);
            setStoryFollowRequested(result.requested);
            if (result.requested && !wasRequested) {
                Alert.alert(
                    'Follow Request Sent',
                    `Your follow request was sent to ${handle}. You'll be notified when they respond.`,
                );
            }
        } catch {
            // Keep prior local follow on hard failure
            setIsFollowingStoryUser(isFollowingStoryUser);
            setStoryFollowRequested(storyFollowRequested);
        } finally {
            setIsFollowLoading(false);
        }
    };

    const closeSharedPostModal = () => {
        setShowSharedPostModal(false);
        if (!showInlineReplyComposer) setPaused(false);
    };

    const openFullPostFromStory = () => {
        if (!originalPost) return;
        setShowSharedPostModal(false);
        setPaused(true);
        setIsMuted(true);

        // Scenes is video-only — still images + text use the fullscreen overlay (wired actions).
        if (postHasVideoMedia(originalPost)) {
            openedFullPostRef.current = true;
            // Unmount story TextureView first so Scenes doesn't fight the same audio session.
            setSuspendStoryMedia(true);
            const post = originalPost;
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            setScenesLaunchPayload({
                                initialPostId: post.id,
                                posts: [post],
                                feedLabel: 'Stories',
                                initialMuted: true,
                            });
                            navigation.navigate('Scenes', {
                                initialPostId: post.id,
                                feedLabel: 'Stories',
                                initialMuted: true,
                            });
                        }, 40);
                    });
            return;
        }

        if (
            collectFeedImageUrls(originalPost).length > 0 ||
            isTextOnlyPost(originalPost) ||
            Boolean((originalPost.text || originalPost.caption || '').trim())
        ) {
            setImageFullscreenPost(originalPost);
            return;
        }

        openedFullPostRef.current = true;
        navigation.navigate('PostDetail', { postId: originalPost.id });
    };

    const syncFullscreenPost = useCallback((updated: Post) => {
        setImageFullscreenPost((prev) => (prev?.id === updated.id ? updated : prev));
        setOriginalPost((prev) => (prev?.id === updated.id ? updated : prev));
        setFullscreenCommentsPost((prev) => (prev?.id === updated.id ? updated : prev));
        if (fullscreenHoldRef.current?.id === updated.id) {
            fullscreenHoldRef.current = updated;
        }
    }, []);

    /** RN Modal cannot host another Modal/BottomSheet — park fullscreen first. */
    const dismissFullscreenForOverlay = useCallback(() => {
        setImageFullscreenPost((prev) => {
            if (prev) fullscreenHoldRef.current = prev;
            return null;
        });
    }, []);

    const restoreFullscreenFromHold = useCallback(() => {
        const held = fullscreenHoldRef.current;
        fullscreenHoldRef.current = null;
        if (held) setImageFullscreenPost(held);
    }, []);

    const handleFullscreenLike = async () => {
        if (!imageFullscreenPost || !user?.id) return;
        try {
            const updated = await toggleLike(user.id, imageFullscreenPost.id, imageFullscreenPost);
            syncFullscreenPost(updated);
        } catch (error) {
            console.error('Fullscreen like failed:', error);
            Alert.alert('Could not like', 'Please try again.');
        }
    };

    const handleFullscreenComment = () => {
        if (!imageFullscreenPost) return;
        const post = imageFullscreenPost;
        dismissFullscreenForOverlay();
        // Let the fullscreen Modal unmount before presenting the sheet.
        setTimeout(() => setFullscreenCommentsPost(post), 40);
    };

    const handleFullscreenReclip = async () => {
        if (!imageFullscreenPost || !user?.id || !user?.handle) return;
        const norm = (h?: string) => String(h || '').trim().toLowerCase();
        if (norm(imageFullscreenPost.userHandle) === norm(user.handle)) {
            Alert.alert('Cannot reclip', 'You can’t reclip your own post.');
            return;
        }
        try {
            const result = await reclipPost(user.id, imageFullscreenPost.id, user.handle);
            if (result?.originalPost) syncFullscreenPost(result.originalPost);
            else {
                syncFullscreenPost({
                    ...imageFullscreenPost,
                    userReclipped: true,
                    stats: {
                        ...imageFullscreenPost.stats,
                        reclips: (imageFullscreenPost.stats?.reclips ?? 0) + 1,
                    },
                });
            }
            Alert.alert('Reposted', 'Post added to your Following feed and profile.');
        } catch (error) {
            console.error('Fullscreen reclip failed:', error);
            Alert.alert('Could not repost', 'Please try again.');
        }
    };

    const handleFullscreenShare = () => {
        if (!imageFullscreenPost) return;
        const post = imageFullscreenPost;
        dismissFullscreenForOverlay();
        setTimeout(() => setFullscreenSharePost(post), 40);
    };

    const handleFullscreenSave = () => {
        if (!imageFullscreenPost) return;
        const post = imageFullscreenPost;
        dismissFullscreenForOverlay();
        setTimeout(() => setFullscreenSavePost(post), 40);
    };

    useEffect(() => {
        if (!imageFullscreenPost?.id || !user?.id) {
            setFullscreenPostSaved(false);
            return;
        }
        let cancelled = false;
        void getCollectionsForPost(user.id, imageFullscreenPost.id)
            .then((cols) => {
                if (!cancelled) setFullscreenPostSaved(cols.length > 0);
            })
            .catch(() => {
                if (!cancelled) setFullscreenPostSaved(false);
            });
        return () => {
            cancelled = true;
        };
    }, [imageFullscreenPost?.id, user?.id]);

    useFocusEffect(
        useCallback(() => {
            if (!openedFullPostRef.current) return;
            openedFullPostRef.current = false;
            setSuspendStoryMedia(false);
            if (!showInlineReplyComposerRef.current) setPaused(false);
        }, []),
    );

    const startDeliveryFx = useCallback((
        kind: 'message' | 'like' | 'react',
        toHandle: string,
        emoji?: string,
    ) => {
        if (deliveryFxTimerRef.current) clearTimeout(deliveryFxTimerRef.current);
        if (deliveryFxFlyTimerRef.current) clearTimeout(deliveryFxFlyTimerRef.current);

        const startX = width / 2;
        const startY = height - 112;
        let targetX = 40;
        let targetY = 42;

        const beginFx = () => {
            setDeliveryFx({
                kind,
                toHandle,
                startX,
                startY,
                targetX,
                targetY,
                phase: 'start',
                emoji,
            });
            deliveryFxFlyTimerRef.current = setTimeout(() => {
                setDeliveryFx((prev) => (prev ? { ...prev, phase: 'fly' } : null));
            }, 14);
            deliveryFxTimerRef.current = setTimeout(() => {
                clearDeliveryFx();
            }, 4300);
        };

        // Always start FX + resume timer immediately (measureInWindow can hang on Android).
        beginFx();

        const node = avatarRef.current;
        if (node && typeof node.measureInWindow === 'function') {
            node.measureInWindow((x, y, w, h) => {
                if (w <= 0 || h <= 0) return;
                const measuredX = x + w / 2;
                const measuredY = y + h / 2;
                setDeliveryFx((prev) =>
                    prev ? { ...prev, targetX: measuredX, targetY: measuredY } : null,
                );
            });
        }
    }, [clearDeliveryFx]);

    const handleReaction = async (emoji: string) => {
        if (!currentStory || !user?.id || !user?.handle) return;
        const toHandle = currentGroup?.userHandle;
        // Optimistic UI — mock store may miss API-loaded stories; still show selection.
        setLocalReactionByStoryId((prev) => ({ ...prev, [currentStory.id]: emoji }));
        try {
            await addStoryReaction(currentStory.id, user.id, user.handle, emoji);
            if (
                toHandle &&
                toHandle.trim().toLowerCase() !== user.handle.trim().toLowerCase()
            ) {
                try {
                    await deliverStoryReactionToInbox({
                        fromHandle: user.handle,
                        toHandle,
                        story: currentStory,
                        originalPost,
                        emoji,
                    });
                } catch (inboxError) {
                    console.warn('Story reaction inbox delivery failed:', inboxError);
                }
            }
        } catch (error) {
            console.error('Error adding reaction:', error);
            setLocalReactionByStoryId((prev) => {
                const next = { ...prev };
                delete next[currentStory.id];
                return next;
            });
        }
    };

    const triggerLikeAction = () => {
        const now = Date.now();
        if (now - lastLikeTapAtRef.current < 260) return;
        lastLikeTapAtRef.current = now;
        if (currentGroup?.userHandle) {
            startDeliveryFx('like', currentGroup.userHandle);
        }
        void handleReaction('❤️');
    };

    const triggerQuickReact = (emoji: string) => {
        const now = Date.now();
        if (now - lastLikeTapAtRef.current < 260) return;
        lastLikeTapAtRef.current = now;
        if (currentGroup?.userHandle) {
            startDeliveryFx('react', currentGroup.userHandle, emoji);
        }
        void handleReaction(emoji);
    };

    const handleReply = async () => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory || !user?.id || !user?.handle || !replyText.trim() || isSendingReply) return;

        const toHandle = currentGroup?.userHandle;
        const normalizedReply = replyText.trim();
        const isSelfStory =
            !!toHandle &&
            !!user.handle &&
            toHandle.trim().toLowerCase() === user.handle.trim().toLowerCase();

        try {
            setIsSendingReply(true);
            await addStoryReply(currentStory.id, user.id, user.handle, normalizedReply);

            if (toHandle && !isSelfStory) {
                try {
                    await deliverStoryReplyToInbox({
                        fromHandle: user.handle,
                        toHandle,
                        story: currentStory,
                        originalPost,
                        replyText: normalizedReply,
                    });
                } catch (inboxError) {
                    console.warn('Story reply inbox delivery failed:', inboxError);
                    Alert.alert(
                        'Reply saved',
                        'Your reply was sent, but it may not show in Messages yet.',
                    );
                }
                startDeliveryFx('message', toHandle);
            } else if (isSelfStory) {
                Alert.alert(
                    'Your story',
                    'That reply stays on your story insights. Messages in Inbox are for when other people reply or react to your story.',
                );
            } else if (toHandle) {
                startDeliveryFx('message', toHandle);
            }

            setStoryGroups((prev) =>
                prev.map((group, groupIdx) => {
                    if (groupIdx !== currentGroupIndex) return group;
                    return {
                        ...group,
                        stories: group.stories.map((story, storyIdx) => {
                            if (storyIdx !== currentStoryIndex) return story;
                            return {
                                ...story,
                                replies: [
                                    ...(story.replies || []),
                                    {
                                        id: `reply-${Date.now()}`,
                                        userId: user.id,
                                        userHandle: user.handle,
                                        text: normalizedReply,
                                        createdAt: Date.now(),
                                    },
                                ],
                            };
                        }),
                    };
                }),
            );
            setReplyText('');
            setShowInlineReplyComposer(false);
        } catch (error) {
            console.error('Error adding reply:', error);
            Alert.alert('Could not send reply', 'Please try again in a moment.');
        } finally {
            setIsSendingReply(false);
        }
    };

    useEffect(() => {
        setOptimisticPollVote(null);
    }, [currentGroupIndex, currentStoryIndex]);

    useEffect(() => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory || !user?.id || !viewingStories) return;

        markStoryViewed(currentStory.id, user.id, user.handle).catch(console.error);
        incrementStoryViews(currentStory.id).catch(console.error);
    }, [currentGroupIndex, currentStoryIndex, viewingStories]);

    const handlePollVote = useCallback(
        async (option: 'option1' | 'option2' | 'option3') => {
            const story = storyGroups[currentGroupIndex]?.stories[currentStoryIndex];
            if (!story?.poll || !user?.id || story.poll.userVote) return;
            setOptimisticPollVote(option);
            setPaused(true);
            try {
                await voteOnPoll(story.id, user.id, option);
                setStoryGroups((groups) =>
                    groups.map((group, gi) => {
                        if (gi !== currentGroupIndex) return group;
                        return {
                            ...group,
                            stories: group.stories.map((s, si) => {
                                if (si !== currentStoryIndex || !s.poll) return s;
                                const prev = s.poll.userVote;
                                let votes1 = s.poll.votes1 ?? 0;
                                let votes2 = s.poll.votes2 ?? 0;
                                let votes3 = s.poll.votes3 ?? 0;
                                if (prev === 'option1') votes1 -= 1;
                                if (prev === 'option2') votes2 -= 1;
                                if (prev === 'option3') votes3 -= 1;
                                if (option === 'option1') votes1 += 1;
                                if (option === 'option2') votes2 += 1;
                                if (option === 'option3') votes3 += 1;
                                return {
                                    ...s,
                                    poll: {
                                        ...s.poll,
                                        votes1,
                                        votes2,
                                        votes3,
                                        userVote: option,
                                    },
                                };
                            }),
                        };
                    }),
                );
            } catch (error) {
                console.error('Poll vote failed:', error);
                setOptimisticPollVote(null);
            }
        },
        [currentGroupIndex, currentStoryIndex, storyGroups, user?.id],
    );

    useEffect(() => {
        if (viewingStories && !paused) {
            startProgress();
        } else if (paused && timerRef.current) {
            clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [viewingStories, paused, currentGroupIndex, currentStoryIndex]);

    if (showStories24HoldScreen) {
        return (
            <GazetteerScreenShell contentStyle={styles.loadingShell} ambientVariant="passport">
                <StoriesPopIcon size={ox(80)} />
                <Text style={styles.storiesOpeningText}>Opening stories…</Text>
                <Text style={styles.stories24HoldSubtext}>Stories 24</Text>
            </GazetteerScreenShell>
        );
    }

    if (loading) {
        const fromProfile =
            Boolean(normalizedOpenUserHandle) && !stories24OpenFromFeedRail;
        return (
            <GazetteerScreenShell
                contentStyle={styles.loadingShell}
                ambientVariant="passport"
            >
                {fromProfile ? (
                    <>
                        <ActivityIndicator size="large" color={PASSPORT_PALETTE.wavePrimary} />
                        <Text style={styles.storiesOpeningText}>Opening story...</Text>
                    </>
                ) : (
                    <ActivityIndicator size="large" color={PASSPORT_PALETTE.wavePrimary} />
                )}
            </GazetteerScreenShell>
        );
    }

    const isCurrentStoryVideo = isStoryVideo(currentStory, originalPost);
    const currentStoryText = getStoryOverlayText(currentStory);
    const storyMetadataItems = buildStoryMetadataItems(currentStory, originalPost);
    const sharedCredit = shouldShowSharedStoryCredit(
        currentStory,
        originalPost,
        currentGroup?.userHandle,
    );
    // Captions on media stories only — text-only body is rendered by StoryViewerMedia /
    // StorySharedPostViewer (a second overlay was duplicating shared feed statements).
    const showMediaTextOverlay =
        !!currentStoryText &&
        !currentStory?.sharedFromPost &&
        !!currentStory?.mediaUrl &&
        !currentStory.mediaUrl.startsWith('data:image');
    const heartReaction =
        (currentStory && localReactionByStoryId[currentStory.id]) || currentStory?.userReaction;
    const hasHeartReaction = heartReaction === '❤️' || heartReaction === '♥️' || heartReaction === '❤';

    if (!viewingStories) {
        // Story list view
        return (
            <GazetteerScreenShell>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Icon name="arrow-back" size={ox(24)} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Clips 24</Text>
                    <View style={{ width: ox(24) }} />
                </View>

                <View style={styles.storyList}>
                    {storyGroups.map((group, index) => (
                        <TouchableOpacity
                            key={group.userId}
                            onPress={() => startViewingStories(group)}
                            style={styles.storyItem}
                        >
                            <Avatar
                                src={group.avatarUrl}
                                name={group.userHandle.split('@')[0]}
                                size="xl"
                                hasStory={true}
                            />
                            <Text style={styles.storyUserName}>{group.userHandle}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </GazetteerScreenShell>
        );
    }

    // Story viewer
    return (
        <View style={styles.storyViewerRoot}>
            <Animated.View
                pointerEvents="none"
                style={[styles.storyDismissBackdrop, dismissBackdropStyle]}
            />
            <Animated.View style={[styles.storyViewer, dismissShellStyle]}>
            {/* Progress bars */}
            <View style={styles.progressContainer}>
                {currentGroup?.stories.map((_, index) => (
                    <View key={index} style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${index < currentStoryIndex ? 100 : index === currentStoryIndex ? progress : 0}%` }]} />
                    </View>
                ))}
            </View>

            {/* Story content */}
            {currentStory && currentGroup && (
                <>
                    <StorySwipeLayer
                        enabled={!showInlineReplyComposer && !deliveryFx && !showStoryProfileCard}
                        style={styles.mediaLayer}
                        onSwipeLeft={nextStory}
                        onSwipeRight={previousStory}
                        onHoldStart={pauseForHold}
                        onHoldEnd={releaseHold}
                    >
                        {currentStory.sharedFromPost ? (
                            suspendStoryMedia ? (
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} />
                            ) : (
                            <StorySharedPostViewer
                                story={currentStory}
                                originalPost={originalPost}
                                sharedPostFetchFailed={sharedPostFetchFailed}
                                isMuted={isMuted}
                                paused={paused || !!deliveryFx}
                                onOpenModal={() => {
                                    setPaused(true);
                                    setShowSharedPostModal(true);
                                }}
                                onOpenProfile={(handle) => {
                                    closeStories();
                                    setTimeout(() => {
                                        navigation.navigate('ViewProfile', { handle });
                                    }, 100);
                                }}
                            />
                            )
                        ) : suspendStoryMedia ? (
                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} />
                        ) : (
                            <StoryViewerMedia
                                story={currentStory}
                                isMuted={isMuted}
                                paused={paused || !!deliveryFx}
                            />
                        )}
                    </StorySwipeLayer>

                    <StoryViewerHeader
                        avatarRef={avatarRef}
                        avatarUrl={currentGroup.avatarUrl}
                        userHandle={currentGroup.userHandle}
                        accountType={
                            user?.handle === currentGroup.userHandle
                                ? user?.accountType
                                : getAccountTypeForHandle(currentGroup.userHandle)
                        }
                        showFollowBadge={
                            !!currentGroup.userHandle &&
                            !!user?.handle &&
                            currentGroup.userHandle !== user.handle &&
                            !isFollowingStoryUser &&
                            !storyFollowRequested
                        }
                        followLoading={isFollowLoading}
                        metadataItems={storyMetadataItems}
                        showVideoMute={isCurrentStoryVideo}
                        isMuted={isMuted}
                        onAvatarPress={() => {
                            setShowStoryProfileCard((v) => !v);
                            setPaused(true);
                        }}
                        onFollowPress={() => void handleStoryFollowQuickToggle()}
                        onToggleMute={toggleGlobalMute}
                        onClose={closeStories}
                    />
                    {showStoryProfileCard && currentGroup.userHandle !== user?.handle ? (
                        <View style={styles.profileCardHost} pointerEvents="box-none">
                            <StoryProfileCard
                                isFollowing={isFollowingStoryUser}
                                isRequested={storyFollowRequested}
                                followLoading={isFollowLoading}
                                isOwnStory={false}
                                onViewProfile={() => {
                                    setShowStoryProfileCard(false);
                                    closeStories();
                                    setTimeout(() => {
                                        navigation.navigate('ViewProfile', {
                                            handle: currentGroup.userHandle,
                                        });
                                    }, 100);
                                }}
                                onToggleFollow={() => void handleStoryFollowQuickToggle()}
                                onClose={() => {
                                    setShowStoryProfileCard(false);
                                    if (!showInlineReplyComposer && !isSendingReply) setPaused(false);
                                }}
                            />
                        </View>
                    ) : null}

                    {isViewingOwnStory ? (
                        <TouchableOpacity
                            style={styles.ownerInsightsBar}
                            onPress={() => {
                                setShowInsightsSheet(true);
                                setPaused(true);
                            }}
                        >
                            <Text style={styles.ownerInsightsText}>
                                {(currentStory.views ?? 0)} views •{' '}
                                {(currentStory.reactions?.filter(
                                    (r) =>
                                        (r.userHandle || '').trim().toLowerCase() !==
                                        (user?.handle || '').trim().toLowerCase(),
                                ).length ?? 0)}{' '}
                                reactions • {(currentStory.replies?.length ?? 0)} replies
                            </Text>
                        </TouchableOpacity>
                    ) : null}

                    {currentStory.poll ? (
                        <StoryPollOverlay
                            story={currentStory}
                            optimisticVote={optimisticPollVote}
                            onVote={handlePollVote}
                            onInteractionStart={() => setPaused(true)}
                        />
                    ) : null}

                    {showMediaTextOverlay ? (
                        <View style={styles.mediaTextCard}>
                            <StoryTextOverlay
                                embedded
                                text={currentStoryText}
                                taggedUsers={currentStory.taggedUsers}
                                textColor={currentStory.textColor || '#fff'}
                                onMentionPress={(handle) => {
                                    closeStories();
                                    setTimeout(() => {
                                        navigation.navigate('ViewProfile', { handle });
                                    }, 100);
                                }}
                            />
                        </View>
                    ) : null}

                    {sharedCredit.show && currentStoryText ? (
                        <View style={styles.sharedCredit}>
                            <Avatar
                                src={getAvatarForHandle(currentStory.sharedFromUser || '')}
                                name={sharedCredit.authorDisplay}
                                size="sm"
                            />
                            <Text style={styles.sharedCreditText}>
                                Shared from{' '}
                                <Text style={styles.sharedCreditBold}>{sharedCredit.authorDisplay}</Text>
                            </Text>
                        </View>
                    ) : null}

                    {Array.isArray(currentStory.stickers) &&
                        currentStory.stickers
                            .filter((overlay) => !!overlay?.linkUrl)
                            .map((overlay) => {
                                const label = (overlay.linkName || overlay.textContent || 'Shop now').trim();
                                const iconColor = '#E11D48';
                                const labelColor = '#111111';
                                return (
                                    <TouchableOpacity
                                        key={overlay.id}
                                        activeOpacity={0.9}
                                        onPress={() => openStoryLink(overlay.linkUrl)}
                                        style={[
                                            styles.storyLinkSticker,
                                            {
                                                left: `${overlay.x}%`,
                                                top: `${overlay.y}%`,
                                                transform: [
                                                    { translateX: -91 },
                                                    { translateY: -17 },
                                                    { scale: overlay.scale || 1 },
                                                    { rotate: `${overlay.rotation || 0}deg` },
                                                ],
                                                opacity: overlay.opacity ?? 1,
                                            },
                                        ]}
                                    >
                                        <View style={styles.storyLinkIconTile}>
                                            <Icon name="link-outline" size={ox(15)} color={iconColor} />
                                        </View>
                                        <Text numberOfLines={1} style={[styles.storyLinkLabel, { color: labelColor }]}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}

                    <StoryBottomBar
                        hidden={isHoldingToPause}
                        ownerMode={isViewingOwnStory}
                        ownerSummary={`${currentStory.views ?? 0} views · tap for insights`}
                        onOpenInsights={() => {
                            setShowInsightsSheet(true);
                            setPaused(true);
                        }}
                        showReplyComposer={showInlineReplyComposer && !isViewingOwnStory}
                        replyText={replyText}
                        replyPlaceholder="Message..."
                        isSending={isSendingReply}
                        hasReaction={hasHeartReaction}
                        activeQuickEmoji={
                            heartReaction === '😍' || heartReaction === '😂' ? heartReaction : null
                        }
                        onReplyTextChange={setReplyText}
                        onOpenReply={() => {
                            if (isViewingOwnStory) return;
                            setShowInlineReplyComposer(true);
                            setPaused(true);
                        }}
                        onCancelReply={() => {
                            setShowInlineReplyComposer(false);
                            setReplyText('');
                            setPaused(false);
                        }}
                        onSendReply={() => void handleReply()}
                        onLike={triggerLikeAction}
                        onShare={() => setShowStoryShareModal(true)}
                        onQuickReact={triggerQuickReact}
                    />

                    {deliveryFx ? (
                        <StoryDeliveryFx fx={deliveryFx} onComplete={handleDeliveryFxComplete} />
                    ) : null}
                </>
            )}

            <Modal
                visible={showSharedPostModal}
                transparent
                animationType="fade"
                onRequestClose={closeSharedPostModal}
            >
                <View style={styles.sharedPostBackdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFillObject}
                        onPress={closeSharedPostModal}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss"
                    />
                    <View style={styles.sharedPostCard}>
                        <View style={styles.sharedPostCardHeader}>
                            <Text style={styles.sharedPostCardTitle}>View original post</Text>
                            <TouchableOpacity
                                onPress={closeSharedPostModal}
                                style={styles.sharedPostCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                            >
                                <Icon name="close" size={ox(22)} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {originalPost ? (
                            <Text style={styles.sharedModalSub}>
                                This story was shared from a post by{' '}
                                <Text style={styles.sharedModalSubStrong}>
                                    {originalPost.userHandle}
                                </Text>
                            </Text>
                        ) : sharedPostFetchFailed ? (
                            <Text style={styles.sharedModalSub}>
                                Couldn’t load the original post.
                            </Text>
                        ) : (
                            <View style={styles.sharedPostLoadingRow}>
                                <ActivityIndicator size="small" color="#60A5FA" />
                                <Text style={[styles.sharedModalSub, { marginBottom: 0 }]}>
                                    Loading post…
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.sheetActionButton,
                                styles.sheetActionPrimary,
                                !originalPost && styles.sheetActionDisabled,
                            ]}
                            onPress={openFullPostFromStory}
                            disabled={!originalPost}
                        >
                            <Text style={styles.sheetActionText}>View full post</Text>
                        </TouchableOpacity>

                        {originalPost ? (
                            <TouchableOpacity
                                style={[styles.sheetActionButton, styles.sheetActionSecondary]}
                                onPress={() => {
                                    setShowSharedPostModal(false);
                                    closeStories();
                                    setTimeout(() => {
                                        navigation.navigate('ViewProfile', {
                                            handle: originalPost.userHandle,
                                        });
                                    }, 100);
                                }}
                            >
                                <Text style={styles.sheetActionTextSecondary}>View profile</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            </Modal>

            <ImageFullscreenModal
                post={imageFullscreenPost}
                visible={Boolean(imageFullscreenPost)}
                onClose={() => {
                    fullscreenHoldRef.current = null;
                    setImageFullscreenPost(null);
                    if (
                        !showInlineReplyComposer &&
                        !fullscreenCommentsPost &&
                        !fullscreenSharePost &&
                        !fullscreenSavePost
                    ) {
                        setPaused(false);
                    }
                }}
                onLike={() => void handleFullscreenLike()}
                onComment={handleFullscreenComment}
                onReclip={() => void handleFullscreenReclip()}
                onShare={handleFullscreenShare}
                onSave={handleFullscreenSave}
                isSaved={fullscreenPostSaved}
            />

            <PostCommentsSheet
                postId={fullscreenCommentsPost?.id ?? ''}
                post={fullscreenCommentsPost}
                isOpen={fullscreenCommentsPost !== null}
                commentAuthorHandle={user?.handle || ''}
                currentUserHandle={user?.handle}
                onClose={() => {
                    const closed = fullscreenCommentsPost;
                    setFullscreenCommentsPost(null);
                    restoreFullscreenFromHold();
                    if (!closed?.id) return;
                    void fetchComments(closed.id)
                        .then((list) => {
                            syncFullscreenPost({
                                ...closed,
                                stats: {
                                    ...closed.stats,
                                    comments: list.length,
                                },
                            });
                        })
                        .catch(() => {});
                }}
            />

            <FeedShareModal
                post={fullscreenSharePost}
                isOpen={fullscreenSharePost !== null}
                onClose={() => {
                    setFullscreenSharePost(null);
                    restoreFullscreenFromHold();
                }}
            />

            {fullscreenSavePost && user?.id ? (
                <SavePostModal
                    post={fullscreenSavePost}
                    userId={user.id}
                    visible={fullscreenSavePost !== null}
                    onClose={() => {
                        setFullscreenSavePost(null);
                        restoreFullscreenFromHold();
                    }}
                    onSaved={async () => {
                        if (!user?.id || !fullscreenSavePost) return;
                        try {
                            const cols = await getCollectionsForPost(user.id, fullscreenSavePost.id);
                            setFullscreenPostSaved(cols.length > 0);
                        } catch {
                            setFullscreenPostSaved(true);
                        }
                    }}
                />
            ) : null}

            {currentStory && currentGroup ? (
                <StoryShareSheet
                    visible={showStoryShareModal}
                    onClose={() => setShowStoryShareModal(false)}
                    userHandle={currentGroup.userHandle}
                    storyId={currentStory.id}
                />
            ) : null}

            {isViewingOwnStory && currentStory && user?.id && user?.handle ? (
                <StoryInsightsSheet
                    visible={showInsightsSheet}
                    onClose={() => {
                        setShowInsightsSheet(false);
                        if (!showInlineReplyComposer) setPaused(false);
                    }}
                    story={currentStory}
                    currentUserId={user.id}
                    currentUserHandle={user.handle}
                    avatarMap={insightsAvatarMap}
                    navigation={navigation}
                    onBeforeNavigate={closeStories}
                />
            ) : null}
        </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingShell: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: ox(16),
    },
    storiesOpeningText: {
        marginTop: ox(8),
        fontSize: ox(14),
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    stories24HoldSubtext: {
        marginTop: ox(4),
        fontSize: ox(11),
        color: 'rgba(255,255,255,0.35)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: ox(16),
        ...gazetteerHeader,
    },
    headerTitle: {
        fontSize: ox(20),
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    storyList: {
        flex: 1,
        padding: ox(16),
    },
    storyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        marginBottom: ox(16),
    },
    storyUserName: {
        fontSize: ox(16),
        color: '#FFFFFF',
        fontWeight: '500',
    },
    storyViewerRoot: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    storyDismissBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
    },
    storyViewer: {
        flex: 1,
        backgroundColor: '#000000',
    },
    mediaLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    profileCardHost: {
        position: 'absolute',
        top: 72,
        left: 16,
        zIndex: 140,
        elevation: 140,
    },
    ownerInsightsBar: {
        position: 'absolute',
        top: 72,
        left: 16,
        right: 16,
        zIndex: 65,
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingHorizontal: ox(12),
        paddingVertical: ox(8),
    },
    ownerInsightsText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: ox(11),
        textAlign: 'center',
    },
    progressContainer: {
        flexDirection: 'row',
        paddingHorizontal: ox(8),
        paddingTop: ox(8),
        gap: ox(4),
    },
    progressBarContainer: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: ox(2),
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#FFFFFF',
    },
    storyImage: {
        width: width,
        height: height,
        position: 'absolute',
    },
    storyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: ox(16),
        paddingTop: ox(40),
    },
    storyHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
    },
    storyHeaderName: {
        fontSize: ox(16),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    storyHeaderTime: {
        fontSize: ox(14),
        color: '#D1D5DB',
    },
    audienceBadge: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        borderRadius: ox(999),
        paddingHorizontal: ox(6),
        paddingVertical: ox(2),
    },
    audienceBadgeText: {
        fontSize: ox(10),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    storyTextOverlay: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        right: 16,
    },
    storyText: {
        fontSize: ox(18),
        lineHeight: ox(24),
        color: '#FFFFFF',
        fontWeight: '600',
        flexShrink: 1,
        flexWrap: 'wrap',
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'stretch',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    mediaTextCard: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 128,
        zIndex: 55,
        borderRadius: ox(16),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        maxWidth: 400,
        alignSelf: 'center',
    },
    sharedCredit: {
        position: 'absolute',
        bottom: 126,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: ox(12),
        paddingVertical: ox(6),
        zIndex: 75,
    },
    sharedCreditText: { color: 'rgba(255,255,255,0.9)', fontSize: ox(12) },
    sharedCreditBold: { fontWeight: '700', color: '#fff' },
    storyTextCredit: {
        fontSize: ox(12),
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.65)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    sharedAuthorInline: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 128,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: ox(8),
        zIndex: 24,
    },
    sharedAuthorAvatar: {
        width: ox(20),
        height: ox(20),
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    storyActions: {
        position: 'absolute',
        bottom: 40,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: ox(32),
        zIndex: 10,
    },
    storyActionsHidden: {
        opacity: 0.25,
    },
    inlineReplyComposer: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 104,
        zIndex: 16,
        borderRadius: ox(14),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(3, 7, 18, 0.92)',
        padding: ox(8),
    },
    inlineReplyInput: {
        flex: 1,
        backgroundColor: 'rgba(31,41,55,0.95)',
        borderRadius: ox(999),
        paddingHorizontal: ox(12),
        paddingVertical: ox(8),
        color: '#FFFFFF',
        fontSize: ox(14),
        minHeight: ox(36),
    },
    inlineReplyActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
    },
    quickReactionButton: {
        width: ox(34),
        height: ox(34),
        borderRadius: ox(17),
        backgroundColor: 'rgba(31,41,55,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickReactionText: {
        fontSize: ox(14),
    },
    inlineReplyCancelButton: {
        paddingHorizontal: ox(10),
        paddingVertical: ox(7),
        borderRadius: ox(999),
        backgroundColor: '#374151',
        alignItems: 'center',
    },
    inlineReplyCancelText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '600',
    },
    inlineReplySendButton: {
        paddingHorizontal: ox(12),
        paddingVertical: ox(7),
        borderRadius: ox(999),
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    actionButton: {
        width: ox(48),
        height: ox(48),
        borderRadius: ox(24),
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    leftTapArea: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: width / 2,
        zIndex: 1,
    },
    rightTapArea: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: width / 2,
        zIndex: 1,
    },
    storyLinkSticker: {
        position: 'absolute',
        width: 176,
        height: ox(32),
        borderRadius: ox(16),
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.52)',
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.24,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
        zIndex: 25,
    },
    storyLinkIconTile: {
        width: ox(18),
        height: ox(18),
        marginLeft: 6,
        borderRadius: ox(9),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.68)',
        backgroundColor: 'rgba(255,255,255,0.58)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyLinkLabel: {
        flex: 1,
        marginLeft: 7,
        marginRight: 7,
        fontSize: ox(11),
        lineHeight: ox(11.5),
        fontFamily: 'Inter-SemiBold',
        fontWeight: '600',
        letterSpacing: ox(0.05),
        color: '#0B1220',
    },
    replyModal: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    replyModalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: ox(20),
        paddingBottom: ox(40),
    },
    replyModalTitle: {
        fontSize: ox(18),
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: ox(16),
    },
    replyInput: {
        backgroundColor: '#1F2937',
        borderRadius: ox(12),
        padding: ox(16),
        color: '#FFFFFF',
        fontSize: ox(16),
        minHeight: ox(100),
        textAlignVertical: 'top',
        marginBottom: ox(16),
    },
    replyModalActions: {
        flexDirection: 'row',
        gap: ox(12),
    },
    replyCancelButton: {
        flex: 1,
        padding: ox(12),
        borderRadius: ox(8),
        backgroundColor: '#1F2937',
        alignItems: 'center',
    },
    replyCancelText: {
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '600',
    },
    replySendButton: {
        flex: 1,
        padding: ox(12),
        borderRadius: ox(8),
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    replySendButtonDisabled: {
        opacity: 0.6,
    },
    replySendText: {
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '600',
    },
    sheetActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(10),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: ox(12),
        paddingVertical: ox(12),
        marginBottom: ox(10),
    },
    sheetActionPrimary: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    sheetActionText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
    sheetActionSecondary: {
        backgroundColor: '#1f2937',
        marginBottom: 0,
    },
    sheetActionTextSecondary: {
        color: '#e5e7eb',
        fontSize: ox(14),
        fontWeight: '600',
    },
    sharedModalSub: {
        color: '#9CA3AF',
        fontSize: ox(14),
        lineHeight: ox(20),
        marginBottom: ox(16),
    },
    sharedModalSubStrong: {
        color: '#F3F4F6',
        fontWeight: '600',
    },
    sharedPostBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: ox(20),
    },
    sharedPostCard: {
        width: '100%',
        maxWidth: ox(400),
        borderRadius: ox(16),
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1F2937',
        padding: ox(20),
    },
    sharedPostCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ox(12),
    },
    sharedPostCardTitle: {
        flex: 1,
        fontSize: ox(18),
        fontWeight: '700',
        color: '#FFFFFF',
        paddingRight: ox(8),
    },
    sharedPostCloseBtn: {
        width: ox(36),
        height: ox(36),
        borderRadius: ox(18),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    sharedPostLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        marginBottom: ox(16),
    },
    sheetActionDisabled: {
        opacity: 0.45,
    },
    insightsTabRow: {
        flexDirection: 'row',
        gap: ox(10),
        marginBottom: ox(12),
    },
    insightsTabBtn: {
        flex: 1,
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingVertical: ox(8),
        alignItems: 'center',
    },
    insightsTabBtnActive: {
        borderColor: '#F8D26A',
        backgroundColor: '#3F2B07',
    },
    insightsTabBtnText: {
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '700',
    },
    insightsTabBtnTextActive: {
        color: '#F8D26A',
    },
    insightsScroll: {
        maxHeight: 280,
        marginBottom: ox(14),
    },
    insightsScrollContent: {
        gap: ox(8),
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
    },
    insightRowInner: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    insightTextWrap: {
        marginLeft: 10,
        flex: 1,
    },
    insightPrimary: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
    },
    insightSecondary: {
        color: '#9CA3AF',
        fontSize: ox(12),
        marginTop: ox(4),
    },
    insightTertiary: {
        color: '#6B7280',
        fontSize: ox(11),
        marginTop: ox(4),
    },
    emptyInsightsText: {
        color: '#9CA3AF',
        fontSize: ox(13),
        textAlign: 'center',
        paddingVertical: ox(20),
    },
});









