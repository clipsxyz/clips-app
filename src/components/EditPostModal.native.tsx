import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    BottomSheetFooter,
    BottomSheetScrollView,
    BottomSheetTextInput,
    BottomSheetView,
    type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Post } from '../types';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_SLATE } from './GazetteerBottomSheetModal.native';

const TEXT_MAX = 500;

type Props = {
    post: Post;
    visible: boolean;
    onClose: () => void;
    onSave: (text: string, location: string, venue: string, landmark: string) => Promise<void>;
};

export default function EditPostModal({ post, visible, onClose, onSave }: Props) {
    const insets = useSafeAreaInsets();
    const [text, setText] = useState('');
    const [location, setLocation] = useState('');
    const [venue, setVenue] = useState('');
    const [landmark, setLandmark] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        setText(post.text || post.caption || '');
        setLocation(post.locationLabel || '');
        setVenue(post.venue || '');
        setLandmark(post.landmark || '');
        setError(null);
    }, [visible, post]);

    const handleSave = async () => {
        if (isSaving) return;
        setError(null);
        setIsSaving(true);
        try {
            await onSave(text.trim(), location.trim(), venue.trim(), landmark.trim());
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update post';
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props} bottomInset={Math.max(insets.bottom, 12)}>
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={onClose}
                        disabled={isSaving}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                        onPress={() => void handleSave()}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#000000" />
                        ) : (
                            <Text style={styles.saveText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </BottomSheetFooter>
        ),
        [insets.bottom, isSaving, onClose, text, location, venue, landmark],
    );

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['88%']}
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_SLATE.background}
            handleIndicatorStyle={GAZETTEER_SHEET_SLATE.handle}
            backdropOpacity={0.6}
            footerComponent={renderFooter}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
        >
            <BottomSheetView style={styles.header}>
                <Text style={styles.title}>Edit Post</Text>
                <TouchableOpacity onPress={onClose} disabled={isSaving} hitSlop={12}>
                    <Icon name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </BottomSheetView>

            <BottomSheetScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
            >
                {error ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <Text style={styles.label}>Text</Text>
                <BottomSheetTextInput
                    style={[styles.input, styles.textArea]}
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={TEXT_MAX}
                    placeholderTextColor="#6B7280"
                    editable={!isSaving}
                />
                <Text style={styles.counter}>
                    {text.length}/{TEXT_MAX}
                </Text>

                <Text style={styles.label}>Location</Text>
                <View style={styles.inputIconWrap}>
                    <Icon name="location-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <BottomSheetTextInput
                        style={[styles.input, styles.inputWithIcon]}
                        value={location}
                        onChangeText={setLocation}
                        placeholder="Add location"
                        placeholderTextColor="#6B7280"
                        maxLength={200}
                        editable={!isSaving}
                    />
                </View>

                <Text style={styles.label}>Venue</Text>
                <View style={styles.inputIconWrap}>
                    <Icon name="business-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <BottomSheetTextInput
                        style={[styles.input, styles.inputWithIcon]}
                        value={venue}
                        onChangeText={setVenue}
                        placeholder="Add venue (e.g. café, stadium)"
                        placeholderTextColor="#6B7280"
                        maxLength={200}
                        editable={!isSaving}
                    />
                </View>

                <Text style={styles.label}>Landmark</Text>
                <View style={styles.inputIconWrap}>
                    <Icon name="map-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <BottomSheetTextInput
                        style={[styles.input, styles.inputWithIcon]}
                        value={landmark}
                        onChangeText={setLandmark}
                        placeholder="Add landmark"
                        placeholderTextColor="#6B7280"
                        maxLength={200}
                        editable={!isSaving}
                    />
                </View>
            </BottomSheetScrollView>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    scroll: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    label: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
        marginTop: 8,
    },
    inputIconWrap: {
        position: 'relative',
    },
    inputIcon: {
        position: 'absolute',
        left: 12,
        top: 14,
        zIndex: 1,
    },
    input: {
        backgroundColor: '#1f1f23',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        color: '#FFFFFF',
        fontSize: 15,
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 4,
    },
    inputWithIcon: {
        paddingLeft: 36,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    counter: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        textAlign: 'right',
        marginBottom: 8,
    },
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.4)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
    },
    errorText: {
        color: '#FCA5A5',
        fontSize: 13,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#1a1a1a',
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    cancelText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 15,
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        minWidth: 88,
        alignItems: 'center',
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    saveText: {
        color: '#000000',
        fontSize: 15,
        fontWeight: '700',
    },
});
