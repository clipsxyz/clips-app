import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { Story } from '../../types';
import { getStoryTextContent, getTextStoryStyle } from '../../utils/storyTextStyleNative';
import {
    getStoryVideoPosterFallback,
    getStoryVideoPosterSource,
    isStoryVideo,
    pickStoryMediaUri,
    pickStoryPosterUri,
    resolveStoryMediaUrl,
    storyVideoSource,
} from '../../utils/storyMediaNative';
import StorySafeVideo from './StorySafeVideo.native';
import StoryLinkCard from './StoryLinkCard.native';
import { useLinkPreview } from '../../hooks/useLinkPreview';
import {
    captionWithoutLinkUrl,
    extractFirstHttpUrl,
    fallbackLinkPreview,
} from '../../utils/linkPreview';
import { storyLinkBrandForUrl } from '../../utils/storyLinkBrand';

type Props = {
    story: Story;
    isMuted: boolean;
    paused: boolean;
    authorAvatar?: string;
    authorName?: string;
};

/** Regular (non–shared-post) story media: video, image, or text-only template. */
export default function StoryViewerMedia({ story, isMuted, paused, authorAvatar, authorName }: Props) {
    const text = getStoryTextContent(story);
    const mediaUri = pickStoryMediaUri(story) || story.mediaUrl;
    const videoSource = storyVideoSource(mediaUri);
    const stillUri = pickStoryPosterUri(story) || resolveStoryMediaUrl(story.videoPosterUrl);
    const posterSource =
        (stillUri ? { uri: stillUri } : undefined) || getStoryVideoPosterSource(mediaUri);
    const posterUri = stillUri || getStoryVideoPosterFallback(mediaUri);
    const isVideo = isStoryVideo(story);
    const imageUri =
        stillUri ||
        (!isVideo ? resolveStoryMediaUrl(mediaUri) : undefined) ||
        posterUri;
    const hasMedia = !!videoSource || !!posterSource || !!imageUri;
    const [videoFailed, setVideoFailed] = useState(false);

    useEffect(() => {
        setVideoFailed(false);
    }, [story.id, mediaUri]);

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

    const linkUrl = text ? extractFirstHttpUrl(text) : undefined;
    if (linkUrl) {
        return (
            <StoryLinkStory
                url={linkUrl}
                caption={captionWithoutLinkUrl(text, linkUrl)}
                story={story}
                authorAvatar={authorAvatar}
                authorName={authorName || story.userHandle}
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

function StoryLinkStory({
    url,
    caption,
    story,
    authorAvatar,
    authorName,
}: {
    url: string;
    caption: string;
    story: Story;
    authorAvatar?: string;
    authorName?: string;
}) {
    const { preview: fetched, loading } = useLinkPreview(url, { debounceMs: 0 });
    const preview = fetched || fallbackLinkPreview(url);
    const { color, fontSize } = getTextStoryStyle(story);
    const canvas = storyLinkBrandForUrl(url).canvas;

    return (
        <LinearGradient
            colors={[...canvas]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
        >
            <View style={styles.linkWrap} pointerEvents="box-none">
                {caption ? (
                    <Text style={[styles.linkCaption, { color, fontSize }]} numberOfLines={3}>
                        {caption}
                    </Text>
                ) : null}
                <StoryLinkCard
                    preview={preview}
                    loading={loading && !fetched}
                    authorAvatar={authorAvatar}
                    authorName={authorName}
                />
            </View>
        </LinearGradient>
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
    linkWrap: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    linkCaption: {
        marginBottom: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
});
