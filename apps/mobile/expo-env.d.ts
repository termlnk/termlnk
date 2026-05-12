/// <reference types="expo/types" />

// Expo Router 6 ships TypeScript route inference under `typedRoutes: true`. The plugin
// regenerates `.expo/types/router.d.ts` on every `expo start`; this file just keeps the
// reference even when the cache is empty so tsc does not complain about missing decls.
