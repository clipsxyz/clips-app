import React, { useEffect, useState } from 'react';
import {
    Image,
    StyleSheet,
    View,
    type ImageSourcePropType,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Video, { ViewType, type OnProgressData, type VideoRef } from 'react-native-video';

type Props = {
    source: { uri: string };
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
    /** Feed rail previews sit inside a list — must keep playing while the card is on screen. */
    playWhenInactive?: boolean;
    progressUpdateInterval?: number;
    /** Pixel box. ColorOS TextureView ignores % / overflow and paints into the next tile. */
    boxWidth?: number;
    boxHeight?: number;
};

const VIDEO_FILL: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
};

/**
 * Story / rail player. Do not put opaque backgrounds, elevation, or
 * renderToHardwareTextureAndroid on this tree — ColorOS then plays audio with a black picture.
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
    playWhenInactive = false,
    progressUpdateInterval = 250,
    boxWidth,
    boxHeight,
}: Props) {
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const [box, setBox] = useState<{ width: number; height: number } | null>(
        boxWidth && boxHeight && boxWidth > 1 && boxHeight > 1
            ? { width: Math.round(boxWidth), height: Math.round(boxHeight) }
            : null,
    );
    const notifiedReadyRef = React.useRef(false);
    const sourceKey = source.uri || '';
    const pinnedBox =
        boxWidth && boxHeight && boxWidth > 1 && boxHeight > 1
            ? { width: Math.round(boxWidth), height: Math.round(boxHeight) }
            : null;

    useEffect(() => {
        setFailed(false);
        setReady(false);
        notifiedReadyRef.current = false;
    }, [sourceKey]);

    useEffect(() => {
        if (!pinnedBox) return;
        setBox((prev) =>
            prev && prev.width === pinnedBox.width && prev.height === pinnedBox.height
                ? prev
                : pinnedBox,
        );
    }, [pinnedBox?.width, pinnedBox?.height]);

    const onLayout = (e: LayoutChangeEvent) => {
        if (pinnedBox) return;
        const { width, height } = e.nativeEvent.layout;
        if (!(width > 1 && height > 1)) return;
        setBox((prev) =>
            prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
                ? prev
                : { width: Math.round(width), height: Math.round(height) },
        );
    };

    if (failed && posterSource) {
        return <Image source={posterSource} style={style as object} resizeMode="cover" />;
    }

    if (failed) {
        return <View style={style} />;
    }

    const markReady = () => {
        if (notifiedReadyRef.current) return;
        notifiedReadyRef.current = true;
        onReadyForDisplay?.();
        setReady(true);
    };

    const pixelBox = box
        ? { width: box.width, height: box.height, overflow: 'hidden' as const }
        : null;
    const videoStyle = pixelBox ?? VIDEO_FILL;
    const hostStyle = pixelBox ?? [styles.host, style];

    return (
        <View
            style={hostStyle}
            collapsable={false}
            onLayout={pinnedBox ? undefined : onLayout}
        >
            <Video
                ref={videoRef}
                source={source}
                style={videoStyle}
                resizeMode={resizeMode}
                muted={muted}
                repeat={repeat}
                paused={paused}
                volume={muted ? 0 : 1}
                playInBackground={false}
                playWhenInactive={playWhenInactive}
                viewType={ViewType.TEXTURE}
                useTextureView
                hideShutterView
                ignoreSilentSwitch="ignore"
                mixWithOthers="mix"
                disableFocus
                progressUpdateInterval={progressUpdateInterval}
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
                <Image
                    source={posterSource}
                    style={pixelBox ? [pixelBox, StyleSheet.absoluteFillObject] : VIDEO_FILL}
                    resizeMode="cover"
                    pointerEvents="none"
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
});
