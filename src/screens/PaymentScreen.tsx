import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { activateBoost } from '../api/boost';
import type { BoostDuration, BoostGoal } from '../components/BoostSelectionModal.native';

type PaymentRouteParams = {
  postId?: string;
  boostFeedType?: 'local' | 'regional' | 'national';
  boostAmount?: number;
  boostMeta?: {
    goal?: BoostGoal;
    durationHours?: BoostDuration;
    estimatedReach?: string;
    radiusKm?: number;
    eligibleUsersCount?: number;
    centerLocal?: string;
  };
};

function goalLabel(goal?: BoostGoal): string {
  if (goal === 'profile_visits') return 'Profile visits';
  if (goal === 'messages') return 'Messages';
  return 'More views';
}

export default function PaymentScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const params = (route?.params || {}) as PaymentRouteParams;
  const [isProcessing, setIsProcessing] = React.useState(false);

  const postId = params.postId;
  const feedType = params.boostFeedType || 'local';
  const amount = Number(params.boostAmount || 0);
  const meta = params.boostMeta;

  const handlePay = async () => {
    if (!postId || !user?.id) {
      Alert.alert('Payment error', 'Missing payment details. Please try again from Boost.');
      return;
    }
    setIsProcessing(true);
    try {
      await activateBoost(postId, user.id, feedType, amount, undefined, meta);
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
    <GazetteerScreenShell>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Boost checkout</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.lockRow}>
            <Icon name="lock-closed" size={16} color="#9CA3AF" />
            <Text style={styles.lockText}>Secure checkout</Text>
          </View>

          <Text style={styles.label}>Feed</Text>
          <Text style={styles.value}>
            {feedType.charAt(0).toUpperCase() + feedType.slice(1)} newsfeed
          </Text>

          <Text style={[styles.label, styles.spaced]}>Goal</Text>
          <Text style={styles.value}>{goalLabel(meta?.goal)}</Text>

          {meta?.durationHours ? (
            <>
              <Text style={[styles.label, styles.spaced]}>Duration</Text>
              <Text style={styles.value}>{meta.durationHours} hours</Text>
            </>
          ) : null}

          {meta?.estimatedReach ? (
            <>
              <Text style={[styles.label, styles.spaced]}>Estimated reach</Text>
              <Text style={styles.value}>{meta.estimatedReach}</Text>
            </>
          ) : null}

          {meta?.radiusKm != null ? (
            <>
              <Text style={[styles.label, styles.spaced]}>Radius</Text>
              <Text style={styles.value}>{meta.radiusKm} km</Text>
            </>
          ) : null}

          {meta?.eligibleUsersCount != null ? (
            <>
              <Text style={[styles.label, styles.spaced]}>Eligible audience</Text>
              <Text style={styles.value}>
                {meta.eligibleUsersCount.toLocaleString()} users
              </Text>
            </>
          ) : null}

          <Text style={[styles.label, styles.spaced]}>Total</Text>
          <Text style={styles.amount}>EUR {amount.toFixed(2)}</Text>

          <Text style={[styles.helper, styles.spaced]}>
            Card payments via Stripe are on web. On mobile, confirming activates your boost
            immediately (same mock path as web when Stripe is not configured).
          </Text>

          <TouchableOpacity
            onPress={handlePay}
            disabled={isProcessing}
            style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          >
            <Text style={styles.payButtonText}>
              {isProcessing ? 'Processing...' : `Confirm · EUR ${amount.toFixed(2)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...gazetteerHeader,
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
  scroll: { paddingBottom: 24 },
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    ...glassPanel,
  },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  lockText: { color: '#9CA3AF', fontSize: 12 },
  label: {
    color: '#9CA3AF',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  helper: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 18,
  },
  spaced: {
    marginTop: 14,
  },
  payButton: {
    marginTop: 20,
    backgroundColor: '#d91b5c',
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
