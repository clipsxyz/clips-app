import React, { useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import {
    chipActiveMagenta,
    chipActiveMagentaText,
    glassPanel,
    glassSurface,
    gazetteerHeader,
} from '../theme/gazetteerAmbientNative';
import {
    buildFilterInfo,
    getFilterOverlayStyle,
    INSTANT_FILTER_NAMES,
    type InstantFilterName,
} from '../utils/instantFiltersNative';

export default function InstantFiltersScreen({ navigation, route }: any) {
    const videoUrl: string | undefined = route.params?.videoUrl || route.params?.mediaUrl;
    const videoDuration = Number(route.params?.videoDuration || 0);
    const videoCoverTime = Number(route.params?.videoCoverTime ?? 0);
    const story24 = !!route.params?.story24;

    const [selectedFilter, setSelectedFilter] = useState<InstantFilterName>('None');
    const [isPaused, setIsPaused] = useState(false);

    const filterOverlayStyle = useMemo(
        () => getFilterOverlayStyle(selectedFilter),
        [selectedFilter],
    );

    const goToComposer = () => {
        const filterInfo = buildFilterInfo(selectedFilter);
        const filterParams = {
            filterInfo,
            filtered: selectedFilter !== 'None',
        };
        if (route.params?.returnToComposer) {
            navigation.navigate({
                name: 'CreateComposer',
                params: filterParams,
                merge: true,
            });
            if (navigation.canGoBack()) {
                navigation.goBack();
            }
            return;
        }
        navigation.navigate('CreateComposer', {
            mediaUrl: videoUrl,
            videoUrl,
            mediaType: 'video',
            videoDuration: videoDuration || 0,
            videoCoverTime,
            story24,
            ...filterParams,
        });
    };

    if (!videoUrl) {
        return (
            <GazetteerScreenShell contentStyle={styles.centered}>
                <Text style={styles.emptyTitle}>No video found</Text>
                <Text style={styles.emptySubtext}>Go back and pick a video from your gallery.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Go back</Text>
                </TouchableOpacity>
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Filters</Text>
                <TouchableOpacity onPress={goToComposer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.nextText}>Next</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.previewWrap}>
                <View style={styles.videoFrame}>
                    <Video
                        source={{ uri: videoUrl }}
                        style={styles.video}
                        resizeMode="contain"
                        paused={isPaused}
                        repeat
                        controls={false}
                        muted
                    />
                    {filterOverlayStyle ? (
                        <View pointerEvents="none" style={[styles.filterOverlay, filterOverlayStyle]} />
                    ) : null}
                    <TouchableOpacity style={styles.pauseBtn} onPress={() => setIsPaused((v) => !v)}>
                        <Icon name={isPaused ? 'play' : 'pause'} size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.hint}>
                    Choose a look below. Stickers and captions are on the next screen.
                </Text>
            </View>

            <View style={styles.filtersCard}>
                <Text style={styles.filtersTitle}>Filter</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {INSTANT_FILTER_NAMES.map((name) => {
                        const active = selectedFilter === name;
                        return (
                            <TouchableOpacity
                                key={name}
                                onPress={() => setSelectedFilter(name)}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                            >
                                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{name}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={18} color="#E5E7EB" />
                    <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={goToComposer}>
                    <Text style={styles.primaryBtnText}>Continue</Text>
                    <Icon name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        ...gazetteerHeader,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    nextText: {
        color: '#f472b6',
        fontSize: 15,
        fontWeight: '700',
    },
    previewWrap: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoFrame: {
        width: '100%',
        maxWidth: 400,
        aspectRatio: 9 / 16,
        maxHeight: '70%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000000',
        ...glassPanel,
    },
    video: {
        width: '100%',
        height: '100%',
    },
    filterOverlay: {
        ...StyleSheet.absoluteFill,
    },
    pauseBtn: {
        position: 'absolute',
        right: 12,
        top: 12,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    hint: {
        marginTop: 14,
        color: 'rgba(227, 227, 227, 0.72)',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
        maxWidth: 360,
    },
    filtersCard: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 14,
        padding: 12,
        ...glassPanel,
    },
    filtersTitle: {
        color: '#F3F4F6',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 10,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 8,
    },
    filterChip: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        ...glassSurface,
    },
    filterChipActive: {
        ...chipActiveMagenta,
    },
    filterChipText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '700',
    },
    filterChipTextActive: {
        ...chipActiveMagentaText,
    },
    footer: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 4,
    },
    primaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#d91b5c',
        borderRadius: 12,
        paddingVertical: 13,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        borderRadius: 12,
        ...glassSurface,
    },
    secondaryBtnText: {
        color: '#E5E7EB',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    emptySubtext: {
        marginTop: 8,
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
    },
});
