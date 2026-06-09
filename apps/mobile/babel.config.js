// Expo SDK 56 + NativeWind v5 Babel preset.
//
// `babel-plugin-typescript-decorators` is a full legacy-decorator transform (forked from
// @babel/plugin-proposal-decorators). Unlike `babel-plugin-parameter-decorator`, it processes
// the class and its parameter decorators together, so it correctly handles a parameter decorator
// combined with a TS parameter property (`@Inject() private readonly _x: T`) — letting mobile DI
// match the desktop param-property style instead of splitting every field by hand.
//
// This relies on the `babel-preset-expo` patch (patches/babel-preset-expo@*.patch) that sets
// `onlyRemoveTypeImports: true` on the embedded `@babel/plugin-transform-typescript`. Without it,
// usage-based import elision drops the value import backing a decorator (the decorator plugin
// relocates `Inject(Injector)` into a synthesized sequence the elision pass cannot see), giving
// a runtime `ReferenceError: Property 'Inject' doesn't exist`. The project enforces `import type`
// for type-only imports (@antfu consistent-type-imports), so disabling usage-based elision is safe.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { unstable_transformImportMeta: true }],
      'nativewind/babel',
    ],
    plugins: ['babel-plugin-typescript-decorators'],
  };
};
