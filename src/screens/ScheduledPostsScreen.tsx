import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {
    UCL_CANVAS_NAVY,
    UCL_SHEET_GRADIENT,
    UCL_SHEET_GRADIENT_LOCATIONS,
} from '../theme/gazetteerAmbientNative';
import GazetteerMenuSheet from '../components/GazetteerMenuSheet.native';
import SchedulePostSheet, { formatScheduleWhen } from '../components/SchedulePostSheet.native';
import { gazetteerAlert } from '../utils/gazetteerAlertNative';
import {
    cancelScheduledPost,
    fetchScheduledPosts,
    publishScheduledPostNow,
    reschedulePost,
    updatePost,
} from '../api/client';
import {
    cancelScheduledShort,
    fetchScheduledShorts,
    publishScheduledShortNow,
    rescheduleShort,
    updateScheduledShortCaption,
} from '../api/stories';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import CachedImage from '../components/CachedImage.native';
import { ox } from '../constants/nativeOpticalScale';

type ScheduledKind = 'post' | 'short';

type ScheduledItem = {
    id: string;
    kind: ScheduledKind;
    caption: string;
    when: Date | null;
    thumb?: string;
};

function readCaption(raw: any): string {
    const direct = raw?.caption || raw?.text_content || raw?.text || raw?.image_text || '';
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const stickers = Array.isArray(raw?.stickers) ? raw.stickers : [];
    for (const sticker of stickers) {
        const category = sticker?.sticker?.category || sticker?.category;
        const text = sticker?.textContent || sticker?.sticker?.name;
        if (category === 'Text' && typeof text === 'string' && text.trim()) return text.trim();
    }
    return '';
}

function readWhen(raw: any): Date | null {
    const value = raw?.scheduled_at || raw?.scheduledAt;
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

function readThumb(raw: any): string | undefined {
    const value = raw?.thumbnail_url || raw?.video_poster_url || (raw?.media_type === 'image' ? raw?.media_url : '');
    if (typeof value !== 'string' || !value.trim()) return undefined;
    return resolvePublicMediaUrl(value.trim());
}

function mapItem(raw: any, kind: ScheduledKind): ScheduledItem | null {
    const id = String(raw?.id || '').trim();
    if (!id) return null;
    return { id, kind, caption: readCaption(raw), when: readWhen(raw), thumb: readThumb(raw) };
}

function sameItem(row: ScheduledItem, item: ScheduledItem) {
    return row.kind === item.kind && row.id === item.id;
}

export default function ScheduledPostsScreen({ navigation }: { navigation: { goBack: () => void } }) {
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState<ScheduledItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<ScheduledItem | null>(null);
    const selectedRef = useRef<ScheduledItem | null>(null);
    const [rescheduleFor, setRescheduleFor] = useState<ScheduledItem | null>(null);
    const [captionFor, setCaptionFor] = useState<ScheduledItem | null>(null);
    const [captionDraft, setCaptionDraft] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const [posts, shorts] = await Promise.all([fetchScheduledPosts(), fetchScheduledShorts()]);
            const next = [
                ...posts.items.map((raw) => mapItem(raw, 'post')),
                ...shorts.items.map((raw) => mapItem(raw, 'short')),
            ].filter((item): item is ScheduledItem => item != null);
            next.sort((a, b) => (a.when?.getTime() || 0) - (b.when?.getTime() || 0));
            setItems(next);
        } catch (err: any) {
            setError(err?.message || 'Could not load scheduled posts.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            void load();
        }, [load]),
    );

    const run = async (id: string, action: () => Promise<void>) => {
        setBusyId(id);
        try {
            await action();
        } catch (err: any) {
            gazetteerAlert('Could not update', err?.message || 'Try again.');
        } finally {
            setBusyId(null);
        }
    };

    const postNow = (item: ScheduledItem) => {
        const where = item.kind === 'short' ? 'Shorts' : 'the newsfeed';
        gazetteerAlert('Post now?', `This publishes immediately and shows on ${where}.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Post now',
                onPress: () => {
                    void run(item.id, async () => {
                        if (item.kind === 'short') await publishScheduledShortNow(item.id);
                        else await publishScheduledPostNow(item.id);
                        setItems((prev) => prev.filter((row) => !sameItem(row, item)));
                    });
                },
            },
        ]);
    };

    const remove = (item: ScheduledItem) => {
        gazetteerAlert(
            item.kind === 'short' ? 'Delete scheduled Short?' : 'Delete scheduled post?',
            'It will not publish.',
            [
            { text: 'Keep', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    void run(item.id, async () => {
                        if (item.kind === 'short') await cancelScheduledShort(item.id);
                        else await cancelScheduledPost(item.id);
                        setItems((prev) => prev.filter((row) => !sameItem(row, item)));
                    });
                },
            },
        ]);
    };

    return (
        <LinearGradient
            colors={[...UCL_SHEET_GRADIENT]}
            locations={[...UCL_SHEET_GRADIENT_LOCATIONS]}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.88, y: 1 }}
            style={styles.root}
        >
            <View style={[styles.screen, { paddingTop: Math.max(insets.top, 8) }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
                        <Icon name="chevron-back" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scheduled</Text>
                </View>
                {loading ? (
                    <ActivityIndicator color="#FFFFFF" style={styles.loader} />
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={(item) => `${item.kind}:${item.id}`}
                        contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
                        ListEmptyComponent={
                            <Text style={styles.empty}>
                                {error || 'Posts and Shorts you schedule will wait here until they go live.'}
                            </Text>
                        }
                        renderItem={({ item }) => (
                            <View style={styles.row}>
                                {item.thumb ? (
                                    <CachedImage source={{ uri: item.thumb }} style={styles.thumb} />
                                ) : (
                                    <View style={styles.thumbFallback}>
                                        <Icon name="document-text-outline" size={20} color="#FFFFFF" />
                                    </View>
                                )}
                                <View style={styles.copy}>
                                    <Text style={styles.caption} numberOfLines={2}>
                                        {item.caption || 'No caption'}
                                    </Text>
                                    <Text style={styles.when}>
                                        {item.kind === 'short' ? 'Short' : 'Post'}
                                        {' · '}
                                        {item.when ? formatScheduleWhen(item.when) : 'Time not set'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        selectedRef.current = item;
                                        setSelected(item);
                                    }}
                                    disabled={busyId === item.id}
                                    accessibilityLabel="Scheduled post options"
                                    hitSlop={8}
                                >
                                    {busyId === item.id ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.options}>Options</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    />
                )}
            </View>

            <GazetteerMenuSheet
                visible={selected != null}
                title="Scheduled post"
                subtitle={selected?.when ? formatScheduleWhen(selected.when) : undefined}
                onDismiss={() => setSelected(null)}
                options={[
                    {
                        label: 'Post now',
                        icon: 'paper-plane-outline',
                        onPress: () => {
                            const item = selectedRef.current;
                            selectedRef.current = null;
                            if (item) postNow(item);
                        },
                    },
                    {
                        label: 'Reschedule',
                        icon: 'time-outline',
                        onPress: () => {
                            const item = selectedRef.current;
                            selectedRef.current = null;
                            setRescheduleFor(item);
                        },
                    },
                    {
                        label: 'Edit caption',
                        icon: 'create-outline',
                        onPress: () => {
                            const item = selectedRef.current;
                            selectedRef.current = null;
                            setCaptionFor(item);
                            setCaptionDraft(item?.caption || '');
                        },
                    },
                    {
                        label: 'Delete',
                        icon: 'trash-outline',
                        destructive: true,
                        onPress: () => {
                            const item = selectedRef.current;
                            selectedRef.current = null;
                            if (item) remove(item);
                        },
                    },
                ]}
            />

            <SchedulePostSheet
                visible={rescheduleFor != null}
                initial={rescheduleFor?.when ?? null}
                onClose={() => setRescheduleFor(null)}
                onConfirm={(when) => {
                    const item = rescheduleFor;
                    setRescheduleFor(null);
                    if (!item) return;
                    void run(item.id, async () => {
                        if (item.kind === 'short') await rescheduleShort(item.id, when.toISOString());
                        else await reschedulePost(item.id, when.toISOString());
                        setItems((prev) =>
                            prev
                                .map((row) => (sameItem(row, item) ? { ...row, when } : row))
                                .sort((a, b) => (a.when?.getTime() || 0) - (b.when?.getTime() || 0)),
                        );
                    });
                }}
            />

            <Modal visible={captionFor != null} transparent animationType="fade" onRequestClose={() => setCaptionFor(null)}>
                <Pressable style={styles.captionBackdrop} onPress={() => setCaptionFor(null)}>
                    <Pressable style={styles.captionSheet} onPress={() => {}}>
                        <Text style={styles.captionTitle}>Edit caption</Text>
                        <TextInput
                            value={captionDraft}
                            onChangeText={setCaptionDraft}
                            placeholder="Caption"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={styles.captionInput}
                            multiline
                            maxLength={500}
                            autoFocus
                        />
                        <TouchableOpacity
                            style={styles.captionSave}
                            onPress={() => {
                                const item = captionFor;
                                const next = captionDraft.trim();
                                setCaptionFor(null);
                                if (!item) return;
                                void run(item.id, async () => {
                                    if (item.kind === 'short') await updateScheduledShortCaption(item.id, next);
                                    else await updatePost(item.id, { text: next });
                                    setItems((prev) =>
                                        prev.map((row) => (sameItem(row, item) ? { ...row, caption: next } : row)),
                                    );
                                });
                            }}
                        >
                            <Text style={styles.captionSaveText}>Save</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: UCL_CANVAS_NAVY,
    },
    screen: {
        flex: 1,
        paddingHorizontal: ox(16),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        marginBottom: ox(16),
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: ox(20),
        fontWeight: '700',
    },
    loader: { marginTop: ox(32) },
    list: { paddingBottom: ox(24) },
    emptyWrap: { flexGrow: 1, justifyContent: 'center' },
    empty: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: ox(15),
        textAlign: 'center',
        paddingHorizontal: ox(12),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        paddingVertical: ox(12),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.15)',
    },
    thumb: {
        width: ox(52),
        height: ox(52),
        borderRadius: ox(10),
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    thumbFallback: {
        width: ox(52),
        height: ox(52),
        borderRadius: ox(10),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    copy: { flex: 1 },
    caption: {
        color: '#FFFFFF',
        fontSize: ox(15),
        fontWeight: '600',
    },
    when: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: ox(13),
        marginTop: 4,
    },
    options: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
    },
    captionBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    captionSheet: {
        padding: ox(20),
        paddingBottom: ox(28),
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        backgroundColor: '#16181D',
    },
    captionTitle: {
        color: '#FFFFFF',
        fontSize: ox(18),
        fontWeight: '700',
        marginBottom: ox(12),
    },
    captionInput: {
        minHeight: ox(96),
        borderRadius: 14,
        padding: ox(12),
        color: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.08)',
        textAlignVertical: 'top',
    },
    captionSave: {
        marginTop: ox(14),
        minHeight: ox(48),
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    captionSaveText: {
        color: '#111111',
        fontSize: ox(16),
        fontWeight: '700',
    },
});
