import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type FeedEngagementRowProps = {
    likes: number;
    comments: number;
    reclips?: number;
    views?: number;
    userLiked?: boolean;
    userReclipped?: boolean;
    onLike?: () => void;
    onComment?: () => void;
    onReclip?: () => void;
    onShare?: () => void;
    showShare?: boolean;
    showViews?: boolean;
    showReclip?: boolean;
};

export default function FeedEngagementRow({
    likes,
    comments,
    reclips = 0,
    views = 0,
    userLiked = false,
    userReclipped = false,
    onLike,
    onComment,
    onReclip,
    onShare,
    showShare = false,
    showViews = false,
    showReclip = true,
}: FeedEngagementRowProps) {
    return (
        <View style={styles.row}>
            <TouchableOpacity onPress={onLike} style={styles.item} disabled={!onLike}>
                <Icon name={userLiked ? 'heart' : 'heart-outline'} size={14} color={userLiked ? '#EF4444' : '#D1D5DB'} />
                <Text style={styles.text}>{likes}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onComment} style={styles.item} disabled={!onComment}>
                <Icon name="chatbubble-outline" size={14} color="#D1D5DB" />
                <Text style={styles.text}>{comments}</Text>
            </TouchableOpacity>

            {showReclip ? (
                <TouchableOpacity onPress={onReclip} style={styles.item} disabled={!onReclip}>
                    <Icon name="repeat-outline" size={14} color={userReclipped ? '#8B5CF6' : '#D1D5DB'} />
                    <Text style={styles.text}>{reclips}</Text>
                </TouchableOpacity>
            ) : null}

            {showShare ? (
                <TouchableOpacity onPress={onShare} style={styles.item} disabled={!onShare}>
                    <Icon name="share-outline" size={14} color="#D1D5DB" />
                </TouchableOpacity>
            ) : null}

            {showViews ? (
                <View style={styles.item}>
                    <Icon name="eye-outline" size={14} color="#D1D5DB" />
                    <Text style={styles.text}>{views}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 12,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
    },
    text: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '600',
    },
});
