import React, { useEffect, useRef } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

const CAPCUT_APP_ICON = require('../assets/capcut-app-icon.jpg');

const SOURCES = [
    { key: 'tiktok', label: 'TikTok' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'capcut', label: 'CapCut' },
    { key: 'edits', label: 'Instagram Edits' },
] as const;

type Props = {
    onExplainTap: (sourceKey?: (typeof SOURCES)[number]['key']) => void;
    shareLabel?: string;
};

const SLOT = 34;
const AUTO_MS = 2600;

function TikTokGlyph({ size = 15 }: { size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
            <Path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
        </Svg>
    );
}

/** Simplified Instagram Edits mark — visible on dark pill (PNG asset is nearly black). */
function InstagramEditsGlyph({ size = 26 }: { size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Defs>
                <SvgLinearGradient id="editsLeft" x1="4" y1="20" x2="4" y2="4">
                    <Stop offset="0" stopColor="#8134af" />
                    <Stop offset="0.5" stopColor="#dd2a7b" />
                    <Stop offset="1" stopColor="#f58529" />
                </SvgLinearGradient>
                <SvgLinearGradient id="editsRight" x1="20" y1="4" x2="20" y2="20">
                    <Stop offset="0" stopColor="#f9d423" />
                    <Stop offset="0.5" stopColor="#f58529" />
                    <Stop offset="1" stopColor="#dd2a7b" />
                </SvgLinearGradient>
            </Defs>
            <Rect x={1} y={1} width={22} height={22} rx={5.5} fill="#141414" stroke="rgba(255,255,255,0.22)" strokeWidth={0.6} />
            <Path
                d="M7.2 6.5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2"
                stroke="url(#editsLeft)"
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
            />
            <Rect x={10.8} y={6.2} width={2.4} height={11.6} rx={1.2} fill="#FFFFFF" />
            <Path
                d="M16.8 6.5c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2"
                stroke="url(#editsRight)"
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
            />
        </Svg>
    );
}

function SourceIcon({ sourceKey }: { sourceKey: (typeof SOURCES)[number]['key'] }) {
    switch (sourceKey) {
        case 'tiktok':
            return (
                <View style={[styles.iconCircle, styles.tiktokCircle]}>
                    <TikTokGlyph size={15} />
                </View>
            );
        case 'instagram':
            return (
                <LinearGradient
                    colors={['#f58529', '#dd2a7b', '#8134af']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconCircle}
                >
                    <Icon name="logo-instagram" size={15} color="#FFFFFF" />
                </LinearGradient>
            );
        case 'capcut':
            return (
                <View style={[styles.iconCircle, styles.imageCircle]}>
                    <Image source={CAPCUT_APP_ICON} style={styles.appIconImage} resizeMode="cover" />
                </View>
            );
        case 'edits':
        default:
            return (
                <View style={[styles.iconCircle, styles.editsCircle]}>
                    <InstagramEditsGlyph size={26} />
                </View>
            );
    }
}

/** Google Lens–style upload pill — mirrors web `CreateSourceAppsCarousel`. */
export default function CreateSourceAppsCarouselNative({
    onExplainTap,
    shareLabel = 'Upload',
}: Props) {
    const scrollRef = useRef<ScrollView | null>(null);
    const pausedRef = useRef(false);
    const indexRef = useRef(0);

    useEffect(() => {
        const id = setInterval(() => {
            if (pausedRef.current) return;
            indexRef.current = (indexRef.current + 1) % SOURCES.length;
            scrollRef.current?.scrollTo({ x: indexRef.current * SLOT, animated: true });
        }, AUTO_MS);
        return () => clearInterval(id);
    }, []);

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            style={styles.pill}
            onPress={() => {
                const key = SOURCES[indexRef.current]?.key ?? 'tiktok';
                onExplainTap(key);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${shareLabel}. Swipe the logo to switch app.`}
            onPressIn={() => {
                pausedRef.current = true;
            }}
            onPressOut={() => {
                pausedRef.current = false;
            }}
        >
            <View style={styles.iconWindow}>
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    scrollEnabled
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={SLOT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => {
                        indexRef.current = Math.round(e.nativeEvent.contentOffset.x / SLOT);
                    }}
                    onScrollBeginDrag={() => {
                        pausedRef.current = true;
                    }}
                    onScrollEndDrag={() => {
                        pausedRef.current = false;
                    }}
                    contentContainerStyle={{ width: SOURCES.length * SLOT, height: SLOT }}
                >
                    {SOURCES.map((item) => (
                        <View key={item.key} style={styles.slot}>
                            <SourceIcon sourceKey={item.key} />
                        </View>
                    ))}
                </ScrollView>
            </View>
            <Text style={styles.label}>{shareLabel}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.09)',
        backgroundColor: 'rgba(60,64,67,0.92)',
        paddingVertical: 4,
        paddingLeft: 4,
        paddingRight: 16,
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    iconWindow: {
        width: SLOT,
        height: SLOT,
        borderRadius: SLOT / 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    slot: {
        width: SLOT,
        height: SLOT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    tiktokCircle: {
        backgroundColor: '#000000',
    },
    imageCircle: {
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    editsCircle: {
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    appIconImage: {
        width: 26,
        height: 26,
    },
    label: {
        marginLeft: 8,
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '400',
        letterSpacing: -0.2,
    },
});
