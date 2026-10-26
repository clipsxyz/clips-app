import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Video, { type OnLoadData, type OnProgressData, type VideoRef } from 'react-native-video';
import CachedImage from './CachedImage.native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ox } from '../constants/nativeOpticalScale';
import { DM_MEDIA_ASPECT_RATIO, DM_MEDIA_MAX_WIDTH } from '../constants/dmMedia.native';
import {
    UEFA_PASSPORT_GRADIENT,
    UEFA_PASSPORT_GRADIENT_LOCATIONS,
} from '../theme/gazetteerAmbientNative';
import { isVideoMediaUri, siblingJpegFromVideoUrl } from '../utils/postMedia';
import { useDmTapSuppressed } from './DmMessagePressable.native';

type Props = {
    uri: string;
    posterUrl?: string | null;
    /** Extra poster/thumbnail candidates tried (in order) after `posterUrl`. */
    posterCandidates?: Array<string | null | undefined>;
    /** Width of the media block; height derived from the unified DM media aspect ratio. */
    width?: number;
    /**
     * Whether this message currently sits in the active message viewport. Playback is
     * auto-paused when the bubble scrolls out of view (Instagram DM parity).
     */
    isActive?: boolean;
    /**
     * Optional external full-screen target (e.g. Scenes). When omitted, the expand
     * affordance opens the built-in full-screen player instead.
     */
    onOpenFullscreen?: () => void;
};

/**
 * Inline playable glass video block for DM threads.
 *
 * Tapping the bubble (or the mini control) only ever toggles inline play/pause — it never
 * navigates. Full-screen playback is intentionally opt-in via the explicit expand button,
 * matching Instagram's DM video behaviour where immersive viewing is a deliberate action.
 */
export default function DmInlineVideoMessage({
    uri,
    posterUrl,
    posterCandidates,
    width = DM_MEDIA_MAX_WIDTH,
    isActive = true,
    onOpenFullscreen,
}: Props) {
    const videoRef = useRef<VideoRef>(null);
    const suppressTap = useDmTapSuppressed();
    const [started, setStarted] = useState(false);
    const [userPaused, setUserPaused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [posterFailed, setPosterFailed] = useState(false);
    const [frameReady, setFrameReady] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);

    // Off-screen (scrolled away) or unfocused videos pause without losing the user's
    // play intent, so they resume automatically when the bubble returns to view.
    const effectivePaused = !started || userPaused || !isActive || fullscreen;

    const toggleInline = useCallback(() => {
        // A press-and-hold opens the action sheet; swallow the tap that follows it.
        if (suppressTap?.current) return;
        setUserPaused((prev) => (started ? !prev : false));
        setStarted(true);
    }, [started, suppressTap]);

    const openFullscreen = useCallback(() => {
        if (suppressTap?.current) return;
        if (onOpenFullscreen) {
            onOpenFullscreen();
            return;
        }
        setStarted(true);
        setFullscreen(true);
    }, [onOpenFullscreen, suppressTap]);

    const onLoad = useCallback((data: OnLoadData) => {
        setDuration(Number(data?.duration) || 0);
        setLoading(false);
    }, []);

    const onProgress = useCallback((data: OnProgressData) => {
        setPosition(Number(data?.currentTime) || 0);
    }, []);

    // Poster order: explicit prop → extra candidates → JPEG sitting next to the MP4.
    // Never accept a video/data:video URL — `<Image>` cannot decode it and would paint blank.
    const poster = [posterUrl, ...(posterCandidates ?? []), siblingJpegFromVideoUrl(uri)]
        .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
        .find(
            (candidate) =>
                candidate.length > 0 &&
                !isVideoMediaUri(candidate) &&
                !/^data:video\//i.test(candidate),
        );
    const progress = duration > 0 ? Math.min(1, position / duration) : 0;

    React.useEffect(() => {
        setPosterFailed(false);
    }, [poster]);

    if (failed) {
        return (
            <LinearGradient
                colors={[...UEFA_PASSPORT_GRADIENT]}
                locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[styles.frame, { width }]}
            >
                {poster && !posterFailed ? (
                    <CachedImage
                        source={{ uri: poster }}
                        style={styles.fill}
                        onError={() => setPosterFailed(true)}
                    />
                ) : null}
                <View style={styles.centerOverlay}>
                    <Icon name="videocam-off-outline" size={ox(24)} color="#E5E7EB" />
                    <Text style={styles.failedText}>Video unavailable</Text>
                </View>
            </LinearGradient>
        );
    }

    // Without a poster, mount the (paused, muted) video so the platform renders its first
    // frame as a thumbnail — parity with the web `<video preload="metadata">` fallback.
    const showPosterImage = !!poster && !started && !posterFailed;
    const mountVideo = started || !poster || posterFailed;

    return (
        <LinearGradient
            colors={[...UEFA_PASSPORT_GRADIENT]}
            locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.frame, { width }]}
        >
            {showPosterImage ? (
                <CachedImage
                    source={{ uri: poster }}
                    style={styles.fill}
                    onError={() => setPosterFailed(true)}
                />
            ) : null}

            {mountVideo ? (
                <Video
                    ref={videoRef}
                    source={{ uri }}
                    style={styles.fill}
                    paused={effectivePaused}
                    muted={!started}
                    repeat
                    resizeMode="cover"
                    controls={false}
                    progressUpdateInterval={250}
                    onLoadStart={() => setLoading(true)}
                    onLoad={onLoad}
                    onReadyForDisplay={() => setFrameReady(true)}
                    onProgress={onProgress}
                    onError={() => {
                        setFailed(true);
                        setLoading(false);
                    }}
                />
            ) : null}

            {mountVideo && !started && !frameReady ? (
                <View style={[styles.fill, styles.posterFallback]} pointerEvents="none" />
            ) : null}

            <TouchableOpacity activeOpacity={0.9} onPress={toggleInline} style={styles.touchLayer}>
                {!started ? (
                    <View style={styles.playButton}>
                        <Icon name="play" size={ox(26)} color="#FFFFFF" />
                    </View>
                ) : loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : null}
            </TouchableOpacity>

            {started && !loading ? (
                <View style={styles.controls} pointerEvents="box-none">
                    <TouchableOpacity onPress={toggleInline} style={styles.miniButton} hitSlop={8}>
                        <Icon
                            name={effectivePaused ? 'play' : 'pause'}
                            size={ox(14)}
                            color="#FFFFFF"
                        />
                    </TouchableOpacity>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                </View>
            ) : null}

            <TouchableOpacity
                onPress={openFullscreen}
                style={styles.fullscreenButton}
                hitSlop={10}
                accessibilityLabel="Play full screen"
                accessibilityRole="button"
            >
                <Icon name="expand-outline" size={ox(16)} color="#FFFFFF" />
            </TouchableOpacity>

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.35)']}
                style={styles.bottomScrim}
                pointerEvents="none"
            />

            <Modal
                visible={fullscreen}
                animationType="fade"
                statusBarTranslucent
                supportedOrientations={['portrait', 'landscape']}
                onRequestClose={() => setFullscreen(false)}
            >
                <View style={styles.fsRoot}>
                    <StatusBar barStyle="light-content" backgroundColor="#000000" />
                    <Video
                        source={{ uri }}
                        style={styles.fsVideo}
                        paused={false}
                        muted={false}
                        repeat
                        resizeMode="contain"
                        controls={false}
                        poster={poster}
                        posterResizeMode="contain"
                    />
                    <TouchableOpacity
                        style={styles.fsClose}
                        onPress={() => setFullscreen(false)}
                        hitSlop={12}
                        accessibilityLabel="Close full screen"
                        accessibilityRole="button"
                    >
                        <Icon name="close" size={ox(24)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    frame: {
        maxWidth: '100%',
        aspectRatio: DM_MEDIA_ASPECT_RATIO,
        marginTop: ox(6),
        borderRadius: ox(14),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
    },
    fill: {
        ...StyleSheet.absoluteFill,
        width: '100%',
        height: '100%',
    },
    posterFallback: {
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    touchLayer: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: ox(54),
        height: ox(54),
        borderRadius: ox(27),
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(6),
    },
    failedText: {
        color: '#E5E7EB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    controls: {
        position: 'absolute',
        left: ox(8),
        right: ox(8),
        bottom: ox(8),
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
    },
    miniButton: {
        width: ox(28),
        height: ox(28),
        borderRadius: ox(14),
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressTrack: {
        flex: 1,
        height: ox(3),
        borderRadius: ox(2),
        backgroundColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: ox(2),
        backgroundColor: '#FFFFFF',
    },
    fullscreenButton: {
        position: 'absolute',
        top: ox(8),
        right: ox(8),
        width: ox(30),
        height: ox(30),
        borderRadius: ox(15),
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomScrim: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: ox(48),
    },
    fsRoot: {
        flex: 1,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fsVideo: {
        width: '100%',
        height: '100%',
    },
    fsClose: {
        position: 'absolute',
        top: ox(44),
        right: ox(16),
        width: ox(40),
        height: ox(40),
        borderRadius: ox(20),
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
