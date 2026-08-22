import React, { useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post, User } from '../types';
import FeedPostHeader from './FeedPostHeader.native';
import FeedPostMedia from './FeedPostMedia.native';
import FeedTextOnlyFeedLayout from './FeedTextOnlyFeedLayout.native';
import FeedCaptionText from './FeedCaptionText.native';
import FeedEngagementRow from './FeedEngagementRow';
import FeedEngagementRightActions from './FeedEngagementRightActions.native';
import FeedHeartDrop from './FeedHeartDrop.native';
import FeedLikesSheet from './FeedLikesSheet.native';
import FeedMediaCarouselThumbs from './FeedMediaCarouselThumbs.native';
import FeedNewsTicker from './FeedNewsTicker.native';
import FeedPostTagRow from './FeedPostTagRow.native';
import FeedShareModal from './FeedShareModal';
import ShareToStoriesModal from './ShareToStoriesModal.native';
import TaggedUsersBottomSheet from './TaggedUsersBottomSheet.native';
import BoostMetricsPanel from './BoostMetricsPanel.native';
import { getPostDisplayCaption } from '../utils/feedPostMeta';
import { isTextOnlyPost } from '../utils/effectiveTextPostStyleNative';
import {
    FEED_CARD_BODY,
    FEED_CARD_HEADER_WRAP,
} from './FeedPageLayout.native';

type Props = {
    post: Post;
    user?: User | null;
    onPress: () => void;
    onLikePress?: () => void;
    onCommentPress?: () => void;
    onBookmarkPress?: () => void;
    onReclipPress?: () => void;
    onShareToStoriesSuccess?: (postId: string) => void;
};

export default function MyFeedPostCard({
    post,
    user,
    onPress,
    onLikePress,
    onCommentPress,
    onBookmarkPress,
    onReclipPress,
    onShareToStoriesSuccess,
}: Props) {
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = screenWidth - 24;
    const cardMediaWidth = cardWidth - 24;
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [likesSheetVisible, setLikesSheetVisible] = useState(false);
    const [taggedSheetVisible, setTaggedSheetVisible] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareToStoriesVisible, setShareToStoriesVisible] = useState(false);
    const [boostMetricsOpen, setBoostMetricsOpen] = useState(false);
    const [heartDrop, setHeartDrop] = useState<{ startX: number; startY: number } | null>(null);
    const likeButtonRef = useRef<View>(null);

    const textOnlyPost = isTextOnlyPost(post);
    const hasFeedMedia = Boolean(
        post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0),
    );
    const displayCaption = useMemo(() => getPostDisplayCaption(post), [post]);
    const carouselThumbItems = useMemo(
        () =>
            (post.mediaItems || []).filter(
                (item) => item?.type === 'image' || item?.type === 'video',
            ),
        [post.mediaItems],
    );
    const postTags = post.tags?.filter(Boolean) ?? [];
    const isCurrentUser = true;
    const mediaHeight = Math.min(cardMediaWidth * 1.1, 420);

    const triggerHeartDrop = (pageX: number, pageY: number) => {
        setHeartDrop({ startX: pageX, startY: pageY });
    };

    return (
        <TouchableOpacity activeOpacity={0.95} style={styles.card} onPress={onPress}>
            <FeedPostTagRow tags={postTags} />

            {post.isBoosted ? (
                <View style={styles.sponsoredBadge}>
                    <Text style={styles.sponsoredText}>Sponsored</Text>
                </View>
            ) : null}

            {textOnlyPost ? (
                <FeedTextOnlyFeedLayout
                    post={post}
                    viewerHandle={user?.handle}
                    cardWidth={cardMediaWidth}
                    isCurrentUser={isCurrentUser}
                    onDoubleLike={() => {
                        onLikePress?.();
                    }}
                    onShowTaggedUsers={() => setTaggedSheetVisible(true)}
                />
            ) : (
                <View style={FEED_CARD_BODY}>
                    <View style={FEED_CARD_HEADER_WRAP}>
                        <FeedPostHeader
                            post={post}
                            viewerHandle={user?.handle}
                            isCurrentUser={isCurrentUser}
                        />
                    </View>
                    {hasFeedMedia ? (
                        <View style={styles.mediaWrap}>
                            <FeedPostMedia
                                post={post}
                                carouselIndex={carouselIndex}
                                onCarouselIndexChange={setCarouselIndex}
                                stickers={post.stickers}
                                width={cardMediaWidth}
                                height={mediaHeight}
                                mode="feed"
                            />
                        </View>
                    ) : null}
                    {carouselThumbItems.length > 1 ? (
                        <FeedMediaCarouselThumbs
                            items={carouselThumbItems}
                            activeIndex={carouselIndex}
                            onSelect={setCarouselIndex}
                        />
                    ) : null}
                </View>
            )}

            {!textOnlyPost && displayCaption.length > 0 && hasFeedMedia ? (
                <View style={styles.captionWrap}>
                    <FeedCaptionText caption={displayCaption} />
                </View>
            ) : null}

            <FeedHeartDrop
                visible={heartDrop != null}
                startX={heartDrop?.startX ?? 0}
                startY={heartDrop?.startY ?? 0}
                targetRef={likeButtonRef}
                onComplete={() => setHeartDrop(null)}
            />

            <View style={styles.engagementBar}>
                <View style={styles.engagementLeft}>
                    <FeedEngagementRow
                        likeButtonRef={likeButtonRef}
                        likes={post.stats?.likes ?? 0}
                        comments={post.stats?.comments ?? 0}
                        shares={post.stats?.shares ?? 0}
                        reclips={post.stats?.reclips ?? 0}
                        saves={post.stats?.saves ?? 0}
                        userLiked={post.userLiked}
                        userReclipped={post.userReclipped}
                        isSaved={post.isBookmarked}
                        onLike={onLikePress}
                        onLikesPress={() => {
                            setLikesSheetVisible(true);
                        }}
                        onComment={onCommentPress}
                        onShareToStories={() => setShareToStoriesVisible(true)}
                        onReclip={onReclipPress}
                        onSave={onBookmarkPress}
                        showReclip={Boolean(onReclipPress)}
                        showSaveLabel={!post.isBoosted}
                        compact={Boolean(post.isBoosted)}
                        tone="feed"
                    />
                </View>
                <FeedEngagementRightActions
                    showMetrics={Boolean(post.isBoosted)}
                    metricsOpen={boostMetricsOpen}
                    onToggleMetrics={() => setBoostMetricsOpen((v) => !v)}
                    shares={post.stats?.shares ?? 0}
                    onShare={() => setShareModalOpen(true)}
                />
            </View>

            {post.isBoosted ? (
                <BoostMetricsPanel post={post} isOpen={boostMetricsOpen} />
            ) : null}

            {post.bannerText ? <FeedNewsTicker text={post.bannerText} /> : null}

            <FeedLikesSheet
                visible={likesSheetVisible}
                postId={String(post.id)}
                userId={user?.id || 'anon'}
                viewerHandle={user?.handle}
                likeCount={post.stats?.likes ?? 0}
                viewCount={post.stats?.views ?? 0}
                onClose={() => setLikesSheetVisible(false)}
            />

            {post.taggedUsers && post.taggedUsers.length > 0 ? (
                <TaggedUsersBottomSheet
                    visible={taggedSheetVisible}
                    taggedUserHandles={post.taggedUsers}
                    onClose={() => setTaggedSheetVisible(false)}
                />
            ) : null}

            <ShareToStoriesModal
                visible={shareToStoriesVisible}
                post={post}
                onClose={() => setShareToStoriesVisible(false)}
                onShareSuccess={onShareToStoriesSuccess}
            />

            <FeedShareModal
                post={post}
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                onShareSuccess={onShareToStoriesSuccess}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#030712',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        flexDirection: 'column',
    },
    sponsoredBadge: {
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    sponsoredText: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    mediaWrap: {
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
    },
    captionWrap: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    engagementBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        minWidth: 0,
    },
    engagementLeft: {
        flex: 1,
        minWidth: 0,
        flexShrink: 1,
        marginRight: 8,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    externalShareButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
