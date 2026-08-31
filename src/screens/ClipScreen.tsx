import React from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import * as ImagePicker from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigateMainTab } from '../navigation/mainTabs';
import { ox } from '../constants/nativeOpticalScale';

function assetIsVideo(asset: { type?: string; uri?: string }) {
    return Boolean(
        asset.type?.startsWith('video') ||
            asset.uri?.toLowerCase().endsWith('.mp4') ||
            asset.uri?.toLowerCase().endsWith('.mov'),
    );
}

/** Clips 24 landing — web `ClipPage` upload hub (photo/video only). */
export default function ClipScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();

    const openComposer = (uri: string, mediaType: 'image' | 'video', durationSec?: number) => {
        navigation.navigate('Story24Composer', {
            mediaUrl: uri,
            mediaType,
            videoDurationSec: durationSec,
            videoCoverTime: 0,
        });
    };

    const handleSelectMedia = () => {
        ImagePicker.launchImageLibrary(
            { mediaType: 'mixed', quality: 0.9, selectionLimit: 1 },
            (response) => {
                if (response.didCancel) return;
                if (response.errorCode) {
                    Alert.alert('Could not open library', response.errorMessage || 'Try again.');
                    return;
                }
                const asset = response.assets?.[0];
                if (!asset?.uri) return;
                const isVideo = assetIsVideo(asset);
                const duration = Number(asset.duration || 0);
                openComposer(
                    asset.uri,
                    isVideo ? 'video' : 'image',
                    isVideo && Number.isFinite(duration) && duration > 0 ? duration : undefined,
                );
            },
        );
    };

    return (
        <View style={styles.root}>
            <LinearGradient
                colors={['rgba(34,197,94,0.08)', 'rgba(59,130,246,0.08)', 'rgba(37,99,235,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />

            <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        style={styles.homeBtn}
                        onPress={() => navigateMainTab(navigation, 'Home')}
                        accessibilityLabel="Home feed"
                    >
                        <Icon name="home-outline" size={ox(20)} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.brand}>Gazetteer</Text>
                </View>
                <Text style={styles.clipsLabel}>Clips 24</Text>
            </View>

            <View style={styles.center}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleSelectMedia}
                    style={styles.cameraWrap}
                    accessibilityLabel="Select photo or video"
                >
                    <View style={styles.cameraGlow} />
                    <LinearGradient
                        colors={['#404040', '#d4d4d4']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cameraRing}
                    >
                        <View style={styles.cameraInner}>
                            <Icon name="camera-outline" size={ox(56)} color="#FFFFFF" />
                        </View>
                        <View style={styles.cameraPlus}>
                            <Icon name="add" size={ox(12)} color="#FFFFFF" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.heading}>Add to your Clips page</Text>
                <Text style={styles.subtitle}>Share moments that disappear in 24 hours</Text>

                <TouchableOpacity activeOpacity={0.92} onPress={handleSelectMedia} style={styles.uploadOuter}>
                    <LinearGradient
                        colors={['#404040', '#737373', '#525252']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.uploadPill}
                    >
                        <Text style={styles.decorTL}>📷</Text>
                        <Text style={styles.decorTR}>🎬</Text>
                        <Text style={styles.decorBL}>✨</Text>
                        <Text style={styles.uploadLabel}>Select Photo or Video</Text>
                        <View style={styles.uploadPlus}>
                            <Text style={styles.uploadPlusText}>+</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(16),
        paddingBottom: ox(12),
        backgroundColor: 'rgba(0,0,0,0.9)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
    },
    homeBtn: {
        width: ox(36),
        height: ox(36),
        borderRadius: ox(18),
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brand: {
        color: '#FFFFFF',
        fontSize: ox(18),
        fontWeight: '300',
        letterSpacing: ox(0.3),
    },
    clipsLabel: {
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '300',
        letterSpacing: ox(0.2),
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: ox(24),
    },
    cameraWrap: {
        width: 128,
        height: 128,
        marginBottom: ox(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraGlow: {
        position: 'absolute',
        width: 128,
        height: 128,
        borderRadius: ox(64),
        backgroundColor: 'rgba(255,255,255,0.12)',
        opacity: 0.35,
    },
    cameraRing: {
        width: 128,
        height: 128,
        borderRadius: ox(64),
        padding: ox(3),
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraInner: {
        width: '100%',
        height: '100%',
        borderRadius: ox(64),
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraPlus: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        width: ox(22),
        height: ox(22),
        borderRadius: ox(11),
        backgroundColor: '#525252',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heading: {
        color: '#FFFFFF',
        fontSize: ox(24),
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: ox(10),
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: ox(15),
        textAlign: 'center',
        marginBottom: ox(28),
        lineHeight: ox(22),
    },
    uploadOuter: {
        borderRadius: ox(16),
        overflow: 'visible',
    },
    uploadPill: {
        paddingHorizontal: ox(22),
        paddingVertical: ox(14),
        borderRadius: ox(16),
        borderWidth: 2.5,
        borderColor: 'rgba(255,255,255,0.9)',
        minWidth: 220,
        alignItems: 'center',
        position: 'relative',
        overflow: 'visible',
    },
    decorTL: { position: 'absolute', top: 4, left: 10, fontSize: ox(16), opacity: 0.8 },
    decorTR: { position: 'absolute', top: 2, right: 12, fontSize: ox(14), opacity: 0.6 },
    decorBL: { position: 'absolute', bottom: 4, left: 12, fontSize: ox(12), opacity: 0.5 },
    uploadLabel: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
        letterSpacing: ox(-0.2),
    },
    uploadPlus: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: ox(18),
        height: ox(18),
        borderRadius: ox(9),
        backgroundColor: '#525252',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadPlusText: {
        color: '#FFFFFF',
        fontSize: ox(10),
        fontWeight: '700',
        lineHeight: ox(12),
    },
});
