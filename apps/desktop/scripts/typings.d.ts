declare module 'electron-packager-languages' {
  import type { HookFunction } from '@electron/packager';

  function setLanguages(
    languages: string[],
    options?: { allowRemovingAll?: boolean }
  ): HookFunction;

  export default setLanguages;
}
