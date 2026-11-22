import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar.native';
import { getAvatarForHandle } from '../api/users';
import type { Post } from '../types';
import { emitSuggestedPlacesAnalytics } from '../utils/suggestedPlaces';

type Props = {
  posts: Post[];
  userLocal?: string;
  useMockBusinesses?: boolean;
  pinnedPaidPostId?: string;
  viewerHandle?: string | null;
  onFollowPost?: (post: Post) => void | Promise<void>;
  onHideBusiness?: (businessKey: string) => void;
  onUnhideBusiness?: (businessKey: string) => void;
  onLikeBusiness?: (businessKey: string) => void;
  onOpenProfile: (handle: string) => void;
  onScrollToPost?: (postId: string) => void;
  onStripShown?: () => void;
};

type BusinessCardModel = {
  id: string;
  name: string;
  subtitle: string;
  avatarSrc?: string;
  handle?: string;
  postId?: string;
  post?: Post;
  isFollowing?: boolean;
  isOwn?: boolean;
  canViewProfile?: boolean;
};

function normalizeHandle(v: string | null | undefined): string {
  return String(v || '').replace(/^@/, '').trim().toLowerCase();
}

function coverStill(post: Post | undefined): string | undefined {
  if (!post) return undefined;
  const extra = post as Post & {
    thumbnail_url?: string;
    poster_url?: string;
    image_url?: string;
    media_url?: string;
  };
  const candidates = [
    post.thumbnailUrl,
    extra.thumbnail_url,
    post.videoPosterUrl,
    extra.poster_url,
    extra.image_url,
    post.mediaItems?.find((item) => item.type === 'image' && item.url)?.url,
    extra.media_url,
    post.mediaUrl,
  ];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const uri = value.trim();
    if (!uri || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri)) continue;
    return uri;
  }
  return undefined;
}

function mockBusinessAvatar(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d1318&color=8ab4ff&rounded=true&bold=true&size=256&format=png`;
}

export default function LocalBusinessSuggestionCard({
  posts,
  userLocal,
  useMockBusinesses = false,
  pinnedPaidPostId,
  viewerHandle = null,
  onHideBusiness,
  onUnhideBusiness,
  onLikeBusiness: _onLikeBusiness,
  onOpenProfile,
  onScrollToPost,
  onStripShown,
}: Props) {
  const [locallyHiddenBusinesses, setLocallyHiddenBusinesses] = React.useState<Set<string>>(new Set());
  const [lastHiddenBusiness, setLastHiddenBusiness] = React.useState<string | null>(null);
  const seenImpressionsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    onStripShown?.();
  }, [onStripShown]);

  const fallbackLocal = userLocal || 'your area';

  const mockBusinesses: BusinessCardModel[] = React.useMemo(
    () => [
      { id: 'mock-biz-1', name: `${fallbackLocal} Coffee Co`, subtitle: `Suggested in ${fallbackLocal}` },
      { id: 'mock-biz-2', name: `${fallbackLocal} Fitness Hub`, subtitle: `Suggested in ${fallbackLocal}` },
      { id: 'mock-biz-3', name: `${fallbackLocal} Hair Studio`, subtitle: `Suggested in ${fallbackLocal}` },
      { id: 'mock-biz-4', name: `${fallbackLocal} Pizza Kitchen`, subtitle: `Suggested in ${fallbackLocal}` },
    ],
    [fallbackLocal],
  );

  const businessCards: BusinessCardModel[] = React.useMemo(() => {
    if (!posts.length) return [];

    const isBusinessAuthor = (post: Post) => post.userAccountType === 'business';

    if (useMockBusinesses) {
      const viewer = normalizeHandle(viewerHandle);
      const businessSources = posts.filter((post) => {
        const handle = normalizeHandle(post.userHandle);
        if (!handle || handle === viewer) return false;
        return isBusinessAuthor(post);
      });
      return mockBusinesses.map((mock, idx) => {
        const source = businessSources.length > 0 ? businessSources[idx % businessSources.length] : undefined;
        return {
          ...mock,
          avatarSrc: mockBusinessAvatar(mock.name),
          handle: source?.userHandle,
          postId: source ? String(source.id) : undefined,
          post: source,
          isFollowing: false,
          isOwn: false,
          canViewProfile: Boolean(source?.userHandle),
        };
      });
    }
    return posts
      .filter((post) => isBusinessAuthor(post))
      .slice(0, 8)
      .map((post) => {
        const own = normalizeHandle(post.userHandle) === normalizeHandle(viewerHandle);
        return {
          id: String(post.id),
          name: post.venue || post.landmark || post.userHandle,
          subtitle: post.locationLabel || userLocal || 'Local match',
          avatarSrc: getAvatarForHandle(post.userHandle),
          handle: post.userHandle,
          postId: String(post.id),
          post,
          isFollowing: post.isFollowing,
          isOwn: own,
          canViewProfile: Boolean(post.userHandle) && !own,
        };
      });
  }, [useMockBusinesses, mockBusinesses, posts, userLocal, viewerHandle]);

  const visibleBusinessCards = React.useMemo(
    () =>
      businessCards.filter((card) => {
        if (!card.canViewProfile) return false;
        const key = normalizeHandle(card.handle);
        return !key || !locallyHiddenBusinesses.has(key);
      }),
    [businessCards, locallyHiddenBusinesses],
  );

  React.useEffect(() => {
    if (!posts.length) return;
    for (const card of visibleBusinessCards) {
      if (seenImpressionsRef.current.has(card.id)) continue;
      seenImpressionsRef.current.add(card.id);
      const isSponsored = Boolean(pinnedPaidPostId && card.postId && card.postId === pinnedPaidPostId);
      emitSuggestedPlacesAnalytics({
        action: 'business_card_impression',
        businessKey: card.id,
        postId: card.postId,
      });
      if (isSponsored && card.postId) {
        emitSuggestedPlacesAnalytics({
          action: 'business_card_sponsored_impression',
          businessKey: card.id,
          postId: card.postId,
        });
      }
    }
  }, [visibleBusinessCards, pinnedPaidPostId, posts.length]);

  if (!posts.length) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>Local businesses you might like</Text>
        <Text style={styles.emptyText}>No strong local business matches yet. Check back soon.</Text>
      </View>
    );
  }

  const openCard = (card: BusinessCardModel) => {
    if (!card.canViewProfile) return;
    emitSuggestedPlacesAnalytics({
      action: 'business_card_profile_open',
      businessKey: card.id,
      postId: card.postId,
    });
    if (card.handle) {
      onOpenProfile(card.handle);
    } else if (card.postId) {
      onScrollToPost?.(card.postId);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Local businesses you might like</Text>

      {visibleBusinessCards.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>No business profiles available right now.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {visibleBusinessCards.map((card) => {
            const isSponsored = Boolean(pinnedPaidPostId && card.postId && card.postId === pinnedPaidPostId);
            const cover = coverStill(card.post) || card.avatarSrc;
            return (
              <View key={card.id} style={styles.card}>
                <TouchableOpacity
                  onPress={() => openCard(card)}
                  disabled={!card.canViewProfile}
                  style={styles.coverTap}
                  activeOpacity={0.9}
                >
                  {cover ? (
                    <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
                  ) : (
                    <View style={styles.coverFallback}>
                      <Avatar src={card.avatarSrc} name={card.name} size={72} />
                    </View>
                  )}
                  <View style={styles.scrim} />
                  {!card.isOwn && card.handle && onHideBusiness ? (
                    <TouchableOpacity
                      style={styles.dismiss}
                      onPress={() => {
                        const key = normalizeHandle(card.handle);
                        if (!key) return;
                        emitSuggestedPlacesAnalytics({
                          action: 'business_card_hide',
                          businessKey: key,
                          postId: card.postId,
                        });
                        setLocallyHiddenBusinesses((prev) => new Set([...prev, key]));
                        setLastHiddenBusiness(key);
                        onHideBusiness(key);
                      }}
                    >
                      <Icon name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.caption}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {card.name}
                    </Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {isSponsored ? 'Sponsored' : card.subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={card.isOwn || !card.canViewProfile}
                  onPress={() => openCard(card)}
                  style={[styles.viewBanner, (card.isOwn || !card.canViewProfile) && styles.viewBannerDisabled]}
                >
                  <Text style={styles.viewBannerText}>{card.isOwn ? 'You' : 'View profile'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {lastHiddenBusiness ? (
        <View style={styles.undoRow}>
          <Text style={styles.undoLabel}>Business hidden</Text>
          <TouchableOpacity
            style={styles.undoBtn}
            onPress={() => {
              const key = lastHiddenBusiness;
              setLocallyHiddenBusinesses((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
              emitSuggestedPlacesAnalytics({
                action: 'business_card_undo_hide',
                businessKey: key,
              });
              onUnhideBusiness?.(key);
              setLastHiddenBusiness(null);
            }}
          >
            <Text style={styles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  title: {
    marginHorizontal: 16,
    marginBottom: 10,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    color: '#8e8e8e',
  },
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 12,
    color: '#bdbdbd',
  },
  strip: {
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  card: {
    width: 168,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  coverTap: {
    height: 210,
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dismiss: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  caption: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 8,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.86)',
  },
  viewBanner: {
    backgroundColor: '#FFFFFF',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBannerDisabled: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  viewBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: 0.2,
  },
  undoRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#363636',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  undoLabel: {
    fontSize: 11,
    color: '#bdbdbd',
  },
  undoBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4c4c4c',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  undoBtnText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
});
