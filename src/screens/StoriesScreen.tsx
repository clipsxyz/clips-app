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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import StoriesPopIcon from '../components/StoriesPopIcon.native';
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
import { isStoryVideo } from '../utils/storyMediaNative';
import {
    buildStoryReplyContext,
    resolveStoryReplyThumbnail,
} from '../utils/storyReplyNative';
import { getStoryTextContent } from '../utils/storyTextStyleNative';
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
import { getFollowedUsers, getPostById, getState, getFollowState, setFollowState } from '../api/posts';
import { toggleFollow } from '../api/client';
import { getAvatarForHandle } from '../api/users';
import { appendMessage } from '../api/messages';
import type { Post, Story, StoryGroup } from '../types';
import Avatar from '../components/Avatar';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 15000; // 15 seconds
const STORY_SAFE_ZONE_TOP = 18;
const STORY_SAFE_ZONE_BOTTOM = 82;
export default function StoriesScreen({ route, navigation }: any) {
    const {
        openUserHandle,
        openStoryId,
        fromStories24Rail,
        railHandles: railHandlesParam,
        previewThumb: routePreviewThumb,
        previewVideoUrl: routePreviewVideoUrl,
    } = route.params || {};
    const railHandles = Array.isArray(railHandlesParam) ? railHandlesParam : [];
    const railHandlesKey = railHandles.join('|');
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
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [showSharedPostModal, setShowSharedPostModal] = useState(false);
    const [deliveryFx, setDeliveryFx] = useState<StoryDeliveryFxState | null>(null);
    const [localReactionByStoryId, setLocalReactionByStoryId] = useState<Record<string, string>>({});
    const avatarRef = useRef<View>(null);
    const lastLikeTapAtRef = useRef(0);
    const lastMuteToggleAtRef = useRef(0);
    const deliveryFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deliveryFxFlyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showInlineReplyComposerRef = useRef(false);
    const isSendingReplyRef = useRef(false);
    const pausedRef = useRef(false);
    const progressRef = useRef(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
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
            return;
        }
        if (currentGroup.userHandle === user.handle) {
            setIsFollowingStoryUser(false);
            return;
        }
        if (user?.id) {
            const cached = getFollowState(getState(user.id).follows || {}, currentGroup.userHandle);
            setIsFollowingStoryUser(cached);
        }
    }, [viewingStories, currentGroup?.userHandle, user?.id, user?.handle]);

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    const storyPauseLocked = Boolean(
        showInsightsSheet ||
            showStoryShareModal ||
            showSharedPostModal ||
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
    }, [fromStories24Rail, normalizedOpenUserHandle]);

    useEffect(() => {
        if (!stories24OpenFromFeedRail || !normalizedOpenUserHandle) {
            setStories24HoldMinReady(false);
            return;
        }
        setStories24HoldMinReady(false);
        const t = setTimeout(() => setStories24HoldMinReady(true), STORIES24_LOADING_HOLD_MS);
        return () => clearTimeout(t);
    }, [stories24OpenFromFeedRail, normalizedOpenUserHandle]);

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

            setStoryGroups(withGazetteerWorldGroup(groups));
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

        const currentGroup = storyGroups[currentGroupIndex];
        if (!currentGroup) return;

        if (currentStoryIndex < currentGroup.stories.length - 1) {
            setCurrentStoryIndex(currentStoryIndex + 1);
            setProgress(0);
            progressRef.current = 0;
            startProgress();
        } else {
            if (currentGroupIndex < storyGroups.length - 1) {
                setCurrentGroupIndex(currentGroupIndex + 1);
                setCurrentStoryIndex(0);
                setProgress(0);
                progressRef.current = 0;
                startProgress();
            } else {
                closeStories();
            }
        }
    };

    const previousStory = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(currentStoryIndex - 1);
            setProgress(0);
            progressRef.current = 0;
            startProgress();
        } else {
            if (currentGroupIndex > 0) {
                setCurrentGroupIndex(currentGroupIndex - 1);
                const prevGroup = storyGroups[currentGroupIndex - 1];
                setCurrentStoryIndex(prevGroup?.stories.length - 1 || 0);
                setProgress(0);
                progressRef.current = 0;
                startProgress();
            }
        }
    };

    const closeStories = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (stories24OpenFromFeedRail && normalizedOpenUserHandle) {
            const currentStory = storyGroups[currentGroupIndex]?.stories?.[currentStoryIndex];
            const mediaUrl = currentStory?.mediaUrl;
            const isVideo =
                currentStory?.mediaType === 'video' ||
                (!!mediaUrl && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl));
            const previewThumb =
                routePreviewThumb ||
                (!isVideo && mediaUrl ? mediaUrl : undefined) ||
                undefined;

            void persistStories24RailReturn({
                handle: normalizedOpenUserHandle,
                previewThumb,
                previewVideoUrl: routePreviewVideoUrl,
            });
            void clearStories24RailOpenHandle();
        }

        setViewingStories(false);
        setProgress(0);
        setPaused(false);
        progressRef.current = 0;
        navigation.goBack();
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
        if (!currentGroup?.userHandle || !user?.id || isFollowLoading) return;
        const handle = currentGroup.userHandle;
        setIsFollowLoading(true);
        try {
            const result = await toggleFollow(handle);
            const resolved =
                typeof result?.following === 'boolean'
                    ? result.following
                    : result?.status === 'accepted'
                      ? true
                      : result?.status === 'unfollowed'
                        ? false
                        : !isFollowingStoryUser;
            setIsFollowingStoryUser(resolved);
            setFollowState(user.id, handle, resolved);
        } catch {
            const fallback = !isFollowingStoryUser;
            setIsFollowingStoryUser(fallback);
            setFollowState(user.id, handle, fallback);
        } finally {
            setIsFollowLoading(false);
        }
    };

    const openFullPostFromStory = () => {
        if (!originalPost) return;
        setShowSharedPostModal(false);
        const video =
            originalPost.mediaType === 'video' ||
            originalPost.mediaItems?.some((m) => m.type === 'video');
        if (video) {
            navigation.navigate('Scenes', {
                initialPostId: originalPost.id,
                posts: [originalPost],
            });
        } else {
            navigation.navigate('PostDetail', { postId: originalPost.id });
        }
    };

    const startDeliveryFx = useCallback((kind: 'message' | 'like', toHandle: string) => {
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
        try {
            await addStoryReaction(currentStory.id, user.id, user.handle, emoji);
            setLocalReactionByStoryId((prev) => ({ ...prev, [currentStory.id]: emoji }));
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    const triggerLikeAction = () => {
        const now = Date.now();
        if (now - lastLikeTapAtRef.current < 260) return;
        lastLikeTapAtRef.current = now;
        if (currentGroup?.userHandle) {
            startDeliveryFx('like', currentGroup.userHandle);
        }
        void handleReaction('👍');
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
                const sharedPostForContext =
                    currentStory.sharedFromPost && !originalPost
                        ? await getPostById(currentStory.sharedFromPost, user.id)
                        : null;
                const storyThumb = await resolveStoryReplyThumbnail(
                    currentStory,
                    originalPost,
                    sharedPostForContext,
                );
                const { contextOwner, storyContextText, isVisualStory } = buildStoryReplyContext(
                    currentStory,
                    toHandle,
                    originalPost,
                    sharedPostForContext,
                );

                if (storyThumb) {
                    await appendMessage(user.handle, toHandle, {
                        imageUrl: storyThumb,
                        storyId: currentStory.id,
                        storyContextOwner: contextOwner || undefined,
                    });
                } else {
                    const contextBubbleText = storyContextText
                        ? `Replying to @${contextOwner}'s story:\n"${storyContextText}"`
                        : `Replying to @${contextOwner}'s story`;
                    await appendMessage(user.handle, toHandle, {
                        text: contextBubbleText,
                        isSystemMessage: true,
                    });
                }
                await appendMessage(user.handle, toHandle, {
                    text: normalizedReply,
                    imageUrl: isVisualStory ? undefined : storyThumb,
                    storyId: currentStory.id,
                    storyContextText: isVisualStory ? undefined : storyContextText || undefined,
                    storyContextOwner: contextOwner || undefined,
                });
                await appendMessage(toHandle, user.handle, {
                    text: 'You replied to their story',
                    isSystemMessage: true,
                });
                startDeliveryFx('message', toHandle);
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
            <GazetteerScreenShell contentStyle={styles.loadingShell} ambientVariant="goldChrome">
                <StoriesPopIcon size={80} />
                <Text style={styles.storiesOpeningText}>Opening stories…</Text>
                <Text style={styles.stories24HoldSubtext}>Stories 24</Text>
            </GazetteerScreenShell>
        );
    }

    if (loading) {
        return (
            <GazetteerScreenShell contentStyle={styles.loadingShell}>
                {normalizedOpenUserHandle && !stories24OpenFromFeedRail ? (
                    <>
                        <ActivityIndicator size="large" color="#f472b6" />
                        <Text style={styles.storiesOpeningText}>Opening story...</Text>
                    </>
                ) : (
                    <ActivityIndicator size="large" color="#f472b6" />
                )}
            </GazetteerScreenShell>
        );
    }

    const isCurrentStoryVideo = isStoryVideo(currentStory, originalPost);
    const storyDisplayText = getStoryTextContent(currentStory);
    const currentStoryText = getStoryOverlayText(currentStory);
    const storyMetadataItems = buildStoryMetadataItems(currentStory, originalPost);
    const sharedCredit = shouldShowSharedStoryCredit(
        currentStory,
        originalPost,
        currentGroup?.userHandle,
    );
    const showTextOnlyOverlay =
        !!storyDisplayText &&
        !currentStory?.sharedFromPost &&
        !(currentStory?.mediaUrl && currentStory.mediaUrl.trim());
    const showMediaTextOverlay =
        !!currentStoryText &&
        !currentStory?.sharedFromPost &&
        !!currentStory?.mediaUrl &&
        !currentStory.mediaUrl.startsWith('data:image');
    const hasStoryReaction = Boolean(
        (currentStory && localReactionByStoryId[currentStory.id]) || currentStory?.userReaction,
    );

    if (!viewingStories) {
        // Story list view
        return (
            <GazetteerScreenShell>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Icon name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Clips 24</Text>
                    <View style={{ width: 24 }} />
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
        <View style={styles.storyViewer}>
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
                        enabled={!showInlineReplyComposer && !deliveryFx}
                        style={styles.mediaLayer}
                        onSwipeLeft={nextStory}
                        onSwipeRight={previousStory}
                        onHoldStart={pauseForHold}
                        onHoldEnd={releaseHold}
                    >
                        {currentStory.sharedFromPost ? (
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
                        showFollowBadge={
                            !!currentGroup.userHandle &&
                            !!user?.handle &&
                            currentGroup.userHandle !== user.handle &&
                            !isFollowingStoryUser
                        }
                        metadataItems={storyMetadataItems}
                        showVideoMute={isCurrentStoryVideo}
                        isMuted={isMuted}
                        onAvatarPress={() => {
                            setShowStoryProfileCard((v) => !v);
                            setPaused(true);
                        }}
                        onToggleMute={toggleGlobalMute}
                        onClose={closeStories}
                    />
                    {showStoryProfileCard && currentGroup.userHandle !== user?.handle ? (
                        <View style={styles.profileCardHost}>
                            <StoryProfileCard
                                isFollowing={isFollowingStoryUser}
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
                                {(currentStory.views ?? 0)} views • {(currentStory.replies?.length ?? 0)} replies • tap for insights
                            </Text>
                        </TouchableOpacity>
                    ) : null}

                    {showTextOnlyOverlay ? (
                        <StoryTextOverlay
                            text={storyDisplayText}
                            taggedUsers={currentStory.taggedUsers}
                            textColor={currentStory.textColor || '#fff'}
                            onMentionPress={(handle) => {
                                closeStories();
                                setTimeout(() => {
                                    navigation.navigate('ViewProfile', { handle });
                                }, 100);
                            }}
                        />
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
                                            <Icon name="link-outline" size={15} color={iconColor} />
                                        </View>
                                        <Text numberOfLines={1} style={[styles.storyLinkLabel, { color: labelColor }]}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}

                    <StoryBottomBar
                        hidden={isHoldingToPause}
                        showReplyComposer={showInlineReplyComposer}
                        replyText={replyText}
                        replyPlaceholder={`Reply to ${currentGroup.userHandle || 'story'}`}
                        isSending={isSendingReply}
                        hasReaction={hasStoryReaction}
                        onReplyTextChange={setReplyText}
                        onOpenReply={() => {
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
                onRequestClose={() => {
                    setShowSharedPostModal(false);
                    if (!showInlineReplyComposer) setPaused(false);
                }}
            >
                <View style={styles.replyModal}>
                    <View style={styles.replyModalContent}>
                        <Text style={styles.replyModalTitle}>View original post</Text>
                        {originalPost ? (
                            <Text style={styles.sharedModalSub}>
                                This story was shared from {originalPost.userHandle}
                            </Text>
                        ) : null}
                        <TouchableOpacity style={styles.sheetActionButton} onPress={openFullPostFromStory}>
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
                        <TouchableOpacity
                            onPress={() => {
                                setShowSharedPostModal(false);
                                if (!showInlineReplyComposer) setPaused(false);
                            }}
                            style={styles.replyCancelButton}
                        >
                            <Text style={styles.replyCancelText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
        </View>
    );
}

const styles = StyleSheet.create({
    loadingShell: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    storiesOpeningText: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    stories24HoldSubtext: {
        marginTop: 4,
        fontSize: 11,
        color: 'rgba(255,255,255,0.35)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        ...gazetteerHeader,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    storyList: {
        flex: 1,
        padding: 16,
    },
    storyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    storyUserName: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
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
        zIndex: 70,
    },
    ownerInsightsBar: {
        position: 'absolute',
        top: 72,
        left: 16,
        right: 16,
        zIndex: 65,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    ownerInsightsText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 11,
        textAlign: 'center',
    },
    progressContainer: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingTop: 8,
        gap: 4,
    },
    progressBarContainer: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
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
        padding: 16,
        paddingTop: 40,
    },
    storyHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    storyHeaderName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    storyHeaderTime: {
        fontSize: 14,
        color: '#D1D5DB',
    },
    audienceBadge: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    audienceBadgeText: {
        fontSize: 10,
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
        fontSize: 18,
        lineHeight: 24,
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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: 400,
        alignSelf: 'center',
    },
    sharedCredit: {
        position: 'absolute',
        bottom: 126,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        zIndex: 75,
    },
    sharedCreditText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
    sharedCreditBold: { fontWeight: '700', color: '#fff' },
    storyTextCredit: {
        fontSize: 12,
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
        gap: 8,
        zIndex: 24,
    },
    sharedAuthorAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
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
        gap: 32,
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
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(3, 7, 18, 0.92)',
        padding: 8,
    },
    inlineReplyInput: {
        flex: 1,
        backgroundColor: 'rgba(31,41,55,0.95)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: '#FFFFFF',
        fontSize: 14,
        minHeight: 36,
    },
    inlineReplyActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    quickReactionButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(31,41,55,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickReactionText: {
        fontSize: 14,
    },
    inlineReplyCancelButton: {
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#374151',
        alignItems: 'center',
    },
    inlineReplyCancelText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    inlineReplySendButton: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    actionButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
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
        height: 32,
        borderRadius: 16,
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
        width: 18,
        height: 18,
        marginLeft: 6,
        borderRadius: 9,
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
        fontSize: 11,
        lineHeight: 11.5,
        fontFamily: 'Inter-SemiBold',
        fontWeight: '600',
        letterSpacing: 0.05,
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
        padding: 20,
        paddingBottom: 40,
    },
    replyModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    replyInput: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    replyModalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    replyCancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#1F2937',
        alignItems: 'center',
    },
    replyCancelText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    replySendButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    replySendButtonDisabled: {
        opacity: 0.6,
    },
    replySendText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    sheetActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    sheetActionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    sheetActionSecondary: {
        backgroundColor: '#1f2937',
    },
    sheetActionTextSecondary: {
        color: '#e5e7eb',
        fontSize: 14,
        fontWeight: '600',
    },
    sharedModalSub: {
        color: '#9ca3af',
        fontSize: 13,
        marginBottom: 12,
    },
    insightsTabRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    insightsTabBtn: {
        flex: 1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingVertical: 8,
        alignItems: 'center',
    },
    insightsTabBtnActive: {
        borderColor: '#F8D26A',
        backgroundColor: '#3F2B07',
    },
    insightsTabBtnText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '700',
    },
    insightsTabBtnTextActive: {
        color: '#F8D26A',
    },
    insightsScroll: {
        maxHeight: 280,
        marginBottom: 14,
    },
    insightsScrollContent: {
        gap: 8,
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 12,
        paddingVertical: 10,
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
        fontSize: 14,
        fontWeight: '700',
    },
    insightSecondary: {
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 4,
    },
    insightTertiary: {
        color: '#6B7280',
        fontSize: 11,
        marginTop: 4,
    },
    emptyInsightsText: {
        color: '#9CA3AF',
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 20,
    },
});









