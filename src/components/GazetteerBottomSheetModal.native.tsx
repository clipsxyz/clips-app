import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
    type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GAZETTEER_SHEET_DARK = {
    background: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.2)',
    } as ViewStyle,
};

export const GAZETTEER_SHEET_LIGHT = {
    background: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: '#D1D5DB',
    } as ViewStyle,
};

/** Profile / tagged-people sheets (#0b1220). */
export const GAZETTEER_SHEET_NAVY = {
    background: {
        backgroundColor: '#0b1220',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: '#4B5563',
    } as ViewStyle,
};

/** Share profile glass card (#1a1524 + glassPanel applied in sheet). */
export const GAZETTEER_SHEET_PROFILE = {
    background: {
        backgroundColor: '#1a1524',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.2)',
    } as ViewStyle,
};

/** Story share / insights, DM-adjacent charcoal. */
export const GAZETTEER_SHEET_CHARCOAL = {
    background: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    } as ViewStyle,
    handle: {
        width: 48,
        backgroundColor: 'rgba(255,255,255,0.25)',
    } as ViewStyle,
};

export const GAZETTEER_SHEET_DM = {
    background: {
        backgroundColor: '#000000',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.15)',
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.25)',
    } as ViewStyle,
};

/** Boost insights (#0a0a0a). */
export const GAZETTEER_SHEET_BOOST = {
    background: {
        backgroundColor: '#0a0a0a',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.25)',
    } as ViewStyle,
};

/** Save post / collections (#1f2937). */
export const GAZETTEER_SHEET_SAVE = {
    background: {
        backgroundColor: '#1f2937',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: '#4B5563',
    } as ViewStyle,
};

/** View Profile night-atlas canvas (comments / pull-up cards). */
export const GAZETTEER_SHEET_PASSPORT = {
    background: {
        backgroundColor: '#060d16',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.28)',
    } as ViewStyle,
};

/** Sticker picker (#120a1c). */
export const GAZETTEER_SHEET_STICKER = {
    background: {
        backgroundColor: '#120a1c',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: '#4B5563',
    } as ViewStyle,
};

/** Edit post / notify menu (#1a1a1a). */
export const GAZETTEER_SHEET_SLATE = {
    background: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
    } as ViewStyle,
};

/** Invite-to-group list (#111). */
export const GAZETTEER_SHEET_GROUP = {
    background: {
        backgroundColor: '#111111',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.2)',
    } as ViewStyle,
};

type Props = {
    visible: boolean;
    onDismiss: () => void;
    children: React.ReactNode;
    snapPoints?: (string | number)[];
    /** Match web feed sheet side inset (px-3). */
    horizontalInset?: number;
    backgroundStyle?: ViewStyle;
    handleIndicatorStyle?: ViewStyle;
    backdropOpacity?: number;
    enablePanDownToClose?: boolean;
    footerComponent?: BottomSheetModalProps['footerComponent'];
    keyboardBehavior?: BottomSheetModalProps['keyboardBehavior'];
    keyboardBlurBehavior?: BottomSheetModalProps['keyboardBlurBehavior'];
    android_keyboardInputMode?: BottomSheetModalProps['android_keyboardInputMode'];
    enableDynamicSizing?: boolean;
};

/**
 * Shared @gorhom/bottom-sheet modal — drag-to-dismiss, native backdrop, safe-area aware.
 */
export default function GazetteerBottomSheetModal({
    visible,
    onDismiss,
    children,
    snapPoints: snapPointsProp,
    horizontalInset = 12,
    backgroundStyle,
    handleIndicatorStyle,
    backdropOpacity = 0.6,
    enablePanDownToClose = true,
    footerComponent,
    keyboardBehavior,
    keyboardBlurBehavior,
    android_keyboardInputMode,
    enableDynamicSizing = false,
}: Props) {
    const ref = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const snapPoints = useMemo(
        () => (enableDynamicSizing ? undefined : snapPointsProp ?? ['70%']),
        [enableDynamicSizing, snapPointsProp],
    );

    useEffect(() => {
        if (visible) {
            // Native-stack pushes often miss an immediate present(); defer one frame.
            const t = setTimeout(() => {
                ref.current?.present();
            }, 50);
            return () => clearTimeout(t);
        }
        ref.current?.dismiss();
        return undefined;
    }, [visible]);

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={backdropOpacity}
                pressBehavior="close"
            />
        ),
        [backdropOpacity],
    );

    return (
        <BottomSheetModal
            ref={ref}
            snapPoints={snapPoints}
            enableDynamicSizing={enableDynamicSizing}
            enablePanDownToClose={enablePanDownToClose}
            onDismiss={onDismiss}
            backdropComponent={renderBackdrop}
            backgroundStyle={backgroundStyle}
            handleIndicatorStyle={handleIndicatorStyle}
            footerComponent={footerComponent}
            keyboardBehavior={keyboardBehavior}
            keyboardBlurBehavior={keyboardBlurBehavior}
            android_keyboardInputMode={android_keyboardInputMode}
            bottomInset={Math.max(insets.bottom, 16)}
            containerStyle={[styles.container, { marginHorizontal: horizontalInset }]}
        >
            {children}
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    container: {
        zIndex: 1000,
    },
});
