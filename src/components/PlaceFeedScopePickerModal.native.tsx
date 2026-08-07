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
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';

/** Stronger wash for short sheets — flat #060d16 reads as unchanged black on Android. */
const PASSPORT_WASH = ['#060d16', '#0f3a42', '#1f6b63', '#164858', '#060d16'] as const;

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

    const cardInner =
        Platform.OS === 'ios' ? (
            <View style={styles.cardCanvas} collapsable={false}>
                <View style={styles.ambientBack} pointerEvents="none" collapsable={false}>
                    <DiscoverAmbientCanvas variant="passport" fillParent />
                </View>
                <View style={styles.cardContent} collapsable={false}>
                    {cardBody}
                </View>
            </View>
        ) : (
            <LinearGradient
                colors={[...PASSPORT_WASH]}
                locations={[0, 0.28, 0.55, 0.78, 1]}
                start={{ x: 0.1, y: 1 }}
                end={{ x: 0.9, y: 0 }}
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
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    card: {
        backgroundColor: PASSPORT_ABYSS,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
        overflow: 'hidden',
    },
    cardCanvas: {
        backgroundColor: PASSPORT_ABYSS,
        overflow: 'hidden',
    },
    ambientBack: {
        ...StyleSheet.absoluteFillObject,
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
        fontWeight: '700',
        color: '#FFFFFF',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 14,
        color: 'rgba(232, 238, 242, 0.62)',
    },
    hint: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 17,
        color: 'rgba(232, 238, 242, 0.45)',
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
        color: '#F3F4F6',
    },
    cancelBtn: {
        marginTop: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 14,
        color: PASSPORT_PALETTE.wavePrimary,
    },
});
