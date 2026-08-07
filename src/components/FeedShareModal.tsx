import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import type { Post } from '../types';
import { buildShareablePostUrl } from '../utils/shareUrls';
import { useAuth } from '../context/Auth';
import { getFollowedUsers, incrementShares, regeneratePublicShareToken } from '../api/posts';
import Avatar from './Avatar.native';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_ABYSS } from '../utils/discoverAmbientPalette';

type Props = {
    post: Post | null;
    isOpen: boolean;
    onClose: () => void;
    /** Fired after a share is recorded (system share, copy link, etc.). */
    onShareSuccess?: (postId: string) => void;
};

export default function FeedShareModal({ post, isOpen, onClose, onShareSuccess }: Props) {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [followedHandles, setFollowedHandles] = useState<string[]>([]);
    const [loadingFollowed, setLoadingFollowed] = useState(false);
    const [regeneratingToken, setRegeneratingToken] = useState(false);

    const shareUrl = useMemo(() => (post ? buildShareablePostUrl(post) : ''), [post]);
    const shareMessage = useMemo(() => {
        if (!post) return '';
        const title = post.text?.trim()
            ? post.text.trim()
            : `Check out this post by ${post.userHandle}`;
        return `${title}\n${shareUrl}`;
    }, [post, shareUrl]);

    useEffect(() => {
        if (!isOpen) return;
        setSearchQuery('');

        if (!user?.id) {
            setFollowedHandles([]);
            return;
        }

        setLoadingFollowed(true);
        getFollowedUsers(String(user.id))
            .then((handles) => setFollowedHandles(handles))
            .catch(() => setFollowedHandles([]))
            .finally(() => setLoadingFollowed(false));
    }, [isOpen, user?.id]);

    const filteredHandles = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return followedHandles;
        return followedHandles.filter((h) => h.toLowerCase().includes(q));
    }, [followedHandles, searchQuery]);

    const recordShare = async () => {
        if (!post?.id || !user?.id) return;
        try {
            await incrementShares(String(user.id), String(post.id));
            onShareSuccess?.(String(post.id));
        } catch (err) {
            console.warn('incrementShares failed:', err);
        }
    };

    const handleShareSystem = async () => {
        if (!post) return;
        try {
            const result = await Share.share({
                message: shareMessage,
                url: post.mediaUrl || shareUrl,
            });
            // iOS: sharedAction vs dismissedAction is reliable.
            // Android: Share often resolves sharedAction even on dismiss — only count
            // when an activityType is present (some OEMs) or skip auto-count.
            if (result.action === Share.sharedAction) {
                if (Platform.OS === 'ios' || result.activityType) {
                    await recordShare();
                }
            }
        } catch (err: unknown) {
            console.error('Error sharing:', err);
        } finally {
            onClose();
        }
    };

    const handleCopyLink = async () => {
        if (!post) return;
        try {
            await Clipboard.setString(shareUrl);
            await recordShare();
            Alert.alert('Link copied', 'Post link copied to clipboard.');
        } catch (err) {
            console.error('Clipboard failed:', err);
            Alert.alert('Could not copy', 'Please try again.');
        } finally {
            onClose();
        }
    };

    const handleResetSharedLink = async () => {
        if (!post?.id || regeneratingToken) return;
        setRegeneratingToken(true);
        try {
            const updated = await regeneratePublicShareToken(String(post.id));
            if (!updated?.url) {
                Alert.alert('Could not reset link', 'Try again in a moment.');
                return;
            }
            await Clipboard.setString(updated.url);
            Alert.alert('Shared link reset', 'New link copied to clipboard.');
        } catch (err) {
            console.warn('Reset shared link failed:', err);
            Alert.alert('Could not reset link', 'Try again in a moment.');
        } finally {
            setRegeneratingToken(false);
        }
    };

    const handleShareToApp = async (appLabel: string) => {
        // Native Share sheet does not reliably allow targeting a specific app across OEM builds.
        // We still match the web "Share to" row visually, and open the system share sheet.
        if (!post) return;
        try {
            const result = await Share.share({ message: shareMessage, url: post.mediaUrl || shareUrl });
            if (result.action === Share.sharedAction) {
                if (Platform.OS === 'ios' || result.activityType) {
                    await recordShare();
                }
            }
        } catch (err) {
            console.warn(`Share to ${appLabel} failed:`, err);
        } finally {
            onClose();
        }
    };

    if (!isOpen || !post) return null;

    return (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.shareModalShell}>
                    <PassportSheetCanvas contentStyle={styles.shareModalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Share</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchWrap}>
                        <Icon name="search" size={18} color="#9CA3AF" />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search"
                            placeholderTextColor="#6B7280"
                            style={styles.searchInput}
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.followListWrap}>
                        {loadingFollowed ? (
                            <Text style={styles.emptyText}>Loading…</Text>
                        ) : filteredHandles.length === 0 ? (
                            <Text style={styles.emptyText}>No people you follow yet</Text>
                        ) : (
                            filteredHandles.slice(0, 12).map((handle) => (
                                <TouchableOpacity
                                    key={handle}
                                    style={styles.followRow}
                                    activeOpacity={0.85}
                                    onPress={handleShareSystem}
                                >
                                    <Avatar
                                        src={undefined}
                                        name={handle.split('@')[0] || 'User'}
                                        size="sm"
                                    />
                                    <Text style={styles.followHandle} numberOfLines={1}>
                                        {handle}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>

                    <View style={styles.shareToHeader}>
                        <Text style={styles.shareToTitle}>SHARE TO</Text>
                        <TouchableOpacity
                            onPress={handleResetSharedLink}
                            disabled={regeneratingToken}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.resetLink, regeneratingToken && styles.resetLinkDisabled]}>
                                Reset shared link
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.shareToRow}>
                        <TouchableOpacity
                            style={styles.appIconBtn}
                            onPress={() => void handleShareToApp('WhatsApp')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.appIconCircle, styles.appWhatsApp]}>
                                <Icon name="logo-whatsapp" size={22} color="#FFFFFF" />
                            </View>
                            <Text style={styles.appLabel}>WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.appIconBtn}
                            onPress={() => void handleShareToApp('X')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.appIconCircle, styles.appX]}>
                                <Text style={styles.appXText}>X</Text>
                            </View>
                            <Text style={styles.appLabel}>X</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.appIconBtn}
                            onPress={() => void handleShareToApp('Facebook')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.appIconCircle, styles.appFacebook]}>
                                <Icon name="logo-facebook" size={22} color="#FFFFFF" />
                            </View>
                            <Text style={styles.appLabel}>Facebook</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.appIconBtn}
                            onPress={() => void handleShareToApp('Instagram')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.appIconCircle, styles.appInstagram]}>
                                <Icon name="logo-instagram" size={22} color="#FFFFFF" />
                            </View>
                            <Text style={styles.appLabel}>Instagram</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.appIconBtn}
                            onPress={() => void handleShareToApp('Threads')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.appIconCircle, styles.appThreads]}>
                                <Text style={styles.appThreadsText}>@</Text>
                            </View>
                            <Text style={styles.appLabel}>Threads</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleShareSystem} style={styles.shareOption}>
                        <Icon name="share-social" size={22} color="#FFFFFF" />
                        <Text style={styles.shareOptionText}>Share via…</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCopyLink} style={styles.shareOption}>
                        <Icon name="link" size={22} color="#FFFFFF" />
                        <Text style={styles.shareOptionText}>Copy link</Text>
                    </TouchableOpacity>
                    </PassportSheetCanvas>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    shareModalShell: {
        backgroundColor: PASSPORT_ABYSS,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        maxHeight: '85%',
    },
    shareModalContent: {
        padding: 20,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    searchWrap: {
        marginTop: 14,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(31,41,55,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(55,65,81,0.85)',
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        paddingVertical: 0,
    },
    followListWrap: {
        minHeight: 92,
        borderRadius: 14,
        backgroundColor: 'rgba(17,24,39,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(55,65,81,0.75)',
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    emptyText: {
        paddingVertical: 18,
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '500',
    },
    followRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    followHandle: {
        flex: 1,
        color: '#E5E7EB',
        fontSize: 14,
        fontWeight: '600',
    },
    shareToHeader: {
        marginTop: 18,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    shareToTitle: {
        color: '#9CA3AF',
        fontSize: 12,
        letterSpacing: 1.2,
        fontWeight: '700',
    },
    resetLink: {
        color: '#60A5FA',
        fontSize: 13,
        fontWeight: '600',
    },
    resetLinkDisabled: {
        opacity: 0.55,
    },
    shareToRow: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    appIconBtn: {
        alignItems: 'center',
        width: 64,
    },
    appIconCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
    },
    appLabel: {
        marginTop: 8,
        color: '#D1D5DB',
        fontSize: 11,
        fontWeight: '600',
    },
    appWhatsApp: { backgroundColor: '#22C55E' },
    appX: { backgroundColor: '#111827' },
    appFacebook: { backgroundColor: '#2563EB' },
    appInstagram: { backgroundColor: '#EC4899' },
    appThreads: { backgroundColor: '#111827' },
    appXText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    appThreadsText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
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
