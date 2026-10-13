# AGENTS.md

Tauri 2 desktop app (`dupe-studio`) with a React 19 + TypeScript + Vite frontend.
Despite the name, no duplicate-detection logic exists yet: `src/App.tsx` is still the
untouched Tauri demo and `fdir` is installed but unimported.

## Commands

- Package manager is **bun** (`bun.lock`); `src-tauri/tauri.conf.json` runs `bun run dev` /
  `bun run build`. A `package-lock.json` also exists but bun is authoritative.
- `bun install` — install frontend deps
- `bun run tauri dev` — run the desktop app (Vite dev server + Rust build).
  Bare `bun run dev` only starts Vite in a browser, not the app window.
- `bun run build` — `tsc && vite build`; this is the only type-check. There is **no test or
  lint script** — do not assume/add `npm test`.
- `bun run tauri build` — production bundle
- Rust: build/check from `src-tauri/` with `cargo check` / `cargo clippy`.

## TypeScript quirks

- `strict` + `noUnusedLocals` + `noUnusedParameters`: unused locals/params fail `bun run build`.
- `vite.config.ts` imports `node:process` under `@ts-expect-error` because `@types/node` is not
  installed. Do not remove the directive; adding `@types/node` makes it an "unused directive" error.

## Frontend <-> Rust boundary

- Rust entrypoint is `src-tauri/src/lib.rs`. `main.rs` only calls `dupe_studio_lib::run()` —
  edit `lib.rs`, not `main.rs`.
- New `#[tauri::command]` handlers must be registered in
  `.invoke_handler(tauri::generate_handler![...])` in `lib.rs` or `invoke` will fail at runtime.
- Frontend calls commands via `invoke` from `@tauri-apps/api/core`.
- Plugin permissions live in `src-tauri/capabilities/default.json`; a new plugin needs its
  permission added there (pattern: `opener:default`).
- `src-tauri/gen/schemas/` is generated; do not hand-edit.

## Dev server / toolchain

- Vite is pinned to port `1420` with `strictPort: true`; `tauri.conf.json` `devUrl` depends on it.
- Vite ignores `**/src-tauri/**`; Rust edits trigger a Tauri rebuild, not HMR.
- `src-tauri/Cargo.toml` uses `edition = "2024"`, requiring a recent stable Rust toolchain.
