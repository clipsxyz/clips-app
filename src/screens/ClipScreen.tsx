import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import * as ImagePicker from 'react-native-image-picker';

/** Story composer hub — routes into Story 24 flows (web ClipPage parity, phased). */
const ClipScreen: React.FC = ({ navigation }: any) => {
    const storyParams = { story24: true };

    const openCapturedMedia = (uri: string | undefined, mediaType: 'image' | 'video') => {
        if (!uri) return;
        navigation.navigate('GalleryPreview', {
            mediaUrl: uri,
            mediaType,
            ...storyParams,
        });
    };

    const handleTakePhoto = () => {
        ImagePicker.launchCamera({ mediaType: 'photo', quality: 0.8 }, (response) => {
            if (response.assets?.[0]?.uri) {
                openCapturedMedia(response.assets[0].uri, 'image');
            }
        });
    };

    const handleRecordVideo = () => {
        ImagePicker.launchCamera({ mediaType: 'video', quality: 0.8 }, (response) => {
            if (response.assets?.[0]?.uri) {
                openCapturedMedia(response.assets[0].uri, 'video');
            }
        });
    };

    const handleChooseFromGallery = () => {
        ImagePicker.launchImageLibrary({ mediaType: 'mixed', quality: 0.8 }, (response) => {
            const asset = response.assets?.[0];
            if (!asset?.uri) return;
            const isVideo = asset.type?.startsWith('video');
            openCapturedMedia(asset.uri, isVideo ? 'video' : 'image');
        });
    };

    const options = [
        { key: 'photo', icon: 'camera', label: 'Take Photo', onPress: handleTakePhoto },
        { key: 'video', icon: 'videocam', label: 'Record Video', onPress: handleRecordVideo },
        { key: 'gallery', icon: 'images', label: 'Gallery', onPress: handleChooseFromGallery },
        { key: 'text', icon: 'text', label: 'Text Story', onPress: () => navigation.navigate('TextOnlyCreate', storyParams) },
        { key: 'poll', icon: 'stats-chart', label: 'Poll', onPress: () => navigation.navigate('ClipPoll') },
        { key: 'live', icon: 'radio', label: 'Go Live', onPress: () => navigation.navigate('Live') },
        {
            key: 'studio',
            icon: 'color-wand',
            label: 'Story Studio',
            onPress: () => navigation.navigate('InstantCreate', { mode: 'story24' }),
        },
    ] as const;

    return (
        <GazetteerScreenShell contentStyle={styles.content}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.title}>Create Story</Text>
                <View style={styles.backBtn} />
            </View>
            <Text style={styles.subtitle}>Photos, video, text, polls, and live — same flows as web Clip.</Text>
            <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
                {options.map((opt) => (
                    <TouchableOpacity key={opt.key} onPress={opt.onPress} style={styles.optionButton}>
                        <Icon name={opt.icon} size={30} color="#f472b6" />
                        <Text style={styles.optionText}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </GazetteerScreenShell>
    );
};

const styles = StyleSheet.create({
    content: { flex: 1, paddingHorizontal: 16 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        marginBottom: 8,
    },
    backBtn: { width: 40, padding: 4 },
    title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    subtitle: { color: '#9CA3AF', fontSize: 13, marginBottom: 16, textAlign: 'center' },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        paddingBottom: 24,
        gap: 12,
    },
    optionButton: {
        width: '44%',
        minWidth: 140,
        aspectRatio: 1,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...glassPanel,
    },
    optionText: {
        fontSize: 13,
        color: '#FFFFFF',
        marginTop: 8,
        textAlign: 'center',
        fontWeight: '600',
    },
});

export default ClipScreen;
