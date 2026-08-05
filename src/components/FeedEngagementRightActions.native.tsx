import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { FEED_UI } from '../constants/feedUiTokens';
import FeedBarChartIcon from './FeedBarChartIcon.native';
import FeedLiveShareIcon from './FeedLiveShareIcon.native';

const BRAND_ACTIVE = '#7A8AF0';
const ACTION_ICON = FEED_UI.icon.action;
/** Web share control is `w-11 h-11` (44) around a 24px glyph — keep hit box, smaller glyph. */
const ACTION_HIT = 40;

type Props = {
    onShare?: () => void;
    showMetrics?: boolean;
    metricsOpen?: boolean;
    onToggleMetrics?: () => void;
};

/** Web EngagementBar right cluster: external share + optional boost metrics. */
export default function FeedEngagementRightActions({
    onShare,
    showMetrics = false,
    metricsOpen = false,
    onToggleMetrics,
}: Props) {
    return (
        <View style={styles.row}>
            {onShare ? (
                <TouchableOpacity
                    onPress={onShare}
                    style={styles.button}
                    accessibilityLabel="Share post"
                >
                    <FeedLiveShareIcon size={ACTION_ICON} color="#FFFFFF" />
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
    button: {
        width: ACTION_HIT,
        height: ACTION_HIT,
        borderRadius: ACTION_HIT / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
