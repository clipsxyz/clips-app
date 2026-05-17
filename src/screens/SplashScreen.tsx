import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { greetingLight, greetingSubLight } from '../theme/gazetteerAmbientNative';

export default function SplashScreen({ navigation }: any) {
  return (
    <GazetteerScreenShell edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.brand}>Gazetteer</Text>
        <Text style={styles.subtitle}>let's go social traveling</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.replace('MainTabs')}>
          <Text style={styles.ctaText}>Enter App</Text>
        </TouchableOpacity>
      </View>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brand: {
    ...greetingLight,
    fontSize: 36,
  },
  subtitle: {
    ...greetingSubLight,
    marginTop: 10,
  },
  cta: {
    marginTop: 24,
    backgroundColor: '#d91b5c',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
