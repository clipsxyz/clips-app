import React, { useEffect, useState } from 'react';
import { gazetteerAlert } from '../utils/gazetteerAlertNative';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Avatar from './Avatar';
import {
    UCL_CANVAS_NAVY,
    UCL_SHEET_GRADIENT,
    UCL_SHEET_GRADIENT_LOCATIONS,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
} from '../theme/gazetteerAmbientNative';

export type ConnectionsScope = 'mutual' | 'followers' | 'following' | 'suggested';

export type ConnectionRow = {
    handleNoAt: string;
    displayName: string;
    avatarUrl?: string;
    isRequested?: boolean;
    isPrivate?: boolean;
    isFollowing?: boolean;
    suggestionReason?: string;
    mutualCount?: number;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    scope: ConnectionsScope;
    onScopeChange: (scope: ConnectionsScope) => void;
    search: string;
    onSearchChange: (value: string) => void;
    rows: ConnectionRow[];
    loading: boolean;
    loadingMore: boolean;
    viewerHandle?: string;
    followMap: Record<string, boolean>;
    requestMap: Record<string, boolean>;
    actionLoadingMap: Record<string, boolean>;
    /** Signed-in user is looking at their own followers / following. */
    viewerOwnsList?: boolean;
    onToggleFollow: (handleNoAt: string, nextFollowing: boolean) => Promise<void> | void;
    onRemoveFollower?: (handleNoAt: string) => Promise<void> | void;
    onDismissSuggested?: (handleNoAt: string) => void;
    onUndoDismissSuggested?: (handleNoAt: string) => void;
    onOpenProfile: (handleNoAt: string) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
};

const TABS: { id: ConnectionsScope; label: string }[] = [
    { id: 'mutual', label: 'Mutual' },
    { id: 'followers', label: 'Followers' },
    { id: 'following', label: 'Following' },
    { id: 'suggested', label: 'Suggested' },
];

function ConnectionFollowButton({
    handle,
    initialFollowing,
    initialRequested,
    followBack,
    showRemove,
    busy,
    onToggle,
    onRemove,
    onError,
}: {
    handle: string;
    initialFollowing: boolean;
    initialRequested: boolean;
    followBack: boolean;
    showRemove: boolean;
    busy?: boolean;
    onToggle: (handle: string, nextFollowing: boolean) => Promise<void> | void;
    onRemove?: (handle: string) => Promise<void> | void;
    onError: (message: string) => void;
}) {
    const [isFollowing, setIsFollowing] = useState(initialFollowing);
    const [requested, setRequested] = useState(initialRequested);
    const inFlight = React.useRef(false);

    useEffect(() => {
        if (inFlight.current) return;
        setIsFollowing(initialFollowing);
        setRequested(initialRequested);
    }, [handle, initialFollowing, initialRequested]);

    const toggle = () => {
        if (inFlight.current || busy) return;
        const nextFollowing = !(isFollowing || requested);
        const prevFollowing = isFollowing;
        const prevRequested = requested;
        setIsFollowing(nextFollowing);
        setRequested(false);
        inFlight.current = true;
        Promise.resolve(onToggle(handle, nextFollowing))
            .catch(() => {
                setIsFollowing(prevFollowing);
                setRequested(prevRequested);
                onError('Couldn’t update follow');
            })
            .finally(() => {
                inFlight.current = false;
            });
    };

    const confirmRemove = () => {
        if (!onRemove || inFlight.current || busy) return;
        gazetteerAlert('Remove follower?', `Remove @${handle.replace(/^@/, '')} from your followers?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    inFlight.current = true;
                    Promise.resolve(onRemove(handle))
                        .catch(() => onError('Couldn’t remove follower'))
                        .finally(() => {
                            inFlight.current = false;
                        });
                },
            },
        ]);
    };

    const label = isFollowing ? 'Following' : requested ? 'Requested' : followBack ? 'Follow Back' : 'Follow';
    const filled = !isFollowing && !requested;

    return (
        <View style={styles.actionRow}>
            <Pressable
                style={[styles.followBtn, !filled && styles.followBtnFollowing]}
                onPress={(event) => {
                    event?.stopPropagation?.();
                    toggle();
                }}
            >
                <Text style={[styles.followBtnText, !filled && styles.followBtnTextFollowing]} numberOfLines={1}>
                    {label}
                </Text>
            </Pressable>
            {showRemove ? (
                <Pressable
                    style={styles.removeBtn}
                    onPress={(event) => {
                        event?.stopPropagation?.();
                        confirmRemove();
                    }}
                    accessibilityLabel={`Remove @${handle}`}
                >
                    <Icon name="person-remove-outline" size={16} color="#E2E8F0" />
                </Pressable>
            ) : null}
        </View>
    );
}

function scopeTitle(scope: ConnectionsScope): string {
    switch (scope) {
        case 'mutual':
            return 'Mutual';
        case 'suggested':
            return 'Suggested';
        case 'followers':
            return 'Followers';
        default:
            return 'Following';
    }
}

/** Web ViewProfile connections modal — full-screen Mutual / Followers / Following / Suggested. */
export default function ViewProfileConnectionsModal({
    visible,
    onClose,
    scope,
    onScopeChange,
    search,
    onSearchChange,
    rows,
    loading,
    loadingMore,
    viewerHandle,
    followMap,
    requestMap,
    actionLoadingMap,
    viewerOwnsList = false,
    onToggleFollow,
    onRemoveFollower,
    onDismissSuggested,
    onUndoDismissSuggested,
    onOpenProfile,
    onLoadMore,
    hasMore,
}: Props) {
    const insets = useSafeAreaInsets();
    // Android Modals with statusBarTranslucent often report insets.top as 0.
    const topPad = Math.max(
        insets.top,
        Platform.OS === 'android' ? StatusBar.currentHeight ?? 28 : 0,
        12,
    ) + 8;
    const activeTabIndex = Math.max(
        0,
        TABS.findIndex((t) => t.id === scope),
    );
    const viewerKey = String(viewerHandle || '')
        .replace(/^@/, '')
        .trim()
        .toLowerCase();
    const [toast, setToast] = useState<string | null>(null);
    const [undoHandle, setUndoHandle] = useState<string | null>(null);
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => {
            setToast(null);
            setUndoHandle(null);
        }, undoHandle ? 4200 : 2200);
        return () => clearTimeout(timer);
    }, [toast, undoHandle]);
    const showNotice = (message: string, undo?: string | null) => {
        setUndoHandle(undo || null);
        setToast(message);
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <LinearGradient
                colors={[...UCL_SHEET_GRADIENT]}
                locations={[...UCL_SHEET_GRADIENT_LOCATIONS]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={[styles.root, { paddingTop: topPad }]}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>{scopeTitle(scope)}</Text>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close connections">
                        <Icon name="close" size={20} color={UCL_TEXT_PRIMARY} />
                    </TouchableOpacity>
                </View>

                <View style={styles.tabsWrap}>
                    <View style={styles.tabsRow}>
                        {TABS.map((tab) => {
                            const active = scope === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={styles.tabBtn}
                                    onPress={() => onScopeChange(tab.id)}
                                >
                                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <View style={styles.tabIndicatorTrack}>
                        {TABS.map((tab, index) => (
                            <View key={`ind-${tab.id}`} style={styles.tabIndicatorSlot}>
                                {index === activeTabIndex ? <View style={styles.tabIndicator} /> : null}
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.searchWrap}>
                    <Icon name="search" size={16} color={UCL_TEXT_PRIMARY} />
                    <TextInput
                        value={search}
                        onChangeText={onSearchChange}
                        placeholder={`Search ${scope}`}
                        placeholderTextColor={UCL_TEXT_PLACEHOLDER}
                        style={styles.searchInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <ScrollView
                    style={styles.list}
                    contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
                    keyboardShouldPersistTaps="handled"
                >
                    {loading ? (
                        <View style={styles.skeletonList}>
                            {Array.from({ length: 7 }).map((_, idx) => (
                                <View key={`sk-${idx}`} style={styles.skeletonRow}>
                                    <View style={styles.skeletonAvatar} />
                                    <View style={styles.skeletonTextCol}>
                                        <View style={styles.skeletonLineWide} />
                                        <View style={styles.skeletonLineNarrow} />
                                    </View>
                                    <View style={styles.skeletonBtn} />
                                </View>
                            ))}
                        </View>
                    ) : rows.length === 0 ? (
                        <Text style={styles.emptyText}>
                            {search.trim() ? 'No people match your search.' : `No ${scope} yet.`}
                        </Text>
                    ) : (
                        rows.map((row) => {
                            const key = row.handleNoAt;
                            const isOwnRow =
                                !!viewerKey &&
                                key.replace(/^@/, '').trim().toLowerCase() === viewerKey;
                            const following =
                                followMap[key] === true ||
                                (followMap[key] == null && row.isFollowing === true);
                            const requested = requestMap[key] === true || !!row.isRequested;
                            const actionLoading = !!actionLoadingMap[key];
                            return (
                                <View key={key} style={styles.row}>
                                    <Pressable
                                        style={styles.rowLeft}
                                        onPress={() => onOpenProfile(key)}
                                    >
                                        <Avatar
                                            src={row.avatarUrl}
                                            name={row.displayName || key}
                                            size="md"
                                        />
                                        <View style={styles.rowText}>
                                            <Text style={styles.rowName} numberOfLines={1}>
                                                {row.displayName || key}
                                            </Text>
                                            <Text style={styles.rowHandle} numberOfLines={1}>
                                                @{key.replace(/^@/, '')}
                                            </Text>
                                            {scope === 'suggested' && row.suggestionReason ? (
                                                <Text style={styles.rowMeta} numberOfLines={1}>
                                                    {row.suggestionReason}
                                                </Text>
                                            ) : null}
                                            {requested && !following ? (
                                                <View style={styles.privateBadge}>
                                                    <Icon name="lock-closed" size={10} color="#E2E8F0" />
                                                    <Text style={styles.privateBadgeText}>Private account</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </Pressable>
                                    {!isOwnRow ? (
                                        <View style={styles.actionRow}>
                                            {scope === 'suggested' && onDismissSuggested ? (
                                                <Pressable
                                                    style={styles.removeBtn}
                                                    onPress={(event) => {
                                                        event?.stopPropagation?.();
                                                        onDismissSuggested(key);
                                                        showNotice('Suggestion hidden', key);
                                                    }}
                                                    accessibilityLabel={`Hide @${key}`}
                                                >
                                                    <Icon name="close" size={16} color="#E2E8F0" />
                                                </Pressable>
                                            ) : null}
                                            <ConnectionFollowButton
                                                handle={key}
                                                initialFollowing={following}
                                                initialRequested={requested}
                                                followBack={scope === 'followers' && !following}
                                                showRemove={viewerOwnsList && scope === 'followers'}
                                                busy={actionLoading}
                                                onToggle={onToggleFollow}
                                                onRemove={onRemoveFollower}
                                                onError={(message) => showNotice(message)}
                                            />
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })
                    )}

                    {!search.trim() && hasMore && onLoadMore ? (
                        <TouchableOpacity
                            style={styles.loadMoreBtn}
                            disabled={loadingMore}
                            onPress={onLoadMore}
                        >
                            {loadingMore ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.loadMoreText}>Load more</Text>
                            )}
                        </TouchableOpacity>
                    ) : null}
                </ScrollView>
                {toast ? (
                    <Pressable
                        style={[styles.toast, { bottom: Math.max(insets.bottom, 16) + 8 }]}
                        onPress={() => {
                            if (!undoHandle || !onUndoDismissSuggested) return;
                            onUndoDismissSuggested(undoHandle);
                            setUndoHandle(null);
                            setToast(null);
                        }}
                    >
                        <Text style={styles.toastText}>
                            {toast}
                            {undoHandle ? '  Undo' : ''}
                        </Text>
                    </Pressable>
                ) : null}
            </LinearGradient>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: UCL_CANVAS_NAVY,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: UCL_TEXT_PRIMARY,
    },
    closeBtn: {
        padding: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabsWrap: {
        paddingHorizontal: 8,
        marginTop: 4,
    },
    tabsRow: {
        flexDirection: 'row',
    },
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        paddingBottom: 10,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#E2E8F0',
    },
    tabTextActive: {
        fontSize: 16,
        color: UCL_TEXT_PRIMARY,
    },
    tabIndicatorTrack: {
        flexDirection: 'row',
        height: 3,
    },
    tabIndicatorSlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    tabIndicator: {
        height: 3,
        width: '70%',
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
    },
    searchWrap: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: UCL_TEXT_PRIMARY,
        fontSize: 14,
        paddingVertical: 10,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    skeletonList: {
        gap: 8,
    },
    skeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    skeletonAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    skeletonTextCol: {
        flex: 1,
        gap: 6,
    },
    skeletonLineWide: {
        height: 12,
        width: '55%',
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    skeletonLineNarrow: {
        height: 10,
        width: '40%',
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    skeletonBtn: {
        width: 84,
        height: 28,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    emptyText: {
        textAlign: 'center',
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: 14,
        marginTop: 64,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginBottom: 8,
    },
    rowLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
    rowName: {
        color: UCL_TEXT_PRIMARY,
        fontSize: 14,
        fontWeight: '700',
    },
    rowHandle: {
        color: '#E2E8F0',
        fontSize: 12,
        marginTop: 1,
    },
    rowMeta: {
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: 11,
        marginTop: 2,
    },
    privateBadge: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    privateBadgeText: {
        color: '#E2E8F0',
        fontSize: 10,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    removeBtn: {
        width: 32,
        height: 32,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    toast: {
        position: 'absolute',
        alignSelf: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    followBtn: {
        minWidth: 108,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    followBtnFollowing: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.25)',
    },
    followBtnRequested: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.2)',
    },
    followBtnText: {
        color: UCL_CANVAS_NAVY,
        fontSize: 12,
        fontWeight: '700',
        zIndex: 1,
    },
    followBtnTextFollowing: {
        color: UCL_TEXT_PRIMARY,
    },
    followBtnTextRequested: {
        color: '#E2E8F0',
    },
    loadMoreBtn: {
        marginTop: 8,
        marginBottom: 12,
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    loadMoreText: {
        color: UCL_TEXT_PRIMARY,
        fontSize: 13,
        fontWeight: '600',
    },
});
