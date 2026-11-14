import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Avatar from '../Avatar.native';
import type { LinkPreview } from '../../types';
import { linkAttachmentHostLabel } from '../../utils/linkPreview';
import {
    storyLinkBrandForUrl,
    storyLinkFaviconUrl,
    storyLinkNewsName,
    storyLinkSlugHeadline,
} from '../../utils/storyLinkBrand';
import { ox } from '../../constants/nativeOpticalScale';
import {
    STORY_GRADIENT_RING_COLORS,
    STORY_GRADIENT_RING_END,
    STORY_GRADIENT_RING_START,
} from '../../utils/storyRingNative';

const CARD_BASE = '#1E293B';

type Props = {
    preview: LinkPreview;
    /** Shown immediately, before Open Graph fields arrive. */
    loading?: boolean;
    authorAvatar?: string;
    authorName?: string;
};

/** Publisher from og:site_name. Falls back to the hostname when the page has no site name. */
function publisherName(siteName: string | undefined, source: string | undefined, host: string): string {
    const site = (siteName || '').trim();
    const src = (source || '').trim();
    const isHost = (value: string) => value.replace(/^www\./i, '').toLowerCase() === host.toLowerCase();
    if (site && !isHost(site)) return site;
    if (src && src.toLowerCase() !== 'link' && !isHost(src)) return src;
    return host;
}

async function openStoryUrl(rawUrl: string) {
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
        await Linking.openURL(withProtocol);
    } catch (error) {
        console.error('Failed to open story link:', error);
    }
}

/** Site mark inside the card. Favicon first, brand glyph if that image fails. */
function SiteLogo({
    url,
    fallbackIcon,
    accent,
}: {
    url: string;
    fallbackIcon: string;
    accent: string;
}) {
    const [failed, setFailed] = useState(false);
    const src = storyLinkFaviconUrl(url);
    useEffect(() => {
        setFailed(false);
    }, [src]);
    return (
        <View style={[styles.logoWell, { borderColor: accent }]}>
            {src && !failed ? (
                <Image
                    source={{ uri: src }}
                    style={styles.logoImage}
                    onError={() => setFailed(true)}
                />
            ) : (
                <Icon name={fallbackIcon || 'link-outline'} size={ox(22)} color={accent} />
            )}
        </View>
    );
}

function AuthorMark({ avatar, name }: { avatar?: string; name?: string }) {
    return (
        <LinearGradient
            colors={[...STORY_GRADIENT_RING_COLORS]}
            start={STORY_GRADIENT_RING_START}
            end={STORY_GRADIENT_RING_END}
            style={styles.avatarRing}
        >
            <View style={styles.avatarGap}>
                <Avatar src={avatar} name={name || 'User'} size={ox(58)} hideBorder />
            </View>
        </LinearGradient>
    );
}

/** Centered link card. Every mark, title, and action stays in this column. */
export default function StoryLinkCard({
    preview,
    loading = false,
    authorAvatar,
    authorName,
}: Props) {
    const [imageFailed, setImageFailed] = useState(false);
    useEffect(() => {
        setImageFailed(false);
    }, [preview.imageUrl]);

    const host = linkAttachmentHostLabel(preview.url);
    const newsName = storyLinkNewsName(preview.url);
    const rawTitle = (preview.title || '').trim();
    const titleIsHost = !rawTitle || rawTitle.toLowerCase() === host.toLowerCase();
    const slugHeadline = titleIsHost ? storyLinkSlugHeadline(preview.url) : '';
    const title = !titleIsHost ? rawTitle : slugHeadline || newsName || host;
    const description = (preview.description || '').trim();
    const showDescription = Boolean(description) && description.toLowerCase() !== title.toLowerCase();
    const publisher = newsName || publisherName(preview.siteName, preview.source, host);
    const showPublisher = publisher.toLowerCase() !== title.toLowerCase();
    const showImage = Boolean(preview.imageUrl) && !imageFailed;
    const brand = storyLinkBrandForUrl(preview.url);
    const ctaLabel = newsName && !showImage ? 'Read Article' : brand.cta;
    const cardColors =
        brand.id === 'default' ? ['#334155', CARD_BASE] : [brand.accent, CARD_BASE];

    return (
        <Pressable
            onPress={() => void openStoryUrl(preview.url)}
            accessibilityRole="link"
            accessibilityLabel={titleIsHost ? `Open ${host}` : title}
            style={[styles.card, { borderColor: brand.accent }]}
        >
            <LinearGradient
                colors={cardColors}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[styles.column, !showImage && styles.columnPad]}
            >
                {showImage ? (
                    <Image
                        source={{ uri: preview.imageUrl }}
                        style={styles.thumb}
                        resizeMode="cover"
                        onError={() => setImageFailed(true)}
                    />
                ) : null}
                <SiteLogo
                    url={preview.url}
                    fallbackIcon={brand.logo || 'link-outline'}
                    accent={brand.id === 'default' ? '#FFFFFF' : brand.accent}
                />
                <AuthorMark avatar={authorAvatar} name={authorName} />
                {showPublisher && newsName ? (
                    <Text style={styles.kicker} numberOfLines={1}>
                        {newsName}
                    </Text>
                ) : null}
                <Text style={[styles.title, showPublisher && newsName ? styles.titleAfterKicker : null]} numberOfLines={2}>
                    {title}
                </Text>
                {showDescription ? (
                    <Text style={styles.description} numberOfLines={2}>
                        {description}
                    </Text>
                ) : null}
                {showPublisher && !newsName ? (
                    <Text style={styles.host} numberOfLines={1}>
                        {publisher}
                    </Text>
                ) : null}
                {loading ? <Text style={styles.hint}>Loading preview</Text> : null}
                <View style={styles.cta} accessibilityRole="button" accessibilityLabel={ctaLabel}>
                    <Icon
                        name={
                            ctaLabel === 'Read Article'
                                ? 'newspaper-outline'
                                : brand.logo && brand.logo.startsWith('logo-')
                                  ? brand.logo
                                  : 'open-outline'
                        }
                        size={ox(16)}
                        color="#111827"
                    />
                    <Text style={styles.ctaText}>{ctaLabel}</Text>
                </View>
            </LinearGradient>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
        borderRadius: ox(22),
        overflow: 'hidden',
        borderWidth: 1,
        backgroundColor: CARD_BASE,
    },
    column: {
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: ox(18),
    },
    columnPad: {
        paddingTop: ox(18),
    },
    thumb: {
        width: '100%',
        height: ox(148),
        marginBottom: ox(16),
        backgroundColor: CARD_BASE,
    },
    logoWell: {
        width: ox(44),
        height: ox(44),
        borderRadius: ox(12),
        marginBottom: ox(12),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: 'rgba(15,23,42,0.55)',
    },
    logoImage: {
        width: ox(28),
        height: ox(28),
        borderRadius: ox(6),
    },
    avatarRing: {
        width: ox(72),
        height: ox(72),
        borderRadius: ox(36),
        padding: ox(1),
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarGap: {
        width: ox(64),
        height: ox(64),
        borderRadius: ox(32),
        padding: ox(3),
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: CARD_BASE,
    },
    kicker: {
        marginTop: ox(12),
        paddingHorizontal: ox(18),
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '800',
        letterSpacing: ox(1.1),
        textAlign: 'center',
    },
    titleAfterKicker: {
        marginTop: ox(4),
    },
    title: {
        marginTop: ox(12),
        paddingHorizontal: ox(18),
        color: '#FFFFFF',
        fontSize: ox(17),
        lineHeight: ox(22),
        fontWeight: '700',
        textAlign: 'center',
    },
    description: {
        marginTop: ox(4),
        paddingHorizontal: ox(18),
        color: 'rgba(255,255,255,0.82)',
        fontSize: ox(13),
        lineHeight: ox(18),
        fontWeight: '500',
        textAlign: 'center',
    },
    host: {
        marginTop: ox(4),
        paddingHorizontal: ox(18),
        color: 'rgba(255,255,255,0.7)',
        fontSize: ox(13),
        fontWeight: '600',
        textAlign: 'center',
    },
    hint: {
        marginTop: ox(6),
        color: 'rgba(255,255,255,0.6)',
        fontSize: ox(12),
        fontWeight: '600',
    },
    cta: {
        marginTop: ox(14),
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: ox(999),
        paddingHorizontal: ox(14),
        paddingVertical: ox(8),
    },
    ctaText: {
        marginLeft: ox(6),
        color: '#111827',
        fontSize: ox(14),
        fontWeight: '700',
    },
});
