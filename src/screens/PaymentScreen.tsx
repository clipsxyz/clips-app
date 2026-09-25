import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useStripe } from '@stripe/stripe-react-native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { FEED_PAGE_BG } from '../components/FeedPageLayout.native';
import { useAuth } from '../context/Auth';
import { activateBoost } from '../api/boost';
import { createBoostPaymentIntent } from '../api/client';
import type { BoostDuration, BoostGoal } from '../components/BoostSelectionModal.native';
import { ox } from '../constants/nativeOpticalScale';

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const RETURN_URL = 'clipsapp://boost-payment-success';

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

function paymentIntentIdFromClientSecret(secret: string): string | null {
  const id = secret.split('_secret_')[0];
  return id.startsWith('pi_') ? id : null;
}

function alreadyConfirmed(message?: string | null): boolean {
  return /already succeeded|previously confirmed/i.test(message || '');
}

export default function PaymentScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const stripe = useStripe();
  const params = (route?.params || {}) as PaymentRouteParams;
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [isPreparing, setIsPreparing] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ title: string; body: string } | null>(null);

  const postId = params.postId;
  const feedType = params.boostFeedType || 'local';
  const amount = Number(params.boostAmount || 0);
  const meta = params.boostMeta;
  const durationHours = meta?.durationHours ?? 6;

  React.useEffect(() => {
    if (!postId || !user?.id) return;
    if (!publishableKey) {
      setErrorMessage(
        'Stripe is not configured. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env and rebuild the app.',
      );
      return;
    }

    let cancelled = false;
    setIsPreparing(true);
    setErrorMessage(null);

    createBoostPaymentIntent({
      postId,
      feedType,
      userId: user.id,
      radiusKm: meta?.radiusKm ?? 2,
      durationHours,
    })
      .then(({ clientSecret: secret }) => {
        if (!cancelled) setClientSecret(secret);
      })
      .catch((err) => {
        if (!cancelled) setErrorMessage(err?.message ?? 'Could not start payment');
      })
      .finally(() => {
        if (!cancelled) setIsPreparing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId, feedType, user?.id, meta?.radiusKm, durationHours]);

  const showNotice = (title: string, body: string) => setNotice({ title, body });

  const handlePay = async () => {
    if (!postId || !user?.id) {
      showNotice('Payment error', 'Missing payment details. Please try again from Boost.');
      return;
    }
    if (!clientSecret) {
      showNotice('Payment error', errorMessage ?? 'Payment is not ready yet. Please try again.');
      return;
    }
    if (!stripe) {
      showNotice('Payment error', 'Stripe is still loading. Please try again in a moment.');
      return;
    }

    const paymentIntentId = paymentIntentIdFromClientSecret(clientSecret);
    if (!paymentIntentId) {
      showNotice('Payment error', 'This checkout could not be verified. Please try again.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const { error: initError } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Gazetteer',
        returnURL: RETURN_URL,
      });
      if (initError && !alreadyConfirmed(initError.message)) throw new Error(initError.message);

      const { error: presentError } = await stripe.presentPaymentSheet();
      if (presentError && !alreadyConfirmed(presentError.message)) {
        if (presentError.code === 'Canceled') {
          setErrorMessage('Payment cancelled.');
          return;
        }
        throw new Error(presentError.message);
      }

      await activateBoost(postId, user.id, feedType, amount, paymentIntentId, {
        radiusKm: meta?.radiusKm,
        eligibleUsersCount: meta?.eligibleUsersCount,
        durationHours,
        centerLocal: meta?.centerLocal,
      });

      navigation.replace('PaymentSuccess', { postId, feedType, amount, durationHours });
    } catch (error: any) {
      const message = error?.message ?? 'Could not complete the payment. Please try again.';
      setErrorMessage(message);
      showNotice('Payment failed', message);
    } finally {
      setIsProcessing(false);
    }
  };

  const canPay = Boolean(postId && user?.id && clientSecret) && !isPreparing && !isProcessing;

  return (
    <GazetteerScreenShell ambient={false} style={styles.page}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="arrow-back" size={ox(22)} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
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
          <Text style={styles.amount}>€{amount.toFixed(2)}</Text>

          <Text style={styles.helper}>
            Payments are powered by Stripe. Card details are entered in Stripe's secure sheet and
            never touch our servers.
          </Text>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <TouchableOpacity
            onPress={handlePay}
            disabled={!canPay}
            style={[styles.payButton, !canPay && styles.payButtonDisabled]}
          >
            <Text style={styles.payButtonText}>
              {isProcessing
                ? 'Processing...'
                : isPreparing
                  ? 'Preparing...'
                  : canPay
                    ? `Pay €${amount.toFixed(2)}`
                    : 'Payment unavailable'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal visible={notice != null} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
        <Pressable style={styles.noticeBackdrop} onPress={() => setNotice(null)}>
          <Pressable style={styles.noticeCard} onPress={() => {}}>
            <Text style={styles.noticeTitle}>{notice?.title}</Text>
            <Text style={styles.noticeBody}>{notice?.body}</Text>
            <TouchableOpacity style={styles.noticeButton} onPress={() => setNotice(null)}>
              <Text style={styles.noticeButtonText}>OK</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: FEED_PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ox(16),
    paddingVertical: ox(12),
    ...gazetteerHeader,
    backgroundColor: FEED_PAGE_BG,
  },
  iconButton: {
    width: ox(32),
    height: ox(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: ox(22),
    color: '#e3e3e3',
    fontWeight: '300',
    letterSpacing: -0.4,
  },
  scroll: { paddingBottom: ox(24) },
  card: {
    margin: ox(16),
    padding: ox(20),
    borderRadius: ox(24),
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
    color: '#f472b6',
    fontSize: ox(34),
    fontWeight: '300',
    letterSpacing: -0.6,
    marginTop: ox(4),
  },
  helper: {
    color: '#D1D5DB',
    fontSize: ox(13),
    lineHeight: ox(18),
    marginTop: ox(14),
  },
  error: {
    color: '#FCA5A5',
    fontSize: ox(13),
    lineHeight: ox(18),
    marginTop: ox(10),
  },
  spaced: {
    marginTop: ox(14),
  },
  payButton: {
    marginTop: ox(22),
    backgroundColor: '#d91b5c',
    borderRadius: ox(999),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(14),
  },
  payButtonDisabled: {
    opacity: 0.65,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: ox(16),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  noticeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 7, 17, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ox(28),
  },
  noticeCard: {
    width: '100%',
    borderRadius: ox(24),
    padding: ox(22),
    ...glassPanel,
  },
  noticeTitle: {
    color: '#e3e3e3',
    fontSize: ox(22),
    fontWeight: '300',
    letterSpacing: -0.4,
  },
  noticeBody: {
    color: 'rgba(227, 227, 227, 0.78)',
    fontSize: ox(15),
    lineHeight: ox(22),
    fontWeight: '300',
    marginTop: ox(10),
  },
  noticeButton: {
    marginTop: ox(18),
    alignSelf: 'flex-end',
    backgroundColor: '#d91b5c',
    borderRadius: ox(999),
    paddingHorizontal: ox(18),
    paddingVertical: ox(10),
  },
  noticeButtonText: {
    color: '#FFFFFF',
    fontSize: ox(15),
    fontWeight: '600',
  },
});
