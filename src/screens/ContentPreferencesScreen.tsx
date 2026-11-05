import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import { useAuth } from '../context/Auth';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { mapLaravelUserToAppFields, updateAuthProfile } from '../api/client';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField.native';
import type { LocationSuggestion } from '../api/locations';
import { setNativeDislikedPlaces } from '../utils/suggestedPlaces';
import type { User } from '../types';

const HIDDEN_PLACES_KEY = 'clips:suggestedPlacesDislikedPlaces';
const HIDDEN_BUSINESS_KEY = 'clips:hiddenBusinessSuggestions';
const LIKED_BUSINESS_KEY = 'clips:likedBusinessSuggestions';
const MAX_PREFERRED_LOCATIONS = 12;

type Notice = {
  title: string;
  message: string;
  icon: 'success' | 'alert' | 'info';
  confirmText?: string;
  showCancel?: boolean;
  destructive?: boolean;
  onConfirm?: () => void;
};

function parseStoredList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function ContentPreferencesScreen({ navigation }: any) {
  const { user, login } = useAuth();
  const [preferredLocations, setPreferredLocations] = React.useState<string[]>(user?.placesTraveled ?? []);
  const [preferredLocationQuery, setPreferredLocationQuery] = React.useState('');
  const [hiddenPlaces, setHiddenPlaces] = React.useState<string[]>([]);
  const [hiddenBusinesses, setHiddenBusinesses] = React.useState<string[]>([]);
  const [likedBusinesses, setLikedBusinesses] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const leaveAfterNotice = React.useRef(false);

  React.useEffect(() => {
    setPreferredLocations(user?.placesTraveled ?? []);
  }, [user?.placesTraveled]);

  React.useEffect(() => {
    void (async () => {
      const [rawPlaces, rawHiddenBiz, rawLikedBiz] = await Promise.all([
        AsyncStorage.getItem(HIDDEN_PLACES_KEY),
        AsyncStorage.getItem(HIDDEN_BUSINESS_KEY),
        AsyncStorage.getItem(LIKED_BUSINESS_KEY),
      ]);
      const places = parseStoredList(rawPlaces);
      setHiddenPlaces(places);
      setHiddenBusinesses(parseStoredList(rawHiddenBiz));
      setLikedBusinesses(parseStoredList(rawLikedBiz));
      setNativeDislikedPlaces(places);
    })();
  }, []);

  const addPreferredLocation = (suggestion: LocationSuggestion) => {
    const label = (suggestion.display_name || suggestion.name || '').trim();
    if (!label) return;
    if (preferredLocations.some((place) => place.toLowerCase() === label.toLowerCase())) {
      setPreferredLocationQuery('');
      return;
    }
    if (preferredLocations.length >= MAX_PREFERRED_LOCATIONS) {
      setNotice({
        title: 'Location limit reached',
        message: `You can keep up to ${MAX_PREFERRED_LOCATIONS} places. Remove one to add another.`,
        icon: 'info',
      });
      return;
    }
    setPreferredLocations((prev) => [...prev, label]);
    setPreferredLocationQuery('');
  };

  const removePreferredLocation = (place: string) => {
    setPreferredLocations((prev) => prev.filter((entry) => entry !== place));
  };

  const persistList = async (key: string, next: string[]) => {
    await AsyncStorage.setItem(key, JSON.stringify(next));
    if (key === HIDDEN_PLACES_KEY) setNativeDislikedPlaces(next);
  };

  const removeFromList = (
    key: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((prev) => {
      const next = prev.filter((entry) => entry.trim().toLowerCase() !== value.trim().toLowerCase());
      void persistList(key, next).catch(() => {
        setNotice({
          title: 'Could not update',
          message: 'That preference stayed on this phone. Try again.',
          icon: 'alert',
        });
      });
      return next;
    });
  };

  const clearList = (key: string, setter: React.Dispatch<React.SetStateAction<string[]>>, title: string) => {
    setNotice({
      title,
      message: 'These suggestions can show in your feed again.',
      icon: 'alert',
      confirmText: 'Reset',
      showCancel: true,
      onConfirm: () => {
        setter([]);
        void persistList(key, []).catch(() => {
          setNotice({
            title: 'Could not reset',
            message: 'The list stayed as it was. Try again.',
            icon: 'alert',
          });
        });
        setNotice(null);
      },
    });
  };

  const handleSave = async () => {
    if (!user || saving) {
      if (!user) {
        setNotice({
          title: 'Sign in required',
          message: 'Log in to save the places that shape your feed.',
          icon: 'alert',
        });
      }
      return;
    }
    setSaving(true);
    const places = preferredLocations.slice(0, MAX_PREFERRED_LOCATIONS);
    const optimistic: User = { ...user, placesTraveled: places.length > 0 ? places : undefined };
    login(optimistic);
    try {
      if (isLaravelApiEnabled()) {
        const apiUser = await updateAuthProfile({ places_traveled: places });
        const mapped = mapLaravelUserToAppFields((apiUser || {}) as Record<string, unknown>);
        const merged: User = { ...optimistic };
        for (const [key, value] of Object.entries(mapped)) {
          if (value === undefined || value === null) continue;
          if (key === 'placesTraveled' && Array.isArray(value)) {
            merged.placesTraveled = value.length > 0 ? (value as string[]) : undefined;
            continue;
          }
          (merged as Record<string, unknown>)[key] = value;
        }
        if (!Array.isArray(mapped.placesTraveled)) {
          merged.placesTraveled = places.length > 0 ? places : undefined;
        }
        login(merged);
      }
      leaveAfterNotice.current = true;
      setNotice({
        title: 'Preferences saved',
        message: 'Your places will shape suggestions in the feed.',
        icon: 'success',
        confirmText: 'Done',
      });
    } catch {
      leaveAfterNotice.current = false;
      setNotice({
        title: 'Saved on this phone',
        message: 'Your places are on for this session. The server did not update.',
        icon: 'alert',
        confirmText: 'OK',
      });
    } finally {
      setSaving(false);
    }
  };

  const dismissNotice = () => {
    const shouldLeave = leaveAfterNotice.current;
    leaveAfterNotice.current = false;
    setNotice(null);
    if (shouldLeave) navigation.goBack();
  };

  const renderChipList = (
    title: string,
    items: string[],
    onRemove: (value: string) => void,
    onClear: () => void,
    emptyText: string,
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.length > 0 ? (
          <TouchableOpacity onPress={onClear} accessibilityLabel={`Reset ${title}`}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <View style={styles.chipWrap}>
          {items.map((item) => (
            <TouchableOpacity key={item} style={styles.chip} onPress={() => onRemove(item)}>
              <Text style={styles.chipText}>{item}</Text>
              <Icon name="close" size={14} color="#F472B6" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <GazetteerScreenShell ambientVariant="passport">
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Icon name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Content preferences</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferred locations</Text>
            <Text style={styles.sectionSubtext}>
              Places you like or have traveled to. The feed uses these for suggestions.
            </Text>
            <Text style={styles.countHint}>
              {preferredLocations.length} of {MAX_PREFERRED_LOCATIONS}
            </Text>
            <PlaceAutocompleteField
              value={preferredLocationQuery}
              onChange={setPreferredLocationQuery}
              onSelectSuggestion={addPreferredLocation}
              placeholder="Dublin, Barcelona, New York"
              showFeedLevels
              inputStyle={styles.placeInput}
            />
            <View style={styles.chipWrap}>
              {preferredLocations.map((place) => (
                <TouchableOpacity key={place} style={styles.chip} onPress={() => removePreferredLocation(place)}>
                  <Text style={styles.chipText}>{place}</Text>
                  <Icon name="close" size={14} color="#F472B6" />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={() => void handleSave()}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save preferences'}</Text>
            </TouchableOpacity>
          </View>

          {renderChipList(
            'Hidden suggestion places',
            hiddenPlaces,
            (value) => removeFromList(HIDDEN_PLACES_KEY, value, setHiddenPlaces),
            () => clearList(HIDDEN_PLACES_KEY, setHiddenPlaces, 'Reset hidden places?'),
            'No hidden places yet.',
          )}
          {renderChipList(
            'Hidden business suggestions',
            hiddenBusinesses,
            (value) => removeFromList(HIDDEN_BUSINESS_KEY, value, setHiddenBusinesses),
            () => clearList(HIDDEN_BUSINESS_KEY, setHiddenBusinesses, 'Reset hidden businesses?'),
            'No hidden business suggestions.',
          )}
          {renderChipList(
            'Liked business preferences',
            likedBusinesses,
            (value) => removeFromList(LIKED_BUSINESS_KEY, value, setLikedBusinesses),
            () => clearList(LIKED_BUSINESS_KEY, setLikedBusinesses, 'Clear liked businesses?'),
            'No liked business preferences.',
          )}
        </ScrollView>
      </View>

      <GazetteerAlertSheet
        visible={notice !== null}
        variant="card"
        title={notice?.title ?? ''}
        message={notice?.message}
        icon={notice?.icon}
        confirmButtonText={notice?.confirmText ?? 'Done'}
        cancelButtonText="Cancel"
        showCancelButton={notice?.showCancel ?? false}
        confirmDestructive={notice?.destructive ?? false}
        onConfirm={() => {
          if (notice?.onConfirm) {
            notice.onConfirm();
            return;
          }
          dismissNotice();
        }}
        onDismiss={dismissNotice}
      />
    </GazetteerScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 40 },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  section: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#2A2F3D',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionSubtext: {
    color: '#C9D1D9',
    fontSize: 14,
    lineHeight: 20,
  },
  countHint: {
    color: '#8B949E',
    fontSize: 12,
  },
  placeInput: {
    backgroundColor: '#0B0E14',
    borderColor: '#2A2F3D',
    color: '#FFFFFF',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#0B0E14',
    borderWidth: 1,
    borderColor: '#2A2F3D',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#0B0E14',
    fontWeight: '700',
    fontSize: 15,
  },
  resetText: {
    color: '#F472B6',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: '#8B949E',
    fontSize: 13,
  },
});
