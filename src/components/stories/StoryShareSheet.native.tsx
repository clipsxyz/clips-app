import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Alert,
    Modal,
    Share,
    ScrollView,
    Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { buildStoryShareUrl } from '../../utils/storyShareUrl';

type Props = {
    visible: boolean;
    onClose: () => void;
    userHandle: string;
    storyId: string;
};

function ShareRow({
    icon,
    iconBg,
    title,
    subtitle,
    onPress,
}: {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>{icon}</View>
            <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.rowSubtitle}>{subtitle}</Text>
            </View>
        </TouchableOpacity>
    );
}

/** Story share sheet — RN Modal so it works inside the full-screen Stories viewer. */
export default function StoryShareSheet({ visible, onClose, userHandle, storyId }: Props) {
    const [copied, setCopied] = useState(false);
    const shareUrl = buildStoryShareUrl(userHandle, storyId);
    const bareHandle = userHandle.replace(/^@/, '');
    const shareText = `Check out this story by @${bareHandle}\n${shareUrl}`;

    const openExternal = async (url: string) => {
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

    const copyLink = async () => {
        try {
            Clipboard.setString(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            Alert.alert('Link copied', 'Story link copied to clipboard.');
            onClose();
        } catch {
            Alert.alert('Could not copy', 'Please try again.');
        }
    };

    const shareSystem = async () => {
        try {
            await Share.share({ message: shareText, url: shareUrl });
        } catch (err) {
            console.warn('Story share failed:', err);
        } finally {
            onClose();
        }
    };

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`Check out this story by @${bareHandle}`);

    if (!visible) return null;

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <Text style={styles.title}>Share story</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                            <Icon name="close" size={22} color="#D1D5DB" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <ShareRow
                            icon={<Icon name="share-social-outline" size={16} color="#fff" />}
                            iconBg="#06B6D4"
                            title="Share"
                            subtitle="Open system share sheet"
                            onPress={() => void shareSystem()}
                        />
                        <ShareRow
                            icon={<Icon name="link" size={16} color="#fff" />}
                            iconBg="#374151"
                            title={copied ? 'Copied' : 'Copy link'}
                            subtitle="Share story link"
                            onPress={() => void copyLink()}
                        />
                        <ShareRow
                            icon={<Text style={styles.brandLetter}>W</Text>}
                            iconBg="#22C55E"
                            title="WhatsApp"
                            subtitle="Share via WhatsApp"
                            onPress={() =>
                                void openExternal(`https://wa.me/?text=${encodedText}%20${encodedUrl}`)
                            }
                        />
                        <ShareRow
                            icon={<Text style={styles.brandLetter}>f</Text>}
                            iconBg="#2563EB"
                            title="Facebook"
                            subtitle="Share to Facebook"
                            onPress={() =>
                                void openExternal(
                                    `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                                )
                            }
                        />
                        <ShareRow
                            icon={<Text style={styles.brandLetter}>X</Text>}
                            iconBg="#000000"
                            title="X (Twitter)"
                            subtitle="Share to X"
                            onPress={() =>
                                void openExternal(
                                    `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
                                )
                            }
                        />
                        <ShareRow
                            icon={<Text style={styles.brandLetter}>@</Text>}
                            iconBg="#EF4444"
                            title="Email"
                            subtitle="Share via email"
                            onPress={() => {
                                const subject = encodeURIComponent('Check out this story');
                                const body = encodeURIComponent(
                                    `Have a look at this story by @${bareHandle}:\n\n${shareUrl}`,
                                );
                                void openExternal(`mailto:?subject=${subject}&body=${body}`);
                            }}
                        />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '78%',
        paddingBottom: 24,
    },
    handle: {
        alignSelf: 'center',
        width: 48,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginTop: 10,
        marginBottom: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    title: { color: '#fff', fontSize: 16, fontWeight: '700' },
    closeBtn: { padding: 8, borderRadius: 999 },
    scroll: { flexGrow: 0 },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: '#1F2937',
        marginBottom: 10,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandLetter: { color: '#fff', fontSize: 14, fontWeight: '800' },
    rowText: { flex: 1 },
    rowTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
    rowSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
});
