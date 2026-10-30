import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
    reachPercent,
    type StoryInsightsOverviewStats,
} from '../utils/storyInsightsAnalytics';
import { UCL_CYAN, UCL_TEXT_PLACEHOLDER, UCL_TEXT_PRIMARY } from '../theme/gazetteerAmbientNative';
import { ox } from '../constants/nativeOpticalScale';

type Props = {
    stats: StoryInsightsOverviewStats;
    unseenCount?: number;
    onMarkAllSeen?: () => void;
};

function MetricTile({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.metricTile}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
        </View>
    );
}

function ReachRow({
    label,
    count,
    total,
    color,
}: {
    label: string;
    count: number;
    total: number;
    color: string;
}) {
    const pct = reachPercent(count, total);
    return (
        <View style={styles.reachRow}>
            <View style={styles.reachMeta}>
                <Text style={styles.reachLabel}>{label}</Text>
                <Text style={styles.reachCount}>
                    {count} · {pct}%
                </Text>
            </View>
            <View style={styles.reachTrack}>
                <View style={[styles.reachFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

export default function StoryInsightsOverview({ stats, unseenCount = 0, onMarkAllSeen }: Props) {
    const reachTotal = stats.localViews + stats.regionalViews + stats.discoverViews || stats.totalViews;

    return (
        <View style={styles.wrap}>
            <View style={styles.card}>
                <Text style={styles.kicker}>Creator analytics</Text>
                <Text style={styles.title}>Story performance</Text>
                <View style={styles.metricsRow}>
                    <MetricTile value={String(stats.totalViews)} label="Total views" />
                    <MetricTile value={`${stats.completionRate}%`} label="Completion" />
                    <MetricTile value={String(stats.directShares)} label="Direct shares" />
                </View>
                <View style={styles.completionTrack}>
                    <View style={[styles.completionFill, { width: `${stats.completionRate}%` }]} />
                </View>
                <Text style={styles.completionHint}>
                    Viewers who reacted or replied · {stats.uniqueViewers} unique
                </Text>
                <Text style={styles.reachTitle}>Geographical reach</Text>
                <ReachRow label="Local" count={stats.localViews} total={reachTotal} color="#34D399" />
                <ReachRow label="Regional" count={stats.regionalViews} total={reachTotal} color={UCL_CYAN} />
                <ReachRow label="Discover" count={stats.discoverViews} total={reachTotal} color="#A78BFA" />
            </View>
            {unseenCount > 0 && onMarkAllSeen ? (
                <View style={styles.markRow}>
                    <TouchableOpacity onPress={onMarkAllSeen} hitSlop={8}>
                        <Text style={styles.markText}>Mark all seen</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingBottom: ox(8),
    },
    card: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: ox(14),
        marginBottom: ox(8),
    },
    kicker: {
        color: UCL_CYAN,
        fontSize: ox(10),
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: ox(4),
    },
    title: {
        color: UCL_TEXT_PRIMARY,
        fontSize: ox(16),
        fontWeight: '700',
        marginBottom: ox(12),
    },
    metricsRow: {
        flexDirection: 'row',
        gap: ox(8),
        marginBottom: ox(12),
    },
    metricTile: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingVertical: ox(10),
        paddingHorizontal: ox(8),
        alignItems: 'center',
    },
    metricValue: {
        color: UCL_TEXT_PRIMARY,
        fontSize: ox(18),
        fontWeight: '700',
    },
    metricLabel: {
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(10),
        fontWeight: '600',
        marginTop: ox(4),
        textAlign: 'center',
    },
    completionTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        marginBottom: ox(6),
    },
    completionFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: UCL_CYAN,
    },
    completionHint: {
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(11),
        marginBottom: ox(14),
    },
    reachTitle: {
        color: UCL_TEXT_PRIMARY,
        fontSize: ox(12),
        fontWeight: '700',
        marginBottom: ox(8),
    },
    reachRow: {
        marginBottom: ox(8),
    },
    reachMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: ox(4),
    },
    reachLabel: {
        color: '#E5E7EB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    reachCount: {
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(11),
    },
    reachTrack: {
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    reachFill: {
        height: '100%',
        borderRadius: 3,
    },
    markRow: {
        alignItems: 'flex-end',
        marginBottom: ox(4),
    },
    markText: {
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '600',
    },
});
