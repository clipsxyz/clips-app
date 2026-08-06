import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Collection, Post } from '../types';
import {
    addPostToCollection,
    createCollection,
    getCollectionsForPost,
    getCollectionThumbnailUrl,
    getUserCollections,
    removePostFromCollection,
    resolvePostThumbnail,
    savePostToDefaultCollection,
} from '../api/collections';
import { mockFeedVideoSource } from '../constants/mockFeedVideos';
import {
    getPostBodyText,
    getTextOnlyBackgroundColor,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';

const DEFAULT_COLLECTION_NAME = 'All Posts';
/** Instagram-style sheet (light surface, dark type). */
const IG = {
    sheet: '#FFFFFF',
    handle: '#DBDBDB',
    text: '#262626',
    muted: '#8E8E8E',
    border: '#EFEFEF',
    blue: '#0095F6',
    chipBg: '#FAFAFA',
    plusBg: '#EFEFEF',
};

type Props = {
    post: Post;
    userId: string;
    visible: boolean;
    onClose: () => void;
    onSaved?: () => void;
};

export default function SavePostModal({ post, userId, visible, onClose, onSaved }: Props) {
    const insets = useSafeAreaInsets();
    const [collections, setCollections] = useState<Collection[]>([]);
    const [postCollectionIds, setPostCollectionIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [mode, setMode] = useState<'picker' | 'create'>('picker');
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    /** Ignore backdrop presses until the open animation finishes. */
    const [backdropArmed, setBackdropArmed] = useState(false);
    const autoSavedRef = useRef(false);
    const nameInputRef = useRef<TextInput>(null);

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
        if (!visible || !userId) {
            setBackdropArmed(false);
            setMode('picker');
            setNewName('');
            return;
        }
        autoSavedRef.current = false;
        setBackdropArmed(false);
        setMode('picker');
        setNewName('');
        const t = setTimeout(() => setBackdropArmed(true), 420);
        void load();
        return () => clearTimeout(t);
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

    useEffect(() => {
        if (mode !== 'create' || !visible) return;
        const t = setTimeout(() => nameInputRef.current?.focus(), 280);
        return () => clearTimeout(t);
    }, [mode, visible]);

    const defaultCollection = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
    const customCollections = collections.filter((c) => c.name !== DEFAULT_COLLECTION_NAME);
    const savedToAll = !!(defaultCollection && postCollectionIds.includes(defaultCollection.id));
    const previewUrl = resolvePostThumbnail(post);
    const videoPreviewUrl =
        isVideoPost(post) && !previewUrl
            ? post.mediaItems?.find((item) => item?.type === 'video' && item.url)?.url || post.mediaUrl
            : undefined;
    const textPreviewBody = isTextOnlyPost(post) ? getPostBodyText(post) : '';

    const postPreviewThumb =
        previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.cardThumbImg} />
        ) : videoPreviewUrl ? (
            <Video
                source={mockFeedVideoSource(videoPreviewUrl)}
                style={styles.cardThumbImg}
                resizeMode="cover"
                paused
                muted
                repeat={false}
                controls={false}
                playInBackground={false}
                playWhenInactive={false}
                ignoreSilentSwitch="obey"
                disableFocus
                pointerEvents="none"
            />
        ) : textPreviewBody ? (
            <View
                style={[
                    styles.cardThumbImg,
                    styles.textThumbPreview,
                    { backgroundColor: getTextOnlyBackgroundColor(post) },
                ]}
            >
                <Text
                    style={[styles.textThumbPreviewBody, { color: getTextOnlyTextColor(post) }]}
                    numberOfLines={4}
                >
                    {textPreviewBody}
                </Text>
            </View>
        ) : (
            <Icon name="bookmark" size={28} color={IG.muted} />
        );

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

    const openCreate = () => {
        setNewName('');
        setMode('create');
    };

    const cancelCreate = () => {
        setNewName('');
        setMode('picker');
    };

    const createNew = async () => {
        const name = newName.trim();
        if (!name || creating) return;
        setCreating(true);
        try {
            await createCollection(userId, name, true, post.id, post);
            setNewName('');
            setMode('picker');
            await load();
            onSaved?.();
        } catch {
            Alert.alert('Collections', 'Could not create collection.');
        } finally {
            setCreating(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable
                    style={styles.backdrop}
                    disabled={!backdropArmed}
                    onPress={() => {
                        if (backdropArmed) onClose();
                    }}
                />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
                >
                    <View style={styles.handleWrap}>
                        <View style={styles.handle} />
                    </View>

                    {mode === 'create' ? (
                        <>
                            <View style={styles.createHeader}>
                                <Pressable onPress={cancelCreate} hitSlop={10} style={styles.headerSide}>
                                    <Text style={styles.headerAction}>Cancel</Text>
                                </Pressable>
                                <Text style={styles.createTitle}>New collection</Text>
                                <Pressable
                                    onPress={() => void createNew()}
                                    hitSlop={10}
                                    style={styles.headerSideRight}
                                    disabled={!newName.trim() || creating}
                                >
                                    {creating ? (
                                        <ActivityIndicator size="small" color={IG.blue} />
                                    ) : (
                                        <Text
                                            style={[
                                                styles.headerActionDone,
                                                !newName.trim() && styles.headerActionDisabled,
                                            ]}
                                        >
                                            Done
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                            <View style={styles.createBody}>
                                <View style={styles.createPreview}>
                                    {previewUrl ? (
                                        <Image source={{ uri: previewUrl }} style={styles.createPreviewImg} />
                                    ) : videoPreviewUrl ? (
                                        <Video
                                            source={mockFeedVideoSource(videoPreviewUrl)}
                                            style={styles.createPreviewImg}
                                            resizeMode="cover"
                                            paused
                                            muted
                                            repeat={false}
                                            controls={false}
                                            playInBackground={false}
                                            playWhenInactive={false}
                                            ignoreSilentSwitch="obey"
                                            disableFocus
                                            pointerEvents="none"
                                        />
                                    ) : textPreviewBody ? (
                                        <View
                                            style={[
                                                styles.createPreviewImg,
                                                styles.textThumbPreview,
                                                { backgroundColor: getTextOnlyBackgroundColor(post) },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.textThumbPreviewBody,
                                                    { color: getTextOnlyTextColor(post) },
                                                ]}
                                                numberOfLines={5}
                                            >
                                                {textPreviewBody}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Icon name="bookmark-outline" size={32} color={IG.muted} />
                                    )}
                                </View>
                                <TextInput
                                    ref={nameInputRef}
                                    style={styles.nameInput}
                                    value={newName}
                                    onChangeText={setNewName}
                                    placeholder="Collection name"
                                    placeholderTextColor={IG.muted}
                                    returnKeyType="done"
                                    onSubmitEditing={() => void createNew()}
                                    maxLength={60}
                                />
                                <Text style={styles.createHint}>
                                    Collections are private. Only you can see them.
                                </Text>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>Save</Text>
                                <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                                    <Icon name="close" size={22} color={IG.text} />
                                </Pressable>
                            </View>

                            {savedToAll ? (
                                <View style={styles.savedBanner}>
                                    <Icon name="checkmark-circle" size={18} color={IG.blue} />
                                    <Text style={styles.savedBannerText}>Saved</Text>
                                    <Text style={styles.savedBannerSub}>to All Posts</Text>
                                </View>
                            ) : loading ? (
                                <View style={styles.savedBanner}>
                                    <ActivityIndicator size="small" color={IG.blue} />
                                    <Text style={styles.savedBannerSub}>Saving…</Text>
                                </View>
                            ) : null}

                            <Text style={styles.sectionLabel}>Collections</Text>
                            <Text style={styles.sectionHint}>
                                Tap a collection to add this post, or create a new one.
                            </Text>

                            {loading && collections.length === 0 ? (
                                <ActivityIndicator color={IG.blue} style={{ marginVertical: 28 }} />
                            ) : (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.rail}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    <Pressable style={styles.card} onPress={openCreate}>
                                        <View style={[styles.cardThumb, styles.newThumb]}>
                                            <View style={styles.plusCircle}>
                                                <Icon name="add" size={28} color={IG.text} />
                                            </View>
                                        </View>
                                        <Text style={styles.cardLabel} numberOfLines={2}>
                                            New collection
                                        </Text>
                                    </Pressable>

                                    {defaultCollection ? (
                                        <Pressable
                                            style={styles.card}
                                            onPress={() => void toggle(defaultCollection.id)}
                                            disabled={savingId === defaultCollection.id}
                                        >
                                            <View style={styles.cardThumb}>
                                                {postPreviewThumb}
                                                {postCollectionIds.includes(defaultCollection.id) ? (
                                                    <View style={styles.selectedBadge}>
                                                        <Icon name="checkmark" size={16} color="#FFF" />
                                                    </View>
                                                ) : null}
                                                {savingId === defaultCollection.id ? (
                                                    <View style={styles.savingOverlay}>
                                                        <ActivityIndicator color="#FFF" />
                                                    </View>
                                                ) : null}
                                            </View>
                                            <Text style={styles.cardLabel} numberOfLines={2}>
                                                All Posts
                                            </Text>
                                        </Pressable>
                                    ) : null}

                                    {customCollections.map((c) => {
                                        const thumb = getCollectionThumbnailUrl(c);
                                        const inCol = postCollectionIds.includes(c.id);
                                        return (
                                            <Pressable
                                                key={c.id}
                                                style={styles.card}
                                                onPress={() => void toggle(c.id)}
                                                disabled={savingId === c.id}
                                            >
                                                <View style={styles.cardThumb}>
                                                    {thumb ? (
                                                        <Image
                                                            source={{ uri: thumb }}
                                                            style={styles.cardThumbImg}
                                                        />
                                                    ) : (
                                                        <Icon
                                                            name="folder-outline"
                                                            size={28}
                                                            color={IG.muted}
                                                        />
                                                    )}
                                                    {inCol ? (
                                                        <View style={styles.selectedBadge}>
                                                            <Icon name="checkmark" size={16} color="#FFF" />
                                                        </View>
                                                    ) : null}
                                                    {savingId === c.id ? (
                                                        <View style={styles.savingOverlay}>
                                                            <ActivityIndicator color="#FFF" />
                                                        </View>
                                                    ) : null}
                                                </View>
                                                <Text style={styles.cardLabel} numberOfLines={2}>
                                                    {c.name}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            <Pressable style={styles.newCollectionRow} onPress={openCreate}>
                                <View style={styles.newCollectionIcon}>
                                    <Icon name="add" size={20} color={IG.text} />
                                </View>
                                <Text style={styles.newCollectionText}>New collection</Text>
                                <Icon name="chevron-forward" size={18} color={IG.muted} />
                            </Pressable>
                        </>
                    )}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const CARD = 96;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
        backgroundColor: IG.sheet,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '78%',
        zIndex: 2,
        elevation: 12,
        paddingBottom: 8,
    },
    handleWrap: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 6,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: IG.handle,
    },
    pickerHeader: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingBottom: 8,
        minHeight: 44,
    },
    pickerTitle: {
        color: IG.text,
        fontSize: 16,
        fontWeight: '700',
    },
    closeBtn: {
        position: 'absolute',
        right: 14,
        top: 0,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    savedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginHorizontal: 16,
        marginBottom: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: IG.chipBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: IG.border,
    },
    savedBannerText: {
        color: IG.text,
        fontSize: 14,
        fontWeight: '700',
    },
    savedBannerSub: {
        color: IG.muted,
        fontSize: 14,
        fontWeight: '500',
    },
    sectionLabel: {
        color: IG.text,
        fontSize: 15,
        fontWeight: '700',
        paddingHorizontal: 16,
        marginBottom: 4,
    },
    sectionHint: {
        color: IG.muted,
        fontSize: 13,
        paddingHorizontal: 16,
        marginBottom: 14,
        lineHeight: 18,
    },
    rail: {
        paddingHorizontal: 16,
        gap: 14,
        paddingBottom: 8,
    },
    card: {
        width: CARD,
        alignItems: 'center',
    },
    cardThumb: {
        width: CARD,
        height: CARD,
        borderRadius: 12,
        backgroundColor: IG.plusBg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 8,
    },
    newThumb: {
        borderWidth: 1,
        borderColor: IG.border,
        borderStyle: 'dashed',
        backgroundColor: IG.chipBg,
    },
    plusCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: IG.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardThumbImg: {
        width: '100%',
        height: '100%',
    },
    textThumbPreview: {
        justifyContent: 'center',
        padding: 6,
    },
    textThumbPreviewBody: {
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 14,
    },
    cardLabel: {
        color: IG.text,
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 15,
    },
    selectedBadge: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: IG.blue,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    savingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    newCollectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        marginHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: IG.border,
        gap: 12,
    },
    newCollectionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: IG.plusBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newCollectionText: {
        flex: 1,
        color: IG.text,
        fontSize: 15,
        fontWeight: '600',
    },
    createHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: IG.border,
        minHeight: 48,
    },
    headerSide: {
        width: 72,
        alignItems: 'flex-start',
    },
    headerSideRight: {
        width: 72,
        alignItems: 'flex-end',
    },
    createTitle: {
        flex: 1,
        textAlign: 'center',
        color: IG.text,
        fontSize: 16,
        fontWeight: '700',
    },
    headerAction: {
        color: IG.text,
        fontSize: 15,
        fontWeight: '500',
    },
    headerActionDone: {
        color: IG.blue,
        fontSize: 15,
        fontWeight: '700',
    },
    headerActionDisabled: {
        opacity: 0.35,
    },
    createBody: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 12,
        alignItems: 'center',
    },
    createPreview: {
        width: 72,
        height: 72,
        borderRadius: 12,
        backgroundColor: IG.plusBg,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    createPreviewImg: {
        width: '100%',
        height: '100%',
    },
    nameInput: {
        width: '100%',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: IG.border,
        paddingVertical: 12,
        fontSize: 16,
        color: IG.text,
        textAlign: 'center',
        fontWeight: '500',
    },
    createHint: {
        marginTop: 14,
        color: IG.muted,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
});
