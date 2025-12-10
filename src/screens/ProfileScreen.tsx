import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser } from '../api/posts';
import { getUserCollections } from '../api/collections';
import type { Post, Collection } from '../types';
import Avatar from '../components/Avatar';

const ProfileScreen: React.FC = ({ navigation }: any) => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'collections'>('posts');

    useEffect(() => {
        loadData();
    }, [user?.handle]);

    const loadData = async () => {
        if (!user?.handle) return;
        setLoading(true);
        try {
            const [userPosts, userCollections] = await Promise.all([
                fetchPostsByUser(user.handle, 50),
                getUserCollections(user.id || 'me'),
            ]);
            setPosts(userPosts);
            setCollections(userCollections);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Profile</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Inbox')}>
                    <Icon name="mail" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <View style={styles.profileSection}>
                <View style={styles.profileInfo}>
                    <Avatar
                        src={user?.avatarUrl}
                        name={user?.name || user?.handle || 'User'}
                        size={80}
                    />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user?.name || user?.handle}</Text>
                        <Text style={styles.userHandle}>{user?.handle}</Text>
                        {user?.bio && (
                            <Text style={styles.userBio}>{user.bio}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{posts.length}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user?.followers_count || 0}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user?.following_count || 0}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => {
                        // Navigate to profile edit - would need to create that screen
                    }}
                >
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.postsSection}>
                <View style={styles.postsHeader}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('posts')}
                        style={[styles.postsTab, activeTab === 'posts' && styles.postsTabActive]}
                    >
                        <Icon 
                            name="grid" 
                            size={20} 
                            color={activeTab === 'posts' ? "#8B5CF6" : "#6B7280"} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('collections')}
                        style={[styles.postsTab, activeTab === 'collections' && styles.postsTabActive]}
                    >
                        <Icon 
                            name="bookmark" 
                            size={20} 
                            color={activeTab === 'collections' ? "#8B5CF6" : "#6B7280"} 
                        />
                    </TouchableOpacity>
                </View>

                {activeTab === 'posts' ? (
                    <FlatList
                        data={posts}
                        numColumns={3}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                                style={styles.postItem}
                            >
                                {item.mediaUrl ? (
                                    <Image source={{ uri: item.mediaUrl }} style={styles.postImage} />
                                ) : (
                                    <View style={styles.postPlaceholder}>
                                        <Icon name="text" size={24} color="#6B7280" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No posts yet</Text>
                            </View>
                        }
                    />
                ) : (
                    <FlatList
                        data={collections}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.collectionItem}>
                                <Text style={styles.collectionName}>{item.name}</Text>
                                <Text style={styles.collectionCount}>{item.postIds.length} posts</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No collections yet</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    profileSection: {
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    profileInfo: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 16,
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    userHandle: {
        fontSize: 16,
        color: '#9CA3AF',
        marginTop: 2,
    },
    userBio: {
        fontSize: 14,
        color: '#D1D5DB',
        marginTop: 4,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 2,
    },
    editButton: {
        backgroundColor: '#1F2937',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    editButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    postsSection: {
        flex: 1,
    },
    postsHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        gap: 32,
    },
    postsTab: {
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    postsTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#8B5CF6',
    },
    postItem: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    postImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    postPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    collectionName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    collectionCount: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
    },
});

export default ProfileScreen;
