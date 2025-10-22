import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

const SearchScreen: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const mockSearchResults = [
        { id: '1', type: 'user', name: 'Sarah@Dublin', followers: '1.2K' },
        { id: '2', type: 'user', name: 'Mike@Finglas', followers: '856' },
        { id: '3', type: 'hashtag', name: '#dublin', posts: '2.3K' },
        { id: '4', type: 'hashtag', name: '#ireland', posts: '15.7K' },
        { id: '5', type: 'location', name: 'Temple Bar', posts: '1.8K' },
    ];

    const renderSearchResult = ({ item }: { item: any }) => (
        <View style={styles.resultItem}>
            <Icon
                name={
                    item.type === 'user' ? 'person' :
                        item.type === 'hashtag' ? 'pound' : 'location'
                }
                size={20}
                color="#8B5CF6"
            />
            <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultMeta}>
                    {item.type === 'user' ? `${item.followers} followers` :
                        item.type === 'hashtag' ? `${item.posts} posts` :
                            `${item.posts} posts`}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.searchContainer}>
                    <Icon name="search" size={20} color="#6B7280" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search users, hashtags, locations..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#9CA3AF"
                    />
                </View>
            </View>

            {searchQuery.length > 0 ? (
                <FlatList
                    data={mockSearchResults.filter(item =>
                        item.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )}
                    renderItem={renderSearchResult}
                    keyExtractor={(item) => item.id}
                    style={styles.resultsList}
                />
            ) : (
                <View style={styles.emptyState}>
                    <Icon name="search" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>Search Clips</Text>
                    <Text style={styles.emptyDescription}>
                        Find users, hashtags, and locations
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    resultsList: {
        flex: 1,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 12,
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    resultMeta: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyDescription: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
});

export default SearchScreen;
