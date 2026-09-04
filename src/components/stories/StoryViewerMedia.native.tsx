import React from 'react';
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
import PostLinkPreviewCard from '../PostLinkPreviewCard.native';
import { useLinkPreview } from '../../hooks/useLinkPreview';
import {
    captionWithoutLinkUrl,
    extractFirstHttpUrl,
    fallbackLinkPreview,
} from '../../utils/linkPreview';
import { STORY_LINK_SHARE_CANVAS_COLORS } from '../../utils/discoverAmbientPalette';

type Props = {
    story: Story;
    isMuted: boolean;
    paused: boolean;
};

/** Regular (non–shared-post) story media: video, image, or text-only template. */
export default function StoryViewerMedia({ story, isMuted, paused }: Props) {
    const text = getStoryTextContent(story);
    const linkUrl = extractFirstHttpUrl(text);
    const { preview: fetchedPreview } = useLinkPreview(text || '', { debounceMs: 0 });
    const preview =
        story.linkPreview ||
        fetchedPreview ||
        (linkUrl ? fallbackLinkPreview(linkUrl) : null);
    const leftover = preview ? captionWithoutLinkUrl(text, preview.url) : text;
    const hasOwnMedia = Boolean((story.mediaUrl || '').trim());
    const videoSource = storyVideoSource(story.mediaUrl);
    const posterSource = hasOwnMedia ? getStoryVideoPosterSource(story.mediaUrl) : undefined;
    const posterUri = hasOwnMedia ? getStoryVideoPosterFallback(story.mediaUrl) : undefined;
    const imageUri = hasOwnMedia ? resolveStoryMediaUrl(story.mediaUrl) || posterUri : undefined;
    const hasMedia = hasOwnMedia && (!!videoSource || !!posterSource || !!imageUri);
    const isVideo = isStoryVideo(story);
    const [videoFailed, setVideoFailed] = React.useState(false);

    React.useEffect(() => {
        setVideoFailed(false);
    }, [story.id, story.mediaUrl]);

    if (hasMedia && isVideo && videoSource && !videoFailed) {
        return (
            <View style={styles.videoRoot} collapsable={false}>
                <StorySafeVideo
                    source={videoSource}
                    posterSource={posterSource || (posterUri ? { uri: posterUri } : undefined)}
                    style={styles.videoFill}
                    resizeMode="cover"
                    repeat
                    muted={isMuted}
                    paused={paused}
                    playWhenInactive
                    onError={() => setVideoFailed(true)}
                />
            </View>
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
        const canvasColors = preview
            ? [...STORY_LINK_SHARE_CANVAS_COLORS]
            : gradientColors;
        const showText = leftover.length > 0;
        return (
            <LinearGradient
                colors={canvasColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            >
                <View style={styles.textOnlyWrap} pointerEvents="box-none">
                    {showText ? (
                        <Text style={[styles.textOnlyBody, { color, fontSize }]}>{leftover}</Text>
                    ) : null}
                    {preview ? (
                        <View style={styles.linkCardWrap} pointerEvents="auto">
                            <PostLinkPreviewCard preview={preview} compact />
                        </View>
                    ) : null}
                    {!showText && !preview ? (
                        <Text style={[styles.textOnlyBody, { color, fontSize }]}>{text}</Text>
                    ) : null}
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
    videoRoot: {
        ...StyleSheet.absoluteFillObject,
    },
    videoFill: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    textOnlyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        width: '100%',
    },
    textOnlyBody: {
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 28,
        marginBottom: 12,
    },
    linkCardWrap: {
        width: '100%',
        maxWidth: 360,
        zIndex: 5,
    },
});
