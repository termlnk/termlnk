/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TERMLNK_CLOUD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
