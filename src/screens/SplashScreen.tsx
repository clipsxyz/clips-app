import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/Auth';
import {
  getDayPart,
  getSplashGreetingLine,
  SPLASH_BACKDROP_BY_DAY_PART,
} from '../utils/timeGreeting';

const INTRO_FADE_MS = 700;
const GREETING_HOLD_MS = 2500;
const EXIT_FADE_MS = 500;

/**
 * IKEA-style cold-start welcome (native).
 * Lifestyle backdrop + time greeting with a soft bounce-in.
 */
export default function SplashScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const dayPart = useMemo(() => getDayPart(), []);
  const backdropUri = SPLASH_BACKDROP_BY_DAY_PART[dayPart];
  const greeting = useMemo(
    () => getSplashGreetingLine(user?.name ?? null),
    [user?.name],
  );

  const backdropOpacity = useRef(new Animated.Value(0)).current;
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

    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: INTRO_FADE_MS,
      useNativeDriver: true,
    }).start();

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
      backdropOpacity.stopAnimation();
      greetingOpacity.stopAnimation();
      greetingTranslateY.stopAnimation();
      greetingScale.stopAnimation();
      taglineOpacity.stopAnimation();
      taglineTranslateY.stopAnimation();
      screenOpacity.stopAnimation();
    };
  }, [
    backdropOpacity,
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

      <Animated.View
        style={[styles.absoluteFill, { opacity: backdropOpacity }]}
        pointerEvents="none"
      >
        <ImageBackground
          source={{ uri: backdropUri }}
          style={styles.absoluteFill}
          resizeMode="cover"
        >
          <View style={styles.scrim} />
        </ImageBackground>
      </Animated.View>

      <View style={styles.greetingWrap} pointerEvents="none">
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0711',
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 7, 17, 0.45)',
  },
  greetingWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: '18%',
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
