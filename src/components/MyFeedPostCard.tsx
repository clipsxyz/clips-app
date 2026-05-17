import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post, User } from '../types';
import Avatar from './Avatar';
import FeedPostMeta from './FeedPostMeta';
import FeedEngagementRow from './FeedEngagementRow';
import FeedPostMedia from './FeedPostMedia.native';
import { getAvatarForHandle } from '../api/users';
import { isTextOnlyPost } from '../utils/effectiveTextPostStyleNative';

type MyFeedPostCardProps = {
    post: Post;
    user?: User | null;
    onPress: () => void;
    onLikePress?: () => void;
    onCommentPress?: () => void;
};

export default function MyFeedPostCard({ post, user, onPress, onLikePress, onCommentPress }: MyFeedPostCardProps) {
    const cardWidth = Dimensions.get('window').width - 24;
    const textOnlyPost = isTextOnlyPost(post);
    const hasMedia =
        textOnlyPost || Boolean(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0));
    const displayText = (post.caption || post.text || '').trim();
    const locationText = (post.locationLabel || post.venue || post.landmark || '').trim();

    return (
        <TouchableOpacity activeOpacity={0.95} style={styles.card} onPress={onPress}>
            <View style={styles.cardHeader}>
                <View style={styles.authorRow}>
                    <Avatar
                        src={getAvatarForHandle(post.userHandle || user?.handle || 'You') || user?.avatarUrl}
                        name={post.userHandle || user?.name || user?.handle || 'You'}
                        size={34}
                    />
                    <View style={styles.authorMeta}>
                        <FeedPostMeta
                            handle={(post.userHandle || user?.handle || 'You').replace(/^@/, '')}
                            timeText={post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Just now'}
                        />
                    </View>
                </View>
                {locationText ? (
                    <View style={styles.locationPill}>
                        <Icon name="location-outline" size={11} color="#BFDBFE" />
                        <Text style={styles.locationText} numberOfLines={1}>{locationText}</Text>
                    </View>
                ) : null}
            </View>

            {hasMedia ? (
                <FeedPostMedia post={post} width={cardWidth} height={320} mode="feed" />
            ) : null}

            {!textOnlyPost && displayText ? (
                <View style={styles.captionWrap}>
                    <Text style={styles.captionText}>{displayText}</Text>
                </View>
            ) : null}

            <View style={styles.statsRow}>
                <FeedEngagementRow
                    likes={post.stats?.likes ?? 0}
                    comments={post.stats?.comments ?? 0}
                    reclips={post.stats?.reclips ?? 0}
                    userLiked={post.userLiked}
                    onLike={onLikePress}
                    onComment={onCommentPress}
                />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1F2937',
        borderRadius: 16,
        overflow: 'hidden',
    },
    cardHeader: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        rowGap: 8,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    authorMeta: {
        marginLeft: 10,
        flex: 1,
    },
    locationPill: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#0F172A',
        paddingHorizontal: 8,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
        maxWidth: '100%',
    },
    locationText: {
        color: '#BFDBFE',
        fontSize: 11,
        fontWeight: '600',
        maxWidth: 260,
    },
    media: {
        width: '100%',
        height: 320,
        backgroundColor: '#000000',
    },
    videoPreviewWrap: {
        position: 'relative',
    },
    videoOverlay: {
        position: 'absolute',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    videoPlaceholder: {
        width: '100%',
        height: 320,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#030712',
    },
    videoPlaceholderText: {
        marginTop: 8,
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
    textCard: {
        paddingHorizontal: 14,
        paddingVertical: 16,
        backgroundColor: '#1F2937',
    },
    textCardText: {
        color: '#FFFFFF',
        fontSize: 15,
        lineHeight: 22,
    },
    captionWrap: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    captionText: {
        color: '#E5E7EB',
        fontSize: 13,
        lineHeight: 20,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        columnGap: 12,
    },
});
