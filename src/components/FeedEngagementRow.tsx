import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import FeedLikeThumbsIcon from './FeedLikeThumbsIcon.native';
import ShareToStoriesFeedIcon from './ShareToStoriesFeedIcon.native';

type FeedEngagementRowProps = {
    likes: number;
    comments: number;
    shares?: number;
    reclips?: number;
    views?: number;
    userLiked?: boolean;
    userReclipped?: boolean;
    isSaved?: boolean;
    onLike?: () => void;
    onLikesPress?: () => void;
    onComment?: () => void;
    onShareToStories?: () => void;
    onReclip?: () => void;
    onSave?: () => void;
    showShareToStories?: boolean;
    showViews?: boolean;
    showReclip?: boolean;
    showSave?: boolean;
    likeButtonRef?: React.RefObject<View | null>;
    /** White icons for feed bar (web EngagementBar); gray for profile cards. */
    tone?: 'feed' | 'muted';
};

export default function FeedEngagementRow({
    likes,
    comments,
    shares = 0,
    reclips = 0,
    views = 0,
    userLiked = false,
    userReclipped = false,
    isSaved = false,
    onLike,
    onLikesPress,
    onComment,
    onShareToStories,
    onReclip,
    onSave,
    showShareToStories = true,
    showViews = false,
    showReclip = true,
    showSave = true,
    likeButtonRef,
    tone = 'feed',
}: FeedEngagementRowProps) {
    const iconColor = tone === 'feed' ? '#FFFFFF' : '#D1D5DB';
    const countColor = tone === 'feed' ? '#FFFFFF' : '#D1D5DB';
    const reclipIdleColor = tone === 'feed' ? '#9CA3AF' : '#D1D5DB';
    const saveColor = isSaved ? '#7A8AF0' : iconColor;

    return (
        <View style={styles.row}>
            <View ref={likeButtonRef} collapsable={false}>
                <TouchableOpacity
                    onPress={onLike}
                    style={styles.item}
                    disabled={!onLike}
                >
                    <FeedLikeThumbsIcon size={24} filled={userLiked} color={iconColor} />
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                onPress={onLikesPress || onLike}
                style={styles.item}
                disabled={!(onLikesPress || onLike)}
            >
                <Text style={[styles.text, { color: countColor }]}>{likes}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onComment} style={styles.item} disabled={!onComment}>
                <Icon name="chatbubble-outline" size={24} color={iconColor} />
                <Text style={[styles.text, { color: countColor }]}>{comments}</Text>
            </TouchableOpacity>

            {showShareToStories ? (
                <TouchableOpacity
                    onPress={onShareToStories}
                    style={styles.item}
                    disabled={!onShareToStories}
                >
                    <ShareToStoriesFeedIcon size={24} color={iconColor} />
                    <Text style={[styles.text, { color: countColor }]}>{shares}</Text>
                </TouchableOpacity>
            ) : null}

            {showReclip ? (
                <TouchableOpacity onPress={onReclip} style={styles.item} disabled={!onReclip}>
                    {userReclipped ? (
                        <LinearGradient
                            colors={['#22d3ee', '#06b6d4']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.reclipGradientRing}
                        >
                            <View style={styles.reclipInner}>
                                <Icon name="repeat" size={14} color="#FFFFFF" />
                            </View>
                        </LinearGradient>
                    ) : (
                        <Icon name="repeat-outline" size={24} color={reclipIdleColor} />
                    )}
                    <Text style={[styles.text, { color: countColor }]}>{reclips}</Text>
                </TouchableOpacity>
            ) : null}

            {showSave ? (
                <TouchableOpacity onPress={onSave} style={styles.item} disabled={!onSave}>
                    <Icon
                        name={isSaved ? 'bookmark' : 'bookmark-outline'}
                        size={24}
                        color={saveColor}
                    />
                    <Text style={[styles.text, { color: countColor }]}>
                        {isSaved ? 'Saved' : 'Save'}
                    </Text>
                </TouchableOpacity>
            ) : null}

            {showViews ? (
                <View style={styles.item}>
                    <Icon name="eye-outline" size={24} color={iconColor} />
                    <Text style={[styles.text, { color: countColor }]}>{views}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 16,
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
        minHeight: 40,
        paddingHorizontal: 2,
    },
    text: {
        fontSize: 12,
        fontWeight: '600',
    },
    reclipGradientRing: {
        padding: 1.5,
        borderRadius: 999,
    },
    reclipInner: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
