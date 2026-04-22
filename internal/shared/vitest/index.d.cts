import type { ViteUserConfig } from 'vitest/config';

declare function createConfig(options?: ViteUserConfig): ViteUserConfig;

// eslint-disable-next-line no-restricted-syntax
export = createConfig;
