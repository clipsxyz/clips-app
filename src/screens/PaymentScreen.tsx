import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { activateBoost } from '../api/boost';
import type { BoostDuration, BoostGoal } from '../components/BoostSelectionModal.native';
import { ox } from '../constants/nativeOpticalScale';

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
      // Mock / offline path — no Stripe SDK on RN. Same as web when Stripe keys are unset.
      await activateBoost(postId, user.id, feedType, amount, undefined, {
        goal: meta?.goal,
        durationHours: meta?.durationHours,
        estimatedReach: meta?.estimatedReach,
        radiusKm: meta?.radiusKm,
        eligibleUsersCount: meta?.eligibleUsersCount,
        centerLocal: meta?.centerLocal,
      } as any);
      navigation.replace('PaymentSuccess', {
        postId,
        feedType,
        amount,
      });
    } catch (error: any) {
      console.error('RN payment failed:', error);
      Alert.alert(
        'Payment failed',
        error?.message
          ? String(error.message)
          : 'Could not complete the mock boost. Please try again.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <GazetteerScreenShell>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="arrow-back" size={ox(22)} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Boost checkout</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.lockRow}>
            <Icon name="lock-closed" size={ox(16)} color="#9CA3AF" />
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
            Stripe card checkout is web-only. On this APK build, Confirm runs the mock boost
            (no real charge) — same path as web when Stripe is not configured.
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
    paddingHorizontal: ox(16),
    paddingVertical: ox(12),
    ...gazetteerHeader,
  },
  iconButton: {
    width: ox(32),
    height: ox(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: ox(18),
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scroll: { paddingBottom: ox(24) },
  card: {
    margin: ox(16),
    padding: ox(16),
    borderRadius: ox(14),
    ...glassPanel,
  },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: ox(6), marginBottom: ox(12) },
  lockText: { color: '#9CA3AF', fontSize: ox(12) },
  label: {
    color: '#9CA3AF',
    fontSize: ox(12),
    textTransform: 'uppercase',
    letterSpacing: ox(0.6),
  },
  value: {
    color: '#FFFFFF',
    fontSize: ox(17),
    fontWeight: '700',
    marginTop: ox(4),
  },
  amount: {
    color: '#FFFFFF',
    fontSize: ox(28),
    fontWeight: '800',
    marginTop: ox(4),
  },
  helper: {
    color: '#D1D5DB',
    fontSize: ox(13),
    lineHeight: ox(18),
  },
  spaced: {
    marginTop: ox(14),
  },
  payButton: {
    marginTop: ox(20),
    backgroundColor: '#d91b5c',
    borderRadius: ox(10),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(13),
  },
  payButtonDisabled: {
    opacity: 0.65,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: ox(16),
    fontWeight: '700',
  },
});
