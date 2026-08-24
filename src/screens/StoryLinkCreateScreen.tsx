import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import PostLinkPreviewCard from '../components/PostLinkPreviewCard.native';
import { useLinkPreview } from '../hooks/useLinkPreview';
import { publishTextStory24 } from '../utils/publishStoryNative';
import { hapticLight, hapticSuccess } from '../utils/hapticsNative';
import {
  extractFirstHttpUrl,
  fallbackLinkPreview,
} from '../utils/linkPreview';
import { ox } from '../constants/nativeOpticalScale';
import { navigateMainTab } from '../navigation/mainTabs';
import {
  STORY_LINK_SHARE_CANVAS_COLORS,
  STORY_LINK_SHARE_CANVAS_CSS,
} from '../utils/discoverAmbientPalette';

export default function StoryLinkCreateScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [linkUrl, setLinkUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedUrl = useMemo(
    () => extractFirstHttpUrl(linkUrl) || extractFirstHttpUrl(`https://${linkUrl.trim()}`),
    [linkUrl],
  );
  const { preview: fetchedPreview, loading } = useLinkPreview(resolvedUrl || '', { debounceMs: 0 });
  const preview = fetchedPreview || (resolvedUrl ? fallbackLinkPreview(resolvedUrl) : null);
  const canShare = Boolean(resolvedUrl) && !isSubmitting;

  const handlePaste = useCallback(async () => {
    try {
      const clip = await Clipboard.getString();
      const next = (clip || '').trim();
      if (!next) {
        Alert.alert('Clipboard empty', 'Copy a link first, then tap Paste.');
        return;
      }
      setLinkUrl(next);
      hapticLight();
    } catch {
      Alert.alert('Paste failed', 'Could not read your clipboard.');
    }
  }, []);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('InstantCreate');
  }, [navigation]);

  const handleShare = useCallback(async () => {
    if (!resolvedUrl) {
      Alert.alert('Add a link', 'Paste a YouTube, TikTok, Instagram, or web URL.');
      return;
    }
    if (!user) {
      Alert.alert('Login required', 'Please log in to share to your story.');
      return;
    }
    const note = caption.trim();
    const text = note ? `${note}\n${resolvedUrl}` : resolvedUrl;
    setIsSubmitting(true);
    try {
      await publishTextStory24({
        userId: user.id,
        userHandle: user.handle,
        text,
        textStyle: {
          color: '#ffffff',
          size: 'medium',
          background: STORY_LINK_SHARE_CANVAS_CSS,
        },
      });
      hapticSuccess();
      navigateMainTab(navigation, 'Home', { forceRefreshAt: Date.now() });
    } catch (err: any) {
      Alert.alert('Share failed', err?.message || 'Could not add this link to your story.');
    } finally {
      setIsSubmitting(false);
    }
  }, [caption, navigation, resolvedUrl, user]);

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, ox(12)) }]}>
          <TouchableOpacity onPress={handleClose} hitSlop={10} accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add link</Text>
          <TouchableOpacity
            style={[styles.shareBtn, canShare && styles.shareBtnActive]}
            onPress={() => void handleShare()}
            disabled={!canShare}
            accessibilityLabel="Share to story"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Text style={[styles.shareBtnText, !canShare && styles.shareBtnTextDisabled]}>
                Share
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + ox(24) }]}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={[...STORY_LINK_SHARE_CANVAS_COLORS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stage}
          >
            {preview ? (
              <View style={styles.cardWrap}>
                <PostLinkPreviewCard preview={preview} />
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Icon name="link-outline" size={ox(36)} color="rgba(255,255,255,0.85)" />
                </View>
                <Text style={styles.emptyTitle}>Share a link</Text>
                <Text style={styles.emptyBody}>
                  Paste a YouTube, TikTok, Instagram, or web URL. The share card shows on your story.
                </Text>
                {loading ? (
                  <ActivityIndicator style={styles.emptySpinner} color="rgba(255,255,255,0.7)" />
                ) : null}
              </View>
            )}
          </LinearGradient>

          <View style={styles.fields}>
            <Text style={styles.label}>Link</Text>
            <View style={styles.urlRow}>
              <Icon name="link-outline" size={ox(18)} color="rgba(255,255,255,0.55)" />
              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="https://…"
                placeholderTextColor="#6B7280"
                style={styles.urlInput}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                keyboardType="url"
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.pasteBtn} onPress={() => void handlePaste()}>
                <Text style={styles.pasteBtnText}>Paste</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a line above the card"
              placeholderTextColor="#6B7280"
              style={styles.noteInput}
              maxLength={120}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ox(16),
    paddingBottom: ox(10),
  },
  cancelText: { color: '#FFFFFF', fontSize: ox(16), fontWeight: '500' },
  headerTitle: { color: '#FFFFFF', fontSize: ox(16), fontWeight: '700' },
  shareBtn: {
    minWidth: ox(72),
    height: ox(34),
    paddingHorizontal: ox(14),
    borderRadius: ox(17),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnActive: { backgroundColor: '#FFFFFF' },
  shareBtnText: { color: '#111827', fontSize: ox(14), fontWeight: '700' },
  shareBtnTextDisabled: { color: 'rgba(255,255,255,0.45)' },
  scroll: { paddingHorizontal: ox(16), gap: ox(16) },
  stage: {
    borderRadius: ox(22),
    minHeight: ox(340),
    paddingHorizontal: ox(14),
    paddingVertical: ox(28),
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardWrap: { width: '100%' },
  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: ox(18),
  },
  emptyIcon: {
    width: ox(72),
    height: ox(72),
    borderRadius: ox(36),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ox(14),
  },
  emptyTitle: { color: '#FFFFFF', fontSize: ox(20), fontWeight: '700', marginBottom: ox(8) },
  emptyBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: ox(14),
    lineHeight: ox(20),
    textAlign: 'center',
  },
  emptySpinner: { marginTop: ox(16) },
  fields: { gap: ox(8) },
  label: { color: 'rgba(255,255,255,0.72)', fontSize: ox(13), fontWeight: '600' },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ox(8),
    borderRadius: ox(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#0B141C',
    paddingLeft: ox(12),
    paddingRight: ox(6),
    minHeight: ox(48),
  },
  urlInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: ox(15),
    paddingVertical: ox(10),
  },
  pasteBtn: {
    paddingHorizontal: ox(12),
    paddingVertical: ox(8),
    borderRadius: ox(10),
    backgroundColor: 'rgba(61,155,143,0.45)',
  },
  pasteBtnText: { color: '#FFFFFF', fontSize: ox(13), fontWeight: '700' },
  noteInput: {
    borderRadius: ox(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#0B141C',
    color: '#FFFFFF',
    fontSize: ox(15),
    paddingHorizontal: ox(14),
    paddingVertical: ox(12),
  },
});
