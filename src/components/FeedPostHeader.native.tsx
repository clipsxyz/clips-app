import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import { getAvatarForHandle } from '../api/users';
import { useMutualFollow } from '../hooks/useMutualFollow';
import { useFollowState } from '../hooks/useFollowState';
import StoryRingAvatar from './StoryRingAvatar.native';
import VerifiedBadge from './VerifiedBadge.native';
import { getPostSocialSourceLabel, getReclipDisplay } from '../utils/feedPostMeta';
import { FEED_UI } from '../constants/feedUiTokens';
import { hasPendingFollowRequest, isProfilePrivate } from '../api/privacy';
import { resolveVerifiedAccountType } from '../utils/verifiedBadge';
import { FEED_CARD_CHROME_BG } from './FeedPageLayout.native';

/** Outer slot including ring + Instagram standoff so the photo stays ~30px. */
const FEED_HEADER_AVATAR_SIZE = 36;
/** Compact overlay badge (follow +, DM, follow check, request pill). */
const FEED_HEADER_BADGE_SIZE = 10;
const FEED_HEADER_BADGE_ICON = 6;

export type FeedPostHeaderProps = {
    post: Post;
    viewerHandle?: string | null;
    isCurrentUser: boolean;
    isOverlaid?: boolean;
    /** Top chrome for text-only feed (avatar + handle on transparent canvas). */
    variant?: 'default' | 'textOnlyChrome';
    onFollow?: () => Promise<void>;
    onOpenDM?: (handle: string, postId: string, isMutual?: boolean) => void;
    onProfileMenuPress?: () => void;
    /**
     * Avatar tap. Receives the live "has unviewed active stories" value so the
     * caller can open the story player, or fall back to the profile screen.
     */
    onAvatarPress?: (hasStory: boolean) => void;
    onOverflowPress?: () => void;
    onHasStoryChange?: (hasStory: boolean) => void;
    menuAnchorRef?: React.Ref<View>;
};

export default function FeedPostHeader({
    post,
    viewerHandle,
    isCurrentUser,
    isOverlaid = false,
    variant = 'default',
    onFollow,
    onOpenDM,
    onProfileMenuPress,
    onAvatarPress,
    onOverflowPress,
    onHasStoryChange,
    menuAnchorRef,
}: FeedPostHeaderProps) {
    const { user } = useAuth();
    const [showFollowCheck, setShowFollowCheck] = useState(post.isFollowing === true);

    const { isReclip, displayHandle, profileHandle } = getReclipDisplay(post, viewerHandle ?? user?.handle);
    const safeHandle = String(displayHandle || post.userHandle || 'User').trim() || 'User';
    const safeProfileHandle = String(profileHandle || post.userHandle || safeHandle).trim() || safeHandle;
    const socialSourceLabel = getPostSocialSourceLabel(post);
    const isMutualFollow = useMutualFollow(post, isCurrentUser);
    const viewer = viewerHandle ?? user?.handle;
    const isFollowingFromProps = post.isFollowing === true;
    const hasPendingRequestFromProps = Boolean(
        !isCurrentUser &&
            !isFollowingFromProps &&
            viewer &&
            isProfilePrivate(safeProfileHandle) &&
            hasPendingFollowRequest(viewer, safeProfileHandle),
    );
    // Live follow state keyed on the author handle: a follow/unfollow on View Profile
    // (or a quick menu) updates this header immediately, without a feed refetch.
    const { isFollowing, hasPendingRequest } = useFollowState({
        userId: post.user_id,
        handle: safeProfileHandle,
        isFollowing: isFollowingFromProps,
        hasPendingRequest: hasPendingRequestFromProps,
    });

    const avatarSrc = isCurrentUser
        ? user?.avatarUrl || post.avatarUrl || getAvatarForHandle(safeProfileHandle)
        : post.avatarUrl || getAvatarForHandle(safeProfileHandle);

    const verifiedAccountType = resolveVerifiedAccountType(
        isCurrentUser ? user?.accountType : post.userAccountType,
    );

    const textPrimary = isOverlaid ? '#FFFFFF' : '#F3F4F6';
    const textMuted = isOverlaid ? 'rgba(255,255,255,0.9)' : '#9CA3AF';
    const reclipColor = isOverlaid ? 'rgba(255,255,255,0.9)' : '#9CA3AF';

    const viewerId = user?.id != null ? String(user.id) : undefined;

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (!isCurrentUser && onFollow && isFollowing) {
            setShowFollowCheck(true);
            timer = setTimeout(() => setShowFollowCheck(false), 2500);
        } else {
            setShowFollowCheck(false);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isFollowing, isCurrentUser, onFollow]);

    const showAvatar = variant === 'default' || variant === 'textOnlyChrome';

    const avatarBlock = showAvatar ? (
        <View
            style={[styles.avatarWrap, { width: FEED_HEADER_AVATAR_SIZE, height: FEED_HEADER_AVATAR_SIZE }]}
            collapsable={false}
        >
            <View style={styles.avatarHit}>
                <StoryRingAvatar
                    handle={safeProfileHandle}
                    src={avatarSrc}
                    name={safeHandle.replace(/^@/, '').split('@')[0] || 'User'}
                    size={FEED_HEADER_AVATAR_SIZE}
                    viewerId={viewerId}
                    onHasStoryChange={onHasStoryChange}
                    onPress={(unseen) => {
                        if (onAvatarPress) {
                            onAvatarPress(unseen);
                            return;
                        }
                        onProfileMenuPress?.();
                    }}
                />
            </View>
            {!isCurrentUser && onFollow && !isFollowing && !hasPendingRequest ? (
                <TouchableOpacity style={styles.followPlus} onPress={() => void onFollow()}>
                    <Icon name="add" size={FEED_HEADER_BADGE_ICON} color="#FFFFFF" />
                </TouchableOpacity>
            ) : null}
            {!isCurrentUser && hasPendingRequest ? (
                <View style={styles.requestedPill} pointerEvents="none">
                    <Text style={styles.requestedPillText}>Req</Text>
                </View>
            ) : null}
            {!isCurrentUser && isMutualFollow && onOpenDM ? (
                <TouchableOpacity
                    style={styles.dmButton}
                    onPress={() => {
                        const handle = (post.userHandle || safeHandle).trim();
                        if (!handle) return;
                        onOpenDM(handle, post.id, true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${safeHandle}`}
                >
                    <Icon name="paper-plane" size={FEED_HEADER_BADGE_ICON} color="#EF4444" />
                </TouchableOpacity>
            ) : null}
            {!isCurrentUser && isFollowing && !isMutualFollow && showFollowCheck ? (
                <View style={styles.followCheck}>
                    <Icon name="checkmark" size={FEED_HEADER_BADGE_ICON} color="#FFFFFF" />
                </View>
            ) : null}
        </View>
    ) : null;

    const handleRow = (
        <TouchableOpacity onPress={onProfileMenuPress} activeOpacity={0.85} style={styles.handleBtn}>
            <Text style={[styles.handleText, { color: textPrimary }]} numberOfLines={1}>
                {safeHandle}
            </Text>
            <VerifiedBadge accountType={verifiedAccountType} size={FEED_UI.icon.flag} />
        </TouchableOpacity>
    );

    const chrome = (
        <View style={[styles.row, variant === 'textOnlyChrome' && styles.textOnlyRow]}>
            <View style={styles.left}>
                {isReclip ? (
                    <View style={styles.reclipRow}>
                        <Icon name="repeat" size={FEED_UI.type.reclip} color={reclipColor} />
                        <Text style={[styles.reclipText, { color: reclipColor }]} numberOfLines={1}>
                            {String(post.userHandle || safeHandle).trim() || 'User'} reclipped
                        </Text>
                    </View>
                ) : null}
                <View style={styles.identityRow}>
                    {avatarBlock}
                    {handleRow}
                </View>
                {socialSourceLabel ? (
                    <View
                        style={[
                            styles.socialPill,
                            isOverlaid ? styles.socialPillOverlay : styles.socialPillDefault,
                        ]}
                    >
                        <Text
                            style={[
                                styles.socialPillText,
                                { color: isOverlaid ? 'rgba(255,255,255,0.95)' : '#D1D5DB' },
                            ]}
                        >
                            {socialSourceLabel}
                        </Text>
                    </View>
                ) : null}
            </View>
            <View style={styles.right}>
                {onOverflowPress ? (
                    <GesturePressable
                        onPress={onOverflowPress}
                        style={styles.overflowBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Post options"
                    >
                        <Icon
                            name="list-outline"
                            size={16}
                            color={isOverlaid ? '#FFFFFF' : '#9CA3AF'}
                        />
                    </GesturePressable>
                ) : null}
            </View>
        </View>
    );

    if (variant === 'textOnlyChrome') {
        return (
            <View ref={menuAnchorRef} collapsable={false} style={styles.textOnlyChromeWrap}>
                {chrome}
            </View>
        );
    }

    return (
        <View
            ref={menuAnchorRef}
            collapsable={false}
            style={[styles.wrap, isOverlaid && styles.wrapOverlaid]}
            pointerEvents="box-none"
        >
            {!isOverlaid ? null : (
                <LinearGradient
                    colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.35)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
            )}
            <View style={styles.content}>{chrome}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Web PostHeader: `px-3 pt-3 pb-2`
    wrap: {
        position: 'relative',
        width: '100%',
        minHeight: 56,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
        justifyContent: 'center',
        backgroundColor: FEED_CARD_CHROME_BG,
        overflow: 'hidden',
    },
    wrapOverlaid: {
        backgroundColor: 'transparent',
        // No elevation — elevated full-width headers steal media taps on Android even with box-none.
    },
    content: {
        zIndex: 1,
    },
    textOnlyChromeWrap: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 0,
        marginBottom: 0,
        backgroundColor: 'transparent',
        zIndex: 10,
    },
    textOnlyRow: {
        paddingHorizontal: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    left: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        minWidth: 0,
        paddingRight: 8,
        gap: 2,
    },
    /** Avatar + handle share one baseline so the photo sits mid-line with the name. */
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        maxWidth: '100%',
        height: FEED_HEADER_AVATAR_SIZE,
    },
    right: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 2,
        flexShrink: 0,
    },
    avatarWrap: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        // Fixed slot = photo size; story ring may paint outside without shifting the handle.
        overflow: 'visible',
    },
    avatarHit: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    followPlus: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: FEED_HEADER_BADGE_SIZE,
        height: FEED_HEADER_BADGE_SIZE,
        borderRadius: FEED_HEADER_BADGE_SIZE / 2,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#000000',
    },
    requestedPill: {
        position: 'absolute',
        right: -4,
        bottom: -2,
        minWidth: 22,
        height: FEED_HEADER_BADGE_SIZE,
        paddingHorizontal: 3,
        borderRadius: FEED_HEADER_BADGE_SIZE / 2,
        backgroundColor: 'rgba(61, 155, 143, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#000000',
    },
    requestedPillText: {
        color: '#FFFFFF',
        fontSize: 7,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    dmButton: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: FEED_HEADER_BADGE_SIZE,
        height: FEED_HEADER_BADGE_SIZE,
        borderRadius: FEED_HEADER_BADGE_SIZE / 2,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#000000',
    },
    followCheck: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: FEED_HEADER_BADGE_SIZE,
        height: FEED_HEADER_BADGE_SIZE,
        borderRadius: FEED_HEADER_BADGE_SIZE / 2,
        backgroundColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#000000',
    },
    reclipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    // Web: `text-xs` — optically bumped for phone Instagram weight
    reclipText: {
        fontSize: FEED_UI.type.reclip,
    },
    handleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        flexShrink: 1,
        minWidth: 0,
        height: FEED_HEADER_AVATAR_SIZE,
    },
    // Web feed: `text-xs font-semibold`
    handleText: {
        fontSize: FEED_UI.type.handle,
        fontWeight: '600',
        flexShrink: 1,
        includeFontPadding: false,
        textAlignVertical: 'center',
        lineHeight: FEED_UI.type.handle + 2,
    },
    socialPill: {
        alignSelf: 'flex-start',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginTop: 2,
        borderWidth: 1,
    },
    socialPillOverlay: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderColor: 'rgba(255,255,255,0.25)',
    },
    socialPillDefault: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.12)',
    },
    socialPillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    // Web: `p-2 min-w/h-[40px]`, icon `w-4 h-4`
    overflowBtn: {
        minWidth: 40,
        minHeight: 40,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
