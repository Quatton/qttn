/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly TURSO_DATABASE_URL: string;
  readonly TURSO_AUTH_TOKEN: string;
  readonly PUBLIC_BASE_URL: string;
  readonly ANALYTICS_DISABLED: string;
  readonly PUBLIC_ANALYTICS_DISABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
