import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    ImageBackground,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import {
    subscribeUploadOverlay,
    type UploadOverlayState,
} from '../utils/uploadOverlayNative';
import { cancelActiveVideoCompression } from '../utils/compressVideoForUploadNative';

function FlowingUploadIcon() {
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shineLoop = Animated.loop(
            Animated.timing(shimmer, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
        );
        shineLoop.start();
        return () => shineLoop.stop();
    }, [shimmer]);

    const shineX = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [-28, 28],
    });

    return (
        <View style={styles.iconClip}>
            <Icon name="cloud-upload-outline" size={30} color="#FFFFFF" />
            <Animated.View
                pointerEvents="none"
                style={[styles.shimmer, { transform: [{ translateX: shineX }, { rotate: '18deg' }] }]}
            >
                <LinearGradient
                    colors={['transparent', '#5EEAD4', '#FFFFFF', '#5EEAD4', 'transparent']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.shimmerFill}
                />
            </Animated.View>
        </View>
    );
}

/**
 * Compact left upload tile + fade-away live popup — mount once at app root.
 */
export default function UploadProgressToast() {
    const insets = useSafeAreaInsets();
    const [state, setState] = useState<UploadOverlayState | null>(null);
    const boxOpacity = useRef(new Animated.Value(0)).current;
    const popupOpacity = useRef(new Animated.Value(0)).current;
    const popupShownForId = useRef<string | null>(null);

    useEffect(() => subscribeUploadOverlay(setState), []);

    useEffect(() => {
        if (!state) {
            popupShownForId.current = null;
            boxOpacity.setValue(0);
            popupOpacity.setValue(0);
            return;
        }

        if (state.status === 'uploading') {
            popupShownForId.current = null;
            popupOpacity.setValue(0);
            Animated.timing(boxOpacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }).start();
            return;
        }

        Animated.timing(boxOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
        }).start();

        if (popupShownForId.current === state.id) return;
        popupShownForId.current = state.id;

        popupOpacity.setValue(0);
        Animated.sequence([
            Animated.timing(popupOpacity, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.delay(1400),
            Animated.timing(popupOpacity, {
                toValue: 0,
                duration: 420,
                useNativeDriver: true,
            }),
        ]).start();
    }, [state, boxOpacity, popupOpacity]);

    if (!state) return null;

    const isUploading = state.status === 'uploading';
    const isError = state.status === 'error';
    const popupCopy = isError
        ? state.message || 'Could not post. Please try again.'
        : 'Your post is now live';

    const thumbSource = state.thumbUri ? { uri: state.thumbUri } : undefined;

    return (
        <View
            style={[styles.wrap, { top: insets.top + 10 }]}
            pointerEvents="box-none"
        >
            {isUploading && typeof state.fraction === 'number' ? (
                <Animated.View style={[styles.compressCard, { opacity: boxOpacity }]} pointerEvents="auto">
                    <Text style={styles.compressTitle}>{state.title || 'Optimizing video…'}</Text>
                    <Text style={styles.compressMessage}>{state.message}</Text>
                    <View style={styles.compressTrack}>
                        <View style={[styles.compressFill, { width: `${Math.round(state.fraction * 100)}%` }]} />
                    </View>
                    <Pressable
                        onPress={() => cancelActiveVideoCompression()}
                        style={styles.compressCancel}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel video optimization"
                    >
                        <Text style={styles.compressCancelText}>Cancel</Text>
                    </Pressable>
                </Animated.View>
            ) : isUploading ? (
                <Animated.View style={[styles.box, { opacity: boxOpacity }]} pointerEvents="none">
                    <ImageBackground
                        source={thumbSource}
                        style={[
                            styles.thumbFill,
                            !thumbSource && { backgroundColor: state.textThumbBackground || '#0b0711' },
                        ]}
                        imageStyle={styles.thumbImage}
                    >
                        <View style={styles.iconScrim}>
                            <FlowingUploadIcon />
                        </View>
                    </ImageBackground>
                </Animated.View>
            ) : (
                <Animated.View
                    style={[
                        styles.popup,
                        isError && styles.popupError,
                        { opacity: popupOpacity },
                    ]}
                >
                    <Text style={[styles.popupText, isError && styles.popupTextError]}>
                        {popupCopy}
                    </Text>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 9999,
        elevation: 20,
    },
    box: {
        width: 52,
        height: 64,
        borderRadius: 12,
        overflow: 'hidden',
        ...glassPanel,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 12,
    },
    thumbFill: {
        flex: 1,
    },
    thumbImage: {
        resizeMode: 'cover',
    },
    iconScrim: {
        flex: 1,
        backgroundColor: 'rgba(11, 7, 17, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconClip: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    shimmer: {
        position: 'absolute',
        width: 14,
        height: 40,
        top: -4,
    },
    shimmerFill: {
        flex: 1,
    },
    popup: {
        alignSelf: 'center',
        maxWidth: '86%',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: 'rgba(26, 21, 36, 0.94)',
        borderWidth: 1,
        borderColor: 'rgba(94, 234, 212, 0.35)',
    },
    popupError: {
        borderColor: 'rgba(248, 113, 113, 0.45)',
    },
    popupText: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    popupTextError: {
        color: '#FECACA',
    },
    compressCard: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: 360,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(11, 14, 20, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
    },
    compressTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    compressMessage: {
        color: '#8B949E',
        fontSize: 13,
        marginTop: 4,
    },
    compressTrack: {
        height: 4,
        borderRadius: 999,
        backgroundColor: '#21262D',
        marginTop: 12,
        overflow: 'hidden',
    },
    compressFill: {
        height: '100%',
        backgroundColor: '#FFFFFF',
    },
    compressCancel: {
        marginTop: 12,
        alignSelf: 'flex-end',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    compressCancelText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
