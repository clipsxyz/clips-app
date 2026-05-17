import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { greetingLight, greetingSubLight, glassSurface } from '../theme/gazetteerAmbientNative';

export default function LandingScreen({ navigation }: any) {
  return (
    <GazetteerScreenShell edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>Gazetteer</Text>
        <Text style={styles.subtitle}>
          Discover local stories, connect with creators, and share moments instantly.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => navigation.replace('MainTabs')}>
          <Text style={styles.secondaryText}>Continue as guest</Text>
        </TouchableOpacity>
      </View>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    ...greetingLight,
    fontSize: 30,
    textAlign: 'left',
  },
  subtitle: {
    ...greetingSubLight,
    textAlign: 'left',
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    marginTop: 24,
    borderRadius: 999,
    backgroundColor: '#d91b5c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondary: {
    marginTop: 10,
    borderRadius: 999,
    ...glassSurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  secondaryText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
});
