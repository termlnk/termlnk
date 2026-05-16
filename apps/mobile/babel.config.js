// Expo SDK 55 + RN 0.83 + NativeWind v5 Babel preset.
//
// `nativewind/babel` re-exports the react-native-css transform used by v5. It
// rewrites React Native primitive imports to className-aware components while
// Metro compiles imported CSS files through the Tailwind v4 pipeline.
// Reanimated v4 (the version Expo SDK 55 ships) bundles `react-native-worklets/plugin`
// internally; do NOT add it to plugins or you'll get duplicate-plugin errors at
// transform time. The Reanimated Babel plugin itself is also auto-configured by
// babel-preset-expo for SDK 50+, so it doesn't need an explicit entry here either.
//
// `babel-plugin-parameter-decorator` patches Babel's well-known blind spot: legacy
// `@babel/plugin-proposal-decorators` does not transform parameter decorators
// (https://github.com/babel/babel/issues/9838). Without it, redi's `@Inject(...)` /
// `@InjectSelf()` on constructor parameters get silently stripped, DI metadata never
// registers, and `injector.createInstance(plugin)` returns an instance whose injected
// fields are all `undefined`. Caveat: this plugin still cannot combine a parameter
// decorator with a TypeScript parameter property (`@Inject() private readonly _x: T`)
// because `@babel/plugin-transform-typescript` rewrites the TSParameterProperty before
// the decorator visitor runs. Inside apps/mobile/src, decorated params must be plain
// identifiers with an explicit `this._x = x` assignment in the constructor body.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          unstable_transformImportMeta: true,
        },
      ],
      'nativewind/babel',
    ],
    plugins: ['babel-plugin-parameter-decorator'],
  };
};
