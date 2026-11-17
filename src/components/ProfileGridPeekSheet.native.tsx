import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Modal,
    Platform,
    Pressable,
    Share,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Mask, Rect, Stop } from 'react-native-svg';
import type { Post } from '../types';
import CachedImage from './CachedImage.native';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { resolvePostThumbnail } from '../api/collections';
import {
    isVideoMediaUri,
    postHasVideoMedia,
    resolvePostPlaybackUri,
    siblingJpegFromVideoUrl,
} from '../utils/postMedia';
import { withFeedVideoCache } from '../utils/feedVideoSourceNative';
import {
    getPostBodyText,
    getTextOnlyBackgroundColor,
    getTextOnlyTextColor,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { isTextCardStyleId, TEXT_CARD_STYLES } from '../utils/textCardStyles';
import { formatProfileDisplayHandle } from '../utils/profileShareUrl';
import { androidListSafeVideoProps } from '../utils/androidSafeVideoNative';
import { setImageFullscreenLaunch } from '../utils/imageFullscreenLaunchNative';
import { setScenesLaunchPayload } from '../utils/scenesLaunchNative';
import { setScenesViewerActive } from '../utils/scenesViewerActiveNative';
import { buildShareablePostUrl } from '../utils/shareUrls';

export type ProfileGridTapOrigin = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type Frame = {
    top: number;
    left: number;
    width: number;
    height: number;
};

type Nav = {
    navigate: (name: string, params?: object) => void;
};

const ACTIONS_ROW = 52;
const STACK_GAP = 12;
const ACTION_BORDER = 2;
const MEDIA_RADIUS = 28;
const TILE_RADIUS = 8;

/** Draws the spectrum edge above a video. Android TextureView ignores a rounded parent, so the stroke has to sit on top. */
function TileSpectrumEdge({ width, height }: { width: number; height: number }) {
    const stroke = ACTION_BORDER;
    const inset = stroke / 2;
    return (
        <Svg width={width} height={height} style={styles.tileEdge} pointerEvents="none">
            <Defs>
                <SvgGradient id="profileTileSpectrum" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#22C55E" />
                    <Stop offset="0.5" stopColor="#FFD400" />
                    <Stop offset="1" stopColor="#FF4D9A" />
                </SvgGradient>
                <Mask id="profileTileOutside">
                    <Rect width={width} height={height} fill="#FFFFFF" />
                    <Rect width={width} height={height} rx={MEDIA_RADIUS} ry={MEDIA_RADIUS} fill="#000000" />
                </Mask>
            </Defs>
            <Rect
                width={width}
                height={height}
                fill="rgba(0,0,0,0.72)"
                mask="url(#profileTileOutside)"
            />
            <Rect
                x={inset}
                y={inset}
                width={Math.max(0, width - stroke)}
                height={Math.max(0, height - stroke)}
                rx={MEDIA_RADIUS - inset}
                ry={MEDIA_RADIUS - inset}
                stroke="url(#profileTileSpectrum)"
                strokeWidth={stroke}
                fill="none"
            />
        </Svg>
    );
}

export type ProfileGridTapAction = {
    label: string;
    icon: string;
    onPress: () => void;
};

/** First real MP4. Profile rows sometimes keep a JPEG in mediaUrl and the file in mediaItems. */
function cardPlaybackUri(post: Post): string | undefined {
    const items = post.mediaItems || [];
    const videoItem = items.find(
        (item) => item?.type === 'video' || isVideoMediaUri(item?.url),
    );
    const fromItem = videoItem
        ? resolvePostPlaybackUri(post, videoItem) || videoItem.url
        : undefined;
    const raw = fromItem && isVideoMediaUri(fromItem) ? fromItem : resolvePostPlaybackUri(post);
    return raw && isVideoMediaUri(raw) ? raw : fromItem || raw;
}

function stillUri(post: Post): string | undefined {
    const thumb = resolvePostThumbnail(post);
    if (thumb && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(thumb)) return thumb;
    const item = (post.mediaItems || []).find((entry) => entry?.url);
    const jpeg = siblingJpegFromVideoUrl(item?.url || post.mediaUrl);
    return jpeg || post.videoPosterUrl || undefined;
}

function cardFrame(
    screenW: number,
    screenH: number,
    topInset: number,
    bottomInset: number,
    actionCount: number,
): Frame {
    const actionsHeight = ACTIONS_ROW * Math.max(1, actionCount) + ACTION_BORDER * 2;
    const cardW = Math.round(Math.min(screenW * 0.78, 340));
    const available = screenH - topInset - bottomInset - actionsHeight - STACK_GAP - 28;
    const cardH = Math.max(220, Math.min(Math.round(cardW * (16 / 9)), available));
    const stackH = cardH + STACK_GAP + actionsHeight;
    const top = Math.max(topInset + 8, Math.round((screenH - stackH) / 2));
    const left = Math.round((screenW - cardW) / 2);
    return { top, left, width: cardW, height: cardH };
}

/** Open the existing fullscreen viewer for a profile-grid clip. */
export function openProfileGridInFullscreen(navigation: Nav, post: Post, peers: Post[]): void {
    if (isVideoPost(post) || postHasVideoMedia(post)) {
        const videos = peers.filter((item) => isVideoPost(item) || postHasVideoMedia(item));
        const list = videos.some((item) => String(item.id) === String(post.id)) ? videos : [post, ...videos];
        setScenesViewerActive(true);
        setScenesLaunchPayload({
            initialPostId: String(post.id),
            posts: list.length ? list : [post],
            initialMuted: false,
            feedLabel: 'Profile',
        });
        navigation.navigate('Scenes', {
            initialPostId: String(post.id),
            initialMuted: false,
            feedLabel: 'Profile',
        });
        return;
    }
    setImageFullscreenLaunch({
        post,
        startIndex: 0,
        handlers: {
            onShare: () => {
                const url = buildShareablePostUrl(post);
                void Share.share({ message: url, url });
            },
        },
    });
    navigation.navigate('ImageFullscreenModal', { postId: String(post.id) });
}

export function ProfileGridTapCell({
    post,
    style,
    children,
    onOpen,
}: {
    post: Post;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    onOpen: (post: Post, origin: ProfileGridTapOrigin) => void;
}) {
    const ref = useRef<View>(null);
    return (
        <Pressable
            style={style}
            onPress={() => {
                const node = ref.current;
                if (!node) {
                    onOpen(post, { x: 0, y: 0, width: 0, height: 0 });
                    return;
                }
                node.measureInWindow((x, y, width, height) => {
                    onOpen(post, { x, y, width, height });
                });
            }}
        >
            <View ref={ref} collapsable={false} style={styles.cellFill}>
                {children}
            </View>
        </Pressable>
    );
}

type Props = {
    post: Post;
    origin: ProfileGridTapOrigin;
    profileHandle: string;
    onClose: () => void;
    onAddToStory?: () => void;
    onShare?: () => void;
    onViewFullscreen?: () => void;
    /** Replaces Add to Story, Share, and View in fullscreen. */
    actions?: ProfileGridTapAction[];
};

export default function ProfileGridPeekSheet({
    post,
    origin,
    profileHandle,
    onClose,
    onAddToStory,
    onShare,
    onViewFullscreen,
    actions,
}: Props) {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const progress = useRef(new Animated.Value(0)).current;
    const [ready, setReady] = useState(false);
    const [videoFrameReady, setVideoFrameReady] = useState(false);
    const [cardMuted, setCardMuted] = useState(true);
    const actionRows = actions ?? [
        { label: 'Add to Story', icon: 'sparkles-outline', onPress: () => onAddToStory?.() },
        { label: 'Share', icon: 'paper-plane-outline', onPress: () => onShare?.() },
        { label: 'View in fullscreen', icon: 'expand-outline', onPress: () => onViewFullscreen?.() },
    ];
    const target = useMemo(
        () => cardFrame(width, height, insets.top, insets.bottom, actionRows.length),
        [actionRows.length, height, insets.bottom, insets.top, width],
    );
    const from = origin.width > 8 ? origin : { x: target.left, y: target.top, width: target.width, height: target.height };

    useEffect(() => {
        progress.setValue(0);
        setReady(false);
        setVideoFrameReady(false);
        setCardMuted(true);
        Animated.timing(progress, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) setReady(true);
        });
    }, [post.id, progress]);

    const close = () => {
        setReady(false);
        Animated.timing(progress, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) onClose();
        });
    };

    const shellStyle = {
        left: progress.interpolate({ inputRange: [0, 1], outputRange: [from.x, target.left] }),
        top: progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, target.top] }),
        width: progress.interpolate({ inputRange: [0, 1], outputRange: [from.width, target.width] }),
        height: progress.interpolate({ inputRange: [0, 1], outputRange: [from.height, target.height] }),
        borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [TILE_RADIUS, MEDIA_RADIUS] }),
    };
    const fadeIn = {
        opacity: progress.interpolate({ inputRange: [0.62, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    };
    const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

    const video = isVideoPost(post) || postHasVideoMedia(post);
    const playbackRaw = video ? cardPlaybackUri(post) : undefined;
    const playback = playbackRaw ? resolvePublicMediaUrl(playbackRaw) || playbackRaw : undefined;
    const posterRaw = stillUri(post);
    const poster = posterRaw ? resolvePublicMediaUrl(posterRaw) || posterRaw : undefined;
    const imageRaw = !video ? stillUri(post) || post.mediaUrl : undefined;
    const imageUri = imageRaw ? resolvePublicMediaUrl(imageRaw) || imageRaw : undefined;
    const caption = getPostBodyText(post);
    const handleLabel = formatProfileDisplayHandle(profileHandle || post.userHandle);
    const card = isTextCardStyleId(post.cardStyle) ? TEXT_CARD_STYLES[post.cardStyle] : null;

    const textBody = (
        <Text
            style={[styles.textBody, { color: card?.textColor || getTextOnlyTextColor(post) }]}
            numberOfLines={10}
        >
            {caption || 'Post'}
        </Text>
    );

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
                </Animated.View>

                {ready ? (
                <View
                    style={[
                        styles.mediaCard,
                        video && playback ? styles.videoCard : null,
                        {
                            left: target.left,
                            top: target.top,
                            width: target.width,
                            height: target.height,
                            borderRadius: MEDIA_RADIUS,
                        },
                    ]}
                >
                <LinearGradient
                    colors={['#22C55E', '#FFD400', '#FF4D9A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.mediaGradient, { borderRadius: MEDIA_RADIUS }]}
                >
                <View
                    style={[
                        styles.mediaInner,
                        video && playback ? styles.videoCard : null,
                        {
                            width: target.width - ACTION_BORDER * 2,
                            height: target.height - ACTION_BORDER * 2,
                            borderRadius: MEDIA_RADIUS - ACTION_BORDER,
                        },
                    ]}
                >
                    {video && playback ? (
                        <>
                            {poster ? (
                                <CachedImage
                                    source={{ uri: poster }}
                                    style={[StyleSheet.absoluteFill, videoFrameReady ? styles.posterHidden : null]}
                                    resizeMode="cover"
                                />
                            ) : null}
                            {ready ? (
                                    <View
                                    style={{
                                        width: target.width - ACTION_BORDER * 2,
                                        height: target.height - ACTION_BORDER * 2,
                                    }}
                                    collapsable={false}
                                >
                                    <Video
                                        source={withFeedVideoCache({ uri: playback })}
                                        style={{
                                            width: target.width - ACTION_BORDER * 2,
                                            height: target.height - ACTION_BORDER * 2,
                                        }}
                                        resizeMode="cover"
                                        muted={cardMuted}
                                        repeat
                                        paused={false}
                                        playInBackground={false}
                                        playWhenInactive={false}
                                        ignoreSilentSwitch="ignore"
                                        useTextureView
                                        pointerEvents="none"
                                        onReadyForDisplay={() => setVideoFrameReady(true)}
                                        {...androidListSafeVideoProps()}
                                    />
                                </View>
                            ) : null}
                        </>
                    ) : imageUri ? (
                        <CachedImage source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : card && card.colors.length >= 2 ? (
                        <LinearGradient colors={card.colors as [string, string, ...string[]]} style={styles.textFill}>
                            {textBody}
                        </LinearGradient>
                    ) : (
                        <View style={[styles.textFill, { backgroundColor: card?.colors[0] || getTextOnlyBackgroundColor(post) }]}>
                            {textBody}
                        </View>
                    )}
                    <Animated.View style={[styles.handleBar, fadeIn]} pointerEvents="none">
                        <Text style={styles.handleText} numberOfLines={1}>
                            {handleLabel}
                        </Text>
                    </Animated.View>
                    {video && playback ? (
                        <Pressable
                            style={styles.muteButton}
                            onPress={() => setCardMuted((current) => !current)}
                            accessibilityLabel={cardMuted ? 'Unmute video' : 'Mute video'}
                        >
                            <Icon
                                name={cardMuted ? 'volume-mute' : 'volume-high'}
                                size={13}
                                color="#FFFFFF"
                            />
                        </Pressable>
                    ) : null}
                </View>
                </LinearGradient>
                {video && playback ? <TileSpectrumEdge width={target.width} height={target.height} /> : null}
                </View>
                ) : (
                <Animated.View style={[styles.mediaCard, shellStyle]}>
                    <LinearGradient
                        colors={['#22C55E', '#FFD400', '#FF4D9A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.mediaGradient}
                    >
                        <View style={[styles.mediaInner, { borderRadius: MEDIA_RADIUS - ACTION_BORDER }]}>
                    {poster || imageUri ? (
                        <CachedImage
                            source={{ uri: (video ? poster : imageUri) || imageUri || poster || '' }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.textFill, { backgroundColor: card?.colors[0] || getTextOnlyBackgroundColor(post) }]}>
                            {textBody}
                        </View>
                    )}
                        </View>
                    </LinearGradient>
                </Animated.View>
                )}

                <Animated.View
                    pointerEvents={ready ? 'auto' : 'none'}
                    style={[
                        styles.actionsFrame,
                        fadeIn,
                        { top: target.top + target.height + STACK_GAP, left: target.left, width: target.width },
                    ]}
                >
                    <LinearGradient
                        colors={['#22C55E', '#FFD400', '#FF4D9A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.actionsGradient}
                    >
                    <View style={styles.actions}>
                    {actionRows.map((action, index) => (
                        <View key={action.label}>
                            {index > 0 ? <View style={styles.divider} /> : null}
                            <Pressable style={styles.actionRow} onPress={action.onPress}>
                                <Text style={styles.actionLabel}>{action.label}</Text>
                                <Icon name={action.icon} size={20} color="#FFFFFF" />
                            </Pressable>
                        </View>
                    ))}
                    </View>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    backdrop: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    cellFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    mediaCard: {
        position: 'absolute',
        overflow: 'hidden',
    },
    mediaGradient: {
        flex: 1,
        padding: ACTION_BORDER,
    },
    mediaInner: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#111111',
    },
    /** TextureView on Android does not draw inside an overflow-hidden parent. */
    videoCard: {
        overflow: 'visible',
    },
    tileEdge: {
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 40,
        elevation: 40,
    },
    posterHidden: {
        opacity: 0,
    },
    textFill: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    textBody: {
        textAlign: 'center',
        fontSize: 22,
        lineHeight: 28,
        fontWeight: '700',
    },
    handleBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: 'rgba(88, 82, 76, 0.88)',
    },
    handleText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    muteButton: {
        position: 'absolute',
        right: 12,
        bottom: 56,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.55)',
        zIndex: 80,
        elevation: Platform.OS === 'android' ? 80 : 0,
    },
    actionsFrame: {
        position: 'absolute',
    },
    actionsGradient: {
        borderRadius: MEDIA_RADIUS,
        padding: ACTION_BORDER,
    },
    actions: {
        borderRadius: MEDIA_RADIUS - ACTION_BORDER,
        backgroundColor: '#000000',
        overflow: 'hidden',
    },
    actionRow: {
        minHeight: ACTIONS_ROW,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    actionLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 16,
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
});
