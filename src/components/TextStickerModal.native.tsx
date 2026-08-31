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
};

const STORY_COLORS: Record<string, string> = {
    white: '#FFFFFF',
    yellow: '#FFD700',
    red: '#FF0000',
    blue: '#0080FF',
    green: '#00FF00',
    purple: '#8000FF',
    pink: '#FF00FF',
    orange: '#FF8000',
    cyan: '#00FFFF',
    black: '#000000',
};

export default function TextStickerModalNative({
    visible,
    onClose,
    onConfirm,
    variant = 'glass',
}: Props) {
    const [text, setText] = useState('');
    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
    const [textColor, setTextColor] = useState('#FFFFFF');
    const [storyColorKey, setStoryColorKey] = useState('white');

    useEffect(() => {
        if (!visible) return;
        setText('');
        setFontSize('medium');
        setTextColor('#FFFFFF');
        setStoryColorKey('white');
    }, [visible]);

    const handleConfirm = () => {
        if (!text.trim()) return;
        const color =
            variant === 'story'
                ? STORY_COLORS[storyColorKey] || textColor
                : textColor;
        onConfirm(text.trim(), fontSize, color);
        onClose();
    };

    if (variant === 'story') {
        return (
            <StoryModalShell visible={visible} onRequestClose={onClose}>
                <View style={storyStyles.header}>
                    <View style={storyStyles.headerLeft}>
                        <Text style={storyStyles.typeIcon}>T</Text>
                        <Text style={storyStyles.title}>Add Text</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <Icon name="close" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <Text style={storyStyles.label}>Text</Text>
                <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="Enter your text..."
                    placeholderTextColor="#6B7280"
                    style={storyStyles.input}
                    multiline
                    maxLength={100}
                    autoFocus
                />

                <Text style={storyStyles.label}>Text Color</Text>
                <View style={storyStyles.colorGrid}>
                    {Object.entries(STORY_COLORS).map(([name, color]) => (
                        <TouchableOpacity
                            key={name}
                            style={[
                                storyStyles.colorSwatch,
                                { backgroundColor: color },
                                storyColorKey === name && storyStyles.colorSwatchActive,
                            ]}
                            onPress={() => {
                                setStoryColorKey(name);
                                setTextColor(color);
                            }}
                        />
                    ))}
                </View>

                <Text style={storyStyles.label}>Font Size</Text>
                <View style={storyStyles.sizeRow}>
                    {(['small', 'medium', 'large'] as const).map((size) => (
                        <TouchableOpacity
                            key={size}
                            style={[
                                storyStyles.sizeChip,
                                fontSize === size && storyStyles.sizeChipActive,
                            ]}
                            onPress={() => setFontSize(size)}
                        >
                            <Text
                                style={[
                                    storyStyles.sizeChipText,
                                    fontSize === size && storyStyles.sizeChipTextActive,
                                ]}
                            >
                                {size.charAt(0).toUpperCase() + size.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={storyStyles.actions}>
                    <TouchableOpacity style={storyStyles.cancelBtn} onPress={onClose}>
                        <Text style={storyStyles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={storyStyles.confirmBtn} onPress={handleConfirm}>
                        <Text style={storyStyles.confirmBtnText}>Add Text</Text>
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
    label: { color: '#D1D5DB', fontSize: 14, fontWeight: '500', marginBottom: 8 },
    input: {
        minHeight: 88,
        color: '#FFFFFF',
        fontSize: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: '#000000',
        padding: 14,
        marginBottom: 16,
        textAlignVertical: 'top',
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    colorSwatch: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#4B5563',
    },
    colorSwatchActive: {
        borderColor: '#FFFFFF',
    },
    sizeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    sizeChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4B5563',
    },
    sizeChipActive: {
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
    },
    sizeChipText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
    sizeChipTextActive: { color: '#000000' },
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
