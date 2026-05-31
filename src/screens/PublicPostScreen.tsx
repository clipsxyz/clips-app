import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import FeedPostMedia from '../components/FeedPostMedia.native';
import Avatar from '../components/Avatar.native';
import { useAuth } from '../context/Auth';
import { loadSharedPost } from '../api/posts';
import { FEED_UI } from '../constants/feedUiTokens';
import { getInstagramImageDimensions, isLikelyImageUri } from '../utils/imageDimensions';
import { timeAgo } from '../utils/timeAgo';
import type { Post } from '../types';
import { glassPanel, glassSurface, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';

export default function PublicPostScreen({ navigation, route }: any) {
    const token: string | undefined = route?.params?.token;
    const postId: string | undefined = route?.params?.id ?? route?.params?.postId;
    const { user } = useAuth();

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mediaHeight, setMediaHeight] = useState(Dimensions.get('window').width * FEED_UI.media.maxAspect);

    const screenWidth = Dimensions.get('window').width;

    const loadPost = useCallback(async () => {
        if (!token && !postId) {
            setError('Missing share link.');
            setPost(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await loadSharedPost({
                token,
                postId: postId ? String(postId) : undefined,
                userId: user?.id,
            });
            if (!result) {
                setError('This shared post is unavailable.');
                setPost(null);
            } else {
                setPost(result);
            }
        } catch (err) {
            console.warn('PublicPostScreen load failed:', err);
            setError('Could not load this post. Check your connection and try again.');
            setPost(null);
        } finally {
            setLoading(false);
        }
    }, [token, postId, user?.id]);

    useEffect(() => {
        void loadPost();
    }, [loadPost]);

    const mediaSizingUrl = useMemo(() => {
        if (!post || isTextOnlyPost(post)) return null;
        if (isVideoPost(post) && post.videoPosterUrl) return post.videoPosterUrl;
        return post.mediaUrl || post.mediaItems?.[0]?.url || null;
    }, [post]);

    useEffect(() => {
        if (!mediaSizingUrl || !isLikelyImageUri(mediaSizingUrl)) {
            setMediaHeight(screenWidth * FEED_UI.media.maxAspect);
            return;
        }
        Image.getSize(
            mediaSizingUrl,
            (width, height) => {
                const dimensions = getInstagramImageDimensions(width, height, screenWidth - 32);
                const minHeight = screenWidth * FEED_UI.media.minAspect;
                const maxHeight = screenWidth * FEED_UI.media.maxAspect;
                setMediaHeight(Math.min(Math.max(dimensions.height, minHeight), maxHeight));
            },
            () => {
                setMediaHeight(screenWidth * FEED_UI.media.maxAspect);
            },
        );
    }, [mediaSizingUrl, screenWidth]);

    const captionText = useMemo(() => {
        if (!post) return '';
        if (post.text?.trim()) return post.text.trim();
        if (post.caption?.trim()) return post.caption.trim();
        return '';
    }, [post]);

    const goToAuth = (mode: 'signup' | 'login') => {
        navigation.navigate('Login', { mode });
    };

    const openFullPost = () => {
        if (!post) return;
        navigation.navigate('PostDetail', { postId: post.id });
    };

    const openAuthorProfile = () => {
        if (!post?.userHandle || !user) {
            goToAuth('login');
            return;
        }
        navigation.navigate('ViewProfile', { handle: post.userHandle });
    };

    if (loading) {
        return (
            <GazetteerScreenShell contentStyle={styles.centered}>
                <ActivityIndicator size="large" color="#f472b6" />
                <Text style={styles.loadingText}>Loading post…</Text>
            </GazetteerScreenShell>
        );
    }

    if (error || !post) {
        return (
            <GazetteerScreenShell contentStyle={styles.centered}>
                <Icon name="alert-circle-outline" size={40} color="#F87171" />
                <Text style={styles.errorTitle}>Post not available</Text>
                <Text style={styles.errorBody}>{error || 'This shared post could not be loaded.'}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.replace('Landing')}>
                    <Text style={styles.primaryBtnText}>Go to landing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => void loadPost()}>
                    <Text style={styles.secondaryBtnText}>Try again</Text>
                </TouchableOpacity>
            </GazetteerScreenShell>
        );
    }

    const textOnlyPost = isTextOnlyPost(post);
    const hasPostMedia =
        textOnlyPost || Boolean(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0));
    const cardWidth = screenWidth - 32;

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Shared post</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.authorRow} onPress={openAuthorProfile} activeOpacity={0.85}>
                        <Avatar src={undefined} name={post.userHandle.split('@')[0] || 'User'} size={40} />
                        <View style={styles.authorMeta}>
                            <Text style={styles.authorHandle}>{post.userHandle}</Text>
                            {post.createdAt ? (
                                <Text style={styles.authorTime}>{timeAgo(post.createdAt)}</Text>
                            ) : null}
                            {post.locationLabel ? (
                                <Text style={styles.authorLocation} numberOfLines={1}>
                                    {post.locationLabel}
                                    {post.venue ? ` · ${post.venue}` : ''}
                                </Text>
                            ) : null}
                        </View>
                    </TouchableOpacity>

                    {hasPostMedia ? (
                        <View style={styles.mediaWrap}>
                            <FeedPostMedia
                                post={post}
                                width={cardWidth}
                                height={textOnlyPost ? cardWidth * 0.5 : mediaHeight}
                                mode="detail"
                            />
                        </View>
                    ) : null}

                    {!textOnlyPost && captionText ? (
                        <Text style={styles.caption}>{captionText}</Text>
                    ) : null}

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Icon name="heart-outline" size={18} color="#9CA3AF" />
                            <Text style={styles.statText}>{post.stats.likes}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Icon name="chatbubble-outline" size={18} color="#9CA3AF" />
                            <Text style={styles.statText}>{post.stats.comments}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Icon name="share-outline" size={18} color="#9CA3AF" />
                            <Text style={styles.statText}>{post.stats.shares}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Icon name="eye-outline" size={18} color="#9CA3AF" />
                            <Text style={styles.statText}>{post.stats.views}</Text>
                        </View>
                    </View>
                </View>

                {user ? (
                    <View style={styles.ctaCard}>
                        <Text style={styles.ctaTitle}>You are signed in</Text>
                        <Text style={styles.ctaBody}>Open the full post to like, comment, and share.</Text>
                        <TouchableOpacity style={styles.primaryBtn} onPress={openFullPost}>
                            <Text style={styles.primaryBtnText}>View full post</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => navigation.replace('MainTabs', { screen: 'Home' })}
                        >
                            <Text style={styles.secondaryBtnText}>Go to feed</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.ctaCard}>
                        <Text style={styles.ctaTitle}>Join Gazetteer</Text>
                        <Text style={styles.ctaBody}>
                            Sign up to like, comment, follow, and keep exploring.
                        </Text>
                        <View style={styles.ctaActions}>
                            <TouchableOpacity style={styles.primaryBtn} onPress={() => goToAuth('signup')}>
                                <Text style={styles.primaryBtnText}>Sign up</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => goToAuth('login')}>
                                <Text style={styles.secondaryBtnText}>Log in</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 12,
    },
    loadingText: {
        color: '#9CA3AF',
        fontSize: 14,
        marginTop: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        ...gazetteerHeader,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 28,
        gap: 14,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        ...glassPanel,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    authorMeta: {
        flex: 1,
        gap: 2,
    },
    authorHandle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    authorTime: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    authorLocation: {
        color: '#D1D5DB',
        fontSize: 12,
        marginTop: 2,
    },
    mediaWrap: {
        width: '100%',
        backgroundColor: '#000000',
    },
    media: {
        width: '100%',
        minHeight: 240,
        maxHeight: 520,
        backgroundColor: '#000000',
    },
    caption: {
        paddingHorizontal: 14,
        paddingBottom: 12,
        color: '#F3F4F6',
        fontSize: 15,
        lineHeight: 22,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        color: '#D1D5DB',
        fontSize: 13,
        fontWeight: '600',
    },
    ctaCard: {
        borderRadius: 14,
        padding: 16,
        ...glassPanel,
    },
    ctaTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    ctaBody: {
        marginTop: 6,
        color: '#D1D5DB',
        fontSize: 13,
        lineHeight: 19,
    },
    ctaActions: {
        marginTop: 14,
        flexDirection: 'row',
        gap: 10,
    },
    primaryBtn: {
        flex: 1,
        backgroundColor: '#d91b5c',
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    secondaryBtn: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        ...glassSurface,
    },
    secondaryBtnText: {
        color: '#E5E7EB',
        fontSize: 14,
        fontWeight: '600',
    },
    errorTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    errorBody: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
