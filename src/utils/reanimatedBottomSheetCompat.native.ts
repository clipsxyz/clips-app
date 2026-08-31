/**
 * @gorhom/bottom-sheet prebuilt lib still calls Reanimated 3 whitelisting APIs removed in v4.
 * Must run before any @gorhom/bottom-sheet import (see index.js).
 */
import Animated from 'react-native-reanimated';

type ReanimatedModule = typeof import('react-native-reanimated') & {
    addWhitelistedUIProps?: (props: Record<string, boolean>) => void;
    addWhitelistedNativeProps?: (props: Record<string, boolean>) => void;
};

const reanimatedModule = require('react-native-reanimated') as ReanimatedModule;

const animatedDefault = reanimatedModule.default ?? Animated;
const animatedWithShims = animatedDefault as typeof Animated & {
    addWhitelistedUIProps?: (props: Record<string, boolean>) => void;
    addWhitelistedNativeProps?: (props: Record<string, boolean>) => void;
};

if (typeof animatedWithShims.addWhitelistedUIProps !== 'function') {
    animatedWithShims.addWhitelistedUIProps = () => {};
}
if (typeof animatedWithShims.addWhitelistedNativeProps !== 'function') {
    animatedWithShims.addWhitelistedNativeProps = () => {};
}
