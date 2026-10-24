import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { unifiedSearch } from '../api/search';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_INBOX } from './GazetteerBottomSheetModal.native';
import { UCL_TEXT_PLACEHOLDER, UCL_TEXT_PRIMARY } from '../theme/gazetteerAmbientNative';

type TaggedUser = {
    handle: string;
    display_name?: string;
    avatar_url?: string;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    taggedUserHandles: string[];
    onVisitProfile?: (handle: string) => void;
};

export default function TaggedUsersBottomSheet({
    visible,
    onClose,
    taggedUserHandles,
    onVisitProfile,
}: Props) {
    const [users, setUsers] = useState<TaggedUser[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible || taggedUserHandles.length === 0) {
            setUsers([]);
            return;
        }

        let cancelled = false;
        setLoading(true);

        const fallback = taggedUserHandles.map((handle) => ({
            handle,
            avatar_url: getAvatarForHandle(handle) || undefined,
        }));

        (async () => {
            try {
                const results = await Promise.all(
                    taggedUserHandles.map(async (handle) => {
                        try {
                            const result = await unifiedSearch({
                                q: handle,
                                types: 'users',
                                usersLimit: 1,
                            });
                            const user = result.sections?.users?.items?.find(
                                (u: { handle?: string }) =>
                                    u.handle?.toLowerCase() === handle.toLowerCase(),
                            );
                            if (user) {
                                return {
                                    handle: user.handle,
                                    display_name: user.display_name,
                                    avatar_url: user.avatar_url ?? getAvatarForHandle(handle),
                                };
                            }
                        } catch {
                            /* ignore per-handle */
                        }
                        return {
                            handle,
                            avatar_url: getAvatarForHandle(handle) || undefined,
                        };
                    }),
                );
                if (!cancelled) setUsers(results);
            } catch {
                if (!cancelled) setUsers(fallback);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [visible, taggedUserHandles.join(',')]);

    const renderItem = useCallback(
        ({ item }: { item: TaggedUser }) => (
            <TouchableOpacity
                style={styles.row}
                onPress={() => {
                    onClose();
                    onVisitProfile?.(item.handle);
                }}
                disabled={!onVisitProfile}
            >
                <Avatar
                    src={item.avatar_url}
                    name={item.display_name || item.handle.split('@')[0]}
                    size={40}
                />
                <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                        {item.display_name || item.handle}
                    </Text>
                    <Text style={styles.handle} numberOfLines={1}>
                        {item.handle}
                    </Text>
                </View>
            </TouchableOpacity>
        ),
        [onClose, onVisitProfile],
    );

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['80%']}
            backgroundStyle={GAZETTEER_SHEET_INBOX.background}
            handleIndicatorStyle={GAZETTEER_SHEET_INBOX.handle}
        >
            <BottomSheetView style={styles.headerBlock}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerIcon}>
                            <Icon name="people" size={20} color={UCL_TEXT_PRIMARY} />
                        </View>
                        <View>
                            <Text style={styles.title}>Tagged people</Text>
                            <Text style={styles.subtitle}>
                                {taggedUserHandles.length}{' '}
                                {taggedUserHandles.length === 1 ? 'person' : 'people'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <Icon name="close" size={24} color={UCL_TEXT_PRIMARY} />
                    </TouchableOpacity>
                </View>
            </BottomSheetView>

            {loading ? (
                <BottomSheetView>
                    <ActivityIndicator color={UCL_TEXT_PRIMARY} style={styles.loader} />
                </BottomSheetView>
            ) : (
                <BottomSheetFlatList
                    data={users}
                    keyExtractor={(item) => item.handle}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <Text style={styles.empty}>No tagged users found</Text>
                    }
                />
            )}
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    headerBlock: {
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: UCL_TEXT_PRIMARY,
    },
    subtitle: {
        fontSize: 12,
        color: '#E2E8F0',
        marginTop: 2,
    },
    loader: {
        paddingVertical: 32,
    },
    list: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        paddingHorizontal: 10,
        marginBottom: 8,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        fontSize: 15,
        fontWeight: '600',
        color: UCL_TEXT_PRIMARY,
    },
    handle: {
        fontSize: 13,
        color: '#E2E8F0',
        marginTop: 2,
    },
    empty: {
        textAlign: 'center',
        color: UCL_TEXT_PLACEHOLDER,
        paddingVertical: 24,
    },
});
