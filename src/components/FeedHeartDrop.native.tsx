import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    visible: boolean;
    startX: number;
    startY: number;
    targetRef: React.RefObject<View | null>;
    onComplete: () => void;
};

/** Heart flies from double-tap position to the like button (web HeartDropAnimation parity). */
export default function FeedHeartDrop({ visible, startX, startY, targetRef, onComplete }: Props) {
    const progress = useRef(new Animated.Value(0)).current;
    const [end, setEnd] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!visible) {
            progress.setValue(0);
            setEnd(null);
            return;
        }

        const measureTarget = () => {
            const node = targetRef.current;
            if (!node) {
                onComplete();
                return;
            }
            node.measureInWindow((x, y, width, height) => {
                setEnd({ x: x + width / 2, y: y + height / 2 });
                progress.setValue(0);
                Animated.timing(progress, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: false,
                }).start(({ finished }) => {
                    if (finished) onComplete();
                });
            });
        };

        const t = setTimeout(measureTarget, 50);
        return () => clearTimeout(t);
    }, [visible, startX, startY, targetRef, progress, onComplete]);

    if (!visible || !end) return null;

    const left = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [startX, end.x],
    });
    const top = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [startY, end.y],
    });
    const scale = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.9, 0.5],
    });
    const opacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
    });

    return (
        <Modal transparent visible animationType="none" statusBarTranslucent pointerEvents="none">
            <View style={styles.overlay} pointerEvents="none">
                <Animated.View
                    style={[
                        styles.heart,
                        {
                            left,
                            top,
                            opacity,
                            transform: [{ translateX: -20 }, { translateY: -20 }, { scale }],
                        },
                    ]}
                >
                    <Icon name="heart" size={40} color="#FFFFFF" />
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },
    heart: {
        position: 'absolute',
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
});
