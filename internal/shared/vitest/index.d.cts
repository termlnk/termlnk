import type { UserConfig } from 'vitest/config';

declare function createConfig(options?: UserConfig): UserConfig;

// eslint-disable-next-line no-restricted-syntax
export = createConfig;
