import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import {
    fetchMyChatGroups,
    inviteUserToChatGroup,
    type ChatGroupSummary,
} from '../api/chatGroups';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_GROUP } from './GazetteerBottomSheetModal.native';

function normalizeHandle(h: string): string {
    return h.trim().replace(/^@/g, '').split(/\s+/)[0] || '';
}

type Props = {
    visible: boolean;
    onClose: () => void;
    inviteeHandle: string;
};

export default function PickGroupToInviteFeedUserModal({ visible, onClose, inviteeHandle }: Props) {
    const { user } = useAuth();
    const [groups, setGroups] = useState<ChatGroupSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [invitingId, setInvitingId] = useState<string | null>(null);

    const normalizedInvitee = normalizeHandle(inviteeHandle);

    useEffect(() => {
        if (!visible || !user?.handle) return;
        let cancelled = false;
        setLoading(true);
        void fetchMyChatGroups(user.handle)
            .then((items) => {
                if (!cancelled) setGroups((items ?? []).filter((g) => g.is_admin));
            })
            .catch(() => {
                if (!cancelled) {
                    setGroups([]);
                    Alert.alert('Groups', 'Could not load your groups');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [visible, user?.handle]);

    const invite = useCallback(
        async (g: ChatGroupSummary) => {
            if (!normalizedInvitee) {
                Alert.alert('Invite', 'Invalid username');
                return;
            }
            if (normalizeHandle(user?.handle || '') === normalizedInvitee) {
                Alert.alert('Invite', "You can't invite yourself");
                return;
            }
            if (!isLaravelApiEnabled()) {
                Alert.alert(
                    'Invite',
                    'Invites require the API. Turn on the Laravel server to invite by username.',
                );
                return;
            }
            setInvitingId(g.id);
            try {
                await inviteUserToChatGroup(g.id, normalizedInvitee);
                Alert.alert('Invited', `Invited @${normalizedInvitee} to "${g.name}"`);
                onClose();
            } catch (e: unknown) {
                Alert.alert('Invite', e instanceof Error ? e.message : 'Could not send invite');
            } finally {
                setInvitingId(null);
            }
        },
        [normalizedInvitee, onClose, user?.handle],
    );

    const renderItem = useCallback(
        ({ item: g }: { item: ChatGroupSummary }) => (
            <TouchableOpacity
                style={styles.row}
                onPress={() => void invite(g)}
                disabled={invitingId === g.id}
            >
                <Icon name="people" size={20} color="#93C5FD" />
                <Text style={styles.rowName} numberOfLines={1}>
                    {g.name}
                </Text>
                {invitingId === g.id ? (
                    <ActivityIndicator size="small" color="#93C5FD" />
                ) : (
                    <Icon name="chevron-forward" size={18} color="#6B7280" />
                )}
            </TouchableOpacity>
        ),
        [invite, invitingId],
    );

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['70%']}
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_GROUP.background}
            handleIndicatorStyle={GAZETTEER_SHEET_GROUP.handle}
            backdropOpacity={0.65}
        >
            <BottomSheetView style={styles.headerBlock}>
                <View style={styles.header}>
                    <Text style={styles.title}>Invite to a group</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Icon name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.subtitle}>
                    Choose a group for @{normalizedInvitee || 'user'}
                </Text>
            </BottomSheetView>

            {loading ? (
                <BottomSheetView>
                    <ActivityIndicator color="#8B5CF6" style={{ marginVertical: 24 }} />
                </BottomSheetView>
            ) : groups.length === 0 ? (
                <BottomSheetView>
                    <Text style={styles.empty}>
                        You can only invite people to communities you created.
                    </Text>
                </BottomSheetView>
            ) : (
                <BottomSheetFlatList
                    data={groups}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                />
            )}
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    headerBlock: {
        paddingBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    title: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    subtitle: { color: '#9CA3AF', fontSize: 13, paddingHorizontal: 16, paddingTop: 8 },
    list: { paddingHorizontal: 8, paddingBottom: 24 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 10,
    },
    rowName: { flex: 1, color: '#FFF', fontSize: 15, fontWeight: '600' },
    empty: { color: '#9CA3AF', textAlign: 'center', padding: 32, fontSize: 14 },
});
