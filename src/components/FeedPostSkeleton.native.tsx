import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RATIO_FALLBACK } from '../utils/mediaAspectRatio';
import { FEED_CARD_FLOAT_WRAP } from './FeedPageLayout.native';

/**
 * Pulsing card shell shown while a feed scope loads (first paint, or right after a
 * location switch). Mirrors the real card silhouette — header avatar + name lines,
 * full-bleed media frame, caption lines, engagement row — so the incoming posts
 * swap in without a layout jump.
 */
function FeedPostSkeletonCard() {
  const reducedMotionEnabled = useReducedMotion();
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    if (reducedMotionEnabled) {
      pulse.value = 0.6;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reducedMotionEnabled]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={[styles.card, pulseStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.avatar} />
        <View style={styles.headerLines}>
          <View style={styles.lineWide} />
          <View style={styles.lineNarrow} />
        </View>
      </View>
      <View style={styles.media} />
      <View style={styles.captionLineWide} />
      <View style={styles.captionLineNarrow} />
      <View style={styles.engagementRow}>
        <View style={styles.chip} />
        <View style={styles.chip} />
        <View style={styles.chip} />
      </View>
    </Animated.View>
  );
}

export default function FeedPostSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }, (_, i) => (
        <FeedPostSkeletonCard key={i} />
      ))}
    </View>
  );
}

const BLOCK = 'rgba(55, 65, 81, 0.75)';
const BLOCK_DIM = 'rgba(55, 65, 81, 0.6)';

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  card: {
    ...FEED_CARD_FLOAT_WRAP,
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BLOCK,
  },
  headerLines: {
    flex: 1,
    gap: 6,
  },
  lineWide: {
    height: 12,
    width: '42%',
    borderRadius: 6,
    backgroundColor: BLOCK,
  },
  lineNarrow: {
    height: 12,
    width: '26%',
    borderRadius: 6,
    backgroundColor: BLOCK_DIM,
  },
  media: {
    width: '100%',
    // MUST equal mediaAspectRatio.RATIO_FALLBACK. If these two drift, the feed visibly
    // jumps when the real card replaces the skeleton on first paint.
    aspectRatio: RATIO_FALLBACK,
    borderRadius: 14,
    backgroundColor: BLOCK,
  },
  captionLineWide: {
    height: 12,
    width: '78%',
    borderRadius: 6,
    backgroundColor: BLOCK_DIM,
  },
  captionLineNarrow: {
    height: 12,
    width: '52%',
    borderRadius: 6,
    backgroundColor: BLOCK_DIM,
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 2,
  },
  chip: {
    height: 18,
    width: 54,
    borderRadius: 9,
    backgroundColor: BLOCK_DIM,
  },
});
