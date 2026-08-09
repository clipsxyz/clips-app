import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { FEED_UI } from '../constants/feedUiTokens';
import FeedLikeThumbsIcon from './FeedLikeThumbsIcon.native';
import FeedMessageSquareIcon from './FeedMessageSquareIcon.native';
import ShareToStoriesFeedIcon from './ShareToStoriesFeedIcon.native';
import FeedRepeatIcon from './FeedRepeatIcon.native';
import FeedBookmarkIcon from './FeedBookmarkIcon.native';

const ACTION_ICON = FEED_UI.icon.action;
const RECLIP_INNER_ICON = Math.round(ACTION_ICON * 0.58);

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
    /** Own-post reclip: visible but dimmed (web EngagementBar opacity-30). */
    reclipDisabled?: boolean;
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
    reclipDisabled = false,
    showSave = true,
    likeButtonRef,
    tone = 'feed',
}: FeedEngagementRowProps) {
    const iconColor = tone === 'feed' ? '#FFFFFF' : '#D1D5DB';
    const countColor = tone === 'feed' ? '#FFFFFF' : '#D1D5DB';
    const reclipIdleColor = tone === 'feed' ? '#9CA3AF' : '#D1D5DB';
    const reclipCountColor = tone === 'feed' ? '#D1D5DB' : '#9CA3AF';
    const saveColor = isSaved ? '#7A8AF0' : iconColor;

    return (
        <View style={styles.row}>
            <View ref={likeButtonRef} collapsable={false} style={styles.item}>
                <TouchableOpacity onPress={onLike} disabled={!onLike} activeOpacity={0.7}>
                    <FeedLikeThumbsIcon size={ACTION_ICON} filled={userLiked} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onLikesPress || onLike}
                    disabled={!(onLikesPress || onLike)}
                    activeOpacity={0.7}
                >
                <Text style={[styles.text, { color: countColor }, styles.likeCount]}>{likes}</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={onComment} style={styles.item} disabled={!onComment} activeOpacity={0.7}>
                <FeedMessageSquareIcon size={ACTION_ICON} color={iconColor} />
                <Text style={[styles.text, { color: countColor }]}>{comments}</Text>
            </TouchableOpacity>

            {showShareToStories ? (
                <TouchableOpacity
                    onPress={onShareToStories}
                    style={styles.item}
                    disabled={!onShareToStories}
                    activeOpacity={0.7}
                >
                    <ShareToStoriesFeedIcon size={ACTION_ICON} color={iconColor} />
                    <Text style={[styles.text, { color: countColor }]}>{shares}</Text>
                </TouchableOpacity>
            ) : null}

            {showReclip ? (
                <TouchableOpacity
                    onPress={onReclip}
                    style={[styles.item, reclipDisabled && styles.itemDisabled]}
                    disabled={!onReclip || reclipDisabled}
                    activeOpacity={0.7}
                >
                    {userReclipped ? (
                        <LinearGradient
                            colors={['#22d3ee', '#06b6d4']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.reclipGradientRing}
                        >
                            <View style={styles.reclipInner}>
                                <FeedRepeatIcon size={RECLIP_INNER_ICON} color="#FFFFFF" />
                            </View>
                        </LinearGradient>
                    ) : (
                        <FeedRepeatIcon size={ACTION_ICON} color={reclipIdleColor} />
                    )}
                    <Text style={[styles.text, { color: reclipCountColor }]}>{reclips}</Text>
                </TouchableOpacity>
            ) : null}

            {showSave ? (
                <TouchableOpacity onPress={onSave} style={styles.item} disabled={!onSave} activeOpacity={0.7}>
                    <FeedBookmarkIcon size={ACTION_ICON} color={saveColor} filled={isSaved} />
                    <Text style={[styles.text, { color: countColor }]}>
                        {isSaved ? 'Saved' : 'Save'}
                    </Text>
                </TouchableOpacity>
            ) : null}

            {showViews ? (
                <View style={styles.item}>
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
        // Web uses gap-4; on ~360dp phones that wraps once counts hit 3 digits + “Save”.
        columnGap: 10,
        flexShrink: 1,
        flexWrap: 'nowrap',
        minWidth: 0,
    },
    /** Web EngagementBar: `min-h-[40px] px-1 gap-1`. */
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 3,
        minHeight: 40,
        paddingHorizontal: 2,
        flexShrink: 0,
    },
    text: {
        fontSize: FEED_UI.type.actionCount,
        fontWeight: '400',
        fontVariant: ['tabular-nums'],
    },
    likeCount: {
        minWidth: 28,
    },
    itemDisabled: {
        opacity: 0.3,
    },
    reclipGradientRing: {
        padding: 1.5,
        borderRadius: 999,
    },
    reclipInner: {
        width: ACTION_ICON,
        height: ACTION_ICON,
        borderRadius: ACTION_ICON / 2,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

