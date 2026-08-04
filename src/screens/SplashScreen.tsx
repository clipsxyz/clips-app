import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/Auth';
import { getDayPart, getSplashGreetingLine, type DayPart } from '../utils/timeGreeting';

const INTRO_FADE_MS = 700;
const GREETING_HOLD_MS = 2500;
const EXIT_FADE_MS = 500;

/** Keep requires in this screen so Metro always packs the assets into the RN bundle. */
const SPLASH_BACKDROPS: Record<DayPart, number> = {
  morning: require('../assets/splash/morning.png'),
  afternoon: require('../assets/splash/afternoon.png'),
  evening: require('../assets/splash/evening.png'),
};

const FALLBACK_GRADIENT: Record<DayPart, string[]> = {
  morning: ['#1a3a4a', '#3d6b7a', '#c4a574', '#0b0711'],
  afternoon: ['#1e4d6b', '#4a90a4', '#e8b86d', '#0b0711'],
  evening: ['#0b0711', '#1a1040', '#3d2a6b', '#0b0711'],
};

/**
 * IKEA-style cold-start welcome (native).
 * Bundled JPEG backdrop + gradient underlay (Android Image decode can fail silently).
 */
export default function SplashScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const dayPart = useMemo(() => getDayPart(), []);
  const backdropSource = SPLASH_BACKDROPS[dayPart];
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const [imageFailed, setImageFailed] = useState(false);
  const greeting = useMemo(
    () => getSplashGreetingLine(user?.name ?? null),
    [user?.name],
  );

  const greetingOpacity = useRef(new Animated.Value(0)).current;
  const greetingTranslateY = useRef(new Animated.Value(28)).current;
  const greetingScale = useRef(new Animated.Value(0.92)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(12)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const goNext = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (userRef.current) {
        navigation.replace('MainTabs');
      } else {
        navigation.replace('Landing');
      }
    };

    Animated.parallel([
      Animated.timing(greetingOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(greetingTranslateY, {
          toValue: -6,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(greetingTranslateY, {
          toValue: 0,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(greetingScale, {
          toValue: 1.03,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(greetingScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(taglineTranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }, 280),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: EXIT_FADE_MS,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) goNext();
        });
      }, INTRO_FADE_MS + GREETING_HOLD_MS),
    );

    return () => {
      timers.forEach(clearTimeout);
      greetingOpacity.stopAnimation();
      greetingTranslateY.stopAnimation();
      greetingScale.stopAnimation();
      taglineOpacity.stopAnimation();
      taglineTranslateY.stopAnimation();
      screenOpacity.stopAnimation();
    };
  }, [
    greetingOpacity,
    greetingScale,
    greetingTranslateY,
    navigation,
    screenOpacity,
    taglineOpacity,
    taglineTranslateY,
  ]);

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <View style={styles.solidBg} />

      {/* Do not animate opacity on the image layer — Android/Adreno often fails to composite
          Image under an Animated parent opacity fade (shows solid dark only). */}
      <View style={styles.fill} pointerEvents="none">
        <LinearGradient
          colors={FALLBACK_GRADIENT[dayPart]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.fill}
        />
        {!imageFailed ? (
          <Image
            source={backdropSource}
            style={[styles.fill, { width: screenW, height: screenH }]}
            resizeMode="cover"
            fadeDuration={0}
            onError={(e) => {
              console.warn('Splash backdrop failed to decode; using gradient', e?.nativeEvent);
              setImageFailed(true);
            }}
          />
        ) : null}
        <View style={styles.scrim} />
      </View>

      <View style={[styles.greetingWrap, { bottom: Math.round(screenH * 0.18) }]} pointerEvents="none">
        <Animated.Text
          style={[
            styles.greeting,
            {
              opacity: greetingOpacity,
              transform: [
                { translateY: greetingTranslateY },
                { scale: greetingScale },
              ],
            },
          ]}
        >
          {greeting}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
            },
          ]}
        >
          let's go social traveling
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b0711',
  },
  solidBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b0711',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 7, 17, 0.28)',
  },
  greetingWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  greeting: {
    color: '#F5F5F5',
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: -0.4,
    textAlign: 'center',
    lineHeight: 36,
  },
  tagline: {
    marginTop: 10,
    color: 'rgba(245, 245, 245, 0.72)',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
