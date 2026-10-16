/**
 * Build-time application metadata.
 *
 * Re-exported from a module (instead of reading the injected global directly in
 * components) so tests and consumers have one documented access point.
 */

/**
 * Version of the frontend bundle.
 *
 * Injected by Vite's `define` (see `vite.config.ts`). The release pipeline
 * exports `APP_VERSION` from the git tag (`v0.1.0` -> `0.1.0`); every other
 * build falls back to `package.json` `version` plus a `-local` suffix, so a
 * local/dev build is never mistaken for a released version. Mirrors the backend
 * value reported by the `app_version` Tauri command.
 */
export const FRONTEND_VERSION: string = __APP_VERSION__;
