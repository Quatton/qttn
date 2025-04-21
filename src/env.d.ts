/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_BASE_URL: string;
  readonly TURSO_DATABASE_URL: string;
  readonly TURSO_AUTH_TOKEN: string;

  readonly SESSION: KVNamespace;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
