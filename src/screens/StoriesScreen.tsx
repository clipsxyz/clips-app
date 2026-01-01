import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Animated,
    Dimensions,
    ActivityIndicator,
    Modal,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { 
    fetchFollowedUsersStoryGroups, 
    fetchUserStories, 
    markStoryViewed, 
    incrementStoryViews,
    addStoryReaction,
    addStoryReply,
} from '../api/stories';
import { getFollowedUsers } from '../api/posts';
import type { Story, StoryGroup } from '../types';
import Avatar from '../components/Avatar';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 15000; // 15 seconds

export default function StoriesScreen({ route, navigation }: any) {
    const { openUserHandle } = route.params || {};
    const { user } = useAuth();
    const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
    const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [viewingStories, setViewingStories] = useState(false);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replyText, setReplyText] = useState('');
    const progressRef = useRef(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadStories();
    }, []);

    useEffect(() => {
        if (openUserHandle && storyGroups.length > 0) {
            const targetGroup = storyGroups.find(g => g.userHandle === openUserHandle);
            if (targetGroup) {
                startViewingStories(targetGroup);
            }
        }
    }, [openUserHandle, storyGroups.length]);

    const loadStories = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        try {
            const followedUserHandles = await getFollowedUsers(user.id);
            let groups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);
            
            if (openUserHandle) {
                // Add specific user's stories if not already included
                const existingGroup = groups.find(g => g.userHandle === openUserHandle);
                if (!existingGroup) {
                    // Fetch and add this user's story group
                    // Implementation would fetch from API
                }
            }
            
            setStoryGroups(groups);
        } catch (error) {
            console.error('Error loading stories:', error);
        } finally {
            setLoading(false);
        }
    };

    const startViewingStories = async (group: StoryGroup) => {
        if (!group || !user?.id || !group.stories || group.stories.length === 0) return;

        const stories = await fetchUserStories(user.id, group.userId);
        if (!stories || stories.length === 0) return;

        const groupIndex = storyGroups.findIndex(g => g.userId === group.userId);
        if (groupIndex === -1) return;

        setStoryGroups(prev => {
            const updated = [...prev];
            updated[groupIndex] = { ...group, stories, avatarUrl: group.avatarUrl };
            return updated;
        });

        setCurrentGroupIndex(groupIndex);
        setCurrentStoryIndex(0);
        setViewingStories(true);
        setProgress(0);
        setPaused(false);
        progressRef.current = 0;
        startProgress();
    };

    const startProgress = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        timerRef.current = setInterval(() => {
            if (paused) return;

            progressRef.current += 50;
            const newProgress = Math.min((progressRef.current / STORY_DURATION) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                nextStory();
            }
        }, 50);
    };

    const nextStory = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        const currentGroup = storyGroups[currentGroupIndex];
        if (!currentGroup) return;

        if (currentStoryIndex < currentGroup.stories.length - 1) {
            setCurrentStoryIndex(currentStoryIndex + 1);
            setProgress(0);
            progressRef.current = 0;
            startProgress();
        } else {
            if (currentGroupIndex < storyGroups.length - 1) {
                setCurrentGroupIndex(currentGroupIndex + 1);
                setCurrentStoryIndex(0);
                setProgress(0);
                progressRef.current = 0;
                startProgress();
            } else {
                closeStories();
            }
        }
    };

    const previousStory = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(currentStoryIndex - 1);
            setProgress(0);
            progressRef.current = 0;
            startProgress();
        } else {
            if (currentGroupIndex > 0) {
                setCurrentGroupIndex(currentGroupIndex - 1);
                const prevGroup = storyGroups[currentGroupIndex - 1];
                setCurrentStoryIndex(prevGroup?.stories.length - 1 || 0);
                setProgress(0);
                progressRef.current = 0;
                startProgress();
            }
        }
    };

    const closeStories = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        setViewingStories(false);
        setProgress(0);
        setPaused(false);
        progressRef.current = 0;
        navigation.goBack();
    };

    const handleReaction = async (emoji: string) => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory || !user?.id || !user?.handle) return;
        
        try {
            await addStoryReaction(currentStory.id, user.id, user.handle, emoji);
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    const handleReply = async () => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory || !user?.id || !user?.handle || !replyText.trim()) return;
        
        try {
            await addStoryReply(currentStory.id, user.id, user.handle, replyText);
            setReplyText('');
            setShowReplyModal(false);
        } catch (error) {
            console.error('Error adding reply:', error);
        }
    };

    useEffect(() => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory || !user?.id || !viewingStories) return;

        markStoryViewed(currentStory.id, user.id).catch(console.error);
        incrementStoryViews(currentStory.id).catch(console.error);
    }, [currentGroupIndex, currentStoryIndex, viewingStories]);

    useEffect(() => {
        if (viewingStories && !paused) {
            startProgress();
        } else if (paused && timerRef.current) {
            clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [viewingStories, paused, currentGroupIndex, currentStoryIndex]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    const currentGroup = storyGroups[currentGroupIndex];
    const currentStory = currentGroup?.stories[currentStoryIndex];

    if (!viewingStories) {
        // Story list view
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Icon name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Shorts</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.storyList}>
                    {storyGroups.map((group, index) => (
                        <TouchableOpacity
                            key={group.userId}
                            onPress={() => startViewingStories(group)}
                            style={styles.storyItem}
                        >
                            <Avatar
                                src={group.avatarUrl}
                                name={group.userHandle.split('@')[0]}
                                size={60}
                                hasStory={true}
                            />
                            <Text style={styles.storyUserName}>{group.userHandle}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    // Story viewer
    return (
        <View style={styles.storyViewer}>
            {/* Progress bars */}
            <View style={styles.progressContainer}>
                {currentGroup?.stories.map((_, index) => (
                    <View key={index} style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${index < currentStoryIndex ? 100 : index === currentStoryIndex ? progress : 0}%` }]} />
                    </View>
                ))}
            </View>

            {/* Story content */}
            {currentStory && (
                <>
                    <Image
                        source={{ uri: currentStory.mediaUrl }}
                        style={styles.storyImage}
                        resizeMode="cover"
                    />

                    {/* Header */}
                    <View style={styles.storyHeader}>
                        <View style={styles.storyHeaderLeft}>
                            <Avatar
                                src={currentGroup.avatarUrl}
                                name={currentGroup.userHandle.split('@')[0]}
                                size={32}
                            />
                            <Text style={styles.storyHeaderName}>{currentGroup.userHandle}</Text>
                            <Text style={styles.storyHeaderTime}>2h</Text>
                        </View>
                        <TouchableOpacity onPress={closeStories}>
                            <Icon name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Story text overlay */}
                    {currentStory.text && (
                        <View style={styles.storyTextOverlay}>
                            <Text style={styles.storyText}>{currentStory.text}</Text>
                        </View>
                    )}

                    {/* Bottom actions */}
                    <View style={styles.storyActions}>
                        <TouchableOpacity
                            onPress={() => handleReaction('❤️')}
                            style={styles.actionButton}
                        >
                            <Icon name="heart" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowReplyModal(true)}
                            style={styles.actionButton}
                        >
                            <Icon name="chatbubble" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setIsMuted(!isMuted)}
                            style={styles.actionButton}
                        >
                            <Icon name={isMuted ? "volume-mute" : "volume-high"} size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Navigation areas */}
                    <TouchableOpacity
                        style={styles.leftTapArea}
                        onPress={previousStory}
                        activeOpacity={1}
                    />
                    <TouchableOpacity
                        style={styles.rightTapArea}
                        onPress={nextStory}
                        activeOpacity={1}
                    />
                </>
            )}

            {/* Reply Modal */}
            <Modal
                visible={showReplyModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowReplyModal(false)}
            >
                <View style={styles.replyModal}>
                    <View style={styles.replyModalContent}>
                        <Text style={styles.replyModalTitle}>Reply to story</Text>
                        <TextInput
                            value={replyText}
                            onChangeText={setReplyText}
                            placeholder="Type a reply..."
                            placeholderTextColor="#9CA3AF"
                            style={styles.replyInput}
                            multiline
                        />
                        <View style={styles.replyModalActions}>
                            <TouchableOpacity
                                onPress={() => setShowReplyModal(false)}
                                style={styles.replyCancelButton}
                            >
                                <Text style={styles.replyCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleReply}
                                style={styles.replySendButton}
                            >
                                <Text style={styles.replySendText}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
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
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    storyList: {
        flex: 1,
        padding: 16,
    },
    storyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    storyUserName: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    storyViewer: {
        flex: 1,
        backgroundColor: '#000000',
    },
    progressContainer: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingTop: 8,
        gap: 4,
    },
    progressBarContainer: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#FFFFFF',
    },
    storyImage: {
        width: width,
        height: height,
        position: 'absolute',
    },
    storyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 40,
    },
    storyHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    storyHeaderName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    storyHeaderTime: {
        fontSize: 14,
        color: '#D1D5DB',
    },
    storyTextOverlay: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        right: 16,
    },
    storyText: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    storyActions: {
        position: 'absolute',
        bottom: 40,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
    },
    actionButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    leftTapArea: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: width / 2,
    },
    rightTapArea: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: width / 2,
    },
    replyModal: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    replyModalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    replyModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    replyInput: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    replyModalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    replyCancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#1F2937',
        alignItems: 'center',
    },
    replyCancelText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    replySendButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    replySendText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});









