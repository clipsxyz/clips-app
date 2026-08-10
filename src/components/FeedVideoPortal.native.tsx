import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, View } from 'react-native';
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
    isMockDemoVideoPath,
    mockFeedVideoSource,
    resolveMockFeedVideoUrl,
} from '../constants/mockFeedVideos';
import VideoCTAOverlay from './VideoCTAOverlay.native';

type Props = {
    suspend?: boolean;
};

/** Leave room for the in-card FeedPostHeader (portal paints above the list). */
const HEADER_BAND = 72;
const MIN_VISIBLE_RATIO = 0.45;

/**
 * Persistent Video outside FlatList. Cells are posters only.
 *
 * Never try to "follow" the list while the finger is down — measureInWindow cannot
 * keep up with FlatList, so the TextureView looks loose / slides out of the card.
 * Park while scrolling; re-attach only after settle with a fresh measure.
 */
export default function FeedVideoPortal({ suspend = false }: Props) {
    const hostRef = useRef<View>(null);
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
    const activeIdRef = useRef(activeId);
    activeIdRef.current = activeId;

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
                setHostOrigin((prev) =>
                    Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5 ? prev : { x, y },
                );
            });
        };
        sync();
        const t = setInterval(sync, 400);
        return () => {
            alive = false;
            clearInterval(t);
        };
    }, []);

    // Finger down / fling: detach immediately so the surface cannot drift over neighbors.
    useEffect(() => {
        if (scrollBusy || suspend || !activeId) {
            setFeedVideoPortalTarget(null);
            setFeedVideoPortalChrome(null);
        }
    }, [scrollBusy, suspend, activeId]);

    // Attach only when idle — fresh measure after settle.
    useEffect(() => {
        if (suspend || !activeId || scrollBusy) return;
        let cancelled = false;
        const publish = () => {
            if (cancelled || getFeedScrollBusy()) return;
            const id = activeIdRef.current;
            if (!id) return;
            const winH = Dimensions.get('window').height;
            measureFeedVideoFrame(id, (rect) => {
                if (cancelled || getFeedScrollBusy() || activeIdRef.current !== id) return;
                const visibleTop = Math.max(0, rect.y);
                const visibleBottom = Math.min(winH, rect.y + rect.height);
                const visibleH = visibleBottom - visibleTop;
                if (visibleH < 64 || visibleH / rect.height < MIN_VISIBLE_RATIO) {
                    setFeedVideoPortalTarget(null);
                    return;
                }
                setFeedVideoPortalTarget(
                    {
                        postId: String(id),
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
                    postId: String(id),
                    onOpenScenes: rect.onOpenScenes,
                    onToggleMute: rect.onToggleMute,
                });
            });
        };
        // One frame after settle so FlatList layout matches the finger-up position.
        const kick = requestAnimationFrame(() => publish());
        const t = setInterval(publish, 160);
        return () => {
            cancelled = true;
            cancelAnimationFrame(kick);
            clearInterval(t);
        };
    }, [activeId, scrollBusy, suspend]);

    const postId = target?.postId ?? null;
    const isMine = Boolean(postId && activeId && String(activeId) === String(postId));
    const hasTarget = Boolean(
        isMine && target && !suspend && !scrollBusy && target.width > 8 && target.height > 8,
    );
    const playing = hasTarget;

    useEffect(() => {
        if (!hasTarget || !target) return;
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

    const heldUrl = target?.rawUrl;
    const source = heldUrl
        ? isMockDemoVideoPath(heldUrl)
            ? mockFeedVideoSource(heldUrl)
            : { uri: resolveMockFeedVideoUrl(heldUrl) }
        : null;

    const frame =
        hasTarget && target
            ? {
                  left: target.x - hostOrigin.x,
                  top: target.y - hostOrigin.y + HEADER_BAND,
                  width: target.width,
                  height: Math.max(8, target.height - HEADER_BAND),
              }
            : null;

    const chromeMatches =
        hasTarget && chrome && postId && String(chrome.postId) === String(postId) ? chrome : null;

    return (
        <View ref={hostRef} pointerEvents="box-none" collapsable={false} style={styles.host}>
            {hasTarget && source && frame ? (
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
                    {!surfaceReady ? (
                        <View pointerEvents="none" style={styles.posterCover} collapsable={false} />
                    ) : null}
                </View>
            ) : null}

            {chromeMatches?.onOpenScenes && target ? (
                <View
                    pointerEvents="box-none"
                    collapsable={false}
                    style={[
                        styles.chrome,
                        {
                            left: target.x - hostOrigin.x,
                            top: target.y - hostOrigin.y,
                            width: target.width,
                            height: target.height,
                        },
                    ]}
                >
                    <VideoCTAOverlay
                        onPress={() => chromeMatches.onOpenScenes?.()}
                        userHandle={target.userHandle}
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
        backgroundColor: '#000',
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
