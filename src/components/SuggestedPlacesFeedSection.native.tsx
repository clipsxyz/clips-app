import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar.native';
import { getAvatarForHandle } from '../api/users';
import type { Post } from '../types';
import {
  emitSuggestedPlacesAnalytics,
  reasonExplanation,
  type PlaceMatchedPost,
} from '../utils/suggestedPlaces';
import AsyncStorage from '@react-native-async-storage/async-storage';

function normalizeHandleKey(v: string) {
  return String(v || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();
}

export type SuggestedPlacesFeedSectionProps = {
  bundleKey: string;
  suggestions: PlaceMatchedPost[];
  viewerHandle?: string | null;
  includePosterLocale: boolean;
  onFollowPost?: (post: Post) => void | Promise<void>;
  onOpenProfile: (handle: string) => void;
  onScrollToPost?: (postId: string) => void;
  onAdjust?: () => void;
};

export default function SuggestedPlacesFeedSection({
  bundleKey,
  suggestions,
  viewerHandle = null,
  includePosterLocale,
  onFollowPost,
  onOpenProfile,
  onScrollToPost,
  onAdjust,
}: SuggestedPlacesFeedSectionProps) {
  const [followBusyId, setFollowBusyId] = React.useState<string | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = React.useState<Set<string>>(new Set());
  const [expandedWhyPostId, setExpandedWhyPostId] = React.useState<string | null>(null);
  const [lastHidden, setLastHidden] = React.useState<{ postId: string; matchedPlace: string } | null>(null);

  const persistPlaceFeedback = React.useCallback(async (storageKey: string, place: string) => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const current = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [...new Set([...current, place.trim()])].slice(0, 40);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const removePlaceFeedback = React.useCallback(async (storageKey: string, place: string) => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const current = raw ? (JSON.parse(raw) as string[]) : [];
      const target = place.trim().toLowerCase();
      const next = current.filter((p) => String(p).trim().toLowerCase() !== target);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const visibleSuggestions = React.useMemo(
    () => suggestions.filter(({ post }) => !hiddenPostIds.has(String(post.id))),
    [suggestions, hiddenPostIds],
  );

  React.useEffect(() => {
    emitSuggestedPlacesAnalytics({
      action: 'strip_view',
      bundleKey,
      suggestionCount: suggestions.length,
      includePosterRegionalNational: includePosterLocale,
    });
  }, [bundleKey, suggestions.length, includePosterLocale]);

  if (!visibleSuggestions.length) return null;

  return (
    <View style={styles.section} accessibilityLabel="Suggested posts based on your places">
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Users from places you like</Text>
          <Text style={styles.subtitle}>Based on places you selected.</Text>
        </View>
        {onAdjust ? (
          <TouchableOpacity style={styles.adjustBtn} onPress={onAdjust} accessibilityLabel="Adjust location suggestions">
            <Icon name="options-outline" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.adjustText}>Adjust</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {visibleSuggestions.map(({ post, matchedPlace, reason, confidence }) => {
          const avatar = getAvatarForHandle(post.userHandle);
          const isOwn =
            !!viewerHandle && normalizeHandleKey(post.userHandle) === normalizeHandleKey(viewerHandle);
          const following = !!post.isFollowing;
          const busy = followBusyId === String(post.id);
          const whyOpen = expandedWhyPostId === String(post.id);

          const onFollowClick = async () => {
            if (!onFollowPost || isOwn) return;
            const id = String(post.id);
            setFollowBusyId(id);
            try {
              await onFollowPost(post);
            } finally {
              setFollowBusyId((cur) => (cur === id ? null : cur));
            }
          };

          return (
            <View key={String(post.id)} style={styles.card}>
              <TouchableOpacity onPress={() => onOpenProfile(post.userHandle)} activeOpacity={0.85}>
                <View style={styles.avatarWrap}>
                  <Avatar src={avatar} name={post.userHandle} size={94} />
                </View>
                <Text style={styles.handle} numberOfLines={1}>
                  {post.userHandle}
                </Text>
                <Text style={styles.place} numberOfLines={1}>
                  {matchedPlace}
                </Text>
                <Text style={styles.suggestedLabel}>Suggested for you</Text>
              </TouchableOpacity>

              {!isOwn && onFollowPost ? (
                <TouchableOpacity
                  style={[styles.actionBtn, following && styles.actionBtnOutline]}
                  disabled={busy}
                  onPress={() => void onFollowClick()}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.actionBtnText, following && styles.actionBtnTextOutline]}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    emitSuggestedPlacesAnalytics({
                      action: 'jump_to_post',
                      postId: String(post.id),
                      matchedPlace,
                      reason,
                      bundleKey,
                    });
                    onScrollToPost?.(String(post.id));
                  }}
                >
                  <Text style={styles.actionBtnText}>Open</Text>
                </TouchableOpacity>
              )}

              <View style={styles.metaRow}>
                <TouchableOpacity
                  style={styles.metaBtn}
                  onPress={() => setExpandedWhyPostId((cur) => (cur === String(post.id) ? null : String(post.id)))}
                >
                  <Icon name="information-circle-outline" size={12} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.metaBtnText}>Why this?</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setHiddenPostIds((prev) => new Set([...prev, String(post.id)]));
                    void persistPlaceFeedback('clips:suggestedPlacesDislikedPlaces', matchedPlace);
                    setLastHidden({ postId: String(post.id), matchedPlace });
                    emitSuggestedPlacesAnalytics({
                      action: 'not_interested_post',
                      postId: String(post.id),
                      matchedPlace,
                      reason,
                      bundleKey,
                    });
                  }}
                >
                  <Text style={styles.notInterested}>Not interested</Text>
                </TouchableOpacity>
              </View>
              {whyOpen ? (
                <Text style={styles.whyText}>{reasonExplanation(reason, matchedPlace, confidence)}</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {lastHidden ? (
        <View style={styles.undoRow}>
          <Text style={styles.undoLabel} numberOfLines={1}>
            Hidden suggestions like {lastHidden.matchedPlace}
          </Text>
          <TouchableOpacity
            style={styles.undoBtn}
            onPress={() => {
              setHiddenPostIds((prev) => {
                const next = new Set(prev);
                next.delete(lastHidden.postId);
                return next;
              });
              void removePlaceFeedback('clips:suggestedPlacesDislikedPlaces', lastHidden.matchedPlace);
              setLastHidden(null);
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
    lineHeight: 16,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#363636',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adjustText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
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
  handle: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  place: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 12,
    color: '#8e8e8e',
  },
  suggestedLabel: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 11,
    color: '#8e8e8e',
  },
  actionBtn: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#4f68ff',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnTextOutline: {
    color: '#FFFFFF',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaBtnText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },
  notInterested: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  whyText: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: '#b8b8b8',
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
    flex: 1,
    fontSize: 11,
    color: '#bdbdbd',
    marginRight: 8,
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
