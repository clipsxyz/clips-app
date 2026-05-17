import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import type { Post } from '../types';
import { subscribeActiveFeedVideo } from '../utils/feedActiveVideoNative';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyFontSize,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';

type Props = {
    post: Post;
    width: number;
    height: number;
    onPress?: () => void;
    onMediaLoad?: () => void;
    mode?: 'feed' | 'detail';
    /** Feed only: true when this card is the active autoplay target. */
    isActive?: boolean;
    /** Feed autoplay is muted by default (global mute pref). */
    muted?: boolean;
    style?: StyleProp<ViewStyle>;
};

export default function FeedPostMedia({
    post,
    width,
    height,
    onPress,
    onMediaLoad,
    mode = 'feed',
    isActive = false,
    muted = true,
    style,
}: Props) {
    const [loading, setLoading] = useState(true);
    const [paused, setPaused] = useState(mode === 'feed');
    const [playFailed, setPlayFailed] = useState(false);
    const [soundOn, setSoundOn] = useState(!muted);

    const firstMedia = post.mediaItems?.[0];
    const mediaUrl = firstMedia?.url || post.mediaUrl;
    const posterUrl = post.videoPosterUrl;

    const textOnly = isTextOnlyPost(post);
    const video = !textOnly && isVideoPost(post) && !!mediaUrl;
    const feedShouldPlay = mode === 'feed' && video && isActive && !playFailed;

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        setPlayFailed(false);
        setLoading(true);
    }, [mediaUrl, mode, video]);

    useEffect(() => {
        if (mode !== 'feed' || !video) return;
        return subscribeActiveFeedVideo((activeId) => {
            if (activeId !== post.id) {
                setPlayFailed(false);
            }
        });
    }, [mode, post.id, video]);

    useEffect(() => {
        setSoundOn(!muted);
    }, [muted, post.id]);

    const textOnlyStyle = useMemo(() => {
        if (!textOnly) return null;
        return {
            backgroundColor: getTextOnlyBackgroundColor(post),
            color: getTextOnlyTextColor(post),
            fontSize: getTextOnlyFontSize(post),
        };
    }, [post, textOnly]);

    if (textOnly) {
        return (
            <Pressable onPress={onPress} style={[styles.wrap, { width, minHeight: height * 0.55 }, style]}>
                <View style={[styles.textOnlyCard, { backgroundColor: textOnlyStyle?.backgroundColor }]}>
                    <Text style={[styles.textOnlyBody, { color: textOnlyStyle?.color, fontSize: textOnlyStyle?.fontSize }]}>
                        {post.text}
                    </Text>
                </View>
            </Pressable>
        );
    }

    if (!mediaUrl) {
        return null;
    }

    const frameStyle = { width, height, backgroundColor: '#000000' };

    const finishLoad = () => {
        setLoading(false);
        onMediaLoad?.();
    };

    const onVideoError = () => {
        setPlayFailed(true);
        setLoading(false);
    };

    const inner = video ? (
        mode === 'detail' ? (
            <Video
                source={{ uri: mediaUrl }}
                style={frameStyle}
                resizeMode="contain"
                controls
                paused={paused}
                poster={posterUrl}
                posterResizeMode="cover"
                onLoad={finishLoad}
                onError={finishLoad}
            />
        ) : feedShouldPlay ? (
            <Video
                source={{ uri: mediaUrl }}
                style={frameStyle}
                resizeMode="cover"
                paused={false}
                muted={!soundOn}
                repeat
                poster={posterUrl}
                posterResizeMode="cover"
                playInBackground={false}
                playWhenInactive={false}
                ignoreSilentSwitch="ignore"
                onLoad={finishLoad}
                onError={onVideoError}
            />
        ) : posterUrl || playFailed ? (
            <Image
                source={{ uri: posterUrl || mediaUrl }}
                style={frameStyle}
                resizeMode="cover"
                resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                onLoad={finishLoad}
                onError={finishLoad}
            />
        ) : (
            <View style={[frameStyle, styles.videoFallback]}>
                {loading ? <ActivityIndicator color="#f472b6" /> : null}
                <Icon name="videocam-outline" size={36} color="#6B7280" />
            </View>
        )
    ) : (
        <Image
            source={{ uri: mediaUrl }}
            style={frameStyle}
            resizeMode="cover"
            resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
            progressiveRenderingEnabled
            onLoad={finishLoad}
            onError={finishLoad}
        />
    );

    const showPlayBadge = video && mode === 'feed' && !feedShouldPlay;

    return (
        <Pressable onPress={onPress} style={[styles.wrap, { width, height }, style]}>
            {inner}
            {loading && !video ? (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="#f472b6" />
                </View>
            ) : null}
            {showPlayBadge ? (
                <View style={styles.playBadge} pointerEvents="none">
                    <Icon name="play-circle" size={52} color="rgba(255,255,255,0.92)" />
                </View>
            ) : null}
            {feedShouldPlay ? (
                <Pressable
                    style={styles.muteButton}
                    onPress={(e) => {
                        e.stopPropagation?.();
                        setSoundOn((v) => !v);
                    }}
                    hitSlop={8}
                >
                    <Icon name={soundOn ? 'volume-high' : 'volume-mute'} size={20} color="#FFFFFF" />
                </Pressable>
            ) : null}
            {video && mode === 'detail' && paused ? (
                <Pressable style={styles.playBadge} onPress={() => setPaused(false)}>
                    <Icon name="play-circle" size={64} color="rgba(255,255,255,0.95)" />
                </Pressable>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrap: {
        overflow: 'hidden',
        backgroundColor: '#000000',
        position: 'relative',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    playBadge: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    muteButton: {
        position: 'absolute',
        right: 10,
        bottom: 10,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 4,
    },
    videoFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    textOnlyCard: {
        borderRadius: 16,
        padding: 18,
        minHeight: 120,
        justifyContent: 'center',
    },
    textOnlyBody: {
        fontWeight: '600',
        lineHeight: 22,
    },
});
