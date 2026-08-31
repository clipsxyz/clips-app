import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DiscoverAmbientCanvas from '../components/DiscoverAmbientCanvas.native';
import { useAuth } from '../context/Auth';
import { PASSPORT_ABYSS } from '../utils/discoverAmbientPalette';
import { getSplashGreetingLine } from '../utils/timeGreeting';

const INTRO_FADE_MS = 700;
const GREETING_HOLD_MS = 2800;
const EXIT_FADE_MS = 500;

/**
 * Cold-start welcome (native): passport ambient + centered brand + time greeting.
 */
export default function SplashScreen({ navigation }: { navigation: any }) {
  const { user, sessionReady } = useAuth();
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const greeting = useMemo(
    () => getSplashGreetingLine(user?.name ?? null),
    [user?.name],
  );

  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandScale = useRef(new Animated.Value(0.82)).current;
  const brandTranslateY = useRef(new Animated.Value(18)).current;
  const brandPulse = useRef(new Animated.Value(0)).current;
  const greetingOpacity = useRef(new Animated.Value(0)).current;
  const greetingTranslateY = useRef(new Animated.Value(28)).current;
  const greetingScale = useRef(new Animated.Value(0.92)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(12)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (!introDone || !sessionReady || finishedRef.current) return;
    finishedRef.current = true;
    if (user) {
      navigation.replace('MainTabs');
    } else {
      navigation.replace('Landing');
    }
  }, [introDone, sessionReady, user, navigation]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let pulseLoop: Animated.CompositeAnimation | null = null;

    const goNext = () => {
      setIntroDone(true);
    };

    // Brand: rise + scale settle into center
    Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(brandScale, {
          toValue: 1.06,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(brandScale, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(brandTranslateY, {
        toValue: 0,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || finishedRef.current) return;
      // Soft breath while greeting holds
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(brandPulse, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(brandPulse, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
    });

    // Greeting slightly after brand lands
    timers.push(
      setTimeout(() => {
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
      }, 220),
    );

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
      }, 480),
    );

    timers.push(
      setTimeout(() => {
        pulseLoop?.stop();
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
      pulseLoop?.stop();
      brandOpacity.stopAnimation();
      brandScale.stopAnimation();
      brandTranslateY.stopAnimation();
      brandPulse.stopAnimation();
      greetingOpacity.stopAnimation();
      greetingTranslateY.stopAnimation();
      greetingScale.stopAnimation();
      taglineOpacity.stopAnimation();
      taglineTranslateY.stopAnimation();
      screenOpacity.stopAnimation();
    };
  }, [
    brandOpacity,
    brandPulse,
    brandScale,
    brandTranslateY,
    greetingOpacity,
    greetingScale,
    greetingTranslateY,
    navigation,
    screenOpacity,
    taglineOpacity,
    taglineTranslateY,
  ]);

  const brandBreathScale = brandPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });
  const brandBreathOpacity = brandPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.82],
  });

  // True visual center — avoid flex/absoluteFill quirks on some Android OEMs
  const brandTop = Math.round(screenH * 0.5 - 28);

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      {/* Passport ambient (same View-blob canvas as View Profile iOS / Discover). */}
      <View style={styles.ambientSlot} pointerEvents="none" collapsable={false}>
        <DiscoverAmbientCanvas
          variant="passport"
          fillParent={false}
          width={screenW}
          height={screenH}
        />
      </View>

      <View style={[styles.brandWrap, { top: brandTop }]} pointerEvents="none">
        <Animated.Text
          style={[
            styles.brand,
            {
              opacity: Animated.multiply(brandOpacity, brandBreathOpacity),
              transform: [
                { translateY: brandTranslateY },
                { scale: Animated.multiply(brandScale, brandBreathScale) },
              ],
            },
          ]}
        >
          Gazetteer
        </Animated.Text>
      </View>

      <View style={[styles.greetingWrap, { bottom: Math.round(screenH * 0.16) }]} pointerEvents="none">
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
    width: '100%',
    height: '100%',
    backgroundColor: PASSPORT_ABYSS,
  },
  ambientSlot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
  },
  brandWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -0.9,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(6, 13, 22, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  greetingWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 2,
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
