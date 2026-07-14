import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar.native';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField.native';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';
import { saveDraft } from '../api/drafts';
import { unifiedSearch } from '../api/search';
import { useAuth } from '../context/Auth';
import { navigateMainTab } from '../navigation/mainTabs';
import { TEXT_STORY_TEMPLATES, type TextStoryTemplate } from '../textStoryTemplates';
import { publishTextStory24 } from '../utils/publishStoryNative';
import { gradientColorsFromCss } from '../utils/storyTextStyleNative';
import { hapticLight, hapticSuccess } from '../utils/hapticsNative';
import { addPendingFeedUpload } from '../utils/pendingFeedUploadNative';
import { startBackgroundFeedUpload } from '../utils/runBackgroundFeedUploadNative';
import { showUploadOverlayNative } from '../utils/uploadOverlayNative';

type TagUser = { handle: string; displayName?: string; avatarUrl?: string };

function templateFontSize(size: TextStoryTemplate['textSize']): number {
  if (size === 'small') return 14;
  if (size === 'large') return 20;
  return 17;
}

function TemplateComposerBackground({
  template,
  children,
}: {
  template?: TextStoryTemplate;
  children: React.ReactNode;
}) {
  const background = template?.background || '#000000';
  const colors = gradientColorsFromCss(background);
  const isGradient = background.includes('gradient');
  if (isGradient && colors.length >= 2) {
    return (
      <LinearGradient colors={colors} style={styles.composerSurface}>
        {children}
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.composerSurface, { backgroundColor: colors[0] || '#000000' }]}>
      {children}
    </View>
  );
}

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    route.params?.textTemplateId || route.params?.templateId || null,
  );
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplateCue, setShowTemplateCue] = useState(false);
  const cueScale = useSharedValue(0.6);
  const cueOpacity = useSharedValue(0);
  const cueTranslateY = useSharedValue(6);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [tagSearchUsers, setTagSearchUsers] = useState<TagUser[]>([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeTemplate = useMemo(
    () => (selectedTemplateId ? TEXT_STORY_TEMPLATES.find((t) => t.id === selectedTemplateId) : undefined),
    [selectedTemplateId],
  );

  useEffect(() => {
    if (route.params?.text != null) setText(String(route.params.text));
  }, [route.params?.text]);

  useEffect(() => {
    const appears = setTimeout(() => setShowTemplateCue(true), 500);
    const hides = setTimeout(() => setShowTemplateCue(false), 4300);
    return () => {
      clearTimeout(appears);
      clearTimeout(hides);
    };
  }, []);

  useEffect(() => {
    if (!showTemplateCue) return;
    cueScale.value = 0.6;
    cueOpacity.value = 0;
    cueTranslateY.value = 6;
    cueScale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    cueOpacity.value = withTiming(1, { duration: 420 });
    cueTranslateY.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });

    const burstTimer = setTimeout(() => {
      cueScale.value = withTiming(1.35, { duration: 220, easing: Easing.out(Easing.quad) });
      cueOpacity.value = withTiming(0, { duration: 220 });
      cueTranslateY.value = withTiming(-4, { duration: 220 });
    }, 2900);

    return () => clearTimeout(burstTimer);
  }, [showTemplateCue, cueOpacity, cueScale, cueTranslateY]);

  const templateCueStyle = useAnimatedStyle(() => ({
    opacity: cueOpacity.value,
    transform: [
      { translateY: cueTranslateY.value },
      { scale: cueScale.value },
    ],
  }));

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

  const buildTextStyle = useCallback(() => {
    if (activeTemplate) {
      return {
        color: activeTemplate.textColor,
        size: activeTemplate.textSize,
        background: activeTemplate.background,
        fontFamily: activeTemplate.fontFamily,
      };
    }
    return { color: '#ffffff', size: 'medium' as const, background: '#000000' };
  }, [activeTemplate]);

  const handleSaveToDrafts = async () => {
    if (!text.trim()) {
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
        textBody: text.trim(),
        location: locationText.trim() || undefined,
        venue: venueText.trim() || undefined,
        landmark: landmarkText.trim() || undefined,
        taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
        textTemplateId: selectedTemplateId || undefined,
      });
      hapticLight();
      Alert.alert(
        'Saved to drafts',
        'You can find it in your profile. Tap a draft to continue and post.',
        [{ text: 'Done', onPress: finishToFeed }],
      );
    } catch (err: any) {
      Alert.alert('Draft failed', err?.message || 'Could not save draft. Please try again.');
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
    const textStyle = buildTextStyle();
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
    const previewColors = gradientColorsFromCss(textStyle.background);
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
      templateId: selectedTemplateId || undefined,
    });
    showUploadOverlayNative({
      jobId: tempId,
      initialMessage: 'Posting to Gazetteer…',
      textThumbBackground: previewColors[0] || '#000000',
      textThumbLabel: activeTemplate?.name?.charAt(0).toUpperCase() || 'Aa',
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

  const inputColor = activeTemplate?.textColor || '#FFFFFF';
  const inputFontSize = activeTemplate ? templateFontSize(activeTemplate.textSize) : 17;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleCancel} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.templateBtnWrap}>
              {showTemplateCue ? (
                <Animated.View style={[styles.templateCueBubble, templateCueStyle]} pointerEvents="none">
                  <LinearGradient
                    colors={['#f6e27a', '#d4af37', '#d8dde3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.templateCueGradient}
                  >
                    <Text style={styles.templateCueText} numberOfLines={1}>
                      Try template
                    </Text>
                  </LinearGradient>
                  <View style={styles.templateCueTail} />
                </Animated.View>
              ) : null}
              <TouchableOpacity
                style={[styles.templateBtn, selectedTemplateId && styles.templateBtnActive]}
                onPress={() => setShowTemplatePicker(true)}
                accessibilityLabel="Choose template"
              >
                <Icon name="layers-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowLocationSheet(true)}
              accessibilityLabel="Add location, venue, and landmark"
            >
              <Icon name="location-outline" size={24} color="#FFFFFF" />
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
                size={40}
              />
            </View>
            <View style={styles.composerCol}>
              <TemplateComposerBackground template={activeTemplate}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="What's up?"
                  placeholderTextColor="#9CA3AF"
                  style={[styles.textInput, { color: inputColor, fontSize: inputFontSize }]}
                  multiline
                  maxLength={TEXT_POST_BODY_MAX_LENGTH}
                  autoFocus
                  textAlignVertical="top"
                />
              </TemplateComposerBackground>
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
                <Icon name="close" size={22} color="#FFFFFF" />
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
                <Icon name="search" size={16} color="#6B7280" />
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
                            size={36}
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
                      <Icon name="close" size={14} color="#FFFFFF" />
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

      <Modal
        visible={showTemplatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetDismiss} onPress={() => setShowTemplatePicker(false)} />
          <View style={[styles.templateSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose a template</Text>
              <TouchableOpacity onPress={() => setShowTemplatePicker(false)} hitSlop={8}>
                <Icon name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={TEXT_STORY_TEMPLATES}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.templateGridRow}
              contentContainerStyle={styles.templateGrid}
              renderItem={({ item }) => {
                const isSelected = selectedTemplateId === item.id;
                const previewColors = gradientColorsFromCss(item.background);
                return (
                  <TouchableOpacity
                    style={[styles.templateCard, isSelected && styles.templateCardActive]}
                    onPress={() => {
                      setSelectedTemplateId(item.id);
                      setShowTemplatePicker(false);
                    }}
                  >
                    {item.background.includes('gradient') ? (
                      <LinearGradient
                        colors={previewColors}
                        style={styles.templatePreview}
                      >
                        <Text style={[styles.templateAa, { color: item.textColor }]}>Aa</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.templatePreview, { backgroundColor: previewColors[0] }]}>
                        <Text style={[styles.templateAa, { color: item.textColor }]}>Aa</Text>
                      </View>
                    )}
                    <Text style={styles.templateName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.95)',
    overflow: 'visible',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
    overflow: 'visible',
    zIndex: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  templateBtnWrap: {
    position: 'relative',
    width: 34,
    height: 34,
    overflow: 'visible',
    zIndex: 30,
  },
  templateCueBubble: {
    position: 'absolute',
    top: 38,
    left: -40,
    width: 114,
    alignItems: 'center',
    zIndex: 40,
    shadowColor: '#d4af37',
    shadowOpacity: 0.42,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  templateCueGradient: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  templateCueText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    includeFontPadding: false,
  },
  templateCueTail: {
    width: 8,
    height: 8,
    backgroundColor: '#d8dde3',
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
    borderRadius: 2,
  },
  templateBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerIconBtn: {
    padding: 6,
  },
  draftsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  headerDisabled: {
    opacity: 0.4,
  },
  postBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    minWidth: 64,
    alignItems: 'center',
  },
  postBtnActive: {
    borderColor: '#FFFFFF',
  },
  postBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarCol: {
    paddingTop: 4,
  },
  composerCol: {
    flex: 1,
    minWidth: 0,
  },
  composerSurface: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 96,
  },
  textInput: {
    minHeight: 80,
    lineHeight: 22,
    padding: 0,
    margin: 0,
  },
  counterRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  counterText: {
    color: '#6B7280',
    fontSize: 12,
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
    backgroundColor: '#000000',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  templateSheet: {
    maxHeight: '75%',
    backgroundColor: '#020617',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  sheetBody: {
    padding: 16,
    gap: 8,
    paddingBottom: 8,
  },
  fieldLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  tagSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#000000',
  },
  tagSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
  },
  tagResults: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
    maxHeight: 192,
  },
  tagMeta: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  tagUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tagUserRowDisabled: {
    opacity: 0.5,
  },
  tagUserCopy: { flex: 1, minWidth: 0 },
  tagUserName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  tagUserHandle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  taggedLabel: { color: '#6B7280', fontSize: 12 },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tagChipText: { color: '#FFFFFF', fontSize: 13 },
  sheetDoneBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  sheetDoneText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  templateGrid: {
    padding: 16,
    gap: 12,
  },
  templateGridRow: {
    gap: 12,
  },
  templateCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    alignItems: 'center',
    gap: 6,
  },
  templateCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  templatePreview: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateAa: {
    fontSize: 12,
    fontWeight: '700',
  },
  templateName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    textAlign: 'center',
  },
});
