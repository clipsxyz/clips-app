import React, { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { Post } from '../types';
import { getBoostAnalytics, type BoostAnalytics } from '../api/boost';
import {
    buildInstantAnalytics,
    mergeBoostAnalytics,
    resolveBoostInsightsPreview,
} from '../utils/boostInsightsNative';
import GazetteerBottomSheetModal from './GazetteerBottomSheetModal.native';
import CachedImage from './CachedImage.native';
import {
    SCREEN_CANVAS_BASE,
    UEFA_PASSPORT_GRADIENT,
    UEFA_PASSPORT_GRADIENT_LOCATIONS,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
} from '../theme/gazetteerAmbientNative';
import { getQualityLabel, getQualityReason, estimateReachTeaser } from '../utils/boostPostGrid';

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
        setData(buildInstantAnalytics(post, range));
        setLoading(true);
        let cancelled = false;
        void getBoostAnalytics(post.id, range)
            .then((analytics) => {
                if (!cancelled) setData(mergeBoostAnalytics(post, analytics, range));
            })
            .catch(() => {
                if (!cancelled) setData(buildInstantAnalytics(post, range));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [sheetOpen, post, range]);

    const preview = useMemo(() => (post ? resolveBoostInsightsPreview(post) : null), [post]);
    const resolved = data ?? (post ? buildInstantAnalytics(post, range) : null);

    if (!post) return null;

    const analytics = resolved?.analytics;
    const metrics = {
        impressions: analytics?.impressions ?? 0,
        likes: analytics?.likes ?? 0,
        comments: analytics?.comments ?? 0,
        shares: analytics?.shares ?? 0,
        profileVisits: analytics?.profileVisits ?? 0,
        messageStarts: analytics?.messageStarts ?? 0,
    };
    const spend =
        typeof resolved?.spendEur === 'number' ? `EUR ${resolved.spendEur.toFixed(2)}` : 'EUR 0.00';
    const trendValues =
        analytics?.trend?.impressions?.map((t: { value: number }) => Number(t.value) || 0) ?? [];
    const trendSpark = sparkline(trendValues);
    const quality = getQualityLabel(post);
    const stillLooksLikeVideo =
        !!preview?.uri && /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(preview.uri);
    const thumbUri = stillLooksLikeVideo ? undefined : preview?.uri;

    return (
        <GazetteerBottomSheetModal
            visible={sheetOpen}
            onDismiss={onClose}
            snapPoints={['88%']}
            horizontalInset={0}
            backgroundStyle={styles.sheetBg}
            handleIndicatorStyle={styles.handle}
            backdropOpacity={0.65}
        >
            {/*
              Regular View column (not BottomSheetView sibling) keeps header chrome above
              scroll content — avoids title/X painting over the selected post card.
            */}
            <View style={styles.body}>
                <LinearGradient
                    colors={[...UEFA_PASSPORT_GRADIENT]}
                    locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
                <View style={styles.chrome}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Boost insights</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                            <Icon name="close" size={22} color={UCL_TEXT_PRIMARY} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.previewCard}>
                        <View style={styles.previewThumb}>
                            {preview?.textOnly && preview.text ? (
                                <Text style={styles.previewText} numberOfLines={3}>
                                    {preview.text}
                                </Text>
                            ) : thumbUri ? (
                                <CachedImage
                                    source={{ uri: thumbUri }}
                                    style={styles.previewImg}
                                    resizeMode="cover"
                                />
                            ) : preview?.text ? (
                                <Text style={styles.previewText} numberOfLines={3}>
                                    {preview.text}
                                </Text>
                            ) : (
                                <Icon
                                    name={preview?.isVideo ? 'play' : 'image-outline'}
                                    size={18}
                                    color={UCL_TEXT_PRIMARY}
                                />
                            )}
                            {preview?.isVideo && !preview.textOnly ? (
                                <View style={styles.playBadge} pointerEvents="none">
                                    <Icon name="play" size={10} color="#FFFFFF" />
                                </View>
                            ) : null}
                        </View>
                        <View style={styles.previewMeta}>
                            <Text style={styles.previewLabel}>Selected post</Text>
                            <Text style={styles.previewHandle} numberOfLines={1}>
                                {post.userHandle}
                            </Text>
                            <Text style={styles.previewHint} numberOfLines={2}>
                                {quality.label} · {estimateReachTeaser(post)}
                            </Text>
                        </View>
                    </View>
                </View>

                <BottomSheetScrollView
                    style={styles.scrollFlex}
                    contentContainerStyle={styles.scroll}
                >
                    {loading ? (
                        <View style={styles.loadingBanner}>
                            <Text style={styles.loadingText}>Updating with latest analytics…</Text>
                        </View>
                    ) : null}
                    <Text style={styles.reasonText}>{getQualityReason(post)}</Text>
                    <View style={styles.statusRow}>
                        <Text
                            style={[
                                styles.statusPill,
                                resolved?.isActive ? styles.statusActive : styles.statusEnded,
                            ]}
                        >
                            {resolved?.hasBoost
                                ? resolved.isActive
                                    ? 'Active boost'
                                    : 'Boost ended'
                                : 'No boost record yet'}
                        </Text>
                        {(resolved?.analytics?.sourceMatchedEventsCount ?? 0) > 0 ? (
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
            </View>
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
    sheetBg: {
        backgroundColor: SCREEN_CANVAS_BASE,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    handle: {
        width: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
    },
    body: {
        flex: 1,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    chrome: {
        zIndex: 2,
        paddingHorizontal: 16,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
        paddingBottom: 10,
    },
    title: { color: UCL_TEXT_PRIMARY, fontSize: 18, fontWeight: '600', flex: 1, paddingRight: 12 },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    scrollFlex: {
        flex: 1,
    },
    scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
    loadingBanner: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    loadingText: { color: '#E2E8F0', fontSize: 12 },
    previewCard: {
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
    },
    previewThumb: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#111111',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    previewImg: { ...StyleSheet.absoluteFill },
    previewText: { color: UCL_TEXT_PRIMARY, fontSize: 9, textAlign: 'center', paddingHorizontal: 4 },
    playBadge: {
        position: 'absolute',
        right: 3,
        bottom: 3,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewMeta: { flex: 1, minWidth: 0 },
    previewLabel: {
        fontSize: 10,
        color: UCL_TEXT_PLACEHOLDER,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    previewHandle: { color: UCL_TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
    previewHint: { color: '#E2E8F0', fontSize: 11, marginTop: 2 },
    reasonText: {
        color: '#E2E8F0',
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 12,
    },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    statusPill: {
        fontSize: 11,
        fontWeight: '700',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 16,
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
        color: UCL_TEXT_PRIMARY,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 16,
    },
    block: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    spendBlock: {
        borderColor: 'rgba(255,255,255,0.16)',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    blockTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: UCL_TEXT_PLACEHOLDER,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    spark: { color: UCL_TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    metricLabel: { color: '#E2E8F0', fontSize: 14 },
    metricValue: { color: UCL_TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
});
