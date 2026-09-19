import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import type { Post } from '../types';
import FeedTextOnlyCard from './FeedTextOnlyCard.native';
import PostLinkPreviewCard from './PostLinkPreviewCard.native';
import FeedTaggedMediaBadge from './FeedTaggedMediaBadge.native';
import { FEED_CARD_BODY } from './FeedPageLayout.native';
import { feedCardMediaHeight } from '../constants/feedUiTokens';
import { getPostCaptionWithoutLink } from '../utils/linkPreview';

type Props = {
    post: Post;
    viewerHandle?: string | null;
    cardWidth: number;
    isCurrentUser: boolean;
    onFollow?: () => Promise<void>;
    onOpenDM?: (handle: string, postId: string) => void;
    onProfileMenuPress?: () => void;
    onOverflowPress?: () => void;
    onLocationPress?: (
        location: string,
        filterType?: 'location' | 'venue' | 'landmark',
    ) => void;
    onDoubleLike: () => void;
    onRegisterDmAnchor?: (key: string, ref: View | null) => void;
    onShowTaggedUsers?: () => void;
    menuAnchorRef?: React.Ref<View>;
    /** News feed hides OG share cards (they live in Stories 24). */
    showLinkPreview?: boolean;
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
    onLocationPress,
    onDoubleLike,
    onRegisterDmAnchor,
    onShowTaggedUsers,
    menuAnchorRef,
    showLinkPreview = true,
}: Props) {
    const leftover = getPostCaptionWithoutLink(post, post.text || '');
    const showCanvas = leftover.length > 0 || !post.linkPreview || !showLinkPreview;
    const maxCanvasHeight = useMemo(() => {
        const windowHeight = Dimensions.get('window').height;
        return feedCardMediaHeight(Math.max(120, cardWidth), windowHeight, false);
    }, [cardWidth]);

    return (
        <View style={FEED_CARD_BODY}>
            {showLinkPreview && post.linkPreview ? <PostLinkPreviewCard preview={post.linkPreview} /> : null}

            {showCanvas ? (
                <FeedTextOnlyCard
                    post={leftover ? { ...post, text: leftover } : post}
                    viewerHandle={viewerHandle}
                    isCurrentUser={isCurrentUser}
                    onDoubleLike={onDoubleLike}
                    maxHeight={maxCanvasHeight}
                    onFollow={onFollow}
                    onOpenDM={onOpenDM}
                    onProfileMenuPress={onProfileMenuPress}
                    onOverflowPress={onOverflowPress}
                    onLocationPress={onLocationPress}
                    onRegisterDmAnchor={onRegisterDmAnchor}
                    menuAnchorRef={menuAnchorRef}
                />
            ) : null}

            {post.taggedUsers && post.taggedUsers.length > 0 ? (
                <View style={styles.taggedFooter}>
                    <FeedTaggedMediaBadge
                        count={post.taggedUsers.length}
                        onPress={onShowTaggedUsers ?? (() => {})}
                    />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    taggedFooter: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        alignItems: 'flex-start',
    },
});
