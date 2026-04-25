import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { updateAuthProfile } from '../api/client';

const HIDDEN_PLACES_KEY = 'clips:suggestedPlacesDislikedPlaces';
const HIDDEN_BUSINESS_KEY = 'clips:hiddenBusinessSuggestions';
const LIKED_BUSINESS_KEY = 'clips:likedBusinessSuggestions';

function parseCommaList(input: string): string[] {
  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export default function ContentPreferencesScreen({ navigation }: any) {
  const { user, login } = useAuth();
  const [locationsInput, setLocationsInput] = React.useState(user?.placesTraveled?.join(', ') || '');
  const [hiddenPlaces, setHiddenPlaces] = React.useState<string[]>([]);
  const [hiddenBusinesses, setHiddenBusinesses] = React.useState<string[]>([]);
  const [likedBusinesses, setLikedBusinesses] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLocationsInput(user?.placesTraveled?.join(', ') || '');
  }, [user?.placesTraveled]);

  React.useEffect(() => {
    (async () => {
      try {
        const [rawPlaces, rawHiddenBiz, rawLikedBiz] = await Promise.all([
          AsyncStorage.getItem(HIDDEN_PLACES_KEY),
          AsyncStorage.getItem(HIDDEN_BUSINESS_KEY),
          AsyncStorage.getItem(LIKED_BUSINESS_KEY),
        ]);
        setHiddenPlaces(rawPlaces ? JSON.parse(rawPlaces) : []);
        setHiddenBusinesses(rawHiddenBiz ? JSON.parse(rawHiddenBiz) : []);
        setLikedBusinesses(rawLikedBiz ? JSON.parse(rawLikedBiz) : []);
      } catch {
        setHiddenPlaces([]);
        setHiddenBusinesses([]);
        setLikedBusinesses([]);
      }
    })();
  }, []);

  const parsedLocations = React.useMemo(() => parseCommaList(locationsInput), [locationsInput]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const nextPlaces = parsedLocations.length > 0 ? parsedLocations : undefined;
    login({ ...user, placesTraveled: nextPlaces });
    try {
      await updateAuthProfile({ places_traveled: parsedLocations } as any);
      Alert.alert('Saved', 'Content preferences updated.');
    } catch {
      Alert.alert('Saved locally', 'Could not sync to server right now.');
    } finally {
      setSaving(false);
      navigation.goBack();
    }
  };

  const removeFromList = async (
    key: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => {
      const next = prev.filter((entry) => entry.trim().toLowerCase() !== value.trim().toLowerCase());
      AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearList = async (key: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter([]);
    try {
      await AsyncStorage.setItem(key, JSON.stringify([]));
    } catch {
      // ignore
    }
  };

  const renderChipList = (
    title: string,
    items: string[],
    onRemove: (value: string) => void,
    onClear: () => void,
    emptyText: string
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <View style={styles.chipWrap}>
          {items.map((item) => (
            <TouchableOpacity key={item} style={styles.chip} onPress={() => onRemove(item)}>
              <Text style={styles.chipText}>{item} ×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Content Preferences</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Locations</Text>
          <Text style={styles.sectionSubtext}>Add places you like or traveled to (comma separated).</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={locationsInput}
            onChangeText={setLocationsInput}
            placeholder="Dublin, Barcelona, New York"
            placeholderTextColor="#6B7280"
          />
          <View style={styles.chipWrap}>
            {parsedLocations.map((place) => (
              <View key={place} style={styles.chipStatic}>
                <Text style={styles.chipText}>{place}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Preferences'}</Text>
          </TouchableOpacity>
        </View>

        {renderChipList(
          'Hidden suggestion places',
          hiddenPlaces,
          (value) => removeFromList(HIDDEN_PLACES_KEY, value, setHiddenPlaces),
          () => clearList(HIDDEN_PLACES_KEY, setHiddenPlaces),
          'No hidden places yet.'
        )}
        {renderChipList(
          'Hidden business suggestions',
          hiddenBusinesses,
          (value) => removeFromList(HIDDEN_BUSINESS_KEY, value, setHiddenBusinesses),
          () => clearList(HIDDEN_BUSINESS_KEY, setHiddenBusinesses),
          'No hidden business suggestions.'
        )}
        {renderChipList(
          'Liked business preferences',
          likedBusinesses,
          (value) => removeFromList(LIKED_BUSINESS_KEY, value, setLikedBusinesses),
          () => clearList(LIKED_BUSINESS_KEY, setLikedBusinesses),
          'No liked business preferences.'
        )}
      </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 12 },
  section: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sectionSubtext: { marginTop: 6, color: '#9CA3AF', fontSize: 12 },
  textArea: {
    marginTop: 10,
    minHeight: 90,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#030712',
    color: '#FFFFFF',
    padding: 10,
    textAlignVertical: 'top',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipStatic: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#0B1220',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { color: '#E5E7EB', fontSize: 11 },
  saveButton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: { color: '#030712', fontWeight: '700', fontSize: 13 },
  resetText: { color: '#D1D5DB', fontSize: 12, textDecorationLine: 'underline' },
  emptyText: { marginTop: 8, color: '#9CA3AF', fontSize: 12 },
});

