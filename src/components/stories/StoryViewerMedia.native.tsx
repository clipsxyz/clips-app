import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { Story } from '../../types';
import { getStoryTextContent, getTextStoryStyle } from '../../utils/storyTextStyleNative';
import {
    getStoryVideoPosterFallback,
    getStoryVideoPosterSource,
    isStoryVideo,
    resolveStoryMediaUrl,
    storyVideoSource,
} from '../../utils/storyMediaNative';
import StorySafeVideo from './StorySafeVideo.native';

type Props = {
    story: Story;
    isMuted: boolean;
    paused: boolean;
};

/** Regular (non–shared-post) story media: video, image, or text-only template. */
export default function StoryViewerMedia({ story, isMuted, paused }: Props) {
    const text = getStoryTextContent(story);
    const videoSource = storyVideoSource(story.mediaUrl);
    const posterSource = getStoryVideoPosterSource(story.mediaUrl);
    const posterUri = getStoryVideoPosterFallback(story.mediaUrl);
    const imageUri = resolveStoryMediaUrl(story.mediaUrl) || posterUri;
    const hasMedia = !!videoSource || !!posterSource || !!imageUri;
    const isVideo = isStoryVideo(story);
    const [videoFailed, setVideoFailed] = useState(false);

    useEffect(() => {
        setVideoFailed(false);
    }, [story.id, story.mediaUrl]);

    if (hasMedia && isVideo && videoSource && !videoFailed) {
        return (
            <StorySafeVideo
                source={videoSource}
                posterSource={posterSource || (posterUri ? { uri: posterUri } : undefined)}
                style={StyleSheet.absoluteFill}
                repeat
                muted={isMuted}
                paused={paused}
                onError={() => setVideoFailed(true)}
            />
        );
    }

    if (hasMedia && (posterSource || imageUri || !isVideo)) {
        const imageSource = posterSource || (imageUri ? { uri: imageUri } : null);
        if (!imageSource) {
            return (
                <View style={[StyleSheet.absoluteFill, styles.empty]}>
                    <ActivityIndicator color="#fff" />
                </View>
            );
        }
        return (
            <Image
                source={imageSource}
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
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
    },
    textOnlyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    textOnlyBody: {
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 28,
    },
});
