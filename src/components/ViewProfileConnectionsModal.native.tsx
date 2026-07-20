import React from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar';

export type ConnectionsScope = 'mutual' | 'followers' | 'following' | 'suggested';

export type ConnectionRow = {
    handleNoAt: string;
    displayName: string;
    avatarUrl?: string;
    isRequested?: boolean;
    isPrivate?: boolean;
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
    onToggleFollow: (handleNoAt: string) => void;
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
    onToggleFollow,
    onOpenProfile,
    onLoadMore,
    hasMore,
}: Props) {
    const insets = useSafeAreaInsets();
    const activeTabIndex = Math.max(
        0,
        TABS.findIndex((t) => t.id === scope),
    );
    const viewerKey = String(viewerHandle || '')
        .replace(/^@/, '')
        .trim()
        .toLowerCase();

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>{scopeTitle(scope)}</Text>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close connections">
                        <Icon name="close" size={20} color="#FFFFFF" />
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
                    <Icon name="search" size={16} color="#9CA3AF" />
                    <TextInput
                        value={search}
                        onChangeText={onSearchChange}
                        placeholder={`Search ${scope}`}
                        placeholderTextColor="#6B7280"
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
                            const following = followMap[key] === true;
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
                                                    <Icon name="lock-closed" size={10} color="#CBD5E1" />
                                                    <Text style={styles.privateBadgeText}>Private account</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </Pressable>
                                    {!isOwnRow ? (
                                        <TouchableOpacity
                                            style={[
                                                styles.followBtn,
                                                following && styles.followBtnFollowing,
                                                requested && !following && styles.followBtnRequested,
                                            ]}
                                            disabled={actionLoading}
                                            onPress={() => onToggleFollow(key)}
                                        >
                                            {actionLoading ? (
                                                <ActivityIndicator size="small" color={following ? '#FFFFFF' : '#000000'} />
                                            ) : (
                                                <Text
                                                    style={[
                                                        styles.followBtnText,
                                                        following && styles.followBtnTextFollowing,
                                                        requested && !following && styles.followBtnTextRequested,
                                                    ]}
                                                >
                                                    {following ? 'Following' : requested ? 'Requested' : 'Follow'}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
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
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
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
        fontWeight: '700',
        color: '#FFFFFF',
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
        color: 'rgba(255,255,255,0.65)',
    },
    tabTextActive: {
        fontSize: 16,
        color: '#FFFFFF',
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
        color: '#FFFFFF',
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
        color: '#6B7280',
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
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    rowHandle: {
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 1,
    },
    rowMeta: {
        color: '#9CA3AF',
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
        color: '#CBD5E1',
        fontSize: 10,
        fontWeight: '600',
    },
    followBtn: {
        minWidth: 88,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#06B6D4',
        borderWidth: 1,
        borderColor: 'rgba(34,211,238,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    followBtnFollowing: {
        backgroundColor: '#000000',
        borderColor: 'rgba(255,255,255,0.25)',
    },
    followBtnRequested: {
        backgroundColor: 'rgba(6,182,212,0.12)',
        borderColor: 'rgba(34,211,238,0.45)',
    },
    followBtnText: {
        color: '#000000',
        fontSize: 12,
        fontWeight: '700',
    },
    followBtnTextFollowing: {
        color: '#FFFFFF',
    },
    followBtnTextRequested: {
        color: '#A5F3FC',
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
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
});
