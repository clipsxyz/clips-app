import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Pressable,
    Platform,
    Alert,
    type GestureResponderEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { type OnProgressData, type VideoRef } from 'react-native-video';
import type { Post } from '../types';
import { postHasVideoMedia } from '../utils/postMedia';
import { getScenesMediaSlides } from '../utils/scenesMediaNative';
import { getPostDisplayCaption, getReclipDisplay } from '../utils/feedPostMeta';
import { buildPostMetadataItems } from '../utils/feedPostMeta';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import Avatar from './Avatar';
import Flag from './Flag.native';
import FeedLikeThumbsIcon from './FeedLikeThumbsIcon.native';
import FeedShareModal from './FeedShareModal';
import PostCommentsSheet from './PostCommentsSheet';
import PostOverflowMenuModal from './PostOverflowMenuModal';
import FeedHeartDrop from './FeedHeartDrop.native';
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
import ScenesCommentsPanel from './ScenesCommentsPanel.native';
import ScenesProfileAvatarRing from './ScenesProfileAvatarRing.native';
import { getCollectionsForPost } from '../api/collections';
import { buildShareablePostUrl } from '../utils/shareUrls';
import {
    getGlobalVideoMutedNative,
    setGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';
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

const COMMENTS_PREVIEW_FRACTION = 0.4;

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
    onClose,
    onVisitProfile,
    onPostsChange,
    navigation,
    onBoost,
}: ScenesViewerProps) {
    const insets = useSafeAreaInsets();
    const windowHeight = Dimensions.get('window').height;
    const windowWidth = Dimensions.get('window').width;
    const commentsPreviewHeight = Math.round(windowHeight * COMMENTS_PREVIEW_FRACTION);
    const posts = useMemo(() => postsProp.filter(postHasVideoMedia), [postsProp]);

    const initialIndex = Math.max(0, posts.findIndex((p) => p.id === initialPostId));
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [muted, setMuted] = useState(initialMuted ?? true);
    const [paused, setPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [sharePost, setSharePost] = useState<Post | null>(null);
    const [heartDrop, setHeartDrop] = useState<{ x: number; y: number } | null>(null);
    const [burstAt, setBurstAt] = useState<{ x: number; y: number } | null>(null);
    const [topMetaVisible, setTopMetaVisible] = useState(true);
    const [metadataIndex, setMetadataIndex] = useState(0);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [dismissPull, setDismissPull] = useState(0);
    const [sheetTop, setSheetTop] = useState(commentsPreviewHeight);
    const [mediaSlideProgress, setMediaSlideProgress] = useState(0);
    const [mediaSlideIndex, setMediaSlideIndex] = useState(0);
    const [overflowVisible, setOverflowVisible] = useState(false);
    const [overflowNotify, setOverflowNotify] = useState(false);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [qrPost, setQrPost] = useState<Post | null>(null);
    const [editPost, setEditPost] = useState<Post | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [inviteGroupHandle, setInviteGroupHandle] = useState<string | null>(null);
    const [lastTapDebug, setLastTapDebug] = useState<string | null>(null);
    const postsRef = useRef(posts);
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;
    postsRef.current = posts;
    const videoRef = useRef<VideoRef>(null);
    const topMetaHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const likeButtonRef = useRef<View>(null);
    const currentTimeRef = useRef(0);
    const timesByPostId = useRef<Map<string, number>>(new Map());
    const didSeekInitialRef = useRef(false);
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
                if (p.id !== postId) return p;
                return typeof patch === 'function' ? patch(p) : { ...p, ...patch };
            });
            onPostsChange?.(next);
        },
        [onPostsChange, postsProp],
    );

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
        setTopMetaVisible(true);
        lastMediaTapRef.current = 0;
        if (singleMediaTapTimerRef.current) {
            clearTimeout(singleMediaTapTimerRef.current);
            singleMediaTapTimerRef.current = null;
        }
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
            setSheetTop(commentsPreviewHeight);
            setPaused(false);
        }
    }, [commentsOpen, commentsPreviewHeight]);

    const activeMediaSlides = useMemo(
        () => (activePost ? getScenesMediaSlides(activePost) : []),
        [activePost],
    );

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
        setMuted((prev) => {
            const next = !prev;
            void setGlobalVideoMutedNative(next);
            return next;
        });
    }, []);

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
        if (didSeekInitialRef.current || !activePost) return;
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
        setSheetTop(commentsPreviewHeight);
        setCommentsOpen(true);
    }, [commentsPreviewHeight]);

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
            patchPost(activePost.id, () => updated);
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
            const updated = await toggleFollowForPost(viewerUserId, activePost.id, activePost.userHandle, viewerHandle);
            patchPost(activePost.id, () => updated);
            setHasPendingRequest(
                !updated?.isFollowing &&
                    isProfilePrivate(activePost.userHandle) &&
                    hasPendingFollowRequest(viewerHandle, activePost.userHandle),
            );
        } catch (err) {
            console.warn('Follow failed in Scenes:', err);
        }
    }, [activePost, patchPost, viewerHandle, viewerUserId]);

    const handleReclip = useCallback(async () => {
        if (!activePost || !viewerHandle) return;
        const norm = (h?: string) => String(h || '').trim().toLowerCase();
        if (norm(activePost.userHandle) === norm(viewerHandle)) return;
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
            if (result.originalPost) {
                patchPost(activePost.id, result.originalPost);
            }
        } catch (err) {
            console.warn('Reclip failed in Scenes:', err);
            setReclipState(viewerUserId, activePost.id, false);
            patchPost(activePost.id, {
                userReclipped: false,
                stats: { ...activePost.stats, reclips: prevReclips },
            });
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
            setLastTapDebug(`tap @ ${new Date().toLocaleTimeString()}`);

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
            if (topMetaHideTimerRef.current) {
                clearTimeout(topMetaHideTimerRef.current);
            }
        };
    }, []);

    const onVerticalPanUpdate = useCallback(
        (translationY: number) => {
            if (translationY > 0 && activeIndexRef.current === 0) {
                setDismissPull(Math.min(translationY, windowHeight * 0.45));
            }
        },
        [windowHeight],
    );

    const onVerticalPanEnd = useCallback(
        (translationY: number) => {
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

    const pageHeight = commentsOpen ? commentsPreviewHeight : windowHeight;

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
                <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => onClose()}>
                    <Icon name="chevron-back" size={20} color="#FFFFFF" />
                </Pressable>
            </View>
        );
    }

    const { profileHandle, displayHandle } = getReclipDisplay(activePost, viewerHandle);
    const isOwn = viewerHandle === activePost.userHandle;
    const canReclip = Boolean(viewerHandle && !isOwn && !activePost.userReclipped);
    const dismissOpacity = Math.max(0.55, 1 - dismissPull / (windowHeight * 0.45));
    const railBottom = commentsOpen
        ? Math.max(insets.bottom + 16, windowHeight - sheetTop + 20)
        : insets.bottom + 108;
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
                    <View style={styles.mediaLayer}>
                        {!commentsOpen ? (
                            <GestureDetector gesture={mediaGestures}>
                                <View style={styles.mediaGestureHost}>
                                    <ScenesMediaPlayer
                                        key={activePost.id}
                                        post={activePost}
                                        isActive
                                        paused={paused}
                                        muted={muted}
                                        width={windowWidth}
                                        height={pageHeight}
                                        videoRef={videoRef}
                                        onVideoLoad={onVideoLoad}
                                        onVideoProgress={onVideoProgress}
                                        onSlideProgress={setMediaSlideProgress}
                                        onSlideIndexChange={setMediaSlideIndex}
                                        showPauseOverlay
                                        onMediaPress={handleMediaPress}
                                    />
                                </View>
                            </GestureDetector>
                        ) : (
                            <ScenesMediaPlayer
                                key={activePost.id}
                                post={activePost}
                                isActive
                                paused={paused}
                                muted={muted}
                                width={windowWidth}
                                height={pageHeight}
                                videoRef={videoRef}
                                onVideoLoad={onVideoLoad}
                                onVideoProgress={onVideoProgress}
                                onSlideProgress={setMediaSlideProgress}
                                onSlideIndexChange={setMediaSlideIndex}
                                showPauseOverlay
                                onMediaPress={handleMediaPress}
                            />
                        )}
                    </View>

            {lastTapDebug && (
                <View style={styles.tapDebug}>
                    <Text style={styles.tapDebugText}>{lastTapDebug}</Text>
                </View>
            )}

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
                <Icon name="chevron-back" size={18} color="#FFFFFF" />
            </Pressable>

            <View style={[styles.topRight, { top: insets.top + 14 }]}>
                {topMetaVisible && metadataItems.length > 0 ? (
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

            <Pressable style={[styles.muteBtn, { top: insets.top + 14 }]} onPress={toggleMute}>
                <Icon name={muted ? 'volume-mute' : 'volume-high'} size={24} color="#FFFFFF" />
            </Pressable>

            <View style={[styles.actionRail, { bottom: railBottom }]}>
                <View style={styles.actionCol}>
                    <View ref={likeButtonRef} collapsable={false}>
                        <Pressable
                            style={styles.actionBtn}
                            onPress={() => void handleLike()}
                            accessibilityLabel={activePost.userLiked ? 'Unlike' : 'Like'}
                        >
                            <FeedLikeThumbsIcon size={22} color="#000000" filled={activePost.userLiked} />
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
                        <Icon name="chatbubble-outline" size={22} color="#000000" />
                    </Pressable>
                    <Text style={styles.actionCount}>{activePost.stats.comments}</Text>
                </View>
                <View style={styles.actionCol}>
                    <Pressable
                        style={styles.actionBtn}
                        onPress={() => setSharePost(activePost)}
                        accessibilityLabel="Share"
                    >
                        <Icon name="share-social-outline" size={22} color="#000000" />
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
                            size={22}
                            color="#000000"
                        />
                    </Pressable>
                    <Text style={styles.actionCount}>{isSaved ? 'Saved' : 'Save'}</Text>
                </View>
                <View style={styles.actionCol}>
                    <Pressable
                        style={[styles.actionBtn, !canReclip && styles.actionBtnDisabled]}
                        onPress={() => canReclip && void handleReclip()}
                        disabled={!canReclip}
                    >
                        <Icon name="repeat" size={22} color="#000000" />
                    </Pressable>
                    <Text style={styles.actionCount}>{activePost.stats.reclips}</Text>
                </View>
            </View>

            {!commentsOpen ? (
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
                locations={[0, 0.45, 1]}
                style={[
                    styles.bottomChrome,
                    { paddingBottom: insets.bottom + 58 },
                ]}
                pointerEvents="box-none"
            >
                <View style={styles.profileRow}>
                    <Pressable
                        style={styles.avatarBtn}
                        onPress={() => onVisitProfile(profileHandle)}
                    >
                        <ScenesProfileAvatarRing revealKey={activePost.id} size={32}>
                            <Avatar
                                src={isOwn ? undefined : getAvatarForHandle(profileHandle)}
                                name={displayHandle.split('@')[0]}
                                size="sm"
                            />
                        </ScenesProfileAvatarRing>
                    </Pressable>
                    {!activePost.isFollowing && !isOwn && !hasPendingRequest ? (
                        <Pressable style={styles.followPlus} onPress={() => void handleFollow()}>
                            <Icon name="add" size={14} color="#000000" />
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
                            <Text style={styles.handleText} numberOfLines={1}>
                                {displayHandle}
                            </Text>
                        </Pressable>
                        {activePost.locationLabel ? (
                            <View style={styles.locationRow}>
                                <Icon name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                                <Text style={styles.locationText} numberOfLines={1}>
                                    {activePost.locationLabel}
                                </Text>
                                <Flag value={getFlagForHandle(profileHandle) || ''} size={12} />
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
                <Pressable onPress={openComments} style={styles.commentsLink}>
                    <Icon name="chatbubble-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.commentsLinkText}>
                        {activePost.stats.comments > 0
                            ? `View all ${activePost.stats.comments} comments`
                            : 'Add the first comment'}
                    </Text>
                </Pressable>
            </LinearGradient>
            ) : null}

            {!commentsOpen ? (
                <ScenesFooterBar
                    bottomInset={insets.bottom}
                    isOwnPost={isOwn}
                    onAddComment={openComments}
                    onDirectMessage={() => void handleDirectMessage()}
                    onMore={() => setOverflowVisible(true)}
                />
            ) : null}

            <View style={styles.fxLayer} pointerEvents="none">
                {burstAt ? (
                    <FeedDoubleTapLikeBurst
                        x={burstAt.x}
                        y={burstAt.y}
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

            <ScenesCommentsPanel
                visible={commentsOpen}
                sheetTop={sheetTop}
                minTop={commentsPreviewHeight}
                maxTop={windowHeight}
                backdropOpacity={
                    0.18 +
                    0.42 *
                        Math.max(
                            0,
                            Math.min(1, (windowHeight - sheetTop) / (windowHeight - commentsPreviewHeight)),
                        )
                }
                onSheetTopChange={setSheetTop}
                onClose={() => setCommentsOpen(false)}
            >
                <PostCommentsSheet
                    variant="scenesEmbed"
                    postId={activePost.id}
                    post={activePost}
                    isOpen={commentsOpen}
                    commentAuthorHandle={viewerHandle ?? ''}
                    currentUserHandle={viewerHandle}
                    onClose={() => setCommentsOpen(false)}
                />
            </ScenesCommentsPanel>

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
            />

            <SavePostModal
                post={activePost}
                userId={viewerUserId}
                visible={saveModalOpen}
                onClose={() => setSaveModalOpen(false)}
                onSaved={() => {
                    setIsSaved(true);
                    setSaveModalOpen(false);
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
    mediaLayer: { flex: 1, backgroundColor: '#000' },
    mediaGestureHost: {
        flex: 1,
        backgroundColor: '#000',
    },
    tapDebug: {
        position: 'absolute',
        top: 64,
        left: 12,
        zIndex: 200,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    tapDebugText: {
        color: '#FDE68A',
        fontSize: 11,
    },
    fxLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 60,
    },
    page: { width: '100%', backgroundColor: '#000' },
    fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111' },
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
        left: 12,
        zIndex: 25,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    muteBtn: {
        position: 'absolute',
        right: 12,
        zIndex: 25,
        padding: 8,
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
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.45)',
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
        right: 10,
        zIndex: 28,
        alignItems: 'center',
        gap: 10,
    },
    actionCol: {
        alignItems: 'center',
        gap: 2,
    },
    actionBtn: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.26,
                shadowRadius: 8,
            },
            android: { elevation: 6 },
        }),
    },
    actionBtnDisabled: {
        opacity: 0.4,
    },
    actionCount: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 11,
        fontWeight: '700',
    },
    bottomChrome: {
        position: 'absolute',
        left: 0,
        right: 72,
        bottom: 0,
        zIndex: 15,
        paddingHorizontal: 16,
        paddingTop: 48,
        backgroundColor: 'transparent',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    avatarBtn: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    followPlus: {
        marginLeft: -10,
        marginTop: 14,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    followingPill: {
        marginLeft: 6,
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    followingPillText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
    },
    requestedPill: {
        marginLeft: 6,
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    requestedPillText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
    },
    captionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        marginBottom: 6,
    },
    captionMention: {
        color: '#A5B4FC',
        fontWeight: '600',
    },
    captionMore: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 4,
        marginBottom: 6,
    },
    profileTextCol: {
        flex: 1,
        marginLeft: 8,
        minWidth: 0,
    },
    handleText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    locationText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        flexShrink: 1,
    },
    caption: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 13,
        lineHeight: 18,
    },
    commentsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    commentsLinkText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
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
        ...StyleSheet.absoluteFillObject,
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
