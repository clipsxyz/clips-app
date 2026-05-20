import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    Linking,
    Alert,
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

export default function StoryShareSheet({ visible, onClose, userHandle, storyId }: Props) {
    const [copied, setCopied] = useState(false);
    const shareUrl = buildStoryShareUrl(userHandle, storyId);
    const bareHandle = userHandle.replace(/^@/, '');

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

    const copyLink = () => {
        Clipboard.setString(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        onClose();
    };

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`Check out this story by @${bareHandle}`);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <Text style={styles.title}>Share story</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Icon name="close" size={22} color="#D1D5DB" />
                        </TouchableOpacity>
                    </View>

                    <ShareRow
                        icon={<Icon name="link" size={16} color="#fff" />}
                        iconBg="#374151"
                        title={copied ? 'Copied' : 'Copy link'}
                        subtitle="Share story link"
                        onPress={copyLink}
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
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingBottom: 28,
        paddingTop: 8,
    },
    handle: {
        width: 48,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.25)',
        alignSelf: 'center',
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: { color: '#fff', fontSize: 16, fontWeight: '700' },
    closeBtn: { padding: 8, borderRadius: 999 },
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
