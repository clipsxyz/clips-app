import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Dimensions,
    Pressable,
    Platform,
    Alert,
    Modal,
    BackHandler,
    type GestureResponderEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
    cancelAnimation,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { type OnProgressData, type VideoRef } from 'react-native-video';
import type { Post } from '../types';
import { postHasVideoMedia, resolvePostPlaybackUri } from '../utils/postMedia';
import NativePageSwipe from './NativePageSwipe.native';
import { getScenesMediaSlides, scenesVideoSource } from '../utils/scenesMediaNative';
import { androidListSafeVideoProps, isPlayableVideoUri } from '../utils/androidSafeVideoNative';
import { getPostDisplayCaption, getReclipDisplay, buildPostMetadataItems } from '../utils/feedPostMeta';
import { setAvatarForHandle } from '../api/users';
import { useResolvedAuthorAvatar } from '../hooks/useResolvedAuthorAvatar';
import Avatar from './Avatar';
import VerifiedBadge from './VerifiedBadge.native';
import AnimatedLikeButton from './AnimatedLikeButton.native';
import FeedShareModal from './FeedShareModal';
import PostCommentsSheet from './PostCommentsSheet';
import PostOverflowMenuModal from './PostOverflowMenuModal';
import FeedHeartDrop from './FeedHeartDrop.native';
import FeedDoubleTapLikeBurst from './FeedDoubleTapLikeBurst.native';
import SavePostModal from './SavePostModal.native';
import ScenesFooterBar from './ScenesFooterBar.native';
/** Match feed card double-tap window (FeedScreen uses 260ms). */
const SCENES_DOUBLE_TAP_MS = 260;
/** Bluesky-style shared-element morph (open + swipe-to-dismiss). */
const SCENES_MORPH_SPRING = { damping: 20, stiffness: 200, mass: 0.6 } as const;
/** Centered play/pause pill timings — all consumed on the UI thread. */
const PLAY_PAUSE_PILL_HOLD_MS = 400;
const PLAY_PAUSE_PILL_FADE_MS = 200;
const PLAY_PAUSE_PILL_SCALE_MS = 160;
const PLAY_PAUSE_PILL_MIN_SCALE = 0.8;
import QRCodeModal from './QRCodeModal.native';
import EditPostModal from './EditPostModal.native';
import CreateGroupModal from './CreateGroupModal.native';
import PickGroupToInviteFeedUserModal from './PickGroupToInviteFeedUserModal.native';
import ScenesMediaPlayer, { ScenesMediaProgressBar } from './ScenesMediaPlayer.native';
import PostHeaderOverlay from './PostHeaderOverlay.native';
import { applyUniqueSavesCount, getCollectionsForPost } from '../api/collections';
import { buildShareablePostUrl } from '../utils/shareUrls';
import {
    getGlobalVideoMutedNative,
    setGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';
import { setActiveFeedVideoPostId } from '../utils/feedActiveVideoNative';
import { setScenesPlaybackPlayer } from '../utils/feedScenesPlaybackNative';
import { setScenesViewerActive } from '../utils/scenesViewerActiveNative';
import type { ScenesOriginRect } from '../utils/scenesLaunchNative';
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
import { ignoreAbort } from '../utils/abortSafe';

/** Match web ScenesModal comments open ease (~Reels mini viewport). */
const COMMENTS_MEDIA_MS = 640;
const COMMENTS_MEDIA_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const COMMENTS_SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.78);

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

function samePostId(a: unknown, b: unknown): boolean {
    const left = String(a ?? '').trim();
    const right = String(b ?? '').trim();
    return left.length > 0 && left === right;
}

function indexOfPostId(list: Post[], postId: unknown): number {
    return list.findIndex((p) => samePostId(p.id, postId));
}

function ScenesRailAction({
    count,
    disabled,
    label,
    onPress,
    children,
}: {
    count: string | number;
    disabled?: boolean;
    label: string;
    onPress: () => void;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.actionCol}>
            <Pressable
                style={[styles.actionBtn, disabled ? styles.actionBtnDisabled : null]}
                onPress={onPress}
                disabled={disabled}
                accessibilityLabel={label}
            >
                <View style={styles.chromeCircle}>{children}</View>
            </Pressable>
            <Text style={styles.actionCount}>{count}</Text>
        </View>
    );
}

export type ScenesViewerProps = {
    posts: Post[];
    initialPostId: string;
    initialVideoTime?: number;
    initialMuted?: boolean;
    feedLabel?: string;
    originRect?: ScenesOriginRect | null;
    viewerUserId: string;
    viewerHandle?: string;
    /** Auth profile photo — required for own posts (handle map often has no entry yet). */
    viewerAvatarUrl?: string;
    onClose: (savedTime?: number, postId?: string, mutedState?: boolean) => void;
    onVisitProfile: (handle: string) => void;
    onPostsChange?: (posts: Post[]) => void;
    navigation?: { navigate: (route: string, params?: object) => void };
    onBoost?: () => void;
    /**
     * Feed postcard player stays mounted; this viewer is chrome only for the
     * opening post (no second ExoPlayer).
     */
    embedFeedPlayer?: boolean;
    onExternalPausedChange?: (paused: boolean) => void;
};

export default function ScenesViewer({
    posts: postsProp,
    initialPostId,
    initialVideoTime,
    initialMuted,
    feedLabel,
    originRect = null,
    viewerUserId,
    viewerHandle,
    viewerAvatarUrl,
    onClose,
    onVisitProfile,
    onPostsChange,
    navigation,
    onBoost,
    embedFeedPlayer = false,
    onExternalPausedChange,
}: ScenesViewerProps) {
    const insets = useSafeAreaInsets();
    const windowHeight = Dimensions.get('window').height;
    const windowWidth = Dimensions.get('window').width;
    const mediaHeightSv = useSharedValue(windowHeight);
    const enterProgress = useSharedValue(0);
    const originX = useSharedValue(originRect?.x ?? 0);
    const originY = useSharedValue(originRect?.y ?? 0);
    const originW = useSharedValue(originRect?.width ?? windowWidth);
    const originH = useSharedValue(originRect?.height ?? windowHeight);
    const hasOrigin = useSharedValue(
        originRect && originRect.width > 8 && originRect.height > 8 ? 1 : 0,
    );
    const screenW = useSharedValue(windowWidth);
    const screenH = useSharedValue(windowHeight);
    /** Progress at pan begin — UI-thread dismiss morph reads this. */
    const dragStartProgress = useSharedValue(1);

    /**
     * Center play/pause feedback pill.
     *
     * Driven entirely by shared values so tapping the fullscreen video costs no
     * React render: `paused` still has to setState (it is the `Video` prop), but
     * the badge's opacity/scale and its play-vs-pause icon are resolved on the UI
     * thread from these three values alone.
     */
    const playPauseOpacity = useSharedValue(0);
    const playPauseScale = useSharedValue(PLAY_PAUSE_PILL_MIN_SCALE);
    /** 1 => the tap paused the clip (show the pause glyph), 0 => resumed (play glyph). */
    const playPauseIsPaused = useSharedValue(0);

    const closingRef = useRef(false);
    const closedOnceRef = useRef(false);

    // Keep handle→avatar map warm so own + other chrome can resolve the photo.
    useEffect(() => {
        if (viewerHandle && viewerAvatarUrl) {
            setAvatarForHandle(viewerHandle, viewerAvatarUrl);
        }
    }, [viewerHandle, viewerAvatarUrl]);

    // Android Video surfaces ignore overflow clipping — drive the player height explicitly
    // so the MP4 actually becomes a Reels-style mini viewport above the sheet.
    const [mediaViewportHeight, setMediaViewportHeight] = useState(windowHeight);
    const startPostId = String(initialPostId ?? '').trim();
    const posts = useMemo(() => {
        const filtered = postsProp.filter(postHasVideoMedia);
        const tapped =
            postsProp.find((p) => samePostId(p.id, startPostId)) ??
            filtered.find((p) => samePostId(p.id, startPostId));
        if (tapped && indexOfPostId(filtered, startPostId) < 0) {
            return [tapped, ...filtered];
        }
        if (filtered.length > 0) return filtered;
        return tapped ? [tapped] : [];
    }, [postsProp, startPostId]);

    const initialIndex = Math.max(0, indexOfPostId(posts, startPostId));
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const activePost = posts[activeIndex];
    const userMovedFromInitialRef = useRef(false);
    const [muted, setMuted] = useState(initialMuted ?? true);
    const [paused, setPaused] = useState(false);
    /**
     * Tap-to-pause source of truth. The `paused` prop drives the `Video` element, but
     * a prop change only lands on the next commit, so the gesture flips this and hits
     * the native handle directly. Mirrored from React state so the two cannot drift.
     */
    const pausedSv = useSharedValue(false);
    pausedSv.value = paused;
    const [progress, setProgress] = useState(0);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [sharePost, setSharePost] = useState<Post | null>(null);
    const [heartDrop, setHeartDrop] = useState<{ x: number; y: number } | null>(null);
    const [burstAt, setBurstAt] = useState<{ x: number; y: number } | null>(null);
    const [topMetaVisible, setTopMetaVisible] = useState(true);
    const [metadataIndex, setMetadataIndex] = useState(0);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(() => Boolean(activePost?.isBookmarked));
    const [dismissPull, setDismissPull] = useState(0);
    const [mediaSlideProgress, setMediaSlideProgress] = useState(0);
    const [mediaSlideIndex, setMediaSlideIndex] = useState(0);
    const [overflowVisible, setOverflowVisible] = useState(false);
    const [overflowNotify, setOverflowNotify] = useState(false);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [qrPost, setQrPost] = useState<Post | null>(null);
    const [editPost, setEditPost] = useState<Post | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [inviteGroupHandle, setInviteGroupHandle] = useState<string | null>(null);
    const postsRef = useRef(posts);
    const activeIndexRef = useRef(activeIndex);
    const mediaSlideIndexRef = useRef(0);
    const mediaSlidesLenRef = useRef(0);
    activeIndexRef.current = activeIndex;
    postsRef.current = posts;
    const videoRef = useRef<VideoRef>(null);
    const topMetaHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const likeButtonRef = useRef<View>(null);
    const currentTimeRef = useRef(Math.max(0, initialVideoTime ?? 0));
    const timesByPostId = useRef<Map<string, number>>(new Map());
    const didSeekInitialRef = useRef(false);
    /** Resume play after comments only if we were playing when the sheet opened. */
    const wasPlayingBeforeCommentsRef = useRef(true);
    /** Pending seek+unmute after remounting Video when comments close. */
    const commentsResumePendingRef = useRef(false);
    /** Unmount native Video while comments sheet is open (feed suspendNativeVideo parity). */
    const [commentsSuspendVideo, setCommentsSuspendVideo] = useState(false);
    const [commentsAudioLocked, setCommentsAudioLocked] = useState(false);
    const commentsAudioUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const commentsOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMediaTapRef = useRef(0);

    const caption = activePost ? getPostDisplayCaption(activePost) : '';
    const authorAvatarSrc = useResolvedAuthorAvatar({
        handle: activePost
            ? getReclipDisplay(activePost, viewerHandle).profileHandle
            : undefined,
        explicitUrl: activePost?.userAvatarUrl,
        viewerHandle,
        viewerAvatarUrl,
    });
    const metadataItems = useMemo(
        () => (activePost ? buildScenesMetadata(activePost, feedLabel) : []),
        [activePost, feedLabel],
    );

    const patchPost = useCallback(
        (postId: string, patch: Partial<Post> | ((p: Post) => Post)) => {
            const id = String(postId);
            const apply = (p: Post) => {
                if (String(p.id) !== id) return p;
                return typeof patch === 'function' ? patch(p) : { ...p, ...patch };
            };
            const fromProp = postsProp.map(apply);
            const next = fromProp.some((p) => String(p.id) === id)
                ? fromProp
                : posts.map(apply);
            onPostsChange?.(next);
        },
        [onPostsChange, posts, postsProp],
    );

    useEffect(() => {
        screenW.value = windowWidth;
        screenH.value = windowHeight;
    }, [screenH, screenW, windowHeight, windowWidth]);

    useEffect(() => {
        closingRef.current = false;
        closedOnceRef.current = false;
        const rect =
            originRect && originRect.width > 8 && originRect.height > 8 ? originRect : null;
        cancelAnimation(enterProgress);
        if (rect) {
            originX.value = rect.x;
            originY.value = rect.y;
            originW.value = rect.width;
            originH.value = rect.height;
            hasOrigin.value = 1;
            // Start at the thumbnail, then spring to fullscreen (Bluesky shared element).
            enterProgress.value = 0;
            enterProgress.value = withSpring(1, SCENES_MORPH_SPRING);
        } else {
            hasOrigin.value = 0;
            enterProgress.value = 1;
        }
    }, [
        enterProgress,
        hasOrigin,
        originH,
        originRect,
        originW,
        originX,
        originY,
    ]);

    useEffect(() => {
        if (embedFeedPlayer) return;
        setActiveFeedVideoPostId(null);
        setScenesViewerActive(true);
        return () => {
            setScenesViewerActive(false);
        };
    }, [embedFeedPlayer]);

    useEffect(() => {
        if (initialMuted !== undefined) {
            setMuted(initialMuted);
            return;
        }
        let mounted = true;
        ignoreAbort(getGlobalVideoMutedNative().then((m) => {
            if (mounted) setMuted(m);
        }));
        return subscribeGlobalVideoMuted((m) => setMuted(m));
    }, [initialMuted]);

    useEffect(() => {
        if (initialVideoTime != null && initialVideoTime > 0) {
            timesByPostId.current.set(startPostId, initialVideoTime);
            currentTimeRef.current = initialVideoTime;
        }
    }, [initialVideoTime, startPostId]);

    useEffect(() => {
        userMovedFromInitialRef.current = false;
    }, [startPostId]);

    useEffect(() => {
        if (userMovedFromInitialRef.current) return;
        const next = indexOfPostId(posts, startPostId);
        if (next >= 0) setActiveIndex(next);
    }, [posts, startPostId]);

    useEffect(() => {
        didSeekInitialRef.current = false;
        setProgress(0);
        setMediaSlideProgress(0);
        setMediaSlideIndex(0);
        setPaused(false);
        setMetadataIndex(0);
        setTopMetaVisible(true);
        lastMediaTapRef.current = 0;
    }, [activePost?.id]);

    useEffect(() => {
        if (topMetaHideTimerRef.current) {
            clearTimeout(topMetaHideTimerRef.current);
            topMetaHideTimerRef.current = null;
        }
        if (commentsOpen) {
            setTopMetaVisible(true);
            return;
        }
        topMetaHideTimerRef.current = setTimeout(() => {
            setTopMetaVisible(false);
        }, 1600);
        return () => {
            if (topMetaHideTimerRef.current) {
                clearTimeout(topMetaHideTimerRef.current);
                topMetaHideTimerRef.current = null;
            }
        };
    }, [activePost?.id, commentsOpen, paused, muted, metadataIndex]);

    useEffect(() => {
        if (commentsOpen) {
            // Stay paused while comments are open — do not force play (avoids audio races).
            return;
        }
        mediaHeightSv.value = withTiming(windowHeight, {
            duration: COMMENTS_MEDIA_MS,
            easing: COMMENTS_MEDIA_EASE,
        });
    }, [commentsOpen, mediaHeightSv, windowHeight]);

    const applyMediaViewportHeight = useCallback((h: number) => {
        const next = Math.max(1, Math.round(h));
        setMediaViewportHeight((prev) => (prev === next ? prev : next));
    }, []);

    useAnimatedReaction(
        () => Math.round(mediaHeightSv.value),
        (h, prev) => {
            if (h !== prev) {
                runOnJS(applyMediaViewportHeight)(h);
            }
        },
        [applyMediaViewportHeight],
    );

    const mediaLayerAnimStyle = useAnimatedStyle(() => {
        const p = enterProgress.value;
        const sh = Math.max(1, mediaHeightSv.value);
        const sw = Math.max(1, screenW.value);
        if (hasOrigin.value < 1) {
            return {
                position: 'absolute' as const,
                top: 0,
                left: 0,
                width: sw,
                height: sh,
                opacity: 1,
                borderRadius: 0,
                overflow: 'hidden' as const,
            };
        }
        const ow = Math.max(1, originW.value);
        const oh = Math.max(1, originH.value);
        // Thumbnail → fullscreen: size + position. Dragging down shrinks back toward
        // the grid tile; borderRadius settles at 16 like the Passport grid cell.
        return {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width: interpolate(p, [0, 1], [ow, sw]),
            height: interpolate(p, [0, 1], [oh, sh]),
            borderRadius: interpolate(p, [0, 1], [16, 0]),
            overflow: 'hidden' as const,
            transform: [
                { translateX: interpolate(p, [0, 1], [originX.value, 0]) },
                { translateY: interpolate(p, [0, 1], [originY.value, 0]) },
            ],
        };
    });
    const backdropStyle = useAnimatedStyle(() => ({
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        opacity: hasOrigin.value
            ? interpolate(enterProgress.value, [0, 0.55, 1], [0, 0.85, 1])
            : interpolate(enterProgress.value, [0, 1], [0.35, 1]),
    }));
    const chromeFadeStyle = useAnimatedStyle(() => ({
        opacity: hasOrigin.value
            ? interpolate(enterProgress.value, [0.72, 1], [0, 1])
            : 1,
    }));

    const activeMediaSlides = useMemo(
        () => (activePost ? getScenesMediaSlides(activePost) : []),
        [activePost],
    );
    mediaSlideIndexRef.current = mediaSlideIndex;
    mediaSlidesLenRef.current = activeMediaSlides.length;

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
        setIsSaved(Boolean(activePost.isBookmarked));
        let cancelled = false;
        ignoreAbort(getCollectionsForPost(viewerUserId, activePost.id).then((cols) => {
            if (!cancelled) setIsSaved(cols.length > 0);
        }));
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
        ignoreAbort(hasPostNotificationsPrefMobile(viewerUserId, activePost.id).then((on) => {
            if (!cancelled) setOverflowNotify(on);
        }));
        return () => {
            cancelled = true;
        };
    }, [activePost?.id, overflowVisible, viewerUserId]);

    const toggleMute = useCallback(() => {
        const next = !muted;
        setMuted(next);
        void setGlobalVideoMutedNative(next);
    }, [muted]);

    const invokeClose = useCallback(() => {
        if (closedOnceRef.current) return;
        closedOnceRef.current = true;
        closingRef.current = true;
        const post = postsRef.current[activeIndex] ?? posts[activeIndex];
        if (post) {
            onClose(currentTimeRef.current, post.id, muted);
        } else {
            onClose();
        }
    }, [activeIndex, muted, onClose, posts]);

    const markMorphClosing = useCallback(() => {
        closingRef.current = true;
        setDismissPull(0);
    }, []);

    const handleBack = useCallback(() => {
        if (closedOnceRef.current || closingRef.current) return;
        closingRef.current = true;
        setDismissPull(0);
        if (hasOrigin.value < 1) {
            invokeClose();
            return;
        }
        // Spring the card back into the grid tile, then unmount.
        cancelAnimation(enterProgress);
        enterProgress.value = withSpring(0, SCENES_MORPH_SPRING, (finished) => {
            if (finished) {
                runOnJS(invokeClose)();
            }
        });
    }, [enterProgress, hasOrigin, invokeClose]);

    useEffect(() => {
        if (embedFeedPlayer) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBack();
            return true;
        });
        return () => sub.remove();
    }, [embedFeedPlayer, handleBack]);

    const goToPost = useCallback((nextIndex: number) => {
        if (nextIndex < 0 || nextIndex >= posts.length) return;
        setActiveIndex((prev) => {
            if (prev === nextIndex) return prev;
            userMovedFromInitialRef.current = true;
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

        // Comments remount: seek to saved time while still muted/paused, then unlock.
        if (commentsResumePendingRef.current) {
            const t =
                timesByPostId.current.get(activePost.id) ?? currentTimeRef.current ?? 0;
            if (t > 0.05) {
                try {
                    videoRef.current?.seek(t);
                } catch {
                    /* ignore */
                }
                currentTimeRef.current = t;
            }
            commentsResumePendingRef.current = false;
            didSeekInitialRef.current = true;
            if (commentsAudioUnlockTimerRef.current) {
                clearTimeout(commentsAudioUnlockTimerRef.current);
            }
            commentsAudioUnlockTimerRef.current = setTimeout(() => {
                commentsAudioUnlockTimerRef.current = null;
                setCommentsAudioLocked(false);
                if (wasPlayingBeforeCommentsRef.current) {
                    setPaused(false);
                }
            }, 60);
            return;
        }

        if (didSeekInitialRef.current) return;
        const t =
            activeIndex === initialIndex
                ? (initialVideoTime ?? timesByPostId.current.get(activePost.id) ?? 0)
                : (timesByPostId.current.get(activePost.id) ?? 0);
        if (t > 0.05) {
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
        if (activePost) {
            timesByPostId.current.set(activePost.id, currentTimeRef.current);
        }
        wasPlayingBeforeCommentsRef.current = !paused;
        // Immediate hard stop + unmount (feed suspendNativeVideo parity). Delayed
        // unmount left ExoPlayer audio running under the comments Modal.
        setCommentsAudioLocked(true);
        setPaused(true);
        setCommentsSuspendVideo(true);
        setCommentsOpen(true);
    }, [activePost, paused]);

    const closeComments = useCallback(() => {
        if (commentsOpenTimerRef.current) {
            clearTimeout(commentsOpenTimerRef.current);
            commentsOpenTimerRef.current = null;
        }
        if (commentsAudioUnlockTimerRef.current) {
            clearTimeout(commentsAudioUnlockTimerRef.current);
            commentsAudioUnlockTimerRef.current = null;
        }
        setCommentsOpen(false);
        // Remount Video muted+paused; onVideoLoad seeks then unlocks playback.
        commentsResumePendingRef.current = true;
        setPaused(true);
        setCommentsAudioLocked(true);
        setCommentsSuspendVideo(false);
        // Fallback if onLoad is skipped on some OEMs after remount.
        commentsAudioUnlockTimerRef.current = setTimeout(() => {
            if (!commentsResumePendingRef.current) return;
            commentsResumePendingRef.current = false;
            const t = currentTimeRef.current;
            if (t > 0.05) {
                try {
                    videoRef.current?.seek(t);
                } catch {
                    /* ignore */
                }
            }
            setCommentsAudioLocked(false);
            if (wasPlayingBeforeCommentsRef.current) setPaused(false);
        }, 700);
    }, []);

    useEffect(() => {
        return () => {
            if (commentsOpenTimerRef.current) clearTimeout(commentsOpenTimerRef.current);
            if (commentsAudioUnlockTimerRef.current) clearTimeout(commentsAudioUnlockTimerRef.current);
        };
    }, []);

    /**
     * Publish this overlay's ExoPlayer to its own stop-control, NOT to the
     * shared single-player store.
     *
     * `feedActiveVideoNative` is a slot store: `setActiveFeedVideoPostId` halts
     * every registered player on each transition, so registering here would let
     * the feed's scheduler pause the video the user is watching — and with the
     * `paused` prop unchanged, React would not re-assert it. The overlay is a
     * separate native Modal and does not compete for the feed's slot.
     */
    useEffect(() => {
        const node = videoRef as {
            current?: { pause: () => void; setVolume: (n: number) => void } | null;
        };
        let published = false;
        const attach = () => {
            const player = node?.current;
            if (!player || typeof player.pause !== 'function') return false;
            setScenesPlaybackPlayer(player);
            published = true;
            return true;
        };
        // The ref is null until the <Video> commits, so allow one retry frame.
        if (!attach()) requestAnimationFrame(attach);
        return () => {
            if (published) setScenesPlaybackPlayer(null);
        };
    }, []);

    const handleDirectMessage = useCallback(async () => {
        if (!activePost?.userHandle || !viewerHandle || !viewerUserId) {
            Alert.alert('Sign in required', 'Log in to send a direct message.');
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
                Alert.alert(
                    'Follow Request Pending',
                    "This user has a private profile. You have already sent a follow request. Once they accept, you'll be able to send them a message.",
                );
                return;
            }

            Alert.alert(
                'Cannot Send Message',
                'This user has a private profile. You must follow them and have your follow request accepted before you can send them a message.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Request to Follow',
                        onPress: () => {
                            createFollowRequest(viewerHandle, activePost.userHandle);
                            setFollowState(viewerUserId, activePost.userHandle, false);
                            Alert.alert(
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
            Alert.alert('Cannot Message', 'You must follow this user to send a message.');
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
                activePost.isFollowing === true,
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
            Alert.alert('Sign in required', 'Log in to reclip this post.');
            return;
        }
        const norm = (h?: string) => String(h || '').trim().toLowerCase();
        if (norm(activePost.userHandle) === norm(viewerHandle)) {
            Alert.alert('Cannot reclip', "You can't reclip your own post.");
            return;
        }
        if (activePost.userReclipped) return;
        const prevReclips = Number(activePost.stats?.reclips) || 0;
        const nextReclips = prevReclips + 1;
        setReclipState(viewerUserId, activePost.id, true);
        patchPost(activePost.id, {
            userReclipped: true,
            stats: { ...activePost.stats, reclips: nextReclips },
        });
        try {
            const result = await reclipPost(viewerUserId, activePost.id, viewerHandle);
            if (result.originalPost) {
                patchPost(activePost.id, (p) => ({
                    ...p,
                    userReclipped: true,
                    stats: {
                        ...p.stats,
                        reclips: Math.max(
                            Number(result.originalPost?.stats?.reclips) || 0,
                            Number(p.stats?.reclips) || 0,
                            nextReclips,
                        ),
                    },
                }));
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
            Alert.alert('Reclip failed', message);
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

    /**
     * Flash the centered pill for a tap that paused/resumed the clip.
     *
     * Writing `1` before scheduling the fade is deliberate: the second assignment
     * replaces the first, so the badge appears on the very next UI frame and the
     * delayed fade-out is the only animation queued on the value.
     */
    const showPlayPausePill = useCallback((nextPaused: boolean) => {
        playPauseIsPaused.value = nextPaused ? 1 : 0;
        playPauseScale.value = PLAY_PAUSE_PILL_MIN_SCALE;
        playPauseOpacity.value = 1;
        playPauseScale.value = withTiming(1, {
            duration: PLAY_PAUSE_PILL_SCALE_MS,
            easing: Easing.out(Easing.quad),
        });
        playPauseOpacity.value = withDelay(
            PLAY_PAUSE_PILL_HOLD_MS,
            withTiming(0, { duration: PLAY_PAUSE_PILL_FADE_MS }),
        );
    }, []);

    const hidePlayPausePill = useCallback(() => {
        cancelAnimation(playPauseOpacity);
        cancelAnimation(playPauseScale);
        playPauseOpacity.value = 0;
        playPauseScale.value = PLAY_PAUSE_PILL_MIN_SCALE;
    }, []);

    const playPausePillStyle = useAnimatedStyle(() => ({
        opacity: playPauseOpacity.value,
        transform: [{ scale: playPauseScale.value }],
    }));

    // Both glyphs stay mounted; the crossfade is a pure UI-thread multiply, so the
    // icon never needs a JS render to switch between play and pause.
    const playPausePlayGlyphStyle = useAnimatedStyle(() => ({
        opacity: playPauseOpacity.value * (1 - playPauseIsPaused.value),
    }));
    const playPausePauseGlyphStyle = useAnimatedStyle(() => ({
        opacity: playPauseOpacity.value * playPauseIsPaused.value,
    }));

    // A pill left fading over a newly swiped-to post would claim the wrong state.
    useEffect(() => {
        hidePlayPausePill();
    }, [activePost?.id, hidePlayPausePill]);

    const handleSingleTapPause = useCallback(() => {
        setTopMetaVisible(true);
        const slide = activeMediaSlides[mediaSlideIndex];
        if (!(slide?.type === 'video' || postHasVideoMedia(activePost))) return;
        const next = !pausedSv.value;
        pausedSv.value = next;
        setPaused(next);
        // Drive ExoPlayer now. Waiting for the `paused` prop to round-trip leaves the
        // player running (or frozen) for a frame behind what the pill already shows.
        try {
            if (next) videoRef.current?.pause?.();
            else videoRef.current?.resume?.();
        } catch {
            /* player already released */
        }
        showPlayPausePill(next);
    }, [activeMediaSlides, activePost, mediaSlideIndex, pausedSv, showPlayPausePill]);

    const fireDoubleTapLikeAt = useCallback(
        (pageX: number, pageY: number) => {
            if (isTextOnlyPost) return;
            setTopMetaVisible(true);
            setBurstAt({ x: pageX, y: pageY });
            setHeartDrop({ x: pageX, y: pageY });
            if (!activePost?.userLiked) {
                void handleLike();
            }
        },
        [activePost?.userLiked, handleLike, isTextOnlyPost],
    );

    const handleMediaPress = useCallback(
        (event?: GestureResponderEvent) => {
            if (isTextOnlyPost) return;
            setTopMetaVisible(true);

            const now = Date.now();
            const isDoubleTap = now - lastMediaTapRef.current <= SCENES_DOUBLE_TAP_MS;
            // Toggle immediately. The previous version waited out the whole
            // double-tap window before pausing, which read as a dead tap.
            handleSingleTapPause();
            if (isDoubleTap) {
                // Second tap already re-toggled the pause above (net zero), so this
                // is purely the like burst.
                lastMediaTapRef.current = 0;
                const ne = event?.nativeEvent;
                const pageX = typeof ne?.pageX === 'number' ? ne.pageX : windowWidth / 2;
                const pageY = typeof ne?.pageY === 'number' ? ne.pageY : windowHeight / 2;
                fireDoubleTapLikeAt(pageX, pageY);
                return;
            }
            lastMediaTapRef.current = now;
        },
        [fireDoubleTapLikeAt, handleSingleTapPause, isTextOnlyPost, windowHeight, windowWidth],
    );

    /**
     * Single-tap surface for the single-slide branch. A real `Pressable` is used
     * instead of relying on the RNGH tap recognizer alone: on some ColorOS builds the
     * gesture handler over a bare `View` never receives the centre tap, while a
     * `Pressable` is a guaranteed touch target. Double-tap-like stays on the UI
     * thread via `mediaGestures`; the second press toggles the pause straight back
     * out, so a double tap ends up play/pause-neutral.
     */
    const handleMediaSurfacePress = useCallback(() => {
        if (isTextOnlyPost) return;
        handleSingleTapPause();
    }, [handleSingleTapPause, isTextOnlyPost]);

    useEffect(() => {
        return () => {
            if (topMetaHideTimerRef.current) {
                clearTimeout(topMetaHideTimerRef.current);
            }
        };
    }, []);

    const onVerticalPanUpdate = useCallback(
        (translationY: number) => {
            if (closingRef.current) return;
            if (translationY > 0 && activeIndexRef.current === 0) {
                setDismissPull(Math.min(translationY, windowHeight * 0.45));
            }
        },
        [windowHeight],
    );

    const onVerticalPanEnd = useCallback(
        (translationY: number) => {
            if (closingRef.current) return;
            setDismissPull(0);
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

    const commitCarouselIndex = useCallback((next: number) => {
        if (closingRef.current) return;
        const len = mediaSlidesLenRef.current;
        const clamped = Math.max(0, Math.min(next, Math.max(0, len - 1)));
        if (clamped === mediaSlideIndexRef.current) return;
        didSeekInitialRef.current = false;
        setProgress(0);
        setMediaSlideProgress(0);
        setPaused(false);
        setMediaSlideIndex(clamped);
    }, []);

    const mediaGestures = useMemo(() => {
        // Only the double tap and the vertical pan live here. Single tap is handled by
        // a real `Pressable` (`handleMediaSurfacePress`) so the centre tap always
        // registers; keeping it in both places would toggle pause twice per tap.
        const doubleTap = Gesture.Tap()
            .enabled(!commentsOpen)
            .numberOfTaps(2)
            .maxDuration(420)
            .maxDistance(36)
            .onEnd((e, success) => {
                'worklet';
                if (!success) return;
                runOnJS(fireDoubleTapLikeAt)(e.absoluteX, e.absoluteY);
            });
        const vertical = Gesture.Pan()
            .enabled(!commentsOpen)
            .activeOffsetY([-16, 16])
            .failOffsetX([-28, 28])
            .onBegin(() => {
                'worklet';
                dragStartProgress.value = enterProgress.value;
            })
            .onUpdate((e) => {
                'worklet';
                // Profile / shared-element open: drag down shrinks toward the tile.
                if (hasOrigin.value >= 1 && e.translationY > 0) {
                    const travel = Math.max(1, screenH.value * 0.5);
                    const next = dragStartProgress.value - e.translationY / travel;
                    enterProgress.value = next < 0 ? 0 : next > 1 ? 1 : next;
                    return;
                }
                runOnJS(onVerticalPanUpdate)(e.translationY);
            })
            .onEnd((e) => {
                'worklet';
                if (hasOrigin.value >= 1) {
                    const shouldDismiss =
                        enterProgress.value < 0.55 || e.velocityY > 800;
                    if (shouldDismiss) {
                        runOnJS(markMorphClosing)();
                        enterProgress.value = withSpring(0, SCENES_MORPH_SPRING, (finished) => {
                            if (finished) {
                                runOnJS(invokeClose)();
                            }
                        });
                    } else {
                        enterProgress.value = withSpring(1, SCENES_MORPH_SPRING);
                    }
                    return;
                }
                runOnJS(onVerticalPanEnd)(e.translationY);
            });
        return Gesture.Simultaneous(doubleTap, vertical);
    }, [
        commentsOpen,
        dragStartProgress,
        enterProgress,
        fireDoubleTapLikeAt,
        hasOrigin,
        invokeClose,
        markMorphClosing,
        onVerticalPanEnd,
        onVerticalPanUpdate,
        screenH,
    ]);

    const hideEmbeddedPlayer = embedFeedPlayer && activeIndex === initialIndex;

    useEffect(() => {
        onExternalPausedChange?.(
            hideEmbeddedPlayer
                ? paused || commentsOpen || commentsAudioLocked
                : true,
        );
    }, [
        commentsAudioLocked,
        commentsOpen,
        hideEmbeddedPlayer,
        onExternalPausedChange,
        paused,
    ]);

    if (!posts.length || !activePost) {
        return (
            <View style={[styles.root, styles.emptyRoot]}>
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
    const canReclip = Boolean(viewerHandle && !isOwn && !activePost.userReclipped);
    const dismissOpacity = Math.max(0.55, 1 - dismissPull / (windowHeight * 0.45));
    const captionLong = caption.length > 50;
    const likesCount = Math.max(0, Number(activePost.stats?.likes) || 0);
    const commentsCount = Math.max(0, Number(activePost.stats?.comments) || 0);
    const sharesCount = Math.max(0, Number(activePost.stats?.shares) || 0);
    const reclipsCount = Math.max(
        0,
        Number(activePost.stats?.reclips) || 0,
        activePost.userReclipped ? 1 : 0,
    );
    const savesCount = Math.max(
        0,
        Number(activePost.stats?.saves) || 0,
        isSaved || activePost.isBookmarked ? 1 : 0,
    );
    const isLiked = activePost.userLiked === true;

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

    const activeSlide = activeMediaSlides[mediaSlideIndex];
    const playbackRaw =
        activeSlide?.url ||
        resolvePostPlaybackUri(activePost) ||
        activePost.mediaUrl ||
        '';
    const nextPost = posts[activeIndex + 1];
    const nextPlaybackRaw = nextPost
        ? resolvePostPlaybackUri(nextPost) || nextPost.mediaUrl || ''
        : '';
    const nextPlaybackSrc = nextPlaybackRaw ? scenesVideoSource(nextPlaybackRaw) : null;
    const nextPlaybackSource =
        nextPlaybackSrc &&
        typeof nextPlaybackSrc !== 'number' &&
        isPlayableVideoUri(nextPlaybackSrc.uri) &&
        nextPlaybackRaw !== playbackRaw
            ? nextPlaybackSrc
            : null;

    const playbackSrc = playbackRaw ? scenesVideoSource(playbackRaw) : null;
    const playbackSource =
        typeof playbackSrc === 'number'
            ? playbackSrc
            : playbackSrc && isPlayableVideoUri(playbackSrc.uri)
              ? playbackSrc
              : null;
    const showImageSlide = activeSlide?.type === 'image' && Boolean(activeSlide.url);
    const showVideoSlide =
        !showImageSlide &&
        activeSlide?.type !== 'text' &&
        !hideEmbeddedPlayer &&
        !commentsSuspendVideo &&
        Boolean(playbackSource);

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Animated.View style={backdropStyle} pointerEvents="none" />
            <Animated.View
                style={[
                    { backgroundColor: '#000000' },
                    mediaLayerAnimStyle,
                    dismissPull > 0 &&
                    !(originRect && originRect.width > 8 && originRect.height > 8)
                        ? { transform: [{ translateY: dismissPull }], opacity: dismissOpacity }
                        : null,
                ]}
            >
                {activeMediaSlides.length > 1 ? (
                            <NativePageSwipe
                                pageCount={activeMediaSlides.length}
                                pageWidth={windowWidth}
                                pageHeight={windowHeight}
                                index={mediaSlideIndex}
                                onIndexChange={commitCarouselIndex}
                                onTap={handleMediaPress}
                                enabled={!commentsOpen}
                            >
                                {activeMediaSlides.map((slide, index) => {
                                    const isActiveSlide = index === mediaSlideIndex;
                                    const slideVideo =
                                        slide.type === 'video' &&
                                        isActiveSlide &&
                                        !hideEmbeddedPlayer &&
                                        !commentsSuspendVideo &&
                                        playbackSource;
                                    return (
                                        <View
                                            key={`${activePost.id}-slide-${index}`}
                                            collapsable={false}
                                            style={{ width: windowWidth, height: windowHeight }}
                                        >
                                            {slide.type === 'image' && slide.url ? (
                                                <Image
                                                    source={{ uri: slide.url }}
                                                    resizeMode="cover"
                                                    pointerEvents="none"
                                                    style={{ width: windowWidth, height: windowHeight }}
                                                />
                                            ) : slideVideo ? (
                                                <Video
                                                    ref={videoRef}
                                                    source={playbackSource as object}
                                                    style={{ width: windowWidth, height: windowHeight }}
                                                    resizeMode="cover"
                                                    repeat
                                                    paused={paused || commentsOpen || commentsAudioLocked}
                                                    muted={muted || commentsOpen || commentsAudioLocked}
                                                    volume={
                                                        muted || commentsOpen || commentsAudioLocked ? 0 : 1
                                                    }
                                                    pointerEvents="none"
                                                    onLoad={onVideoLoad}
                                                    onProgress={onVideoProgress}
                                                    {...androidListSafeVideoProps()}
                                                    useTextureView
                                                    hideShutterView
                                                    shutterColor="transparent"
                                                />
                                            ) : slide.posterUrl ? (
                                                <Image
                                                    source={{ uri: slide.posterUrl }}
                                                    resizeMode="cover"
                                                    pointerEvents="none"
                                                    style={{ width: windowWidth, height: windowHeight }}
                                                />
                                            ) : (
                                                <View
                                                    style={{
                                                        width: windowWidth,
                                                        height: windowHeight,
                                                        backgroundColor: '#000000',
                                                    }}
                                                />
                                            )}
                                        </View>
                                    );
                                })}
                            </NativePageSwipe>
                        ) : (
                <GestureDetector gesture={mediaGestures}>
                    <View
                        collapsable={false}
                        style={{ width: windowWidth, height: windowHeight }}
                    >
                    <Pressable
                        // Single-tap play/pause. `Pressable` is the reliable touch
                        // target; the gesture layer above only adds double-tap + pan.
                        onPress={handleMediaSurfacePress}
                        style={StyleSheet.absoluteFill}
                    >
                    {showImageSlide ? (
                            <Image
                                source={{ uri: activeSlide!.url }}
                                resizeMode="cover"
                                pointerEvents="none"
                                style={{ width: windowWidth, height: windowHeight }}
                            />
                        ) : showVideoSlide ? (
                            <Video
                                ref={videoRef}
                                source={playbackSource as object}
                                style={{ width: windowWidth, height: windowHeight }}
                                resizeMode="cover"
                                repeat
                                paused={paused || commentsOpen || commentsAudioLocked}
                                muted={muted || commentsOpen || commentsAudioLocked}
                                volume={
                                    muted || commentsOpen || commentsAudioLocked ? 0 : 1
                                }
                                pointerEvents="none"
                                onLoad={onVideoLoad}
                                onProgress={onVideoProgress}
                                {...androidListSafeVideoProps()}
                                useTextureView
                                hideShutterView
                                shutterColor="transparent"
                            />
                        ) : null}
                    </Pressable>
                    </View>
                </GestureDetector>
                )}

            {nextPlaybackSource ? (
                <Video
                    source={nextPlaybackSource}
                    style={styles.preloadSlot}
                    resizeMode="cover"
                    paused
                    muted
                    volume={0}
                    repeat={false}
                    pointerEvents="none"
                    playInBackground={false}
                    playWhenInactive={false}
                    {...androidListSafeVideoProps()}
                    useTextureView
                    hideShutterView
                    shutterColor="transparent"
                />
            ) : null}

            <Animated.View
                pointerEvents="box-none"
                style={[
                    {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: windowWidth,
                        backgroundColor: 'transparent',
                    },
                    chromeFadeStyle,
                ]}
            >
            <View
                pointerEvents="box-none"
                style={{
                    backgroundColor: 'transparent',
                    paddingTop: insets.top,
                }}
            >
            <View style={[styles.topHeader, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
                <Pressable onPress={handleBack} hitSlop={8}>
                    <View style={styles.chromeCircle}>
                        <Icon name="chevron-back" size={18} color="#FFFFFF" />
                    </View>
                </Pressable>
                <View style={[styles.topHeaderCenter, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
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
                {!commentsOpen ? (
                    <Pressable onPress={toggleMute} hitSlop={8}>
                        <View style={styles.chromeCircle}>
                            <Icon name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#FFFFFF" />
                        </View>
                    </Pressable>
                ) : (
                    <View style={styles.chromeCircle} />
                )}
            </View>
            {activePost && !commentsOpen ? (
                <View style={styles.metaUnderProgress} pointerEvents="box-none">
                    <PostHeaderOverlay dock="inline" post={activePost} />
                </View>
            ) : null}
            </View>
            </Animated.View>

            {!commentsOpen ? (
            <Animated.View
                pointerEvents="box-none"
                style={[
                    {
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        width: windowWidth,
                        backgroundColor: 'transparent',
                        paddingBottom: insets.bottom,
                    },
                    chromeFadeStyle,
                ]}
            >
            <View style={[styles.bottomBlock, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
                <View style={[styles.bottomRow, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
                    <View style={[styles.captionCol, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
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
                    </View>
                    <View style={[styles.actionRail, { backgroundColor: 'transparent' }]} pointerEvents="box-none" collapsable={false}>
                        <View ref={likeButtonRef} collapsable={false} style={styles.actionCol}>
                            <View style={styles.chromeCircle}>
                                <AnimatedLikeButton
                                    isLiked={isLiked}
                                    onToggleLike={() => void handleLike()}
                                    likeCount={likesCount}
                                    size={22}
                                    color="#FFFFFF"
                                    showCount={false}
                                />
                            </View>
                            <Text style={styles.actionCount}>{likesCount}</Text>
                        </View>
                        <ScenesRailAction
                            count={commentsCount}
                            label="Comments"
                            onPress={openComments}
                        >
                            <Icon name="chatbubble-outline" size={20} color="#FFFFFF" />
                        </ScenesRailAction>
                        <ScenesRailAction
                            count={sharesCount}
                            label="Share"
                            onPress={() => setSharePost(activePost)}
                        >
                            <Icon name="paper-plane-outline" size={20} color="#FFFFFF" />
                        </ScenesRailAction>
                        <ScenesRailAction
                            count={savesCount}
                            label="Save to collection"
                            onPress={() => setSaveModalOpen(true)}
                        >
                            <Icon
                                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                                size={20}
                                color="#FFFFFF"
                            />
                        </ScenesRailAction>
                        <ScenesRailAction
                            count={reclipsCount}
                            disabled={!canReclip}
                            label={activePost.userReclipped ? 'Already reclipped' : 'Reclip'}
                            onPress={() => void handleReclip()}
                        >
                            <Icon
                                name="repeat"
                                size={20}
                                color={activePost.userReclipped ? '#4ADE80' : '#FFFFFF'}
                            />
                        </ScenesRailAction>
                    </View>
                </View>
                <ScenesFooterBar
                    bottomInset={0}
                    isOwnPost={isOwn}
                    onAddComment={openComments}
                    onDirectMessage={() => void handleDirectMessage()}
                    onMore={() => setOverflowVisible(true)}
                />
            </View>
            </Animated.View>
            ) : null}

            <View style={[styles.fxLayer, { backgroundColor: 'transparent' }]} pointerEvents="none">
                {/* Center play/pause feedback. The outer layer only centres; the badge
                    carries the animated opacity/scale so the full-screen layer is
                    never transformed. */}
                <View style={styles.playPausePillLayer} pointerEvents="none">
                    <Animated.View style={[styles.playPausePill, playPausePillStyle]}>
                        <Animated.View style={[styles.playPauseGlyph, playPausePlayGlyphStyle]}>
                            <Icon name="play" size={30} color="#FFFFFF" />
                        </Animated.View>
                        <Animated.View style={[styles.playPauseGlyph, playPausePauseGlyphStyle]}>
                            <Icon name="pause" size={30} color="#FFFFFF" />
                        </Animated.View>
                    </Animated.View>
                </View>

                {burstAt ? (
                    <FeedDoubleTapLikeBurst
                        x={burstAt?.x ?? 0}
                        y={burstAt?.y ?? 0}
                        onDone={() => setBurstAt(null)}
                    />
                ) : null}

                <FeedHeartDrop
                    visible={heartDrop != null}
                    startX={heartDrop?.x ?? 0}
                    startY={heartDrop?.y ?? 0}
                    targetRef={likeButtonRef}
                    onComplete={() => setHeartDrop(null)}
                />
            </View>

            {/* Modal (same as feed) — absolute Reels dock + adjustResize was crushing
                the sheet to blank when the keyboard opened on Android OEMs. */}
            {commentsOpen ? (
                <Modal
                    visible
                    transparent
                    animationType="slide"
                    statusBarTranslucent
                    onRequestClose={closeComments}
                >
                    <View style={styles.commentsModalRoot}>
                        <Pressable
                            style={styles.commentsModalBackdrop}
                            onPress={closeComments}
                            accessibilityLabel="Dismiss comments"
                        />
                        <View style={styles.commentsModalSheet}>
                            <PostCommentsSheet
                                variant="scenesEmbed"
                                postId={activePost.id}
                                post={activePost}
                                isOpen={commentsOpen}
                                commentAuthorHandle={viewerHandle ?? ''}
                                currentUserHandle={viewerHandle}
                                onClose={closeComments}
                                onCommentCountChange={(n) => {
                                    patchPost(activePost.id, (p) => ({
                                        ...p,
                                        stats: { ...p.stats, comments: Math.max(0, n) },
                                    }));
                                }}
                            />
                        </View>
                    </View>
                </Modal>
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
                    Alert.alert('Link copied', 'Post link copied to clipboard.');
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
                    Alert.alert('Muted', `${activePost.userHandle} was muted.`);
                    setOverflowVisible(false);
                }}
                onBlock={() =>
                    new Promise<void>((resolve) => {
                        if (!viewerHandle) {
                            resolve();
                            return;
                        }
                        Alert.alert('Block user?', `Hide ${activePost.userHandle} from your feed?`, [
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
                        ? () =>
                              new Promise<void>((resolve) => {
                                  Alert.alert('Delete post?', 'This cannot be undone.', [
                                      { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
                                      {
                                          text: 'Delete',
                                          style: 'destructive',
                                          onPress: () => {
                                              void (async () => {
                                                  try {
                                                      await deletePost(
                                                          viewerUserId,
                                                          activePost.id,
                                                          viewerHandle!,
                                                      );
                                                      const next = posts.filter(
                                                          (p) => p.id !== activePost.id,
                                                      );
                                                      onPostsChange?.(next);
                                                      if (next.length === 0) onClose();
                                                  } catch {
                                                      Alert.alert('Error', 'Could not delete this post.');
                                                  } finally {
                                                      setOverflowVisible(false);
                                                      resolve();
                                                  }
                                              })();
                                          },
                                      },
                                  ]);
                              })
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
                onSaved={async (detail) => {
                    const cols = await getCollectionsForPost(viewerUserId, activePost.id);
                    const saved = cols.length > 0;
                    setIsSaved(saved);
                    patchPost(activePost.id, (p) => {
                        const was = p.isBookmarked === true;
                        const prev = Number(p.stats?.saves) || 0;
                        return {
                            ...p,
                            isBookmarked: saved,
                            stats: {
                                ...p.stats,
                                saves: applyUniqueSavesCount(prev, was, saved, detail?.savesCount),
                            },
                        };
                    });
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

            </Animated.View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000000' },
    /** Tiny but non-zero so ExoPlayer attaches and fills the shared disk cache. */
    preloadSlot: {
        position: 'absolute',
        width: 2,
        height: 2,
        left: -8,
        top: 0,
        opacity: 0,
    },
    emptyRoot: { backgroundColor: '#000000' },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8,
        paddingHorizontal: 16,
    },
    topHeaderCenter: {
        flex: 1,
        marginHorizontal: 12,
        justifyContent: 'center',
    },
    metaUnderProgress: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        paddingHorizontal: 24,
    },
    bottomBlock: {
        width: '100%',
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
    },
    captionCol: {
        flex: 1,
        paddingRight: 8,
        paddingBottom: 4,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
    },
    rootInner: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
    },
    chromeLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 0,
        backgroundColor: 'transparent',
    },
    mediaLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        zIndex: 1,
    },
    mediaLayerClear: {
        backgroundColor: 'transparent',
    },
    embedHitFill: {
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
    },
    mediaGestureHost: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        position: 'relative',
    },
    commentsVideoCover: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#121212',
        zIndex: 4,
        elevation: Platform.OS === 'android' ? 4 : 0,
    },
    fxLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 60,
    },
    playPausePillLayer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPausePill: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPauseGlyph: {
        position: 'absolute',
    },
    page: { width: '100%', backgroundColor: '#000' },
    fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111' },
    progressTrack: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 8,
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
        top: 8,
        zIndex: 9999,
        elevation: Platform.OS === 'android' ? 24 : 0,
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
        top: 8,
        zIndex: 9999,
        elevation: Platform.OS === 'android' ? 24 : 0,
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
        top: 8,
        zIndex: 25,
        alignItems: 'flex-end',
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
        alignItems: 'center',
        paddingBottom: 4,
        paddingLeft: 4,
    },
    actionCol: {
        alignItems: 'center',
        marginBottom: 14,
        minWidth: 44,
    },
    actionBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerDock: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: Platform.OS === 'android' ? 24 : 0,
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
        zIndex: 9999,
        elevation: Platform.OS === 'android' ? 20 : 0,
        paddingHorizontal: 14,
        paddingTop: 32,
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
    commentsModalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'transparent',
    },
    commentsModalBackdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    commentsModalSheet: {
        height: COMMENTS_SHEET_HEIGHT,
        backgroundColor: 'transparent',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
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
