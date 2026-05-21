import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';

type Props = {
    taggedUserHandles: string[];
    onShowTaggedUsers: () => void;
};

export default function TaggedAvatars({ taggedUserHandles, onShowTaggedUsers }: Props) {
    const handles = taggedUserHandles.slice(0, 3);
    const [avatars, setAvatars] = useState<Array<{ handle: string; src?: string }>>([]);

    useEffect(() => {
        setAvatars(handles.map((handle) => ({ handle, src: getAvatarForHandle(handle) || undefined })));
    }, [handles.join(',')]);

    if (taggedUserHandles.length === 0) return null;

    const label =
        taggedUserHandles.length === 1
            ? '1 person tagged'
            : `${taggedUserHandles.length} people tagged`;

    return (
        <TouchableOpacity style={styles.wrap} onPress={onShowTaggedUsers} activeOpacity={0.85}>
            <View style={styles.stack}>
                {avatars.map((u, i) => (
                    <View key={u.handle} style={[styles.avatarSlot, { marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i }]}>
                        <Avatar src={u.src} name={u.handle.split('@')[0]} size={20} />
                    </View>
                ))}
            </View>
            <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 8,
        paddingBottom: 4,
        alignSelf: 'flex-end',
    },
    stack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarSlot: {
        borderWidth: 1.5,
        borderColor: '#030712',
        borderRadius: 12,
        overflow: 'hidden',
    },
    label: {
        fontSize: 12,
        color: '#D1D5DB',
    },
});
