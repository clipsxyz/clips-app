/** iOS FFmpeg is configured manually in ios/Podfile (https-gpl + vendored xcframeworks). */
/**
 * `expo@^57` is still listed in package.json but nothing in src/ or App.native.tsx
 * imports it (0 `expo*` imports). Gradle's `autolinkLibrariesFromCommand()` would
 * otherwise turn it into an `:expo` project, and `expo-module-gradle-plugin` is not
 * wired into android/settings.gradle — which fails the whole Android build with
 * "Plugin with id 'expo-module-gradle-plugin' not found".
 *
 * Opt the package out of Android autolinking so a plain `gradlew :app:installDebug`
 * works. Remove this entry if the app genuinely adopts Expo native modules.
 */
module.exports = {
    dependencies: {
        'ffmpeg-kit-react-native-alt': {
            platforms: {
                ios: null,
            },
        },
        expo: {
            platforms: {
                android: null,
            },
        },
    },
};
