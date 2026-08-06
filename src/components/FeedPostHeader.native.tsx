import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { userHasStoriesByHandle, userHasUnviewedStoriesByHandle } from '../api/stories';
import { useMutualFollow } from '../hooks/useMutualFollow';
import Avatar from './Avatar';
import Flag from './Flag.native';
import FeedPostMetaCarousel from './FeedPostMetaCarousel.native';
import {
    buildPostMetadataItems,
    getPostSocialSourceLabel,
    getReclipDisplay,
} from '../utils/feedPostMeta';
import { FEED_UI } from '../constants/feedUiTokens';
import { hasPendingFollowRequest, isProfilePrivate } from '../api/privacy';

export type FeedPostHeaderProps = {
    post: Post;
    viewerHandle?: string | null;
    isCurrentUser: boolean;
    isOverlaid?: boolean;
    /** Top chrome only (text-only feed); avatar lives beside the bubble. */
    variant?: 'default' | 'textOnlyChrome';
    onFollow?: () => Promise<void>;
    onOpenDM?: (handle: string, postId: string) => void;
    onProfileMenuPress?: () => void;
    onOverflowPress?: () => void;
    onRegisterDmAnchor?: (key: string, ref: View | null) => void;
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
    onOverflowPress,
    onRegisterDmAnchor,
    onHasStoryChange,
    menuAnchorRef,
}: FeedPostHeaderProps) {
    const { user } = useAuth();
    const [hasStory, setHasStory] = useState(false);
    const [showFollowCheck, setShowFollowCheck] = useState(post.isFollowing === true);

    const { isReclip, displayHandle, profileHandle } = getReclipDisplay(post, viewerHandle ?? user?.handle);
    const metadataItems = useMemo(() => buildPostMetadataItems(post), [post]);
    const socialSourceLabel = getPostSocialSourceLabel(post);
    const isMutualFollow = useMutualFollow(post, isCurrentUser);
    const isFollowing = post.isFollowing === true;
    const viewer = viewerHandle ?? user?.handle;
    const hasPendingRequest = Boolean(
        !isCurrentUser &&
            !isFollowing &&
            viewer &&
            isProfilePrivate(profileHandle) &&
            hasPendingFollowRequest(viewer, profileHandle),
    );

    const avatarSrc = isCurrentUser
        ? user?.avatarUrl
        : getAvatarForHandle(profileHandle);

    const flagValue = isCurrentUser
        ? user?.countryFlag || ''
        : getFlagForHandle(isReclip ? post.originalUserHandle! : post.userHandle) || '';

    const textPrimary = isOverlaid ? '#FFFFFF' : '#F3F4F6';
    const textMuted = isOverlaid ? 'rgba(255,255,255,0.9)' : '#9CA3AF';
    const reclipColor = isOverlaid ? 'rgba(255,255,255,0.9)' : '#9CA3AF';

    useEffect(() => {
        let cancelled = false;
        async function checkStory() {
            try {
                const anyStory = await userHasStoriesByHandle(profileHandle);
                let ring = anyStory;
                if (!isCurrentUser) {
                    ring = await userHasUnviewedStoriesByHandle(profileHandle);
                }
                if (!cancelled) {
                    setHasStory(ring);
                    onHasStoryChange?.(anyStory);
                }
            } catch {
                /* ignore */
            }
        }
        checkStory();
        return () => {
            cancelled = true;
        };
    }, [profileHandle, isCurrentUser, onHasStoryChange]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (!isCurrentUser && onFollow && post.isFollowing) {
            setShowFollowCheck(true);
            timer = setTimeout(() => setShowFollowCheck(false), 2500);
        } else {
            setShowFollowCheck(false);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [post.isFollowing, isCurrentUser, onFollow]);

    const showAvatar = variant === 'default';

    const avatarBlock = showAvatar ? (
        <View
            style={styles.avatarWrap}
            ref={(r) => {
                onRegisterDmAnchor?.(`post:${post.id}`, r);
                onRegisterDmAnchor?.(`handle:${post.userHandle}`, r);
            }}
            collapsable={false}
        >
            <TouchableOpacity onPress={onProfileMenuPress} activeOpacity={0.85}>
                <Avatar
                    src={avatarSrc}
                    name={displayHandle.split('@')[0]}
                    size={FEED_UI.icon.avatar}
                    hasStory={hasStory}
                />
            </TouchableOpacity>
            {!isCurrentUser && onFollow && !isFollowing && !hasPendingRequest ? (
                <TouchableOpacity style={styles.followPlus} onPress={() => void onFollow()}>
                    <Icon name="add" size={10} color="#FFFFFF" />
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
                    onPress={() => onOpenDM(post.userHandle, post.id)}
                >
                    <Icon name="paper-plane" size={10} color="#EF4444" />
                </TouchableOpacity>
            ) : null}
            {!isCurrentUser && isFollowing && !isMutualFollow && showFollowCheck ? (
                <View style={styles.followCheck}>
                    <Icon name="checkmark" size={10} color="#FFFFFF" />
                </View>
            ) : null}
        </View>
    ) : null;

    const handleRow = (
        <TouchableOpacity onPress={onProfileMenuPress} activeOpacity={0.85} style={styles.handleBtn}>
            <Text style={[styles.handleText, { color: textPrimary }]} numberOfLines={1}>
                {displayHandle}
            </Text>
            <Flag
                value={flagValue}
                national={isCurrentUser ? user?.national : undefined}
                size={FEED_UI.icon.flag}
            />
        </TouchableOpacity>
    );

    const chrome = (
        <View style={[styles.row, variant === 'textOnlyChrome' && styles.textOnlyRow]}>
            <View style={[styles.left, showAvatar && styles.leftWithAvatar]}>
                {avatarBlock}
                <View style={styles.infoCol}>
                    {isReclip ? (
                        <View style={styles.reclipRow}>
                            <Icon name="repeat" size={FEED_UI.type.reclip} color={reclipColor} />
                            <Text style={[styles.reclipText, { color: reclipColor }]} numberOfLines={1}>
                                {post.userHandle} reclipped
                            </Text>
                        </View>
                    ) : null}
                    {handleRow}
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
            </View>
            <View style={styles.right}>
                {metadataItems.length > 0 ? (
                    <FeedPostMetaCarousel items={metadataItems} overlaid={isOverlaid} align="right" />
                ) : null}
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
            {isOverlaid ? (
                <LinearGradient
                    colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.35)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
            ) : null}
            <View style={styles.content}>{chrome}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Web PostHeader: `px-3 pt-3 pb-2`
    wrap: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
    },
    wrapOverlaid: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        // No elevation — elevated full-width headers steal media taps on Android even with box-none.
        // Still-image tap layer is inset below this chrome (see FEED_CARD_MEDIA_TAP_LAYER).
    },
    content: {
        zIndex: 1,
    },
    textOnlyChromeWrap: {
        paddingHorizontal: 4,
        paddingTop: 4,
        marginBottom: 8,
        zIndex: 10,
    },
    textOnlyRow: {
        paddingHorizontal: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    left: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
        paddingRight: 8,
    },
    // Web: `gap-3` between avatar and text
    leftWithAvatar: {
        gap: 12,
    },
    infoCol: {
        flex: 1,
        minWidth: 0,
        gap: 0,
    },
    right: {
        alignItems: 'flex-end',
        gap: 2,
        flexShrink: 0,
    },
    avatarWrap: {
        position: 'relative',
    },
    followPlus: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#030712',
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
        borderColor: '#030712',
    },
    requestedPillText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    dmButton: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
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
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#030712',
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
        gap: 6,
        maxWidth: '100%',
    },
    // Web: `text-sm font-semibold` — optically bumped
    handleText: {
        fontSize: FEED_UI.type.handle,
        fontWeight: '700',
        flexShrink: 1,
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
