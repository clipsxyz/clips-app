import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';

export default function TextOnlyCreateScreen({ navigation, route }: any) {
  const isStory24 = !!route.params?.story24;
  const [text, setText] = useState(String(route.params?.text || ''));

  useEffect(() => {
    if (route.params?.text != null) {
      setText(String(route.params.text));
    }
  }, [route.params?.text]);

  useEffect(() => {
    if (!route.params?.fromDraft) return;
    const body = String(route.params?.text || route.params?.textBody || '').trim();
    if (!body) return;
    navigation.replace('TextOnlyPostDetails', {
      text: body,
      fromDraft: true,
      location: route.params?.location || '',
      venue: route.params?.venue || '',
      landmark: route.params?.landmark || '',
      taggedUsers: route.params?.taggedUsers || [],
      story24: isStory24 || undefined,
    });
  }, [
    isStory24,
    navigation,
    route.params?.fromDraft,
    route.params?.landmark,
    route.params?.location,
    route.params?.taggedUsers,
    route.params?.text,
    route.params?.textBody,
    route.params?.venue,
  ]);

  const handleContinue = () => {
    if (!text.trim()) {
      Alert.alert('Text required', 'Add text before continuing.');
      return;
    }
    navigation.navigate('TextOnlyPostDetails', {
      text: text.trim(),
      story24: isStory24 || undefined,
    });
  };

  return (
    <GazetteerScreenShell>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{isStory24 ? 'Story 24 text' : 'Text-only post'}</Text>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!text.trim()}
          style={[styles.continueBtn, text.trim() && styles.continueBtnActive]}
        >
          <Text style={[styles.continueText, !text.trim() && styles.continueTextDisabled]}>Continue</Text>
        </TouchableOpacity>
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
          autoFocus
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
      </View>
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...gazetteerHeader,
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', flex: 1, marginHorizontal: 10 },
  continueBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#374151',
  },
  continueBtnActive: {
    backgroundColor: 'rgba(244, 114, 182, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.55)',
  },
  continueText: { color: '#f472b6', fontSize: 15, fontWeight: '700' },
  continueTextDisabled: { color: '#6B7280' },
  body: { padding: 16, gap: 14 },
  textInput: {
    minHeight: 280,
    color: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 16,
    ...glassPanel,
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
});
