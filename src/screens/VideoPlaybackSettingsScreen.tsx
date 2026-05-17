import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import {
    chipActiveMagenta,
    glassPanel,
    glassSurface,
    gazetteerHeader,
} from '../theme/gazetteerAmbientNative';
import {
    getFeedAutoplayPref,
    setFeedAutoplayPref,
    type FeedAutoplayPref,
} from '../utils/feedAutoplayPrefNative';
import { getGlobalVideoMutedNative, setGlobalVideoMutedNative } from '../utils/globalVideoMuteNative';

const AUTOPLAY_OPTIONS: { id: FeedAutoplayPref; label: string; hint: string }[] = [
    { id: 'always', label: 'Always', hint: 'Autoplay on Wi‑Fi and cellular' },
    { id: 'wifi', label: 'Wi‑Fi only', hint: 'Autoplay when connected to Wi‑Fi' },
    { id: 'never', label: 'Never', hint: 'Show poster only; tap to open post' },
];

export default function VideoPlaybackSettingsScreen({ navigation }: any) {
    const [autoplayPref, setAutoplayPref] = useState<FeedAutoplayPref>('wifi');
    const [muted, setMuted] = useState(true);
    const [networkLabel, setNetworkLabel] = useState('Checking connection…');
    const [loading, setLoading] = useState(true);

    const refreshNetworkLabel = useCallback(async () => {
        try {
            const state = await NetInfo.fetch();
            if (state.isConnected === false) {
                setNetworkLabel('Offline — Wi‑Fi only autoplay is paused');
                return;
            }
            const type = state.type;
            if (type === 'wifi') {
                setNetworkLabel('Connected via Wi‑Fi');
            } else if (type === 'cellular') {
                setNetworkLabel('Connected via cellular');
            } else if (type === 'ethernet') {
                setNetworkLabel('Connected via Ethernet');
            } else {
                setNetworkLabel(`Connection: ${type}`);
            }
        } catch {
            setNetworkLabel('Connection unknown');
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [pref, isMuted] = await Promise.all([getFeedAutoplayPref(), getGlobalVideoMutedNative()]);
            if (cancelled) return;
            setAutoplayPref(pref);
            setMuted(isMuted);
            setLoading(false);
        })();
        void refreshNetworkLabel();
        const unsub = NetInfo.addEventListener(() => {
            void refreshNetworkLabel();
        });
        return () => {
            cancelled = true;
            unsub();
        };
    }, [refreshNetworkLabel]);

    const selectAutoplay = async (pref: FeedAutoplayPref) => {
        setAutoplayPref(pref);
        await setFeedAutoplayPref(pref);
    };

    const toggleMuted = async (next: boolean) => {
        setMuted(next);
        await setGlobalVideoMutedNative(next);
    };

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={18} color="#FFFFFF" />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Video playback</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Feed autoplay</Text>
                    <Text style={styles.sectionSubtext}>
                        Choose when videos in your home feed play automatically as you scroll.
                    </Text>
                    <Text style={styles.networkText}>{networkLabel}</Text>
                    <View style={styles.optionList}>
                        {AUTOPLAY_OPTIONS.map((option) => {
                            const active = autoplayPref === option.id;
                            return (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.optionRow, active && styles.optionRowActive]}
                                    onPress={() => void selectAutoplay(option.id)}
                                    disabled={loading}
                                >
                                    <View style={styles.optionTextWrap}>
                                        <Text
                                            style={[
                                                styles.optionLabel,
                                                active ? styles.optionLabelActive : null,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                        <Text style={styles.optionHint}>{option.hint}</Text>
                                    </View>
                                    {active ? <Icon name="checkmark-circle" size={22} color="#f472b6" /> : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleInfo}>
                            <Text style={styles.sectionTitle}>Mute feed videos</Text>
                            <Text style={styles.sectionSubtext}>
                                When on, autoplaying videos start without sound. You can unmute per video in the
                                feed later.
                            </Text>
                        </View>
                        <Switch
                            value={muted}
                            onValueChange={(next) => void toggleMuted(next)}
                            trackColor={{ false: '#374151', true: '#9D174D' }}
                            thumbColor={muted ? '#f472b6' : '#9CA3AF'}
                        />
                    </View>
                </View>
            </ScrollView>
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        ...gazetteerHeader,
    },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    content: { padding: 16, gap: 12, paddingBottom: 32 },
    section: {
        borderRadius: 12,
        padding: 14,
        ...glassPanel,
    },
    sectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    sectionSubtext: { marginTop: 6, color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
    networkText: { marginTop: 10, color: '#D1D5DB', fontSize: 12, fontWeight: '600' },
    optionList: { marginTop: 12, gap: 8 },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 10,
        padding: 12,
        ...glassSurface,
    },
    optionRowActive: {
        ...chipActiveMagenta,
    },
    optionTextWrap: { flex: 1, paddingRight: 10 },
    optionLabel: { color: '#E5E7EB', fontSize: 14, fontWeight: '700' },
    optionLabelActive: {
        color: '#FBCFE8',
    },
    optionHint: { marginTop: 3, color: '#9CA3AF', fontSize: 12 },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    toggleInfo: { flex: 1 },
});
