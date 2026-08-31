import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { chipActiveMagenta, glassPanel, glassSurface, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { updateAuthProfile } from '../api/client';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField.native';
import type { LocationSuggestion } from '../api/locations';
import { ox } from '../constants/nativeOpticalScale';

const HIDDEN_PLACES_KEY = 'clips:suggestedPlacesDislikedPlaces';
const HIDDEN_BUSINESS_KEY = 'clips:hiddenBusinessSuggestions';
const LIKED_BUSINESS_KEY = 'clips:likedBusinessSuggestions';
const MAX_PREFERRED_LOCATIONS = 12;

export default function ContentPreferencesScreen({ navigation }: any) {
  const { user, login } = useAuth();
  const [preferredLocations, setPreferredLocations] = React.useState<string[]>(user?.placesTraveled ?? []);
  const [preferredLocationQuery, setPreferredLocationQuery] = React.useState('');
  const [hiddenPlaces, setHiddenPlaces] = React.useState<string[]>([]);
  const [hiddenBusinesses, setHiddenBusinesses] = React.useState<string[]>([]);
  const [likedBusinesses, setLikedBusinesses] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setPreferredLocations(user?.placesTraveled ?? []);
  }, [user?.placesTraveled]);

    const addPreferredLocation = (suggestion: LocationSuggestion) => {
    const label = (suggestion.display_name || suggestion.name || '').trim();
    if (!label) return;
    setPreferredLocations((prev) => {
      if (prev.some((p) => p.toLowerCase() === label.toLowerCase())) return prev;
      if (prev.length >= MAX_PREFERRED_LOCATIONS) return prev;
      return [...prev, label];
    });
    setPreferredLocationQuery('');
  };

  const removePreferredLocation = (place: string) => {
    setPreferredLocations((prev) => prev.filter((p) => p !== place));
  };

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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const places = preferredLocations.slice(0, MAX_PREFERRED_LOCATIONS);
    const nextPlaces = places.length > 0 ? places : undefined;
    login({ ...user, placesTraveled: nextPlaces });
    try {
      await updateAuthProfile({ places_traveled: places } as any);
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
    <GazetteerScreenShell>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={ox(18)} color="#FFFFFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Content Preferences</Text>
        <View style={{ width: ox(50) }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Locations</Text>
          <Text style={styles.sectionSubtext}>Add places you like or traveled to.</Text>
          <PlaceAutocompleteField
            value={preferredLocationQuery}
            onChange={setPreferredLocationQuery}
            onSelectSuggestion={addPreferredLocation}
            placeholder="Dublin, Barcelona, New York"
            showFeedLevels
          />
          <View style={styles.chipWrap}>
            {preferredLocations.map((place) => (
              <TouchableOpacity key={place} style={styles.chip} onPress={() => removePreferredLocation(place)}>
                <Text style={styles.chipText}>{place} ×</Text>
              </TouchableOpacity>
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
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ox(16),
    paddingVertical: ox(12),
    ...gazetteerHeader,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: ox(6) },
  backText: { color: '#FFFFFF', fontSize: ox(14), fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: ox(16), fontWeight: '700' },
  content: { padding: ox(16), gap: ox(12) },
  section: {
    borderRadius: ox(10),
    padding: ox(12),
    ...glassPanel,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#FFFFFF', fontSize: ox(14), fontWeight: '700' },
  sectionSubtext: { marginTop: ox(6), color: '#9CA3AF', fontSize: ox(12) },
  countHint: { marginTop: ox(8), color: '#6B7280', fontSize: ox(11) },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: ox(6), marginTop: ox(10) },
  chip: {
    borderRadius: ox(999),
    paddingHorizontal: ox(10),
    paddingVertical: ox(5),
    ...chipActiveMagenta,
  },
  chipStatic: {
    borderRadius: ox(999),
    paddingHorizontal: ox(10),
    paddingVertical: ox(5),
    ...glassSurface,
  },
  chipText: { color: '#FBCFE8', fontSize: ox(11) },
  chipStaticText: { color: '#E5E7EB', fontSize: ox(11) },
  saveButton: {
    marginTop: ox(12),
    borderRadius: ox(8),
    backgroundColor: '#d91b5c',
    paddingVertical: ox(10),
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: ox(13) },
  resetText: { color: '#D1D5DB', fontSize: ox(12), textDecorationLine: 'underline' },
  emptyText: { marginTop: ox(8), color: '#9CA3AF', fontSize: ox(12) },
});

