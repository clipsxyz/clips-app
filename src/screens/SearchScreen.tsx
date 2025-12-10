import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { unifiedSearch, type SearchSections } from '../api/search';
import { fetchPostsByUser } from '../api/posts';
import type { Post } from '../types';
import Avatar from '../components/Avatar';

const SearchScreen: React.FC = ({ navigation }: any) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sections, setSections] = useState<SearchSections>({});
    const [loading, setLoading] = useState(false);
    const [preloadPosts, setPreloadPosts] = useState<Post[]>([]);
    const [activeTab, setActiveTab] = useState<'locations' | 'users' | 'posts'>('locations');

    useEffect(() => {
        fetchPostsByUser('Sarah@Artane', 30).then(setPreloadPosts).catch(() => setPreloadPosts([]));
    }, []);

    useEffect(() => {
        const q = searchQuery.trim();
        if (!q) {
            setSections({});
            return;
        }
        setLoading(true);
        const id = setTimeout(() => {
            unifiedSearch({ q, types: 'users,locations,posts', usersLimit: 10, locationsLimit: 10, postsLimit: 12 })
                .then(r => {
                    setSections(r.sections);
                    setLoading(false);
                })
                .catch(() => {
                    setSections({});
                    setLoading(false);
                });
        }, 250);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const goToLocation = (loc: string) => {
        navigation.navigate('Discover', { location: loc });
    };

    const goToUser = (handle: string) => {
        navigation.navigate('ViewProfile', { handle });
    };

    const goToPost = (postId: string) => {
        navigation.navigate('PostDetail', { postId });
    };

    const renderUser = (user: any) => (
        <TouchableOpacity
            key={user.handle}
            onPress={() => goToUser(user.handle)}
            style={styles.resultItem}
        >
            <Avatar
                src={user.avatarUrl}
                name={user.handle.split('@')[0]}
                size={40}
            />
            <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{user.handle}</Text>
                <Text style={styles.resultMeta}>{user.followers_count || 0} followers</Text>
            </View>
        </TouchableOpacity>
    );

    const renderLocation = (loc: any) => (
        <TouchableOpacity
            key={loc.name}
            onPress={() => goToLocation(loc.name)}
            style={styles.resultItem}
        >
            <Icon name="location" size={20} color="#8B5CF6" />
            <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{loc.name}</Text>
                <Text style={styles.resultMeta}>{loc.posts || 0} posts</Text>
            </View>
        </TouchableOpacity>
    );

    const renderPost = (post: Post) => (
        <TouchableOpacity
            key={post.id}
            onPress={() => goToPost(post.id)}
            style={styles.postResultItem}
        >
            {post.mediaUrl ? (
                <Image source={{ uri: post.mediaUrl }} style={styles.postThumbnail} />
            ) : (
                <View style={styles.postThumbnailPlaceholder}>
                    <Icon name="text" size={24} color="#6B7280" />
                </View>
            )}
        </TouchableOpacity>
    );

    const allResults = [
        ...(sections.users || []).map(u => ({ type: 'user', data: u })),
        ...(sections.locations || []).map(l => ({ type: 'location', data: l })),
        ...(sections.posts || []).map(p => ({ type: 'post', data: p })),
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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

            {/* Tabs */}
            {searchQuery.length > 0 && (
                <View style={styles.tabs}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('locations')}
                        style={[styles.tab, activeTab === 'locations' && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, activeTab === 'locations' && styles.tabTextActive]}>
                            Locations
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('users')}
                        style={[styles.tab, activeTab === 'users' && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
                            Users
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('posts')}
                        style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
                            Posts
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                </View>
            ) : searchQuery.length > 0 ? (
                <ScrollView style={styles.resultsList}>
                    {activeTab === 'users' && sections.users && (
                        <View>
                            {sections.users.map(renderUser)}
                        </View>
                    )}
                    {activeTab === 'locations' && sections.locations && (
                        <View>
                            {sections.locations.map(renderLocation)}
                        </View>
                    )}
                    {activeTab === 'posts' && sections.posts && (
                        <View style={styles.postsGrid}>
                            {sections.posts.map(renderPost)}
                        </View>
                    )}
                    {(!sections.users?.length && !sections.locations?.length && !sections.posts?.length) && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No results found</Text>
                        </View>
                    )}
                </ScrollView>
            ) : (
                <View style={styles.emptyState}>
                    <View style={styles.preloadGrid}>
                        {preloadPosts.map((post) => (
                            <TouchableOpacity
                                key={post.id}
                                onPress={() => goToPost(post.id)}
                                style={styles.preloadItem}
                            >
                                {post.mediaUrl ? (
                                    <Image source={{ uri: post.mediaUrl }} style={styles.preloadImage} />
                                ) : (
                                    <View style={styles.preloadPlaceholder}>
                                        <Icon name="text" size={20} color="#6B7280" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};

import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#FFFFFF',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#8B5CF6',
    },
    tabText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#8B5CF6',
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        borderBottomColor: '#1F2937',
        gap: 12,
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    resultMeta: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 2,
    },
    postResultItem: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    postThumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    postThumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    postsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 1,
    },
    emptyState: {
        flex: 1,
        padding: 16,
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 40,
    },
    preloadGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
    },
    preloadItem: {
        width: '33.33%',
        aspectRatio: 1,
    },
    preloadImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    preloadPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default SearchScreen;
