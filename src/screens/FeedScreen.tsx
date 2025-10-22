import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    TouchableOpacity,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock data for posts
const mockPosts = [
    {
        id: '1',
        userHandle: 'Sarah@Dublin',
        locationLabel: 'Dublin',
        storyLocation: 'Temple Bar District',
        tags: ['nightlife', 'music', 'pub', 'friends', 'dublin'],
        mediaUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=800',
        stats: { likes: 247, views: 1240, comments: 18, reclips: 12 },
        isBookmarked: false,
        isFollowing: true,
        userLiked: true,
        userReclipped: false,
        isOwnPost: false,
    },
    {
        id: '2',
        userHandle: 'Mike@Finglas',
        locationLabel: 'Finglas',
        storyLocation: 'Phoenix Park',
        tags: ['nature', 'walking', 'deer', 'park', 'outdoors'],
        mediaUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800',
        stats: { likes: 89, views: 567, comments: 8, reclips: 5 },
        isBookmarked: true,
        isFollowing: false,
        userLiked: false,
        userReclipped: false,
        isOwnPost: false,
    },
];

// Mock data for live streams
const mockLiveStreams = [
    {
        id: 'live-1',
        hostName: 'Emma@Ireland',
        hostLocation: 'Ireland',
        sessionId: 'session-1',
        viewerCount: 156,
        isFollowing: true,
    },
    {
        id: 'live-2',
        hostName: 'James@Dublin',
        hostLocation: 'Dublin',
        sessionId: 'session-2',
        viewerCount: 89,
        isFollowing: false,
    },
];

interface Post {
    id: string;
    userHandle: string;
    locationLabel: string;
    storyLocation: string;
    tags: string[];
    mediaUrl: string;
    stats: {
        likes: number;
        views: number;
        comments: number;
        reclips: number;
    };
    isBookmarked: boolean;
    isFollowing: boolean;
    userLiked: boolean;
    userReclipped: boolean;
    isOwnPost: boolean;
}

interface LiveStream {
    id: string;
    hostName: string;
    hostLocation: string;
    sessionId: string;
    viewerCount: number;
    isFollowing: boolean;
}

const FeedScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState('Ireland');
    const [posts, setPosts] = useState<Post[]>([]);
    const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [discoveredLocation, setDiscoveredLocation] = useState<string | null>(null);

    const tabs = ['Finglas', 'Dublin', 'Ireland', 'Following'];

    useEffect(() => {
        loadFeed();
    }, [activeTab]);

    const loadFeed = async () => {
        try {
            // Load posts based on active tab
            const filteredPosts = mockPosts.filter(post => {
                if (activeTab === 'Following') {
                    return post.isFollowing;
                }
                return post.locationLabel === activeTab;
            });

            // Load live streams based on active tab
            const filteredLiveStreams = mockLiveStreams.filter(stream => {
                if (activeTab === 'Following') {
                    return stream.isFollowing;
                }
                return stream.hostLocation === activeTab;
            });

            setPosts(filteredPosts);
            setLiveStreams(filteredLiveStreams);
        } catch (error) {
            console.error('Error loading feed:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadFeed();
        setRefreshing(false);
    };

    const handleDiscover = () => {
        Alert.alert(
            'Discover Location',
            'Enter a location to discover:',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'New York',
                    onPress: () => {
                        setDiscoveredLocation('New York');
                        setActiveTab('New York');
                    },
                },
                {
                    text: 'London',
                    onPress: () => {
                        setDiscoveredLocation('London');
                        setActiveTab('London');
                    },
                },
            ]
        );
    };

    const handleResetLocation = () => {
        setDiscoveredLocation(null);
        setActiveTab('Ireland');
    };

    const renderTabButton = (tab: string) => (
        <TouchableOpacity
            key={tab}
            style={[
                styles.tabButton,
                activeTab === tab && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab(tab)}
        >
            <Text
                style={[
                    styles.tabText,
                    activeTab === tab && styles.activeTabText,
                ]}
            >
                {tab}
            </Text>
        </TouchableOpacity>
    );

    const renderLiveStreamCard = ({ item }: { item: LiveStream }) => (
        <View style={styles.liveStreamCard}>
            <View style={styles.liveStreamHeader}>
                <View style={styles.profileContainer}>
                    <View style={styles.profilePicture}>
                        <Icon name="person" size={20} color="#8B5CF6" />
                    </View>
                    <View style={styles.liveIndicator}>
                        <Icon name="radio-button-on" size={8} color="#EF4444" />
                    </View>
                </View>
                <View style={styles.liveStreamInfo}>
                    <Text style={styles.hostName}>{item.hostName}</Text>
                    <Text style={styles.hostLocation}>{item.hostLocation}</Text>
                </View>
                <View style={styles.liveStreamActions}>
                    <View style={styles.viewerCount}>
                        <Icon name="eye" size={12} color="#6B7280" />
                        <Text style={styles.viewerCountText}>{item.viewerCount}</Text>
                    </View>
                    <TouchableOpacity style={styles.joinButton}>
                        <Icon name="play" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderPostCard = ({ item }: { item: Post }) => (
        <View style={styles.postCard}>
            <View style={styles.postHeader}>
                <Text style={styles.userHandle}>{item.userHandle}</Text>
                <Text style={styles.storyLocation}>{item.storyLocation}</Text>
            </View>

            <View style={styles.tagsContainer}>
                {item.tags.map((tag, index) => (
                    <Text key={index} style={styles.tag}>
                        #{tag}
                    </Text>
                ))}
            </View>

            <Image source={{ uri: item.mediaUrl }} style={styles.postImage} />

            <View style={styles.engagementBar}>
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.actionButton}>
                        <Icon name="heart" size={18} color="#EF4444" />
                        <Text style={styles.actionText}>{item.stats.likes}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton}>
                        <Icon name="chatbubble" size={18} color="#6B7280" />
                        <Text style={styles.actionText}>{item.stats.comments}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton}>
                        <Icon name="repeat" size={18} color="#6B7280" />
                        <Text style={styles.actionText}>{item.stats.reclips}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton}>
                        <Icon name="share" size={18} color="#6B7280" />
                    </TouchableOpacity>

                    <View style={styles.viewsContainer}>
                        <Icon name="eye" size={16} color="#6B7280" />
                        <Text style={styles.actionText}>{item.stats.views}</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.bookmarkButton}>
                    <Icon
                        name={item.isBookmarked ? "bookmark" : "bookmark-outline"}
                        size={18}
                        color={item.isBookmarked ? "#8B5CF6" : "#6B7280"}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderFeedItem = ({ item }: { item: any }) => {
        if (item.type === 'live') {
            return renderLiveStreamCard({ item: item.data });
        }
        return renderPostCard({ item: item.data });
    };

    // Mix live streams and posts
    const mixedFeed = [
        ...liveStreams.map(stream => ({ type: 'live', data: stream, id: stream.id })),
        ...posts.map(post => ({ type: 'post', data: post, id: post.id })),
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Clips</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleDiscover} style={styles.discoverButton}>
                        <Icon name="location" size={18} color="#8B5CF6" />
                        <Text style={styles.discoverText}>Discover</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.liveButton}
                        onPress={() => {
                            // Navigate to live stream screen
                            // This would typically use navigation.navigate('Live')
                            console.log('Navigate to live stream');
                        }}
                    >
                        <Icon name="videocam" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.notificationButton}>
                        <Icon name="notifications" size={18} color="#6B7280" />
                        <View style={styles.notificationBadge} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.tabContainer}>
                {tabs.map(renderTabButton)}
            </View>

            {discoveredLocation && (
                <View style={styles.discoveredLocationContainer}>
                    <Icon name="location" size={16} color="#8B5CF6" />
                    <Text style={styles.discoveredLocationText}>
                        Exploring: {discoveredLocation}
                    </Text>
                    <TouchableOpacity onPress={handleResetLocation}>
                        <Text style={styles.resetText}>Reset</Text>
                    </TouchableOpacity>
                </View>
            )}

            <FlatList
                data={mixedFeed}
                renderItem={renderFeedItem}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedContent}
            />
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
        color: '#8B5CF6',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    discoverButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    discoverText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    liveButton: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    notificationButton: {
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F9FAFB',
    },
    tabButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
        backgroundColor: '#E5E7EB',
    },
    activeTabButton: {
        backgroundColor: '#8B5CF6',
    },
    tabText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    discoveredLocationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        gap: 8,
    },
    discoveredLocationText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    resetText: {
        fontSize: 14,
        color: '#8B5CF6',
        fontWeight: '500',
    },
    feedContent: {
        paddingBottom: 20,
    },
    liveStreamCard: {
        marginHorizontal: 16,
        marginVertical: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    liveStreamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileContainer: {
        position: 'relative',
        marginRight: 12,
    },
    profilePicture: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    liveIndicator: {
        position: 'absolute',
        top: 2,
        right: 2,
    },
    liveStreamInfo: {
        flex: 1,
    },
    hostName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    hostLocation: {
        fontSize: 14,
        color: '#6B7280',
    },
    liveStreamActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    viewerCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewerCountText: {
        fontSize: 12,
        color: '#6B7280',
    },
    joinButton: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    postCard: {
        marginHorizontal: 16,
        marginVertical: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    postHeader: {
        padding: 16,
        paddingBottom: 8,
    },
    userHandle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    storyLocation: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 8,
    },
    tag: {
        fontSize: 12,
        color: '#8B5CF6',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    postImage: {
        width: '100%',
        height: 300,
        resizeMode: 'cover',
    },
    engagementBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    viewsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    bookmarkButton: {
        padding: 4,
    },
});

export default FeedScreen;
