import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplashScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.brand}>Clips</Text>
        <Text style={styles.subtitle}>Share your world in short stories.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.replace('MainTabs')}>
          <Text style={styles.ctaText}>Enter App</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  cta: {
    marginTop: 24,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
