import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel, glassSearch, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { createPost } from '../api/posts';
import { publishTextStory24 } from '../utils/publishStoryNative';
import { saveDraft } from '../api/drafts';
import { unifiedSearch } from '../api/search';
import { useAuth } from '../context/Auth';
import { navigateMainTab } from '../navigation/mainTabs';
import {
    buildTextStyleFromTemplate,
    getNativeTextStoryTemplate,
    NATIVE_TEXT_STORY_TEMPLATES,
} from '../utils/textStoryTemplatesNative';
import { hapticLight, hapticSuccess } from '../utils/hapticsNative';

type TagUser = { handle: string; displayName?: string };

export default function TextOnlyPostDetailsScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const isStory24 = !!route.params?.story24;
  const text = String(route.params?.text || '').trim();

  const [locationText, setLocationText] = useState('');
  const [venueText, setVenueText] = useState('');
  const [landmarkText, setLandmarkText] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
  const [showUserTagging, setShowUserTagging] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [tagSearchUsers, setTagSearchUsers] = useState<TagUser[]>([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    route.params?.textTemplateId || route.params?.templateId || 'broadcast-blue',
  );

  const activeTemplate = useMemo(
    () => getNativeTextStoryTemplate(selectedTemplateId) || NATIVE_TEXT_STORY_TEMPLATES[0],
    [selectedTemplateId],
  );

  const previewTextStyle = useMemo(() => {
    if (!activeTemplate) {
      return { color: '#ffffff', fontSize: 16 };
    }
    const size =
      activeTemplate.textSize === 'small' ? 14 : activeTemplate.textSize === 'large' ? 20 : 16;
    return { color: activeTemplate.textColor, fontSize: size };
  }, [activeTemplate]);

  useEffect(() => {
    if (!text) {
      navigation.replace('TextOnlyCreate', route.params?.story24 ? { story24: true } : undefined);
    }
  }, [navigation, route.params?.story24, text]);

  useEffect(() => {
    if (!route.params?.fromDraft) return;
    if (route.params.location) setLocationText(String(route.params.location));
    if (route.params.venue) setVenueText(String(route.params.venue));
    if (route.params.landmark) setLandmarkText(String(route.params.landmark));
    if (Array.isArray(route.params.taggedUsers) && route.params.taggedUsers.length > 0) {
      setTaggedUsers(route.params.taggedUsers.map((h: string) => String(h).replace(/^@+/, '')));
    }
    if (route.params?.textTemplateId || route.params?.templateId) {
      setSelectedTemplateId(String(route.params.textTemplateId || route.params.templateId));
    }
  }, [
    route.params?.fromDraft,
    route.params?.location,
    route.params?.venue,
    route.params?.landmark,
    route.params?.taggedUsers,
    route.params?.templateId,
    route.params?.textTemplateId,
  ]);

  useEffect(() => {
    const q = tagSearchQuery.trim().replace(/^@/, '');
    if (!showUserTagging || q.length < 1) {
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
          }))
          .filter((u) => u.handle && !taggedUsers.includes(u.handle))
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
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showUserTagging, tagSearchQuery, taggedUsers]);

  const canPost = text.length > 0;

  const finishToFeed = () => {
    if (isStory24) {
      navigation.navigate('Stories', { forceRefreshAt: Date.now() });
      return;
    }
    navigateMainTab(navigation, 'Home', { forceRefreshAt: Date.now() });
  };

  const handleSubmit = async () => {
    if (!canPost) {
      Alert.alert('Text required', 'Please add some text to your post.');
      return;
    }
    if (!user) {
      Alert.alert('Login required', 'Please log in to create a post.');
      return;
    }
    setIsSubmitting(true);
    try {
      const textStyle = activeTemplate ? buildTextStyleFromTemplate(activeTemplate) : undefined;
      if (isStory24) {
        await publishTextStory24({
          userId: user.id,
          userHandle: user.handle,
          text,
          location: locationText.trim() || undefined,
          venue: venueText.trim() || undefined,
          landmark: landmarkText.trim() || undefined,
          taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
          textStyle,
        });
      } else {
        await createPost(
          user.id,
          user.handle,
          text,
          locationText.trim(),
          undefined,
          undefined,
          undefined,
          undefined,
          user.local,
          user.regional,
          user.national,
          undefined,
          selectedTemplateId || undefined,
          undefined,
          undefined,
          textStyle,
          taggedUsers.length > 0 ? taggedUsers : undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          venueText.trim() || undefined,
          landmarkText.trim() || undefined,
        );
      }
      hapticSuccess();
      Alert.alert('Posted', isStory24 ? 'Your story is live.' : 'Post created successfully!', [
        { text: 'OK', onPress: finishToFeed },
      ]);
    } catch (err: any) {
      Alert.alert('Post failed', err?.message || 'Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveToDrafts = async () => {
    if (!canPost) {
      Alert.alert('Text required', 'Add some text to save a draft.');
      return;
    }
    if (isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      await saveDraft({
        videoUrl: '',
        videoDuration: 0,
        isTextOnly: true,
        textBody: text,
        location: locationText.trim() || undefined,
        venue: venueText.trim() || undefined,
        landmark: landmarkText.trim() || undefined,
        taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
        textTemplateId: selectedTemplateId || undefined,
      });
      hapticLight();
      Alert.alert('Saved to drafts', 'You can find it in your profile. Tap a draft to continue and post.', [
        { text: 'Done', onPress: finishToFeed },
      ]);
    } catch (err: any) {
      Alert.alert('Draft failed', err?.message || 'Could not save draft. Please try again.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const addTaggedUser = (handle: string) => {
    const normalized = handle.replace(/^@+/, '').trim();
    if (!normalized || taggedUsers.includes(normalized)) return;
    setTaggedUsers((prev) => [...prev, normalized]);
    setTagSearchQuery('');
    setTagSearchUsers([]);
  };

  const taggedPreview = useMemo(
    () => taggedUsers.slice(0, 2),
    [taggedUsers],
  );

  if (!text) {
    return (
      <GazetteerScreenShell>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#f472b6" />
        </View>
      </GazetteerScreenShell>
    );
  }

  return (
    <GazetteerScreenShell>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('TextOnlyCreate', {
                text,
                story24: isStory24 || undefined,
              })
            }
            style={styles.headerBack}
          >
            <Icon name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.logoMark}>
            <Icon name="location" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleSaveToDrafts}
              disabled={!canPost || isSavingDraft || isSubmitting}
            >
              {isSavingDraft ? (
                <ActivityIndicator size="small" color="#9CA3AF" />
              ) : (
                <Text style={[styles.draftBtn, !canPost && styles.disabledText]}>Save to drafts</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canPost || isSubmitting || isSavingDraft}
              style={[styles.postBtn, canPost && !isSubmitting && styles.postBtnActive]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.postBtnText, !canPost && styles.disabledText]}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.previewBox,
              activeTemplate ? { backgroundColor: activeTemplate.backgroundColor } : null,
            ]}
          >
            <Text style={[styles.previewText, previewTextStyle]}>{text}</Text>
          </View>

          <Text style={styles.sectionLabel}>Style</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
            {NATIVE_TEXT_STORY_TEMPLATES.map((template) => {
              const active = selectedTemplateId === template.id;
              return (
                <TouchableOpacity
                  key={template.id}
                  onPress={() => setSelectedTemplateId(template.id)}
                  style={[
                    styles.templateChip,
                    { backgroundColor: template.backgroundColor },
                    active && styles.templateChipActive,
                  ]}
                >
                  <Text style={[styles.templateChipText, { color: template.textColor }]} numberOfLines={1}>
                    {template.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.fieldRow}>
            <Icon name="location-outline" size={20} color="#9CA3AF" />
            <TextInput
              value={locationText}
              onChangeText={setLocationText}
              placeholder="Add location"
              placeholderTextColor="#6B7280"
              style={styles.fieldInput}
            />
          </View>

          <View style={styles.fieldRow}>
            <Icon name="business-outline" size={20} color="#9CA3AF" />
            <TextInput
              value={venueText}
              onChangeText={setVenueText}
              placeholder="Add venue (e.g. café, stadium)"
              placeholderTextColor="#6B7280"
              style={styles.fieldInput}
            />
          </View>

          <View style={styles.fieldRow}>
            <Icon name="flag-outline" size={20} color="#9CA3AF" />
            <TextInput
              value={landmarkText}
              onChangeText={setLandmarkText}
              placeholder="Add landmark (e.g. Phoenix Park, river)"
              placeholderTextColor="#6B7280"
              style={styles.fieldInput}
            />
          </View>

          <TouchableOpacity style={styles.tagRow} onPress={() => setShowUserTagging(true)}>
            <Icon name="person-outline" size={20} color="#9CA3AF" />
            <View style={styles.tagCopy}>
              <Text style={styles.tagTitle}>Tag People</Text>
              <Text style={styles.tagSubtitle}>
                {taggedUsers.length > 0
                  ? `${taggedUsers.length} ${taggedUsers.length === 1 ? 'person' : 'people'} tagged`
                  : 'Tag someone in your post'}
              </Text>
            </View>
            {taggedUsers.length > 0 && (
              <View style={styles.tagAvatars}>
                {taggedPreview.map((handle) => (
                  <View key={handle} style={styles.tagAvatar}>
                    <Text style={styles.tagAvatarText}>{handle.charAt(0).toUpperCase()}</Text>
                  </View>
                ))}
                {taggedUsers.length > 2 && (
                  <View style={[styles.tagAvatar, styles.tagAvatarMore]}>
                    <Text style={styles.tagAvatarMoreText}>+{taggedUsers.length - 2}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showUserTagging} animationType="slide" transparent onRequestClose={() => setShowUserTagging(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tag People</Text>
              <TouchableOpacity onPress={() => setShowUserTagging(false)}>
                <Icon name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.tagSearchRow}>
              <Icon name="search" size={18} color="#9CA3AF" />
              <TextInput
                value={tagSearchQuery}
                onChangeText={setTagSearchQuery}
                placeholder="Search by name or @handle"
                placeholderTextColor="#6B7280"
                style={styles.tagSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {taggedUsers.length > 0 && (
              <View style={styles.selectedTagsWrap}>
                {taggedUsers.map((handle) => (
                  <TouchableOpacity
                    key={handle}
                    style={styles.selectedTagChip}
                    onPress={() => setTaggedUsers((prev) => prev.filter((h) => h !== handle))}
                  >
                    <Text style={styles.selectedTagText}>@{handle}</Text>
                    <Icon name="close-circle" size={16} color="#f472b6" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {tagSearchLoading ? (
              <ActivityIndicator color="#f472b6" style={styles.tagLoader} />
            ) : (
              <FlatList
                data={tagSearchUsers}
                keyExtractor={(item) => item.handle}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  tagSearchQuery.trim() ? (
                    <Text style={styles.emptySearch}>No users found</Text>
                  ) : (
                    <Text style={styles.emptySearch}>Type to search users</Text>
                  )
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.searchUserRow} onPress={() => addTaggedUser(item.handle)}>
                    <View style={styles.searchUserAvatar}>
                      <Text style={styles.searchUserAvatarText}>{item.handle.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.searchUserCopy}>
                      <Text style={styles.searchUserName}>{item.displayName || item.handle}</Text>
                      <Text style={styles.searchUserHandle}>@{item.handle}</Text>
                    </View>
                    <Icon name="add-circle-outline" size={22} color="#f472b6" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    ...gazetteerHeader,
  },
  headerBack: { padding: 4 },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  draftBtn: { color: '#E5E7EB', fontSize: 13, fontWeight: '600' },
  postBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#374151',
  },
  postBtnActive: {
    backgroundColor: 'rgba(244, 114, 182, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.55)',
  },
  postBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabledText: { color: '#6B7280' },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 32 },
  previewBox: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 4,
    ...glassPanel,
  },
  previewText: { fontWeight: '600', lineHeight: 22 },
  sectionLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  templateRow: { gap: 8, paddingBottom: 4 },
  templateChip: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateChipActive: {
    borderColor: '#f472b6',
  },
  templateChipText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...glassSearch,
  },
  fieldInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...glassSearch,
  },
  tagCopy: { flex: 1 },
  tagTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  tagSubtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  tagAvatars: { flexDirection: 'row', gap: 4 },
  tagAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAvatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  tagAvatarMore: { backgroundColor: '#4B5563' },
  tagAvatarMoreText: { color: '#D1D5DB', fontSize: 10, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '78%',
    backgroundColor: '#120a1c',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  tagSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...glassSearch,
  },
  tagSearchInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  selectedTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectedTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(244, 114, 182, 0.15)',
  },
  selectedTagText: { color: '#F9A8D4', fontSize: 13, fontWeight: '600' },
  tagLoader: { marginVertical: 20 },
  searchUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchUserAvatarText: { color: '#FFFFFF', fontWeight: '700' },
  searchUserCopy: { flex: 1 },
  searchUserName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  searchUserHandle: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  emptySearch: { color: '#6B7280', textAlign: 'center', padding: 20, fontSize: 14 },
});
