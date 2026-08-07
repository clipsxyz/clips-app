import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FEED_UI } from '../constants/feedUiTokens';
import FeedBarChartIcon from './FeedBarChartIcon.native';
import FeedLiveShareIcon from './FeedLiveShareIcon.native';

const BRAND_ACTIVE = '#7A8AF0';
const ACTION_ICON = FEED_UI.icon.action;
/** Web share control is `w-11 h-11` (44) around a 24px glyph — keep hit box, smaller glyph. */
const ACTION_HIT = 40;

type Props = {
    onShare?: () => void;
    /** Times this post has been shared (external + stories). */
    shares?: number;
    showMetrics?: boolean;
    metricsOpen?: boolean;
    onToggleMetrics?: () => void;
};

/** Web EngagementBar right cluster: external share + optional boost metrics. */
export default function FeedEngagementRightActions({
    onShare,
    shares = 0,
    showMetrics = false,
    metricsOpen = false,
    onToggleMetrics,
}: Props) {
    return (
        <View style={styles.row}>
            {onShare ? (
                <TouchableOpacity
                    onPress={onShare}
                    style={styles.shareButton}
                    accessibilityLabel={`Share post, ${shares} shares`}
                    accessibilityRole="button"
                >
                    <FeedLiveShareIcon size={ACTION_ICON} color="#FFFFFF" />
                    <Text style={styles.count}>{shares}</Text>
                </TouchableOpacity>
            ) : null}
            {showMetrics && onToggleMetrics ? (
                <TouchableOpacity
                    onPress={onToggleMetrics}
                    style={styles.button}
                    accessibilityLabel="Toggle boost metrics"
                >
                    <FeedBarChartIcon size={ACTION_ICON} color={metricsOpen ? BRAND_ACTIVE : '#FFFFFF'} />
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
        flexShrink: 0,
    },
    shareButton: {
        minHeight: ACTION_HIT,
        minWidth: ACTION_HIT,
        paddingHorizontal: 2,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 3,
        borderRadius: ACTION_HIT / 2,
    },
    button: {
        width: ACTION_HIT,
        height: ACTION_HIT,
        borderRadius: ACTION_HIT / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    count: {
        fontSize: FEED_UI.type.actionCount,
        fontWeight: '400',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
});
