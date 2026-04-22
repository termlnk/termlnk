#!/usr/bin/env -S npx tsx
/* eslint-disable header/header */

import type { IBuildOptions } from '../vite';
import { argv } from 'node:process';
import { build } from '../vite';

const argvs = argv.slice(2);
const [command, ...args] = argvs;

if (command === 'build') {
  const options: IBuildOptions = {
    skipUMD: true,
  };

  if (args.includes('--cleanup')) {
    options.cleanup = true;
  }
  if (args.includes('--nodeFirst')) {
    options.nodeFirst = true;
  }

  build(options);
}
