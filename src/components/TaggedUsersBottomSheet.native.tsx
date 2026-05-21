import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Pressable,
    StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { unifiedSearch } from '../api/search';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';

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

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.handleBar} />
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.headerIcon}>
                                <Icon name="people" size={20} color="#E5E7EB" />
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
                            <Icon name="close" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator color="#7A8AF0" style={styles.loader} />
                    ) : (
                        <FlatList
                            data={users}
                            keyExtractor={(item) => item.handle}
                            contentContainerStyle={styles.list}
                            ListEmptyComponent={
                                <Text style={styles.empty}>No tagged users found</Text>
                            }
                            renderItem={({ item }) => (
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
                            )}
                        />
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '80%',
        backgroundColor: '#0b1220',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 24,
    },
    handleBar: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#4B5563',
        marginTop: 10,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
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
        fontWeight: '700',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 12,
        color: '#9CA3AF',
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
        color: '#F3F4F6',
    },
    handle: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 2,
    },
    empty: {
        textAlign: 'center',
        color: '#6B7280',
        paddingVertical: 24,
    },
});
