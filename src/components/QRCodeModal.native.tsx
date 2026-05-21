import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import QRCode from 'qrcode';
import { SvgXml } from 'react-native-svg';
import type { Post } from '../types';
import { buildShareablePostUrl } from '../utils/shareUrls';

type Props = {
    post: Post;
    visible: boolean;
    onClose: () => void;
};

function formatPostDate(timestamp: number | string | undefined): string {
    const date =
        typeof timestamp === 'string'
            ? new Date(parseInt(timestamp, 10) || Date.now())
            : new Date(timestamp || Date.now());
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export default function QRCodeModal({ post, visible, onClose }: Props) {
    const [svgXml, setSvgXml] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible || !post?.id) {
            setSvgXml(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        const url = buildShareablePostUrl(post);
        void QRCode.toString(url, { type: 'svg', margin: 2, width: 280 })
            .then((xml) => {
                if (!cancelled) setSvgXml(xml);
            })
            .catch((e) => {
                console.error('QR generate failed:', e);
                if (!cancelled) setSvgXml(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [visible, post?.id]);

    if (!visible) return null;

    const shareUrl = buildShareablePostUrl(post);

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Icon name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.title}>QR Code</Text>
                    <Text style={styles.handle}>{post.userHandle}</Text>
                    <Text style={styles.date}>{formatPostDate(post.createdAt)}</Text>
                    <View style={styles.qrWrap}>
                        {loading ? (
                            <ActivityIndicator color="#8B5CF6" size="large" />
                        ) : svgXml ? (
                            <SvgXml xml={svgXml} width={240} height={240} />
                        ) : (
                            <Text style={styles.error}>Could not generate QR code</Text>
                        )}
                    </View>
                    <Text style={styles.url} numberOfLines={2}>
                        {shareUrl}
                    </Text>
                    <TouchableOpacity
                        style={styles.shareBtn}
                        onPress={() => void Share.share({ message: shareUrl, url: shareUrl })}
                    >
                        <Icon name="share-outline" size={18} color="#000" />
                        <Text style={styles.shareBtnText}>Share link</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    closeBtn: { alignSelf: 'flex-end' },
    title: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
    handle: { color: '#E5E7EB', fontSize: 14, fontWeight: '600' },
    date: { color: '#9CA3AF', fontSize: 12, marginBottom: 16 },
    qrWrap: {
        width: 260,
        height: 260,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    url: { color: '#9CA3AF', fontSize: 11, textAlign: 'center', marginBottom: 16 },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
    },
    shareBtnText: { color: '#000', fontWeight: '700' },
    error: { color: '#6B7280', fontSize: 13 },
});
