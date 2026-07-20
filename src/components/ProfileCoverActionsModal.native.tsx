import React from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';

type Action = {
    id: string;
    label: string;
    icon: string;
    onPress: () => void;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    name: string;
    handle: string;
    avatarUrl?: string;
    actions: Action[];
};

/** Web ViewProfile avatar tap menu — black card, avatar header, icon row. */
export default function ProfileCoverActionsModal({
    visible,
    onClose,
    name,
    handle,
    avatarUrl,
    actions,
}: Props) {
    const { width } = useWindowDimensions();
    const cardWidth = Math.min(width - 32, 360);
    const handleLabel = String(handle || '').replace(/^@/, '');
    const resolvedAvatar = avatarUrl || getAvatarForHandle(handle);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={[styles.card, { width: cardWidth }]}>
                    <View style={styles.header}>
                        <Avatar
                            src={resolvedAvatar}
                            name={name || handleLabel || 'User'}
                            size={72}
                        />
                        <Text style={styles.name} numberOfLines={1}>
                            {name}
                        </Text>
                        <Text style={styles.handle} numberOfLines={1}>
                            {handleLabel}
                        </Text>
                    </View>

                    <View style={styles.actionsRow}>
                        {actions.map((action) => (
                            <TouchableOpacity
                                key={action.id}
                                style={styles.actionBtn}
                                onPress={() => {
                                    onClose();
                                    action.onPress();
                                }}
                                activeOpacity={0.85}
                            >
                                <View style={styles.iconCircle}>
                                    <Icon name={action.icon} size={28} color="#FFFFFF" />
                                </View>
                                <Text style={styles.actionLabel} numberOfLines={2}>
                                    {action.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    card: {
        backgroundColor: '#000000',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 22,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 16,
        zIndex: 2,
    },
    header: {
        alignItems: 'center',
        paddingBottom: 18,
        marginBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    name: {
        marginTop: 10,
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        maxWidth: 240,
    },
    handle: {
        marginTop: 2,
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        maxWidth: 240,
    },
    actionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 16,
    },
    actionBtn: {
        alignItems: 'center',
        minWidth: 64,
        maxWidth: 76,
        gap: 8,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 14,
    },
});
