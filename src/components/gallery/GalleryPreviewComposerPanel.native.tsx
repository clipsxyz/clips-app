import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import PlaceAutocompleteField from '../PlaceAutocompleteField.native';
import type { LocationSuggestion } from '../../api/locations';
import { INSTANT_FILTER_NAMES, getFilterOverlayStyle, type InstantFilterName } from '../../utils/instantFiltersNative';
import type { LocalCarouselItem } from '../../utils/prepareCarouselMediaForPostNative';
import { TEXT_POST_BODY_MAX_LENGTH } from '../../constants';

export type GalleryPickerTab = 'caption' | 'location' | 'carousel' | 'filters';

const PICKER_TABS: Array<{ id: GalleryPickerTab; icon: string; title: string }> = [
    { id: 'caption', icon: 'text', title: 'Caption' },
    { id: 'location', icon: 'location', title: 'Location, venue, tag user' },
    { id: 'carousel', icon: 'albums', title: 'Add photos or videos' },
    { id: 'filters', icon: 'color-filter-outline', title: 'Filters' },
];

const CAROUSEL_MAX = 10;

function GradientField({
    colors,
    label,
    children,
}: {
    colors: [string, string, ...string[]];
    label: string;
    children: React.ReactNode;
}) {
    return (
        <LinearGradient colors={colors} style={styles.gradientRing}>
            <View style={styles.gradientInner}>
                <Text style={styles.fieldLabel}>{label}</Text>
                {children}
            </View>
        </LinearGradient>
    );
}

type Props = {
    cardTab: GalleryPickerTab;
    onCardTabChange: (tab: GalleryPickerTab) => void;
    cardBodyExpanded: boolean;
    onToggleExpanded: () => void;
    caption: string;
    onCaptionChange: (text: string) => void;
    mentionSuggestions: string[];
    onInsertMention: (handle: string) => void;
    location: string;
    venue: string;
    landmark: string;
    onLocationChange: (v: string) => void;
    onVenueChange: (v: string) => void;
    onLandmarkChange: (v: string) => void;
    onSelectLocation?: (suggestion: LocationSuggestion) => void;
    onSelectVenue?: (suggestion: LocationSuggestion) => void;
    onSelectLandmark?: (suggestion: LocationSuggestion) => void;
    taggedUsers: string[];
    onOpenTagModal: () => void;
    imageFilterName: InstantFilterName;
    onFilterChange: (name: InstantFilterName) => void;
    previewUri?: string;
    previewType?: 'image' | 'video';
    carouselItems: LocalCarouselItem[];
    carouselActiveIndex: number;
    onCarouselIndexChange: (index: number) => void;
    onAddCarousel: () => void;
    onRemoveCarouselItem: (index: number) => void;
    onReorderCarouselItems: (fromIndex: number, toIndex: number) => void;
    isSavingDraft: boolean;
    onSaveDraft: () => void;
    onOpenStickerPicker: () => void;
    onOpenTextSticker: () => void;
    canSave: boolean;
};

/** Web GalleryPreviewPage bottom sheet: snap picker + caption/location/carousel/filters. */
export default function GalleryPreviewComposerPanel({
    cardTab,
    onCardTabChange,
    cardBodyExpanded,
    onToggleExpanded,
    caption,
    onCaptionChange,
    mentionSuggestions,
    onInsertMention,
    location,
    venue,
    landmark,
    onLocationChange,
    onVenueChange,
    onLandmarkChange,
    onSelectLocation,
    onSelectVenue,
    onSelectLandmark,
    taggedUsers,
    onOpenTagModal,
    imageFilterName,
    onFilterChange,
    previewUri,
    previewType,
    carouselItems,
    carouselActiveIndex,
    onCarouselIndexChange,
    onAddCarousel,
    onRemoveCarouselItem,
    onReorderCarouselItems,
    isSavingDraft,
    onSaveDraft,
    onOpenStickerPicker,
    onOpenTextSticker,
    canSave,
}: Props) {
    const thumbRectsRef = useRef<Array<{ x: number; width: number }>>([]);
    const thumbHostRefs = useRef<Array<View | null>>([]);
    const draggingIndexRef = useRef<number | null>(null);
    const onReorderRef = useRef(onReorderCarouselItems);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    onReorderRef.current = onReorderCarouselItems;

    const setDragging = (index: number | null) => {
        draggingIndexRef.current = index;
        setDraggingIndex(index);
    };

    const handleTabPress = (tab: GalleryPickerTab) => {
        onCardTabChange(tab);
        if (!cardBodyExpanded) onToggleExpanded();
    };

    const findThumbIndexAtX = (pageX: number) => {
        for (let i = 0; i < thumbRectsRef.current.length; i++) {
            const rect = thumbRectsRef.current[i];
            if (!rect) continue;
            if (pageX >= rect.x && pageX <= rect.x + rect.width) return i;
        }
        return null;
    };

    const carouselPanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: () => draggingIndexRef.current !== null,
            onPanResponderMove: (evt) => {
                const from = draggingIndexRef.current;
                if (from === null) return;
                const target = findThumbIndexAtX(evt.nativeEvent.pageX);
                if (target === null || target === from) return;
                onReorderRef.current(from, target);
                setDragging(target);
            },
            onPanResponderRelease: () => setDragging(null),
            onPanResponderTerminate: () => setDragging(null),
        }),
    ).current;

    return (
        <View style={styles.sheet}>
            <TouchableOpacity style={styles.grabberRow} onPress={onToggleExpanded} activeOpacity={0.85}>
                <View style={styles.grabber} />
                <Text style={styles.grabberHint}>
                    {cardBodyExpanded ? 'Drag down to collapse' : 'Tap to expand'}
                </Text>
            </TouchableOpacity>

            <View style={styles.pickerHeader}>
                <View style={styles.pickerRail}>
                    {PICKER_TABS.map((tab) => {
                        const isActive = cardTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={styles.pickerSlot}
                                onPress={() => handleTabPress(tab.id)}
                                accessibilityLabel={tab.title}
                            >
                                <View style={[styles.pickerRing, isActive && styles.pickerRingActive]}>
                                    <View style={[styles.pickerDisc, isActive && styles.pickerDiscActive]}>
                                        <Icon name={tab.icon} size={20} color="#FFFFFF" />
                                    </View>
                                </View>
                                {tab.id === 'carousel' && carouselItems.length > 0 ? (
                                    <View style={styles.carouselBadge}>
                                        <Text style={styles.carouselBadgeText}>{carouselItems.length}</Text>
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, isSavingDraft && styles.saveBtnActive]}
                    onPress={onSaveDraft}
                    disabled={!canSave || isSavingDraft}
                    accessibilityLabel={isSavingDraft ? 'Saving draft' : 'Save to drafts'}
                >
                    {isSavingDraft ? (
                        <ActivityIndicator size="small" color="#111827" />
                    ) : (
                        <Icon
                            name="bookmark-outline"
                            size={20}
                            color={canSave ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
                        />
                    )}
                </TouchableOpacity>
            </View>

            {cardBodyExpanded ? (
                <ScrollView
                    style={styles.body}
                    contentContainerStyle={styles.bodyContent}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                >
                    {cardTab === 'caption' ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Caption</Text>
                            <LinearGradient
                                colors={['#404040', '#d4d4d4']}
                                style={styles.gradientRing}
                            >
                                <View style={styles.captionInner}>
                                    <TextInput
                                        value={caption}
                                        onChangeText={onCaptionChange}
                                        placeholder="Write a caption..."
                                        placeholderTextColor="rgba(255,255,255,0.4)"
                                        style={styles.captionInput}
                                        multiline
                                        maxLength={TEXT_POST_BODY_MAX_LENGTH}
                                    />
                                    {mentionSuggestions.length > 0 ? (
                                        <View style={styles.mentionList}>
                                            {mentionSuggestions.map((h) => (
                                                <TouchableOpacity
                                                    key={h}
                                                    onPress={() =>
                                                        onInsertMention(h.startsWith('@') ? h : `@${h}`)
                                                    }
                                                    style={styles.mentionRow}
                                                >
                                                    <Text style={styles.mentionText}>{h}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}
                                </View>
                            </LinearGradient>
                            <Text style={styles.charCount}>
                                {caption.length}/{TEXT_POST_BODY_MAX_LENGTH}
                            </Text>
                        </View>
                    ) : null}

                    {cardTab === 'location' ? (
                        <View style={styles.section}>
                            <GradientField colors={['#3b82f6', '#a855f7']} label="STORY LOCATION">
                                <PlaceAutocompleteField
                                    bare
                                    showIcon={false}
                                    mode="location"
                                    value={location}
                                    onChange={onLocationChange}
                                    onSelectSuggestion={onSelectLocation}
                                    placeholder="Add story location"
                                />
                            </GradientField>
                            <GradientField colors={['#404040', '#d4d4d4']} label="VENUE">
                                <PlaceAutocompleteField
                                    bare
                                    showIcon={false}
                                    mode="venue"
                                    value={venue}
                                    onChange={onVenueChange}
                                    onSelectSuggestion={onSelectVenue}
                                    placeholder="Add venue"
                                />
                            </GradientField>
                            <GradientField colors={['#525252', '#a3a3a3']} label="LANDMARK">
                                <PlaceAutocompleteField
                                    bare
                                    showIcon={false}
                                    mode="landmark"
                                    value={landmark}
                                    onChange={onLandmarkChange}
                                    onSelectSuggestion={onSelectLandmark}
                                    placeholder="Add landmark (optional)"
                                />
                            </GradientField>
                            <GradientField colors={['#3b82f6', '#a855f7']} label="TAG USER">
                                <TouchableOpacity style={styles.tagUserBtn} onPress={onOpenTagModal}>
                                    <View style={styles.tagUserIcon}>
                                        <Icon name="person-outline" size={14} color="#FFFFFF" />
                                    </View>
                                    <Text
                                        style={[
                                            styles.tagUserText,
                                            taggedUsers.length > 0 && styles.tagUserTextActive,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {taggedUsers.length > 0
                                            ? taggedUsers.map((h) => `@${h.replace(/^@/, '')}`).join(', ')
                                            : 'Tag user'}
                                    </Text>
                                </TouchableOpacity>
                            </GradientField>
                        </View>
                    ) : null}

                    {cardTab === 'carousel' ? (
                        <View style={styles.section}>
                            <Text style={styles.carouselHint}>
                                Add up to {CAROUSEL_MAX} images or videos for a carousel post. Hold and
                                drag a thumbnail to reorder.
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.addCarouselBtn,
                                    carouselItems.length >= CAROUSEL_MAX && styles.addCarouselBtnDisabled,
                                ]}
                                onPress={onAddCarousel}
                                disabled={carouselItems.length >= CAROUSEL_MAX}
                            >
                                <Icon name="add" size={20} color="#FFFFFF" />
                                <Text style={styles.addCarouselText}>
                                    Add photos or videos ({carouselItems.length}/{CAROUSEL_MAX})
                                </Text>
                            </TouchableOpacity>
                            <View style={styles.carouselGrid} {...carouselPanResponder.panHandlers}>
                                {carouselItems.map((item, index) => (
                                    <View
                                        key={`${item.uri}-${index}`}
                                        ref={(node) => {
                                            thumbHostRefs.current[index] = node;
                                        }}
                                        style={styles.carouselThumbHost}
                                        onLayout={() => {
                                            thumbHostRefs.current[index]?.measureInWindow((x, _y, width) => {
                                                thumbRectsRef.current[index] = { x, width };
                                            });
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => onCarouselIndexChange(index)}
                                            onLongPress={() => {
                                                if (carouselItems.length > 1) setDragging(index);
                                            }}
                                            delayLongPress={220}
                                            style={[
                                                styles.carouselThumbWrap,
                                                index === carouselActiveIndex &&
                                                    styles.carouselThumbWrapActive,
                                                draggingIndex === index && styles.carouselThumbWrapDragging,
                                            ]}
                                        >
                                            {item.type === 'video' ? (
                                                <View style={styles.carouselThumbVideo}>
                                                    <Icon name="videocam" size={18} color="#E5E7EB" />
                                                </View>
                                            ) : (
                                                <Image source={{ uri: item.uri }} style={styles.carouselThumb} />
                                            )}
                                            <View style={styles.carouselIndexBadge}>
                                                <Text style={styles.carouselIndexText}>{index + 1}</Text>
                                            </View>
                                        </TouchableOpacity>
                                        {carouselItems.length > 1 ? (
                                            <TouchableOpacity
                                                style={styles.removeThumb}
                                                onPress={() => onRemoveCarouselItem(index)}
                                            >
                                                <Icon name="close" size={12} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : null}

                    {cardTab === 'filters' ? (
                        <View style={styles.section}>
                            {INSTANT_FILTER_NAMES.map((name) => {
                                const isSelected = imageFilterName === name;
                                const thumbStyle = getFilterOverlayStyle(name);
                                return (
                                    <TouchableOpacity
                                        key={name}
                                        style={[styles.filterRow, isSelected && styles.filterRowActive]}
                                        onPress={() => onFilterChange(name)}
                                    >
                                        <View style={styles.filterThumb}>
                                            {previewUri && previewType === 'image' ? (
                                                <>
                                                    <Image
                                                        source={{ uri: previewUri }}
                                                        style={styles.filterThumbImg}
                                                    />
                                                    {thumbStyle ? (
                                                        <View
                                                            pointerEvents="none"
                                                            style={[styles.filterThumbOverlay, thumbStyle]}
                                                        />
                                                    ) : null}
                                                </>
                                            ) : (
                                                <View
                                                    style={[
                                                        styles.filterThumbFallback,
                                                        thumbStyle,
                                                    ]}
                                                />
                                            )}
                                        </View>
                                        <Text style={styles.filterName}>{name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <View style={styles.stickerRow}>
                                <TouchableOpacity style={styles.stickerBtn} onPress={onOpenStickerPicker}>
                                    <Icon name="happy-outline" size={18} color="#FBCFE8" />
                                    <Text style={styles.stickerBtnText}>Add sticker</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.stickerBtn} onPress={onOpenTextSticker}>
                                    <Icon name="text" size={18} color="#FBCFE8" />
                                    <Text style={styles.stickerBtnText}>Add text</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : null}
                </ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    sheet: {
        borderTopWidth: 1.5,
        borderTopColor: 'rgba(255,255,255,0.65)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        backgroundColor: '#000000',
        maxHeight: '48%',
    },
    grabberRow: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 6,
    },
    grabber: {
        width: 64,
        height: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    grabberHint: {
        marginTop: 4,
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
    },
    pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingBottom: 8,
        paddingTop: 4,
    },
    pickerRail: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 4,
    },
    pickerSlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    pickerRing: {
        padding: 2,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.78)',
    },
    pickerRingActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.22,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
    },
    pickerDisc: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickerDiscActive: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    carouselBadge: {
        position: 'absolute',
        top: 0,
        right: 4,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    carouselBadgeText: { color: '#000', fontSize: 9, fontWeight: '800' },
    saveBtn: {
        padding: 10,
        marginRight: 8,
        borderRadius: 12,
    },
    saveBtnActive: {
        backgroundColor: '#FFFFFF',
    },
    body: { maxHeight: 280 },
    bodyContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
    section: { gap: 10 },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    gradientRing: {
        borderRadius: 16,
        padding: 1.5,
    },
    gradientInner: {
        borderRadius: 14,
        backgroundColor: '#020617',
        overflow: 'hidden',
        paddingHorizontal: 14,
        paddingBottom: 10,
    },
    fieldLabel: {
        paddingTop: 10,
        paddingBottom: 4,
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.55)',
        letterSpacing: 0.6,
    },
    captionInner: {
        borderRadius: 14,
        backgroundColor: '#020617',
        minHeight: 88,
    },
    captionInput: {
        minHeight: 88,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 14,
        textAlignVertical: 'top',
    },
    charCount: {
        alignSelf: 'flex-end',
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
    },
    mentionList: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.12)',
    },
    mentionRow: { paddingHorizontal: 12, paddingVertical: 10 },
    mentionText: { color: '#E5E7EB', fontSize: 14 },
    tagUserBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 4,
    },
    tagUserIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagUserText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.5)' },
    tagUserTextActive: { color: '#FFFFFF' },
    carouselHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
    addCarouselBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    addCarouselBtnDisabled: { opacity: 0.5 },
    addCarouselText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    carouselGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    carouselThumbHost: { position: 'relative' },
    carouselThumbWrap: {
        width: 72,
        height: 72,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    carouselThumbWrapActive: { borderColor: '#FFFFFF' },
    carouselThumbWrapDragging: {
        borderColor: '#F472B6',
        transform: [{ scale: 1.06 }],
    },
    carouselIndexBadge: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.72)',
        alignItems: 'center',
        paddingVertical: 2,
    },
    carouselIndexText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
    carouselThumb: { width: '100%', height: '100%' },
    carouselThumbVideo: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeThumb: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        borderRadius: 12,
    },
    filterRowActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    filterThumb: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    filterThumbImg: { width: '100%', height: '100%' },
    filterThumbOverlay: { ...StyleSheet.absoluteFill },
    filterThumbFallback: {
        flex: 1,
        backgroundColor: '#374151',
    },
    filterName: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    stickerRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    stickerBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    stickerBtnText: { color: '#FBCFE8', fontSize: 13, fontWeight: '600' },
});
