import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Linking,
    Alert,
    Clipboard,
    useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import Avatar from './Avatar';
import { glassPanel } from '../theme/gazetteerAmbientNative';
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

export default function ShareProfileSheet({
    visible,
    onClose,
    handle,
    name,
    avatarUrl,
    navigation,
}: Props) {
    const { width } = useWindowDimensions();
    const { user } = useAuth();
    const [copied, setCopied] = useState(false);
    const [isSharingStory, setIsSharingStory] = useState(false);

    const displayHandle = formatProfileDisplayHandle(handle);
    const profileUrl = buildProfileShareUrl(handle);
    const shareText = getProfileShareMessage(name);

    const copyLink = async () => {
        try {
            Clipboard.setString(profileUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            Alert.alert('Could not copy', 'Please try again.');
        }
    };

    const openUrl = async (url: string) => {
        try {
            const can = await Linking.canOpenURL(url);
            if (!can) {
                Alert.alert('Unavailable', 'Could not open this app on your device.');
                return;
            }
            await Linking.openURL(url);
            onClose();
        } catch {
            Alert.alert('Unavailable', 'Could not open link.');
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
            Alert.alert('Sign in required', 'Sign in to share to Stories.');
            return;
        }
        setIsSharingStory(true);
        try {
            const bareHandle = String(handle || '').replace(/^@/, '').trim();
            await createStory(
                user.id,
                user.handle || '',
                avatarUrl || undefined,
                avatarUrl ? 'image' : undefined,
                `Check out @${bareHandle}'s profile!`,
                undefined,
                undefined,
                undefined,
                bareHandle,
                undefined,
                undefined,
                [bareHandle],
            );
            onClose();
            navigation.navigate('Stories', { openUserHandle: user.handle });
        } catch (e) {
            console.error('Share profile to story failed:', e);
            Alert.alert('Stories', 'Could not share to Stories. Try again.');
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
                <IconCircle gradient={['#d91b5c', '#201138']}>
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
                await copyLink();
                Alert.alert('Instagram', 'Link copied — paste in Instagram.');
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
            id: 'copy',
            label: copied ? 'Copied!' : 'Copy link',
            keepOpen: true,
            icon: (
                <IconCircle backgroundColor="rgba(255,255,255,0.12)">
                    <Icon name="link-outline" size={22} color="#fff" />
                </IconCircle>
            ),
            onPress: copyLink,
        },
    ];

    const urlPreview = profileUrl.replace(/^https?:\/\//, '');

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[styles.sheet, { maxWidth: Math.min(width, 480) }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={styles.handleBar} />

                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.gazetteerLabel}>Gazetteer</Text>
                            <Text style={styles.title}>Share profile</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                            <Icon name="close" size={22} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.profileCard}>
                        <Avatar src={avatarUrl} name={name} size="lg" />
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
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(11, 7, 17, 0.72)',
        justifyContent: 'flex-end',
    },
    sheet: {
        width: '100%',
        alignSelf: 'center',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#1a1524',
        paddingBottom: 28,
        ...glassPanel,
    },
    handleBar: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginTop: 10,
        marginBottom: 12,
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
    gazetteerLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'rgba(217, 27, 92, 0.95)',
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
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginHorizontal: 16,
        marginTop: 14,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
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
        marginHorizontal: 16,
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
    shareToLabel: {
        marginTop: 16,
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
        paddingBottom: 4,
    },
    shareOption: {
        alignItems: 'center',
        width: 64,
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
