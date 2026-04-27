import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Linking,
    Animated,
    Dimensions,
    ActivityIndicator,
    Modal,
    TextInput,
    ScrollView,
    Share,
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
import { getFollowedUsers, getPostById } from '../api/posts';
import { getAvatarForHandle } from '../api/users';
import { appendMessage } from '../api/messages';
import type { Story, StoryGroup } from '../types';
import Avatar from '../components/Avatar';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 15000; // 15 seconds

export default function StoriesScreen({ route, navigation }: any) {
    const { openUserHandle, openStoryId } = route.params || {};
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
    const [showShareModal, setShowShareModal] = useState(false);
    const [showInsightsModal, setShowInsightsModal] = useState(false);
    const [insightsTab, setInsightsTab] = useState<'viewers' | 'replies'>('viewers');
    const [replyText, setReplyText] = useState('');
    const [insightsAvatarMap, setInsightsAvatarMap] = useState<Record<string, string | undefined>>({});
    const progressRef = useRef(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const formatRelativeTime = (timestamp?: number) => {
        if (!timestamp || Number.isNaN(timestamp)) return 'just now';
        const diffMs = Date.now() - timestamp;
        const diffMin = Math.max(1, Math.floor(diffMs / 60000));
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        return `${diffDay}d ago`;
    };

    useEffect(() => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory) return;

        const handles = new Set<string>();
        (currentStory.viewerHandles || []).forEach((h) => {
            if (h) handles.add(h);
        });
        (currentStory.replies || []).forEach((r) => {
            if (r?.userHandle) handles.add(r.userHandle);
        });

        if (handles.size === 0) return;
        const updates: Record<string, string | undefined> = {};
        handles.forEach((handle) => {
            updates[handle] = getAvatarForHandle(handle);
        });
        setInsightsAvatarMap((prev) => ({ ...prev, ...updates }));
    }, [storyGroups, currentGroupIndex, currentStoryIndex]);

    useEffect(() => {
        loadStories();
    }, []);

    useEffect(() => {
        if (openUserHandle && storyGroups.length > 0) {
            const targetGroup = storyGroups.find(g => g.userHandle === openUserHandle);
            if (targetGroup) {
                startViewingStories(targetGroup, openStoryId);
            }
        }
    }, [openUserHandle, openStoryId, storyGroups.length]);

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

    const startViewingStories = async (group: StoryGroup, preferredStoryId?: string) => {
        if (!group || !user?.id || !group.stories || group.stories.length === 0) return;

        const followedUserHandles = await getFollowedUsers(user.id);
        const stories = await fetchUserStories(user.id, group.userId, followedUserHandles || []);
        if (!stories || stories.length === 0) return;

        const groupIndex = storyGroups.findIndex(g => g.userId === group.userId);
        if (groupIndex === -1) return;

        setStoryGroups(prev => {
            const updated = [...prev];
            updated[groupIndex] = { ...group, stories, avatarUrl: group.avatarUrl };
            return updated;
        });

        const initialStoryIndex = preferredStoryId
            ? Math.max(0, stories.findIndex((s) => s.id === preferredStoryId))
            : 0;
        setCurrentGroupIndex(groupIndex);
        setCurrentStoryIndex(initialStoryIndex);
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

    const openStoryLink = async (rawUrl?: string) => {
        if (!rawUrl) return;
        const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        try {
            await Linking.openURL(withProtocol);
        } catch (error) {
            console.error('Failed to open story link:', error);
        }
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
            if (currentGroup?.userHandle) {
                const sharedPost =
                    currentStory.sharedFromPost && !currentStory.mediaUrl
                        ? await getPostById(currentStory.sharedFromPost, user.id)
                        : null;
                const mediaUrl = (
                    (currentStory.mediaUrl || '').trim() ||
                    (sharedPost?.mediaUrl || '').trim() ||
                    (sharedPost?.mediaItems?.find((m) => m.type === 'image' || m.type === 'video')?.url || '').trim() ||
                    ''
                );
                const contextOwner =
                    (currentStory.sharedFromUser || sharedPost?.userHandle || currentGroup.userHandle) as string;
                const contextSnippet = (
                    (sharedPost?.text || sharedPost?.caption || currentStory.text || '') as string
                )
                    .trim()
                    .slice(0, 120);
                const normalizedReply = replyText.trim();
                const isVisualStory = !!mediaUrl;
                if (isVisualStory && mediaUrl) {
                    await appendMessage(user.handle, currentGroup.userHandle, {
                        imageUrl: mediaUrl,
                        storyId: currentStory.id,
                        storyContextOwner: contextOwner,
                        storyContextText: contextSnippet || undefined,
                    });
                } else {
                    const contextBubbleText = contextSnippet
                        ? `Replying to @${contextOwner}'s story:\n"${contextSnippet}"`
                        : `Replying to @${contextOwner}'s story`;
                    await appendMessage(user.handle, currentGroup.userHandle, {
                        text: contextBubbleText,
                        isSystemMessage: true,
                    });
                }
                await appendMessage(user.handle, currentGroup.userHandle, {
                    text: normalizedReply,
                    storyId: currentStory.id,
                    storyContextOwner: contextOwner,
                    storyContextText: isVisualStory ? undefined : (contextSnippet || undefined),
                });
            }
            setStoryGroups((prev) =>
                prev.map((group, groupIdx) => {
                    if (groupIdx !== currentGroupIndex) return group;
                    return {
                        ...group,
                        stories: group.stories.map((story, storyIdx) => {
                            if (storyIdx !== currentStoryIndex) return story;
                            return {
                                ...story,
                                replies: [
                                    ...(story.replies || []),
                                    {
                                        id: `reply-${Date.now()}`,
                                        userId: user.id,
                                        userHandle: user.handle,
                                        text: replyText.trim(),
                                        createdAt: Date.now(),
                                    },
                                ],
                            };
                        }),
                    };
                })
            );
            setReplyText('');
            setShowReplyModal(false);
        } catch (error) {
            console.error('Error adding reply:', error);
        }
    };

    const handleShareStory = async () => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory) return;

        const textBits = [
            `Story by ${currentGroup?.userHandle || currentStory.userHandle}`,
            currentStory.text ? `"${currentStory.text}"` : undefined,
            currentStory.location ? `Location: ${currentStory.location}` : undefined,
            currentStory.mediaUrl ? currentStory.mediaUrl : undefined,
        ].filter(Boolean);

        try {
            await Share.share({
                message: textBits.join('\n'),
                title: 'Share Story',
            });
            setShowShareModal(false);
        } catch (error) {
            console.error('Error sharing story:', error);
        }
    };

    useEffect(() => {
        const currentGroup = storyGroups[currentGroupIndex];
        const currentStory = currentGroup?.stories[currentStoryIndex];
        if (!currentStory || !user?.id || !viewingStories) return;

        markStoryViewed(currentStory.id, user.id, user.handle).catch(console.error);
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
    const currentStoryAudienceLabel = currentStory?.audience === 'close_friends'
        ? 'Followers'
        : currentStory?.audience === 'only_me'
            ? 'Only me'
            : 'Public';
    const currentStoryAudienceStyles = currentStory?.audience === 'close_friends'
        ? { borderColor: 'rgba(110, 231, 183, 0.8)', backgroundColor: 'rgba(16, 185, 129, 0.28)', textColor: '#d1fae5' }
        : currentStory?.audience === 'only_me'
            ? { borderColor: 'rgba(226, 232, 240, 0.65)', backgroundColor: 'rgba(100, 116, 139, 0.28)', textColor: '#f1f5f9' }
            : { borderColor: 'rgba(255, 255, 255, 0.35)', backgroundColor: 'rgba(0, 0, 0, 0.45)', textColor: '#FFFFFF' };

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
                                size="xl"
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
                                size="sm"
                            />
                            <Text style={styles.storyHeaderName}>{currentGroup.userHandle}</Text>
                            <View style={[styles.audienceBadge, { borderColor: currentStoryAudienceStyles.borderColor, backgroundColor: currentStoryAudienceStyles.backgroundColor }]}>
                                <Text style={[styles.audienceBadgeText, { color: currentStoryAudienceStyles.textColor }]}>{currentStoryAudienceLabel}</Text>
                            </View>
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
                    {!!currentStory.sharedFromUser && !currentStory.mediaUrl && currentStory.mediaType !== 'image' && currentStory.mediaType !== 'video' && (
                        <View style={styles.sharedAuthorInline}>
                            <Image
                                source={{ uri: getAvatarForHandle(currentStory.sharedFromUser) }}
                                style={styles.sharedAuthorAvatar}
                            />
                            <Text style={styles.storyTextCredit}>
                                Shared from {(currentStory.sharedFromUser || '').startsWith('@')
                                    ? currentStory.sharedFromUser.slice(1)
                                    : currentStory.sharedFromUser}
                            </Text>
                        </View>
                    )}

                    {Array.isArray(currentStory.stickers) &&
                        currentStory.stickers
                            .filter((overlay) => !!overlay?.linkUrl)
                            .map((overlay) => {
                                const label = (overlay.linkName || overlay.textContent || 'Shop now').trim();
                                return (
                                    <TouchableOpacity
                                        key={overlay.id}
                                        activeOpacity={0.9}
                                        onPress={() => openStoryLink(overlay.linkUrl)}
                                        style={[
                                            styles.storyLinkSticker,
                                            {
                                                left: `${overlay.x}%`,
                                                top: `${overlay.y}%`,
                                                transform: [
                                                    { translateX: -96 },
                                                    { translateY: -21 },
                                                    { scale: overlay.scale || 1 },
                                                    { rotate: `${overlay.rotation || 0}deg` },
                                                ],
                                                opacity: overlay.opacity ?? 1,
                                            },
                                        ]}
                                    >
                                        <View style={styles.storyLinkIconTile}>
                                            <Icon name="link-outline" size={15} color="#138CFF" />
                                        </View>
                                        <Text numberOfLines={1} style={styles.storyLinkLabel}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}

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
                            onPress={() => setShowShareModal(true)}
                            style={styles.actionButton}
                        >
                            <Icon name="paper-plane" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setIsMuted(!isMuted)}
                            style={styles.actionButton}
                        >
                            <Icon name={isMuted ? "volume-mute" : "volume-high"} size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        {currentStory?.userId === user?.id && (
                            <TouchableOpacity
                                onPress={() => {
                                    setInsightsTab('viewers');
                                    setShowInsightsModal(true);
                                }}
                                style={styles.actionButton}
                            >
                                <Icon name="bar-chart" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        )}
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

            {/* Share Modal */}
            <Modal
                visible={showShareModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowShareModal(false)}
            >
                <View style={styles.replyModal}>
                    <View style={styles.replyModalContent}>
                        <Text style={styles.replyModalTitle}>Share story</Text>
                        <TouchableOpacity style={styles.sheetActionButton} onPress={handleShareStory}>
                            <Icon name="share-social-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.sheetActionText}>Share via device apps</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.sheetActionButton}
                            onPress={() => {
                                const mediaUrl = currentStory?.mediaUrl || '';
                                if (mediaUrl) {
                                    Linking.openURL(mediaUrl).catch(() => {});
                                }
                                setShowShareModal(false);
                            }}
                        >
                            <Icon name="copy-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.sheetActionText}>Open media link</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowShareModal(false)} style={styles.replyCancelButton}>
                            <Text style={styles.replyCancelText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Owner Insights Modal */}
            <Modal
                visible={showInsightsModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowInsightsModal(false)}
            >
                <View style={styles.replyModal}>
                    <View style={styles.replyModalContent}>
                        <Text style={styles.replyModalTitle}>Story insights</Text>
                        <View style={styles.insightsTabRow}>
                            <TouchableOpacity
                                onPress={() => setInsightsTab('viewers')}
                                style={[styles.insightsTabBtn, insightsTab === 'viewers' && styles.insightsTabBtnActive]}
                            >
                                <Text style={[styles.insightsTabBtnText, insightsTab === 'viewers' && styles.insightsTabBtnTextActive]}>
                                    Viewers ({currentStory?.viewerHandles?.length || 0})
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setInsightsTab('replies')}
                                style={[styles.insightsTabBtn, insightsTab === 'replies' && styles.insightsTabBtnActive]}
                            >
                                <Text style={[styles.insightsTabBtnText, insightsTab === 'replies' && styles.insightsTabBtnTextActive]}>
                                    Replies ({currentStory?.replies?.length || 0})
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.insightsScroll} contentContainerStyle={styles.insightsScrollContent}>
                            {insightsTab === 'viewers' ? (
                                (currentStory?.viewerHandles?.length ? currentStory.viewerHandles : []).map((viewerHandle) => (
                                    <TouchableOpacity
                                        key={viewerHandle}
                                        style={styles.insightRow}
                                        onPress={() => navigation.navigate('ViewProfile', { handle: viewerHandle })}
                                    >
                                        <View style={styles.insightRowInner}>
                                            <Avatar
                                                src={insightsAvatarMap[viewerHandle]}
                                                name={viewerHandle.split('@')[0] || viewerHandle}
                                                size="sm"
                                            />
                                            <View style={styles.insightTextWrap}>
                                                <Text style={styles.insightPrimary}>{viewerHandle}</Text>
                                                <Text style={styles.insightSecondary}>Viewed this story</Text>
                                            </View>
                                        </View>
                                        <Icon name="chevron-forward" size={16} color="#9CA3AF" />
                                    </TouchableOpacity>
                                ))
                            ) : (
                                (currentStory?.replies?.length ? currentStory.replies : []).map((reply) => (
                                    <TouchableOpacity
                                        key={reply.id}
                                        style={styles.insightRow}
                                        onPress={() => navigation.navigate('ViewProfile', { handle: reply.userHandle })}
                                    >
                                        <View style={styles.insightRowInner}>
                                            <Avatar
                                                src={insightsAvatarMap[reply.userHandle]}
                                                name={reply.userHandle.split('@')[0] || reply.userHandle}
                                                size="sm"
                                            />
                                            <View style={styles.insightTextWrap}>
                                                <Text style={styles.insightPrimary}>{reply.userHandle}</Text>
                                                <Text style={styles.insightSecondary} numberOfLines={2}>
                                                    {reply.text}
                                                </Text>
                                                <Text style={styles.insightTertiary}>
                                                    {formatRelativeTime(reply.createdAt)}
                                                </Text>
                                            </View>
                                        </View>
                                        <Icon name="chevron-forward" size={16} color="#9CA3AF" />
                                    </TouchableOpacity>
                                ))
                            )}

                            {insightsTab === 'viewers' && !(currentStory?.viewerHandles?.length) && (
                                <Text style={styles.emptyInsightsText}>No viewers yet.</Text>
                            )}
                            {insightsTab === 'replies' && !(currentStory?.replies?.length) && (
                                <Text style={styles.emptyInsightsText}>No replies yet.</Text>
                            )}
                        </ScrollView>

                        <TouchableOpacity onPress={() => setShowInsightsModal(false)} style={styles.replyCancelButton}>
                            <Text style={styles.replyCancelText}>Close</Text>
                        </TouchableOpacity>
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
    audienceBadge: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    audienceBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
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
    storyTextCredit: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.65)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    sharedAuthorInline: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 128,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        zIndex: 24,
    },
    sharedAuthorAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    storyActions: {
        position: 'absolute',
        bottom: 40,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
        zIndex: 10,
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
        zIndex: 1,
    },
    rightTapArea: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: width / 2,
        zIndex: 1,
    },
    storyLinkSticker: {
        position: 'absolute',
        width: 192,
        height: 42,
        borderRadius: 6,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.10)',
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
        zIndex: 25,
    },
    storyLinkIconTile: {
        width: 32,
        height: 32,
        marginLeft: 5,
        borderRadius: 4,
        backgroundColor: '#EAF4FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyLinkLabel: {
        flex: 1,
        marginLeft: 10,
        marginRight: 12,
        fontSize: 15,
        lineHeight: 16,
        fontFamily: 'Inter-SemiBold',
        fontWeight: '600',
        color: '#111111',
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
    sheetActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    sheetActionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    insightsTabRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    insightsTabBtn: {
        flex: 1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingVertical: 8,
        alignItems: 'center',
    },
    insightsTabBtnActive: {
        borderColor: '#F8D26A',
        backgroundColor: '#3F2B07',
    },
    insightsTabBtnText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '700',
    },
    insightsTabBtnTextActive: {
        color: '#F8D26A',
    },
    insightsScroll: {
        maxHeight: 280,
        marginBottom: 14,
    },
    insightsScrollContent: {
        gap: 8,
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    insightRowInner: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    insightTextWrap: {
        marginLeft: 10,
        flex: 1,
    },
    insightPrimary: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    insightSecondary: {
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 4,
    },
    insightTertiary: {
        color: '#6B7280',
        fontSize: 11,
        marginTop: 4,
    },
    emptyInsightsText: {
        color: '#9CA3AF',
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 20,
    },
});









