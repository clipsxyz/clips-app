import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    BottomSheetFlatList,
    BottomSheetTextInput,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStickers, STICKER_CATEGORIES, searchStickers } from '../api/stickers';
import type { Sticker } from '../types';
import {
    UCL_CANVAS_NAVY,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
    glassSearch,
    glassSurface,
} from '../theme/gazetteerAmbientNative';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_INBOX } from './GazetteerBottomSheetModal.native';

type Props = {
    visible: boolean;
    onClose: () => void;
    onSelectSticker: (sticker: Sticker) => void;
    onAddText?: () => void;
};

export default function StickerPickerNative({ visible, onClose, onSelectSticker, onAddText }: Props) {
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('Emoji');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setSearchQuery('');
        setSelectedCategory('Emoji');
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const list = searchQuery.trim()
                    ? await searchStickers(searchQuery.trim())
                    : await getStickers(selectedCategory);
                if (!cancelled) setStickers(list);
            } catch {
                if (!cancelled) setStickers([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        const timer = setTimeout(load, searchQuery.trim() ? 200 : 0);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [visible, selectedCategory, searchQuery]);

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['82%']}
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_INBOX.background}
            handleIndicatorStyle={GAZETTEER_SHEET_INBOX.handle}
            backdropOpacity={0.75}
        >
            <BottomSheetView style={styles.headerBlock}>
                <View style={styles.header}>
                    <Text style={styles.title}>Stickers</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Icon name="close" size={24} color={UCL_TEXT_PRIMARY} />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchRow}>
                    <Icon name="search" size={18} color={UCL_TEXT_PRIMARY} />
                    <BottomSheetTextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search stickers..."
                        placeholderTextColor={UCL_TEXT_PLACEHOLDER}
                        style={styles.searchInput}
                    />
                </View>

                {!searchQuery.trim() && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categories}
                    >
                        {STICKER_CATEGORIES.map((category) => {
                            const active = selectedCategory === category;
                            return (
                                <TouchableOpacity
                                    key={category}
                                    onPress={() => setSelectedCategory(category)}
                                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                                >
                                    <Text
                                        style={[
                                            styles.categoryChipText,
                                            active && styles.categoryChipTextActive,
                                        ]}
                                    >
                                        {category}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {onAddText ? (
                    <TouchableOpacity style={styles.addTextBtn} onPress={onAddText}>
                        <Icon name="text" size={18} color={UCL_CANVAS_NAVY} />
                        <Text style={styles.addTextBtnLabel}>Add Text</Text>
                    </TouchableOpacity>
                ) : null}
            </BottomSheetView>

            {isLoading ? (
                <BottomSheetView>
                    <ActivityIndicator color={UCL_TEXT_PRIMARY} style={styles.loader} />
                </BottomSheetView>
            ) : (
                <BottomSheetFlatList
                    data={stickers}
                    keyExtractor={(item) => item.id}
                    numColumns={6}
                    contentContainerStyle={styles.grid}
                    columnWrapperStyle={styles.gridRow}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={<Text style={styles.empty}>No stickers found</Text>}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.stickerCell}
                            onPress={() => {
                                onSelectSticker(item);
                                onClose();
                            }}
                        >
                            {item.emoji ? (
                                <Text style={styles.emoji}>{item.emoji}</Text>
                            ) : (
                                <Text style={styles.emojiFallback} numberOfLines={1}>
                                    {item.name}
                                </Text>
                            )}
                            {item.isTrending ? <View style={styles.trendDot} /> : null}
                        </TouchableOpacity>
                    )}
                />
            )}
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    headerBlock: {
        paddingBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 8,
    },
    title: { color: UCL_TEXT_PRIMARY, fontSize: 18, fontWeight: '600' },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        ...glassSearch,
    },
    searchInput: { flex: 1, color: UCL_TEXT_PRIMARY, fontSize: 15 },
    categories: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
    categoryChip: {
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        ...glassSurface,
    },
    categoryChipActive: {
        backgroundColor: '#FFFFFF',
        borderColor: 'rgba(255,255,255,0.9)',
    },
    categoryChipText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
    categoryChipTextActive: { color: UCL_CANVAS_NAVY, fontWeight: '700' },
    addTextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 10,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
    },
    addTextBtnLabel: { color: UCL_CANVAS_NAVY, fontWeight: '700', fontSize: 15 },
    loader: { marginVertical: 24 },
    grid: { paddingHorizontal: 12, paddingBottom: 16 },
    gridRow: { gap: 8, marginBottom: 8 },
    stickerCell: {
        flex: 1,
        aspectRatio: 1,
        maxWidth: '16.66%',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    emoji: { fontSize: 28 },
    emojiFallback: { color: '#E2E8F0', fontSize: 10, paddingHorizontal: 4, textAlign: 'center' },
    trendDot: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EF4444',
    },
    empty: { color: UCL_TEXT_PLACEHOLDER, textAlign: 'center', padding: 24 },
});
