import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { type VideoRef } from 'react-native-video';
import Avatar from './Avatar.native';
import { resolveAvatarForUser } from '../api/users';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import type { Post } from '../types';
import { emitSuggestedPlacesAnalytics } from '../utils/suggestedPlaces';
import { activityContextLabel, featuredPreviewFromPost } from '../utils/suggestedFollowerFeed';
import {
  isMockDemoVideoPath,
  mockFeedVideoSource,
} from '../constants/mockFeedVideos.native';
import { androidListSafeVideoProps } from '../utils/androidSafeVideoNative';
import { getFeedScrollBusy, subscribeFeedScrollBusy } from '../utils/feedScrollBusyNative';

type Props = {
  posts: Post[];
  userLocal?: string;
  useMockBusinesses?: boolean;
  pinnedPaidPostId?: string;
  viewerHandle?: string | null;
  viewerRegional?: string | null;
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

function looksLikeVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || isMockDemoVideoPath(url);
}

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function MutedPreviewVideo({ url }: { url: string }) {
  const videoRef = React.useRef<VideoRef>(null);
  const [feedScrolling, setFeedScrolling] = React.useState(getFeedScrollBusy());
  React.useEffect(() => subscribeFeedScrollBusy(setFeedScrolling), []);

  return (
    <Video
      ref={videoRef}
      source={mockFeedVideoSource(url)}
      style={styles.coverFill}
      resizeMode="cover"
      paused={feedScrolling}
      muted
      repeat
      controls={false}
      playInBackground={false}
      playWhenInactive={false}
      ignoreSilentSwitch="obey"
      {...androidListSafeVideoProps()}
      pointerEvents="none"
      onProgress={({ currentTime }) => {
        if (currentTime > 1) videoRef.current?.seek(0);
      }}
    />
  );
}

function FeaturedCover({
  post,
  avatarSrc,
  name,
}: {
  post?: Post;
  avatarSrc?: string;
  name: string;
}) {
  const [stillFailed, setStillFailed] = React.useState(false);
  const preview = post ? featuredPreviewFromPost(post) : null;
  const videoUrl = preview?.mediaUrl || preview?.thumbnailUrl || '';
  const stillIsImage =
    Boolean(preview?.thumbnailUrl) &&
    !looksLikeVideoUrl(preview!.thumbnailUrl) &&
    !preview!.thumbnailUrl.startsWith('/demo-videos/') &&
    !preview!.thumbnailUrl.startsWith('#');
  const needsVideo =
    Boolean(preview?.isVideo) &&
    Boolean(videoUrl) &&
    (isMockDemoVideoPath(videoUrl) || looksLikeVideoUrl(videoUrl));
  const stillUri = stillIsImage ? resolvePublicMediaUrl(preview!.thumbnailUrl) || preview!.thumbnailUrl : '';

  const badge =
    preview && (needsVideo || (stillIsImage && !stillFailed && stillUri)) ? (
      <View style={styles.viewsBadge}>
        <Icon name="play" size={10} color="#fff" />
        <Text style={styles.viewsBadgeText}>{formatViews(preview.views)}</Text>
      </View>
    ) : null;

  if (needsVideo) {
    const playable = isMockDemoVideoPath(videoUrl) ? videoUrl : resolvePublicMediaUrl(videoUrl) || videoUrl;
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MutedPreviewVideo url={playable} />
        {badge}
      </View>
    );
  }
  if (stillIsImage && !stillFailed && stillUri) {
    return (
      <>
        <Image
          source={{ uri: stillUri }}
          style={styles.cover}
          resizeMode="cover"
          onError={() => setStillFailed(true)}
        />
        {badge}
      </>
    );
  }
  return (
    <View style={styles.coverFallback}>
      <Avatar src={avatarSrc} name={name} size={72} />
    </View>
  );
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
  viewerRegional = null,
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
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(280, screenWidth - 32);

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
    const bestByHandle = new Map<string, Post>();
    for (const post of posts.filter(isBusinessAuthor)) {
      const key = normalizeHandle(post.userHandle);
      if (!key) continue;
      const current = bestByHandle.get(key);
      if (!current) {
        bestByHandle.set(key, post);
        continue;
      }
      const nextHasMedia = Boolean(featuredPreviewFromPost(post));
      const currentHasMedia = Boolean(featuredPreviewFromPost(current));
      const nextViews = post.stats?.views ?? 0;
      const currentViews = current.stats?.views ?? 0;
      if ((nextHasMedia && !currentHasMedia) || (nextHasMedia === currentHasMedia && nextViews > currentViews)) {
        bestByHandle.set(key, post);
      }
    }
    return [...bestByHandle.values()]
      .slice(0, 8)
      .map((post) => {
        const own = normalizeHandle(post.userHandle) === normalizeHandle(viewerHandle);
        return {
          id: String(post.id),
          name: post.venue || post.landmark || post.userHandle,
          subtitle: activityContextLabel({ local: userLocal, regional: viewerRegional || undefined }, post),
          avatarSrc: resolveAvatarForUser(post.userHandle, post),
          handle: post.userHandle,
          postId: String(post.id),
          post,
          isFollowing: post.isFollowing,
          isOwn: own,
          canViewProfile: Boolean(post.userHandle) && !own,
        };
      });
  }, [useMockBusinesses, mockBusinesses, posts, userLocal, viewerHandle, viewerRegional]);

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
            return (
              <View key={card.id} style={[styles.card, { width: cardWidth }]}>
                <View style={styles.coverTap}>
                  <TouchableOpacity
                    onPress={() => openCard(card)}
                    disabled={!card.canViewProfile}
                    style={StyleSheet.absoluteFill}
                    activeOpacity={0.9}
                  >
                    <FeaturedCover post={card.post} avatarSrc={card.avatarSrc} name={card.name} />
                  </TouchableOpacity>
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
                  <TouchableOpacity
                    disabled={card.isOwn || !card.canViewProfile}
                    onPress={() => openCard(card)}
                    style={[styles.viewPill, (card.isOwn || !card.canViewProfile) && styles.viewPillDisabled]}
                    accessibilityLabel={card.isOwn ? 'You' : 'View profile'}
                  >
                    <Text style={styles.viewPillText}>{card.isOwn ? 'You' : 'View profile'}</Text>
                    {card.isOwn ? null : <Icon name="chevron-forward" size={18} color="#111111" />}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => openCard(card)}
                  disabled={!card.canViewProfile}
                  style={styles.identity}
                  activeOpacity={0.85}
                >
                  <Avatar src={card.avatarSrc} name={card.name} size={40} hideBorder />
                  <View style={styles.identityText}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {card.name}
                    </Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {isSponsored ? 'Sponsored' : card.subtitle}
                    </Text>
                  </View>
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
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  coverTap: {
    height: 320,
    backgroundColor: '#1a1a1a',
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
  },
  coverFill: {
    width: '100%',
    height: '100%',
  },
  viewsBadge: {
    position: 'absolute',
    left: 10,
    bottom: 58,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  coverFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  identityText: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  viewPill: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 2,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewPillDisabled: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  viewPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
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
