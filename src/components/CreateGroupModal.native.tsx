import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { createChatGroup } from '../api/chatGroups';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { uploadFileFromUri } from '../utils/uploadFileNative';
import { PASSPORT_ABYSS } from '../utils/discoverAmbientPalette';
import Avatar from './Avatar.native';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';

/** Same wash as web Swal / View Profile passport sheets. */
const PASSPORT_WASH = ['#060d16', '#0f3a42', '#1f6b63', '#164858', '#060d16'] as const;

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

/**
 * RN Modal (not gorhom) — BottomSheetModal fails to present inside navigation modals
 * such as InstantCreate fullScreenModal.
 * Passport night-atlas canvas matches View Profile / web New group.
 */
export default function CreateGroupModal({ visible, onClose, onCreated }: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [name, setName] = useState('');
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const sheetLayout = useMemo(() => {
        const sheetWidth = Math.min(width - 24, 400);
        const marginHorizontal = Math.max(12, Math.floor((width - sheetWidth) / 2));
        return { sheetWidth, marginHorizontal };
    }, [width]);

    useEffect(() => {
        if (!visible) return;
        setName('');
        setAvatarUri(null);
        setFormError(null);
    }, [visible]);

    const pickPhoto = async () => {
        const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
        const uri = result.assets?.[0]?.uri;
        if (uri) setAvatarUri(uri);
    };

    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setFormError('Enter a group name');
            return;
        }
        if (!isLaravelApiEnabled() && !user?.handle) {
            setFormError('Sign in to create a group in offline mode');
            return;
        }
        setFormError(null);
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
                setFormError(
                    isLaravelApiEnabled()
                        ? 'Could not create group (try signing in again)'
                        : 'Could not create group',
                );
            }
        } catch (e: unknown) {
            setFormError(e instanceof Error ? e.message : 'Could not create group');
        } finally {
            setBusy(false);
        }
    };

    if (!visible) return null;

    const form = (
        <>
            <View style={styles.handleWrap}>
                <View style={styles.handle} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
                <View style={styles.header}>
                    <Avatar
                        src={user?.avatarUrl}
                        name={user?.name || user?.handle || 'You'}
                        size={36}
                    />
                    <View style={styles.headerTitleRow}>
                        <Icon name="people" size={20} color="#FFF" />
                        <Text style={styles.title}>New group</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} disabled={busy} accessibilityLabel="Close">
                        <Icon name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.hint}>
                    Next you&apos;ll open the group chat. Invite people with the + button there, or open
                    someone&apos;s profile → Invite to group.
                </Text>
                <Text style={styles.label}>Group name</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={(text) => {
                        setName(text);
                        if (formError) setFormError(null);
                    }}
                    placeholder="e.g. Dublin photographers"
                    placeholderTextColor="#6B7280"
                    maxLength={120}
                    editable={!busy}
                    returnKeyType="done"
                    onSubmitEditing={() => void submit()}
                />
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}
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
                        <>
                            <TouchableOpacity
                                style={styles.photoBtn}
                                onPress={() => setAvatarUri(null)}
                                disabled={busy}
                            >
                                <Text style={styles.photoBtnTextMuted}>Remove</Text>
                            </TouchableOpacity>
                            <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
                        </>
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
            </ScrollView>
        </>
    );

    /** Match SavePostModal: iOS animated ambient, Android parent LinearGradient (OEM-safe). */
    const sheetInner =
        Platform.OS === 'ios' ? (
            <View style={styles.sheetCanvas} collapsable={false}>
                <View style={styles.ambientBack} pointerEvents="none" collapsable={false}>
                    <DiscoverAmbientCanvas variant="passport" fillParent />
                </View>
                <View style={styles.sheetContent} collapsable={false}>
                    {form}
                </View>
            </View>
        ) : (
            <LinearGradient
                colors={[...PASSPORT_WASH]}
                locations={[0, 0.28, 0.55, 0.78, 1]}
                start={{ x: 0.1, y: 1 }}
                end={{ x: 0.9, y: 0 }}
                style={styles.sheetCanvas}
            >
                <View style={styles.sheetContent} collapsable={false}>
                    {form}
                </View>
            </LinearGradient>
        );

    return (
        <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => !busy && onClose()}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Pressable
                    style={styles.backdrop}
                    onPress={() => !busy && onClose()}
                />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={[
                        styles.sheet,
                        {
                            marginHorizontal: sheetLayout.marginHorizontal,
                            width: sheetLayout.sheetWidth,
                            alignSelf: 'center',
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    {sheetInner}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    sheet: {
        maxHeight: '88%',
        zIndex: 2,
        elevation: 12,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        backgroundColor: PASSPORT_ABYSS,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sheetCanvas: {
        backgroundColor: PASSPORT_ABYSS,
        overflow: 'hidden',
    },
    ambientBack: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    sheetContent: {
        position: 'relative',
        zIndex: 1,
        backgroundColor: 'transparent',
        paddingHorizontal: 16,
        paddingTop: 4,
    },
    handleWrap: {
        alignItems: 'center',
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitleRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
    },
    title: { color: '#FFF', fontSize: 17, fontWeight: '700', flexShrink: 1 },
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
    formError: {
        color: '#F87171',
        fontSize: 13,
        marginTop: 8,
    },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' },
    photoBtn: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    photoBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
    photoBtnTextMuted: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
    avatarPreview: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    submit: {
        marginTop: 20,
        backgroundColor: '#FFF',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 8,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
