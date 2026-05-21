import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { incrementShares } from '../api/posts';
import { buildSharePostToStoriesPayload } from '../utils/sharePostToStories';
import { emitStoriesRefresh } from '../utils/storiesRefreshNative';
import type { Post } from '../types';
import ShareToStoriesFeedIcon from './ShareToStoriesFeedIcon.native';
import ShareTextStoryCapture, {
    type ShareTextStoryCaptureHandle,
} from './ShareTextStoryCapture.native';

type Props = {
    visible: boolean;
    post: Post | null;
    onClose: () => void;
    onShareSuccess?: (postId: string) => void;
};

export default function ShareToStoriesModal({ visible, post, onClose, onShareSuccess }: Props) {
    const { user } = useAuth();
    const [isSharing, setIsSharing] = useState(false);
    const textCaptureRef = useRef<ShareTextStoryCaptureHandle>(null);

    const handleShare = async () => {
        if (!user?.id || !post) {
            Alert.alert('Sign in required', 'Please sign in to share to Stories.');
            return;
        }

        setIsSharing(true);
        onShareSuccess?.(post.id);

        try {
            let payload = buildSharePostToStoriesPayload(post);

            if (!payload.mediaUrl && !payload.isTextOnlyShare) {
                const generated = await textCaptureRef.current?.capture(payload.shareText || '');
                if (!generated) {
                    Alert.alert(
                        'Stories',
                        'Could not prepare an image for this post. Please try again.',
                    );
                    return;
                }
                payload = { ...payload, mediaUrl: generated, mediaType: 'image' };
            }

            onClose();

            await createStory(
                user.id,
                user.handle || '',
                payload.mediaUrl,
                payload.mediaType,
                payload.shareText,
                payload.locationLabel,
                undefined,
                undefined,
                payload.sharedFromPost,
                payload.sharedFromUser,
                payload.textStyle,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                payload.venue,
            );

            try {
                await incrementShares(user.id, post.id);
            } catch {
                // UI already updated optimistically
            }

            emitStoriesRefresh();
            Alert.alert('Stories', 'Successfully shared to Stories 24!');
        } catch (e) {
            console.error('Failed to share to stories:', e);
            Alert.alert('Stories', 'Failed to share to Stories 24. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    if (!visible || !post) return null;

    return (
        <>
            <ShareTextStoryCapture ref={textCaptureRef} />
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
                    <View style={styles.iconWrap}>
                        <ShareToStoriesFeedIcon size={52} color="#FFFFFF" />
                    </View>
                    <Text style={styles.kicker}>Gazetteer says</Text>
                    <Text style={styles.title}>Share this post to your stories</Text>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={onClose}
                            disabled={isSharing}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.okBtn, isSharing && styles.okBtnDisabled]}
                            onPress={() => void handleShare()}
                            disabled={isSharing}
                        >
                            {isSharing ? (
                                <ActivityIndicator color="#000000" />
                            ) : (
                                <Text style={styles.okText}>OK</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: '#000000',
        padding: 24,
    },
    iconWrap: {
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    kicker: {
        textAlign: 'center',
        color: '#D4AF37',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    title: {
        textAlign: 'center',
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 24,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    okBtn: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        alignItems: 'center',
    },
    okBtnDisabled: {
        opacity: 0.5,
    },
    okText: {
        color: '#000000',
        fontWeight: '600',
    },
});
