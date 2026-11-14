import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { unifiedSearch } from '../api/search';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_INBOX } from './GazetteerBottomSheetModal.native';
import {
    UCL_CANVAS_NAVY,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
} from '../theme/gazetteerAmbientNative';

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
                        {item.display_name || item.handle.replace(/^@/, '')}
                    </Text>
                    <Text style={styles.handle} numberOfLines={1}>
                        @{item.handle.replace(/^@/, '')}
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
            {/*
              Column layout (regular View, not a BottomSheetView sibling of the list)
              keeps the title pinned. A FlatList sibling paints over the header.
            */}
            <View style={styles.body}>
                <View style={styles.headerBlock}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.headerIcon}>
                                <Icon name="people" size={20} color={UCL_TEXT_PRIMARY} />
                            </View>
                            <View style={styles.headerCopy}>
                                <Text style={styles.title} numberOfLines={1}>
                                    Tagged people
                                </Text>
                                <Text style={styles.subtitle} numberOfLines={1}>
                                    {taggedUserHandles.length}{' '}
                                    {taggedUserHandles.length === 1 ? 'person' : 'people'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                            <Icon name="close" size={24} color={UCL_TEXT_PRIMARY} />
                        </TouchableOpacity>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator color={UCL_TEXT_PRIMARY} style={styles.loader} />
                ) : (
                    <BottomSheetFlatList
                        style={styles.listFlex}
                        data={users}
                        keyExtractor={(item, index) => `${item.handle}-${index}`}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <Text style={styles.empty}>No tagged users found</Text>
                        }
                    />
                )}
            </View>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    body: {
        flex: 1,
    },
    headerBlock: {
        zIndex: 2,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: UCL_CANVAS_NAVY,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingRight: 12,
    },
    headerCopy: {
        flex: 1,
        minWidth: 0,
    },
    closeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
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
    listFlex: {
        flex: 1,
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
