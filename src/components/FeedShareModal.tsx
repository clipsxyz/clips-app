import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import type { Post } from '../types';
import { buildShareablePostUrl } from '../utils/shareUrls';
import { useAuth } from '../context/Auth';
import { getFollowedUsers, incrementShares, regeneratePublicShareToken } from '../api/posts';
import { appendMessage } from '../api/messages';
import * as apiClient from '../api/client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { ox } from '../constants/nativeOpticalScale';
import Avatar from './Avatar.native';
import DiscoverSheetCanvas from './DiscoverSheetCanvas.native';
import {
    UCL_CANVAS_NAVY,
    UCL_TEXT_ACTIVE,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
    UCL_TEXT_SECONDARY,
} from '../theme/gazetteerAmbientNative';

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
    const [shareCaption, setShareCaption] = useState('');
    const [followedHandles, setFollowedHandles] = useState<string[]>([]);
    const [loadingFollowed, setLoadingFollowed] = useState(false);
    const [regeneratingToken, setRegeneratingToken] = useState(false);
    /** Instagram-style multi-select: tapping a person toggles selection; the
     * send happens only from the bottom composer bar's Send button. */
    const [selectedHandles, setSelectedHandles] = useState<string[]>([]);
    const [sending, setSending] = useState(false);

    const toggleSelect = (handle: string) => {
        setSelectedHandles((prev) =>
            prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle],
        );
    };

    /** Composer elevation: springs up the moment a recipient is selected so the
     * input feels attached to the selection, and settles back when cleared. */
    const sendBarAnim = React.useRef(new Animated.Value(0)).current;
    const hasSelection = selectedHandles.length > 0;
    useEffect(() => {
        Animated.spring(sendBarAnim, {
            toValue: hasSelection ? 1 : 0,
            friction: 9,
            tension: 140,
            useNativeDriver: true,
        }).start();
    }, [hasSelection, sendBarAnim]);

    const sendBarStyle = {
        opacity: sendBarAnim,
        transform: [
            {
                translateY: sendBarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                }),
            },
            {
                scale: sendBarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                }),
            },
        ],
    };

    const selectedLabel = selectedHandles
        .map((h) => h.split('@')[0])
        .join(', ');

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
        setShareCaption('');
        setSelectedHandles([]);

        if (!user?.id) {
            setFollowedHandles([]);
            return;
        }

        setLoadingFollowed(true);
        const setFromLocal = () => {
            getFollowedUsers(String(user.id))
                .then(setFollowedHandles)
                .catch(() => setFollowedHandles([]))
                .finally(() => setLoadingFollowed(false));
        };

        if (isLaravelApiEnabled() && user?.handle) {
            apiClient
                .fetchFollowing(user.handle, 0, 100)
                .then((res) => {
                    const apiHandles = (res?.items ?? [])
                        .map((u: any) => u?.handle ?? u?.user_handle ?? String(u))
                        .filter(Boolean) as string[];
                    return getFollowedUsers(String(user.id)).then((localHandles) => {
                        const merged = [...new Set([...apiHandles, ...localHandles])];
                        setFollowedHandles(merged.length ? merged : apiHandles);
                    });
                })
                .catch((err) => {
                    console.warn('FeedShareModal: fetchFollowing failed, using local list', err);
                    setFromLocal();
                    return;
                })
                .finally(() => setLoadingFollowed(false));
        } else {
            setFromLocal();
        }
    }, [isOpen, user?.id, user?.handle]);

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

    /**
     * Unified dispatch for the selected recipients: every selected user gets the
     * same message — the custom caption as text plus the structured
     * `sourcePostId` (persisted server-side, rendered as the post card in the
     * thread). With no caption, fall back to the share URL as before.
     */
    const handleSendSelected = async () => {
        if (!post?.id || !user?.handle || sending || selectedHandles.length === 0) return;
        setSending(true);
        const caption = shareCaption.trim();
        const recipients = [...selectedHandles];
        let sentCount = 0;
        try {
            for (const recipientHandle of recipients) {
                await appendMessage(user.handle, recipientHandle, {
                    text: caption || shareUrl,
                    sourcePostId: String(post.id),
                });
                sentCount += 1;
            }
            await recordShare();
            const confirmation =
                sentCount === 1
                    ? `Sent to ${recipients[0].split('@')[0] || recipients[0]}`
                    : `Sent to ${sentCount} people`;
            if (Platform.OS === 'android') {
                ToastAndroid.show(confirmation, ToastAndroid.SHORT);
            } else {
                Alert.alert(confirmation);
            }
            setShareCaption('');
            setSelectedHandles([]);
            onClose();
        } catch (err) {
            console.error('Send post to DM failed:', err);
            Alert.alert(
                'Could not send',
                sentCount > 0
                    ? `Sent to ${sentCount} of ${recipients.length}. Please try again for the rest.`
                    : 'Please try again.',
            );
        } finally {
            setSending(false);
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
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent
            statusBarTranslucent
            presentationStyle="overFullScreen"
            hardwareAccelerated
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <View style={styles.shareModalShell}>
                    <DiscoverSheetCanvas tone="ucl" contentStyle={styles.shareModalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Share</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color={UCL_TEXT_PRIMARY} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchWrap}>
                        <Icon name="search" size={18} color={UCL_TEXT_PLACEHOLDER} style={styles.searchIcon} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search"
                            placeholderTextColor={UCL_TEXT_PLACEHOLDER}
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
                            filteredHandles.map((handle) => {
                                const selected = selectedHandles.includes(handle);
                                return (
                                <TouchableOpacity
                                    key={handle}
                                    style={[styles.followRow, selected && styles.followRowSelected]}
                                    activeOpacity={0.85}
                                    disabled={sending}
                                    onPress={() => toggleSelect(handle)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: selected }}
                                    accessibilityLabel={`Send to ${handle}`}
                                >
                                    <View style={styles.avatarWrap}>
                                        <Avatar
                                            src={undefined}
                                            name={handle.split('@')[0] || 'User'}
                                            size="sm"
                                            cornerRadius={ox(12)}
                                        />
                                        {selected ? (
                                            <View style={styles.selectedBadge}>
                                                <Icon name="checkmark" size={ox(11)} color="#FFFFFF" />
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={styles.followHandle} numberOfLines={1}>
                                        {handle}
                                    </Text>
                                    {selected ? (
                                        <Icon name="checkmark-circle" size={ox(20)} color={UCL_TEXT_PRIMARY} />
                                    ) : (
                                        <Icon name="ellipse-outline" size={ox(20)} color={UCL_TEXT_PLACEHOLDER} />
                                    )}
                                </TouchableOpacity>
                                );
                            })
                        )}
                    </View>

                    {hasSelection ? (
                        <Animated.View style={[styles.sendBar, sendBarStyle]}>
                            <Text style={styles.sendBarLabel} numberOfLines={1}>
                                To: {selectedLabel}
                            </Text>
                            <View style={styles.composerRow}>
                                <TextInput
                                    value={shareCaption}
                                    onChangeText={setShareCaption}
                                    placeholder="Include message..."
                                    placeholderTextColor={UCL_TEXT_PLACEHOLDER}
                                    style={styles.captionInput}
                                    multiline
                                    maxLength={1000}
                                    autoCorrect
                                />
                                <TouchableOpacity
                                    style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                                    onPress={() => void handleSendSelected()}
                                    disabled={sending}
                                    activeOpacity={0.85}
                                    accessibilityLabel={`Send to ${selectedHandles.length} selected`}
                                >
                                    <Text style={styles.sendButtonText}>
                                        {sending
                                            ? 'Sending…'
                                            : selectedHandles.length === 1
                                              ? 'Send'
                                              : `Send to ${selectedHandles.length}`}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    ) : null}

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

                    <ScrollView
                        horizontal
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsHorizontalScrollIndicator={false}
                        bounces
                        style={styles.shareToScroll}
                        contentContainerStyle={styles.shareToRow}
                    >
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
                    </ScrollView>

                    <TouchableOpacity onPress={handleShareSystem} style={styles.shareOption}>
                        <Icon name="share-social" size={22} color={UCL_TEXT_PRIMARY} style={styles.listIcon} />
                        <Text style={styles.shareOptionText}>Share via…</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCopyLink} style={styles.shareOption}>
                        <Icon name="link" size={22} color={UCL_TEXT_PRIMARY} style={styles.listIcon} />
                        <Text style={styles.shareOptionText}>Copy link</Text>
                    </TouchableOpacity>
                    </DiscoverSheetCanvas>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
        zIndex: 9999,
        elevation: 9999,
    },
    shareModalShell: {
        backgroundColor: UCL_CANVAS_NAVY,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: UCL_TEXT_PRIMARY,
    },
    searchWrap: {
        marginTop: 14,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchIcon: { marginRight: 4 },
    searchInput: {
        flex: 1,
        color: UCL_TEXT_PRIMARY,
        fontSize: 15,
        paddingVertical: 0,
    },
    sendBar: {
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(61, 155, 143, 0.10)',
        borderWidth: 1,
        borderColor: 'rgba(61, 155, 143, 0.35)',
    },
    sendBarLabel: {
        color: UCL_TEXT_SECONDARY,
        fontSize: 12,
        fontWeight: '600',
    },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    captionInput: {
        flex: 1,
        color: UCL_TEXT_PRIMARY,
        fontSize: 15,
        paddingHorizontal: 14,
        paddingVertical: 10,
        maxHeight: 96,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    sendButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 20,
        backgroundColor: '#3D9B8F',
    },
    sendButtonDisabled: {
        opacity: 0.55,
    },
    sendButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    avatarWrap: {
        position: 'relative',
    },
    selectedBadge: {
        position: 'absolute',
        right: -3,
        bottom: -3,
        width: ox(16),
        height: ox(16),
        borderRadius: ox(8),
        backgroundColor: '#3D9B8F',
        borderWidth: 1.5,
        borderColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
    },
    followListWrap: {
        minHeight: 92,
        borderRadius: 12,
        backgroundColor: 'transparent',
        borderWidth: 0,
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    emptyText: {
        paddingVertical: 18,
        textAlign: 'center',
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: 14,
        fontWeight: '500',
    },
    followRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    followRowSelected: {
        borderColor: '#3D9B8F',
        backgroundColor: 'rgba(61, 155, 143, 0.14)',
    },
    followHandle: {
        flex: 1,
        color: UCL_TEXT_PRIMARY,
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
        color: UCL_TEXT_SECONDARY,
        fontSize: 12,
        letterSpacing: 1.2,
        fontWeight: '700',
    },
    resetLink: {
        color: UCL_TEXT_ACTIVE,
        fontSize: 13,
        fontWeight: '600',
    },
    resetLinkDisabled: {
        opacity: 0.55,
    },
    shareToScroll: {
        marginBottom: 12,
        flexGrow: 0,
    },
    shareToRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingRight: 8,
    },
    appIconBtn: {
        alignItems: 'center',
        width: 64,
        marginRight: 16,
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
        color: UCL_TEXT_SECONDARY,
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
    listIcon: { marginRight: 4 },
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    shareOptionText: {
        fontSize: 16,
        fontWeight: '600',
        color: UCL_TEXT_PRIMARY,
    },
});
