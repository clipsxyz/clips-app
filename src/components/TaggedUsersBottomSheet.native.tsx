import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { unifiedSearch } from '../api/search';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';
import GazetteerBottomSheetModal, {
    GAZETTEER_SHEET_PASSPORT,
} from './GazetteerBottomSheetModal.native';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';

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

const P = {
    text: '#e8eef2',
    muted: 'rgba(232, 238, 242, 0.62)',
    border: 'rgba(255,255,255,0.12)',
    chipBg: 'rgba(15, 36, 48, 0.72)',
    accent: PASSPORT_PALETTE.wavePrimary,
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
            setLoading(false);
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

    const openProfile = useCallback(
        (handle: string) => {
            onClose();
            onVisitProfile?.(handle);
        },
        [onClose, onVisitProfile],
    );

    const listHeader = useMemo(
        () => (
            <View style={styles.sheetChrome}>
                <View style={styles.header}>
                    <View style={styles.headerText}>
                        <Text style={styles.kicker}>Gazetteer</Text>
                        <Text style={styles.title}>Tagged people</Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={8}
                        accessibilityLabel="Close"
                    >
                        <Icon name="close" size={16} color={P.muted} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.subtitle}>
                    {taggedUserHandles.length}{' '}
                    {taggedUserHandles.length === 1 ? 'person' : 'people'} in this clip
                </Text>
                <View style={styles.listDivider} />
            </View>
        ),
        [onClose, taggedUserHandles.length],
    );

    const renderItem = useCallback(
        ({ item }: { item: TaggedUser }) => {
            const displayName = item.display_name || item.handle.split('@')[0];
            return (
                <View style={styles.row}>
                    <TouchableOpacity
                        style={styles.rowLeft}
                        onPress={() => openProfile(item.handle)}
                        disabled={!onVisitProfile}
                        activeOpacity={0.8}
                    >
                        <Avatar
                            src={item.avatar_url}
                            name={displayName}
                            handle={item.handle}
                            size="sm"
                        />
                        <View style={styles.nameCol}>
                            <Text style={styles.displayName} numberOfLines={1}>
                                {displayName}
                            </Text>
                            <Text style={styles.subHandle} numberOfLines={1}>
                                {item.handle}
                            </Text>
                        </View>
                    </TouchableOpacity>
                    {onVisitProfile ? (
                        <TouchableOpacity
                            style={styles.viewBtn}
                            onPress={() => openProfile(item.handle)}
                            accessibilityLabel={`View ${displayName}'s profile`}
                        >
                            <Text style={styles.viewBtnText}>View profile</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            );
        },
        [onVisitProfile, openProfile],
    );

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['70%']}
            backgroundStyle={GAZETTEER_SHEET_PASSPORT.background}
            handleIndicatorStyle={GAZETTEER_SHEET_PASSPORT.handle}
        >
            <PassportSheetCanvas style={styles.canvas} contentStyle={styles.canvasContent}>
                <View style={styles.body}>
                    {listHeader}
                    <BottomSheetFlatList
                        style={styles.listFlex}
                        data={loading ? [] : users}
                        keyExtractor={(item) => item.handle}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <Text style={styles.empty}>
                                {loading ? 'Loading…' : 'No tagged people yet.'}
                            </Text>
                        }
                    />
                </View>
            </PassportSheetCanvas>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    canvas: {
        flex: 1,
    },
    canvasContent: {
        flex: 1,
    },
    body: {
        flex: 1,
    },
    sheetChrome: {
        zIndex: 2,
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: 'rgba(6, 13, 22, 0.94)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    headerText: {
        flex: 1,
        minWidth: 0,
        paddingRight: 12,
    },
    kicker: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color: P.accent,
        marginBottom: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 12,
        color: P.muted,
        marginBottom: 12,
    },
    closeBtn: {
        padding: 6,
        borderRadius: 999,
    },
    listDivider: {
        marginHorizontal: -16,
        marginBottom: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: P.border,
    },
    listFlex: {
        flex: 1,
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        gap: 12,
    },
    rowLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
    },
    nameCol: {
        flex: 1,
        minWidth: 0,
    },
    displayName: {
        fontSize: 14,
        fontWeight: '600',
        color: P.text,
    },
    subHandle: {
        fontSize: 12,
        color: P.muted,
        marginTop: 2,
    },
    viewBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(61,155,143,0.35)',
        borderWidth: 1,
        borderColor: 'rgba(61,155,143,0.55)',
        flexShrink: 0,
    },
    viewBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: P.text,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    empty: {
        textAlign: 'center',
        fontSize: 12,
        color: P.muted,
        paddingVertical: 32,
    },
});
