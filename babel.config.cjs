module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'module:@react-native/babel-preset',
      'nativewind/babel',
    ],
    plugins: [
      './babel-plugin-import-meta-env.cjs',
      '@babel/plugin-transform-class-static-block',
      'react-native-reanimated/plugin',
    ],
    overrides: [
      {
        test: /node_modules[\\/]@gorhom[\\/]bottom-sheet[\\/]/,
        plugins: ['react-native-reanimated/plugin'],
      },
    ],
  };
};
