import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    BackHandler,
    Easing,
    PermissionsAndroid,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useMicrophonePermission,
} from 'react-native-vision-camera';

const MAX_VIDEO_SECONDS = 60;
const CARD_RADIUS = 28;
const CARD_HEIGHT_RATIO = 0.7;
const BACKDROP = 'rgba(0, 0, 0, 0.55)';
const BLACK = '#000000';

export type CameraCaptureMode = 'photo' | 'video';

export type CapturedCameraMedia = {
    uri: string;
    type: string;
    fileName: string;
    duration?: number;
};

type Props = {
    visible: boolean;
    mode: CameraCaptureMode;
    onClose: () => void;
    onCapture: (media: CapturedCameraMedia) => void;
};

function formatTimer(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function CreateCameraSheet({ visible, mode, onClose, onCapture }: Props) {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { hasPermission, requestPermission } = useCameraPermission();
    const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
    const [position, setPosition] = useState<'back' | 'front'>('back');
    const device = useCameraDevice(position);
    const cameraRef = useRef<Camera>(null);
    const onCaptureRef = useRef(onCapture);
    const onCloseRef = useRef(onClose);
    const discardRecordingRef = useRef(false);
    const [busy, setBusy] = useState(false);
    const [recording, setRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [cameraAllowed, setCameraAllowed] = useState(false);
    const [micAllowed, setMicAllowed] = useState(false);
    const recordingStartedAt = useRef<number | null>(null);
    const recordingRef = useRef(false);
    const closingRef = useRef(false);
    const slide = useRef(new Animated.Value(screenH)).current;
    const fade = useRef(new Animated.Value(0)).current;
    const [placed, setPlaced] = useState(false);

    onCaptureRef.current = onCapture;
    onCloseRef.current = onClose;
    recordingRef.current = recording;

    const bottomGap = Math.max(insets.bottom, 14);
    const cardW = Math.max(0, screenW - 28);
    const cardH = Math.round(screenH * CARD_HEIGHT_RATIO);

    const finishClose = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        if (recordingRef.current) {
            discardRecordingRef.current = true;
            void cameraRef.current?.stopRecording();
        }
        setPlaced(false);
        slide.setValue(0);
        Animated.parallel([
            Animated.timing(fade, {
                toValue: 0,
                duration: 180,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(slide, {
                toValue: cardH + bottomGap,
                duration: 240,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start(() => {
            closingRef.current = false;
            onCloseRef.current();
        });
    };
    const finishCloseRef = useRef(finishClose);
    finishCloseRef.current = finishClose;

    useEffect(() => {
        if (!visible) {
            setCameraAllowed(false);
            setMicAllowed(false);
            closingRef.current = false;
            return;
        }
        setError(null);
        setPosition('back');
        setBusy(false);
        setRecording(false);
        setElapsed(0);
        discardRecordingRef.current = false;
        let cancelled = false;
        void (async () => {
            if (Platform.OS === 'android') {
                const cameraOk = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
                const micOk = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
                if (cancelled) return;
                setCameraAllowed(cameraOk);
                setMicAllowed(micOk);
                return;
            }
            const cameraOk = hasPermission || (await requestPermission());
            if (cancelled) return;
            setCameraAllowed(cameraOk);
            if (mode === 'video') {
                const micOk = hasMicPermission || (await requestMicPermission());
                if (!cancelled) setMicAllowed(micOk);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [visible, mode, hasPermission, hasMicPermission, requestPermission, requestMicPermission]);

    useEffect(() => {
        if (!visible) {
            setPlaced(false);
            return;
        }
        setPlaced(false);
        slide.setValue(cardH + bottomGap);
        fade.setValue(0);
        const anim = Animated.parallel([
            Animated.timing(fade, {
                toValue: 1,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.spring(slide, {
                toValue: 0,
                useNativeDriver: true,
                damping: 24,
                stiffness: 220,
                mass: 0.85,
            }),
        ]);
        anim.start(({ finished }) => {
            if (finished && !closingRef.current) setPlaced(true);
        });
        return () => anim.stop();
    }, [visible, cardH, bottomGap, fade, slide]);

    useEffect(() => {
        if (!visible || Platform.OS !== 'android') return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            finishCloseRef.current();
            return true;
        });
        return () => sub.remove();
    }, [visible]);

    useEffect(() => {
        if (!recording) return;
        const timer = setInterval(() => {
            const started = recordingStartedAt.current ?? Date.now();
            const seconds = Math.min(MAX_VIDEO_SECONDS, Math.floor((Date.now() - started) / 1000));
            setElapsed(seconds);
            if (seconds >= MAX_VIDEO_SECONDS) {
                void cameraRef.current?.stopRecording();
            }
        }, 250);
        return () => clearInterval(timer);
    }, [recording]);

    const takePhoto = async () => {
        if (busy || recording || !cameraAllowed || !cameraRef.current) return;
        setBusy(true);
        setError(null);
        try {
            const file = await cameraRef.current.takePhoto({ flash: 'off' });
            const path = file.path.startsWith('file://') ? file.path : `file://${file.path}`;
            onCaptureRef.current({
                uri: path,
                type: 'image/jpeg',
                fileName: `photo-${Date.now()}.jpg`,
            });
        } catch {
            setError('Could not take the photo. Try again.');
        } finally {
            setBusy(false);
        }
    };

    const toggleRecording = () => {
        if (!cameraAllowed || !cameraRef.current || busy) return;
        if (recording) {
            void cameraRef.current.stopRecording();
            return;
        }
        setError(null);
        discardRecordingRef.current = false;
        recordingStartedAt.current = Date.now();
        setElapsed(0);
        setRecording(true);
        cameraRef.current.startRecording({
            flash: 'off',
            fileType: 'mp4',
            onRecordingFinished: (video) => {
                setRecording(false);
                recordingStartedAt.current = null;
                if (discardRecordingRef.current) {
                    discardRecordingRef.current = false;
                    return;
                }
                const path = video.path.startsWith('file://') ? video.path : `file://${video.path}`;
                onCaptureRef.current({
                    uri: path,
                    type: 'video/mp4',
                    fileName: `video-${Date.now()}.mp4`,
                    duration: video.duration,
                });
            },
            onRecordingError: () => {
                setRecording(false);
                recordingStartedAt.current = null;
                if (!discardRecordingRef.current) {
                    setError('Could not record the video. Try again.');
                }
                discardRecordingRef.current = false;
            },
        });
    };

    if (!visible) return null;

    const showCamera = cameraAllowed && device != null;

    return (
        <View style={styles.host} pointerEvents="box-none">
            <Animated.View style={[styles.scrim, { opacity: fade }]} />
            <Animated.View
                style={[styles.sheet, !placed && { transform: [{ translateY: slide }] }]}
                pointerEvents="box-none"
            >
                <View style={[styles.card, { height: cardH, marginBottom: bottomGap }]} collapsable={false}>
                    {showCamera ? (
                        <Camera
                            ref={cameraRef}
                            style={{ width: cardW, height: cardH, backgroundColor: BLACK }}
                            device={device}
                            isActive={visible}
                            photo={mode === 'photo'}
                            video={mode === 'video'}
                            audio={mode === 'video' && micAllowed}
                            outputOrientation="preview"
                            androidPreviewViewType="surface-view"
                            resizeMode="cover"
                            onError={(cameraError) => setError(cameraError.message)}
                        />
                    ) : (
                        <View style={styles.previewFallback}>
                            {visible && !cameraAllowed ? <Text style={styles.blocked}>Camera access needed</Text> : null}
                        </View>
                    )}
                    {mode === 'video' ? (
                        <View style={styles.timerWrap} pointerEvents="none">
                            <View style={styles.timerPill}>
                                <View style={styles.timerDot} />
                                <Text style={styles.timerText}>{formatTimer(elapsed)}</Text>
                            </View>
                        </View>
                    ) : null}
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    <View style={styles.controls}>
                        <Pressable style={styles.sideBtn} onPress={finishClose} accessibilityLabel="Close camera">
                            <Icon name="close" size={26} color="#FFFFFF" />
                        </Pressable>
                        {mode === 'video' ? (
                            <Pressable
                                style={styles.shutterRing}
                                onPress={toggleRecording}
                                disabled={!cameraAllowed}
                                accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
                            >
                                {recording ? <View style={styles.recordStop} /> : <View style={styles.recordDot} />}
                            </Pressable>
                        ) : (
                            <Pressable
                                style={styles.shutterRing}
                                onPress={() => void takePhoto()}
                                disabled={!cameraAllowed || busy}
                                accessibilityLabel="Take photo"
                            >
                                {busy ? <ActivityIndicator color="#111111" /> : <View style={styles.shutter} />}
                            </Pressable>
                        )}
                        <Pressable
                            style={[styles.sideBtn, recording && styles.sideBtnDisabled]}
                            onPress={() => {
                                if (recording) return;
                                setPosition((current) => (current === 'back' ? 'front' : 'back'));
                            }}
                            disabled={recording}
                            accessibilityLabel="Flip camera"
                        >
                            <Icon name="camera-reverse-outline" size={24} color="#FFFFFF" />
                        </Pressable>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 80,
        elevation: 0,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: BACKDROP,
    },
    sheet: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    card: {
        marginHorizontal: 14,
        borderRadius: CARD_RADIUS,
        backgroundColor: BLACK,
        overflow: 'hidden',
    },
    camera: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: BLACK,
    },
    previewFallback: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BLACK,
    },
    blocked: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        paddingHorizontal: 28,
    },
    timerWrap: {
        position: 'absolute',
        top: 18,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 4,
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    timerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
    },
    timerText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    error: {
        position: 'absolute',
        top: 58,
        left: 16,
        right: 16,
        textAlign: 'center',
        color: '#FECACA',
        fontSize: 13,
        fontWeight: '600',
        zIndex: 4,
    },
    controls: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 18,
        zIndex: 5,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sideBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sideBtnDisabled: {
        opacity: 0.4,
    },
    shutterRing: {
        width: 78,
        height: 78,
        borderRadius: 39,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutter: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#FFFFFF',
    },
    recordDot: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#FF3B30',
    },
    recordStop: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#FF3B30',
    },
});
