import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

export default function GalleryPreviewScreen({ navigation, route }: any) {
  const mediaUrl: string | undefined = route.params?.mediaUrl;
  const mediaType: 'image' | 'video' = route.params?.mediaType === 'video' ? 'video' : 'image';
  const story24 = !!route.params?.story24;
  const [trimStart, setTrimStart] = React.useState(0);
  const [trimEnd, setTrimEnd] = React.useState(15);
  const [coverTime, setCoverTime] = React.useState(0);

  const handleContinue = () => {
    navigation.navigate('CreateComposer', {
      mediaUrl,
      videoUrl: mediaType === 'video' ? mediaUrl : undefined,
      mediaType,
      story24,
      trimStart,
      trimEnd,
      videoCoverTime: coverTime,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Preview</Text>
        <TouchableOpacity onPress={handleContinue}>
          <Text style={styles.nextText}>Use</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.previewWrap}>
        {mediaType === 'image' && mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.preview} resizeMode="contain" />
        ) : (
          <View style={styles.videoFallback}>
            <Icon name="videocam" size={44} color="#F3F4F6" />
            <Text style={styles.videoFallbackText}>Video selected</Text>
            <Text style={styles.videoFallbackSubtext}>Tap Use to continue editing</Text>
          </View>
        )}
      </View>
      {mediaType === 'video' && (
        <View style={styles.videoToolsCard}>
          <Text style={styles.videoToolsTitle}>Quick edit</Text>
          <View style={styles.videoToolsRow}>
            <TouchableOpacity style={styles.toolBtn} onPress={() => setTrimStart((v) => Math.max(0, v - 1))}>
              <Text style={styles.toolBtnText}>Trim -</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={() => setTrimEnd((v) => Math.max(trimStart + 1, v + 1))}>
              <Text style={styles.toolBtnText}>Trim +</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={() => setCoverTime((v) => Math.max(0, v + 1))}>
              <Text style={styles.toolBtnText}>Cover +1s</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.videoToolsMeta}>
            Trim: {trimStart}s - {trimEnd}s | Cover: {coverTime}s
          </Text>
          <View style={styles.videoToolsRow}>
            <TouchableOpacity
              style={styles.toolGhostBtn}
              onPress={() => Alert.alert('Coming next', 'Advanced trim timeline will be added in the next polish pass.')}
            >
              <Text style={styles.toolGhostBtnText}>Advanced Trim</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolGhostBtn}
              onPress={() => Alert.alert('Coming next', 'Frame scrubber/cover picker will be added in the next polish pass.')}
            >
              <Text style={styles.toolGhostBtnText}>Cover Picker</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {story24 && (
        <View style={styles.storyBadge}>
          <Icon name="location" size={14} color="#111827" />
          <Text style={styles.storyBadgeText}>Stories 24 mode</Text>
        </View>
      )}
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
  nextText: { color: '#F8D26A', fontSize: 15, fontWeight: '700' },
  previewWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  preview: { width: '100%', height: '100%' },
  videoFallback: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    paddingVertical: 44,
    alignItems: 'center',
  },
  videoFallbackText: { color: '#F9FAFB', marginTop: 10, fontSize: 16, fontWeight: '700' },
  videoFallbackSubtext: { color: '#9CA3AF', marginTop: 6, fontSize: 13 },
  videoToolsCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    padding: 12,
    gap: 8,
  },
  videoToolsTitle: { color: '#F3F4F6', fontSize: 13, fontWeight: '700' },
  videoToolsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  toolBtnText: { color: '#E5E7EB', fontSize: 12, fontWeight: '700' },
  videoToolsMeta: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  toolGhostBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  toolGhostBtnText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  storyBadge: {
    margin: 16,
    marginTop: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  storyBadgeText: { color: '#111827', fontSize: 12, fontWeight: '700' },
});
