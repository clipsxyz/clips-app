import React from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { LocationSuggestion } from '../api/locations';
import { parsedPlaceFeedFromSuggestion } from '../utils/placeFeedLevels';
import type { FeedScope } from '../utils/placeFeedLevels';

type Props = {
    visible: boolean;
    suggestion: LocationSuggestion | null;
    onClose: () => void;
    onSelectScope: (scope: FeedScope) => void;
};

export default function PlaceFeedScopePickerModal({
    visible,
    suggestion,
    onClose,
    onSelectScope,
}: Props) {
    React.useEffect(() => {
        if (visible) {
            Keyboard.dismiss();
        }
    }, [visible]);

    if (!suggestion) return null;

    const options = parsedPlaceFeedFromSuggestion(suggestion).options;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
                <View style={styles.card}>
                    <Text style={styles.title}>Which feed?</Text>
                    <Text style={styles.subtitle}>{suggestion.name}</Text>
                    <Text style={styles.hint}>
                        Country is the whole nation. City is the metro area. Local area is the nearest
                        neighbourhood when available.
                    </Text>
                    <View style={styles.options}>
                        {options.map((opt) => (
                            <TouchableOpacity
                                key={opt.scope}
                                style={styles.optionBtn}
                                onPress={() => onSelectScope(opt.scope)}
                            >
                                <Text style={styles.optionText}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        padding: 16,
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    card: {
        backgroundColor: '#1a1524',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 20,
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 14,
        color: '#9CA3AF',
    },
    hint: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 17,
        color: '#6B7280',
    },
    options: {
        marginTop: 16,
        gap: 8,
    },
    optionBtn: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F3F4F6',
    },
    cancelBtn: {
        marginTop: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
});
