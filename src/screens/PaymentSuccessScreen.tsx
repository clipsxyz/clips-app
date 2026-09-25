import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import { FEED_PAGE_BG } from '../components/FeedPageLayout.native';
import { ox } from '../constants/nativeOpticalScale';

function feedLabel(feedType: string): string {
  if (feedType === 'regional') return 'Regional';
  if (feedType === 'national') return 'National';
  return 'Local';
}

export default function PaymentSuccessScreen({ navigation, route }: any) {
  const amount = Number(route?.params?.amount || 0);
  const feedType = String(route?.params?.feedType || 'local');
  const durationHours = Number(route?.params?.durationHours || 6);

  return (
    <GazetteerScreenShell ambient={false} style={styles.page} contentStyle={styles.content}>
      <View style={styles.inner}>
        <View style={styles.successIconWrap}>
          <Icon name="checkmark-circle" size={ox(72)} color="#f472b6" />
        </View>
        <Text style={styles.title}>Payment accepted</Text>
        <Text style={styles.subtitle}>
          Your post is boosted for {durationHours} hours in the {feedLabel(feedType)} newsfeed.
        </Text>
        <Text style={styles.amount}>€{amount.toFixed(2)}</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('MainTabs', {
              screen: 'Home',
              params: {
                boostSuccess: true,
                postId: route?.params?.postId,
                feedType: route?.params?.feedType,
              },
            })
          }
        >
          <Text style={styles.primaryButtonText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate('MainTabs', {
              screen: 'Boost',
              params: {
                boostSuccess: true,
                postId: route?.params?.postId,
                feedType: route?.params?.feedType,
              },
            })
          }
        >
          <Text style={styles.secondaryButtonText}>Back to Boost</Text>
        </TouchableOpacity>
      </View>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: FEED_PAGE_BG,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ox(24),
  },
  inner: {
    alignItems: 'center',
    borderRadius: ox(24),
    padding: ox(28),
    ...glassPanel,
  },
  successIconWrap: {
    marginBottom: ox(20),
  },
  title: {
    fontSize: ox(28),
    fontWeight: '300',
    letterSpacing: -0.5,
    color: '#e3e3e3',
  },
  subtitle: {
    marginTop: ox(10),
    textAlign: 'center',
    color: 'rgba(227, 227, 227, 0.78)',
    fontSize: ox(15),
    lineHeight: ox(22),
    fontWeight: '300',
  },
  amount: {
    marginTop: ox(14),
    color: '#f472b6',
    fontSize: ox(22),
    fontWeight: '300',
    letterSpacing: -0.4,
  },
  primaryButton: {
    marginTop: ox(24),
    width: '100%',
    backgroundColor: '#d91b5c',
    borderRadius: ox(999),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ox(14),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: ox(16),
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: ox(10),
    width: '100%',
    borderRadius: ox(999),
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
