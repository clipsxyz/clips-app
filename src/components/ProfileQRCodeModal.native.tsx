import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import QRCode from 'qrcode';
import { SvgXml } from 'react-native-svg';
import { buildProfileShareUrl } from '../utils/profileShareUrl';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';

type Props = {
    visible: boolean;
    onClose: () => void;
    handle: string;
    name: string;
};

export default function ProfileQRCodeModal({ visible, onClose, handle, name }: Props) {
    const [svgXml, setSvgXml] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible || !handle) {
            setSvgXml(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        const url = buildProfileShareUrl(handle);
        void QRCode.toString(url, { type: 'svg', margin: 2, width: 280 })
            .then((xml) => {
                if (!cancelled) setSvgXml(xml);
            })
            .catch((error) => {
                console.error('Profile QR generate failed:', error);
                if (!cancelled) setSvgXml(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [visible, handle]);

    const displayName = String(name || handle || 'Profile')
        .replace(/^@/, '')
        .split('@')[0]
        .toUpperCase();

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close QR code" />
                <View style={styles.card}>
                    <PassportSheetCanvas contentStyle={styles.cardInner}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
                        <Icon name="close" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.title}>{displayName}</Text>
                    <Text style={styles.subtitle}>Scan to view profile</Text>
                    <View style={styles.qrWrap}>
                        {loading ? (
                            <ActivityIndicator size="large" color={PASSPORT_PALETTE.wavePrimary} />
                        ) : svgXml ? (
                            <SvgXml xml={svgXml} width={256} height={256} />
                        ) : (
                            <Text style={styles.errorText}>Could not generate QR code</Text>
                        )}
                    </View>
                    </PassportSheetCanvas>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: PASSPORT_ABYSS,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardInner: {
        padding: 24,
        alignItems: 'center',
    },
    closeButton: {
        alignSelf: 'flex-end',
        padding: 4,
        marginBottom: 4,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        color: 'rgba(232,238,242,0.62)',
        fontSize: 13,
        marginBottom: 20,
    },
    qrWrap: {
        width: 256,
        height: 256,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    errorText: {
        color: '#6B7280',
        fontSize: 13,
        textAlign: 'center',
        paddingHorizontal: 16,
    },
});
