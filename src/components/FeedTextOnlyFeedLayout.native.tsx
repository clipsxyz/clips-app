import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { userHasStoriesByHandle } from '../api/stories';
import { useMutualFollow } from '../hooks/useMutualFollow';
import Avatar from './Avatar';
import FeedTextOnlyCard from './FeedTextOnlyCard.native';

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
}: Props) {
    const [hasStory, setHasStory] = useState(false);

    const isFromViewer =
        !!viewerHandle &&
        post.userHandle.replace(/^@+/, '').toLowerCase() === viewerHandle.replace(/^@+/, '').toLowerCase();

    const isFollowing = post.isFollowing === true;
    const isMutualFollow = useMutualFollow(post, isCurrentUser);

    const registerAnchor = useCallback(
        (ref: View | null) => {
            onRegisterDmAnchor?.(`post:${post.id}`, ref);
            onRegisterDmAnchor?.(`handle:${post.userHandle}`, ref);
        },
        [onRegisterDmAnchor, post.id, post.userHandle]
    );

    useEffect(() => {
        let cancelled = false;
        userHasStoriesByHandle(post.userHandle)
            .then((v) => {
                if (!cancelled) setHasStory(v);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [post.userHandle]);

    const displayHandle =
        post.isReclipped && post.originalUserHandle ? post.originalUserHandle : post.userHandle;

    return (
        <View style={styles.root}>
            <View style={styles.topRow}>
                <View style={styles.authorCol}>
                    <TouchableOpacity onPress={onProfileMenuPress} activeOpacity={0.85}>
                        <View
                            style={styles.avatarWrap}
                            ref={(r) => registerAnchor(r)}
                            collapsable={false}
                        >
                            <Avatar
                                src={undefined}
                                name={displayHandle.split('@')[0]}
                                size={32}
                                hasStory={hasStory}
                            />
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
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onProfileMenuPress} style={styles.handleWrap}>
                        <Text style={styles.handleText} numberOfLines={1}>
                            {displayHandle}
                        </Text>
                    </TouchableOpacity>
                </View>
                {onOverflowPress ? (
                    <TouchableOpacity onPress={onOverflowPress} hitSlop={8}>
                        <Icon name="ellipsis-horizontal" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={[styles.bubbleRow, isFromViewer ? styles.bubbleRowMe : styles.bubbleRowOther]}>
                {!isFromViewer ? (
                    <View style={styles.bubbleAvatarSpacer}>
                        <Avatar
                            src={undefined}
                            name={displayHandle.split('@')[0]}
                            size={28}
                            hasStory={hasStory}
                        />
                    </View>
                ) : null}
                <FeedTextOnlyCard
                    post={post}
                    isFromViewer={isFromViewer}
                    onDoubleLike={onDoubleLike}
                    width={cardWidth - (isFromViewer ? 8 : 44)}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        paddingHorizontal: 12,
        paddingBottom: 8,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 8,
        zIndex: 10,
    },
    authorCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        minWidth: 0,
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
    handleWrap: {
        flex: 1,
        minWidth: 0,
    },
    handleText: {
        color: '#F3F4F6',
        fontSize: 14,
        fontWeight: '600',
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
        justifyContent: 'flex-start',
    },
    bubbleAvatarSpacer: {
        marginBottom: 4,
    },
});
