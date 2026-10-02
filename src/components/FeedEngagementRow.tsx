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
const PILL_ACTION_ICON = 15;
const RECLIP_INNER_ICON = Math.round(ACTION_ICON * 0.58);
const PILL_RECLIP_INNER = Math.round(PILL_ACTION_ICON * 0.58);

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
    /** Hide Save/Saved text — needed when boost analytics sits on the far right. */
    showSaveLabel?: boolean;
    /** Tighter gaps when the right cluster includes boost metrics / share. */
    compact?: boolean;
    likeButtonRef?: React.RefObject<View | null>;
    /** White icons for feed bar (web EngagementBar); gray for profile cards. */
    tone?: 'feed' | 'muted';
    /** NOW TV frosted pill chrome for each action cluster. */
    pillChrome?: boolean;
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
    showSaveLabel = true,
    compact = false,
    likeButtonRef,
    tone = 'feed',
    pillChrome = false,
}: FeedEngagementRowProps) {
    const iconColor = tone === 'feed' ? '#FFFFFF' : '#D1D5DB';
    const countColor = tone === 'feed' ? '#FFFFFF' : '#D1D5DB';
    const reclipIdleColor = tone === 'feed' ? '#9CA3AF' : '#D1D5DB';
    const reclipCountColor = tone === 'feed' ? '#D1D5DB' : '#9CA3AF';
    const saveColor = isSaved ? '#7A8AF0' : iconColor;
    const pillStyle = pillChrome ? styles.itemPill : null;
    const iconSize = pillChrome ? PILL_ACTION_ICON : ACTION_ICON;
    const reclipInnerSize = pillChrome ? PILL_RECLIP_INNER : RECLIP_INNER_ICON;
    const countTextStyle = pillChrome ? styles.textPill : styles.text;
    const showSaveText = showSaveLabel && !pillChrome;

    return (
        <View style={[styles.row, compact && styles.rowCompact, pillChrome && styles.rowPill]}>
            <View
                ref={likeButtonRef}
                collapsable={false}
                style={[styles.item, compact && styles.itemCompact, pillStyle]}
            >
                <TouchableOpacity onPress={onLike} disabled={!onLike} activeOpacity={0.7}>
                    <FeedLikeThumbsIcon size={iconSize} filled={userLiked} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onLikesPress || onLike}
                    disabled={!(onLikesPress || onLike)}
                    activeOpacity={0.7}
                >
                    <Text style={[countTextStyle, { color: countColor }, !pillChrome && styles.likeCount]}>
                        {likes}
                    </Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                onPress={onComment}
                style={[styles.item, compact && styles.itemCompact, pillStyle]}
                disabled={!onComment}
                activeOpacity={0.7}
                accessibilityLabel={`Comments, ${comments}`}
            >
                <FeedMessageSquareIcon size={iconSize} color={iconColor} />
                <Text style={[countTextStyle, { color: countColor }]}>{comments}</Text>
            </TouchableOpacity>

            {showShareToStories ? (
                <TouchableOpacity
                    onPress={onShareToStories}
                    style={[styles.item, compact && styles.itemCompact, pillStyle]}
                    disabled={!onShareToStories}
                    activeOpacity={0.7}
                >
                    <ShareToStoriesFeedIcon size={iconSize} color={iconColor} />
                    <Text style={[countTextStyle, { color: countColor }]}>{shares}</Text>
                </TouchableOpacity>
            ) : null}

            {showReclip ? (
                <TouchableOpacity
                    onPress={onReclip}
                    style={[
                        styles.item,
                        compact && styles.itemCompact,
                        pillStyle,
                        reclipDisabled && styles.itemDisabled,
                    ]}
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
                            <View
                                style={[
                                    styles.reclipInner,
                                    pillChrome && { width: iconSize, height: iconSize, borderRadius: iconSize / 2 },
                                ]}
                            >
                                <FeedRepeatIcon size={reclipInnerSize} color="#FFFFFF" />
                            </View>
                        </LinearGradient>
                    ) : (
                        <FeedRepeatIcon size={iconSize} color={reclipIdleColor} />
                    )}
                    <Text style={[countTextStyle, { color: reclipCountColor }]}>{reclips}</Text>
                </TouchableOpacity>
            ) : null}

            {showSave ? (
                <TouchableOpacity
                    onPress={onSave}
                    style={[styles.item, compact && styles.itemCompact, pillStyle]}
                    disabled={!onSave}
                    activeOpacity={0.7}
                    accessibilityLabel={isSaved ? 'Saved' : 'Save post'}
                    accessibilityState={{ selected: isSaved }}
                >
                    <FeedBookmarkIcon size={iconSize} color={saveColor} filled={isSaved} />
                    {showSaveText ? (
                        <Text style={[countTextStyle, { color: countColor }]}>
                            {isSaved ? 'Saved' : 'Save'}
                        </Text>
                    ) : null}
                </TouchableOpacity>
            ) : null}

            {showViews ? (
                <View style={[styles.item, compact && styles.itemCompact, pillStyle]}>
                    <Text style={[countTextStyle, { color: countColor }]}>{views}</Text>
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
    rowCompact: {
        columnGap: 6,
    },
    rowPill: {
        columnGap: 4,
        justifyContent: 'flex-start',
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
    itemPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 5,
        minWidth: 0,
        minHeight: 0,
        columnGap: 4,
        flexShrink: 1,
    },
    itemCompact: {
        paddingHorizontal: 0,
        columnGap: 2,
    },
    text: {
        fontSize: FEED_UI.type.actionCount,
        fontWeight: '400',
        fontVariant: ['tabular-nums'],
    },
    textPill: {
        fontSize: 11,
        fontWeight: '600',
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
