import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';

type PickerMode = 'feed' | 'story24';

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

  const openLibrary = (mode: PickerMode) => {
    ImagePicker.launchImageLibrary({ mediaType: 'mixed', quality: 0.9 }, (response) => {
      const asset = response.assets?.[0];
      if (!asset?.uri) return;
      navigation.navigate('GalleryPreview', {
        mediaUrl: asset.uri,
        mediaType: asset.type?.startsWith('video') ? 'video' : 'image',
        story24: mode === 'story24',
      });
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <Text style={styles.cardHint}>Pick existing media</Text>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 24, height: 24 },
  grid: {
    flex: 1,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    padding: 16,
    marginBottom: 12,
    minHeight: 130,
    justifyContent: 'center',
  },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 10 },
  cardHint: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  cardWide: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    padding: 16,
    minHeight: 88,
    justifyContent: 'center',
  },
  cardWideTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 8 },
  cardWideHint: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
});
