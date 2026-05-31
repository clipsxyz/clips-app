import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
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
  onLikeBusiness,
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
        <Text style={styles.title}>Local business you might like</Text>
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
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Local business you might like</Text>
          <Text style={styles.subtitle}>Connect with businesses near {userLocal || 'you'}.</Text>
        </View>
        <Text style={styles.badge}>Suggested</Text>
      </View>

      {visibleBusinessCards.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>No business profiles available right now.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {visibleBusinessCards.map((card) => {
            const isSponsored = Boolean(pinnedPaidPostId && card.postId && card.postId === pinnedPaidPostId);
            return (
              <View key={card.id} style={styles.card}>
                <TouchableOpacity onPress={() => openCard(card)} disabled={!card.canViewProfile}>
                  <View style={styles.avatarWrap}>
                    <Avatar src={card.avatarSrc} name={card.name} size={94} />
                  </View>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {card.subtitle}
                  </Text>
                  {isSponsored ? (
                    <View style={styles.sponsoredBadge}>
                      <Text style={styles.sponsoredText}>SPONSORED</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={card.isOwn || !card.canViewProfile}
                  onPress={() => openCard(card)}
                  style={[styles.viewBtnWrap, card.isOwn && styles.viewBtnOwn]}
                >
                  {card.isOwn ? (
                    <Text style={styles.viewBtnOwnText}>You</Text>
                  ) : (
                    <LinearGradient
                      colors={['#f6e27a', '#d4af37', '#f4f4f4', '#bfc5cc', '#ffe8a3']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.viewBtnGradient}
                    >
                      <Text style={styles.viewBtnText}>View</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>

                <View style={styles.locationRow}>
                  <Icon name="location-outline" size={12} color="#8e8e8e" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {userLocal || 'Local match'}
                  </Text>
                </View>

                {!card.isOwn && card.handle && onHideBusiness ? (
                  <View style={styles.metaRow}>
                    {onLikeBusiness ? (
                      <TouchableOpacity
                        onPress={() => {
                          const key = normalizeHandle(card.handle);
                          if (!key) return;
                          emitSuggestedPlacesAnalytics({
                            action: 'business_card_more_like_this',
                            businessKey: key,
                            postId: card.postId,
                          });
                          onLikeBusiness(key);
                        }}
                      >
                        <Text style={styles.moreLike}>More like this</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
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
                      <Text style={styles.notInterested}>Not interested</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
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
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#363636',
    backgroundColor: '#121212',
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 11,
    color: '#8e8e8e',
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8ab4ff',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    color: '#8e8e8e',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    backgroundColor: '#0d1318',
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
    paddingBottom: 4,
  },
  card: {
    width: 165,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    backgroundColor: '#0d1318',
    padding: 10,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  cardName: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardSubtitle: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 12,
    color: '#8e8e8e',
  },
  sponsoredBadge: {
    alignSelf: 'center',
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sponsoredText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.85)',
  },
  viewBtnWrap: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewBtnOwn: {
    borderWidth: 1,
    borderColor: '#3a3a3a',
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewBtnOwnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewBtnGradient: {
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
  },
  viewBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  locationRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 10,
    color: '#8e8e8e',
  },
  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreLike: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8ab4ff',
  },
  notInterested: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
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
