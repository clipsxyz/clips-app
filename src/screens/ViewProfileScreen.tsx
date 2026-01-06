import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Modal,
    Share,
    Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, toggleFollowForPost, getFollowedUsers } from '../api/posts';
import { fetchUserProfile, toggleFollow } from '../api/client';
import { userHasStoriesByHandle } from '../api/stories';
import { isProfilePrivate, canViewProfile, hasPendingFollowRequest } from '../api/privacy';
import type { Post } from '../types';
import Avatar from '../components/Avatar';

export default function ViewProfileScreen({ route, navigation }: any) {
    const { handle } = route.params;
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';

    const [profileUser, setProfileUser] = useState<any>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [hasStory, setHasStory] = useState(false);
    const [canView, setCanView] = useState(true);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [profileIsPrivate, setProfileIsPrivate] = useState(false);
    const [stats, setStats] = useState({ following: 0, followers: 0, posts: 0 });
    const [showTraveledModal, setShowTraveledModal] = useState(false);

    useEffect(() => {
        loadProfile();
    }, [handle]);

    const loadProfile = async () => {
        if (!handle) return;
        setLoading(true);
        try {
            const decodedHandle = decodeURIComponent(handle);
            const profilePrivate = isProfilePrivate(decodedHandle);
            setProfileIsPrivate(profilePrivate);

            if (user?.id && user?.handle) {
                const followedUsers = await getFollowedUsers(user.id);
                const canViewProfileState = canViewProfile(user.handle, decodedHandle, followedUsers);
                const isFollowingUser = followedUsers.includes(decodedHandle);
                const hasPending = hasPendingFollowRequest(user.handle, decodedHandle);

                setCanView(canViewProfileState);
                setIsFollowing(isFollowingUser);
                setHasPendingRequest(hasPending);

                if (!canViewProfileState && profilePrivate && decodedHandle !== user.handle) {
                    Alert.alert(
                        'Private Profile',
                        'To view this user\'s profile you must be following them.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Follow', onPress: handleFollow },
                        ]
                    );
                    setLoading(false);
                    return;
                }
            }

            // Fetch profile data
            try {
                const profileData = await fetchUserProfile(decodedHandle, user?.id);
                setProfileUser(profileData);
                setStats({
                    following: profileData.following_count || 0,
                    followers: profileData.followers_count || 0,
                    posts: profileData.posts_count || 0,
                });
            } catch (err) {
                console.error('Error fetching profile:', err);
            }

            // Fetch posts
            const userPosts = await fetchPostsByUser(decodedHandle, userId);
            setPosts(userPosts);

            // Check for stories
            const hasStories = await userHasStoriesByHandle(decodedHandle);
            setHasStory(hasStories);
        } catch (error) {
            console.error('Error loading profile:', error);
            Alert.alert('Error', 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!user?.id || !handle || !user?.handle) {
            Alert.alert('Error', 'Unable to follow user. Please try again.');
            return;
        }

        const decodedHandle = decodeURIComponent(handle);
        try {
            const followedUsers = await getFollowedUsers(user.id);
            const isCurrentlyFollowing = followedUsers.includes(decodedHandle);
            const profilePrivate = isProfilePrivate(decodedHandle);

            let result;
            try {
                const encodedHandle = encodeURIComponent(decodedHandle);
                result = await toggleFollow(encodedHandle);
            } catch (apiError: any) {
                // Fallback to mock
                if (posts[0]?.id) {
                    await toggleFollowForPost(user.id, posts[0].id);
                }
                setIsFollowing(!isCurrentlyFollowing);
                setHasPendingRequest(false);
                if (!isCurrentlyFollowing && profilePrivate) {
                    setCanView(true);
                } else if (isCurrentlyFollowing && profilePrivate) {
                    setCanView(false);
                }
                return;
            }

            if (result.status === 'unfollowed') {
                if (posts[0]?.id) {
                    await toggleFollowForPost(user.id, posts[0].id);
                }
                setIsFollowing(false);
                setHasPendingRequest(false);
                if (profilePrivate) {
                    setCanView(false);
                }
            } else if (result.status === 'pending') {
                setHasPendingRequest(true);
                setIsFollowing(false);
                Alert.alert('Follow Request Sent', 'Your follow request has been sent.');
            } else if (result.status === 'accepted' || result.following === true) {
                if (posts[0]?.id) {
                    await toggleFollowForPost(user.id, posts[0].id);
                }
                setIsFollowing(true);
                setHasPendingRequest(false);
                setCanView(true);
            }

            // Refresh profile
            const profileData = await fetchUserProfile(decodedHandle, user.id);
            setStats({
                following: profileData.following_count || 0,
                followers: profileData.followers_count || 0,
                posts: profileData.posts_count || 0,
            });
        } catch (error: any) {
            console.error('Error toggling follow:', error);
            Alert.alert('Error', error?.message || 'Failed to follow user.');
        }
    };

    const handleStoryPress = () => {
        navigation.navigate('Stories', { openUserHandle: handle });
    };

    const handlePostPress = (postId: string) => {
        navigation.navigate('PostDetail', { postId });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    if (!canView && profileIsPrivate) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Icon name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.privateContainer}>
                    <Icon name="lock-closed" size={48} color="#6B7280" />
                    <Text style={styles.privateText}>This profile is private</Text>
                    <Text style={styles.privateSubtext}>Follow to see their posts</Text>
                    <TouchableOpacity onPress={handleFollow} style={styles.followButton}>
                        <Text style={styles.followButtonText}>
                            {hasPendingRequest ? 'Request Sent' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity>
                    <Icon name="ellipsis-horizontal" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <TouchableOpacity onPress={() => setShowProfileMenu(true)}>
                        <Avatar
                            src={profileUser?.avatarUrl}
                            name={handle?.split('@')[0] || 'User'}
                            size={80}
                            hasStory={hasStory}
                        />
                    </TouchableOpacity>

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.posts}</Text>
                            <Text style={styles.statLabel}>Posts</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.followers}</Text>
                            <Text style={styles.statLabel}>Followers</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.following}</Text>
                            <Text style={styles.statLabel}>Following</Text>
                        </View>
                    </View>
                </View>

                {/* User Info */}
                <View style={styles.userInfo}>
                    <Text style={styles.userHandle}>{handle}</Text>
                    {profileUser?.bio && (
                        <Text style={styles.bio}>{profileUser.bio}</Text>
                    )}
                </View>

                {/* Action Buttons */}
                {handle !== user?.handle && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            onPress={handleFollow}
                            style={[
                                styles.followButton,
                                isFollowing && styles.followingButton,
                            ]}
                        >
                            <Text style={[
                                styles.followButtonText,
                                isFollowing && styles.followingButtonText,
                            ]}>
                                {hasPendingRequest ? 'Request Sent' : isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.messageButton}>
                            <Text style={styles.messageButtonText}>Message</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowTraveledModal(true)}
                            style={[
                                styles.traveledButton,
                                (!profileUser?.placesTraveled || !Array.isArray(profileUser.placesTraveled) || profileUser.placesTraveled.length === 0) && styles.traveledButtonDisabled,
                            ]}
                            disabled={!profileUser?.placesTraveled || !Array.isArray(profileUser.placesTraveled) || profileUser.placesTraveled.length === 0}
                        >
                            <Icon name="location" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Posts Grid */}
                <View style={styles.postsContainer}>
                    <FlatList
                        data={posts}
                        numColumns={3}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handlePostPress(item.id)}
                                style={styles.postThumbnail}
                            >
                                {item.mediaUrl ? (
                                    <Image
                                        source={{ uri: item.mediaUrl }}
                                        style={styles.thumbnailImage}
                                    />
                                ) : (
                                    <View style={styles.thumbnailPlaceholder}>
                                        <Icon name="text" size={24} color="#6B7280" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                        scrollEnabled={false}
                    />
                </View>
            </ScrollView>

            {/* Traveled Modal */}
            <Modal
                visible={showTraveledModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowTraveledModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Places Traveled</Text>
                            <TouchableOpacity onPress={() => setShowTraveledModal(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {profileUser?.placesTraveled && Array.isArray(profileUser.placesTraveled) && profileUser.placesTraveled.length > 0 ? (
                                profileUser.placesTraveled.map((place: string, index: number) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.placeItem}
                                        onPress={() => {
                                            setShowTraveledModal(false);
                                            navigation.navigate('Feed', { location: place });
                                        }}
                                    >
                                        <View style={styles.placeIcon}>
                                            <Icon name="location" size={20} color="#FFFFFF" />
                                        </View>
                                        <Text style={styles.placeName}>{place}</Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowTraveledModal(false);
                                                navigation.navigate('Feed', { location: place });
                                            }}
                                        >
                                            <Icon name="eye" size={20} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>No places traveled yet.</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Profile Menu Modal */}
            <Modal
                visible={showProfileMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowProfileMenu(false)}
            >
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowProfileMenu(false)}
                >
                    <View style={styles.menuContainer}>
                        <View style={styles.menuContent}>
                            {/* View Stories - only show if user has stories */}
                            {hasStory && (
                                <TouchableOpacity
                                    style={styles.menuButton}
                                    onPress={() => {
                                        setShowProfileMenu(false);
                                        handleStoryPress();
                                    }}
                                >
                                    <View style={styles.menuIconContainer}>
                                        <Icon name="play" size={32} color="#FFFFFF" />
                                    </View>
                                    <Text style={styles.menuButtonText}>View Stories</Text>
                                </TouchableOpacity>
                            )}

                            {/* Follow */}
                            <TouchableOpacity
                                style={styles.menuButton}
                                onPress={async () => {
                                    setShowProfileMenu(false);
                                    await handleFollow();
                                }}
                            >
                                <View style={styles.menuIconContainer}>
                                    <Icon name={isFollowing ? "person-remove" : "person-add"} size={32} color="#FFFFFF" />
                                </View>
                                <Text style={styles.menuButtonText}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>
                            </TouchableOpacity>

                            {/* Share Profile */}
                            <TouchableOpacity
                                style={styles.menuButton}
                                onPress={async () => {
                                    setShowProfileMenu(false);
                                    const profileUrl = `https://gazetteer.app/user/${encodeURIComponent(handle || '')}`;
                                    try {
                                        await Share.share({
                                            message: `Check out ${profileUser?.name || handle}'s profile on Gazetteer: ${profileUrl}`,
                                            url: profileUrl,
                                        });
                                    } catch (err: any) {
                                        if (err.message !== 'User did not share') {
                                            console.error('Error sharing:', err);
                                        }
                                    }
                                }}
                            >
                                <View style={styles.menuIconContainer}>
                                    <Icon name="share-social" size={32} color="#FFFFFF" />
                                </View>
                                <Text style={styles.menuButtonText}>Share profile</Text>
                            </TouchableOpacity>

                            {/* QR Code */}
                            <TouchableOpacity
                                style={styles.menuButton}
                                onPress={() => {
                                    setShowProfileMenu(false);
                                    Alert.alert('QR Code', 'QR code feature coming soon!');
                                }}
                            >
                                <View style={styles.menuIconContainer}>
                                    <Icon name="qr-code" size={32} color="#FFFFFF" />
                                </View>
                                <Text style={styles.menuButtonText}>QR code</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 32,
    },
    statsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
    },
    userInfo: {
        padding: 16,
        paddingTop: 0,
    },
    userHandle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    bio: {
        fontSize: 14,
        color: '#D1D5DB',
        marginTop: 4,
    },
    actionButtons: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 16,
    },
    followButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    followingButton: {
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#374151',
    },
    followButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    followingButtonText: {
        color: '#FFFFFF',
    },
    messageButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
    },
    messageButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    postsContainer: {
        padding: 16,
    },
    postThumbnail: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 1,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    privateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    privateText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: 16,
        marginBottom: 8,
    },
    privateSubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 24,
    },
    traveledButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#1F2937',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    traveledButtonDisabled: {
        opacity: 0.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: '#111827',
        borderRadius: 16,
        maxWidth: 400,
        width: '100%',
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
    placeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#1F2937',
        borderRadius: 8,
        marginBottom: 12,
    },
    placeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F97316',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    placeName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        backgroundColor: '#262626',
        borderRadius: 24,
        padding: 24,
    },
    menuContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
    },
    menuButton: {
        alignItems: 'center',
        gap: 8,
    },
    menuIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#FFFFFF',
        textAlign: 'center',
    },
});









