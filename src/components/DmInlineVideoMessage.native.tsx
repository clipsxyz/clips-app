import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Video, { type OnLoadData, type OnProgressData, type VideoRef } from 'react-native-video';
import CachedImage from './CachedImage.native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ox } from '../constants/nativeOpticalScale';

type Props = {
    uri: string;
    posterUrl?: string | null;
    /** Width of the media block; height derived from aspect ratio. */
    width?: number;
};

/** Inline playable glass video block for DM threads (replaces the "Video" placeholder). */
export default function DmInlineVideoMessage({ uri, posterUrl, width = 232 }: Props) {
    const videoRef = useRef<VideoRef>(null);
    const [paused, setPaused] = useState(true);
    const [started, setStarted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);

    const toggle = useCallback(() => {
        setStarted(true);
        setPaused((prev) => !prev);
    }, []);

    const onLoad = useCallback((data: OnLoadData) => {
        setDuration(Number(data?.duration) || 0);
        setLoading(false);
    }, []);

    const onProgress = useCallback((data: OnProgressData) => {
        setPosition(Number(data?.currentTime) || 0);
    }, []);

    const poster = typeof posterUrl === 'string' && posterUrl.trim() ? posterUrl.trim() : undefined;
    const progress = duration > 0 ? Math.min(1, position / duration) : 0;

    if (failed) {
        return (
            <View style={[styles.frame, { width }]}>
                {poster ? <CachedImage source={{ uri: poster }} style={styles.fill} /> : null}
                <View style={styles.centerOverlay}>
                    <Icon name="videocam-off-outline" size={ox(24)} color="#E5E7EB" />
                    <Text style={styles.failedText}>Video unavailable</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.frame, { width }]}>
            {!started || paused ? (
                poster ? (
                    <CachedImage source={{ uri: poster }} style={styles.fill} />
                ) : (
                    <View style={[styles.fill, styles.posterFallback]} />
                )
            ) : null}

            {started ? (
                <Video
                    ref={videoRef}
                    source={{ uri }}
                    style={styles.fill}
                    paused={paused}
                    muted={false}
                    repeat
                    resizeMode="cover"
                    controls={false}
                    progressUpdateInterval={250}
                    onLoadStart={() => setLoading(true)}
                    onLoad={onLoad}
                    onProgress={onProgress}
                    onError={() => {
                        setFailed(true);
                        setLoading(false);
                    }}
                />
            ) : null}

            <TouchableOpacity activeOpacity={0.9} onPress={toggle} style={styles.touchLayer}>
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
                    <TouchableOpacity onPress={toggle} style={styles.miniButton} hitSlop={8}>
                        <Icon name={paused ? 'play' : 'pause'} size={ox(14)} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                </View>
            ) : null}

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.35)']}
                style={styles.bottomScrim}
                pointerEvents="none"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    frame: {
        height: undefined,
        maxWidth: '100%',
        aspectRatio: 4 / 5,
        marginTop: ox(6),
        borderRadius: ox(14),
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
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
    bottomScrim: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: ox(48),
    },
});
