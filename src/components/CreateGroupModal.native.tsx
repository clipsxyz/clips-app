import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../context/Auth';
import { createChatGroup } from '../api/chatGroups';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { uploadFileFromUri } from '../utils/uploadFileNative';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_DM } from './GazetteerBottomSheetModal.native';

type Props = {
    visible: boolean;
    onClose: () => void;
    onCreated?: (group: {
        id: string;
        name: string;
        avatar_url?: string | null;
        conversation_id: string;
    }) => void;
};

export default function CreateGroupModal({ visible, onClose, onCreated }: Props) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setName('');
        setAvatarUri(null);
    }, [visible]);

    const pickPhoto = async () => {
        const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
        const uri = result.assets?.[0]?.uri;
        if (uri) setAvatarUri(uri);
    };

    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            Alert.alert('Group', 'Enter a group name');
            return;
        }
        if (!isLaravelApiEnabled() && !user?.handle) {
            Alert.alert('Group', 'Sign in to create a group');
            return;
        }
        setBusy(true);
        try {
            let avatarUrl: string | null = null;
            if (avatarUri) {
                if (isLaravelApiEnabled()) {
                    const upload = await uploadFileFromUri(avatarUri);
                    avatarUrl = upload.fileUrl || upload.url || null;
                    if (!avatarUrl) {
                        throw new Error('Could not upload group photo');
                    }
                } else {
                    avatarUrl = avatarUri;
                }
            }
            const g = await createChatGroup(trimmed, user?.handle ?? null, avatarUrl);
            if (g) {
                onCreated?.(g);
                onClose();
            } else {
                Alert.alert('Group', 'Could not create group');
            }
        } catch (e: unknown) {
            Alert.alert('Group', e instanceof Error ? e.message : 'Could not create group');
        } finally {
            setBusy(false);
        }
    };

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            enableDynamicSizing
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_DM.background}
            handleIndicatorStyle={GAZETTEER_SHEET_DM.handle}
            backdropOpacity={0.7}
            keyboardBehavior="interactive"
            android_keyboardInputMode="adjustResize"
        >
            <BottomSheetView style={styles.sheetBody}>
                <View style={styles.header}>
                    <Icon name="people" size={22} color="#FFF" />
                    <Text style={styles.title}>New group</Text>
                    <TouchableOpacity onPress={onClose} disabled={busy}>
                        <Icon name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.hint}>
                    After creating, open the group chat and invite people with + or from profiles.
                </Text>
                <Text style={styles.label}>Group name</Text>
                <BottomSheetTextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Dublin photographers"
                    placeholderTextColor="#6B7280"
                    maxLength={120}
                    editable={!busy}
                />
                <Text style={styles.label}>Group photo (optional)</Text>
                <View style={styles.photoRow}>
                    <TouchableOpacity
                        style={styles.photoBtn}
                        onPress={() => void pickPhoto()}
                        disabled={busy}
                    >
                        <Text style={styles.photoBtnText}>
                            {avatarUri ? 'Change photo' : 'Choose photo'}
                        </Text>
                    </TouchableOpacity>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
                    ) : null}
                </View>
                <TouchableOpacity
                    style={[styles.submit, busy && styles.submitDisabled]}
                    onPress={() => void submit()}
                    disabled={busy}
                >
                    {busy ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.submitText}>Create group</Text>
                    )}
                </TouchableOpacity>
            </BottomSheetView>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetBody: {
        padding: 16,
        paddingBottom: 24,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    title: { flex: 1, color: '#FFF', fontSize: 17, fontWeight: '700' },
    hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18, marginBottom: 12 },
    label: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 6,
        marginTop: 8,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        padding: 12,
        color: '#FFF',
    },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    photoBtn: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    photoBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
    avatarPreview: { width: 48, height: 48, borderRadius: 24 },
    submit: {
        marginTop: 20,
        backgroundColor: '#FFF',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
