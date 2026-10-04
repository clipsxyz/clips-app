import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar.native';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField.native';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';
import { saveDraft } from '../api/drafts.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import {
  failedToSaveSheet,
  nothingToSaveSheet,
  savedToDraftsSheet,
  type DraftSaveSheetState,
} from '../utils/draftSaveSheetNative';
import { unifiedSearch } from '../api/search';
import { useAuth } from '../context/Auth';
import { navigateMainTab } from '../navigation/mainTabs';
import { publishTextStory24 } from '../utils/publishStoryNative';
import { hapticLight, hapticSuccess } from '../utils/hapticsNative';
import { addPendingFeedUpload } from '../utils/pendingFeedUploadNative';
import { startBackgroundFeedUpload } from '../utils/runBackgroundFeedUploadNative';
import { showUploadOverlayNative } from '../utils/uploadOverlayNative';
import { ox } from '../constants/nativeOpticalScale';

type TagUser = { handle: string; displayName?: string; avatarUrl?: string };

/** Plain Bluesky-style text posts — no canvas templates. */
const PLAIN_TEXT_STYLE = {
  color: '#F1F5F9',
  size: 'medium' as const,
  background: 'transparent',
};
const COMPOSER_BG = '#0B0E14';
const COMPOSER_TEXT = '#F1F5F9';

export default function TextOnlyCreateScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isStory24 = !!route.params?.story24;

  const [text, setText] = useState(String(route.params?.text || route.params?.textBody || ''));
  const [locationText, setLocationText] = useState(String(route.params?.location || ''));
  const [venueText, setVenueText] = useState(String(route.params?.venue || ''));
  const [landmarkText, setLandmarkText] = useState(String(route.params?.landmark || ''));
  const [taggedUsers, setTaggedUsers] = useState<string[]>(
    Array.isArray(route.params?.taggedUsers)
      ? route.params.taggedUsers.map((h: string) => String(h).replace(/^@+/, ''))
      : [],
  );
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [tagSearchUsers, setTagSearchUsers] = useState<TagUser[]>([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftAlert, setDraftAlert] = useState<DraftSaveSheetState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (route.params?.text != null) setText(String(route.params.text));
  }, [route.params?.text]);

  useEffect(() => {
    if (!showLocationSheet) return;
    const q = tagSearchQuery.trim().replace(/^@/, '');
    if (!q) {
      setTagSearchUsers([]);
      setTagSearchLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setTagSearchLoading(true);
      try {
        const result = await unifiedSearch({ q, types: 'users', usersLimit: 20 });
        const items = ((result as any)?.sections?.users?.items || []) as any[];
        const queryLower = q.toLowerCase();
        const mapped = items
          .map((u) => ({
            handle: String(u?.handle || '').trim(),
            displayName: String(u?.display_name || u?.displayName || u?.handle || '').trim() || undefined,
            avatarUrl: u?.avatar_url || u?.avatarUrl,
          }))
          .filter((u) => u.handle)
          .filter((u) => {
            const handleLower = u.handle.toLowerCase();
            const nameLower = (u.displayName || '').toLowerCase();
            return handleLower.includes(queryLower) || nameLower.includes(queryLower);
          })
          .slice(0, 20);
        if (!cancelled) setTagSearchUsers(mapped);
      } catch {
        if (!cancelled) setTagSearchUsers([]);
      } finally {
        if (!cancelled) setTagSearchLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showLocationSheet, tagSearchQuery]);

  const canPost = text.trim().length > 0;

  const finishToFeed = useCallback(() => {
    if (isStory24) {
      navigation.navigate('Stories', { forceRefreshAt: Date.now() });
      return;
    }
    navigateMainTab(navigation, 'Home', { forceRefreshAt: Date.now() });
  }, [isStory24, navigation]);

  const handleSaveToDrafts = async () => {
    if (!text.trim()) {
      setDraftAlert(nothingToSaveSheet('Add some text to save a draft.'));
      return;
    }
    if (isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      await saveDraft({
        videoUrl: '',
        videoDuration: 0,
        isTextOnly: true,
        textBody: text.trim(),
        location: locationText.trim() || undefined,
        venue: venueText.trim() || undefined,
        landmark: landmarkText.trim() || undefined,
        taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
      });
      hapticLight();
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      setDraftAlert(savedToDraftsSheet(finishToFeed));
    } catch (err: any) {
      setDraftAlert(failedToSaveSheet(err?.message));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePost = async () => {
    if (!canPost) return;
    if (!user) {
      Alert.alert('Login required', 'Please log in to create a post.');
      return;
    }
    const textStyle = PLAIN_TEXT_STYLE;
    const locationLabel =
      locationText.trim() || user.regional || user.local || user.national || 'Unknown';

    if (isStory24) {
      setIsSubmitting(true);
      try {
        await publishTextStory24({
          userId: user.id,
          userHandle: user.handle,
          text: text.trim(),
          location: locationText.trim() || undefined,
          venue: venueText.trim() || undefined,
          landmark: landmarkText.trim() || undefined,
          taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
          textStyle,
        });
        hapticSuccess();
        finishToFeed();
      } catch (err: any) {
        Alert.alert('Post failed', err?.message || 'Failed to create story. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    const tempId = `pending-text-${Date.now()}`;
    addPendingFeedUpload({
      tempId,
      userId: user.id,
      userHandle: user.handle,
      text: text.trim(),
      location: locationLabel,
      localMediaUri: null,
      localThumbUri: null,
      mediaType: null,
      videoCoverTime: 0,
      filterForExport: null,
      userLocal: user.local,
      userRegional: user.regional,
      userNational: user.national,
      taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
      venue: venueText.trim() || undefined,
      landmark: landmarkText.trim() || undefined,
      isTextOnly: true,
      textStyle,
    });
    showUploadOverlayNative({
      jobId: tempId,
      initialMessage: 'Posting to Gazetteer…',
      textThumbBackground: COMPOSER_BG,
      textThumbLabel: 'Aa',
    });
    hapticLight();
    finishToFeed();
    startBackgroundFeedUpload(tempId);
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    if (!text.trim()) {
      navigation.goBack();
      return;
    }
    Alert.alert('Leave composer?', 'Save your text as a draft or discard changes.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => navigation.goBack(),
      },
      { text: 'Save draft', onPress: () => void handleSaveToDrafts() },
    ]);
  };

  const addTaggedUser = (handle: string) => {
    const normalized = handle.replace(/^@+/, '').trim();
    if (!normalized || taggedUsers.includes(normalized)) return;
    setTaggedUsers((prev) => [...prev, normalized]);
    setTagSearchQuery('');
    setTagSearchUsers([]);
  };

  const removeTaggedUser = (handle: string) => {
    setTaggedUsers((prev) => prev.filter((h) => h !== handle));
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity onPress={handleCancel} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowLocationSheet(true)}
              accessibilityLabel="Add location, venue, and landmark"
            >
              <Icon name="location-outline" size={ox(24)} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleSaveToDrafts()}
              disabled={!canPost || isSavingDraft}
            >
              <Text style={[styles.draftsText, (!canPost || isSavingDraft) && styles.headerDisabled]}>
                {isSavingDraft ? 'Saving...' : 'Drafts'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.postBtn, canPost && !isSubmitting && styles.postBtnActive]}
              onPress={() => void handlePost()}
              disabled={!canPost || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.postBtnText, !canPost && styles.headerDisabled]}>
                  {isStory24 ? 'Post story' : 'Post'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.composerRow}>
            <View style={styles.avatarCol}>
              <Avatar
                src={user?.avatarUrl}
                name={user?.name || user?.handle || 'User'}
                size={ox(40)}
              />
            </View>
            <View style={styles.composerCol}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="What's up?"
                placeholderTextColor="#6B7280"
                style={styles.textInput}
                multiline
                maxLength={TEXT_POST_BODY_MAX_LENGTH}
                autoFocus
                textAlignVertical="top"
              />
              <View style={styles.counterRow}>
                <Text
                  style={[
                    styles.counterText,
                    text.length > TEXT_POST_BODY_MAX_LENGTH - 50
                      ? text.length >= TEXT_POST_BODY_MAX_LENGTH
                        ? styles.counterDanger
                        : styles.counterWarn
                      : null,
                  ]}
                >
                  {text.length}/{TEXT_POST_BODY_MAX_LENGTH}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showLocationSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLocationSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetDismiss} onPress={() => setShowLocationSheet(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add details</Text>
              <TouchableOpacity onPress={() => setShowLocationSheet(false)} hitSlop={8}>
                <Icon name="close" size={ox(22)} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
              <Text style={styles.fieldLabel}>Location</Text>
              <PlaceAutocompleteField
                mode="location"
                value={locationText}
                onChange={setLocationText}
                placeholder="Add location (city, region, country)"
                showIcon={false}
                bare
              />

              <Text style={styles.fieldLabel}>Venue</Text>
              <PlaceAutocompleteField
                mode="venue"
                value={venueText}
                onChange={setVenueText}
                placeholder="Add venue (e.g. café, stadium)"
                showIcon={false}
                bare
              />

              <Text style={styles.fieldLabel}>Landmark</Text>
              <PlaceAutocompleteField
                mode="landmark"
                value={landmarkText}
                onChange={setLandmarkText}
                placeholder="Add landmark (e.g. Phoenix Park, river)"
                showIcon={false}
                bare
              />

              <Text style={styles.fieldLabel}>Tag people</Text>
              <View style={styles.tagSearchRow}>
                <Icon name="search" size={ox(16)} color="#6B7280" />
                <TextInput
                  value={tagSearchQuery}
                  onChangeText={setTagSearchQuery}
                  placeholder="Search by name or handle (e.g. sarah)"
                  placeholderTextColor="#6B7280"
                  style={styles.tagSearchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {tagSearchQuery.trim() ? (
                <View style={styles.tagResults}>
                  {tagSearchLoading ? (
                    <Text style={styles.tagMeta}>Searching...</Text>
                  ) : tagSearchUsers.length === 0 ? (
                    <Text style={styles.tagMeta}>No users found</Text>
                  ) : (
                    tagSearchUsers.map((u) => {
                      const isTagged = taggedUsers.includes(u.handle);
                      return (
                        <TouchableOpacity
                          key={u.handle}
                          style={[styles.tagUserRow, isTagged && styles.tagUserRowDisabled]}
                          disabled={isTagged}
                          onPress={() => addTaggedUser(u.handle)}
                        >
                          <Avatar
                            src={u.avatarUrl}
                            name={u.displayName || u.handle}
                            size={ox(36)}
                          />
                          <View style={styles.tagUserCopy}>
                            <Text style={styles.tagUserName}>{u.displayName || u.handle}</Text>
                            <Text style={styles.tagUserHandle}>@{u.handle}</Text>
                          </View>
                          {isTagged ? <Text style={styles.taggedLabel}>Tagged</Text> : null}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              ) : null}
              {taggedUsers.length > 0 ? (
                <View style={styles.tagChips}>
                  {taggedUsers.map((handle) => (
                    <TouchableOpacity
                      key={handle}
                      style={styles.tagChip}
                      onPress={() => removeTaggedUser(handle)}
                    >
                      <Text style={styles.tagChipText}>@{handle}</Text>
                      <Icon name="close" size={ox(14)} color="#FFFFFF" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.sheetDoneBtn} onPress={() => setShowLocationSheet(false)}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <GazetteerAlertSheet
        visible={draftAlert != null}
        title={draftAlert?.title ?? ''}
        message={draftAlert?.message}
        icon={draftAlert?.icon ?? 'alert'}
        confirmButtonText={draftAlert?.confirmButtonText ?? 'OK'}
        onConfirm={() => {
          const action = draftAlert?.onConfirm;
          setDraftAlert(null);
          action?.();
        }}
        onDismiss={() => setDraftAlert(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COMPOSER_BG,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ox(16),
    paddingBottom: ox(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: COMPOSER_BG,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ox(10),
    flexShrink: 0,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: ox(16),
    fontWeight: '500',
  },
  headerIconBtn: {
    padding: ox(6),
  },
  draftsText: {
    color: '#FFFFFF',
    fontSize: ox(16),
    fontWeight: '500',
  },
  headerDisabled: {
    opacity: 0.4,
  },
  postBtn: {
    paddingHorizontal: ox(18),
    paddingVertical: ox(8),
    borderRadius: ox(999),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    minWidth: ox(64),
    alignItems: 'center',
  },
  postBtnActive: {
    borderColor: '#FFFFFF',
  },
  postBtnText: {
    color: '#FFFFFF',
    fontSize: ox(14),
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: ox(16),
    paddingTop: ox(16),
    paddingBottom: ox(24),
    flexGrow: 1,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ox(12),
    flex: 1,
  },
  avatarCol: {
    paddingTop: ox(4),
  },
  composerCol: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
  },
  textInput: {
    flexGrow: 1,
    minHeight: ox(180),
    color: COMPOSER_TEXT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
  counterRow: {
    alignItems: 'flex-end',
    marginTop: ox(8),
  },
  counterText: {
    color: '#6B7280',
    fontSize: ox(12),
  },
  counterWarn: { color: '#FBBF24' },
  counterDanger: { color: '#F87171' },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetDismiss: {
    flex: 1,
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: COMPOSER_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ox(16),
    paddingVertical: ox(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: ox(18),
    fontWeight: '600',
  },
  sheetBody: {
    padding: ox(16),
    gap: ox(8),
    paddingBottom: ox(8),
  },
  fieldLabel: {
    color: '#9CA3AF',
    fontSize: ox(11),
    fontWeight: '700',
    letterSpacing: ox(0.6),
    textTransform: 'uppercase',
    marginTop: ox(8),
    marginBottom: ox(4),
  },
  tagSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ox(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: ox(10),
    paddingHorizontal: ox(12),
    paddingVertical: ox(10),
    backgroundColor: COMPOSER_BG,
  },
  tagSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: ox(14),
    padding: 0,
  },
  tagResults: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: ox(10),
    overflow: 'hidden',
    marginTop: ox(4),
    maxHeight: 192,
  },
  tagMeta: {
    color: '#9CA3AF',
    fontSize: ox(14),
    textAlign: 'center',
    padding: ox(16),
  },
  tagUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ox(10),
    paddingHorizontal: ox(12),
    paddingVertical: ox(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tagUserRowDisabled: {
    opacity: 0.5,
  },
  tagUserCopy: { flex: 1, minWidth: 0 },
  tagUserName: { color: '#FFFFFF', fontSize: ox(15), fontWeight: '600' },
  tagUserHandle: { color: '#9CA3AF', fontSize: ox(12), marginTop: ox(2) },
  taggedLabel: { color: '#6B7280', fontSize: ox(12) },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ox(8),
    marginTop: ox(8),
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ox(6),
    paddingHorizontal: ox(10),
    paddingVertical: ox(6),
    borderRadius: ox(999),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tagChipText: { color: '#FFFFFF', fontSize: ox(13) },
  sheetDoneBtn: {
    marginHorizontal: ox(16),
    marginTop: ox(8),
    paddingVertical: ox(14),
    borderRadius: ox(12),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  sheetDoneText: {
    color: '#000000',
    fontSize: ox(14),
    fontWeight: '700',
  },
});
