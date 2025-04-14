/// <reference types="vite/client" />
/// <reference types="astro/client.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_BASE_URL: string;
  readonly TURSO_DATABASE_URL: string;
  readonly TURSO_AUTH_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
