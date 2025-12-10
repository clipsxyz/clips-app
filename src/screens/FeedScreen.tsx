import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    ScrollView,
    Modal,
    TextInput,
    Alert,
    Share,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { 
    fetchPostsPage, 
    toggleFollowForPost, 
    toggleLike, 
    incrementViews, 
    toggleBookmark,
    reclipPost,
    addComment,
    fetchComments,
    incrementShares,
} from '../api/posts';
import { userHasUnviewedStoriesByHandle, userHasStoriesByHandle } from '../api/stories';
import { timeAgo } from '../utils/timeAgo';
import { enqueue, drain } from '../utils/mutationQueue';
import type { Post, Comment } from '../types';

type Tab = string;

function PillTabs({ 
    active, 
    onChange, 
    userRegional = 'Dublin', 
    userNational = 'Ireland' 
}: { 
    active: Tab; 
    onChange: (t: Tab) => void; 
    userRegional?: string;
    userNational?: string;
}) {
    const tabs: Tab[] = [userRegional, userNational, 'Clips', 'Discover', 'Following'];

    return (
        <View style={styles.tabContainer}>
            <View style={styles.tabGrid}>
                {tabs.map(t => {
                    const isActive = active === t;
                    return (
                        <TouchableOpacity
                            key={t}
                            onPress={() => onChange(t)}
                            style={[
                                styles.tabButton,
                                isActive ? styles.activeTabButton : styles.inactiveTabButton,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isActive ? styles.activeTabText : styles.inactiveTabText,
                                ]}
                            >
                                {t}
                            </Text>
                            {isActive && (
                                <Icon name="eye" size={28} color="#FFFFFF" style={styles.eyeIcon} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

function Avatar({ 
    src, 
    name, 
    size = 32, 
    hasStory = false, 
    onPress 
}: { 
    src?: string; 
    name: string; 
    size?: number;
    hasStory?: boolean;
    onPress?: () => void;
}) {
    const getInitials = (fullName: string): string => {
        const names = fullName.trim().split(' ');
        if (names.length === 1) {
            return names[0].charAt(0).toUpperCase();
        }
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    };

    const initials = getInitials(name);
    const Component = onPress ? TouchableOpacity : View;

    if (hasStory) {
        return (
            <Component onPress={onPress} style={styles.avatarContainer}>
                <View style={[styles.storyBorder, { width: size + 4, height: size + 4 }]}>
                    <View style={[styles.avatarInner, { width: size, height: size }]}>
                        {src ? (
                            <Image source={{ uri: src }} style={styles.avatarImage} />
                        ) : (
                            <View style={[styles.avatarFallback, { width: size, height: size }]}>
                                <Text style={styles.avatarInitials}>{initials}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Component>
        );
    }

    return (
        <Component onPress={onPress} style={styles.avatarContainer}>
            <View style={[styles.avatarInner, { width: size, height: size }]}>
                {src ? (
                    <Image source={{ uri: src }} style={styles.avatarImage} />
                ) : (
                    <View style={[styles.avatarFallback, { width: size, height: size }]}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                )}
            </View>
        </Component>
    );
}

function PostHeader({ 
    post, 
    onFollow, 
    isCurrentUser 
}: { 
    post: Post; 
    onFollow?: () => Promise<void>;
    isCurrentUser: boolean;
}) {
    const [hasStory, setHasStory] = useState(false);

    useEffect(() => {
        async function checkStory() {
            try {
                let result;
                if (isCurrentUser) {
                    result = await userHasStoriesByHandle(post.userHandle);
                } else {
                    result = await userHasUnviewedStoriesByHandle(post.userHandle);
                }
                setHasStory(result);
            } catch (error) {
                console.error('Error checking story:', error);
            }
        }
        checkStory();
    }, [post.userHandle, isCurrentUser]);

    return (
        <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
                <TouchableOpacity 
                    style={styles.avatarWrapper}
                    onPress={hasStory ? onStoryPress : onAvatarPress}
                >
                    <Avatar
                        src={undefined}
                        name={post.userHandle.split('@')[0]}
                        size={32}
                        hasStory={hasStory}
                    />
                    {/* + icon overlay on profile picture */}
                    {!isCurrentUser && onFollow && (post.isFollowing === false || post.isFollowing === undefined) && (
                        <TouchableOpacity
                            onPress={onFollow}
                            style={styles.followPlusButton}
                        >
                            <Icon name="add" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                    {/* Checkmark when following */}
                    {!isCurrentUser && onFollow && post.isFollowing === true && (
                        <View style={styles.followCheckButton}>
                            <Icon name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.postHeaderInfo}
                    onPress={onAvatarPress}
                >
                    <Text style={styles.userHandle}>{post.userHandle}</Text>
                    <View style={styles.postMeta}>
                        <Icon name="location" size={12} color="#6B7280" />
                        <Text style={styles.locationText}>{post.locationLabel || 'No location'}</Text>
                        {post.createdAt && (
                            <>
                                <Text style={styles.separator}>·</Text>
                                <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
                            </>
                        )}
                    </View>
                </View>
            </View>
            {post.locationLabel && (
                <View style={styles.postHeaderRight}>
                    <TouchableOpacity style={styles.locationButton}>
                        <Icon name="location" size={12} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

function CommentsModal({
    postId,
    isOpen,
    onClose,
    userId,
}: {
    postId: string;
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [commentText, setCommentText] = useState('');

    useEffect(() => {
        if (isOpen && postId) {
            loadComments();
        }
    }, [isOpen, postId]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const fetchedComments = await fetchComments(postId);
            setComments(fetchedComments);
        } catch (err) {
            console.error('Error loading comments:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        try {
            const newComment = await addComment(postId, userId, commentText);
            setComments(prev => [newComment, ...prev]);
            setCommentText('');
        } catch (err) {
            console.error('Error adding comment:', err);
            Alert.alert('Error', 'Failed to add comment');
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Comments</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="small" color="#8B5CF6" style={styles.modalLoading} />
                    ) : (
                        <FlatList
                            data={comments}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <View style={styles.commentItem}>
                                    <Avatar
                                        src={undefined}
                                        name={item.userHandle.split('@')[0]}
                                        size={32}
                                    />
                                    <View style={styles.commentContent}>
                                        <Text style={styles.commentUser}>{item.userHandle}</Text>
                                        <Text style={styles.commentText}>{item.text}</Text>
                                        <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
                                    </View>
                                </View>
                            )}
                            style={styles.commentsList}
                        />
                    )}

                    <View style={styles.commentInputContainer}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Add a comment..."
                            placeholderTextColor="#6B7280"
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                        />
                        <TouchableOpacity onPress={handleAddComment} style={styles.sendButton}>
                            <Icon name="send" size={20} color="#8B5CF6" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function ShareModal({
    post,
    isOpen,
    onClose,
}: {
    post: Post | null;
    isOpen: boolean;
    onClose: () => void;
}) {
    const handleShare = async () => {
        if (!post) return;
        try {
            const result = await Share.share({
                message: post.text ? `${post.text} by ${post.userHandle}` : `Check out this post by ${post.userHandle}`,
                url: post.mediaUrl,
            });
            if (result.action === Share.sharedAction) {
                onClose();
            }
        } catch (err: any) {
            console.error('Error sharing:', err);
        }
    };

    const handleCopyLink = async () => {
        if (!post) return;
        // In React Native, you'd use Clipboard API
        Alert.alert('Link copied', 'Post link copied to clipboard');
        onClose();
    };

    if (!isOpen || !post) return null;

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.shareModalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Share</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleShare} style={styles.shareOption}>
                        <Icon name="share-social" size={24} color="#FFFFFF" />
                        <Text style={styles.shareOptionText}>Share via...</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCopyLink} style={styles.shareOption}>
                        <Icon name="link" size={24} color="#FFFFFF" />
                        <Text style={styles.shareOptionText}>Copy Link</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function FeedCard({ 
    post, 
    onLike, 
    onFollow, 
    onView,
    onComment,
    onShare,
    onReclip,
    onBookmark,
    onPostPress,
    onAvatarPress,
    onStoryPress,
    isCurrentUser 
}: { 
    post: Post; 
    onLike: () => Promise<void>;
    onFollow?: () => Promise<void>;
    onView: () => Promise<void>;
    onComment: () => void;
    onShare: () => Promise<void>;
    onReclip: () => Promise<void>;
    onBookmark: () => Promise<void>;
    onPostPress?: () => void;
    onAvatarPress?: () => void;
    onStoryPress?: () => void;
    isCurrentUser: boolean;
}) {
    return (
        <TouchableOpacity 
            style={styles.feedCard}
            onPress={onPostPress}
            activeOpacity={0.95}
        >
            <PostHeader 
                post={post} 
                onFollow={onFollow} 
                isCurrentUser={isCurrentUser}
                onAvatarPress={onAvatarPress}
                onStoryPress={onStoryPress}
            />
            
            {post.mediaUrl && (
                <Image 
                    source={{ uri: post.mediaUrl }} 
                    style={styles.postImage}
                    onLoad={onView}
                />
            )}

            {post.text && (
                <View style={styles.textCardWrapper}>
                    <View style={styles.textCard}>
                        <View style={styles.textCardDecorativeLine} />
                        <Text style={styles.textCardContent}>{post.text}</Text>
                        <View style={styles.textCardDecorativeLine} />
                    </View>
                    <View style={styles.textCardTail} />
                </View>
            )}

            <View style={styles.engagementBar}>
                <View style={styles.actionButtons}>
                    <TouchableOpacity onPress={onLike} style={styles.actionButton}>
                        <Icon 
                            name={post.userLiked ? "heart" : "heart-outline"} 
                            size={18} 
                            color={post.userLiked ? "#EF4444" : "#6B7280"} 
                        />
                        <Text style={styles.actionText}>{post.stats.likes}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onComment} style={styles.actionButton}>
                        <Icon name="chatbubble-outline" size={18} color="#6B7280" />
                        <Text style={styles.actionText}>{post.stats.comments}</Text>
                    </TouchableOpacity>

                    {!isCurrentUser && (
                        <TouchableOpacity onPress={onReclip} style={styles.actionButton}>
                            <Icon name="repeat" size={18} color={post.userReclipped ? "#8B5CF6" : "#6B7280"} />
                            <Text style={styles.actionText}>{post.stats.reclips}</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={onShare} style={styles.actionButton}>
                        <Icon name="share-outline" size={18} color="#6B7280" />
                    </TouchableOpacity>

                    <View style={styles.viewsContainer}>
                        <Icon name="eye-outline" size={16} color="#6B7280" />
                        <Text style={styles.actionText}>{post.stats.views}</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={onBookmark}>
                    <Icon
                        name={post.isBookmarked ? "bookmark" : "bookmark-outline"}
                        size={18}
                        color={post.isBookmarked ? "#8B5CF6" : "#6B7280"}
                    />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

const FeedScreen: React.FC = ({ navigation }: any) => {
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    const defaultNational = user?.national || 'Ireland';
    const defaultRegional = user?.regional || 'Dublin';

    const [active, setActive] = useState<Tab>(defaultNational);
    const [pages, setPages] = useState<Post[][]>([]);
    const [cursor, setCursor] = useState<number | null>(0);
    const [loading, setLoading] = useState(false);
    const [end, setEnd] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showFollowingFeed, setShowFollowingFeed] = useState(false);
    const [commentsModalOpen, setCommentsModalOpen] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
    const requestTokenRef = useRef(0);

    const currentFilter = showFollowingFeed ? 'discover' : active;

    // Helper to update a post in pages
    const updatePost = (postId: string, updater: (post: Post) => Post) => {
        setPages(prev => prev.map(page => 
            page.map(p => p.id === postId ? updater(p) : p)
        ));
    };

    useEffect(() => {
        if (user?.national) {
            const oldTabs = ['Finglas', 'Dublin', 'Ireland'];
            if (oldTabs.includes(active)) {
                setActive(user.national);
            }
        }
    }, [user?.national, user?.regional, user?.local]);

    useEffect(() => {
        setPages([]);
        setCursor(0);
        setEnd(false);
        requestTokenRef.current++;
    }, [userId, currentFilter]);

    useEffect(() => {
        if (cursor !== null && pages.length === 0) {
            loadMore();
        }
    }, [cursor, currentFilter]);

    async function loadMore() {
        if (loading || end || cursor === null) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const token = requestTokenRef.current;
            const page = await fetchPostsPage(
                currentFilter,
                cursor,
                5,
                userId,
                user?.local || '',
                user?.regional || '',
                user?.national || ''
            );
            
            if (token !== requestTokenRef.current) {
                return;
            }

            if (page.posts.length === 0) {
                setEnd(true);
            } else {
                setPages(prev => [...prev, page.posts]);
                setCursor(page.nextCursor);
            }
        } catch (err) {
            console.error('Error loading feed:', err);
            setError('Failed to load feed');
        } finally {
            setLoading(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        setPages([]);
        setCursor(0);
        setEnd(false);
        requestTokenRef.current++;
        await loadMore();
        setRefreshing(false);
    };

    const handleTabChange = (tab: Tab) => {
        if (tab === 'Discover') {
            navigation.navigate('Discover');
            return;
        }
        if (tab === 'Clips') {
            navigation.navigate('Stories');
            return;
        }
        if (tab === 'Following') {
            setShowFollowingFeed(true);
            setActive('Following'); // Set active to Following so it's highlighted
        } else {
            setShowFollowingFeed(false);
            setActive(tab);
        }
    };

    const flat = pages.flat();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Clips</Text>
            </View>

            <PillTabs
                active={showFollowingFeed ? 'Following' : active}
                onChange={handleTabChange}
                userRegional={defaultRegional}
                userNational={defaultNational}
            />

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <FlatList
                data={flat}
                renderItem={({ item: post }) => (
                    <FeedCard
                        post={post}
                        onLike={async () => {
                            const updated = await toggleLike(userId, post.id);
                            // Update local state - find and update the post
                            setPages(prev => prev.map(page => 
                                page.map(p => p.id === post.id ? updated : p)
                            ));
                        }}
                        onFollow={async () => {
                            if (!user) return;
                            const updated = await toggleFollowForPost(userId, post.id);
                            // Refresh feed if viewing following feed
                            if (showFollowingFeed || currentFilter.toLowerCase() === 'discover') {
                                setPages([]);
                                setCursor(0);
                                setEnd(false);
                                setError(null);
                                requestTokenRef.current++;
                                setTimeout(() => {
                                    loadMore();
                                }, 200);
                            }
                        }}
                        onView={async () => {
                            await incrementViews(userId, post.id);
                        }}
                        onComment={() => {
                            setSelectedPostId(post.id);
                            setCommentsModalOpen(true);
                        }}
                        onShare={async () => {
                            setSelectedPostForShare(post);
                            setShareModalOpen(true);
                            try {
                                await incrementShares(userId, post.id);
                                updatePost(post.id, p => ({
                                    ...p,
                                    stats: { ...p.stats, shares: p.stats.shares + 1 }
                                }));
                            } catch (err) {
                                console.error('Error sharing post:', err);
                            }
                        }}
                        onReclip={async () => {
                            if (!user || post.userHandle === user.handle) {
                                Alert.alert('Cannot reclip', 'You cannot reclip your own post');
                                return;
                            }
                            if (post.userReclipped) {
                                Alert.alert('Already reclipped', 'You have already reclipped this post');
                                return;
                            }
                            try {
                                const { originalPost, reclippedPost } = await reclipPost(userId, post.id, user.handle);
                                updatePost(post.id, p => ({
                                    ...p,
                                    userReclipped: originalPost.userReclipped,
                                    stats: originalPost.stats
                                }));
                                if (reclippedPost) {
                                    // Add reclipped post to feed
                                    setPages(prev => [[reclippedPost], ...prev]);
                                }
                            } catch (err: any) {
                                Alert.alert('Error', err.message || 'Failed to reclip post');
                            }
                        }}
                        onBookmark={async () => {
                            try {
                                const updated = await toggleBookmark(userId, post.id);
                                updatePost(post.id, _p => updated);
                            } catch (err) {
                                console.error('Error bookmarking post:', err);
                            }
                        }}
                        onPostPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                        onAvatarPress={() => navigation.navigate('ViewProfile', { handle: post.userHandle })}
                        onStoryPress={() => navigation.navigate('Stories', { openUserHandle: post.userHandle })}
                        isCurrentUser={user?.handle === post.userHandle}
                    />
                )}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                onEndReached={() => {
                    if (!loading && !end) {
                        loadMore();
                    }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#8B5CF6" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No posts found</Text>
                        </View>
                    ) : null
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedContent}
            />

            {/* Comments Modal */}
            <CommentsModal
                postId={selectedPostId || ''}
                isOpen={commentsModalOpen}
                onClose={() => {
                    setCommentsModalOpen(false);
                    setSelectedPostId(null);
                }}
                userId={userId}
            />

            {/* Share Modal */}
            <ShareModal
                post={selectedPostForShare}
                isOpen={shareModalOpen}
                onClose={() => {
                    setShareModalOpen(false);
                    setSelectedPostForShare(null);
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#030712',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    tabContainer: {
        backgroundColor: '#030712',
        paddingVertical: 8,
    },
    tabGrid: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        gap: 8,
    },
    tabButton: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    activeTabButton: {
        backgroundColor: '#000000',
    },
    inactiveTabButton: {
        backgroundColor: '#000000',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    inactiveTabText: {
        color: '#6B7280',
    },
    eyeIcon: {
        marginLeft: 2,
    },
    feedContent: {
        paddingBottom: 20,
    },
    feedCard: {
        backgroundColor: '#030712',
        marginBottom: 16,
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
    },
    postHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarWrapper: {
        position: 'relative',
        marginRight: 12,
    },
    avatarContainer: {
        position: 'relative',
    },
    storyBorder: {
        borderRadius: 18,
        padding: 2,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInner: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    followPlusButton: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        borderColor: '#030712',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    followCheckButton: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: '#030712',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    postHeaderInfo: {
        flex: 1,
    },
    userHandle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    postMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    locationText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    separator: {
        fontSize: 12,
        color: '#6B7280',
    },
    timeText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    postHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    locationButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    postImage: {
        width: '100%',
        height: 400,
        backgroundColor: '#111827',
    },
    textCardWrapper: {
        marginHorizontal: 16,
        marginVertical: 12,
        alignItems: 'center',
    },
    textCard: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    textCardDecorativeLine: {
        width: 2,
        height: 40,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    textCardContent: {
        flex: 1,
        fontSize: 16,
        color: '#000000',
    },
    textCardTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#FFFFFF',
        marginTop: -1,
    },
    engagementBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
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
        color: '#FFFFFF',
    },
    viewsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    errorContainer: {
        padding: 16,
        backgroundColor: '#FEE2E2',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
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
        paddingBottom: 20,
    },
    shareModalContent: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
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
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalLoading: {
        padding: 20,
    },
    commentsList: {
        flex: 1,
        padding: 16,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    commentContent: {
        flex: 1,
    },
    commentUser: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    commentText: {
        fontSize: 14,
        color: '#D1D5DB',
        marginBottom: 4,
    },
    commentTime: {
        fontSize: 12,
        color: '#6B7280',
    },
    commentInputContainer: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        alignItems: 'center',
        gap: 12,
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#1F2937',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 14,
        maxHeight: 100,
    },
    sendButton: {
        padding: 8,
    },
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    shareOptionText: {
        fontSize: 16,
        color: '#FFFFFF',
    },
});

export default FeedScreen;
