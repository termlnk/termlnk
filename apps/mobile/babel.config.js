// Expo SDK 55 + RN 0.83 Babel preset.
// `babel-preset-expo` ships New Architecture support, automatic JSX runtime, decorator
// transforms (needed by @wendellhu/redi DI), and Reanimated 4 worklets out of the box.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // The Termlnk DI layer (auth-core / sync / core) declares classes via legacy
          // decorators. babel-preset-expo enables decorators automatically from SDK 51+,
          // but pinning the spec keeps the transform deterministic across upgrades.
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [],
  };
};
