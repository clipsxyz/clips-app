/** iOS FFmpeg is configured manually in ios/Podfile (https-gpl + vendored xcframeworks). */
module.exports = {
    dependencies: {
        'ffmpeg-kit-react-native-alt': {
            platforms: {
                ios: null,
            },
        },
    },
};
