import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { getBoostPerformanceApi, type BoostPerformance } from '../api/client';

type Props = {
    navigation: {
        goBack: () => void;
        canGoBack?: () => boolean;
        navigate: (name: string, params?: object) => void;
    };
    route?: {
        params?: {
            boostId?: number | string;
            postTitle?: string;
            impressions?: number;
            reach?: number;
            clicks?: number;
        };
    };
};

function formatCount(value: number): string {
    return Number(value || 0).toLocaleString();
}

function formatCtr(value: number): string {
    const amount = Number(value);
    return `${(Number.isFinite(amount) ? amount : 0).toFixed(2)}%`;
}

function countParam(value: unknown): number {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/** Keep the totals the insights sheet was already showing when this boost has no metric rows. */
function withSheetTotals(
    data: BoostPerformance,
    params?: { impressions?: number; reach?: number; clicks?: number },
): BoostPerformance {
    const impressions = Math.max(data.summary.impressions, countParam(params?.impressions));
    const reach = Math.max(data.summary.reach, countParam(params?.reach));
    const clicks = Math.max(data.summary.clicks, countParam(params?.clicks));
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    const recorded = data.daily.reduce((sum, day) => sum + Number(day.impressions || 0), 0);
    const daily =
        impressions > recorded || data.daily.length === 0
            ? impressions + reach + clicks > 0
                ? [{
                    date: data.daily[0]?.date || new Date().toISOString().slice(0, 10),
                    impressions,
                    reach,
                    clicks,
                    ctr,
                }]
                : []
            : data.daily;
    return { ...data, summary: { impressions, reach, clicks, ctr }, daily };
}

function formatDay(value: string | null | undefined): string {
    if (!value) return '—';
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export default function BoostAnalyticsScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
    const boostId = route?.params?.boostId;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analyticsData, setAnalyticsData] = useState<BoostPerformance | null>(null);
    const postTitle = route?.params?.postTitle?.trim() || analyticsData?.postTitle || 'Boost performance';

    const load = useCallback(async () => {
        if (boostId == null || boostId === '') {
            setAnalyticsData(null);
            setError('This boost could not be opened.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await getBoostPerformanceApi(boostId);
            setAnalyticsData(withSheetTotals(data, route?.params));
        } catch {
            setAnalyticsData(null);
            setError('Could not load boost performance.');
        } finally {
            setLoading(false);
        }
    }, [boostId, route?.params?.impressions, route?.params?.reach, route?.params?.clicks]);

    useEffect(() => {
        void load();
    }, [load]);

    const goBack = () => {
        if (navigation.canGoBack?.()) {
            navigation.goBack();
            return;
        }
        navigation.navigate('MainTabs', { screen: 'Profile' });
    };

    const summary = analyticsData?.summary;
    const cards = [
        { label: 'Total Impressions', value: formatCount(summary?.impressions ?? 0) },
        { label: 'Local Reach', value: formatCount(summary?.reach ?? 0) },
        { label: 'Total Clicks', value: formatCount(summary?.clicks ?? 0) },
        { label: 'Click-Through Rate (CTR %)', value: formatCtr(summary?.ctr ?? 0) },
    ];
    const active = analyticsData?.status === 'active';
    const dailyDates = (analyticsData?.daily ?? []).map((day) => day.date).filter(Boolean).sort();
    const range = dailyDates.length
        ? `${formatDay(dailyDates[0])} – ${formatDay(dailyDates[dailyDates.length - 1])}`
        : 'Last 7 days';

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.headerBar}>
                <Pressable onPress={goBack} hitSlop={10} accessibilityLabel="Back">
                    <Icon name="chevron-back" size={26} color="#f8fafc" />
                </Pressable>
                <Text style={styles.headerTitle}>Boost performance</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#38bdf8" />
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retry} onPress={() => void load()}>
                        <Text style={styles.retryText}>Try again</Text>
                    </Pressable>
                </View>
            ) : analyticsData ? (
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
                    <View style={styles.hero}>
                        <Text style={styles.postTitle} numberOfLines={2}>{postTitle}</Text>
                        <View style={[styles.badge, active ? styles.badgeActive : styles.badgeExpired]}>
                            <Text style={[styles.badgeText, active ? styles.badgeTextActive : styles.badgeTextExpired]}>
                                {active ? 'Active' : 'Expired'}
                            </Text>
                        </View>
                        <Text style={styles.rangeLabel}>Date range</Text>
                        <Text style={styles.rangeValue}>{range}</Text>
                    </View>

                    <View style={styles.grid}>
                        {cards.map((card) => (
                            <View key={card.label} style={styles.card}>
                                <Text style={styles.cardLabel}>{card.label}</Text>
                                <Text style={styles.cardValue}>{card.value}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.sectionTitle}>Daily performance</Text>
                    {analyticsData.daily.length === 0 ? (
                        <View style={styles.dayCard}>
                            <Text style={styles.emptyDay}>No daily metrics yet.</Text>
                        </View>
                    ) : (
                        analyticsData.daily.map((day) => (
                            <View key={day.date} style={styles.dayCard}>
                                <Text style={styles.dayTitle}>{formatDay(day.date)}</Text>
                                <View style={styles.dayMetrics}>
                                    <Text style={styles.dayMetric}>Impressions {formatCount(day.impressions)}</Text>
                                    <Text style={styles.dayMetric}>Reach {formatCount(day.reach)}</Text>
                                    <Text style={styles.dayMetric}>Clicks {formatCount(day.clicks)}</Text>
                                    <Text style={styles.dayMetric}>CTR {formatCtr(day.ctr)}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: '700',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    hero: {
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    postTitle: {
        color: '#f8fafc',
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 28,
    },
    badge: {
        alignSelf: 'flex-start',
        marginTop: 12,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
    },
    badgeActive: {
        backgroundColor: '#064e3b',
        borderColor: '#34d399',
    },
    badgeExpired: {
        backgroundColor: '#1e293b',
        borderColor: '#334155',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    badgeTextActive: {
        color: '#6ee7b7',
    },
    badgeTextExpired: {
        color: '#cbd5e1',
    },
    rangeLabel: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 14,
    },
    rangeValue: {
        color: '#e2e8f0',
        fontSize: 15,
        marginTop: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: '48%',
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        minHeight: 108,
        justifyContent: 'space-between',
    },
    cardLabel: {
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 18,
    },
    cardValue: {
        color: '#f8fafc',
        fontSize: 24,
        fontWeight: '700',
        marginTop: 10,
    },
    sectionTitle: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 10,
    },
    dayCard: {
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
    },
    dayTitle: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '700',
    },
    dayMetrics: {
        marginTop: 8,
        gap: 4,
    },
    dayMetric: {
        color: '#cbd5e1',
        fontSize: 14,
    },
    emptyDay: {
        color: '#94a3b8',
        fontSize: 14,
    },
    errorText: {
        color: '#e2e8f0',
        fontSize: 16,
        textAlign: 'center',
    },
    retry: {
        marginTop: 16,
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    retryText: {
        color: '#f8fafc',
        fontSize: 15,
        fontWeight: '700',
    },
});
