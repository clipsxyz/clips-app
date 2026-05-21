import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassSurface } from '../theme/gazetteerAmbientNative';

type PickerMode = 'feed' | 'story24';

function assetIsVideo(asset: { type?: string; uri?: string }) {
  return Boolean(
    asset.type?.startsWith('video') ||
      asset.uri?.toLowerCase().endsWith('.mp4') ||
      asset.uri?.toLowerCase().endsWith('.mov'),
  );
}

export default function InstantCreateScreen({ navigation }: any) {
  const openCamera = (mode: PickerMode) => {
    Alert.alert('Create with camera', 'Choose capture type', [
      {
        text: 'Photo',
        onPress: () => {
          ImagePicker.launchCamera({ mediaType: 'photo', quality: 0.9 }, (response) => {
            const asset = response.assets?.[0];
            if (!asset?.uri) return;
            navigation.navigate('GalleryPreview', {
              mediaUrl: asset.uri,
              mediaType: 'image',
              story24: mode === 'story24',
            });
          });
        },
      },
      {
        text: 'Video',
        onPress: () => {
          ImagePicker.launchCamera({ mediaType: 'video', quality: 0.8 }, (response) => {
            const asset = response.assets?.[0];
            if (!asset?.uri) return;
            navigation.navigate('GalleryPreview', {
              mediaUrl: asset.uri,
              mediaType: 'video',
              story24: mode === 'story24',
            });
          });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const navigateFromAssets = (assets: ImagePicker.Asset[], mode: PickerMode, carousel: boolean) => {
    if (!assets.length) return;
    if (carousel && assets.length >= 2) {
      const items = assets
        .filter((a) => a.uri)
        .slice(0, 10)
        .map((a) => {
          const isVideo = assetIsVideo(a);
          const slide: {
            uri: string;
            type: 'image' | 'video';
            videoCoverTime?: number;
            durationSec?: number;
          } = {
            uri: a.uri!,
            type: isVideo ? 'video' : 'image',
          };
          if (isVideo) {
            slide.videoCoverTime = 0;
            const d = Number(a.duration || 0);
            if (Number.isFinite(d) && d > 0) {
              slide.durationSec = Math.max(0.1, Math.floor(d * 10) / 10);
            }
          }
          return slide;
        });
      navigation.navigate('GalleryPreview', { carouselItems: items, story24: mode === 'story24' });
      return;
    }
    const asset = assets[0];
    if (!asset?.uri) return;
    navigation.navigate('GalleryPreview', {
      mediaUrl: asset.uri,
      mediaType: assetIsVideo(asset) ? 'video' : 'image',
      story24: mode === 'story24',
    });
  };

  const pickLibrary = (mode: PickerMode, carousel: boolean) => {
    ImagePicker.launchImageLibrary(
      {
        mediaType: 'mixed',
        quality: 0.9,
        selectionLimit: carousel ? 10 : 1,
      },
      (response) => {
        if (response.didCancel) return;
        navigateFromAssets(response.assets || [], mode, carousel);
      },
    );
  };

  const openLibrary = (mode: PickerMode) => {
    const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' }> = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Single photo/video', onPress: () => pickLibrary(mode, false) },
    ];
    if (mode !== 'story24') {
      buttons.splice(1, 0, {
        text: 'Carousel (2–10)',
        onPress: () => pickLibrary(mode, true),
      });
    }
    Alert.alert(
      'Upload from your gallery',
      'TikTok, Instagram, CapCut, and camera-roll clips all appear here.',
      buttons,
    );
  };

  return (
    <GazetteerScreenShell edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Create</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={() => openCamera('feed')}>
          <Icon name="camera" size={28} color="#FDE68A" />
          <Text style={styles.cardTitle}>Camera</Text>
          <Text style={styles.cardHint}>Capture now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => openLibrary('feed')}>
          <Icon name="images" size={28} color="#E5E7EB" />
          <Text style={styles.cardTitle}>Gallery</Text>
          <Text style={styles.cardHint}>Single or carousel</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => pickLibrary('feed', true)}>
          <Icon name="albums" size={28} color="#FBCFE8" />
          <Text style={styles.cardTitle}>Carousel</Text>
          <Text style={styles.cardHint}>2–10 photos & videos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TextOnlyCreate')}>
          <Icon name="text" size={28} color="#F8D26A" />
          <Text style={styles.cardTitle}>Text only</Text>
          <Text style={styles.cardHint}>Share without media</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => openCamera('story24')}>
          <Icon name="location" size={28} color="#C0C0C0" />
          <Text style={styles.cardTitle}>Stories 24</Text>
          <Text style={styles.cardHint}>Capture a 24h story</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cardWide} onPress={() => navigation.navigate('TextOnlyCreate', { story24: true })}>
          <Icon name="chatbox-ellipses" size={24} color="#F3F4F6" />
          <Text style={styles.cardWideTitle}>Stories 24 text</Text>
          <Text style={styles.cardWideHint}>Quick text story composer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cardWide} onPress={() => navigation.navigate('Create')}>
          <Icon name="color-wand" size={24} color="#F472B6" />
          <Text style={styles.cardWideTitle}>Studio composer</Text>
          <Text style={styles.cardWideHint}>Filters, stickers, video cover, drafts</Text>
        </TouchableOpacity>
      </View>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 24 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  card: {
    width: '47%',
    minHeight: 120,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    ...glassSurface,
  },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cardHint: { color: '#9CA3AF', fontSize: 12 },
  cardWide: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    ...glassSurface,
  },
  cardWideTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 },
  cardWideHint: { color: '#9CA3AF', fontSize: 12, flex: 1 },
});
