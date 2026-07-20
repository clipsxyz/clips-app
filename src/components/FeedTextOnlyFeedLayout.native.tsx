import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { userHasStoriesByHandle } from '../api/stories';
import { getAvatarForHandle } from '../api/users';
import { useAuth } from '../context/Auth';
import { useMutualFollow } from '../hooks/useMutualFollow';
import { getReclipDisplay } from '../utils/feedPostMeta';
import Avatar from './Avatar';
import FeedPostHeader from './FeedPostHeader.native';
import FeedTextOnlyCard from './FeedTextOnlyCard.native';
import TaggedAvatars from './TaggedAvatars.native';
import { FEED_UI } from '../constants/feedUiTokens';

const AVATAR_COLUMN_WIDTH = FEED_UI.icon.avatar + 8;
const BUBBLE_MAX_WIDTH = 480;

type Props = {
    post: Post;
    viewerHandle?: string | null;
    cardWidth: number;
    isCurrentUser: boolean;
    onFollow?: () => Promise<void>;
    onOpenDM?: (handle: string, postId: string) => void;
    onProfileMenuPress?: () => void;
    onOverflowPress?: () => void;
    onDoubleLike: () => void;
    onRegisterDmAnchor?: (key: string, ref: View | null) => void;
    onShowTaggedUsers?: () => void;
    menuAnchorRef?: React.Ref<View>;
};

export default function FeedTextOnlyFeedLayout({
    post,
    viewerHandle,
    cardWidth,
    isCurrentUser,
    onFollow,
    onOpenDM,
    onProfileMenuPress,
    onOverflowPress,
    onDoubleLike,
    onRegisterDmAnchor,
    onShowTaggedUsers,
    menuAnchorRef,
}: Props) {
    const { user } = useAuth();
    const [hasStory, setHasStory] = useState(false);

    const isFromViewer =
        !!viewerHandle &&
        post.userHandle.replace(/^@+/, '').toLowerCase() === viewerHandle.replace(/^@+/, '').toLowerCase();

    const { profileHandle } = getReclipDisplay(post, viewerHandle ?? user?.handle);
    const avatarSrc = isCurrentUser ? user?.avatarUrl : getAvatarForHandle(profileHandle);
    const isFollowing = post.isFollowing === true;
    const isMutualFollow = useMutualFollow(post, isCurrentUser);
    const bubbleMaxWidth = Math.min(Math.max(120, cardWidth - AVATAR_COLUMN_WIDTH - 8), BUBBLE_MAX_WIDTH);

    const registerAnchor = useCallback(
        (ref: View | null) => {
            onRegisterDmAnchor?.(`post:${post.id}`, ref);
            onRegisterDmAnchor?.(`handle:${post.userHandle}`, ref);
        },
        [onRegisterDmAnchor, post.id, post.userHandle],
    );

    useEffect(() => {
        let cancelled = false;
        userHasStoriesByHandle(profileHandle)
            .then((v) => {
                if (!cancelled) setHasStory(v);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [profileHandle]);

    return (
        <View style={styles.root}>
            <FeedPostHeader
                post={post}
                viewerHandle={viewerHandle}
                isCurrentUser={isCurrentUser}
                isOverlaid
                variant="textOnlyChrome"
                onFollow={onFollow}
                onOpenDM={onOpenDM}
                onProfileMenuPress={onProfileMenuPress}
                onOverflowPress={onOverflowPress}
                onRegisterDmAnchor={onRegisterDmAnchor}
                menuAnchorRef={menuAnchorRef}
            />

            {/* Web PostHeader textOnlyFeed: bubble then avatar, row aligned end. */}
            <View style={styles.bubbleRow}>
                <View style={[styles.bubbleSlot, { maxWidth: bubbleMaxWidth }]}>
                    <FeedTextOnlyCard
                        post={post}
                        isFromViewer={isFromViewer}
                        onDoubleLike={onDoubleLike}
                        maxWidth={bubbleMaxWidth}
                    />
                </View>
                <View style={styles.avatarColumn}>
                    <View ref={(r) => registerAnchor(r)} collapsable={false} style={styles.avatarWrap}>
                        <TouchableOpacity onPress={onProfileMenuPress} activeOpacity={0.85}>
                            <Avatar
                                src={avatarSrc}
                                name={(profileHandle || post.userHandle || 'User').split('@')[0]}
                                size={FEED_UI.icon.avatar}
                                hasStory={hasStory}
                            />
                        </TouchableOpacity>
                        {!isCurrentUser && onFollow && !isFollowing ? (
                            <TouchableOpacity style={styles.followPlus} onPress={() => void onFollow()}>
                                <Icon name="add" size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                        ) : null}
                        {!isCurrentUser && isMutualFollow && onOpenDM ? (
                            <TouchableOpacity
                                style={styles.dmButton}
                                onPress={() => onOpenDM(post.userHandle, post.id)}
                            >
                                <Icon name="paper-plane" size={11} color="#EF4444" />
                            </TouchableOpacity>
                        ) : null}
                        {!isCurrentUser && isFollowing && !isMutualFollow ? (
                            <View style={styles.followCheck}>
                                <Icon name="checkmark" size={12} color="#FFFFFF" />
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>

            {post.taggedUsers && post.taggedUsers.length > 0 ? (
                <View style={styles.taggedFooter}>
                    <TaggedAvatars
                        taggedUserHandles={post.taggedUsers}
                        onShowTaggedUsers={onShowTaggedUsers ?? (() => {})}
                    />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    bubbleRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 8,
    },
    bubbleSlot: {
        flexShrink: 1,
        minWidth: 0,
    },
    avatarColumn: {
        width: AVATAR_COLUMN_WIDTH,
        alignItems: 'center',
        flexShrink: 0,
    },
    avatarWrap: {
        position: 'relative',
    },
    taggedFooter: {
        marginTop: 8,
        alignItems: 'flex-end',
        paddingRight: 2,
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
});
