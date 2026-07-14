import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { unifiedSearch } from '../api/search';
import Avatar from './Avatar.native';
import StoryModalShell from './StoryModalShell.native';

type Props = {
    visible: boolean;
    onClose: () => void;
    onSelectUser: (handle: string, displayName: string) => void;
    taggedUsers: string[];
};

export default function UserTaggingModalNative({
    visible,
    onClose,
    onSelectUser,
    taggedUsers,
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<
        Array<{ handle: string; displayName?: string; avatarUrl?: string }>
    >([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setSearchQuery('');
        setUsers([]);
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        const q = searchQuery.trim().replace(/^@/, '');
        if (!q) {
            setUsers([]);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const result = await unifiedSearch({ q, types: 'users', usersLimit: 20 });
                const items = ((result as any)?.sections?.users?.items || []) as any[];
                const queryLower = q.toLowerCase();
                const mapped = items
                    .map((u) => ({
                        handle: String(u?.handle || '').trim(),
                        displayName:
                            String(u?.display_name || u?.displayName || u?.handle || '').trim() ||
                            undefined,
                        avatarUrl: u?.avatar_url || u?.avatarUrl,
                    }))
                    .filter((u) => u.handle)
                    .filter((u) => {
                        const h = u.handle.toLowerCase();
                        const n = (u.displayName || '').toLowerCase();
                        return h.includes(queryLower) || n.includes(queryLower);
                    });
                if (!cancelled) setUsers(mapped);
            } catch {
                if (!cancelled) setUsers([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }, 200);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [visible, searchQuery]);

    return (
        <StoryModalShell visible={visible} onRequestClose={onClose}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Icon name="person-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.title}>Tag People</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                    <Icon name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
                <Icon name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by handle (e.g., sarah or sarah@artane)..."
                    placeholderTextColor="#6B7280"
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" style={styles.loader} />
                ) : users.length === 0 ? (
                    <Text style={styles.empty}>
                        {searchQuery.trim() ? 'No users found' : 'Search for users to tag'}
                    </Text>
                ) : (
                    users.map((user) => {
                        const isTagged = taggedUsers.includes(user.handle);
                        return (
                            <TouchableOpacity
                                key={user.handle}
                                style={[styles.userRow, isTagged && styles.userRowTagged]}
                                disabled={isTagged}
                                onPress={() => {
                                    onSelectUser(user.handle, user.displayName || user.handle);
                                    onClose();
                                }}
                            >
                                <Avatar
                                    src={user.avatarUrl}
                                    name={user.displayName || user.handle}
                                    size={40}
                                />
                                <View style={styles.userCopy}>
                                    <Text style={styles.userName}>
                                        {user.displayName || user.handle}
                                    </Text>
                                    <Text style={styles.userHandle}>{user.handle}</Text>
                                </View>
                                {isTagged ? <Text style={styles.taggedBadge}>Tagged</Text> : null}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </StoryModalShell>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 12 },
    list: { maxHeight: 320 },
    loader: { marginVertical: 24 },
    empty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 24, fontSize: 14 },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: '#000000',
        marginBottom: 8,
    },
    userRowTagged: { opacity: 0.5, backgroundColor: 'rgba(255,255,255,0.05)' },
    userCopy: { flex: 1 },
    userName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    userHandle: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
    taggedBadge: { color: '#c4b5fd', fontSize: 12, fontWeight: '600' },
});
