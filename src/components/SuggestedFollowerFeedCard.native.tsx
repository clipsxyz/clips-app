import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import type { Post } from '../types';
import type { SuggestedFollowerSuggestion } from '../utils/suggestedFollowerFeed';
import PassportSheetCanvas, { PASSPORT_SHEET_WASH } from './PassportSheetCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import Video, { type VideoRef } from 'react-native-video';
import {
    isMockDemoVideoPath,
    mockFeedVideoSource,
} from '../constants/mockFeedVideos.native';
import { androidListSafeVideoProps } from '../utils/androidSafeVideoNative';
import { getFeedScrollBusy, subscribeFeedScrollBusy } from '../utils/feedScrollBusyNative';

type Props = {
  suggestion: SuggestedFollowerSuggestion;
  onFollow: (post: Post) => void | Promise<void>;
  onDismiss: () => void;
  onNotInterested: () => void;
  onOpenProfile: (handle: string) => void;
};

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function looksLikeVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || isMockDemoVideoPath(url);
}

/** Muted looping preview — same pattern as Stories 24 rail cards. */
const PREVIEW_LOOP_SEC = 2;

function SuggestedThumbPreviewVideo({
  url,
  posterUri,
}: {
  url: string;
  posterUri?: string;
}) {
  const videoRef = React.useRef<VideoRef>(null);
  const [feedScrolling, setFeedScrolling] = React.useState(getFeedScrollBusy());
  React.useEffect(() => subscribeFeedScrollBusy(setFeedScrolling), []);

  const posterSource =
    posterUri &&
    posterUri.trim().length > 0 &&
    !posterUri.startsWith('#') &&
    !looksLikeVideoUrl(posterUri)
      ? { uri: posterUri }
      : undefined;

  if (feedScrolling && posterSource) {
    return (
      <Image
        source={posterSource}
        style={styles.thumbImage}
        resizeMode="cover"
        pointerEvents="none"
      />
    );
  }

  return (
    <Video
      ref={videoRef}
      source={mockFeedVideoSource(url)}
      style={styles.thumbImage}
      resizeMode="cover"
      paused={feedScrolling}
      muted
      repeat
      controls={false}
      playInBackground={false}
      playWhenInactive={false}
      ignoreSilentSwitch="obey"
      {...androidListSafeVideoProps()}
      pointerEvents="none"
      onProgress={({ currentTime }) => {
        if (currentTime > PREVIEW_LOOP_SEC) {
          videoRef.current?.seek(0);
        }
      }}
    />
  );
}

export default function SuggestedFollowerFeedCard({
  suggestion,
  onFollow,
  onNotInterested,
  onOpenProfile,
}: Props) {
  const [followBusy, setFollowBusy] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [thumbWidth, setThumbWidth] = React.useState(100);
  const avatar = suggestion.avatarUrl || getAvatarForHandle(suggestion.userHandle);
  const previewCount = suggestion.previews.length;

  const onThumbRowLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    const gap = 8;
    const n = Math.max(1, previewCount);
    setThumbWidth(Math.floor((w - gap * (n - 1)) / n));
  };

  const handleFollow = async () => {
    setFollowBusy(true);
    try {
      await onFollow(suggestion.representativePost);
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <PassportSheetCanvas contentStyle={styles.content}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setInfoOpen((v) => !v)} accessibilityLabel="Info">
          <Icon name="information-circle-outline" size={20} color="rgba(232,238,242,0.62)" />
        </TouchableOpacity>

        {infoOpen ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Gazetteer only suggests people who have posted in your area. Clips play muted in the feed, like other
              posts.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.profileBlock} onPress={() => onOpenProfile(suggestion.userHandle)}>
          <Avatar src={avatar} name={suggestion.displayName} size="xl" />
          <Text style={styles.handle}>{suggestion.userHandle}</Text>
          <Text style={styles.context}>{suggestion.contextLabel}</Text>
          <View style={styles.badgeRow}>
            <Icon name="business-outline" size={12} color={PASSPORT_PALETTE.wavePrimary} />
            <Text style={styles.badgeText}>Suggested by Gazetteer</Text>
          </View>
        </TouchableOpacity>

        <View
          style={[styles.thumbRow, previewCount === 1 && styles.thumbRowSingle]}
          onLayout={onThumbRowLayout}
        >
          {suggestion.previews.map((preview) => {
            const rawVideo =
              preview.isVideo
                ? preview.mediaUrl ||
                  (looksLikeVideoUrl(preview.thumbnailUrl) || isMockDemoVideoPath(preview.thumbnailUrl)
                    ? preview.thumbnailUrl
                    : undefined)
                : undefined;
            const videoUrl =
              rawVideo &&
              (isMockDemoVideoPath(rawVideo) || looksLikeVideoUrl(rawVideo))
                ? rawVideo
                : undefined;
            const posterUri =
              preview.thumbnailUrl &&
              !looksLikeVideoUrl(preview.thumbnailUrl) &&
              !isMockDemoVideoPath(preview.thumbnailUrl) &&
              !preview.thumbnailUrl.startsWith('#')
                ? preview.thumbnailUrl
                : undefined;
            return (
            <TouchableOpacity
              key={preview.postId}
              onPress={() => onOpenProfile(suggestion.userHandle)}
              style={[
                styles.thumb,
                {
                  width: previewCount === 1 ? Math.min(thumbWidth, 140) : thumbWidth,
                },
              ]}
            >
              {videoUrl ? (
                <SuggestedThumbPreviewVideo url={videoUrl} posterUri={posterUri} />
              ) : posterUri ? (
                <Image
                  source={{ uri: posterUri }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumbImage, styles.thumbPlaceholder]} />
              )}
              <View style={styles.viewsOverlay}>
                <Icon name="play" size={10} color="#fff" />
                <Text style={styles.viewsText}>{formatViews(preview.views)}</Text>
              </View>
              {preview.gazetteerMusic ? (
                <View style={styles.musicBadge}>
                  <Text style={styles.musicBadgeText}>♪ Gazetteer</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onNotInterested}>
            <Text style={styles.secondaryBtnText}>Not interested</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtnWrap} onPress={handleFollow} disabled={followBusy}>
            <LinearGradient
              colors={[...PASSPORT_SHEET_WASH]}
              locations={[0, 0.22, 0.52, 0.78, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {followBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Follow</Text>
            )}
          </TouchableOpacity>
        </View>
      </PassportSheetCanvas>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: PASSPORT_ABYSS,
    overflow: 'hidden',
    minHeight: 300,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    minHeight: 300,
  },
  iconBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    padding: 6,
  },
  infoBox: {
    marginTop: 36,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(15, 36, 48, 0.88)',
    padding: 10,
  },
  infoText: {
    fontSize: 11,
    color: 'rgba(232,238,242,0.78)',
    lineHeight: 16,
  },
  profileBlock: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 12,
  },
  handle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  context: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(232,238,242,0.62)',
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  badgeText: {
    fontSize: 10,
    color: PASSPORT_PALETTE.wavePrimary,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  thumbRowSingle: {
    justifyContent: 'center',
  },
  thumb: {
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: '#121212',
  },
  viewsOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  musicBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(61,155,143,0.92)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  musicBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(15, 36, 48, 0.72)',
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtnWrap: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
