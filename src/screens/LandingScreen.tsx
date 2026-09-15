import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import { ox } from '../constants/nativeOpticalScale';

const FEATURES = [
  {
    icon: 'globe-outline' as const,
    title: 'Global Location Switching',
    description:
      'Jump to any city, town, or venue instantly. You control the location, not a feed recommendation engine.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Zero Algorithmic Noise',
    description:
      'Pure chronological posts straight from real users, creators, and local automated feeds.',
  },
  {
    icon: 'location-outline' as const,
    title: 'Hyperlocal Media & Events',
    description:
      'Immersive video cards, community news, weather updates, and gig guides mapped straight to the location.',
  },
] as const;

export default function LandingScreen({ navigation }: any) {
  return (
    <GazetteerScreenShell edges={['top', 'bottom']} ambientVariant="passport">
      <View style={styles.screen}>
        <LinearGradient
          colors={['#0a0f1d', '#0d1b2a', '#0a1622']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cardScroll}
          >
            <Text style={styles.tagline}>✨ No Algorithms. Just Places.</Text>
            <Text style={styles.title}>Explore Any Feed in the World</Text>
            <Text style={styles.subtitle}>
              Explore authentic stories, real-time events, and local media from any city, town, or
              venue on Earth—completely unfiltered.
            </Text>

            <View style={styles.features}>
              {FEATURES.map((feature) => (
                <View key={feature.title} style={styles.featureRow}>
                  <View style={styles.featureIconWrap}>
                    <Icon name={feature.icon} size={ox(20)} color={PASSPORT_PALETTE.wavePrimary} />
                  </View>
                  <View style={styles.featureCopy}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureBody}>{feature.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.ctaBlock}>
            <TouchableOpacity
              style={styles.primary}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Login', { mode: 'signup' })}
            >
              <Text style={styles.primaryText}>Sign up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondary}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Login', { mode: 'login' })}
            >
              <Text style={styles.secondaryText}>Log in</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ox(16),
    paddingVertical: ox(12),
  },
  card: {
    flex: 1,
    maxHeight: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    ...glassPanel,
    backgroundColor: 'transparent',
  },
  cardScroll: {
    paddingHorizontal: ox(22),
    paddingTop: ox(28),
    paddingBottom: ox(16),
  },
  tagline: {
    color: PASSPORT_PALETTE.wavePrimary,
    fontSize: ox(13),
    fontWeight: '700',
    marginBottom: ox(14),
    letterSpacing: 0.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: ox(28),
    fontWeight: '800',
    lineHeight: ox(34),
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: ox(12),
    color: 'rgba(226,232,240,0.78)',
    fontSize: ox(14),
    lineHeight: ox(21),
  },
  features: {
    marginTop: ox(28),
    gap: ox(18),
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ox(12),
  },
  featureIconWrap: {
    width: ox(40),
    height: ox(40),
    borderRadius: ox(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,155,143,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(61,155,143,0.28)',
  },
  featureCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: ox(2),
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: ox(15),
    fontWeight: '700',
    marginBottom: ox(4),
  },
  featureBody: {
    color: 'rgba(203,213,225,0.72)',
    fontSize: ox(13),
    lineHeight: ox(18),
  },
  ctaBlock: {
    paddingHorizontal: ox(22),
    paddingTop: ox(12),
    paddingBottom: ox(20),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: ox(10),
  },
  primary: {
    borderRadius: ox(999),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(14),
  },
  primaryText: {
    color: '#0a0f1d',
    fontSize: ox(15),
    fontWeight: '700',
  },
  secondary: {
    borderRadius: ox(999),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(13),
  },
  secondaryText: {
    color: '#E5E7EB',
    fontSize: ox(14),
    fontWeight: '600',
  },
});
