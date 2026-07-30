import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { greetingLight, greetingSubLight, glassSurface } from '../theme/gazetteerAmbientNative';
import { ox } from '../constants/nativeOpticalScale';

export default function LandingScreen({ navigation }: any) {
  return (
    <GazetteerScreenShell edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.tagline}>No algorithms, just places</Text>
        <Text style={styles.title}>Gazetteer</Text>
        <Text style={styles.subtitle}>
          Discover local stories, connect with creators, and share moments instantly.
        </Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => navigation.navigate('Login', { mode: 'signup' })}
        >
          <Text style={styles.primaryText}>Sign up</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondary}
          onPress={() => navigation.navigate('Login', { mode: 'login' })}
        >
          <Text style={styles.secondaryText}>Log in</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.guest} onPress={() => navigation.replace('MainTabs')}>
          <Text style={styles.guestText}>Continue as guest</Text>
        </TouchableOpacity>
      </View>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ox(24),
  },
  tagline: {
    color: '#6B7280',
    fontSize: ox(12),
    marginBottom: ox(8),
  },
  title: {
    ...greetingLight,
    fontSize: ox(30),
    textAlign: 'left',
  },
  subtitle: {
    ...greetingSubLight,
    textAlign: 'left',
    marginTop: ox(12),
    color: '#9CA3AF',
    fontSize: ox(14),
    lineHeight: ox(20),
  },
  primary: {
    marginTop: ox(24),
    borderRadius: ox(999),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(13),
  },
  primaryText: {
    color: '#111827',
    fontSize: ox(15),
    fontWeight: '700',
  },
  secondary: {
    marginTop: ox(10),
    borderRadius: ox(999),
    ...glassSurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(13),
  },
  secondaryText: {
    color: '#E5E7EB',
    fontSize: ox(14),
    fontWeight: '600',
  },
  guest: {
    marginTop: ox(18),
    alignItems: 'center',
    paddingVertical: ox(8),
  },
  guestText: {
    color: '#9CA3AF',
    fontSize: ox(13),
    fontWeight: '500',
  },
});
