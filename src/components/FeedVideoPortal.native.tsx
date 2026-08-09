import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { ViewType, type VideoRef } from 'react-native-video';
import {
    getActiveFeedVideoPostId,
    getFeedVideoPortalChrome,
    getFeedVideoPortalTarget,
    setFeedVideoPortalChrome,
    setFeedVideoPortalTarget,
    subscribeActiveFeedVideo,
    subscribeFeedVideoPortal,
    subscribeFeedVideoPortalChrome,
    type FeedVideoPortalChrome,
    type FeedVideoPortalTarget,
} from '../utils/feedActiveVideoNative';
import { getFeedScrollBusy, subscribeFeedScrollBusy } from '../utils/feedScrollBusyNative';
import { measureFeedVideoFrame } from '../utils/feedVideoFrameRegistryNative';
import { consumeFeedVideoHandoff, setFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import {
    getGlobalVideoMutedNative,
    setGlobalVideoMutedNative,
    subscribeGlobalVideoMuted,
} from '../utils/globalVideoMuteNative';
import {
    MOCK_FEED_BUNDLED_VIDEO_POSTER,
    isMockDemoVideoPath,
    mockFeedVideoSource,
    resolveDemoVideoPosterSource,
    resolveMockFeedVideoUrl,
} from '../constants/mockFeedVideos';
import VideoCTAOverlay from './VideoCTAOverlay.native';

type Props = {
    suspend?: boolean;
};

const HEADER_BAND = 72;
const PARK = { left: -10000, top: -10000, width: 16, height: 16 } as const;
let heldPortalUrl: string | null = null;

/**
 * Persistent Video outside FlatList. Cells only register frames — they do NOT setState
 * when active changes (that was the Alice→Sarah/Bob scroll jump with the same mock MP4).
 */
export default function FeedVideoPortal({ suspend = false }: Props) {
    const hostRef = useRef<View>(null);
    const hostOriginRef = useRef({ x: 0, y: 0 });
    const [hostOrigin, setHostOrigin] = useState({ x: 0, y: 0 });
    const [target, setTarget] = useState<FeedVideoPortalTarget | null>(() => getFeedVideoPortalTarget());
    const [chrome, setChrome] = useState<FeedVideoPortalChrome | null>(() => getFeedVideoPortalChrome());
    const [activeId, setActiveId] = useState<string | null>(() => getActiveFeedVideoPostId());
    const [scrollBusy, setScrollBusy] = useState(() => getFeedScrollBusy());
    const [muted, setMuted] = useState(true);
    const [surfaceReady, setSurfaceReady] = useState(false);
    const videoRef = useRef<VideoRef>(null);
    const pendingSeekRef = useRef<number | null>(null);
    const lastSourceKeyRef = useRef<string | null>(null);

    useEffect(() => subscribeFeedVideoPortal(setTarget), []);
    useEffect(() => subscribeFeedVideoPortalChrome(setChrome), []);
    useEffect(() => subscribeActiveFeedVideo(setActiveId), []);
    useEffect(() => subscribeFeedScrollBusy(setScrollBusy), []);
    useEffect(() => {
        void getGlobalVideoMutedNative().then(setMuted);
        return subscribeGlobalVideoMuted(setMuted);
    }, []);

    useEffect(() => {
        let alive = true;
        const sync = () => {
            hostRef.current?.measureInWindow((x, y) => {
                if (!alive) return;
                const prev = hostOriginRef.current;
                if (Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5) return;
                hostOriginRef.current = { x, y };
                setHostOrigin({ x, y });
            });
        };
        sync();
        const t = setInterval(sync, 400);
        return () => {
            alive = false;
            clearInterval(t);
        };
    }, []);

    // Pull rect + chrome from the frame registry (cells never re-render for this).
    useEffect(() => {
        if (suspend || !activeId || scrollBusy) return;
        let cancelled = false;
        const publish = () => {
            if (cancelled || getFeedScrollBusy()) return;
            measureFeedVideoFrame(activeId, (rect) => {
                if (cancelled) return;
                setFeedVideoPortalTarget(
                    {
                        postId: String(activeId),
                        rawUrl: rect.rawUrl,
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        userHandle: rect.userHandle,
                        showScenesCta: rect.showScenesCta,
                    },
                    { force: true },
                );
                setFeedVideoPortalChrome({
                    postId: String(activeId),
                    onOpenScenes: rect.onOpenScenes,
                    onToggleMute: rect.onToggleMute,
                });
            });
        };
        publish();
        const t = setInterval(publish, 180);
        const unsubBusy = subscribeFeedScrollBusy((busy) => {
            if (!busy && !cancelled) requestAnimationFrame(publish);
        });
        return () => {
            cancelled = true;
            clearInterval(t);
            unsubBusy();
        };
    }, [activeId, scrollBusy, suspend]);

    const postId = target?.postId ?? null;
    const isMine = Boolean(postId && activeId && String(activeId) === String(postId));
    const hasTarget = Boolean(isMine && target && !suspend && target.width > 8 && target.height > 8);
    const onScreen = hasTarget && !scrollBusy;
    const playing = onScreen;

    useEffect(() => {
        if (!hasTarget || !target) return;
        // URL-only key: Alice/Sarah/Bob share the same mock MP4 — do not reset surface.
        const sourceKey = target.rawUrl;
        if (lastSourceKeyRef.current === sourceKey) return;
        lastSourceKeyRef.current = sourceKey;
        setSurfaceReady(false);
        pendingSeekRef.current = null;
        if (postId) {
            const handoff = consumeFeedVideoHandoff(postId);
            if (handoff && handoff.currentTime > 0) {
                pendingSeekRef.current = handoff.currentTime;
            }
        }
    }, [hasTarget, postId, target?.rawUrl]);

    const rawUrl = target?.rawUrl;
    if (rawUrl) heldPortalUrl = rawUrl;
    const heldUrl = rawUrl || heldPortalUrl;
    const source = heldUrl
        ? isMockDemoVideoPath(heldUrl)
            ? mockFeedVideoSource(heldUrl)
            : { uri: resolveMockFeedVideoUrl(heldUrl) }
        : mockFeedVideoSource('/demo-videos/flower.mp4');
    const posterSource = heldUrl
        ? resolveDemoVideoPosterSource(heldUrl) || MOCK_FEED_BUNDLED_VIDEO_POSTER
        : MOCK_FEED_BUNDLED_VIDEO_POSTER;

    let frame: { left: number; top: number; width: number; height: number } = { ...PARK };
    if (hasTarget && target) {
        const localLeft = target.x - hostOrigin.x;
        const localTop = target.y - hostOrigin.y;
        const next = {
            left: localLeft,
            top: localTop + HEADER_BAND,
            width: target.width,
            height: Math.max(8, target.height - HEADER_BAND),
        };
        frame = onScreen ? next : { ...PARK };
    }

    const chromeMatches =
        onScreen && chrome && postId && String(chrome.postId) === String(postId) ? chrome : null;

    return (
        <View ref={hostRef} pointerEvents="box-none" collapsable={false} style={styles.host}>
            <View
                pointerEvents="none"
                collapsable={false}
                needsOffscreenAlphaCompositing
                style={[styles.frame, frame]}
            >
                <Video
                    ref={videoRef}
                    source={source as object}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    muted={muted}
                    repeat
                    paused={!playing}
                    playInBackground={false}
                    playWhenInactive={false}
                    ignoreSilentSwitch="ignore"
                    hideShutterView
                    viewType={Platform.OS === 'android' ? ViewType.TEXTURE : undefined}
                    useTextureView={Platform.OS === 'android' ? true : undefined}
                    disableFocus={Platform.OS === 'android' ? true : undefined}
                    poster={{
                        source: posterSource as number | { uri: string },
                        resizeMode: 'cover',
                    }}
                    onLoad={() => {
                        const t = pendingSeekRef.current;
                        if (t != null && t > 0) {
                            pendingSeekRef.current = null;
                            videoRef.current?.seek(t);
                        }
                        setSurfaceReady(true);
                    }}
                    onReadyForDisplay={() => {
                        requestAnimationFrame(() => setSurfaceReady(true));
                    }}
                    onProgress={(e) => {
                        if (e.currentTime > 0.08) setSurfaceReady(true);
                        if (!playing || !target) return;
                        setFeedVideoHandoff(target.postId, {
                            currentTime: e.currentTime,
                            muted,
                        });
                    }}
                />
                {!surfaceReady || !onScreen ? (
                    <View pointerEvents="none" style={styles.posterCover} collapsable={false}>
                        <Image source={posterSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    </View>
                ) : null}
            </View>

            {chromeMatches?.onOpenScenes ? (
                <View
                    pointerEvents="box-none"
                    collapsable={false}
                    style={[
                        styles.chrome,
                        {
                            left: target!.x - hostOrigin.x,
                            top: target!.y - hostOrigin.y,
                            width: target!.width,
                            height: target!.height,
                        },
                    ]}
                >
                    <VideoCTAOverlay
                        onPress={() => chromeMatches.onOpenScenes?.()}
                        userHandle={target?.userHandle}
                    />
                    <Pressable
                        style={styles.muteButton}
                        hitSlop={8}
                        onPress={() => {
                            if (chromeMatches.onToggleMute) {
                                chromeMatches.onToggleMute();
                                return;
                            }
                            void setGlobalVideoMutedNative(!muted);
                        }}
                    >
                        <Icon
                            name={muted ? 'volume-mute' : 'volume-high'}
                            size={14}
                            color="#FFFFFF"
                        />
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        ...StyleSheet.absoluteFill,
        zIndex: 4,
    },
    frame: {
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    posterCover: {
        ...StyleSheet.absoluteFill,
        zIndex: 2,
    },
    chrome: {
        position: 'absolute',
        zIndex: 6,
        elevation: Platform.OS === 'android' ? 6 : 0,
    },
    muteButton: {
        position: 'absolute',
        right: 10,
        bottom: 10,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 25,
        elevation: Platform.OS === 'android' ? 25 : 0,
    },
});
