/** iOS FFmpeg is configured manually in ios/Podfile (https-gpl + vendored xcframeworks). */
module.exports = {
    dependencies: {
        'ffmpeg-kit-react-native-alt': {
            platforms: {
                ios: null,
            },
        },
        // Bare RN app: Expo CLI is used for Metro/dev-client, but Expo Modules
        // are not wired in MainApplication. Autolinking :expo pulls in
        // expo-module-gradle-plugin and breaks assembleDebug.
        expo: {
            platforms: {
                android: null,
            },
        },
    },
};
