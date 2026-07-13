import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import type { Story } from '../../types';
import { getStoryTextContent, getTextStoryStyle } from '../../utils/storyTextStyleNative';
import {
    getStoryVideoPosterFallback,
    isStoryVideo,
    resolveStoryVideoPlaybackUrl,
} from '../../utils/storyMediaNative';

type Props = {
    story: Story;
    isMuted: boolean;
    paused: boolean;
};

/** Regular (non–shared-post) story media: video, image, or text-only template. */
export default function StoryViewerMedia({ story, isMuted, paused }: Props) {
    const text = getStoryTextContent(story);
    const playbackUri = resolveStoryVideoPlaybackUrl(story.mediaUrl);
    const posterUri = getStoryVideoPosterFallback(story.mediaUrl);
    const imageUri = playbackUri || posterUri;
    const hasMedia = !!imageUri;
    const isVideo = isStoryVideo(story);
    const [videoFailed, setVideoFailed] = useState(false);

    useEffect(() => {
        setVideoFailed(false);
    }, [story.id, playbackUri]);

    if (hasMedia && isVideo && playbackUri && !videoFailed) {
        return (
            <Video
                source={{ uri: playbackUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                repeat
                muted={isMuted}
                paused={paused}
                playInBackground={false}
                playWhenInactive={false}
                onError={() => setVideoFailed(true)}
            />
        );
    }

    if (hasMedia && (posterUri || !isVideo)) {
        return (
            <Image
                source={{ uri: posterUri || imageUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
            />
        );
    }

    if (text) {
        const { gradientColors, color, fontSize } = getTextStoryStyle(story);
        return (
            <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill}>
                <View style={styles.textOnlyWrap}>
                    <Text style={[styles.textOnlyBody, { color, fontSize }]}>{text}</Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <View style={[StyleSheet.absoluteFill, styles.empty]}>
            <ActivityIndicator color="#fff" />
        </View>
    );
}

const styles = StyleSheet.create({
    textOnlyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    textOnlyBody: {
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 26,
    },
    empty: {
        backgroundColor: '#101b2f',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
