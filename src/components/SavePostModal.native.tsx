import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    BottomSheetScrollView,
    BottomSheetTextInput,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Collection, Post } from '../types';
import {
    addPostToCollection,
    createCollection,
    getCollectionsForPost,
    getCollectionThumbnailUrl,
    getUserCollections,
    removePostFromCollection,
    savePostToDefaultCollection,
} from '../api/collections';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_SAVE } from './GazetteerBottomSheetModal.native';

const DEFAULT_COLLECTION_NAME = 'All Posts';

type Props = {
    post: Post;
    userId: string;
    visible: boolean;
    onClose: () => void;
    onSaved?: () => void;
};

export default function SavePostModal({ post, userId, visible, onClose, onSaved }: Props) {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [postCollectionIds, setPostCollectionIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const autoSavedRef = useRef(false);

    const load = async () => {
        setLoading(true);
        try {
            const userCollections = await getUserCollections(userId);
            setCollections(userCollections);
            const withPost = await getCollectionsForPost(userId, post.id);
            setPostCollectionIds(withPost.map((c) => c.id));
        } catch (e) {
            console.error('SavePostModal load failed:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!visible || !userId) return;
        autoSavedRef.current = false;
        void load();
    }, [visible, userId, post.id]);

    useEffect(() => {
        if (!visible || loading || autoSavedRef.current) return;
        const def = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
        if (!def || postCollectionIds.includes(def.id)) return;
        autoSavedRef.current = true;
        void (async () => {
            try {
                await savePostToDefaultCollection(userId, post.id, post);
                await load();
                onSaved?.();
            } catch (e) {
                console.error('Auto-save failed:', e);
            }
        })();
    }, [visible, loading, collections, postCollectionIds, userId, post.id]);

    const toggle = async (collectionId: string) => {
        setSavingId(collectionId);
        try {
            if (postCollectionIds.includes(collectionId)) {
                await removePostFromCollection(collectionId, post.id);
            } else {
                await addPostToCollection(collectionId, post.id, post);
            }
            await load();
            onSaved?.();
        } catch {
            Alert.alert('Save', 'Could not update collection.');
        } finally {
            setSavingId(null);
        }
    };

    const createNew = async () => {
        const name = newName.trim();
        if (!name) return;
        setLoading(true);
        try {
            await createCollection(userId, name, true, post.id, post);
            setNewName('');
            setCreating(false);
            await load();
            onSaved?.();
        } catch {
            Alert.alert('Collections', 'Could not create collection.');
        } finally {
            setLoading(false);
        }
    };

    const defaultCollection = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
    const customCollections = collections.filter((c) => c.name !== DEFAULT_COLLECTION_NAME);
    const previewUrl =
        post.videoPosterUrl ||
        post.mediaUrl ||
        post.mediaItems?.find((m) => m?.url)?.url;

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['85%']}
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_SAVE.background}
            handleIndicatorStyle={GAZETTEER_SHEET_SAVE.handle}
            backdropOpacity={0.55}
            keyboardBehavior="interactive"
            android_keyboardInputMode="adjustResize"
        >
            <BottomSheetView style={styles.header}>
                <Text style={styles.title}>Save Post</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => setCreating(true)} hitSlop={8}>
                        <Icon name="add" size={24} color="#E5E7EB" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <Icon name="close" size={24} color="#E5E7EB" />
                    </TouchableOpacity>
                </View>
            </BottomSheetView>

            <BottomSheetScrollView contentContainerStyle={styles.scroll}>
                {defaultCollection ? (
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => void toggle(defaultCollection.id)}
                        disabled={savingId === defaultCollection.id}
                    >
                        <View style={styles.thumb}>
                            {previewUrl ? (
                                <Image source={{ uri: previewUrl }} style={styles.thumbImg} />
                            ) : (
                                <Icon name="bookmark" size={28} color="#9CA3AF" />
                            )}
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>All Posts</Text>
                            <Text style={styles.rowSub}>Private — every saved post</Text>
                        </View>
                        {postCollectionIds.includes(defaultCollection.id) ? (
                            <Icon name="bookmark" size={22} color="#7A8AF0" />
                        ) : null}
                    </TouchableOpacity>
                ) : null}

                <Text style={styles.sectionTitle}>Collections</Text>

                {creating ? (
                    <View style={styles.createBox}>
                        <BottomSheetTextInput
                            style={styles.input}
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="Collection name"
                            placeholderTextColor="#6B7280"
                            autoFocus
                        />
                        <View style={styles.createActions}>
                            <TouchableOpacity style={styles.createBtn} onPress={() => void createNew()}>
                                <Text style={styles.createBtnText}>Create</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setCreating(false);
                                    setNewName('');
                                }}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}

                {loading && collections.length === 0 ? (
                    <ActivityIndicator color="#8B5CF6" style={{ marginVertical: 24 }} />
                ) : customCollections.length === 0 ? (
                    <Text style={styles.empty}>No collections yet. Create one to get started.</Text>
                ) : (
                    customCollections.map((c) => {
                        const thumb = getCollectionThumbnailUrl(c);
                        const inCol = postCollectionIds.includes(c.id);
                        return (
                            <TouchableOpacity
                                key={c.id}
                                style={styles.row}
                                onPress={() => void toggle(c.id)}
                                disabled={savingId === c.id}
                            >
                                <View style={styles.thumb}>
                                    {thumb ? (
                                        <Image source={{ uri: thumb }} style={styles.thumbImg} />
                                    ) : (
                                        <Icon name="folder-outline" size={26} color="#9CA3AF" />
                                    )}
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>{c.name}</Text>
                                    <Text style={styles.rowSub}>
                                        {c.postIds?.length ?? 0} posts
                                    </Text>
                                </View>
                                {inCol ? <Icon name="checkmark-circle" size={22} color="#7A8AF0" /> : null}
                            </TouchableOpacity>
                        );
                    })
                )}
            </BottomSheetScrollView>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerActions: { flexDirection: 'row', gap: 12 },
    title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    scroll: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24 },
    sectionTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderRadius: 12,
    },
    thumb: {
        width: 56,
        height: 56,
        borderRadius: 10,
        backgroundColor: '#374151',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbImg: { width: '100%', height: '100%' },
    rowText: { flex: 1 },
    rowTitle: { color: '#FFF', fontWeight: '600', fontSize: 15 },
    rowSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    createBox: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#111827',
        borderRadius: 10,
        padding: 12,
        color: '#FFF',
        marginBottom: 10,
    },
    createActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    createBtn: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    createBtnText: { color: '#FFF', fontWeight: '700' },
    cancelText: { color: '#9CA3AF', fontWeight: '600' },
    empty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
});
