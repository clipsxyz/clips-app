import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';

type Props = {
    visible: boolean;
    onRequestClose: () => void;
    children: React.ReactNode;
};

/** Web ClipPage modal shell — white border frame around black card. */
export default function StoryModalShell({ visible, onRequestClose, children }: Props) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
            <View style={styles.overlay}>
                <View style={styles.outer}>
                    <View style={styles.inner}>{children}</View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    outer: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: 2,
        maxWidth: 480,
        width: '100%',
        alignSelf: 'center',
    },
    inner: {
        backgroundColor: '#000000',
        borderRadius: 14,
        padding: 24,
    },
});
