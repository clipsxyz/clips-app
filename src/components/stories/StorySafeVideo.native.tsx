import React, { useEffect, useState } from 'react';
import {
    Image,
    Platform,
    StyleSheet,
    View,
    type ImageSourcePropType,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Video, { ViewType, type OnProgressData, type VideoRef } from 'react-native-video';

type Props = {
    source: number | { uri: string };
    posterSource?: ImageSourcePropType | null;
    style?: StyleProp<ViewStyle>;
    muted?: boolean;
    repeat?: boolean;
    paused?: boolean;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'none';
    videoRef?: React.Ref<VideoRef>;
    onProgress?: (e: OnProgressData) => void;
    onError?: () => void;
    /** Fires once the first frame is paintable (TextureView ready). */
    onReadyForDisplay?: () => void;
};

/**
 * TextureView paints black until the first decoded frame. Keep the poster cover
 * above the player (render order + elevation) until ready — same pattern as feed.
 */
export default function StorySafeVideo({
    source,
    posterSource,
    style,
    muted = true,
    repeat = true,
    paused = false,
    resizeMode = 'cover',
    videoRef,
    onProgress,
    onError,
    onReadyForDisplay,
}: Props) {
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const notifiedReadyRef = React.useRef(false);

    useEffect(() => {
        setFailed(false);
        setReady(false);
        notifiedReadyRef.current = false;
    }, [source]);

    if (failed && posterSource) {
        return <Image source={posterSource} style={style as object} resizeMode="cover" />;
    }

    if (failed) {
        return <View style={style} />;
    }

    const markReady = () => {
        if (!notifiedReadyRef.current) {
            notifiedReadyRef.current = true;
            onReadyForDisplay?.();
        }
        setReady(true);
    };

    return (
        <View style={[style, styles.clip]} collapsable={false}>
            <Video
                ref={videoRef}
                source={source}
                style={StyleSheet.absoluteFill}
                resizeMode={resizeMode}
                muted={muted}
                repeat={repeat}
                paused={paused}
                volume={muted ? 0 : 1}
                playInBackground={false}
                playWhenInactive={false}
                viewType={ViewType.TEXTURE}
                useTextureView
                hideShutterView
                ignoreSilentSwitch="ignore"
                mixWithOthers="mix"
                disableFocus
                poster={
                    posterSource
                        ? {
                              source: posterSource as number | { uri: string },
                              resizeMode: 'cover',
                          }
                        : undefined
                }
                onReadyForDisplay={() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(markReady);
                    });
                }}
                onProgress={(e) => {
                    if (e.currentTime > 0.12) markReady();
                    onProgress?.(e);
                }}
                onError={() => {
                    setFailed(true);
                    onError?.();
                }}
            />
            {posterSource && !ready ? (
                <View
                    pointerEvents="none"
                    collapsable={false}
                    needsOffscreenAlphaCompositing
                    renderToHardwareTextureAndroid
                    style={styles.posterCover}
                >
                    <Image source={posterSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    clip: {
        overflow: 'hidden',
    },
    posterCover: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 4,
        elevation: Platform.OS === 'android' ? 6 : 0,
    },
});
