import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Post } from '../types';
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
    onRegisterDmAnchor?: (key: string, ref: View | null) => void;
    onShowTaggedUsers?: () => void;
    menuAnchorRef?: React.Ref<View>;
};

/** Bluesky-style text post: avatar/handle row, then plain body on the feed canvas. */
export default function FeedTextOnlyFeedLayout({
    post,
    viewerHandle,
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

            <FeedTextOnlyCard post={post} onDoubleLike={onDoubleLike} />

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
        backgroundColor: 'transparent',
        paddingBottom: 2,
    },
    taggedFooter: {
        marginTop: 4,
        paddingHorizontal: 16,
        alignItems: 'flex-start',
    },
});
