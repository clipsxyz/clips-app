import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { flagEmojiForNational, resolveCountryFlagDisplay } from '../utils/countryFlag';

type Props = {
    value?: string;
    national?: string;
    size?: number;
};

function iso2ToEmoji(iso2: string): string {
    const cc = iso2.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return '';
    const base = 0x1f1e6;
    return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65);
}

function displayEmoji(resolved: string, national?: string): string {
    if (/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(resolved)) return resolved;
    if (/^[A-Za-z]{2}$/.test(resolved)) return iso2ToEmoji(resolved);
    const fromNational = national ? flagEmojiForNational(national) : '';
    if (fromNational) return fromNational;
    return resolved;
}

/** Country flag emoji for feed headers (web Flag parity). */
export default function Flag({ value, national, size = 14 }: Props) {
    const resolved = resolveCountryFlagDisplay(value || '', national);
    const emoji = displayEmoji(resolved, national);
    if (!emoji) return null;
    return <Text style={[styles.flag, { fontSize: size }]}>{emoji}</Text>;
}

const styles = StyleSheet.create({
    flag: {
        lineHeight: 16,
    },
});
