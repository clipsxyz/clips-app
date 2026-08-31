import 'react-native';

/**
 * React Native 0.85 dropped `StyleSheet.absoluteFillObject` from public types
 * (use `absoluteFill`). Native views still pass the old name; keep it as an alias.
 *
 * `Image` no longer lists `pointerEvents`; it still works on the native view.
 */
declare module 'react-native' {
  export namespace StyleSheet {
    export const absoluteFillObject: {
      readonly position: 'absolute';
      readonly left: 0;
      readonly right: 0;
      readonly top: 0;
      readonly bottom: 0;
    };
  }

  interface ImageProps {
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  }
}

declare module '@react-navigation/bottom-tabs' {
  /** RN 0.85 / Navigation 7 uses `sceneStyle`; keep the old name as an alias for older call sites. */
  interface BottomTabNavigationConfig {
    sceneContainerStyle?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  }
}

declare module 'react-native-video' {
  interface ReactVideoSourceProperties {
    uri?: string | number;
  }
}

declare module 'ffmpeg-kit-react-native-alt' {
    export const FFmpegKit: {
        execute: (command: string) => Promise<{
            getReturnCode: () => Promise<unknown>;
        }>;
    };
    export const ReturnCode: {
        isSuccess: (code: unknown) => boolean;
    };
}
