import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import Avatar from './Avatar.native';
import VerifiedBadge from './VerifiedBadge.native';
import FeedDoubleTapLikeBurst from './FeedDoubleTapLikeBurst.native';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import PostHeaderOverlay from './PostHeaderOverlay.native';
import { useAuth } from '../context/Auth';
import { useResolvedAuthorAvatar } from '../hooks/useResolvedAuthorAvatar';
import { useMutualFollow } from '../hooks/useMutualFollow';
import { getReclipDisplay } from '../utils/feedPostMeta';
import { hasPendingFollowRequest, isProfilePrivate } from '../api/privacy';
import { resolveVerifiedAccountType } from '../utils/verifiedBadge';
import { getEffectiveTextStyleForPost } from '../utils/effectiveTextPostStyle';
import { isLikelyLightTextColor } from '../utils/feedTextBubble';
import { gradientColorsFromCss } from '../utils/storyTextStyleNative';
import { hasFinitePoint, safeLayoutNumber, safePositiveLayoutNumber } from '../utils/safeLayoutNative';

const DOUBLE_TAP_MS = 300;
const COLLAPSED_LINES = 8;
const AVATAR_SIZE = 88;
const BODY_FONT_SIZE = 16;
const BODY_LINE_HEIGHT = 22;

function nativeTextFontFamily(fontFamily?: string): string | undefined {
    if (!fontFamily?.trim() || fontFamily.includes(',')) return undefined;
    return fontFamily.trim();
}

function displayHandleLabel(handle: string): string {
    return handle.replace(/^@+/, '').trim() || 'User';
}

type Props = {
    post: Post;
    viewerHandle?: string | null;
    isCurrentUser: boolean;
    onDoubleLike: () => void;
    maxHeight: number;
    onFollow?: () => Promise<void>;
    onOpenDM?: (handle: string, postId: string) => void;
    onProfileMenuPress?: () => void;
    onOverflowPress?: () => void;
    onLocationPress?: (
        location: string,
        filterType?: 'location' | 'venue' | 'landmark',
    ) => void;
    onRegisterDmAnchor?: (key: string, ref: View | null) => void;
    menuAnchorRef?: React.Ref<View>;
};

export default function FeedTextOnlyCard({
    post,
    viewerHandle,
    isCurrentUser,
    onDoubleLike,
    maxHeight,
    onFollow,
    onOpenDM,
    onProfileMenuPress,
    onLocationPress,
    onRegisterDmAnchor,
    menuAnchorRef,
}: Props) {
    const { user } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
    const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
    const [burstKey, setBurstKey] = useState(0);
    const lastTapRef = useRef(0);
    const clearBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const text = post.text?.trim() || '';
    const canExpand = text.length > 220 || text.split('\n').length > 6;
    const effectiveStyle = useMemo(() => getEffectiveTextStyleForPost(post), [post]);
    const fontFamily = nativeTextFontFamily(effectiveStyle?.fontFamily);
    const safeMaxHeight = safePositiveLayoutNumber(maxHeight, 420);
    const background = String(effectiveStyle?.background || '#0b0b0d');
    const textColor = effectiveStyle?.color || '#FFFFFF';
    const parsedGradient = background.includes('gradient') ? gradientColorsFromCss(background) : [];
    const gradientColors = parsedGradient.length >= 2 ? parsedGradient : undefined;
    const solidBackground = background.startsWith('#') ? background : '#0b0b0d';
    const moreColor = isLikelyLightTextColor(textColor)
        ? 'rgba(255,255,255,0.7)'
        : 'rgba(15,23,42,0.55)';

    const { displayHandle, profileHandle } = getReclipDisplay(post, viewerHandle ?? user?.handle);
    const safeHandle = displayHandleLabel(displayHandle || post.userHandle || 'User');
    const safeProfileHandle = String(profileHandle || post.userHandle || safeHandle).trim() || safeHandle;
    const isFollowing = post.isFollowing === true;
    const viewer = viewerHandle ?? user?.handle;
    const hasPendingRequest = Boolean(
        !isCurrentUser &&
            !isFollowing &&
            viewer &&
            isProfilePrivate(safeProfileHandle) &&
            hasPendingFollowRequest(viewer, safeProfileHandle),
    );
    const isMutualFollow = useMutualFollow(post, isCurrentUser);
    const verifiedAccountType = resolveVerifiedAccountType(
        isCurrentUser ? user?.accountType : post.userAccountType,
    );
    const avatarSrc = useResolvedAuthorAvatar({
        handle: safeProfileHandle,
        explicitUrl: (isCurrentUser ? user?.avatarUrl : undefined) || post.userAvatarUrl,
        viewerHandle: viewer,
        viewerAvatarUrl: user?.avatarUrl,
    });

    const resolveLocalTap = (e: GestureResponderEvent): { x: number; y: number } => {
        const { locationX, locationY } = e.nativeEvent;
        if (
            typeof locationX === 'number' &&
            typeof locationY === 'number' &&
            hasFinitePoint(locationX, locationY)
        ) {
            return { x: safeLayoutNumber(locationX), y: safeLayoutNumber(locationY) };
        }
        if (cardSize.width > 0 && cardSize.height > 0) {
            return { x: cardSize.width / 2, y: cardSize.height / 2 };
        }
        return { x: 0, y: 0 };
    };

    const handlePress = (e: GestureResponderEvent) => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;
        if (timeSinceLastTap < DOUBLE_TAP_MS) {
            const local = resolveLocalTap(e);
            if (hasFinitePoint(local.x, local.y)) {
                setTapPosition(local);
                setBurstKey((k) => k + 1);
            }
            onDoubleLike();
            if (clearBurstTimerRef.current) clearTimeout(clearBurstTimerRef.current);
            clearBurstTimerRef.current = setTimeout(() => {
                setTapPosition(null);
                clearBurstTimerRef.current = null;
            }, 500);
        }
        lastTapRef.current = now;
    };

    const cardFillStyle = [
        styles.card,
        { maxHeight: safeMaxHeight },
        gradientColors ? null : { backgroundColor: solidBackground },
    ];

    const cardInner = (
        <>
            <View
                style={styles.avatarWrap}
                ref={(r) => {
                    onRegisterDmAnchor?.(`post:${post.id}`, r);
                    onRegisterDmAnchor?.(`handle:${post.userHandle || safeHandle}`, r);
                }}
                collapsable={false}
            >
                <Pressable onPress={onProfileMenuPress} accessibilityLabel="Open profile">
                    <View style={styles.avatarRing}>
                        <Avatar
                            src={avatarSrc}
                            name={safeHandle.split('@')[0] || 'User'}
                            handle={safeProfileHandle}
                            size={AVATAR_SIZE}
                        />
                    </View>
                </Pressable>
                {!isCurrentUser && onFollow && !isFollowing && !hasPendingRequest ? (
                    <Pressable style={styles.followPlus} onPress={() => void onFollow()}>
                        <Icon name="add" size={12} color="#FFFFFF" />
                    </Pressable>
                ) : null}
                {!isCurrentUser && hasPendingRequest ? (
                    <View style={styles.requestedPill} pointerEvents="none">
                        <Text style={styles.requestedPillText}>Req</Text>
                    </View>
                ) : null}
                {!isCurrentUser && isMutualFollow && onOpenDM ? (
                    <Pressable
                        style={styles.dmButton}
                        onPress={() => onOpenDM(post.userHandle, post.id)}
                        accessibilityLabel="Send message"
                    >
                        <Icon name="paper-plane" size={11} color="#EF4444" />
                    </Pressable>
                ) : null}
                {!isCurrentUser && isFollowing && onFollow && !isMutualFollow ? (
                    <Pressable style={styles.followCheck} onPress={() => void onFollow()}>
                        <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </Pressable>
                ) : null}
            </View>

            <Pressable
                onPress={onProfileMenuPress}
                style={styles.handleRow}
                accessibilityLabel="Open profile"
            >
                <Text style={[styles.handle, { color: textColor }]} numberOfLines={1}>
                    {safeHandle}
                </Text>
                <VerifiedBadge accountType={verifiedAccountType} size={16} />
            </Pressable>

            <Text
                style={[
                    styles.body,
                    {
                        color: textColor,
                        fontSize: BODY_FONT_SIZE,
                        lineHeight: BODY_LINE_HEIGHT,
                    },
                    fontFamily ? { fontFamily } : null,
                ]}
                numberOfLines={expanded ? undefined : COLLAPSED_LINES}
            >
                {text}
            </Text>
            {canExpand ? (
                <Pressable
                    onPress={(e) => {
                        e.stopPropagation?.();
                        setExpanded((v) => !v);
                    }}
                    hitSlop={8}
                >
                    <Text style={[styles.more, { color: moreColor }]}>
                        {expanded ? 'Show less' : 'Show more'}
                    </Text>
                </Pressable>
            ) : null}
        </>
    );

    return (
        <Pressable onPress={handlePress} accessibilityLabel="Double tap to like">
            <View
                ref={menuAnchorRef}
                collapsable={false}
                style={styles.cardHost}
                onLayout={(ev) => {
                    const { width: w, height: h } = ev.nativeEvent.layout;
                    if (w > 0 && h > 0) setCardSize({ width: w, height: h });
                }}
            >
                {gradientColors ? (
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={cardFillStyle}
                    >
                        {cardInner}
                    </LinearGradient>
                ) : (
                    <View style={cardFillStyle}>{cardInner}</View>
                )}
                <PostHeaderOverlay post={post} onLocationPress={onLocationPress} />
                {post.stickers && post.stickers.length > 0 && cardSize.width > 0 ? (
                    <FeedStickerOverlays
                        stickers={post.stickers}
                        containerWidth={cardSize.width}
                        containerHeight={cardSize.height}
                    />
                ) : null}
                {tapPosition ? (
                    <FeedDoubleTapLikeBurst key={burstKey} x={tapPosition.x} y={tapPosition.y} />
                ) : null}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    cardHost: {
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
    card: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingTop: 44,
        paddingBottom: 32,
        overflow: 'hidden',
    },
    avatarWrap: {
        position: 'relative',
        marginBottom: 16,
    },
    avatarRing: {
        padding: 2,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
    },
    handleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        maxWidth: '100%',
        marginBottom: 12,
        paddingHorizontal: 8,
    },
    handle: {
        fontSize: 17,
        fontWeight: '700',
        maxWidth: '80%',
    },
    body: {
        fontWeight: '400',
        textAlign: 'center',
        width: '100%',
    },
    more: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        textDecorationLine: 'underline',
    },
    followPlus: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#0b0b0d',
    },
    requestedPill: {
        position: 'absolute',
        right: -10,
        bottom: -2,
        minWidth: 28,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: 'rgba(61, 155, 143, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#0b0b0d',
    },
    requestedPillText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '700',
    },
    dmButton: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    followCheck: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#0b0b0d',
    },
});
