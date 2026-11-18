import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Video, { type VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { fetchDmSharedStory } from '../api/stories';
import { getAvatarForHandle } from '../api/users';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import Avatar from './Avatar.native';
import CachedImage from './CachedImage.native';
import StoryLinkCard from './stories/StoryLinkCard.native';
import { useLinkPreview } from '../hooks/useLinkPreview';
import { siblingJpegFromVideoUrl } from '../utils/postMedia';
import { captionWithoutLinkUrl, extractFirstHttpUrl, fallbackLinkPreview } from '../utils/linkPreview';
import { storyLinkBrandForUrl } from '../utils/storyLinkBrand';
import { ox } from '../constants/nativeOpticalScale';
import { DM_MEDIA_ASPECT_RATIO, DM_MEDIA_MAX_WIDTH } from '../constants/dmMedia.native';
import type { Story } from '../types';

type Props = {
    handle: string;
    storyId: string;
    onPress: () => void;
};

/** DM card for a Stories 24 share. Tap opens that story. */
export default function DmSharedStoryCard({ handle, storyId, onPress }: Props) {
    const [story, setStory] = useState<Story | null | undefined>(undefined);
    const [expired, setExpired] = useState(false);
    const [posterIndex, setPosterIndex] = useState(0);
    const videoRef = useRef<VideoRef>(null);
    const name = handle.replace(/^@/, '').split('@')[0] || handle;

    useEffect(() => {
        let cancelled = false;
        setStory(undefined);
        setExpired(false);
        setPosterIndex(0);
        void fetchDmSharedStory(handle, storyId).then((result) => {
            if (cancelled) return;
            setExpired(result.expired);
            setStory(result.story);
        });
        return () => {
            cancelled = true;
        };
    }, [handle, storyId]);

    const mediaUrl = story?.mediaUrl ? rewriteMediaUrlForClient(story.mediaUrl) : '';
    const isVideo = story?.mediaType === 'video' || /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(mediaUrl);
    const posterCandidates = [
        rewriteMediaUrlForClient(story?.videoPosterUrl || ''),
        siblingJpegFromVideoUrl(mediaUrl) || '',
    ].filter((url, index, all) => url && all.indexOf(url) === index);
    const still = !isVideo ? mediaUrl : posterCandidates[posterIndex] || '';
    const storyText = (story?.text || '').trim();
    const pastedLink = !mediaUrl ? extractFirstHttpUrl(storyText) : undefined;
    const { preview: fetchedPreview, loading: previewLoading } = useLinkPreview(pastedLink || '', { debounceMs: 0 });
    const linkPreview = pastedLink ? fetchedPreview || fallbackLinkPreview(pastedLink) : null;
    const avatar = getAvatarForHandle(story?.userHandle || handle);
    const canvas = pastedLink ? storyLinkBrandForUrl(pastedLink).canvas : null;
    const caption = pastedLink ? captionWithoutLinkUrl(storyText, pastedLink) : '';

    return (
        <TouchableOpacity activeOpacity={expired ? 1 : 0.92} onPress={expired ? undefined : onPress} disabled={expired} style={styles.wrap}>
            <LinearGradient
                colors={canvas ? [...canvas] : ['#1a1040', '#0b0618']}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={styles.card}
            >
                {expired ? (
                    <View style={styles.media}>
                        <Icon name="time-outline" size={ox(28)} color="rgba(255,255,255,0.75)" />
                        <Text style={styles.expiredLabel}>Story no longer available</Text>
                    </View>
                ) : linkPreview ? (
                    <View style={styles.linkPad}>
                        {caption ? (
                            <Text style={styles.linkCaption} numberOfLines={3}>{caption}</Text>
                        ) : null}
                        <StoryLinkCard
                            preview={linkPreview}
                            loading={previewLoading && !fetchedPreview}
                            authorAvatar={avatar}
                            authorName={name}
                        />
                    </View>
                ) : (
                <View style={styles.media}>
                    {story === undefined ? (
                        <ActivityIndicator color="#E5E7EB" />
                    ) : still ? (
                        <CachedImage
                            source={{ uri: still }}
                            style={styles.photo}
                            resizeMode="cover"
                            onError={() => setPosterIndex((index) => index + 1)}
                        />
                    ) : isVideo && mediaUrl ? (
                        <Video
                            ref={videoRef}
                            source={{ uri: mediaUrl }}
                            style={styles.photo}
                            resizeMode="cover"
                            paused
                            muted
                            repeat={false}
                            poster={posterCandidates[0]}
                            posterResizeMode="cover"
                            onLoad={() => videoRef.current?.seek(0.2)}
                        />
                    ) : (
                        <Avatar src={avatar} name={name} size={ox(64)} />
                    )}
                    {isVideo && (still || mediaUrl) ? (
                        <View style={styles.play} pointerEvents="none">
                            <Icon name="play" size={ox(22)} color="#FFFFFF" />
                        </View>
                    ) : null}
                </View>
                )}
                <View style={styles.footer}>
                    <Avatar src={avatar} name={name} size={ox(28)} />
                    <View style={styles.footerText}>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        <Text style={styles.cta}>
                            {expired ? 'Story no longer available' : story === null ? 'Story unavailable' : 'Tap to view story'}
                        </Text>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrap: {
        width: DM_MEDIA_MAX_WIDTH,
        maxWidth: '100%',
    },
    card: {
        borderRadius: ox(16),
        overflow: 'hidden',
    },
    media: {
        aspectRatio: DM_MEDIA_ASPECT_RATIO,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    linkPad: {
        paddingHorizontal: ox(10),
        paddingTop: ox(10),
    },
    linkCaption: {
        color: '#FFFFFF',
        fontSize: ox(13),
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: ox(8),
    },
    photo: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: '100%',
        height: '100%',
    },
    expiredLabel: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
        textAlign: 'center',
        marginTop: ox(10),
        paddingHorizontal: ox(16),
    },
    play: {
        position: 'absolute',
        width: ox(44),
        height: ox(44),
        borderRadius: ox(22),
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
    },
    footerText: { flex: 1, minWidth: 0 },
    name: { color: '#FFFFFF', fontSize: ox(14), fontWeight: '700' },
    cta: { color: 'rgba(255,255,255,0.7)', fontSize: ox(12), marginTop: 2 },
});
