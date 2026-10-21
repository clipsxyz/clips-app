/* @refresh reset */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
    type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DISCOVER_SHEET_BASE, DISCOVER_SHEET_BORDER } from '../utils/discoverAmbientPalette';

/** Discover Canvas sheet preset — solid base of the sheet gradient
 * (gorhom backgroundStyle can't paint a gradient; inner content that needs
 * the full wash should render DiscoverSheetCanvas). All dark presets are
 * standardized to this single shape; LIGHT stays light for the Scenes DM
 * composer whose content is dark-on-light by design. */
export const GAZETTEER_SHEET_DISCOVER = {
    background: {
        backgroundColor: DISCOVER_SHEET_BASE,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: DISCOVER_SHEET_BORDER,
    } as ViewStyle,
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.28)',
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

export const GAZETTEER_SHEET_DARK = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_NAVY = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_PROFILE = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_CHARCOAL = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_DM = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_BOOST = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_SAVE = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_PASSPORT = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_STICKER = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_SLATE = GAZETTEER_SHEET_DISCOVER;
export const GAZETTEER_SHEET_GROUP = GAZETTEER_SHEET_DISCOVER;

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
    /** Delay before present(); raise this when opening after another RN Modal. */
    presentDelayMs?: number;
};

/**
 * Shared @gorhom/bottom-sheet modal — drag-to-dismiss, native backdrop, safe-area aware.
 *
 * Hook order is fixed: every hook runs on every render, then we may return null.
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
    presentDelayMs = 50,
}: Props) {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const presentStateRef = useRef({ didPresent: false, presentDelayMs });
    presentStateRef.current.presentDelayMs = presentDelayMs;
    const insets = useSafeAreaInsets();

    const snapPoints = useMemo(
        () => (enableDynamicSizing ? undefined : snapPointsProp ?? ['70%']),
        [enableDynamicSizing, snapPointsProp],
    );

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

    useEffect(() => {
        if (visible) {
            const t = setTimeout(() => {
                bottomSheetRef.current?.present();
                presentStateRef.current.didPresent = true;
            }, presentStateRef.current.presentDelayMs);
            return () => clearTimeout(t);
        }
        if (presentStateRef.current.didPresent) {
            bottomSheetRef.current?.dismiss();
            presentStateRef.current.didPresent = false;
        }
        return undefined;
    }, [visible]);

    if (!visible) return null;

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            snapPoints={snapPoints}
            enableDynamicSizing={enableDynamicSizing}
            enablePanDownToClose={enablePanDownToClose}
            onDismiss={onDismiss}
            onChange={(index) => {
                if (index === -1) presentStateRef.current.didPresent = false;
            }}
            backdropComponent={renderBackdrop}
            backgroundStyle={backgroundStyle ?? GAZETTEER_SHEET_DISCOVER.background}
            handleIndicatorStyle={handleIndicatorStyle ?? GAZETTEER_SHEET_DISCOVER.handle}
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
