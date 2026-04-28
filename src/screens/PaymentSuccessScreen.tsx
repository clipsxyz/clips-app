import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

export default function PaymentSuccessScreen({ navigation, route }: any) {
  const amount = Number(route?.params?.amount || 0);
  const feedType = route?.params?.feedType || 'local';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.successIconWrap}>
          <Icon name="checkmark-circle" size={76} color="#22C55E" />
        </View>
        <Text style={styles.title}>Payment Complete</Text>
        <Text style={styles.subtitle}>
          Your post has been boosted in the {String(feedType)} feed.
        </Text>
        <Text style={styles.amount}>EUR {amount.toFixed(2)}</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Text style={styles.primaryButtonText}>Back to Feed</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Boost')}>
          <Text style={styles.secondaryButtonText}>Back to Boost</Text>
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
  successIconWrap: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 10,
    textAlign: 'center',
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  amount: {
    marginTop: 12,
    color: '#E5E7EB',
    fontSize: 18,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 24,
    width: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: '#111827',
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
});
