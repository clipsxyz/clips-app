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
    onHeartAnimation?: (pageX: number, pageY: number) => void;
    onRegisterDmAnchor?: (key: string, ref: View | null) => void;
    onShowTaggedUsers?: () => void;
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
    onHeartAnimation,
    onRegisterDmAnchor,
    onShowTaggedUsers,
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
                variant="textOnlyChrome"
                onFollow={onFollow}
                onOpenDM={onOpenDM}
                onProfileMenuPress={onProfileMenuPress}
                onOverflowPress={onOverflowPress}
                onRegisterDmAnchor={onRegisterDmAnchor}
            />

            <View style={[styles.bubbleRow, isFromViewer ? styles.bubbleRowMe : styles.bubbleRowOther]}>
                {!isFromViewer ? (
                    <View style={styles.bubbleAvatarSpacer}>
                        <View ref={(r) => registerAnchor(r)} collapsable={false} style={styles.avatarWrap}>
                            <TouchableOpacity onPress={onProfileMenuPress} activeOpacity={0.85}>
                                <Avatar
                                    src={avatarSrc}
                                    name={profileHandle.split('@')[0]}
                                    size={28}
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
                ) : null}
                <FeedTextOnlyCard
                    post={post}
                    isFromViewer={isFromViewer}
                    onDoubleLike={onDoubleLike}
                    onHeartAnimation={onHeartAnimation}
                    width={cardWidth - (isFromViewer ? 8 : 44)}
                />
            </View>

            {post.taggedUsers && post.taggedUsers.length > 0 ? (
                <TaggedAvatars
                    taggedUserHandles={post.taggedUsers}
                    onShowTaggedUsers={onShowTaggedUsers ?? (() => {})}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        paddingHorizontal: 12,
        paddingBottom: 8,
    },
    bubbleRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    bubbleRowMe: {
        justifyContent: 'flex-end',
    },
    bubbleRowOther: {
        justifyContent: 'flex-end',
    },
    bubbleAvatarSpacer: {
        width: 32,
        alignItems: 'center',
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
