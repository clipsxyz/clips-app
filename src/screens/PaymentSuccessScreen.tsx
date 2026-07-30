import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import { ox } from '../constants/nativeOpticalScale';

export default function PaymentSuccessScreen({ navigation, route }: any) {
  const amount = Number(route?.params?.amount || 0);
  const feedType = route?.params?.feedType || 'local';

  return (
    <GazetteerScreenShell contentStyle={styles.content}>
      <View style={styles.inner}>
        <View style={styles.successIconWrap}>
          <Icon name="checkmark-circle" size={ox(76)} color="#22C55E" />
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
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ox(24),
  },
  inner: {
    alignItems: 'center',
    borderRadius: ox(16),
    padding: ox(24),
    ...glassPanel,
  },
  successIconWrap: {
    marginBottom: ox(20),
  },
  title: {
    fontSize: ox(24),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: ox(10),
    textAlign: 'center',
    color: '#D1D5DB',
    fontSize: ox(14),
    lineHeight: ox(20),
  },
  amount: {
    marginTop: ox(12),
    color: '#E5E7EB',
    fontSize: ox(18),
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: ox(24),
    width: '100%',
    backgroundColor: '#d91b5c',
    borderRadius: ox(10),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(13),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: ox(16),
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: ox(10),
    width: '100%',
    borderRadius: ox(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(13),
    backgroundColor: 'rgba(24, 24, 28, 0.65)',
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: ox(15),
    fontWeight: '600',
  },
});
