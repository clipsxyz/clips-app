import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LandingScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Clips</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    marginTop: 24,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#111827',
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
