module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    'nativewind/babel',
  ],
  plugins: [
    './babel-plugin-import-meta-env.cjs',
    'react-native-reanimated/plugin',
  ],
};
