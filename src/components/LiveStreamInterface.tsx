import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    Dimensions,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RTCView } from 'react-native-webrtc';
import { useLiveStreaming } from '../hooks/useLiveStreaming';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LiveStreamInterfaceProps {
    location: string;
    onEndLive: () => void;
    sessionId?: string;
}

interface Comment {
    id: string;
    username: string;
    message: string;
    timestamp: number;
}

interface FloatingComment {
    id: string;
    username: string;
    message: string;
    timestamp: number;
    position: number;
}

const LiveStreamInterface: React.FC<LiveStreamInterfaceProps> = ({
    location,
    onEndLive,
    sessionId,
}) => {
    const {
        localStreamRef,
        remoteStreamRef,
        streamComments,
        viewerCounts,
        isStreaming,
        sendComment,
        sendReaction,
        stopStream,
    } = useLiveStreaming();

    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [viewerCount, setViewerCount] = useState(0);
    const [liveComments, setLiveComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [totalLikes, setTotalLikes] = useState(Math.floor(Math.random() * 1000) + 100);
    const [streamDuration, setStreamDuration] = useState(0);
    const [showComments, setShowComments] = useState(false);
    const [floatingComments, setFloatingComments] = useState<FloatingComment[]>([]);
    const [floatingHearts, setFloatingHearts] = useState<Array<{ id: string; timestamp: number; position: number }>>([]);

    const commentInputRef = useRef<TextInput>(null);
    const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const heartAnimationRef = useRef(new Animated.Value(0)).current;

    // Stream duration timer
    useEffect(() => {
        if (isStreaming) {
            durationIntervalRef.current = setInterval(() => {
                setStreamDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
        }

        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
        };
    }, [isStreaming]);

    // Format duration
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle comment submission
    const handleSendComment = async () => {
        if (!newComment.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Add to local comments
            const comment: Comment = {
                id: Date.now().toString(),
                username: 'You',
                message: newComment.trim(),
                timestamp: Date.now(),
            };

            setLiveComments(prev => [...prev, comment]);

            // Add to floating comments
            const floatingComment: FloatingComment = {
                ...comment,
                position: Math.random() * (screenWidth - 200) + 100,
            };

            setFloatingComments(prev => [...prev, floatingComment]);

            // Remove floating comment after 5 seconds
            setTimeout(() => {
                setFloatingComments(prev => prev.filter(c => c.id !== floatingComment.id));
            }, 5000);

            // Send to server
            sendComment(sessionId || 'current-stream', newComment.trim());

            setNewComment('');
        } catch (error) {
            console.error('Error sending comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle like
    const handleLike = () => {
        setTotalLikes(prev => prev + 1);

        // Add floating heart
        const heart = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            position: Math.random() * (screenWidth - 100) + 50,
        };

        setFloatingHearts(prev => [...prev, heart]);

        // Remove heart after 3 seconds
        setTimeout(() => {
            setFloatingHearts(prev => prev.filter(h => h.id !== heart.id));
        }, 3000);

        // Send reaction
        sendReaction(sessionId || 'current-stream', 'heart', heart.position, screenHeight / 2);
    };

    // Handle mute toggle
    const handleMuteToggle = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    // Handle camera toggle
    const handleCameraToggle = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOn(videoTrack.enabled);
            }
        }
    };

    // Handle end live
    const handleEndLive = () => {
        stopStream();
        onEndLive();
    };

    const renderFloatingComment = (comment: FloatingComment, index: number) => (
        <Animated.View
            key={comment.id}
            style={[
                styles.floatingComment,
                {
                    left: comment.position,
                    bottom: 200 + (index * 60),
                },
            ]}
        >
            <Text style={styles.floatingCommentText}>
                <Text style={styles.floatingCommentUsername}>{comment.username}: </Text>
                {comment.message}
            </Text>
        </Animated.View>
    );

    const renderFloatingHeart = (heart: { id: string; position: number }, index: number) => (
        <Animated.View
            key={heart.id}
            style={[
                styles.floatingHeart,
                {
                    left: heart.position,
                    bottom: 100 + (index * 40),
                },
            ]}
        >
            <Icon name="heart" size={24} color="#EF4444" />
        </Animated.View>
    );

    const renderComment = ({ item }: { item: Comment }) => (
        <View style={styles.commentItem}>
            <Text style={styles.commentText}>
                <Text style={styles.commentUsername}>{item.username}: </Text>
                {item.message}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Video Stream */}
            <View style={styles.videoContainer}>
                {localStreamRef.current ? (
                    <RTCView
                        style={styles.video}
                        streamURL={localStreamRef.current.toURL()}
                        mirror={true}
                    />
                ) : (
                    <View style={styles.placeholderVideo}>
                        <Icon name="videocam-off" size={64} color="#6B7280" />
                        <Text style={styles.placeholderText}>Camera not available</Text>
                    </View>
                )}

                {/* Floating Comments */}
                {floatingComments.map(renderFloatingComment)}

                {/* Floating Hearts */}
                {floatingHearts.map(renderFloatingHeart)}

                {/* Top Status Bar */}
                <View style={styles.topStatusBar}>
                    {/* Exit Button */}
                    <TouchableOpacity style={styles.exitButton} onPress={handleEndLive}>
                        <Icon name="close" size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Location & Duration */}
                    <View style={styles.locationDurationContainer}>
                        <Text style={styles.locationText}>{location}</Text>
                        <Text style={styles.durationText}>{formatDuration(streamDuration)}</Text>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Icon name="eye" size={12} color="#FFFFFF" />
                            <Text style={styles.statText}>{viewerCount}</Text>
                        </View>
                    </View>
                </View>

                {/* Control Panel */}
                <View style={styles.controlPanel}>
                    {/* Like Button */}
                    <TouchableOpacity style={styles.controlButton} onPress={handleLike}>
                        <Icon name="heart" size={24} color="#EF4444" />
                    </TouchableOpacity>

                    {/* Camera Toggle */}
                    <TouchableOpacity style={styles.controlButton} onPress={handleCameraToggle}>
                        <Icon name={isCameraOn ? "videocam" : "videocam-off"} size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Mute Toggle */}
                    <TouchableOpacity style={styles.controlButton} onPress={handleMuteToggle}>
                        <Icon name={isMuted ? "mic-off" : "mic"} size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Comments Section */}
            {showComments && (
                <View style={styles.commentsSection}>
                    <View style={styles.commentsHeader}>
                        <Text style={styles.commentsTitle}>Comments</Text>
                        <TouchableOpacity onPress={() => setShowComments(false)}>
                            <Icon name="close" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={liveComments}
                        renderItem={renderComment}
                        keyExtractor={(item) => item.id}
                        style={styles.commentsList}
                        showsVerticalScrollIndicator={false}
                    />

                    <View style={styles.commentInputContainer}>
                        <TextInput
                            ref={commentInputRef}
                            style={styles.commentInput}
                            value={newComment}
                            onChangeText={setNewComment}
                            placeholder="Share your thoughts..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                            maxLength={200}
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
                            onPress={handleSendComment}
                            disabled={!newComment.trim() || isSubmitting}
                        >
                            <Icon name="send" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Comments Toggle Button */}
            {!showComments && (
                <TouchableOpacity
                    style={styles.commentsToggleButton}
                    onPress={() => setShowComments(true)}
                >
                    <Icon name="chatbubble" size={20} color="#FFFFFF" />
                    <Text style={styles.commentsToggleText}>{liveComments.length}</Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    videoContainer: {
        flex: 1,
        position: 'relative',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    placeholderVideo: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1F2937',
    },
    placeholderText: {
        color: '#6B7280',
        fontSize: 16,
        marginTop: 16,
    },
    topStatusBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    exitButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationDurationContainer: {
        alignItems: 'center',
    },
    locationText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    durationText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 2,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    controlPanel: {
        position: 'absolute',
        right: 16,
        bottom: 120,
        flexDirection: 'column',
        gap: 16,
    },
    controlButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    commentsSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 300,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    commentsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    commentsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    commentsList: {
        flex: 1,
        paddingHorizontal: 16,
    },
    commentItem: {
        paddingVertical: 8,
    },
    commentText: {
        fontSize: 14,
        color: '#374151',
    },
    commentUsername: {
        fontWeight: '600',
        color: '#111827',
    },
    commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 8,
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 14,
        color: '#111827',
        maxHeight: 80,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#8B5CF6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    commentsToggleButton: {
        position: 'absolute',
        right: 16,
        bottom: 80,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 4,
    },
    commentsToggleText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    floatingComment: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        maxWidth: 200,
    },
    floatingCommentText: {
        color: '#FFFFFF',
        fontSize: 14,
    },
    floatingCommentUsername: {
        fontWeight: '600',
    },
    floatingHeart: {
        position: 'absolute',
    },
});

export default LiveStreamInterface;
