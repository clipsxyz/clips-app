import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { getAvatarForHandle } from '../api/users';

/**
 * GLASS STATUS — read before assuming this card blurs.
 *
 * This project has no backdrop-blur capability: neither `expo-blur` nor
 * `@react-native-community/blur` is in package.json or node_modules, no BlurView is
 * used anywhere in src/, and no blur module is linked in the Android gradle config.
 * Android RN cannot blur content behind a view without a native module.
 *
 * `glassSurface` / `glassPanel` in src/theme/gazetteerAmbientNative.ts look like glass
 * but are just a translucent fill plus a hairline border — there is no blur behind them.
 * So the surface below is translucent *fake* glass, consistent with every other glass
 * surface in the app (the header, passport sheets, passport avatar).
 *
 * To get true frosted blur this needs a native dependency plus an autolinked rebuild:
 *   npm i @react-native-community/blur
 * then wrap the content in <BlurView style={StyleSheet.absoluteFill} blurType="dark"
 * blurAmount={18} reducedTransparencyFallbackColor="#101B2F" />.
 */

type Props = {
    /** Fire the same Stories-24 open path the header pill used to use. */
    onPress: () => void;
    /** Rail item count. Drives how many avatars the stack shows (clamped to 2-3). */
    storyCount?: number;
    /**
     * Avatar URLs from the actual story posters, in rail order. Preferred source.
     *
     * NOTE: FeedScreen does not pass this. It cannot, in fact — Stories24RailItem
     * (src/utils/stories24Rail.ts) carries only handle/title/subtitle/thumb/
     * previewVideoUrl. There is no avatar URL on the rail item to read.
     */
    storyAvatars?: string[];
    /**
     * Story poster handles in rail order. Resolved through getAvatarForHandle, which
     * only knows the 8 seed mock accounts — a real API handle returns undefined and
     * degrades to the glyph. Passing this is better than nothing but will not show
     * real photos for live stories.
     *
     * Wiring at the call site: storyHandles={stories24Items.map((s) => s.handle)}
     */
    storyHandles?: string[];
};

/**
 * Dark base scrim. A near-transparent glass fill is unreadable over bright video
 * frames, so this sits under the tint wash and keeps the copy legible regardless of
 * what scrolls underneath.
 */
const SCRIM = ['rgba(10, 14, 20, 0.62)', 'rgba(12, 18, 26, 0.55)'] as const;
const WASH = ['rgba(246,226,122,0.16)', 'rgba(212,175,55,0.12)', 'rgba(20,184,166,0.14)'] as const;

/** Avatar diameter and horizontal overlap for the stack. -10 as specified. */
const AVATAR_SIZE = 32;
const AVATAR_OVERLAP = -10;

/**
 * Deterministic accent fills behind each ring. They sit under the avatar image, so
 * they are only visible while an image loads or if it fails outright.
 */
const AVATAR_FILLS = ['#3B4A6B', '#4A3B63', '#3B635B'] as const;

/**
 * Mock handles used only when the caller supplies no real poster avatars. These are
 * the app's seed mock accounts and resolve to remote Unsplash photos, so they need
 * network; if they fail to load the ring falls back to the person glyph rather than
 * rendering a broken image.
 */
const AVATAR_MOCK_HANDLES = ['Alice@Dublin', 'Sarah@Artane', 'Noah@london'] as const;

/** Clamp to 2-3 avatars: a single avatar reads as broken, four overflow the gutters. */
function avatarSlots(count: number): number {
    if (count <= 0) return 3;
    return Math.min(Math.max(count, 2), 3);
}

/**
 * Resolution order per ring: real poster URL, then the poster's handle via
 * getAvatarForHandle, then a mock handle, then nothing (person glyph). Deduped so
 * three rings never show the same person twice (the mock map repeats photos across
 * handle variants such as Bob@Ireland / Bob@Finglas).
 */
function resolveAvatarSources(
    storyAvatars: string[] | undefined,
    storyHandles: string[] | undefined,
    slots: number,
): (string | undefined)[] {
    const used: string[] = [];
    const pick = (candidates: (string | undefined)[]): string | undefined => {
        for (const candidate of candidates) {
            const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
            if (trimmed && !used.includes(trimmed)) {
                used.push(trimmed);
                return trimmed;
            }
        }
        return undefined;
    };
    return Array.from({ length: slots }, (_, i) =>
        pick([
            storyAvatars?.[i],
            storyHandles?.[i] ? getAvatarForHandle(storyHandles[i]) : undefined,
            getAvatarForHandle(AVATAR_MOCK_HANDLES[i % AVATAR_MOCK_HANDLES.length]),
        ]),
    );
}

function AvatarStack({
    count,
    avatars,
    handles,
}: {
    count: number;
    avatars: string[] | undefined;
    handles: string[] | undefined;
}) {
    const slots = avatarSlots(count);
    const sources = resolveAvatarSources(avatars, handles, slots);
    // Tracks per-slot load failures so one dead URL degrades to the glyph in place.
    const [failed, setFailed] = React.useState<Record<number, boolean>>({});
    const totalWidth = AVATAR_SIZE + (slots - 1) * (AVATAR_SIZE + AVATAR_OVERLAP);
    return (
        <View style={[styles.avatarStack, { width: totalWidth }]}>
            {Array.from({ length: slots }, (_, i) => {
                const uri = sources[i];
                const showImage = Boolean(uri) && !failed[i];
                return (
                    <View
                        key={`stack-${i}`}
                        pointerEvents="none"
                        style={[
                            styles.avatar,
                            { backgroundColor: AVATAR_FILLS[i % AVATAR_FILLS.length] },
                            i > 0 ? styles.avatarOverlap : null,
                        ]}
                    >
                        {showImage ? (
                            <Image
                                source={{ uri: uri as string }}
                                style={styles.avatarImage}
                                onError={() => setFailed((prev) => ({ ...prev, [i]: true }))}
                            />
                        ) : (
                            <Icon name="person" size={13} color="rgba(255,255,255,0.72)" />
                        )}
                    </View>
                );
            })}
        </View>
    );
}

export default function StoriesPromoCard({
    onPress,
    storyCount = 0,
    storyAvatars,
    storyHandles,
}: Props) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel="Open Stories 24"
        >
            <LinearGradient
                colors={[...SCRIM]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <LinearGradient
                colors={[...WASH]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.row}>
                <AvatarStack count={storyCount} avatars={storyAvatars} handles={storyHandles} />
                <View style={styles.copy}>
                    <Text style={styles.title} numberOfLines={1}>
                        Stories 24
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        Recent local updates
                    </Text>
                </View>
                <View style={styles.watchPill}>
                    <Icon name="play" size={11} color="#FFFFFF" />
                    <Text style={styles.watchText}>Watch</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    /**
     * Radius 16 and the same 16px side gutters as post cards so the promo sits on the
     * feed's card grid. Glass surface: translucent fill, hairline border, clipped so
     * the gradient layers and any future blur edge terminate cleanly at radius 16.
     *
     * NOTE: this is a translucent "fake glass" surface, matching the rest of the app
     * (see glassSurface in src/theme/gazetteerAmbientNative.ts). No true backdrop
     * blur is installed in this project — see note at top of file.
     */
    card: {
        borderRadius: 16,
        marginVertical: 12,
        marginHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 14,
        paddingVertical: 14,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 12,
    },
    avatarStack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#EC4899',
    },
    avatarOverlap: {
        marginLeft: AVATAR_OVERLAP,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: AVATAR_SIZE / 2,
    },
    copy: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    subtitle: {
        // #94A3B8 is the slate used for secondary feed copy. Short enough that it
        // clears the avatar stack and Watch pill on a 320pt feed without ellipsizing.
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2,
    },
    watchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    watchText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
});