import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { PlaceSummary } from '../api/placeSummary';

type Props = {
    locationLabel: string;
    data: PlaceSummary | null;
    loading: boolean;
};

export default function LocationPlaceSummaryBody({ locationLabel, data, loading }: Props) {
    const titleName = data?.name || locationLabel.split(',')[0]?.trim() || locationLabel;

    return (
        <View>
            <Text style={styles.badge}>DISCOVER</Text>
            <Text style={styles.title}>{`About ${titleName}`}</Text>
            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color="#94A3B8" />
                </View>
            ) : (
                <>
                    {data?.tagline ? <Text style={styles.tagline}>{data.tagline}</Text> : null}
                    <Text style={styles.summary}>{data?.summary}</Text>
                    {data?.facts?.map((fact) => (
                        <View key={fact.label} style={styles.factRow}>
                            <Text style={styles.factLabel}>{fact.label.toUpperCase()}</Text>
                            <Text style={styles.factValue}>{fact.value}</Text>
                        </View>
                    ))}
                    {data?.attribution ? <Text style={styles.attribution}>{data.attribution}</Text> : null}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        color: '#818CF8',
        marginBottom: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    tagline: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 8,
    },
    summary: {
        fontSize: 14,
        lineHeight: 22,
        color: '#9CA3AF',
    },
    loadingWrap: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    factRow: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    factLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
        color: '#6B7280',
        marginBottom: 4,
    },
    factValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#D1D5DB',
    },
    attribution: {
        marginTop: 12,
        fontSize: 10,
        color: '#6B7280',
    },
});
