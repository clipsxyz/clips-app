import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

const ProfileScreen: React.FC = () => {
    const mockUser = {
        name: 'John Doe',
        handle: 'john@dublin',
        bio: 'Content creator from Dublin, Ireland',
        followers: 1250,
        following: 340,
        posts: 89,
        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=800',
    };

    const mockPosts = [
        { id: '1', image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=400' },
        { id: '2', image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=400' },
        { id: '3', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=400' },
        { id: '4', image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=400' },
        { id: '5', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=400' },
        { id: '6', image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=400' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Profile</Text>
                <TouchableOpacity style={styles.settingsButton}>
                    <Icon name="settings" size={24} color="#6B7280" />
                </TouchableOpacity>
            </View>

            <View style={styles.profileSection}>
                <View style={styles.profileInfo}>
                    <Image source={{ uri: mockUser.profileImage }} style={styles.profileImage} />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{mockUser.name}</Text>
                        <Text style={styles.userHandle}>{mockUser.handle}</Text>
                        <Text style={styles.userBio}>{mockUser.bio}</Text>
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{mockUser.posts}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{mockUser.followers}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{mockUser.following}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.editButton}>
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.postsSection}>
                <View style={styles.postsHeader}>
                    <TouchableOpacity style={styles.postsTab}>
                        <Icon name="grid" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postsTab}>
                        <Icon name="bookmark" size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <View style={styles.postsGrid}>
                    {mockPosts.map((post) => (
                        <TouchableOpacity key={post.id} style={styles.postItem}>
                            <Image source={{ uri: post.image }} style={styles.postImage} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    settingsButton: {
        padding: 4,
    },
    profileSection: {
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    profileInfo: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginRight: 16,
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    userHandle: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 2,
    },
    userBio: {
        fontSize: 14,
        color: '#374151',
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
        color: '#111827',
    },
    statLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    editButton: {
        backgroundColor: '#F3F4F6',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignSelf: 'center',
    },
    editButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
    },
    postsSection: {
        flex: 1,
    },
    postsHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    postsTab: {
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    postsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 2,
    },
    postItem: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    postImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
});

export default ProfileScreen;
