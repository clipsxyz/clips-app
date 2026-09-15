import React, { useState } from 'react';
import {
    Linking,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { googleMapsSearchUrl } from '../utils/businessAddress';

type Props = {
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
};

export default function BusinessAddressPin({ address, latitude, longitude }: Props) {
    const [open, setOpen] = useState(false);
    const trimmed = String(address || '').trim();
    if (!trimmed) return null;

    const openMaps = () => {
        const url = googleMapsSearchUrl(latitude, longitude, trimmed);
        void Linking.openURL(url);
        setOpen(false);
    };

    return (
        <>
            <TouchableOpacity
                style={styles.row}
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Address ${trimmed}`}
                activeOpacity={0.75}
            >
                <Icon name="location" size={16} color="#EF4444" />
                <Text style={styles.address} numberOfLines={2}>
                    {trimmed}
                </Text>
            </TouchableOpacity>
            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetTitleRow}>
                            <Icon name="location" size={18} color="#EF4444" />
                            <Text style={styles.sheetTitle}>Address</Text>
                        </View>
                        <Text style={styles.sheetAddress}>{trimmed}</Text>
                        <TouchableOpacity
                            style={styles.mapsBtn}
                            onPress={openMaps}
                            accessibilityRole="button"
                            accessibilityLabel="Open in Google Maps"
                        >
                            <Icon name="navigate-outline" size={18} color="#111827" />
                            <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
                            <Text style={styles.cancelBtnText}>Close</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
        gap: 6,
        maxWidth: '100%',
    },
    address: {
        flex: 1,
        color: '#E5E7EB',
        fontSize: 13,
        lineHeight: 18,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 14,
    },
    sheetTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    sheetTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    sheetAddress: {
        color: '#D1D5DB',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    mapsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 14,
    },
    mapsBtnText: {
        color: '#111827',
        fontSize: 15,
        fontWeight: '700',
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 4,
    },
    cancelBtnText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },
});
