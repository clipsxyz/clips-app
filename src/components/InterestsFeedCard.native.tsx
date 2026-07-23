import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { INTEREST_OPTIONS, MAX_INTEREST_SELECTIONS } from '../constants/interestOptions';

type Props = {
  selected: string[];
  onToggle: (interest: string) => void;
  onSave: () => void;
  onSkip: () => void;
  saving?: boolean;
};

export default function InterestsFeedCard({ selected, onToggle, onSave, onSkip, saving = false }: Props) {
  const atMax = selected.length >= MAX_INTEREST_SELECTIONS;

  return (
    <View style={styles.card}>
      {/* Soft wash only — DiscoverAmbientCanvas paints above UI on Nokia when used as a sibling. */}
      <LinearGradient
        colors={['#0b0711', '#201138', '#3a1528', '#201138', '#0b0711']}
        locations={[0, 0.28, 0.52, 0.78, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.ambientWash}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(217,27,92,0.18)', 'transparent', 'rgba(122,90,200,0.14)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambientWash}
        pointerEvents="none"
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Your interests</Text>
            <Text style={styles.subtitle}>
              Optional — pick up to {MAX_INTEREST_SELECTIONS} for your profile. Your feed stays based on location.
            </Text>
          </View>
          <TouchableOpacity onPress={onSkip} style={styles.closeBtn} accessibilityLabel="Skip for now">
            <Icon name="close" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={styles.chipsWrap}>
          {INTEREST_OPTIONS.map((interest) => {
            const isSelected = selected.includes(interest);
            const disabled = !isSelected && atMax;
            return (
              <TouchableOpacity
                key={interest}
                disabled={disabled}
                onPress={() => onToggle(interest)}
                style={[styles.chip, isSelected && styles.chipSelected, disabled && styles.chipDisabled]}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{interest}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.count}>
          {selected.length} of {MAX_INTEREST_SELECTIONS} selected{atMax ? " — you're all set." : ''}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSave}
            disabled={saving || selected.length === 0}
            style={[styles.saveBtn, (saving || selected.length === 0) && styles.saveBtnDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Text style={styles.saveText}>{atMax ? 'Done' : 'Save'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0b0711',
    overflow: 'hidden',
  },
  ambientWash: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {},
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#9CA3AF', lineHeight: 17 },
  closeBtn: { padding: 6 },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    borderColor: '#8ab4ff',
    backgroundColor: 'rgba(138,180,255,0.15)',
  },
  chipDisabled: { opacity: 0.45 },
  chipText: { fontSize: 12, color: '#D1D5DB' },
  chipTextSelected: { color: '#dce9ff' },
  count: { paddingHorizontal: 16, paddingTop: 10, fontSize: 11, color: '#6B7280' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  skipBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipText: { color: '#D1D5DB', fontSize: 14, fontWeight: '500' },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#111827', fontSize: 14, fontWeight: '600' },
});
