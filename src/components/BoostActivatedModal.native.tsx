import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export const BOOST_ACTIVATED_EVENT = 'boostActivated';

/** Confirmation shown after Stripe Checkout returns to the app. */
export default function BoostActivatedModal() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const show = () => setVisible(true);
        const sub = DeviceEventEmitter.addListener(BOOST_ACTIVATED_EVENT, show);
        return () => sub.remove();
    }, []);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Text style={styles.title}>Boost Activated</Text>
                    <Text style={styles.body}>Payment finished. Your boost is ready to run.</Text>
                    <Pressable style={styles.button} onPress={() => setVisible(false)}>
                        <Text style={styles.buttonText}>Done</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.62)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 20,
        backgroundColor: '#0B0E14',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        padding: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
    },
    body: {
        color: 'rgba(255,255,255,0.74)',
        fontSize: 15,
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 18,
    },
    button: {
        backgroundColor: '#00F2FF',
        borderRadius: 14,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#041018',
        fontSize: 16,
        fontWeight: '700',
    },
});
