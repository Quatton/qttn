/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  PUBLIC_BASE_URL: string;
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}
