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
import LinearGradient from 'react-native-linear-gradient';
import type { LocationSuggestion } from '../api/locations';
import { parsedPlaceFeedFromSuggestion } from '../utils/placeFeedLevels';
import type { FeedScope } from '../utils/placeFeedLevels';
import {
    UCL_CANVAS_NAVY,
    UCL_SHEET_GRADIENT,
    UCL_SHEET_GRADIENT_LOCATIONS,
    UCL_TEXT_ACTIVE,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
    UCL_TEXT_SECONDARY,
} from '../theme/gazetteerAmbientNative';

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

    const cardBody = (
        <>
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
        </>
    );

    const cardInner = (
        <LinearGradient
            colors={[...UCL_SHEET_GRADIENT]}
            locations={[...UCL_SHEET_GRADIENT_LOCATIONS]}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.88, y: 1 }}
            style={styles.cardCanvas}
        >
            <View style={styles.cardContent} collapsable={false}>
                {cardBody}
            </View>
        </LinearGradient>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
                <View style={styles.card}>{cardInner}</View>
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
        backgroundColor: UCL_CANVAS_NAVY,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
        overflow: 'hidden',
    },
    cardCanvas: {
        backgroundColor: UCL_CANVAS_NAVY,
        overflow: 'hidden',
    },
    ambientBack: {
        ...StyleSheet.absoluteFill,
        zIndex: 0,
    },
    cardContent: {
        position: 'relative',
        zIndex: 1,
        padding: 20,
        backgroundColor: 'transparent',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: UCL_TEXT_PRIMARY,
    },
    subtitle: {
        marginTop: 4,
        fontSize: 14,
        color: UCL_TEXT_SECONDARY,
    },
    hint: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 17,
        color: UCL_TEXT_PLACEHOLDER,
    },
    options: {
        marginTop: 16,
        gap: 8,
    },
    optionBtn: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(15, 36, 48, 0.55)',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
        color: UCL_TEXT_PRIMARY,
    },
    cancelBtn: {
        marginTop: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: UCL_TEXT_ACTIVE,
    },
});
