import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
} from 'react-native';
import FeedPostMedia from './FeedPostMedia.native';
import { timeAgo } from '../utils/timeAgo';
import type { Ad } from '../types';

type Props = {
  ad: Ad;
  onImpression: () => void | Promise<void>;
  onClick: () => void | Promise<void>;
};

export default function FeedAdCard({ ad, onImpression, onClick }: Props) {
  const [hasBeenViewed, setHasBeenViewed] = React.useState(false);

  React.useEffect(() => {
    if (hasBeenViewed) return;
    const timer = setTimeout(() => {
      setHasBeenViewed(true);
      void onImpression();
    }, 400);
    return () => clearTimeout(timer);
  }, [hasBeenViewed, onImpression]);

  const handleClick = async () => {
    await onClick();
    if (ad.linkUrl) {
      void Linking.openURL(ad.linkUrl);
    }
  };

  return (
    <View style={styles.card} accessibilityLabel={`Sponsored ad from ${ad.advertiserHandle}`}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.sponsoredLabel}>SPONSORED</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.advertiser}>{ad.advertiserHandle}</Text>
        </View>
        {ad.createdAt ? <Text style={styles.time}>{timeAgo(ad.createdAt)}</Text> : null}
      </View>

      <View style={styles.mediaWrap}>
        {ad.mediaType === 'video' ? (
          <FeedPostMedia
            post={{ mediaUrl: ad.mediaUrl, mediaType: 'video' } as any}
            isVideoActive={false}
            feedVideoMuted
          />
        ) : (
          <Image source={{ uri: ad.mediaUrl }} style={styles.image} resizeMode="cover" />
        )}
        <TouchableOpacity style={styles.ctaBtn} onPress={() => void handleClick()} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{ad.callToAction || 'Learn More'}</Text>
        </TouchableOpacity>
      </View>

      {ad.description ? (
        <View style={styles.body}>
          <Text style={styles.title}>{ad.title}</Text>
          <Text style={styles.description}>{ad.description}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(55, 65, 81, 0.9)',
    backgroundColor: '#030712',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(55, 65, 81, 0.7)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sponsoredLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  dot: {
    color: '#6B7280',
    fontSize: 11,
  },
  advertiser: {
    fontSize: 11,
    color: '#D1D5DB',
    flexShrink: 1,
  },
  time: {
    fontSize: 11,
    color: '#6B7280',
  },
  mediaWrap: {
    position: 'relative',
    minHeight: 220,
    backgroundColor: '#111827',
  },
  image: {
    width: '100%',
    height: 280,
  },
  ctaBtn: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    left: '20%',
    right: '20%',
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 18,
  },
});
