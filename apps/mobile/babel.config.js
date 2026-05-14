// Expo SDK 55 + RN 0.83 Babel preset.
// `babel-preset-expo` ships New Architecture support, automatic JSX runtime, decorator
// transforms (needed by @wendellhu/redi DI), and Reanimated 4 worklets out of the box.
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
    ],
    plugins: ['babel-plugin-parameter-decorator'],
  };
};
