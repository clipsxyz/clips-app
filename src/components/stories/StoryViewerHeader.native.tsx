import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from '../Avatar';
import type { StoryMetadataItem } from '../../utils/storyViewerMeta';

type Props = {
    avatarRef: React.RefObject<View | null>;
    avatarUrl?: string;
    userHandle: string;
    showFollowBadge: boolean;
    metadataItems: StoryMetadataItem[];
    showVideoMute: boolean;
    isMuted: boolean;
    onAvatarPress: () => void;
    onToggleMute: () => void;
    onClose: () => void;
};

function metadataIcon(type: StoryMetadataItem['type']): string {
    switch (type) {
        case 'location':
            return 'location-outline';
        case 'venue':
            return 'home-outline';
        case 'audience':
            return 'people-outline';
        default:
            return 'time-outline';
    }
}

export default function StoryViewerHeader({
    avatarRef,
    avatarUrl,
    userHandle,
    showFollowBadge,
    metadataItems,
    showVideoMute,
    isMuted,
    onAvatarPress,
    onToggleMute,
    onClose,
}: Props) {
    const [metaIndex, setMetaIndex] = useState(0);

    useEffect(() => {
        setMetaIndex(0);
    }, [metadataItems.map((m) => m.label).join('|')]);

    useEffect(() => {
        if (metadataItems.length <= 1) return;
        const t = setInterval(() => {
            setMetaIndex((i) => (i + 1) % metadataItems.length);
        }, 3000);
        return () => clearInterval(t);
    }, [metadataItems.length]);

    const currentMeta = metadataItems[metaIndex];

    return (
        <View style={styles.header}>
            <TouchableOpacity style={styles.left} onPress={onAvatarPress} activeOpacity={0.85}>
                <View ref={avatarRef} collapsable={false}>
                    <View style={styles.avatarWrap}>
                        <Avatar
                            src={avatarUrl}
                            name={userHandle.split('@')[0]}
                            size="sm"
                        />
                        {showFollowBadge ? (
                            <View style={styles.followBadge}>
                                <Icon name="add" size={10} color="#fff" />
                            </View>
                        ) : null}
                    </View>
                </View>
                <View style={styles.nameCol}>
                    <Text style={styles.handle} numberOfLines={1}>
                        {userHandle}
                    </Text>
                    {currentMeta ? (
                        <View style={styles.metaPill}>
                            <Icon
                                name={metadataIcon(currentMeta.type)}
                                size={10}
                                color="#111827"
                            />
                            <Text style={styles.metaText} numberOfLines={1}>
                                {currentMeta.label}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>

            <View style={styles.right}>
                {showVideoMute ? (
                    <TouchableOpacity
                        onPress={onToggleMute}
                        style={styles.muteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Icon
                            name={isMuted ? 'volume-mute' : 'volume-high'}
                            size={20}
                            color="#fff"
                        />
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="close" size={26} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'absolute',
        top: 12,
        left: 16,
        right: 16,
        zIndex: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    left: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        paddingRight: 8,
    },
    avatarWrap: { position: 'relative' },
    followBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#06B6D4',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nameCol: { flex: 1, minWidth: 0, gap: 2 },
    handle: { color: '#fff', fontSize: 14, fontWeight: '700' },
    metaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        maxWidth: 140,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    metaText: { color: '#111827', fontSize: 10, fontWeight: '600', flexShrink: 1 },
    right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    muteBtn: {
        padding: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
});
