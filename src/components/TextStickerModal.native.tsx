import React, { useEffect, useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import StoryModalShell from './StoryModalShell.native';
import { glassPanel, glassSearch } from '../theme/gazetteerAmbientNative';
import { NEWS_HEADLINE_MAX_CHARS } from './StoryNewsHeadlineScaffold.native';

const GLASS_COLORS = [
    '#FFFFFF',
    '#000000',
    '#FF0000',
    '#0080FF',
    '#00FF00',
    '#FFFF00',
    '#FF00FF',
    '#8000FF',
    '#FF8000',
    '#00FFFF',
];

type Props = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (text: string, fontSize: 'small' | 'medium' | 'large', color: string) => void;
    /** `story` matches web ClipPage Add Text card; default keeps glass create styling. */
    variant?: 'glass' | 'story';
    /** Prefill when editing an existing news headline. */
    initialText?: string;
};

export default function TextStickerModalNative({
    visible,
    onClose,
    onConfirm,
    variant = 'glass',
    initialText = '',
}: Props) {
    const [text, setText] = useState('');
    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('large');
    const [textColor, setTextColor] = useState('#FFFFFF');

    useEffect(() => {
        if (!visible) return;
        setText(String(initialText || '').slice(0, NEWS_HEADLINE_MAX_CHARS));
        setFontSize('large');
        setTextColor('#FFFFFF');
    }, [visible, initialText]);

    const handleConfirm = () => {
        if (!text.trim()) return;
        const normalized =
            variant === 'story'
                ? text.trim().toUpperCase().slice(0, NEWS_HEADLINE_MAX_CHARS)
                : text.trim();
        onConfirm(normalized, fontSize, variant === 'story' ? '#FFFFFF' : textColor);
        onClose();
    };

    const onChangeStoryText = (next: string) => {
        setText(next.slice(0, NEWS_HEADLINE_MAX_CHARS));
    };

    if (variant === 'story') {
        const count = text.length;
        const atLimit = count >= NEWS_HEADLINE_MAX_CHARS;
        return (
            <StoryModalShell visible={visible} onRequestClose={onClose}>
                <View style={storyStyles.header}>
                    <View style={storyStyles.headerLeft}>
                        <Text style={storyStyles.typeIcon}>T</Text>
                        <Text style={storyStyles.title}>News Headline</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <Icon name="close" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <View style={storyStyles.toolbar}>
                    <Text style={storyStyles.label}>Headline</Text>
                    <Text style={[storyStyles.counter, atLimit && storyStyles.counterLimit]}>
                        {count} / {NEWS_HEADLINE_MAX_CHARS}
                    </Text>
                </View>
                <TextInput
                    value={text}
                    onChangeText={onChangeStoryText}
                    placeholder="BREAKING NEWS HEADLINE…"
                    placeholderTextColor="#6B7280"
                    style={storyStyles.input}
                    multiline
                    maxLength={NEWS_HEADLINE_MAX_CHARS}
                    autoFocus
                    autoCapitalize="characters"
                />
                <Text style={storyStyles.hint}>
                    Uppercase · max {NEWS_HEADLINE_MAX_CHARS} characters (~10–12 words)
                </Text>

                <View style={storyStyles.previewCard}>
                    <View style={storyStyles.previewAccent} />
                    <Text style={storyStyles.previewHeadline} numberOfLines={4}>
                        {(text.trim() || 'YOUR HEADLINE').toUpperCase()}
                    </Text>
                </View>

                <View style={storyStyles.actions}>
                    <TouchableOpacity style={storyStyles.cancelBtn} onPress={onClose}>
                        <Text style={storyStyles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[storyStyles.confirmBtn, !text.trim() && storyStyles.confirmBtnDisabled]}
                        onPress={handleConfirm}
                        disabled={!text.trim()}
                    >
                        <Text style={storyStyles.confirmBtnText}>
                            {initialText ? 'Update Headline' : 'Add Headline'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </StoryModalShell>
        );
    }

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Text</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={22} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder="Type your text..."
                        placeholderTextColor="#6B7280"
                        style={styles.input}
                        multiline
                        maxLength={120}
                        autoFocus
                    />
                    <Text style={styles.label}>Size</Text>
                    <View style={styles.sizeRow}>
                        {(['small', 'medium', 'large'] as const).map((size) => (
                            <TouchableOpacity
                                key={size}
                                style={[styles.sizeChip, fontSize === size && styles.sizeChipActive]}
                                onPress={() => setFontSize(size)}
                            >
                                <Text
                                    style={[
                                        styles.sizeChipText,
                                        fontSize === size && styles.sizeChipTextActive,
                                    ]}
                                >
                                    {size.charAt(0).toUpperCase() + size.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.label}>Color</Text>
                    <View style={styles.colorRow}>
                        {GLASS_COLORS.map((color) => (
                            <TouchableOpacity
                                key={color}
                                style={[
                                    styles.colorSwatch,
                                    { backgroundColor: color },
                                    textColor === color && styles.colorSwatchActive,
                                ]}
                                onPress={() => setTextColor(color)}
                            />
                        ))}
                    </View>
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                        <Text style={styles.confirmBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const storyStyles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typeIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
    title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    label: { color: '#D1D5DB', fontSize: 14, fontWeight: '500' },
    counter: { color: '#9CA3AF', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    counterLimit: { color: '#F87171' },
    input: {
        minHeight: 96,
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        textTransform: 'uppercase',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: '#000000',
        padding: 14,
        marginBottom: 8,
        textAlignVertical: 'top',
    },
    hint: { color: '#6B7280', fontSize: 12, marginBottom: 14 },
    previewCard: {
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginBottom: 18,
    },
    previewAccent: {
        width: 48,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E50914',
        marginBottom: 12,
    },
    previewHeadline: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 20,
        lineHeight: 26,
        textAlign: 'center',
        textTransform: 'uppercase',
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    actions: { flexDirection: 'row', gap: 12 },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
    },
    cancelBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    confirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    confirmBtnDisabled: { opacity: 0.45 },
    confirmBtnText: { color: '#000000', fontSize: 15, fontWeight: '600' },
});

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        ...glassPanel,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
    input: {
        minHeight: 80,
        color: '#FFFFFF',
        fontSize: 16,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        ...glassSearch,
    },
    label: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', marginBottom: 8 },
    sizeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    sizeChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    sizeChipActive: {
        backgroundColor: 'rgba(244, 114, 182, 0.25)',
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.55)',
    },
    sizeChipText: { color: '#D1D5DB', fontSize: 13, fontWeight: '600' },
    sizeChipTextActive: { color: '#FBCFE8' },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    colorSwatch: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorSwatchActive: { borderColor: '#f472b6' },
    confirmBtn: {
        backgroundColor: 'rgba(244, 114, 182, 0.35)',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.5)',
    },
    confirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
