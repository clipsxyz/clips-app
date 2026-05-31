import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

function FeedPostSkeletonCard() {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.lineWide} />
      <View style={styles.lineNarrow} />
      <View style={styles.media} />
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

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  card: {
    gap: 8,
  },
  lineWide: {
    height: 14,
    width: '45%',
    borderRadius: 6,
    backgroundColor: 'rgba(55, 65, 81, 0.85)',
  },
  lineNarrow: {
    height: 14,
    width: '28%',
    borderRadius: 6,
    backgroundColor: 'rgba(55, 65, 81, 0.65)',
  },
  media: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(55, 65, 81, 0.75)',
    marginTop: 4,
  },
});
