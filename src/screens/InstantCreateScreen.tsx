import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/Auth';
import Avatar from '../components/Avatar.native';
import CreateGroupModal from '../components/CreateGroupModal.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import { CreateModeIcon } from '../components/CreateModeIcons.native';
import CreateSourceAppsCarouselNative from '../components/CreateSourceAppsCarousel.native';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { GAZETTEER_ABYSS } from '../theme/gazetteerAmbientNative';
import { ensureGalleryMediaPermission } from '../utils/galleryMediaPermissionsNative';

type PickerMode = 'feed' | 'story24';
type CreateModeId = 'community' | 'text' | 'gallery' | 'story';

const CREATE_MODE_ITEMS = [
    { id: 'community' as const, title: 'Community', icon: 'community' as const },
    { id: 'text' as const, title: 'Text only', icon: 'type' as const },
    { id: 'story' as const, title: '24h Story', icon: 'story' as const },
    { id: 'gallery' as const, title: 'Gallery', icon: 'gallery' as const },
] as const;

const ORBIT_RADIUS = 128;
const STEP_DEG = 360 / CREATE_MODE_ITEMS.length;
const GALLERY_INDEX = CREATE_MODE_ITEMS.findIndex((item) => item.id === 'gallery');
const MAX_GALLERY_ITEMS = 10;
/** Mobile optical parity — web CSS px reads larger on phone browsers. */
const TILE_CENTERED = 96;
const TILE_IDLE = 68;
const ICON_CENTERED = 42;
const ICON_IDLE = 32;

function assetIsVideo(asset: { type?: string; uri?: string }) {
    return Boolean(
        asset.type?.startsWith('video') ||
            asset.uri?.toLowerCase().endsWith('.mp4') ||
            asset.uri?.toLowerCase().endsWith('.mov'),
    );
}

function assetIsSupportedGalleryItem(asset: ImagePicker.Asset) {
    if (!asset.uri) return false;
    if (asset.type?.startsWith('image/') || asset.type?.startsWith('video/')) return true;
    if (assetIsVideo(asset)) return true;
    return /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(asset.uri);
}

type HubAlertConfig = {
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
    showIcon?: boolean;
    confirmButtonText?: string;
    cancelButtonText?: string;
    showCancelButton?: boolean;
    onConfirm?: () => void;
};

type OrbitModeItemProps = {
    item: (typeof CREATE_MODE_ITEMS)[number];
    idx: number;
    orbitAnim: Animated.Value;
    centeredMode: CreateModeId;
    onPress: (item: (typeof CREATE_MODE_ITEMS)[number], idx: number, isCentered: boolean) => void;
};

function OrbitModeItem({ item, idx, orbitAnim, centeredMode, onPress }: OrbitModeItemProps) {
    const orbitRotationDeg = Animated.multiply(orbitAnim, -STEP_DEG);
    const angleDeg = Animated.add(Animated.multiply(idx, STEP_DEG), orbitRotationDeg);
    const isCentered = centeredMode === item.id;

    const rotate = angleDeg.interpolate({
        inputRange: [-360, 360],
        outputRange: ['-360deg', '360deg'],
    });
    const counterRotate = angleDeg.interpolate({
        inputRange: [-360, 360],
        outputRange: ['360deg', '-360deg'],
    });
    const scale = angleDeg.interpolate({
        inputRange: [-180, -90, 0, 90, 180],
        // Bottom (±180°) matches left/right — web floors opposite at 0.8, not 0.66.
        outputRange: [0.83, 0.83, 1.34, 0.83, 0.83],
        extrapolate: 'clamp',
    });
    const tileOpacity = angleDeg.interpolate({
        inputRange: [-180, -90, 0, 90, 180],
        outputRange: [0.72, 0.72, 1, 0.72, 0.72],
        extrapolate: 'clamp',
    });
    const contentLift = angleDeg.interpolate({
        inputRange: [-90, 0, 90],
        outputRange: [0, -12, 0],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[
                styles.orbitArm,
                {
                    zIndex: isCentered ? 22 : 21,
                    transform: [{ rotate }, { translateY: -ORBIT_RADIUS }],
                },
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onPress(item, idx, isCentered)}
                style={styles.orbitTouchable}
            >
                <Animated.View
                    style={[
                        styles.orbitContent,
                        { transform: [{ rotate: counterRotate }, { scale }, { translateY: contentLift }] },
                    ]}
                >
                    <Animated.View style={{ opacity: tileOpacity }}>
                        <View
                            style={[
                                styles.modeTile,
                                isCentered ? styles.modeTileActive : styles.modeTileIdle,
                                isCentered ? styles.modeTileLarge : styles.modeTileSmall,
                            ]}
                        >
                            {isCentered ? (
                                <View style={styles.modePlus}>
                                    <Text style={styles.modePlusText}>+</Text>
                                </View>
                            ) : null}
                            <CreateModeIcon
                                id={item.icon}
                                size={isCentered ? ICON_CENTERED : ICON_IDLE}
                                color={isCentered ? '#0B1220' : '#FFFFFF'}
                            />
                        </View>
                    </Animated.View>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.modeLabel,
                            isCentered ? styles.modeLabelActive : styles.modeLabelIdle,
                        ]}
                    >
                        {item.title}
                    </Text>
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function InstantCreateScreen({ navigation }: any) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [centeredMode, setCenteredMode] = useState<CreateModeId>('gallery');
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [hubAlert, setHubAlert] = useState<HubAlertConfig | null>(null);
    const orbitIndexRef = useRef(GALLERY_INDEX >= 0 ? GALLERY_INDEX : 0);
    const orbitAnim = useRef(new Animated.Value(GALLERY_INDEX >= 0 ? GALLERY_INDEX : 0)).current;
    const didInit = useRef(false);

    const setOrbitIndex = useCallback(
        (idx: number) => {
            const len = CREATE_MODE_ITEMS.length;
            const next = ((idx % len) + len) % len;
            orbitIndexRef.current = next;
            setCenteredMode(CREATE_MODE_ITEMS[next].id);
            Animated.timing(orbitAnim, {
                toValue: next,
                duration: 700,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        },
        [orbitAnim],
    );

    const stepOrbitMode = useCallback(
        (delta: number) => {
            setOrbitIndex(orbitIndexRef.current + delta);
        },
        [setOrbitIndex],
    );

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;
        setOrbitIndex(GALLERY_INDEX >= 0 ? GALLERY_INDEX : 0);
    }, [setOrbitIndex]);

    const dialPanResponder = useMemo(() => {
        let startY = 0;
        return PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12,
            onPanResponderGrant: (_, g) => {
                startY = g.y0;
            },
            onPanResponderMove: (_, g) => {
                const deltaY = g.moveY - startY;
                if (Math.abs(deltaY) < 48) return;
                stepOrbitMode(deltaY > 0 ? -1 : 1);
                startY = g.moveY;
            },
            onPanResponderTerminationRequest: () => false,
        });
    }, [stepOrbitMode]);

    const navigateFromAssets = (assets: ImagePicker.Asset[], mode: PickerMode, carousel: boolean) => {
        if (!assets.length) return;
        if (carousel && assets.length >= 2) {
            const items = assets
                .filter((a) => a.uri)
                .slice(0, 10)
                .map((a) => {
                    const isVideo = assetIsVideo(a);
                    const slide: {
                        uri: string;
                        type: 'image' | 'video';
                        videoCoverTime?: number;
                        durationSec?: number;
                    } = {
                        uri: a.uri!,
                        type: isVideo ? 'video' : 'image',
                    };
                    if (isVideo) {
                        slide.videoCoverTime = 0;
                        const d = Number(a.duration || 0);
                        if (Number.isFinite(d) && d > 0) {
                            slide.durationSec = Math.max(0.1, Math.floor(d * 10) / 10);
                        }
                    }
                    return slide;
                });
            navigation.navigate('GalleryPreview', { carouselItems: items, story24: mode === 'story24' });
            return;
        }
        const asset = assets[0];
        if (!asset?.uri) return;
        navigation.navigate('GalleryPreview', {
            mediaUrl: asset.uri,
            mediaType: assetIsVideo(asset) ? 'video' : 'image',
            story24: mode === 'story24',
        });
    };

    const pickGalleryMedia = useCallback(
        async (mode: PickerMode = 'feed') => {
            const allowed = await ensureGalleryMediaPermission();
            if (!allowed) {
                setHubAlert({
                    title: 'Gallery access needed',
                    message: 'Allow photo and video access in Settings to upload from your gallery.',
                    icon: 'alert',
                    confirmButtonText: 'OK',
                });
                return;
            }
            ImagePicker.launchImageLibrary(
                {
                    mediaType: 'mixed',
                    quality: 0.9,
                    selectionLimit: MAX_GALLERY_ITEMS,
                    videoQuality: 'high',
                },
                (response) => {
                    if (response.didCancel) return;
                    if (response.errorCode) {
                        setHubAlert({
                            title: 'Media error',
                            message: response.errorMessage || 'Could not open your gallery.',
                            icon: 'alert',
                            confirmButtonText: 'OK',
                        });
                        return;
                    }
                    const rawAssets = response.assets || [];
                    const supported = rawAssets.filter(assetIsSupportedGalleryItem);
                    if (supported.length === 0) {
                        setHubAlert({
                            title: 'No Supported Files',
                            message: 'Please select images or videos from your gallery.',
                            icon: 'alert',
                            confirmButtonText: 'OK',
                        });
                        return;
                    }

                    const proceed = () => {
                        const items = supported.slice(0, MAX_GALLERY_ITEMS);
                        navigateFromAssets(items, mode, items.length >= 2);
                    };

                    if (supported.length > MAX_GALLERY_ITEMS) {
                        setHubAlert({
                            title: 'Too Many Items',
                            message: `You can select up to ${MAX_GALLERY_ITEMS} items for a carousel.`,
                            icon: 'alert',
                            confirmButtonText: 'OK',
                            onConfirm: () => {
                                setHubAlert(null);
                                proceed();
                            },
                        });
                        return;
                    }

                    proceed();
                },
            );
        },
        [navigateFromAssets],
    );

    const openGallerySourceExplainer = useCallback(() => {
        setHubAlert({
            title: 'Upload from your gallery',
            message:
                'If you have videos from TikTok, Instagram, CapCut, or Instagram Edits saved on your phone, they show up in your gallery like any other clip. Tap Proceed to pick photos or videos — same as choosing Gallery below.',
            showIcon: false,
            confirmButtonText: 'Proceed',
            cancelButtonText: 'Not now',
            showCancelButton: true,
            onConfirm: () => {
                setHubAlert(null);
                setTimeout(() => void pickGalleryMedia('feed'), 100);
            },
        });
    }, [pickGalleryMedia]);

    const handleModePress = (
        item: (typeof CREATE_MODE_ITEMS)[number],
        idx: number,
        isCentered: boolean,
    ) => {
        if (!isCentered) {
            setOrbitIndex(idx);
            return;
        }
        if (item.id === 'gallery') {
            void pickGalleryMedia('feed');
            return;
        }
        if (item.id === 'text') {
            navigation.navigate('TextOnlyCreate');
            return;
        }
        if (item.id === 'story') {
            navigation.navigate('Clip', { storyMode: true });
            return;
        }
        setHubAlert({
            title: 'Create a community',
            message:
                'Communities let members chat in one group space. Create a community, then invite people with the + button in the group chat.',
            icon: 'info',
            confirmButtonText: 'Continue',
            cancelButtonText: 'Not now',
            showCancelButton: true,
            onConfirm: () => {
                setHubAlert(null);
                setTimeout(() => setCreateGroupOpen(true), 100);
            },
        });
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }
        navigation.navigate('MainTabs', { screen: 'Home' });
    };

    return (
        <GazetteerScreenShell
            edges={['top']}
            ambient
            ambientVariant="discover"
            style={styles.shell}
        >
            <LinearGradient
                colors={['rgba(0,0,0,0.5)', 'transparent']}
                style={styles.headerScrim}
                pointerEvents="none"
            />
            <View style={styles.headerBar}>
                <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="Back">
                    <Icon name="arrow-back" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.body}>
                <View style={styles.orbitZone} {...dialPanResponder.panHandlers}>
                    <View style={styles.orbitStage}>
                        <View style={styles.avatarRing}>
                            <View style={styles.avatarInner}>
                                <Avatar
                                    src={user?.avatarUrl}
                                    name={user?.name || user?.handle || 'User'}
                                    size={84}
                                />
                            </View>
                        </View>

                        {CREATE_MODE_ITEMS.map((item, idx) => (
                            <OrbitModeItem
                                key={item.id}
                                item={item}
                                idx={idx}
                                orbitAnim={orbitAnim}
                                centeredMode={centeredMode}
                                onPress={handleModePress}
                            />
                        ))}
                    </View>
                </View>

                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                    <CreateSourceAppsCarouselNative onExplainTap={openGallerySourceExplainer} />
                    <Text style={styles.helperText}>
                        Rotate to choose · top icon is active · tap to open
                    </Text>
                </View>
            </View>

            <CreateGroupModal
                visible={createGroupOpen}
                onClose={() => setCreateGroupOpen(false)}
                onCreated={(group) => {
                    setCreateGroupOpen(false);
                    navigation.replace('Messages', {
                        chatGroupId: group.id,
                        kind: 'group',
                        groupName: group.name,
                        communityCreated: true,
                        communityCreatedName: group.name,
                    });
                }}
            />
            <GazetteerAlertSheet
                visible={hubAlert !== null}
                title={hubAlert?.title ?? ''}
                message={hubAlert?.message}
                icon={hubAlert?.icon}
                showIcon={hubAlert?.showIcon}
                confirmButtonText={hubAlert?.confirmButtonText ?? 'OK'}
                cancelButtonText={hubAlert?.cancelButtonText ?? 'Not now'}
                showCancelButton={hubAlert?.showCancelButton ?? false}
                onConfirm={() => {
                    if (hubAlert?.onConfirm) {
                        hubAlert.onConfirm();
                        return;
                    }
                    setHubAlert(null);
                }}
                onDismiss={() => setHubAlert(null)}
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    shell: {
        flex: 1,
        backgroundColor: GAZETTEER_ABYSS,
    },
    headerScrim: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 88,
        zIndex: 1,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        zIndex: 2,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 2,
    },
    headerTitle: {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    headerSpacer: { width: 32 },
    body: {
        flex: 1,
        minHeight: 0,
    },
    orbitZone: {
        flex: 1,
        minHeight: 320,
        paddingTop: 24,
        overflow: 'visible',
    },
    orbitStage: {
        flex: 1,
        minHeight: 300,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    avatarRing: {
        position: 'absolute',
        width: 88,
        height: 88,
        borderRadius: 44,
        padding: 1,
        backgroundColor: '#FFFFFF',
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.35,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
        zIndex: 50,
    },
    avatarInner: {
        flex: 1,
        borderRadius: 44,
        overflow: 'hidden',
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    orbitArm: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 0,
        height: 0,
        overflow: 'visible',
    },
    orbitTouchable: {
        position: 'absolute',
        left: -96,
        top: -58,
        width: 192,
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflow: 'visible',
    },
    orbitContent: {
        alignItems: 'center',
        overflow: 'visible',
    },
    modeTile: {
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    modeTileLarge: {
        width: TILE_CENTERED,
        height: TILE_CENTERED,
    },
    modeTileSmall: {
        width: TILE_IDLE,
        height: TILE_IDLE,
    },
    modeTileActive: {
        backgroundColor: '#F3F4F6',
        borderColor: 'rgba(255,255,255,0.95)',
    },
    modeTileIdle: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: 'rgba(255,255,255,0.22)',
    },
    modePlus: {
        position: 'absolute',
        right: -8,
        top: '50%',
        marginTop: -14,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    modePlusText: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '700',
    },
    modeLabel: {
        marginTop: 8,
        minWidth: 120,
        maxWidth: 220,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
        includeFontPadding: false,
    },
    modeLabelActive: { opacity: 1 },
    modeLabelIdle: { opacity: 0.7 },
    footer: {
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
    },
    helperText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        lineHeight: 15,
        textAlign: 'center',
    },
});
