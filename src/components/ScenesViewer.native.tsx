import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gazetteerAlert } from '../utils/gazetteerAlertNative';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Platform,
    BackHandler,
    useWindowDimensions,
    type GestureResponderEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import PromotedBadge from './PromotedBadge.native';
import LinearGradient from 'react-native-linear-gradient';
import { type OnProgressData, type VideoRef } from 'react-native-video';
import type { Post } from '../types';
import { postHasVideoMedia } from '../utils/postMedia';
import { getScenesMediaSlides } from '../utils/scenesMediaNative';
import { getPostDisplayCaption, getReclipDisplay } from '../utils/feedPostMeta';
import { resolveCommentComposerAccess } from '../utils/commentModeration';
import { buildPostMetadataItems } from '../utils/feedPostMeta';
import { getAvatarForHandle, setAvatarForHandle } from '../api/users';
import Avatar from './Avatar';
import VerifiedBadge from './VerifiedBadge.native';
import FeedLikeThumbsIcon from './FeedLikeThumbsIcon.native';
import FeedShareModal from './FeedShareModal';
import PostCommentsSheet from './PostCommentsSheet';
import PostOverflowMenuModal from './PostOverflowMenuModal';
import DeletePostConfirmSheet from './DeletePostConfirmSheet.native';
import FeedDoubleTapLikeBurst from './FeedDoubleTapLikeBurst.native';
import SavePostModal from './SavePostModal.native';
import ScenesFooterBar from './ScenesFooterBar.native';
/** Match feed card double-tap window (FeedScreen uses 260ms). */
const SCENES_DOUBLE_TAP_MS = 260;
import QRCodeModal from './QRCodeModal.native';
import EditPostModal from './EditPostModal.native';
import CreateGroupModal from './CreateGroupModal.native';
import PickGroupToInviteFeedUserModal from './PickGroupToInviteFeedUserModal.native';
import ScenesMediaPlayer, { ScenesMediaProgressBar } from './ScenesMediaPlayer.native';
import { fitContainBox, intrinsicRatio } from '../utils/mediaAspectRatio';
import { getCollectionsForPost } from '../api/collections';
import { buildShareablePostUrl } from '../utils/shareUrls';
import {
    getGlobalVideoMutedNative,
    setGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';
import { setActiveFeedVideoPostId } from '../utils/feedActiveVideoNative';
import { setScenesViewerActive } from '../utils/scenesViewerActiveNative';
import {
    toggleLike,
    toggleFollowForPost,
    reclipPost,
    setReclipState,
    getFollowedUsers,
    deletePost,
    setFollowState,
} from '../api/posts';
import { blockUser } from '../api/messages';
import {
    blockFeedAuthorMobile,
    hideFeedPostMobile,
    markNotInterestedFeedPostMobile,
    muteFeedAuthorMobile,
} from '../utils/feedContentPrefsMobile';
import {
    hasPostNotificationsPrefMobile,
    markFeedPostArchivedMobile,
    setPostNotificationsPrefMobile,
} from '../utils/feedEngagementPrefsMobile';
import { parseStoryMentionParts } from '../utils/storyMentionParts';
import {
    canSendMessage,
    createFollowRequest,
    hasPendingFollowRequest,
    isProfilePrivate,
} from '../api/privacy';

/** Match web ScenesModal: post shrinks to the top 40%, comments fill the rest. */
const COMMENTS_MEDIA_MS = 640;
const COMMENTS_MEDIA_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const COMMENTS_PREVIEW_RATIO = 0.4;
const COMMENTS_MEDIA_RADIUS = 20;

type MetadataItem = { label: string; type: 'feed' | 'location' | 'venue' | 'timestamp' };

function buildScenesMetadata(post: Post, feedLabel?: string): MetadataItem[] {
    const out: MetadataItem[] = [];
    if (feedLabel) out.push({ label: feedLabel.toUpperCase(), type: 'feed' });
    for (const item of buildPostMetadataItems(post)) {
        out.push({
            label: item.label,
            type: item.type === 'venue' ? 'venue' : item.type === 'landmark' ? 'location' : item.type,
        });
    }
    return out;
}

function metadataIcon(type: MetadataItem['type']): string {
    if (type === 'timestamp') return 'time-outline';
    if (type === 'venue') return 'home-outline';
    return 'location-outline';
}

export type ScenesViewerProps = {
    posts: Post[];
    initialPostId: string;
    initialVideoTime?: number;
    initialMuted?: boolean;
    feedLabel?: string;
    viewerUserId: string;
    viewerHandle?: string;
    /** Auth profile photo — required for own posts (handle map often has no entry yet). */
    viewerAvatarUrl?: string;
    onClose: (savedTime?: number, postId?: string, mutedState?: boolean) => void;
    onVisitProfile: (handle: string) => void;
    onPostsChange?: (posts: Post[]) => void;
    navigation?: { navigate: (route: string, params?: object) => void };
    onBoost?: () => void;
};

export default function ScenesViewer({
    posts: postsProp,
    initialPostId,
    initialVideoTime,
    initialMuted,
    feedLabel,
    viewerUserId,
    viewerHandle,
    viewerAvatarUrl,
    onClose,
    onVisitProfile,
    onPostsChange,
    navigation,
    onBoost,
}: ScenesViewerProps) {
    const insets = useSafeAreaInsets();
    // Reactive (not Dimensions.get) so the media viewport tracks rotation/resize.
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const mediaHeightSv = useSharedValue(windowHeight);
    /** 0 = fullscreen post, 1 = comments open (post pinned to the top 40%). */
    const commentsProgressSv = useSharedValue(0);
    const commentsPreviewSv = useSharedValue(Math.round(windowHeight * COMMENTS_PREVIEW_RATIO));
    const windowHeightSv = useSharedValue(windowHeight);
    /** Full viewer height captured while comments are closed, so the keyboard
     * resize does not recompute the split. */
    const stageHeightSv = useSharedValue(windowHeight);
    /** Fitted media height for the active slide, kept in a ref so effects declared
     * before the slide memo can restore to it (see the comments-close effect). */
    const activeFittedHeightRef = useRef(windowHeight);

    // Keep handle→avatar map warm so own + other chrome can resolve the photo.
    useEffect(() => {
        if (viewerHandle && viewerAvatarUrl) {
            setAvatarForHandle(viewerHandle, viewerAvatarUrl);
        }
    }, [viewerHandle, viewerAvatarUrl]);

    // Android Video surfaces ignore overflow clipping — drive the player height explicitly
    // so the MP4 actually becomes a Reels-style mini viewport above the sheet.
    const [mediaViewportHeight, setMediaViewportHeight] = useState(windowHeight);
    const [mediaCornerRadius, setMediaCornerRadius] = useState(0);
    const posts = useMemo(() => {
        const filtered = postsProp.filter(postHasVideoMedia);
        if (filtered.length > 0) return filtered;
        // Keep the tapped post playable even if filter missed (bad mediaType / URL).
        const initial = postsProp.find((p) => p.id === initialPostId);
        return initial ? [initial] : [];
    }, [initialPostId, postsProp]);

    const initialIndex = Math.max(0, posts.findIndex((p) => p.id === initialPostId));
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [muted, setMuted] = useState(initialMuted ?? true);
    const [paused, setPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [commentsOpen, setCommentsOpen] = useState(false);
    /** Stays mounted through the close animation so the sheet can slide down. */
    const [commentsMounted, setCommentsMounted] = useState(false);
    const [sharePost, setSharePost] = useState<Post | null>(null);
    const [burstAt, setBurstAt] = useState<{ x: number; y: number } | null>(null);
    const [burstKey, setBurstKey] = useState(0);
    const burstClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [metadataIndex, setMetadataIndex] = useState(0);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [dismissPull, setDismissPull] = useState(0);
    const [mediaSlideProgress, setMediaSlideProgress] = useState(0);
    const [mediaSlideIndex, setMediaSlideIndex] = useState(0);
    const [overflowVisible, setOverflowVisible] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [overflowNotify, setOverflowNotify] = useState(false);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [qrPost, setQrPost] = useState<Post | null>(null);
    const [editPost, setEditPost] = useState<Post | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [inviteGroupHandle, setInviteGroupHandle] = useState<string | null>(null);
    const postsRef = useRef(posts);
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;
    postsRef.current = posts;
    const videoRef = useRef<VideoRef>(null);
    const currentTimeRef = useRef(0);
    const timesByPostId = useRef<Map<string, number>>(new Map());
    const didSeekInitialRef = useRef(false);
    const commentsOpenRef = useRef(false);
    commentsOpenRef.current = commentsMounted;
    const lastMediaTapRef = useRef(0);
    const singleMediaTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activePost = posts[activeIndex];
    const caption = activePost ? getPostDisplayCaption(activePost) : '';
    const metadataItems = useMemo(
        () => (activePost ? buildScenesMetadata(activePost, feedLabel) : []),
        [activePost, feedLabel],
    );

    const patchPost = useCallback(
        (postId: string, patch: Partial<Post> | ((p: Post) => Post)) => {
            const next = postsProp.map((p) => {
                if (String(p.id) !== String(postId)) return p;
                return typeof patch === 'function' ? patch(p) : { ...p, ...patch };
            });
            onPostsChange?.(next);
        },
        [onPostsChange, postsProp],
    );

    useEffect(() => {
        // Kill any feed ExoPlayer still under this fullScreenModal (focus blur is unreliable).
        setActiveFeedVideoPostId(null);
        setScenesViewerActive(true);
        return () => {
            setScenesViewerActive(false);
        };
    }, []);

    useEffect(() => {
        if (initialMuted !== undefined) {
            setMuted(initialMuted);
            return;
        }
        let mounted = true;
        void getGlobalVideoMutedNative().then((m) => {
            if (mounted) setMuted(m);
        });
        return subscribeGlobalVideoMuted((m) => setMuted(m));
    }, [initialMuted]);

    useEffect(() => {
        if (initialVideoTime != null && initialVideoTime > 0) {
            timesByPostId.current.set(initialPostId, initialVideoTime);
        }
    }, [initialPostId, initialVideoTime]);

    useEffect(() => {
        didSeekInitialRef.current = false;
        setProgress(0);
        setMediaSlideProgress(0);
        setMediaSlideIndex(0);
        setPaused(false);
        setMetadataIndex(0);
        lastMediaTapRef.current = 0;
        if (singleMediaTapTimerRef.current) {
            clearTimeout(singleMediaTapTimerRef.current);
            singleMediaTapTimerRef.current = null;
        }
    }, [activePost?.id]);

    useEffect(() => {
        windowHeightSv.value = windowHeight;
        if (commentsOpen) return;
        stageHeightSv.value = windowHeight;
        commentsPreviewSv.value = Math.max(1, Math.round(windowHeight * COMMENTS_PREVIEW_RATIO));
    }, [commentsOpen, commentsPreviewSv, stageHeightSv, windowHeight, windowHeightSv]);

    useEffect(() => {
        if (commentsOpen) {
            const fullPreview = Math.max(1, Math.round(stageHeightSv.value * COMMENTS_PREVIEW_RATIO));
            // Keep a usable sheet if the keyboard shrinks the window (adjustResize).
            const preview = Math.max(96, Math.min(fullPreview, windowHeight - 240));
            const duration = commentsProgressSv.value > 0.85 ? 200 : COMMENTS_MEDIA_MS;
            commentsPreviewSv.value = preview;
            commentsProgressSv.value = withTiming(1, {
                duration,
                easing: COMMENTS_MEDIA_EASE,
            });
            mediaHeightSv.value = withTiming(preview, {
                duration,
                easing: COMMENTS_MEDIA_EASE,
            });
            return;
        }
        commentsProgressSv.value = withTiming(0, {
            duration: COMMENTS_MEDIA_MS,
            easing: COMMENTS_MEDIA_EASE,
        });
        // Restore to the ACTIVE slide's fitted height, not blindly to the full
        // window: a landscape post must not re-expand into a portrait viewport
        // when the comments sheet closes.
        mediaHeightSv.value = withTiming(activeFittedHeightRef.current, {
            duration: COMMENTS_MEDIA_MS,
            easing: COMMENTS_MEDIA_EASE,
        });
    }, [commentsOpen, commentsPreviewSv, commentsProgressSv, mediaHeightSv, stageHeightSv, windowHeight]);

    const applyMediaFrame = useCallback((h: number, r: number) => {
        const nextH = Math.max(1, Math.round(h));
        const nextR = Math.max(0, Math.round(r));
        setMediaViewportHeight((prev) => (prev === nextH ? prev : nextH));
        setMediaCornerRadius((prev) => (prev === nextR ? prev : nextR));
    }, []);

    useAnimatedReaction(
        () => ({
            h: Math.round(mediaHeightSv.value),
            r: Math.round(commentsProgressSv.value * COMMENTS_MEDIA_RADIUS),
        }),
        (next, prev) => {
            if (!prev || next.h !== prev.h || next.r !== prev.r) {
                runOnJS(applyMediaFrame)(next.h, next.r);
            }
        },
        [applyMediaFrame],
    );

    const mediaLayerAnimStyle = useAnimatedStyle(() => {
        const centeredTop = Math.max(0, (stageHeightSv.value - mediaHeightSv.value) / 2);
        return {
            height: mediaHeightSv.value,
            // Fullscreen landscape stays centred. With comments open the post pins
            // to the top so the sheet can sit underneath it.
            top: centeredTop * (1 - commentsProgressSv.value),
            borderRadius: commentsProgressSv.value * COMMENTS_MEDIA_RADIUS,
        };
    });

    const commentsDockStyle = useAnimatedStyle(() => {
        const top =
            stageHeightSv.value -
            (stageHeightSv.value - commentsPreviewSv.value) * commentsProgressSv.value;
        const parentHeight = windowHeightSv.value;
        const clampedTop = Math.min(top, Math.max(0, parentHeight - 1));
        return {
            top: clampedTop,
            height: Math.max(0, parentHeight - clampedTop),
        };
    });

    const activeMediaSlides = useMemo(
        () => (activePost ? getScenesMediaSlides(activePost) : []),
        [activePost],
    );

    /**
     * Dynamic viewport adaptation: the media layer's height is the ACTIVE slide's
     * aspect-fitted height, recomputed whenever the user pages to a post (or slide)
     * with a different orientation. Portrait 9:16 gets a tall frame, landscape 16:9
     * a short widescreen frame, unknown dimensions keep the full window (the player
     * letterboxes internally with `contain` once `naturalSize` lands).
     */
    const activeSlideForFit =
        activeMediaSlides[mediaSlideIndex] ?? activeMediaSlides[0] ?? null;
    const activeFittedHeight = useMemo(() => {
        const w = activeSlideForFit?.width;
        const h = activeSlideForFit?.height;
        if (intrinsicRatio(w, h) == null) return windowHeight;
        return Math.max(1, Math.round(fitContainBox(windowWidth, windowHeight, w, h).height));
    }, [activeSlideForFit?.width, activeSlideForFit?.height, windowWidth, windowHeight]);
    activeFittedHeightRef.current = activeFittedHeight;

    useEffect(() => {
        if (commentsOpen) return;
        mediaHeightSv.value = withTiming(activeFittedHeight, {
            duration: COMMENTS_MEDIA_MS,
            easing: COMMENTS_MEDIA_EASE,
        });
    }, [activeFittedHeight, commentsOpen, mediaHeightSv]);

    useEffect(() => {
        if (metadataItems.length <= 1) return;
        const t = setInterval(() => {
            setMetadataIndex((i) => (i + 1) % metadataItems.length);
        }, 3000);
        return () => clearInterval(t);
    }, [metadataItems.length, activePost?.id]);

    useEffect(() => {
        if (!activePost?.id) {
            setIsSaved(false);
            return;
        }
        let cancelled = false;
        void getCollectionsForPost(viewerUserId, activePost.id).then((cols) => {
            if (!cancelled) setIsSaved(cols.length > 0);
        });
        return () => {
            cancelled = true;
        };
    }, [activePost?.id, viewerUserId]);

    useEffect(() => {
        if (!activePost?.id || !viewerHandle || viewerHandle === activePost.userHandle) {
            setHasPendingRequest(false);
            return;
        }
        setHasPendingRequest(
            isProfilePrivate(activePost.userHandle) &&
                hasPendingFollowRequest(viewerHandle, activePost.userHandle),
        );
    }, [activePost?.id, activePost?.userHandle, viewerHandle]);

    useEffect(() => {
        if (!overflowVisible || !activePost?.id) return;
        let cancelled = false;
        void hasPostNotificationsPrefMobile(viewerUserId, activePost.id).then((on) => {
            if (!cancelled) setOverflowNotify(on);
        });
        return () => {
            cancelled = true;
        };
    }, [activePost?.id, overflowVisible, viewerUserId]);

    const toggleMute = useCallback(() => {
        const next = !muted;
        setMuted(next);
        void setGlobalVideoMutedNative(next);
    }, [muted]);

    const handleBack = useCallback(() => {
        const post = posts[activeIndex];
        if (post) {
            onClose(currentTimeRef.current, post.id, muted);
        } else {
            onClose();
        }
    }, [activeIndex, muted, onClose, posts]);

    const goToPost = useCallback((nextIndex: number) => {
        if (nextIndex < 0 || nextIndex >= posts.length) return;
        setActiveIndex((prev) => {
            if (prev === nextIndex) return prev;
            const prevPost = postsRef.current[prev];
            if (prevPost) {
                timesByPostId.current.set(prevPost.id, currentTimeRef.current);
            }
            didSeekInitialRef.current = false;
            setProgress(0);
            setMediaSlideProgress(0);
            setMediaSlideIndex(0);
            setPaused(false);
            return nextIndex;
        });
    }, [posts.length]);

    const onVideoLoad = useCallback(() => {
        if (!activePost) return;

        if (didSeekInitialRef.current) return;
        const t =
            activeIndex === initialIndex
                ? (initialVideoTime ?? timesByPostId.current.get(activePost.id) ?? 0)
                : (timesByPostId.current.get(activePost.id) ?? 0);
        if (t > 0) {
            videoRef.current?.seek(t);
            currentTimeRef.current = t;
        }
        didSeekInitialRef.current = true;
    }, [activeIndex, activePost, initialIndex, initialVideoTime]);

    const onVideoProgress = useCallback((e: OnProgressData) => {
        currentTimeRef.current = e.currentTime;
        if (e.seekableDuration > 0) {
            const p = e.currentTime / e.seekableDuration;
            setProgress(p);
            setMediaSlideProgress(p);
        }
    }, []);

    const openComments = useCallback(() => {
        setCommentsMounted(true);
        setCommentsOpen(true);
    }, []);

    const closeComments = useCallback(() => {
        setCommentsOpen(false);
    }, []);

    useEffect(() => {
        if (commentsOpen || !commentsMounted) return undefined;
        const t = setTimeout(() => setCommentsMounted(false), COMMENTS_MEDIA_MS);
        return () => clearTimeout(t);
    }, [commentsMounted, commentsOpen]);

    useEffect(() => {
        if (!commentsMounted) return undefined;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (commentsOpen) closeComments();
            return true;
        });
        return () => sub.remove();
    }, [closeComments, commentsMounted, commentsOpen]);

    const handleDirectMessage = useCallback(async () => {
        if (!activePost?.userHandle || !viewerHandle || !viewerUserId) {
            gazetteerAlert('Sign in required', 'Log in to send a direct message.');
            return;
        }
        if (activePost.userHandle === viewerHandle) return;
        if (!navigation) return;

        const followedUsers = await getFollowedUsers(viewerUserId);
        const profilePrivate = isProfilePrivate(activePost.userHandle);
        const canMessage = canSendMessage(viewerHandle, activePost.userHandle, followedUsers);
        const pending = hasPendingFollowRequest(viewerHandle, activePost.userHandle);

        if (!canMessage && profilePrivate) {
            if (pending) {
                gazetteerAlert(
                    'Follow Request Pending',
                    "This user has a private profile. You have already sent a follow request. Once they accept, you'll be able to send them a message.",
                );
                return;
            }

            gazetteerAlert(
                'Cannot Send Message',
                'This user has a private profile. You must follow them and have your follow request accepted before you can send them a message.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Request to Follow',
                        onPress: () => {
                            createFollowRequest(viewerHandle, activePost.userHandle);
                            setFollowState(viewerUserId, activePost.userHandle, false);
                            gazetteerAlert(
                                'Follow Request Sent',
                                'You will be notified when they accept your request.',
                            );
                        },
                    },
                ],
            );
            return;
        }

        if (!canMessage) {
            gazetteerAlert('Cannot Message', 'You must follow this user to send a message.');
            return;
        }

        navigation.navigate('Messages', { handle: activePost.userHandle });
        handleBack();
    }, [activePost, handleBack, navigation, viewerHandle, viewerUserId]);

    const handleLike = useCallback(async () => {
        if (!activePost) return;
        const nextLiked = !activePost.userLiked;
        const nextLikes = Math.max(0, activePost.stats.likes + (nextLiked ? 1 : -1));
        patchPost(activePost.id, {
            userLiked: nextLiked,
            stats: { ...activePost.stats, likes: nextLikes },
        });
        try {
            const updated = await toggleLike(viewerUserId, activePost.id, activePost);
            // Merge only engagement fields — never replace the whole post (mock/demo
            // toggles can return a thin shape and drop mediaUrl → jumps to next Scene).
            patchPost(activePost.id, (p) => ({
                ...p,
                userLiked: updated.userLiked ?? nextLiked,
                stats: {
                    ...p.stats,
                    likes: Math.max(
                        0,
                        typeof updated.stats?.likes === 'number' ? updated.stats.likes : nextLikes,
                    ),
                },
            }));
        } catch {
            patchPost(activePost.id, {
                userLiked: activePost.userLiked,
                stats: activePost.stats,
            });
        }
    }, [activePost, patchPost, viewerUserId]);

    const handleFollow = useCallback(async () => {
        if (!activePost || !viewerHandle) return;
        try {
            const updated = await toggleFollowForPost(
                viewerUserId,
                activePost.id,
                activePost.userHandle,
                viewerHandle,
            );
            const nextFollowing = updated?.isFollowing === true;
            const handleLower = String(activePost.userHandle || '')
                .trim()
                .toLowerCase();
            // Author-level follow; merge flags only so video posts stay in the Scenes list.
            const next = postsProp.map((p) => {
                if (
                    String(p.userHandle || '')
                        .trim()
                        .toLowerCase() !== handleLower
                ) {
                    return p;
                }
                return { ...p, isFollowing: nextFollowing };
            });
            onPostsChange?.(next);
            setHasPendingRequest(
                !nextFollowing &&
                    isProfilePrivate(activePost.userHandle) &&
                    hasPendingFollowRequest(viewerHandle, activePost.userHandle),
            );
        } catch (err) {
            console.warn('Follow failed in Scenes:', err);
        }
    }, [activePost, onPostsChange, postsProp, viewerHandle, viewerUserId]);

    const handleReclip = useCallback(async () => {
        if (!activePost) return;
        if (!viewerHandle || !viewerUserId || viewerUserId === 'anon') {
            gazetteerAlert('Sign in required', 'Log in to reclip this post.');
            return;
        }
        const norm = (h?: string) => String(h || '').trim().toLowerCase();
        const sourceHandle =
            activePost.isReclipped && activePost.originalUserHandle
                ? activePost.originalUserHandle
                : activePost.userHandle;
        if (norm(activePost.userHandle) === norm(viewerHandle) || norm(sourceHandle) === norm(viewerHandle)) {
            gazetteerAlert('Cannot reclip', "You can't reclip your own post.");
            return;
        }
        if (activePost.userReclipped) return;
        const prevReclips = activePost.stats.reclips;
        const nextReclips = prevReclips + 1;
        setReclipState(viewerUserId, activePost.id, true);
        patchPost(activePost.id, {
            userReclipped: true,
            stats: { ...activePost.stats, reclips: nextReclips },
        });
        try {
            const result = await reclipPost(viewerUserId, activePost.id, viewerHandle);
            if (result.originalPost && String(result.originalPost.id) === String(activePost.id)) {
                patchPost(activePost.id, {
                    ...result.originalPost,
                    userReclipped: true,
                });
            } else if (result.originalPost) {
                patchPost(activePost.id, {
                    stats: { ...activePost.stats, reclips: result.originalPost.stats.reclips },
                    userReclipped: true,
                });
            }
        } catch (err) {
            console.warn('Reclip failed in Scenes:', err);
            setReclipState(viewerUserId, activePost.id, false);
            patchPost(activePost.id, {
                userReclipped: false,
                stats: { ...activePost.stats, reclips: prevReclips },
            });
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : 'Could not reclip this post. Try again.';
            gazetteerAlert('Reclip failed', message);
        }
    }, [activePost, patchPost, viewerHandle, viewerUserId]);

    const isTextOnlyPost = useMemo(() => {
        if (!activePost) return false;
        return (
            !activePost.mediaUrl &&
            !(activePost.mediaItems && activePost.mediaItems.length > 0) &&
            Boolean(activePost.text?.trim())
        );
    }, [activePost]);

    const handleSingleTapPause = useCallback(() => {
        const slide = activeMediaSlides[mediaSlideIndex];
        if (slide?.type === 'video' || postHasVideoMedia(activePost)) {
            setPaused((p) => !p);
        }
    }, [activeMediaSlides, activePost, mediaSlideIndex]);

    const fireDoubleTapLikeAt = useCallback(
        (pageX: number, pageY: number) => {
            if (isTextOnlyPost) return;
            setBurstAt({ x: pageX, y: pageY });
            setBurstKey((k) => k + 1);
            // Play once: clear on a timer (feed parity) instead of an inline onDone
            // callback whose identity changes every render and restarts the animation.
            if (burstClearTimerRef.current) clearTimeout(burstClearTimerRef.current);
            burstClearTimerRef.current = setTimeout(() => {
                setBurstAt(null);
                burstClearTimerRef.current = null;
            }, 700);
            if (!activePost?.userLiked) {
                void handleLike();
            }
        },
        [activePost?.userLiked, handleLike, isTextOnlyPost],
    );

    const handleMediaPress = useCallback(
        (event?: GestureResponderEvent) => {
            if (isTextOnlyPost) return;

            const now = Date.now();
            if (now - lastMediaTapRef.current <= SCENES_DOUBLE_TAP_MS) {
                if (singleMediaTapTimerRef.current) {
                    clearTimeout(singleMediaTapTimerRef.current);
                    singleMediaTapTimerRef.current = null;
                }
                lastMediaTapRef.current = 0;
                const ne = event?.nativeEvent;
                const pageX = typeof ne?.pageX === 'number' ? ne.pageX : windowWidth / 2;
                const pageY = typeof ne?.pageY === 'number' ? ne.pageY : windowHeight / 2;
                fireDoubleTapLikeAt(pageX, pageY);
                return;
            }

            lastMediaTapRef.current = now;
            if (singleMediaTapTimerRef.current) {
                clearTimeout(singleMediaTapTimerRef.current);
            }
            singleMediaTapTimerRef.current = setTimeout(() => {
                handleSingleTapPause();
                singleMediaTapTimerRef.current = null;
            }, SCENES_DOUBLE_TAP_MS + 20);
        },
        [fireDoubleTapLikeAt, handleSingleTapPause, isTextOnlyPost, windowHeight, windowWidth],
    );

    useEffect(() => {
        return () => {
            if (singleMediaTapTimerRef.current) {
                clearTimeout(singleMediaTapTimerRef.current);
            }
            if (burstClearTimerRef.current) {
                clearTimeout(burstClearTimerRef.current);
            }
        };
    }, []);

    const onVerticalPanUpdate = useCallback(
        (translationY: number) => {
            if (commentsOpenRef.current) return;
            if (translationY > 0 && activeIndexRef.current === 0) {
                setDismissPull(Math.min(translationY, windowHeight * 0.45));
            }
        },
        [windowHeight],
    );

    const onVerticalPanEnd = useCallback(
        (translationY: number) => {
            setDismissPull(0);
            if (commentsOpenRef.current) return;
            const threshold = windowHeight * 0.12;
            const idx = activeIndexRef.current;

            if (postsRef.current.length > 1) {
                if (idx === 0 && translationY > threshold) {
                    handleBack();
                    return;
                }
                if (translationY < -threshold && idx < postsRef.current.length - 1) {
                    goToPost(idx + 1);
                } else if (translationY > threshold && idx > 0) {
                    goToPost(idx - 1);
                }
                return;
            }

            if (translationY > threshold) {
                handleBack();
            }
        },
        [goToPost, handleBack, windowHeight],
    );

    const mediaGestures = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetY([-12, 12])
                .failOffsetX([-24, 24])
                .onUpdate((e) => {
                    runOnJS(onVerticalPanUpdate)(e.translationY);
                })
                .onEnd((e) => {
                    runOnJS(onVerticalPanEnd)(e.translationY);
                }),
        [onVerticalPanEnd, onVerticalPanUpdate],
    );

    if (!posts.length || !activePost) {
        return (
            <View style={styles.root}>
                <Pressable
                    style={[styles.backBtn, { top: insets.top + 8 }]}
                    onPress={() => onClose(0, initialPostId, muted)}
                >
                    <Icon name="chevron-back" size={20} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.emptyScenesText}>No playable video for this post.</Text>
            </View>
        );
    }

    const { profileHandle, displayHandle } = getReclipDisplay(activePost, viewerHandle);
    const isOwn =
        !!viewerHandle &&
        viewerHandle.replace(/^@/, '').trim().toLowerCase() ===
            activePost.userHandle.replace(/^@/, '').trim().toLowerCase();
    const commentAccess = resolveCommentComposerAccess(activePost, {
        id: viewerUserId,
        handle: viewerHandle,
    });
    const canReclip = Boolean(viewerHandle && !isOwn && !activePost.userReclipped);
    const authorAvatarSrc = isOwn
        ? viewerAvatarUrl || getAvatarForHandle(profileHandle) || getAvatarForHandle(viewerHandle)
        : getAvatarForHandle(profileHandle);
    const dismissOpacity = Math.max(0.55, 1 - dismissPull / (windowHeight * 0.45));
    const captionLong = caption.length > 50;

    const renderCaptionMentions = (text: string) => {
        const parts = parseStoryMentionParts(text);
        return parts.map((part, i) =>
            part.type === 'mention' ? (
                <Text
                    key={`m-${i}`}
                    style={styles.captionMention}
                    onPress={() => onVisitProfile(`@${part.value}`)}
                >
                    @{part.value}
                </Text>
            ) : (
                <Text key={`t-${i}`}>{part.value}</Text>
            ),
        );
    };

    const showSegmentedProgress =
        activeMediaSlides.length > 1 ||
        activeMediaSlides.some((s) => s.type === 'video' || s.type === 'text');

    return (
        <GestureHandlerRootView style={styles.root}>
            <View
                style={[
                    styles.rootInner,
                    {
                        transform: [{ translateY: dismissPull }],
                        opacity: dismissPull > 0 ? dismissOpacity : 1,
                    },
                ]}
            >
                    <Animated.View style={[styles.mediaLayer, mediaLayerAnimStyle]}>
                        <GestureDetector gesture={mediaGestures}>
                            <View
                                style={[
                                    styles.mediaGestureHost,
                                    mediaCornerRadius > 0
                                        ? { borderRadius: mediaCornerRadius, overflow: 'hidden' }
                                        : null,
                                ]}
                                collapsable={false}
                            >
                                <ScenesMediaPlayer
                                    key={activePost.id}
                                    post={activePost}
                                    isActive
                                    paused={paused}
                                    muted={muted}
                                    volume={muted ? 0 : 1}
                                    width={windowWidth}
                                    height={mediaViewportHeight}
                                    cornerRadius={mediaCornerRadius}
                                    videoRef={videoRef}
                                    onVideoLoad={onVideoLoad}
                                    onVideoProgress={onVideoProgress}
                                    onSlideProgress={setMediaSlideProgress}
                                    onSlideIndexChange={setMediaSlideIndex}
                                    showPauseOverlay
                                    onMediaPress={commentsMounted ? undefined : handleMediaPress}
                                />
                            </View>
                        </GestureDetector>
                    </Animated.View>

            <View style={[styles.progressTrack, { top: insets.top }]} pointerEvents="none">
                {showSegmentedProgress ? (
                    <ScenesMediaProgressBar
                        slides={activeMediaSlides}
                        activeIndex={mediaSlideIndex}
                        videoProgress={mediaSlideProgress || progress}
                        style={styles.progressRowInset}
                    />
                ) : (
                    <View style={styles.singleProgressTrack}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${Math.min(100, (mediaSlideProgress || progress) * 100)}%` },
                            ]}
                        />
                    </View>
                )}
            </View>

            <Pressable style={[styles.backBtn, { top: insets.top + 14 }]} onPress={handleBack}>
                <View style={styles.chromeCircle}>
                    <Icon name="chevron-back" size={18} color="#FFFFFF" />
                </View>
            </Pressable>

            <View style={[styles.topRight, { top: insets.top + 14 }]}>
                {!commentsMounted && metadataItems.length > 0 ? (
                    <View style={styles.metaPill}>
                        <Icon
                            name={metadataIcon(metadataItems[metadataIndex]?.type ?? 'feed')}
                            size={11}
                            color="#FFFFFF"
                        />
                        <Text style={styles.metaPillText} numberOfLines={1}>
                            {metadataItems[metadataIndex]?.label}
                        </Text>
                    </View>
                ) : null}
            </View>

            {!commentsMounted ? (
                <Pressable style={[styles.muteBtn, { top: insets.top + 14 }]} onPress={toggleMute}>
                    <View style={styles.chromeCircle}>
                        <Icon name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#FFFFFF" />
                    </View>
                </Pressable>
            ) : null}

            {!commentsMounted ? (
            <View style={[styles.actionRail, { bottom: insets.bottom + 96 }]}>
                <View style={styles.actionCol}>
                    <View collapsable={false}>
                        <Pressable
                            style={styles.actionBtn}
                            onPress={() => void handleLike()}
                            accessibilityLabel={activePost.userLiked ? 'Unlike' : 'Like'}
                        >
                            <FeedLikeThumbsIcon
                                size={26}
                                color="#FFFFFF"
                                filled={activePost.userLiked}
                            />
                        </Pressable>
                    </View>
                    <Text style={styles.actionCount}>{activePost.stats.likes}</Text>
                </View>
                <View style={styles.actionCol}>
                    <Pressable
                        style={styles.actionBtn}
                        onPress={openComments}
                        accessibilityLabel="Comments"
                    >
                        <Icon name="chatbubble-outline" size={26} color="#FFFFFF" />
                    </Pressable>
                    <Text style={styles.actionCount}>{activePost.stats.comments}</Text>
                </View>
                <View style={styles.actionCol}>
                    <Pressable
                        style={styles.actionBtn}
                        onPress={() => setSharePost(activePost)}
                        accessibilityLabel="Share"
                    >
                        <Icon name="paper-plane-outline" size={26} color="#FFFFFF" />
                    </Pressable>
                    <Text style={styles.actionCount}>{activePost.stats.shares}</Text>
                </View>
                <View style={styles.actionCol}>
                    <Pressable
                        style={styles.actionBtn}
                        onPress={() => setSaveModalOpen(true)}
                        accessibilityLabel="Save to collection"
                    >
                        <Icon
                            name={isSaved ? 'bookmark' : 'bookmark-outline'}
                            size={26}
                            color="#FFFFFF"
                        />
                    </Pressable>
                    <Text style={styles.actionCount}>{isSaved ? 'Saved' : 'Save'}</Text>
                </View>
                <View style={styles.actionCol}>
                    <Pressable
                        style={[styles.actionBtn, !canReclip && styles.actionBtnDisabled]}
                        onPress={() => void handleReclip()}
                        accessibilityLabel={
                            activePost.userReclipped ? 'Already reclipped' : 'Reclip'
                        }
                    >
                        <Icon
                            name="repeat"
                            size={26}
                            color={activePost.userReclipped ? '#4ADE80' : '#FFFFFF'}
                        />
                    </Pressable>
                    <Text style={styles.actionCount}>{activePost.stats.reclips}</Text>
                </View>
            </View>
            ) : null}

            {!commentsMounted ? (
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.72)']}
                locations={[0, 0.4, 1]}
                style={[
                    styles.bottomChrome,
                    { paddingBottom: insets.bottom + 52 },
                ]}
                pointerEvents="box-none"
            >
                <View style={styles.profileRow}>
                    <Pressable
                        style={styles.avatarBtn}
                        onPress={() => onVisitProfile(profileHandle)}
                    >
                        <Avatar
                            src={authorAvatarSrc}
                            name={displayHandle.split('@')[0]}
                            size={36}
                        />
                    </Pressable>
                    {!activePost.isFollowing && !isOwn && !hasPendingRequest ? (
                        <Pressable style={styles.followPlus} onPress={() => void handleFollow()}>
                            <Icon name="add" size={12} color="#FFFFFF" />
                        </Pressable>
                    ) : !activePost.isFollowing && hasPendingRequest && !isOwn ? (
                        <View style={styles.requestedPill}>
                            <Text style={styles.requestedPillText}>Requested</Text>
                        </View>
                    ) : activePost.isFollowing && !isOwn ? (
                        <Pressable
                            style={styles.followingPill}
                            onPress={() => void handleFollow()}
                        >
                            <Text style={styles.followingPillText}>Following</Text>
                        </Pressable>
                    ) : null}
                    <View style={styles.profileTextCol}>
                        <Pressable onPress={() => onVisitProfile(profileHandle)}>
                            <View style={styles.handleWithBadge}>
                                <Text style={styles.handleText} numberOfLines={1}>
                                    {displayHandle.replace(/^@/, '')}
                                </Text>
                                <VerifiedBadge accountType={activePost.userAccountType} size={12} />
                            </View>
                        </Pressable>
                        {activePost.locationLabel ? (
                            <View style={styles.locationRow}>
                                <Icon name="location-outline" size={11} color="rgba(255,255,255,0.75)" />
                                <Text style={styles.locationText} numberOfLines={1}>
                                    {activePost.locationLabel}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
                {activePost.isBoosted ? (
                    <View style={styles.promotedRow}>
                        <PromotedBadge />
                    </View>
                ) : null}
                {caption ? (
                    <View style={styles.captionRow}>
                        <Text style={styles.caption} numberOfLines={2}>
                            {renderCaptionMentions(caption)}
                        </Text>
                        {captionLong ? (
                            <Pressable onPress={openComments} hitSlop={8}>
                                <Text style={styles.captionMore}>more</Text>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
                <Pressable onPress={openComments} style={styles.commentsLink}>
                    <Text style={styles.commentsLinkText}>
                        {!commentAccess.canComment
                            ? commentAccess.message
                            : activePost.stats.comments > 0
                              ? `View all ${activePost.stats.comments} comments`
                              : 'Add a comment…'}
                    </Text>
                </Pressable>
            </LinearGradient>
            ) : null}

            {!commentsMounted ? (
                <ScenesFooterBar
                    bottomInset={insets.bottom}
                    isOwnPost={isOwn}
                    onAddComment={openComments}
                    commentPrompt={commentAccess.canComment ? 'Add a comment…' : commentAccess.message}
                    onDirectMessage={() => void handleDirectMessage()}
                    onMore={() => setOverflowVisible(true)}
                />
            ) : null}

            <View style={styles.fxLayer} pointerEvents="none">
                {burstAt ? (
                    <FeedDoubleTapLikeBurst
                        key={burstKey}
                        x={burstAt.x}
                        y={burstAt.y}
                    />
                ) : null}
            </View>

            {commentsMounted ? (
                <Animated.View style={[styles.commentsDock, commentsDockStyle]}>
                    <PostCommentsSheet
                        variant="scenesEmbed"
                        postId={String(activePost.id)}
                        onCommentCountChange={(pid, count) => {
                            patchPost(String(pid), (p) => ({
                                ...p,
                                comments_count: count,
                                stats: { ...p.stats, comments: count },
                            }));
                        }}
                        post={activePost}
                        isOpen={commentsMounted}
                        commentAuthorHandle={viewerHandle ?? ''}
                        currentUserHandle={viewerHandle}
                        onClose={closeComments}
                    />
                </Animated.View>
            ) : null}

            <PostOverflowMenuModal
                visible={overflowVisible}
                post={activePost}
                viewerUserId={viewerUserId}
                viewerHandle={viewerHandle}
                isSaved={isSaved}
                hasNotifications={overflowNotify}
                onClose={() => setOverflowVisible(false)}
                onShare={async () => {
                    setOverflowVisible(false);
                    setSharePost(activePost);
                }}
                onCopyLink={async () => {
                    const url = buildShareablePostUrl(activePost);
                    const Clipboard = (await import('@react-native-clipboard/clipboard')).default;
                    Clipboard.setString(url);
                    gazetteerAlert('Link copied', 'Post link copied to clipboard.');
                }}
                onCreateGroup={isOwn ? () => setCreateGroupOpen(true) : undefined}
                onInviteToGroup={!isOwn ? () => setInviteGroupHandle(activePost.userHandle) : undefined}
                onShowQRCode={() => setQrPost(activePost)}
                onEdit={isOwn ? () => setEditPost(activePost) : undefined}
                onArchive={async () => {
                    await markFeedPostArchivedMobile(viewerUserId, activePost.id);
                    const next = posts.filter((p) => p.id !== activePost.id);
                    onPostsChange?.(next);
                    if (next.length === 0) onClose();
                    setOverflowVisible(false);
                }}
                onToggleNotifications={async () => {
                    const next = !overflowNotify;
                    await setPostNotificationsPrefMobile(viewerUserId, activePost.id, next);
                    setOverflowNotify(next);
                }}
                onReclip={canReclip ? () => handleReclip() : undefined}
                onMute={async () => {
                    await muteFeedAuthorMobile(viewerUserId, activePost.userHandle);
                    const next = posts.filter((p) => p.userHandle !== activePost.userHandle);
                    onPostsChange?.(next);
                    if (next.length === 0) onClose();
                    gazetteerAlert('Muted', `${activePost.userHandle} was muted.`);
                    setOverflowVisible(false);
                }}
                onBlock={() =>
                    new Promise<void>((resolve) => {
                        if (!viewerHandle) {
                            resolve();
                            return;
                        }
                        gazetteerAlert('Block user?', `Hide ${activePost.userHandle} from your feed?`, [
                            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
                            {
                                text: 'Block',
                                style: 'destructive',
                                onPress: () => {
                                    void (async () => {
                                        await blockUser(viewerHandle, activePost.userHandle);
                                        await blockFeedAuthorMobile(viewerUserId, activePost.userHandle);
                                        const next = posts.filter(
                                            (p) => p.userHandle !== activePost.userHandle,
                                        );
                                        onPostsChange?.(next);
                                        if (next.length === 0) onClose();
                                        setOverflowVisible(false);
                                        resolve();
                                    })();
                                },
                            },
                        ]);
                    })
                }
                onDelete={
                    isOwn
                        ? async () => {
                              setDeleteTargetId(activePost.id);
                          }
                        : undefined
                }
                onOpenSave={() => {
                    setOverflowVisible(false);
                    setSaveModalOpen(true);
                }}
                onSaveToggle={async () => {
                    const cols = await getCollectionsForPost(viewerUserId, activePost.id);
                    setIsSaved(cols.length > 0);
                }}
                onBoost={() => {
                    setOverflowVisible(false);
                    onBoost?.();
                }}
                onUnfollow={async () => {
                    await handleFollow();
                }}
                isFollowing={activePost.isFollowing}
                onHide={async () => {
                    await hideFeedPostMobile(viewerUserId, activePost.id);
                    const next = posts.filter((p) => p.id !== activePost.id);
                    onPostsChange?.(next);
                    if (next.length === 0) onClose();
                    else setActiveIndex((i) => Math.min(i, next.length - 1));
                    setOverflowVisible(false);
                }}
                onNotInterested={async () => {
                    await markNotInterestedFeedPostMobile(viewerUserId, activePost.id);
                    const next = posts.filter((p) => p.id !== activePost.id);
                    onPostsChange?.(next);
                    if (next.length === 0) onClose();
                    setOverflowVisible(false);
                }}
                onReport={async () => {
                    const { promptReportPostNative } = await import('../utils/promptReportPostNative');
                    promptReportPostNative(activePost.id, () => setOverflowVisible(false));
                }}
            />

            <DeletePostConfirmSheet
                visible={deleteTargetId != null}
                onDismiss={() => setDeleteTargetId(null)}
                onConfirm={() => {
                    const targetId = deleteTargetId;
                    setDeleteTargetId(null);
                    if (!targetId || !viewerHandle) return;
                    void (async () => {
                        try {
                            await deletePost(viewerUserId, targetId, viewerHandle);
                            const next = posts.filter((p) => p.id !== targetId);
                            onPostsChange?.(next);
                            if (next.length === 0) onClose();
                        } catch {
                            gazetteerAlert('Error', 'Could not delete this post.');
                        }
                    })();
                }}
            />

            <FeedShareModal
                post={sharePost}
                isOpen={sharePost != null}
                onClose={() => setSharePost(null)}
                onShareSuccess={(postId) => {
                    const next = posts.map((p) =>
                        String(p.id) === String(postId)
                            ? { ...p, stats: { ...p.stats, shares: (p.stats?.shares ?? 0) + 1 } }
                            : p,
                    );
                    onPostsChange?.(next);
                }}
            />

            <SavePostModal
                post={activePost}
                userId={viewerUserId}
                visible={saveModalOpen}
                onClose={() => setSaveModalOpen(false)}
                onSaved={() => {
                    setIsSaved(true);
                }}
            />

            {qrPost ? (
                <QRCodeModal post={qrPost} visible={!!qrPost} onClose={() => setQrPost(null)} />
            ) : null}

            {editPost ? (
                <EditPostModal
                    post={editPost}
                    visible={!!editPost}
                    onClose={() => setEditPost(null)}
                    onSave={async (text, location, venue, landmark) => {
                        patchPost(editPost.id, {
                            text,
                            locationLabel: location,
                            venue: venue || undefined,
                            landmark: landmark || undefined,
                        });
                        setEditPost(null);
                    }}
                />
            ) : null}

            <CreateGroupModal
                visible={createGroupOpen}
                onClose={() => setCreateGroupOpen(false)}
                onCreated={(g) => {
                    setCreateGroupOpen(false);
                    navigation?.navigate('Messages', { chatGroupId: g.id, kind: 'group' });
                }}
            />

            <PickGroupToInviteFeedUserModal
                visible={!!inviteGroupHandle}
                inviteeHandle={inviteGroupHandle || ''}
                onClose={() => setInviteGroupHandle(null)}
            />

            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    rootInner: { flex: 1, backgroundColor: '#000' },
    mediaLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#000',
        overflow: 'hidden',
        zIndex: 10,
    },
    mediaGestureHost: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
        position: 'relative',
    },
    commentsDock: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 40,
        elevation: 16,
        backgroundColor: '#060d16',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    fxLayer: {
        ...StyleSheet.absoluteFill,
        zIndex: 60,
    },
    page: { width: '100%', backgroundColor: '#000' },
    fallback: { ...StyleSheet.absoluteFill, backgroundColor: '#111' },
    progressTrack: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 30,
    },
    progressRowInset: {
        flex: 1,
    },
    singleProgressTrack: {
        height: 2.5,
        marginHorizontal: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.35)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
    },
    footerIconBtn: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.28,
                shadowRadius: 12,
            },
            android: { elevation: 8 },
        }),
    },
    backBtn: {
        position: 'absolute',
        left: 10,
        zIndex: 25,
    },
    emptyScenesText: {
        marginTop: 120,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.65)',
        fontSize: 14,
        paddingHorizontal: 24,
    },
    muteBtn: {
        position: 'absolute',
        right: 10,
        zIndex: 25,
    },
    chromeCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.38)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    topRight: {
        position: 'absolute',
        right: 52,
        zIndex: 25,
        alignItems: 'flex-end',
        gap: 6,
        maxWidth: 160,
    },
    metaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.38)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.18)',
        maxWidth: 160,
    },
    metaPillText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '500',
        flexShrink: 1,
    },
    actionRail: {
        position: 'absolute',
        right: 6,
        zIndex: 28,
        alignItems: 'center',
        gap: 14,
        // Only the icon buttons capture taps — gaps stay swipeable for next post / slide.
        pointerEvents: 'box-none',
    },
    actionCol: {
        alignItems: 'center',
        gap: 3,
        minWidth: 44,
        pointerEvents: 'box-none',
    },
    actionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    actionBtnDisabled: {
        opacity: 0.35,
    },
    actionCount: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    bottomChrome: {
        position: 'absolute',
        left: 0,
        right: 56,
        bottom: 0,
        zIndex: 15,
        paddingHorizontal: 14,
        paddingTop: 56,
        backgroundColor: 'transparent',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarBtn: {
        borderRadius: 999,
        overflow: 'hidden',
    },
    followPlus: {
        marginLeft: -12,
        marginTop: 18,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#0095F6',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        borderWidth: 1.5,
        borderColor: '#000000',
    },
    followingPill: {
        marginLeft: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    followingPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    requestedPill: {
        marginLeft: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    requestedPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    promotedRow: {
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    captionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        marginBottom: 8,
        paddingRight: 4,
    },
    captionMention: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    captionMore: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 4,
    },
    profileTextCol: {
        flex: 1,
        marginLeft: 10,
        minWidth: 0,
    },
    handleText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.1,
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        flexShrink: 1,
    },
    handleWithBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        minWidth: 0,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    locationText: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 11,
        flexShrink: 1,
    },
    caption: {
        flex: 1,
        color: 'rgba(255,255,255,0.96)',
        fontSize: 13,
        lineHeight: 18,
        textShadowColor: 'rgba(0,0,0,0.4)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    commentsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    commentsLinkText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        fontWeight: '500',
    },
    footerRow: {
        position: 'absolute',
        left: 0,
        right: 72,
        bottom: 0,
        zIndex: 50,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    footerIconBtnDisabled: {
        opacity: 0.45,
    },
    addCommentPill: {
        flex: 1,
        minHeight: 44,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        paddingHorizontal: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.28,
                shadowRadius: 12,
            },
            android: { elevation: 8 },
        }),
    },
    addCommentPillText: {
        color: '#111827',
        fontSize: 14,
        fontWeight: '500',
    },
    pauseOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    pauseBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
