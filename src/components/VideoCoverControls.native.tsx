import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { glassSurface } from '../theme/gazetteerAmbientNative';

type Props = {
    durationSec: number;
    coverTime: number;
    onCoverTimeChange: (value: number) => void;
    onScrubPreview?: (timeSec: number) => void;
};

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

/** Pick which frame is used as the feed thumbnail (full video is uploaded as-is). */
export default function VideoCoverControls({
    durationSec,
    coverTime,
    onCoverTimeChange,
    onScrubPreview,
}: Props) {
    const maxDuration = Math.max(0.1, durationSec);
    const safeCover = Math.max(0, Math.min(maxDuration, coverTime));

    return (
        <View style={styles.card}>
            <View style={styles.titleRow}>
                <Text style={styles.title}>Cover frame</Text>
                <TouchableOpacity
                    onPress={() => {
                        onCoverTimeChange(0);
                        onScrubPreview?.(0);
                    }}
                    style={styles.resetBtn}
                >
                    <Text style={styles.resetText}>First frame</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.label}>Thumbnail at · {round1(safeCover)}s</Text>
            <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={maxDuration}
                step={0.1}
                value={safeCover}
                minimumTrackTintColor="#F8D26A"
                maximumTrackTintColor="rgba(255,255,255,0.15)"
                thumbTintColor="#F8D26A"
                onValueChange={(value) => {
                    const next = round1(value);
                    onCoverTimeChange(next);
                    onScrubPreview?.(next);
                }}
            />
            <Text style={styles.meta}>Video length {round1(maxDuration)}s · full clip is posted</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        padding: 12,
        gap: 4,
        ...glassSurface,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: { color: '#F3F4F6', fontSize: 14, fontWeight: '700' },
    resetBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    resetText: { color: '#D1D5DB', fontSize: 12, fontWeight: '600' },
    label: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginTop: 4 },
    slider: { width: '100%', height: 36 },
    meta: { color: '#6B7280', fontSize: 11, fontWeight: '600', marginTop: 6 },
});
