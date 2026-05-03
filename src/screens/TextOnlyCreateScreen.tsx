import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { createPost } from '../api/posts';
import { useAuth } from '../context/Auth';
import { saveDraft } from '../api/drafts';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';

export default function TextOnlyCreateScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const isStory24 = !!route.params?.story24;
  const [text, setText] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const handlePost = async () => {
    if (!text.trim()) {
      Alert.alert('Text required', 'Add text before posting.');
      return;
    }
    if (!user) {
      Alert.alert('Login required', 'Please log in to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createPost(
        user.id,
        user.handle,
        text.trim(),
        location.trim() || user.regional || 'Unknown',
        undefined,
        undefined,
        undefined,
        undefined,
        user.local,
        user.regional,
        user.national,
      );
      Alert.alert('Posted', isStory24 ? 'Your Story 24 text post is live.' : 'Your text-only post is live.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate(isStory24 ? 'Stories' : 'Home', { forceRefreshAt: Date.now() }),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Post failed', err?.message || 'Could not publish your post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!text.trim() && !location.trim()) {
      Alert.alert('Nothing to save', 'Add text or location before saving.');
      return;
    }
    if (isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      await saveDraft({
        videoUrl: '',
        videoDuration: 0,
        isTextOnly: true,
        textBody: text.trim() || undefined,
        caption: text.trim() || undefined,
        location: location.trim() || undefined,
      });
      Alert.alert('Saved', 'Draft saved to your profile drafts.');
    } catch (err: any) {
      Alert.alert('Draft failed', err?.message || 'Could not save draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Text-only post</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSaveDraft} disabled={isSavingDraft || isSubmitting}>
            {isSavingDraft ? (
              <ActivityIndicator size="small" color="#9CA3AF" />
            ) : (
              <Text style={styles.draftText}>Draft</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePost} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#F8D26A" />
            ) : (
              <Text style={styles.postText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What's happening?"
          placeholderTextColor="#6B7280"
          style={styles.textInput}
          multiline
          numberOfLines={10}
          maxLength={TEXT_POST_BODY_MAX_LENGTH}
        />
        <View style={styles.counterRow}>
          <Text
            style={[
              styles.counterText,
              text.length > TEXT_POST_BODY_MAX_LENGTH - 50
                ? (text.length >= TEXT_POST_BODY_MAX_LENGTH ? styles.counterDanger : styles.counterWarn)
                : null,
            ]}
          >
            {text.length}/{TEXT_POST_BODY_MAX_LENGTH}
          </Text>
        </View>

        <View style={styles.locationRow}>
          <Icon name="location" size={18} color="#F8D26A" />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Add location (optional)"
            placeholderTextColor="#6B7280"
            style={styles.locationInput}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  draftText: { color: '#9CA3AF', fontSize: 14, fontWeight: '700' },
  postText: { color: '#F8D26A', fontSize: 15, fontWeight: '700' },
  body: { padding: 16, gap: 14 },
  textInput: {
    minHeight: 220,
    backgroundColor: '#111827',
    color: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  counterRow: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  counterText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  counterWarn: {
    color: '#FBBF24',
  },
  counterDanger: {
    color: '#F87171',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  locationInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },
});
