import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { activateBoost } from '../api/boost';

type PaymentRouteParams = {
  postId?: string;
  boostFeedType?: 'local' | 'regional' | 'national';
  boostAmount?: number;
  boostMeta?: {
    radiusKm?: number;
    eligibleUsersCount?: number;
    durationHours?: 6 | 12 | 24 | 72;
    centerLocal?: string;
  };
};

export default function PaymentScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const params = (route?.params || {}) as PaymentRouteParams;
  const [isProcessing, setIsProcessing] = React.useState(false);

  const postId = params.postId;
  const feedType = params.boostFeedType || 'local';
  const amount = Number(params.boostAmount || 0);

  const handlePay = async () => {
    if (!postId || !user?.id) {
      Alert.alert('Payment error', 'Missing payment details. Please try again from Boost.');
      return;
    }
    setIsProcessing(true);
    try {
      // RN mock flow: activate immediately (same fallback behavior as web non-Stripe path).
      await activateBoost(postId, user.id, feedType, amount, undefined, params.boostMeta);
      navigation.replace('PaymentSuccess', {
        postId,
        feedType,
        amount,
      });
    } catch (error) {
      console.error('RN payment failed:', error);
      Alert.alert('Payment failed', 'Could not complete payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Payment</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Boost feed</Text>
        <Text style={styles.value}>{feedType.charAt(0).toUpperCase() + feedType.slice(1)}</Text>

        <Text style={[styles.label, styles.spaced]}>Amount</Text>
        <Text style={styles.amount}>EUR {amount.toFixed(2)}</Text>

        <Text style={[styles.helper, styles.spaced]}>
          Secure checkout is simplified on mobile for now. Your boost will activate immediately after payment.
        </Text>

        <TouchableOpacity
          onPress={handlePay}
          disabled={isProcessing}
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
        >
          <Text style={styles.payButtonText}>{isProcessing ? 'Processing...' : `Pay EUR ${amount.toFixed(2)}`}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
  },
  label: {
    color: '#9CA3AF',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  helper: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 18,
  },
  spaced: {
    marginTop: 16,
  },
  payButton: {
    marginTop: 20,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  payButtonDisabled: {
    opacity: 0.65,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
