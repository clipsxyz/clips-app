import React, { useEffect } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { BOOST_STATUS_REFRESH_EVENT } from '../navigation/linking';
import { dismissCheckoutBrowser } from '../utils/stripeCheckoutNative';

type Props = {
    navigation: { navigate: (name: string, params?: object) => void; reset: (state: object) => void; getState?: () => { routes?: Array<{ name?: string }> } };
    route?: { params?: { session_id?: string } };
};

/** Shown when Stripe returns the app to gazetteer://boost/success. */
export default function BoostSuccessScreen({ navigation, route }: Props) {
    const sessionId = String(route?.params?.session_id || '');

    useEffect(() => {
        void dismissCheckoutBrowser();
        DeviceEventEmitter.emit(BOOST_STATUS_REFRESH_EVENT, { sessionId });
    }, [sessionId]);

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Payment Successful!</Text>
            <Text style={styles.body}>Boost is being activated...</Text>
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
