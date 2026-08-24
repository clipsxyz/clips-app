import React, { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import type { LinkPreview } from '../types';
import { androidListSafeVideoProps } from '../utils/androidSafeVideoNative';
import {
    instagramSharePrompt,
    linkAttachmentHostLabel,
    linkPreviewNeedsInstagramPlaceholder,
    linkPreviewPlaybackUri,
    mediaRequestHeaders,
} from '../utils/linkPreview';
import GazetteerAlertSheet from './GazetteerAlertSheet.native';

type Props = {
    preview: LinkPreview;
    compact?: boolean;
};

export default function PostLinkPreviewCard({ preview, compact = false }: Props) {
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [videoFailed, setVideoFailed] = useState(false);
    const playbackUri = linkPreviewPlaybackUri(preview);
    const playInline = !videoFailed && Boolean(playbackUri);
    const showAttachmentChip = !playInline && linkPreviewNeedsInstagramPlaceholder(preview);
    const videoHeaders = playbackUri ? mediaRequestHeaders(playbackUri) : undefined;
    const imageHeaders = preview.imageUrl ? mediaRequestHeaders(preview.imageUrl) : undefined;
    const hostLabel = linkAttachmentHostLabel(preview.url);
    const instagramLine = instagramSharePrompt(preview.url);
    const cardTitle = instagramLine || preview.title?.trim() || hostLabel;
    const description = preview.description?.trim();
    const showDescription =
        Boolean(description) &&
        description !== cardTitle &&
        description.toLowerCase() !== 'view on instagram';

    const openLink = async () => {
        const withProtocol = /^https?:\/\//i.test(preview.url) ? preview.url : `https://${preview.url}`;
        try {
            await Linking.openURL(withProtocol);
        } catch (error) {
            console.error('Failed to open link preview:', error);
        }
    };

    return (
        <>
            <Pressable
                onPress={() => setConfirmVisible(true)}
                style={[
                    showAttachmentChip ? styles.chip : styles.card,
                    compact && !showAttachmentChip && styles.cardCompact,
                ]}
                accessibilityRole="link"
                accessibilityLabel={cardTitle}
            >
                {showAttachmentChip ? (
                    <>
                        <View style={styles.chipIcon}>
                            <Icon name="logo-instagram" size={22} color="rgba(255,255,255,0.92)" />
                        </View>
                        <View style={styles.chipText}>
                            <Text style={styles.chipTitle} numberOfLines={1}>
                                {cardTitle}
                            </Text>
                            <Text style={styles.chipHost} numberOfLines={1}>
                                {hostLabel}
                            </Text>
                        </View>
                    </>
                ) : playInline && playbackUri ? (
                    <Video
                        source={videoHeaders ? { uri: playbackUri, headers: videoHeaders } : { uri: playbackUri }}
                        style={[styles.cover, compact && styles.coverCompact]}
                        resizeMode="cover"
                        repeat={true}
                        muted={true}
                        paused={false}
                        controls={false}
                        pointerEvents="none"
                        ignoreSilentSwitch="ignore"
                        {...androidListSafeVideoProps()}
                        onError={() => setVideoFailed(true)}
                    />
                ) : preview.imageUrl ? (
                    <Image
                        source={imageHeaders ? { uri: preview.imageUrl, headers: imageHeaders } : { uri: preview.imageUrl }}
                        style={[styles.cover, compact && styles.coverCompact]}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.cover, compact && styles.coverCompact, styles.coverEmpty]} />
                )}
                {showAttachmentChip ? null : (
                    <View style={styles.infoPanel}>
                        {cardTitle ? (
                            <Text style={styles.title} numberOfLines={2}>
                                {cardTitle}
                            </Text>
                        ) : null}
                        {showDescription ? (
                            <Text style={styles.description} numberOfLines={2}>
                                {description}
                            </Text>
                        ) : null}
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{preview.source}</Text>
                        </View>
                    </View>
                )}
            </Pressable>
            <GazetteerAlertSheet
                visible={confirmVisible}
                title="Visit link?"
                message="You are about to open this link in your browser."
                icon="alert"
                showCancelButton
                confirmButtonText="Visit link"
                cancelButtonText="Cancel"
                onConfirm={() => {
                    setConfirmVisible(false);
                    void openLink();
                }}
                onDismiss={() => setConfirmVisible(false)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
        alignSelf: 'stretch',
        marginVertical: 10,
        overflow: 'hidden',
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: '#0B141C',
    },
    cardCompact: {
        marginVertical: 8,
    },
    chip: {
        width: '100%',
        alignSelf: 'stretch',
        height: 52,
        marginVertical: 8,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(8, 12, 18, 0.88)',
    },
    chipIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    chipText: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
    },
    chipTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        lineHeight: 18,
    },
    chipHost: {
        marginTop: 1,
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 16,
    },
    cover: {
        width: '100%',
        height: 200,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    coverCompact: {
        height: 112,
    },
    coverEmpty: {
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    infoPanel: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#0B141C',
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        lineHeight: 20,
    },
    description: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 18,
        color: 'rgba(255,255,255,0.58)',
    },
    badge: {
        alignSelf: 'flex-start',
        marginTop: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.85)',
    },
});
