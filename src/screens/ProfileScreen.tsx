import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser } from '../api/posts';
import { getUserCollections } from '../api/collections';
import { getDrafts, deleteDraft, type Draft } from '../api/drafts';
import { getUnreadTotal } from '../api/messages';
import type { Post, Collection } from '../types';
import Avatar from '../components/Avatar';

const ProfileScreen: React.FC = ({ navigation }: any) => {
    const { user, logout } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'collections'>('posts');
    const [collectionsOpen, setCollectionsOpen] = useState(false);
    const [draftsOpen, setDraftsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        loadData();
    }, [user?.handle]);

    const loadData = async () => {
        if (!user?.handle) return;
        setLoading(true);
        try {
            const [userPosts, userCollections, userDrafts] = await Promise.all([
                fetchPostsByUser(user.handle, 50),
                getUserCollections(user.id || 'me'),
                getDrafts().catch(() => []),
            ]);
            setPosts(userPosts);
            setCollections(userCollections);
            setDrafts(userDrafts);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.handle) {
            const updateUnreadCount = async () => {
                try {
                    const count = await getUnreadTotal(user.handle!);
                    setUnreadCount(count);
                } catch (error) {
                    console.error('Error fetching unread count:', error);
                }
            };
            updateUnreadCount();
            const interval = setInterval(updateUnreadCount, 10000);
            return () => clearInterval(interval);
        }
    }, [user?.handle]);

    const loadCollections = async () => {
        if (!user?.id) return;
        try {
            const userCollections = await getUserCollections(user.id);
            setCollections(userCollections);
        } catch (error) {
            console.error('Error loading collections:', error);
        }
    };

    const handleDeleteDraft = async (draftId: string) => {
        try {
            await deleteDraft(draftId);
            await loadData();
        } catch (error) {
            console.error('Error deleting draft:', error);
            Alert.alert('Error', 'Failed to delete draft');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => {
                        logout();
                        navigation.replace('Login');
                    },
                },
            ]
        );
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
                <Avatar
                    src={user?.avatarUrl}
                    name={user?.name || 'User'}
                    size={32}
                />
                <Text style={styles.title}>Passport</Text>
                <TouchableOpacity>
                    <Icon name="lock-closed" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Tabs: Messages, Drafts, Collections, Settings */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => navigation.navigate('Inbox')}
                >
                    <Icon name="mail" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Messages</Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setDraftsOpen(true)}
                >
                    <Icon name="document-text" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Drafts</Text>
                    {drafts.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {drafts.length > 9 ? '9+' : drafts.length}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => {
                        loadCollections();
                        setCollectionsOpen(true);
                    }}
                >
                    <Icon name="bookmark" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Collections</Text>
                    {collections.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {collections.length > 9 ? '9+' : collections.length}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => setSettingsOpen(true)}
                >
                    <Icon name="settings" size={20} color="#FFFFFF" />
                    <Text style={styles.tabLabel}>Settings</Text>
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
                            <TouchableOpacity
                                style={styles.collectionItem}
                                onPress={() => navigation.navigate('CollectionFeed', {
                                    collectionId: item.id,
                                    collectionName: item.name,
                                })}
                            >
                                {item.thumbnailUrl ? (
                                    <Image source={{ uri: item.thumbnailUrl }} style={styles.collectionThumbnail} />
                                ) : (
                                    <View style={styles.collectionThumbnailPlaceholder}>
                                        <Icon name="bookmark" size={24} color="#6B7280" />
                                    </View>
                                )}
                                <View style={styles.collectionInfo}>
                                    <Text style={styles.collectionName}>{item.name}</Text>
                                    <Text style={styles.collectionCount}>
                                        {item.postIds?.length || 0} {item.postIds?.length === 1 ? 'post' : 'posts'}
                                    </Text>
                                </View>
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

            {/* Drafts Modal */}
            <Modal
                visible={draftsOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDraftsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Drafts</Text>
                            <TouchableOpacity onPress={() => setDraftsOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {drafts.length > 0 ? (
                                drafts.map((draft) => (
                                    <View key={draft.id} style={styles.draftItem}>
                                        <View style={styles.draftInfo}>
                                            <Text style={styles.draftDate}>
                                                {new Date(draft.createdAt).toLocaleDateString()}
                                            </Text>
                                            <Text style={styles.draftText} numberOfLines={2}>
                                                {draft.text || 'No text'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteDraft(draft.id)}
                                            style={styles.deleteButton}
                                        >
                                            <Icon name="trash" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>No drafts yet</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Collections Modal */}
            <Modal
                visible={collectionsOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCollectionsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Collections</Text>
                            <TouchableOpacity onPress={() => setCollectionsOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {collections.length > 0 ? (
                                collections.map((collection) => {
                                    const postCount = collection.postIds?.length || 0;
                                    return (
                                        <TouchableOpacity
                                            key={collection.id}
                                            style={styles.collectionModalItem}
                                            onPress={() => {
                                                setCollectionsOpen(false);
                                                navigation.navigate('CollectionFeed', {
                                                    collectionId: collection.id,
                                                    collectionName: collection.name,
                                                });
                                            }}
                                        >
                                            {collection.thumbnailUrl ? (
                                                <Image source={{ uri: collection.thumbnailUrl }} style={styles.collectionModalThumbnail} />
                                            ) : (
                                                <View style={styles.collectionModalThumbnailPlaceholder}>
                                                    <Icon name="bookmark" size={24} color="#6B7280" />
                                                </View>
                                            )}
                                            <View style={styles.collectionModalInfo}>
                                                <Text style={styles.collectionModalName}>{collection.name}</Text>
                                                <Text style={styles.collectionModalCount}>
                                                    {postCount} {postCount === 1 ? 'post' : 'posts'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyText}>No collections yet</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Settings Modal */}
            <Modal
                visible={settingsOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSettingsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Settings</Text>
                            <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <TouchableOpacity
                                style={styles.logoutButton}
                                onPress={handleLogout}
                            >
                                <Text style={styles.logoutButtonText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    tab: {
        alignItems: 'center',
        position: 'relative',
        paddingHorizontal: 12,
    },
    tabLabel: {
        fontSize: 12,
        color: '#FFFFFF',
        marginTop: 4,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: 0,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    collectionThumbnail: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#111827',
    },
    collectionThumbnailPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionInfo: {
        flex: 1,
        marginLeft: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalBody: {
        padding: 16,
    },
    draftItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#111827',
        borderRadius: 8,
        marginBottom: 12,
    },
    draftInfo: {
        flex: 1,
    },
    draftDate: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 4,
    },
    draftText: {
        fontSize: 14,
        color: '#FFFFFF',
    },
    deleteButton: {
        padding: 8,
    },
    collectionModalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#111827',
        borderRadius: 8,
        marginBottom: 12,
    },
    collectionModalThumbnail: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#111827',
    },
    collectionModalThumbnailPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionModalInfo: {
        flex: 1,
        marginLeft: 12,
    },
    collectionModalName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    collectionModalCount: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    logoutButton: {
        backgroundColor: '#EF4444',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
    },
    logoutButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ProfileScreen;
