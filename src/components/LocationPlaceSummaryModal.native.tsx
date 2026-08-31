import React from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LocationPlaceSummaryBody from './LocationPlaceSummaryBody.native';
import { usePlaceSummary } from '../hooks/usePlaceSummary';

type Props = {
    open: boolean;
    onClose: () => void;
    locationLabel: string;
    placeId?: string | null;
};

export default function LocationPlaceSummaryModal({ open, onClose, locationLabel, placeId }: Props) {
    const { data, loading } = usePlaceSummary(locationLabel, placeId, open);

    return (
        <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={onClose}
                        accessibilityLabel="Close"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Icon name="close" size={22} color="#9CA3AF" />
                    </TouchableOpacity>
                    <LocationPlaceSummaryBody locationLabel={locationLabel} data={data} loading={loading} />
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    sheet: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1F2937',
        backgroundColor: '#0A0A0A',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 24,
    },
    closeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 2,
        padding: 4,
    },
});
