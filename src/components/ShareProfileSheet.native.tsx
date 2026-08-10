import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Linking,
    Modal,
    Pressable,
    Share,
    useWindowDimensions,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import {
    buildProfileShareUrl,
    formatProfileDisplayHandle,
    getProfileShareMessage,
} from '../utils/profileShareUrl';

type ShareOption = {
    id: string;
    label: string;
    icon: React.ReactNode;
    onPress: () => void | Promise<void>;
    keepOpen?: boolean;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    handle: string;
    name: string;
    avatarUrl?: string;
    navigation: { navigate: (screen: string, params?: object) => void };
};

function IconCircle({
    children,
    backgroundColor,
    gradient,
}: {
    children: React.ReactNode;
    backgroundColor?: string;
    gradient?: string[];
}) {
    if (gradient) {
        return (
            <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconCircle}
            >
                {children}
            </LinearGradient>
        );
    }
    return <View style={[styles.iconCircle, { backgroundColor }]}>{children}</View>;
}

/** Web `ShareProfileModal` parity — RN Modal (not gorhom) so it works over profile navigation. */
export default function ShareProfileSheet({
    visible,
    onClose,
    handle,
    name,
    avatarUrl,
    navigation,
}: Props) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { user } = useAuth();
    const [copied, setCopied] = useState(false);
    const [statusHint, setStatusHint] = useState<string | null>(null);
    const [isSharingStory, setIsSharingStory] = useState(false);

    const displayHandle = formatProfileDisplayHandle(handle);
    const profileUrl = buildProfileShareUrl(handle);
    const shareText = getProfileShareMessage(name);
    const resolvedAvatar = avatarUrl || getAvatarForHandle(handle);
    const sheetWidth = Math.min(width, 448);

    useEffect(() => {
        if (!visible) {
            setCopied(false);
            setStatusHint(null);
            setIsSharingStory(false);
        }
    }, [visible]);

    const showHint = (message: string) => {
        setStatusHint(message);
        setTimeout(() => setStatusHint(null), 2200);
    };

    const copyLink = async (hint?: string) => {
        try {
            Clipboard.setString(profileUrl);
            setCopied(true);
            showHint(hint || 'Profile link copied');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showHint('Could not copy link');
        }
    };

    const shareSystem = async () => {
        try {
            await Share.share({
                message: `${shareText}\n${profileUrl}`,
                url: profileUrl,
                title: shareText,
            });
        } catch {
            /* user cancelled */
        } finally {
            onClose();
        }
    };

    const openUrl = async (url: string) => {
        try {
            // Skip canOpenURL — Android often returns false for https/mailto without package queries.
            await Linking.openURL(url);
            onClose();
        } catch {
            await shareSystem();
        }
    };

    const shareExternal = (platform: string) => {
        const encodedUrl = encodeURIComponent(profileUrl);
        const encodedText = encodeURIComponent(shareText);
        let url = '';
        switch (platform) {
            case 'whatsapp':
                url = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
                break;
            case 'facebook':
                url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                break;
            case 'twitter':
                url = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
                break;
            case 'gmail':
                url = `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${profileUrl}`;
                break;
            case 'linkedin':
                url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
                break;
            default:
                return;
        }
        void openUrl(url);
    };

    const shareToStory = async () => {
        if (!user?.id) {
            showHint('Sign in to share to Stories');
            return;
        }
        setIsSharingStory(true);
        try {
            const bareHandle = String(handle || '').replace(/^@/, '').trim();
            const mediaUrl = resolvedAvatar;
            await createStory(
                user.id,
                user.handle || '',
                mediaUrl || undefined,
                mediaUrl ? 'image' : undefined,
                `Check out @${bareHandle}'s profile!`,
                undefined,
                undefined,
                undefined,
                bareHandle,
                undefined,
                mediaUrl
                    ? undefined
                    : {
                          color: '#FFFFFF',
                          size: 'large',
                          background: 'linear-gradient(135deg,#0b0711,#201138,#d91b5c)',
                      },
                undefined,
                [bareHandle],
            );
            onClose();
            navigation.navigate('Stories', { openUserHandle: user.handle });
        } catch (e) {
            console.error('Share profile to story failed:', e);
            showHint('Failed to share to Stories');
        } finally {
            setIsSharingStory(false);
        }
    };

    const shareOptions: ShareOption[] = [
        {
            id: 'story',
            label: isSharingStory ? 'Sharing…' : 'Stories',
            keepOpen: true,
            icon: (
                <IconCircle gradient={[PASSPORT_PALETTE.wavePrimary, PASSPORT_PALETTE.waveMid, PASSPORT_ABYSS]}>
                    {isSharingStory ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Icon name="play" size={22} color="#fff" />
                    )}
                </IconCircle>
            ),
            onPress: shareToStory,
        },
        {
            id: 'whatsapp',
            label: 'WhatsApp',
            icon: (
                <IconCircle backgroundColor="#25D366">
                    <Icon name="logo-whatsapp" size={26} color="#fff" />
                </IconCircle>
            ),
            onPress: () => shareExternal('whatsapp'),
        },
        {
            id: 'x',
            label: 'X',
            icon: (
                <IconCircle backgroundColor="#000000">
                    <Icon name="logo-twitter" size={22} color="#fff" />
                </IconCircle>
            ),
            onPress: () => shareExternal('twitter'),
        },
        {
            id: 'facebook',
            label: 'Facebook',
            icon: (
                <IconCircle backgroundColor="#1877F2">
                    <Icon name="logo-facebook" size={26} color="#fff" />
                </IconCircle>
            ),
            onPress: () => shareExternal('facebook'),
        },
        {
            id: 'instagram',
            label: copied ? 'Copied' : 'Instagram',
            keepOpen: true,
            icon: (
                <IconCircle gradient={['#833AB4', '#E1306C', '#F77737']}>
                    <Icon name="logo-instagram" size={24} color="#fff" />
                </IconCircle>
            ),
            onPress: async () => {
                await copyLink('Link copied — paste in Instagram');
            },
        },
        {
            id: 'email',
            label: 'Email',
            icon: (
                <IconCircle backgroundColor="#EA4335">
                    <Icon name="mail-outline" size={22} color="#fff" />
                </IconCircle>
            ),
            onPress: () => shareExternal('gmail'),
        },
        {
            id: 'linkedin',
            label: 'LinkedIn',
            icon: (
                <IconCircle backgroundColor="#0A66C2">
                    <Icon name="logo-linkedin" size={22} color="#fff" />
                </IconCircle>
            ),
            onPress: () => shareExternal('linkedin'),
        },
        {
            id: 'more',
            label: 'More',
            icon: (
                <IconCircle backgroundColor="rgba(255,255,255,0.12)">
                    <Icon name="share-outline" size={22} color="#fff" />
                </IconCircle>
            ),
            onPress: shareSystem,
        },
        {
            id: 'copy',
            label: copied ? 'Copied!' : 'Copy link',
            keepOpen: true,
            icon: (
                <IconCircle backgroundColor="rgba(255,255,255,0.12)">
                    <Icon name="link-outline" size={22} color="#fff" />
                </IconCircle>
            ),
            onPress: () => copyLink(),
        },
    ];

    const urlPreview = profileUrl.replace(/^https?:\/\//, '');

    if (!visible) return null;

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View
                    style={[
                        styles.sheet,
                        {
                            width: sheetWidth,
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    <PassportSheetCanvas contentStyle={styles.sheetInner}>
                        <View style={styles.handleWrap}>
                            <View style={styles.handle} />
                        </View>

                        <View style={styles.headerRow}>
                            <View style={styles.headerText}>
                                <Text style={styles.gazetteerLabel}>Gazetteer</Text>
                                <Text style={styles.title}>Share profile</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                                <Icon name="close" size={22} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profileSection}>
                            <View style={styles.profileCard}>
                                <View style={styles.avatarRing}>
                                    <Avatar src={resolvedAvatar} name={name} size="lg" />
                                </View>
                                <View style={styles.profileText}>
                                    <Text style={styles.profileName} numberOfLines={1}>
                                        {name}
                                    </Text>
                                    <Text style={styles.profileHandle} numberOfLines={1}>
                                        {displayHandle}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity style={styles.copyRow} onPress={() => void copyLink()}>
                                <Icon name="link-outline" size={18} color="#D1D5DB" />
                                <Text style={styles.copyUrl} numberOfLines={1}>
                                    {copied ? 'Link copied' : urlPreview}
                                </Text>
                            </TouchableOpacity>

                            {statusHint ? <Text style={styles.statusHint}>{statusHint}</Text> : null}
                        </View>

                        <Text style={styles.shareToLabel}>Share to</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.shareScroll}
                        >
                            {shareOptions.map((opt) => (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={styles.shareOption}
                                    disabled={opt.id === 'story' && isSharingStory}
                                    onPress={() => {
                                        void opt.onPress();
                                        if (!opt.keepOpen) onClose();
                                    }}
                                >
                                    {opt.icon}
                                    <Text style={styles.shareLabel} numberOfLines={1}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </PassportSheetCanvas>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        maxHeight: '88%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: PASSPORT_ABYSS,
        overflow: 'hidden',
    },
    sheetInner: {
        paddingBottom: 4,
    },
    handleWrap: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerText: {
        flex: 1,
        paddingRight: 8,
    },
    gazetteerLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: PASSPORT_PALETTE.wavePrimary,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: 2,
    },
    closeBtn: {
        padding: 6,
    },
    profileSection: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    avatarRing: {
        borderRadius: 999,
        borderWidth: 2,
        borderColor: 'rgba(61,155,143,0.45)',
        padding: 2,
    },
    profileText: {
        flex: 1,
        minWidth: 0,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    profileHandle: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 2,
    },
    copyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    copyUrl: {
        flex: 1,
        fontSize: 13,
        color: '#E5E7EB',
        fontWeight: '500',
    },
    statusHint: {
        marginTop: 8,
        fontSize: 12,
        color: PASSPORT_PALETTE.wavePrimary,
        fontWeight: '600',
        textAlign: 'center',
    },
    shareToLabel: {
        marginTop: 12,
        marginBottom: 10,
        paddingHorizontal: 16,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: '#6B7280',
    },
    shareScroll: {
        paddingHorizontal: 12,
        gap: 16,
        paddingBottom: 8,
    },
    shareOption: {
        alignItems: 'center',
        width: 64,
        opacity: 1,
    },
    shareLabel: {
        marginTop: 8,
        fontSize: 10,
        color: '#9CA3AF',
        textAlign: 'center',
        maxWidth: 72,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
});
