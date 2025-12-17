import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { getPostById, toggleLike, toggleBookmark, incrementViews } from '../api/posts';
import { timeAgo } from '../utils/timeAgo';
import type { Post } from '../types';
import Avatar from '../components/Avatar';

export default function PostDetailScreen({ route, navigation }: any) {
    const { postId } = route.params;
    const { user } = useAuth();
    const userId = user?.id ?? 'anon';
    
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPost();
    }, [postId]);

    const loadPost = async () => {
        try {
            const loadedPost = await getPostById(postId);
            setPost(loadedPost);
            if (loadedPost) {
                await incrementViews(userId, postId);
            }
        } catch (err) {
            console.error('Error loading post:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        if (!post) return;
        try {
            const updated = await toggleLike(userId, post.id);
            setPost(updated);
        } catch (err) {
            console.error('Error liking post:', err);
        }
    };

    const handleBookmark = async () => {
        if (!post) return;
        try {
            const updated = await toggleBookmark(userId, post.id);
            setPost(updated);
        } catch (err) {
            console.error('Error bookmarking post:', err);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    if (!post) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Post not found</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.postHeader}>
                    <Avatar
                        src={undefined}
                        name={post.userHandle.split('@')[0]}
                        size={40}
                    />
                    <View style={styles.postHeaderInfo}>
                        <Text style={styles.userHandle}>{post.userHandle}</Text>
                        <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
                    </View>
                </View>

                {post.mediaUrl && (
                    <Image source={{ uri: post.mediaUrl }} style={styles.media} />
                )}

                {post.text && (
                    <View style={styles.textContainer}>
                        <Text style={styles.textContent}>{post.text}</Text>
                    </View>
                )}

                <View style={styles.engagementBar}>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                            <Icon
                                name={post.userLiked ? "heart" : "heart-outline"}
                                size={24}
                                color={post.userLiked ? "#EF4444" : "#FFFFFF"}
                            />
                            <Text style={styles.actionText}>{post.stats.likes}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton}>
                            <Icon name="chatbubble-outline" size={24} color="#FFFFFF" />
                            <Text style={styles.actionText}>{post.stats.comments}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton}>
                            <Icon name="share-outline" size={24} color="#FFFFFF" />
                            <Text style={styles.actionText}>{post.stats.shares}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleBookmark}>
                        <Icon
                            name={post.isBookmarked ? "bookmark" : "bookmark-outline"}
                            size={24}
                            color={post.isBookmarked ? "#8B5CF6" : "#FFFFFF"}
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>
                        {post.stats.views} views • {post.stats.reclips} reclips
                    </Text>
                </View>
            </ScrollView>
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
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    postHeaderInfo: {
        flex: 1,
    },
    userHandle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    timeText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    media: {
        width: '100%',
        height: 400,
        backgroundColor: '#111827',
    },
    textContainer: {
        padding: 16,
    },
    textContent: {
        fontSize: 16,
        color: '#F9FAFB',
        lineHeight: 24,
    },
    engagementBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 24,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statsContainer: {
        padding: 16,
        paddingTop: 0,
    },
    statsText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
        marginTop: 40,
    },
});







