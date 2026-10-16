/// <reference types="vite/client" />

/**
 * Frontend bundle version, injected at build time by Vite's `define`
 * (see `vite.config.ts`, which reads `package.json` `version`). The release
 * pipeline syncs `package.json` to the pushed git tag so this matches the
 * shipped release.
 */
declare const __APP_VERSION__: string;
