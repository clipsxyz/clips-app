import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { searchLocations, type LocationSuggestion } from '../api/locations';
import {
  feedHeaderLabelFromSuggestion,
  formatFeedLevelsLine,
  parsedPlaceFeedFromSuggestion,
} from '../utils/placeFeedLevels';

export type PlaceFieldMode = 'location' | 'venue' | 'landmark';

type Props = {
  value: string;
  onChange: (value: string) => void;
  mode?: PlaceFieldMode;
  onSelectSuggestion?: (suggestion: LocationSuggestion) => void;
  placeholder?: string;
  showIcon?: boolean;
  showFeedLevels?: boolean;
  inputStyle?: TextInputProps['style'];
  /** Transparent input for bottom-sheet rows (web parity). */
  bare?: boolean;
};

function labelForPostField(s: LocationSuggestion, mode: PlaceFieldMode): string {
  const parsed = parsedPlaceFeedFromSuggestion(s);
  if (mode === 'location') {
    return parsed.local || parsed.regional || parsed.national || feedHeaderLabelFromSuggestion(s, parsed);
  }
  return feedHeaderLabelFromSuggestion(s, parsed) || s.display_name || s.name.split(',')[0].trim();
}

export default function PlaceAutocompleteField({
  value,
  onChange,
  mode = 'location',
  onSelectSuggestion,
  placeholder = 'Search city or neighborhood',
  showIcon = true,
  showFeedLevels = false,
  inputStyle,
  bare = false,
}: Props) {
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        setLoading(true);
        const apiMode = mode === 'venue' ? 'venue' : mode === 'landmark' ? 'landmark' : 'location';
        const res = await searchLocations(q, 12, apiMode, ctrl.signal);
        if (!ctrl.signal.aborted) setSuggestions(res);
      } catch {
        if (!ctrl.signal.aborted) setSuggestions([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [mode, value]);

  const showList = value.trim().length >= 2 && (loading || suggestions.length > 0);

  const pick = (s: LocationSuggestion) => {
    const parsed = parsedPlaceFeedFromSuggestion(s);
    const label = showFeedLevels
      ? parsed.fullName || s.name
      : labelForPostField(s, mode);
    onChange(label);
    onSelectSuggestion?.(s);
    setSuggestions([]);
  };

  return (
    <View style={styles.wrap}>
      {showIcon ? (
        <Icon name="location-outline" size={18} color="#9CA3AF" style={styles.icon} />
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        style={[bare ? styles.inputBare : styles.input, showIcon && !bare && styles.inputWithIcon, inputStyle]}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {loading && !showList ? (
        <ActivityIndicator size="small" color="#7A8AF0" style={styles.loader} />
      ) : null}
      {showList ? (
        <View style={styles.list}>
          {loading && suggestions.length === 0 ? (
            <Text style={styles.meta}>Searching…</Text>
          ) : null}
          {!loading && suggestions.length === 0 ? (
            <Text style={styles.meta}>No places found</Text>
          ) : null}
          {suggestions.slice(0, 8).map((s, idx) => (
            <TouchableOpacity
              key={`${s.type}-${s.name}-${idx}`}
              style={styles.item}
              onPress={() => pick(s)}
              activeOpacity={0.7}
            >
              <Text style={styles.itemTitle}>{s.display_name || s.name.split(',')[0]}</Text>
              {showFeedLevels ? (
                <Text style={styles.itemSub}>{formatFeedLevelsLine(s)}</Text>
              ) : (
                <Text style={styles.itemSub} numberOfLines={1}>
                  {s.name}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 10,
  },
  icon: {
    position: 'absolute',
    left: 12,
    top: 13,
    zIndex: 2,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F9FAFB',
  },
  inputBare: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 14,
    color: '#FFFFFF',
  },
  inputWithIcon: {
    paddingLeft: 40,
  },
  loader: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  list: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0f0f12',
    overflow: 'hidden',
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  itemTitle: {
    color: '#F3F4F6',
    fontSize: 14,
  },
  itemSub: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  meta: {
    padding: 12,
    color: '#9CA3AF',
    fontSize: 13,
  },
});
