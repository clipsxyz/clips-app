import React from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

interface ZoomableMediaProps {
  children: React.ReactNode;
  minZoom?: number;
  maxZoom?: number;
  doubleTapZoom?: number;
  onZoomStart?: () => void;
  onZoomEnd?: () => void;
}

/**
 * Instagram-style zoom component for images and videos (React Native version)
 * Features:
 * - Pinch to zoom
 * - Drag/pan when zoomed
 * - Double-tap to zoom in/out
 * - Smooth animation
 */
export default function ZoomableMedia({
  children,
  minZoom = 1,
  maxZoom = 4,
  doubleTapZoom = 2,
  onZoomStart,
  onZoomEnd,
}: ZoomableMediaProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      if (onZoomStart) {
        runOnJS(onZoomStart)();
      }
    })
    .onUpdate((e) => {
      scale.value = Math.max(minZoom, Math.min(maxZoom, e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        if (onZoomEnd) {
          runOnJS(onZoomEnd)();
        }
      } else if (onZoomEnd) {
        runOnJS(onZoomEnd)();
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      // Snap back if zoomed out
      if (scale.value < 1.1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        if (onZoomEnd) {
          runOnJS(onZoomEnd)();
        }
      } else {
        scale.value = withTiming(doubleTapZoom);
        if (onZoomStart) {
          runOnJS(onZoomStart)();
        }
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
});



