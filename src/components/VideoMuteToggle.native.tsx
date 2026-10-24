import React from 'react';
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    muted: boolean;
    onToggle: () => void;
    style?: StyleProp<ViewStyle>;
};

export default function VideoMuteToggle({ muted, onToggle, style }: Props) {
    return (
        <TouchableOpacity
            style={[styles.btn, style]}
            onPress={onToggle}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
        >
            <Icon
                name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
                size={18}
                color="#FFFFFF"
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    btn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 8,
        elevation: 8,
    },
});
