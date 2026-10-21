import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { getAvatarForHandle } from '../api/users';
import { isVideoUrl } from '../utils/storyMediaNative';
import {
    STORY_GRADIENT_RING_COLORS,
    STORY_GRADIENT_RING_END,
    STORY_GRADIENT_RING_START,
} from '../utils/storyRingNative';
import Avatar from './Avatar';

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

type StoryAvatarSource = {
    handle?: string | null;
    authorAvatar?: string | null;
    avatarUrl?: string | null;
    user?: { avatarUrl?: string | null } | null;
};

type Props = {
    /** Fire the same Stories-24 open path the header pill used to use. */
    onPress: () => void;
    /** Rail item count. Subtitle only — never used to pad empty avatar rings. */
    storyCount?: number;
    /** Story posters from the feed rail. Avatar stack reads unique authors only. */
    stories?: StoryAvatarSource[];
    /** Optional pre-resolved avatar URLs when `stories` is not passed. */
    storyAvatars?: string[];
};

/**
 * Dark base scrim. A near-transparent glass fill is unreadable over bright video
 * frames, so this sits under the tint wash and keeps the copy legible regardless of
 * what scrolls underneath.
 */
const SCRIM = ['rgba(18, 28, 26, 0.82)', 'rgba(14, 22, 20, 0.72)'] as const;
const WASH = ['rgba(16, 185, 129, 0.12)', 'rgba(0, 242, 254, 0.08)', 'rgba(18, 28, 26, 0.04)'] as const;

/** Inner photo diameter; 2px gradient ring matches Inbox header story avatars. */
const AVATAR_SIZE = 32;
const RING_PAD = 2;
const RING_SIZE = AVATAR_SIZE + RING_PAD * 2;
const AVATAR_OVERLAP = -10;
const STACK_MAX = 3;

type StackPerson = {
    key: string;
    handle: string;
    src?: string;
    name: string;
};

function usableAvatarUri(raw?: string | null): string | undefined {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed || isVideoUrl(trimmed)) return undefined;
    return resolvePublicMediaUrl(trimmed) || trimmed;
}

function personName(handle: string): string {
    return handle.replace(/^@/, '').split('@')[0] || 'User';
}

function uniqueStoryPeople(
    stories: StoryAvatarSource[] | undefined,
    storyAvatars: string[] | undefined,
): StackPerson[] {
    const list: StackPerson[] = [];
    const seen = new Set<string>();
    const pushPerson = (handleRaw: string | null | undefined, srcRaw?: string | null) => {
        const handle = (handleRaw || '').trim();
        if (!handle) return false;
        const key = handle.toLowerCase().replace(/^@/, '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        list.push({
            key,
            handle,
            src: usableAvatarUri(srcRaw) || usableAvatarUri(getAvatarForHandle(handle)),
            name: personName(handle),
        });
        return list.length >= STACK_MAX;
    };

    for (const story of stories || []) {
        if (pushPerson(story.handle, story.authorAvatar || story.avatarUrl || story.user?.avatarUrl)) {
            return list;
        }
    }
    for (const raw of storyAvatars || []) {
        const uri = usableAvatarUri(raw);
        if (!uri) continue;
        const key = `uri:${uri}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ key, handle: key, src: uri, name: 'User' });
        if (list.length >= STACK_MAX) return list;
    }
    return list;
}

function AvatarStack({
    stories,
    avatars,
}: {
    stories: StoryAvatarSource[] | undefined;
    avatars: string[] | undefined;
}) {
    const people = uniqueStoryPeople(stories, avatars);
    if (people.length === 0) return null;
    const totalWidth = RING_SIZE + (people.length - 1) * (RING_SIZE + AVATAR_OVERLAP);
    return (
        <View style={[styles.avatarStack, { width: totalWidth }]}>
            {people.map((person, idx) => (
                <LinearGradient
                    key={person.key}
                    colors={[...STORY_GRADIENT_RING_COLORS]}
                    start={STORY_GRADIENT_RING_START}
                    end={STORY_GRADIENT_RING_END}
                    pointerEvents="none"
                    style={[
                        styles.avatarRing,
                        {
                            zIndex: people.length - idx,
                            marginLeft: idx > 0 ? AVATAR_OVERLAP : 0,
                        },
                    ]}
                >
                    <View style={styles.avatarWell}>
                        <Avatar
                            src={person.src}
                            name={person.name}
                            size={AVATAR_SIZE}
                            hideBorder
                        />
                    </View>
                </LinearGradient>
            ))}
        </View>
    );
}

export default function StoriesPromoCard({
    onPress,
    storyCount = 0,
    stories,
    storyAvatars,
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
                <AvatarStack stories={stories} avatars={storyAvatars} />
                <View style={styles.copy}>
                    <View style={styles.titleRow}>
                        <View style={styles.liveDot} />
                        <Text style={styles.title} numberOfLines={1}>
                            Stories
                        </Text>
                    </View>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {storyCount > 0 ? `${storyCount} recent updates` : '24 recent updates'}
                    </Text>
                </View>
                <View style={styles.watchLink}>
                    <Icon name="play" size={12} color="#10B981" />
                    <Text style={styles.watchText}>Watch</Text>
                    <Icon name="chevron-forward" size={14} color="rgba(255,255,255,0.55)" />
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
        borderRadius: 18,
        marginVertical: 12,
        marginHorizontal: 16,
        backgroundColor: 'rgba(18, 28, 26, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.18)',
        paddingHorizontal: 16,
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
    avatarRing: {
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        padding: RING_PAD,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarWell: {
        width: '100%',
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    copy: {
        flex: 1,
        minWidth: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 7,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#10B981',
        flexShrink: 0,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        flexShrink: 1,
    },
    subtitle: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 3,
    },
    watchLink: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 4,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: 'rgba(16, 185, 129, 0.10)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.22)',
    },
    watchText: {
        color: '#E8FFF6',
        fontSize: 13,
        fontWeight: '600',
    },
});
