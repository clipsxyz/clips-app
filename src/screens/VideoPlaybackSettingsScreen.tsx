import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import {
    getFeedAutoplayPref,
    setFeedAutoplayPref,
    type FeedAutoplayPref,
} from '../utils/feedAutoplayPrefNative';
import { getGlobalVideoMutedNative, setGlobalVideoMutedNative } from '../utils/globalVideoMuteNative';

const AUTOPLAY_OPTIONS: { id: FeedAutoplayPref; label: string; hint: string }[] = [
    { id: 'always', label: 'Always', hint: 'Autoplay on Wi-Fi and cellular' },
    { id: 'wifi', label: 'Wi-Fi only', hint: 'Autoplay when connected to Wi-Fi' },
    { id: 'never', label: 'Never', hint: 'Show the cover. Tap a video to play it' },
];

export default function VideoPlaybackSettingsScreen({ navigation }: any) {
    const [autoplayPref, setAutoplayPref] = useState<FeedAutoplayPref>('always');
    const [muted, setMuted] = useState(true);
    const [networkLabel, setNetworkLabel] = useState('Checking connection…');
    const [loading, setLoading] = useState(true);

    const refreshNetworkLabel = useCallback(async () => {
        try {
            const state = await NetInfo.fetch();
            if (state.isConnected === false) {
                setNetworkLabel('Offline. Wi-Fi only autoplay stays paused');
                return;
            }
            if (state.type === 'wifi') setNetworkLabel('Connected via Wi-Fi');
            else if (state.type === 'cellular') setNetworkLabel('Connected via cellular');
            else if (state.type === 'ethernet') setNetworkLabel('Connected via Ethernet');
            else setNetworkLabel(`Connection: ${state.type}`);
        } catch {
            setNetworkLabel('Connection unknown');
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
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

    const toggleMuted = async () => {
        const next = !muted;
        setMuted(next);
        await setGlobalVideoMutedNative(next);
    };

    return (
        <GazetteerScreenShell ambientVariant="passport">
            <View style={styles.screen}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Back">
                        <Icon name="chevron-back" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Video playback</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Feed autoplay</Text>
                        <Text style={styles.sectionSubtext}>
                            Choose when videos in the home feed play as you scroll.
                        </Text>
                        <Text style={styles.networkText}>{networkLabel}</Text>
                        <View style={styles.optionList}>
                            {AUTOPLAY_OPTIONS.map((option) => {
                                const active = autoplayPref === option.id;
                                return (
                                    <Pressable
                                        key={option.id}
                                        style={[styles.optionRow, active && styles.optionRowActive]}
                                        onPress={() => void selectAutoplay(option.id)}
                                        disabled={loading}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: active }}
                                    >
                                        <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                                            {active ? <View style={styles.radioInner} /> : null}
                                        </View>
                                        <View style={styles.optionTextWrap}>
                                            <Text style={styles.optionLabel}>{option.label}</Text>
                                            <Text style={styles.optionHint}>{option.hint}</Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <Text style={styles.sectionTitle}>Mute videos</Text>
                                <Text style={styles.sectionSubtext}>
                                    On means feed, stories, and scenes start silent. You can still unmute a single video.
                                </Text>
                            </View>
                            <Pressable
                                style={[styles.toggleTrack, muted && styles.toggleTrackActive]}
                                onPress={() => void toggleMuted()}
                                disabled={loading}
                                accessibilityRole="switch"
                                accessibilityState={{ checked: muted }}
                                accessibilityLabel="Mute videos"
                            >
                                <View style={[styles.toggleThumb, muted && styles.toggleThumbActive]} />
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#0B0E14',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSpacer: { width: 40 },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 32,
        gap: 12,
    },
    section: {
        borderRadius: 16,
        padding: 14,
        backgroundColor: '#161B22',
        borderWidth: 1,
        borderColor: '#2A2F3D',
        gap: 8,
    },
    sectionTitle: {
        color: '#8B949E',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    sectionSubtext: {
        color: '#C9D1D9',
        fontSize: 14,
        lineHeight: 20,
    },
    networkText: {
        color: '#F472B6',
        fontSize: 13,
        fontWeight: '600',
    },
    optionList: { gap: 8 },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#0B0E14',
        borderWidth: 1,
        borderColor: '#2A2F3D',
    },
    optionRowActive: {
        borderColor: 'rgba(244,114,182,0.7)',
    },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#8B949E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterActive: {
        borderColor: '#F472B6',
    },
    radioInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F472B6',
    },
    optionTextWrap: { flex: 1 },
    optionLabel: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    optionHint: {
        marginTop: 2,
        color: '#8B949E',
        fontSize: 13,
        lineHeight: 18,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    toggleInfo: { flex: 1 },
    toggleTrack: {
        width: 46,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#30363D',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    toggleTrackActive: {
        backgroundColor: '#d91b5c',
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },
});
