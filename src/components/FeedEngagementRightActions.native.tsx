import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import FeedBarChartIcon from './FeedBarChartIcon.native';
import FeedLiveShareIcon from './FeedLiveShareIcon.native';

const BRAND_ACTIVE = '#7A8AF0';

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
            {showMetrics && onToggleMetrics ? (
                <TouchableOpacity
                    onPress={onToggleMetrics}
                    style={styles.button}
                    accessibilityLabel="Toggle boost metrics"
                >
                    <FeedBarChartIcon size={24} color={metricsOpen ? BRAND_ACTIVE : '#FFFFFF'} />
                </TouchableOpacity>
            ) : null}
            {onShare ? (
                <TouchableOpacity
                    onPress={onShare}
                    style={styles.button}
                    accessibilityLabel="Share post"
                >
                    <FeedLiveShareIcon size={24} color="#FFFFFF" />
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 16,
    },
    button: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
