import React, { useRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { type VideoRef } from 'react-native-video';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import VideoCoverControls from '../components/VideoCoverControls.native';
import { glassPanel, gazetteerHeader } from '../theme/gazetteerAmbientNative';

export default function GalleryPreviewScreen({ navigation, route }: any) {
  const mediaUrl: string | undefined = route.params?.mediaUrl;
  const mediaType: 'image' | 'video' = route.params?.mediaType === 'video' ? 'video' : 'image';
  const story24 = !!route.params?.story24;
  const videoRef = useRef<VideoRef>(null);
  const [coverTime, setCoverTime] = React.useState(0);
  const [isVideoPaused, setIsVideoPaused] = React.useState(false);
  const [videoDurationSec, setVideoDurationSec] = React.useState(15);

  React.useEffect(() => {
    if (mediaType !== 'video') return;
    setCoverTime(0);
  }, [mediaType, mediaUrl]);

  const seekPreview = (timeSec: number) => {
    videoRef.current?.seek(Math.max(0, timeSec));
    setIsVideoPaused(true);
  };

  const handleContinue = () => {
    if (mediaType === 'video' && mediaUrl) {
      navigation.navigate('InstantFilters', {
        videoUrl: mediaUrl,
        mediaUrl,
        mediaType: 'video',
        videoDuration: videoDurationSec,
        videoCoverTime: coverTime,
        story24,
      });
      return;
    }
    navigation.navigate('CreateComposer', {
      mediaUrl,
      mediaType,
      story24,
    });
  };

  return (
    <GazetteerScreenShell>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Preview</Text>
        <TouchableOpacity onPress={handleContinue}>
          <Text style={styles.nextText}>Use</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.previewWrap}>
          {mediaType === 'image' && mediaUrl ? (
            <Image source={{ uri: mediaUrl }} style={styles.preview} resizeMode="contain" />
          ) : mediaUrl ? (
            <View style={styles.videoPreviewWrap}>
              <Video
                ref={videoRef}
                source={{ uri: mediaUrl }}
                style={styles.videoPreview}
                resizeMode="contain"
                paused={isVideoPaused}
                repeat
                controls
                muted
                onLoad={(event) => {
                  const duration = Number(event?.duration || 0);
                  if (!Number.isFinite(duration) || duration <= 0) return;
                  const rounded = Math.max(0.1, Math.floor(duration * 10) / 10);
                  setVideoDurationSec(rounded);
                  setCoverTime((prev) => Math.min(Math.max(0, prev), rounded));
                }}
              />
              <TouchableOpacity style={styles.videoPauseBtn} onPress={() => setIsVideoPaused((v) => !v)}>
                <Icon name={isVideoPaused ? 'play' : 'pause'} size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.videoFallback}>
              <Icon name="warning-outline" size={32} color="#FCA5A5" />
              <Text style={styles.videoFallbackSubtext}>No video available for preview</Text>
            </View>
          )}
        </View>

        {mediaType === 'video' ? (
          <View style={styles.coverControlsWrap}>
            <VideoCoverControls
              durationSec={videoDurationSec}
              coverTime={coverTime}
              onCoverTimeChange={setCoverTime}
              onScrubPreview={seekPreview}
            />
          </View>
        ) : null}

        {story24 ? (
          <View style={styles.storyBadge}>
            <Icon name="location" size={14} color="#111827" />
            <Text style={styles.storyBadgeText}>Stories 24 mode</Text>
          </View>
        ) : null}
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
    paddingVertical: 14,
    ...gazetteerHeader,
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  nextText: { color: '#f472b6', fontSize: 15, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24, gap: 12 },
  previewWrap: {
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  preview: { width: '100%', height: 280 },
  videoPreviewWrap: {
    width: '100%',
    height: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoPauseBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoFallback: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 44,
    alignItems: 'center',
    ...glassPanel,
  },
  videoFallbackSubtext: { color: '#9CA3AF', marginTop: 6, fontSize: 13 },
  coverControlsWrap: {
    marginHorizontal: 16,
  },
  storyBadge: {
    marginHorizontal: 16,
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
