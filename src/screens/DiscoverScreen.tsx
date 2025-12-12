import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { searchLocations, type LocationSuggestion } from '../api/locations';
import AsyncStorage from '@react-native-async-storage/async-storage';

const popularCities = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo', 
    'Dublin', 'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam'
];

export default function DiscoverScreen({ navigation }: any) {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const results = popularCities.filter(city => 
        city.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (!query.trim()) {
            setSuggestions([]);
            return;
        }
        const ctrl = new AbortController();
        const id = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(query.trim(), 20);
                if (!ctrl.signal.aborted) setSuggestions(res);
            } catch (e) {
                if (!ctrl.signal.aborted) setSuggestions([]);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 200);
        return () => {
            clearTimeout(id);
            ctrl.abort();
        };
    }, [query]);

    const selectLocation = async (name: string) => {
        console.log('Discover: Selecting location:', name);
        try {
            await AsyncStorage.setItem('pendingLocation', name);
            // Navigate to feed with location
            navigation.navigate('Home', { location: name });
        } catch (err) {
            console.error('Error saving location:', err);
        }
    };

    const firstName = (user?.name || 'Friend').split('@')[0];
    const displayList = suggestions.length > 0 
        ? suggestions.slice(0, 8) 
        : results.slice(0, 6).map(r => ({ name: r, type: 'city' as const }));

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    {/* Popular cities */}
                    <View style={styles.citiesContainer}>
                        <View style={styles.citiesGrid}>
                            {popularCities.map(city => (
                                <TouchableOpacity
                                    key={city}
                                    onPress={() => selectLocation(city)}
                                    style={styles.cityButton}
                                >
                                    <Icon name="location" size={16} color="#FFFFFF" />
                                    <Text style={styles.cityButtonText}>{city}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Greeting */}
                    <View style={styles.greetingContainer}>
                        <Text style={styles.greetingText}>
                            {`Hello, ${firstName}`}
                        </Text>
                    </View>

                    {/* Search input */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputWrapper}>
                            <Icon name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                            <TextInput
                                value={query}
                                onChangeText={(text) => {
                                    setQuery(text);
                                    setActiveIndex(-1);
                                }}
                                placeholder="Discover other locations..."
                                placeholderTextColor="#6B7280"
                                style={styles.searchInput}
                            />
                            {loading && (
                                <ActivityIndicator size="small" color="#8B5CF6" style={styles.loadingIndicator} />
                            )}
                        </View>

                        {/* Suggestions dropdown */}
                        {query && displayList.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                                <FlatList
                                    data={displayList}
                                    keyExtractor={(item, idx) => `${item.type}-${item.name}-${idx}`}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            onPress={() => selectLocation(item.name)}
                                            style={[
                                                styles.suggestionItem,
                                                activeIndex === index && styles.suggestionItemActive
                                            ]}
                                        >
                                            <Icon name="location" size={16} color="#3B82F6" />
                                            <View style={styles.suggestionContent}>
                                                <Text style={styles.suggestionName}>{item.name}</Text>
                                                {item.country && (
                                                    <Text style={styles.suggestionMeta}>
                                                        {item.type} • {item.country}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 16,
        justifyContent: 'center',
        paddingBottom: 100,
    },
    citiesContainer: {
        marginBottom: 32,
    },
    citiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    cityButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1F2937',
        gap: 8,
    },
    cityButtonText: {
        color: '#F3F4F6',
        fontSize: 14,
        fontWeight: '500',
    },
    greetingContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    greetingText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#60A5FA',
        textAlign: 'center',
    },
    searchContainer: {
        position: 'absolute',
        bottom: 40,
        left: 16,
        right: 16,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    loadingIndicator: {
        marginLeft: 8,
    },
    suggestionsContainer: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    suggestionItemActive: {
        backgroundColor: '#F3F4F6',
    },
    suggestionContent: {
        flex: 1,
    },
    suggestionName: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
        marginBottom: 2,
    },
    suggestionMeta: {
        fontSize: 11,
        color: '#6B7280',
        textTransform: 'capitalize',
    },
});




