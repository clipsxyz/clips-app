import React, { useEffect, useState } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { getBoostAnalytics, type BoostAnalytics } from '../api/boost';
import { buildInstantAnalytics } from '../utils/boostInsightsNative';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_BOOST } from './GazetteerBottomSheetModal.native';

type Props = {
    visible: boolean;
    post: Post | null;
    range: '24h' | '7d' | 'all';
    onClose: () => void;
};

function sparkline(values: number[]): string {
    if (!values.length) return '—';
    const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const max = Math.max(...values, 1);
    return values.map((v) => {
        const idx = Math.min(bars.length - 1, Math.floor((v / max) * (bars.length - 1)));
        return bars[idx];
    }).join('');
}

export default function BoostInsightsSheet({ visible, post, range, onClose }: Props) {
    const [data, setData] = useState<BoostAnalytics | null>(null);
    const [loading, setLoading] = useState(false);
    const sheetOpen = visible && !!post;

    useEffect(() => {
        if (!sheetOpen || !post) return;
        setData(buildInstantAnalytics(post));
        setLoading(true);
        let cancelled = false;
        void getBoostAnalytics(post.id, range)
            .then((analytics) => {
                if (!cancelled) setData(analytics);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [sheetOpen, post?.id, range]);

    if (!post) return null;

    const analytics = data?.analytics;
    const metrics = {
        impressions: analytics?.impressions ?? 0,
        likes: analytics?.likes ?? 0,
        comments: analytics?.comments ?? 0,
        shares: analytics?.shares ?? 0,
        profileVisits: analytics?.profileVisits ?? 0,
        messageStarts: analytics?.messageStarts ?? 0,
    };
    const spend =
        typeof data?.spendEur === 'number' ? `EUR ${data.spendEur.toFixed(2)}` : 'EUR 0.00';
    const trendValues =
        analytics?.trend?.impressions?.map((t: { value: number }) => Number(t.value) || 0) ?? [];
    const trendSpark = sparkline(trendValues);

    const firstMedia =
        post.mediaItems?.find((m) => (m.type === 'image' || m.type === 'video') && m.url) ??
        post.mediaItems?.[0];
    const previewUrl = firstMedia?.url || post.mediaUrl || '';
    const previewText = (post.text || post.caption || post.imageText || '').trim();

    return (
        <GazetteerBottomSheetModal
            visible={sheetOpen}
            onDismiss={onClose}
            snapPoints={['88%']}
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_BOOST.background}
            handleIndicatorStyle={GAZETTEER_SHEET_BOOST.handle}
            backdropOpacity={0.65}
        >
            <BottomSheetView style={styles.header}>
                <Text style={styles.title}>Boost insights</Text>
                <TouchableOpacity onPress={onClose}>
                    <Icon name="close" size={24} color="#FFF" />
                </TouchableOpacity>
            </BottomSheetView>
            <BottomSheetScrollView contentContainerStyle={styles.scroll}>
                {loading ? (
                    <View style={styles.loadingBanner}>
                        <Text style={styles.loadingText}>Updating with latest analytics…</Text>
                    </View>
                ) : null}
                <View style={styles.previewCard}>
                    <View style={styles.previewThumb}>
                        {previewUrl ? (
                            <Image source={{ uri: previewUrl }} style={styles.previewImg} />
                        ) : previewText ? (
                            <Text style={styles.previewText} numberOfLines={3}>
                                {previewText}
                            </Text>
                        ) : (
                            <Text style={styles.previewText}>POST</Text>
                        )}
                    </View>
                    <View>
                        <Text style={styles.previewLabel}>Selected post</Text>
                        <Text style={styles.previewHandle} numberOfLines={1}>
                            {post.userHandle}
                        </Text>
                    </View>
                </View>
                <View style={styles.statusRow}>
                    <Text
                        style={[
                            styles.statusPill,
                            data?.isActive ? styles.statusActive : styles.statusEnded,
                        ]}
                    >
                        {data?.hasBoost
                            ? data.isActive
                                ? 'Active boost'
                                : 'Boost ended'
                            : 'No boost record yet'}
                    </Text>
                    {(data?.analytics?.sourceMatchedEventsCount ?? 0) > 0 ? (
                        <Text style={styles.matchedPill}>Source matched</Text>
                    ) : null}
                </View>
                <View style={styles.block}>
                    <View style={styles.blockHeader}>
                        <Text style={styles.blockTitle}>Trend ({range})</Text>
                        <Text style={styles.spark}>{trendSpark}</Text>
                    </View>
                </View>
                <View style={styles.block}>
                    <Text style={styles.blockTitle}>Delivery</Text>
                    <MetricRow label="Impressions" value={metrics.impressions} />
                    <MetricRow label="Profile visits" value={metrics.profileVisits} />
                    <MetricRow label="Message starts" value={metrics.messageStarts} />
                </View>
                <View style={styles.block}>
                    <Text style={styles.blockTitle}>Engagement</Text>
                    <MetricRow label="Likes" value={metrics.likes} />
                    <MetricRow label="Comments" value={metrics.comments} />
                    <MetricRow label="Shares" value={metrics.shares} />
                </View>
                <View style={[styles.block, styles.spendBlock]}>
                    <MetricRow label="Spend" value={spend} valueIsText />
                </View>
            </BottomSheetScrollView>
        </GazetteerBottomSheetModal>
    );
}

function MetricRow({
    label,
    value,
    valueIsText,
}: {
    label: string;
    value: number | string;
    valueIsText?: boolean;
}) {
    return (
        <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>
                {valueIsText ? value : Number(value).toLocaleString()}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    scroll: { paddingHorizontal: 16, paddingBottom: 28 },
    loadingBanner: {
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.35)',
    },
    loadingText: { color: '#BAE6FD', fontSize: 12 },
    previewCard: {
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 12,
    },
    previewThumb: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#1f2937',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
    },
    previewImg: { width: '100%', height: '100%' },
    previewText: { color: 'rgba(255,255,255,0.9)', fontSize: 9, textAlign: 'center' },
    previewLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    previewHandle: { color: '#FFF', fontSize: 13, fontWeight: '600', maxWidth: 200 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    statusPill: {
        fontSize: 11,
        fontWeight: '700',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusActive: {
        color: '#6EE7B7',
        borderColor: 'rgba(52, 211, 153, 0.4)',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
    },
    statusEnded: {
        color: '#D1D5DB',
        borderColor: 'rgba(156, 163, 175, 0.35)',
        backgroundColor: 'rgba(107, 114, 128, 0.15)',
    },
    matchedPill: {
        fontSize: 10,
        fontWeight: '700',
        color: '#7DD3FC',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.4)',
        backgroundColor: 'rgba(14, 165, 233, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    block: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    spendBlock: {
        borderColor: 'rgba(56, 189, 248, 0.35)',
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
    },
    blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    blockTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    spark: { color: '#7DD3FC', fontSize: 14, fontWeight: '700' },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    metricLabel: { color: '#E5E7EB', fontSize: 14 },
    metricValue: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
