import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dismissCheckoutBrowser } from '../utils/stripeCheckoutNative';

type Props = {
    navigation: { navigate: (name: string, params?: object) => void };
};

/** Shown when Stripe returns the app to gazetteer://boost/cancel. */
export default function BoostCancelScreen({ navigation }: Props) {
    useEffect(() => {
        void dismissCheckoutBrowser();
    }, []);

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Boost payment was canceled</Text>
            <Text style={styles.body}>No charge was made. You can try the boost again.</Text>
            <Pressable
                style={styles.button}
                onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
            >
                <Text style={styles.buttonText}>Back to Feed</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#07090d',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
    },
    body: {
        color: 'rgba(255,255,255,0.74)',
        fontSize: 16,
        lineHeight: 22,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 22,
    },
    button: {
        alignSelf: 'stretch',
        maxWidth: 420,
        backgroundColor: '#00F2FF',
        borderRadius: 14,
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#041016',
        fontSize: 16,
        fontWeight: '700',
    },
});
