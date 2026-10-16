# AGENTS.md

Tauri 2 desktop app (`dupe-studio`) with a React 19 + TypeScript + Vite frontend.
`dupe-studio` is a GUI for browsing and querying data from supported DBMSs (MySQL
today). The frontend lives under `src/` and follows the structure defined in
`docs/programming-guidelines.md` (Mantine + Tailwind, TanStack Query + Zustand, Vitest
for unit tests).

`docs/programming-guidelines.md` is loaded every session via `opencode.json`
`instructions`; it requires library-standard documentation for all frontend and backend
public APIs.

## Commands

- Package manager is **bun** (`bun.lock`); `src-tauri/tauri.conf.json` runs `bun run dev` /
  `bun run build`. A `package-lock.json` also exists but bun is authoritative.
- `bun install` — install frontend deps
- `bun run tauri dev` — run the desktop app (Vite dev server + Rust build).
  Bare `bun run dev` only starts Vite in a browser, not the app window.
- `bun run build` — `tsc && vite build`; `tsc` is the type-check.
- `bun run typecheck` — `tsc` only.
- `bun run test` — Vitest unit tests (`test:watch` watches, `test:coverage` writes a report).
- `bun run check` — Biome lint + format + import-order check (`check:write` applies fixes).
- `bun run lint` / `bun run format` — lint-only / format-only.
- `bun run tauri build` — production bundle
- Rust: build/check from `src-tauri/` with `cargo check` / `cargo clippy`.

## Lint / format (Biome)

- Config is `biome.json`: 2-space indent, double quotes, `recommended` rules, organize-imports on.
- `public/` and `dist/` are excluded; `node_modules` comes from `vcs.useIgnoreFile`.
- `.gitattributes` forces `eol=lf`; if files show as `w/crlf`, re-checkout — Biome expects LF.

## Verification (required for every change)

Run these before treating any implementation as done:

1. `bun run check:write` — Biome lint + format + import order (fixes in place).
2. `bun run test` — Vitest unit tests.
3. `bun run build` — runs `tsc` (the type-check) then `vite build`.
4. Rust changes only: `bun run test:rust` (fmt check + clippy + `cargo test`), or run
   `cargo fmt`, `cargo clippy --all-targets`, and `cargo test` from `src-tauri/`
   directly.

The frontend test runner is Vitest (`bun run test`), configured in `vite.config.ts` with
setup in `src/test/setup.ts`; co-locate `*.test.tsx` files next to the code. The Rust
crate does have `cargo test`: unit tests live beside the code and MySQL integration
tests in `src-tauri/tests/mysql_integration.rs` are opt-in — they skip unless
`DUPE_STUDIO_MYSQL_URL` (or `MYSQL_TEST_URL`) points at a reachable server.
`.github/workflows/backend.yml` runs fmt + clippy + `cargo test` on Linux with a
MySQL service container that supplies `DUPE_STUDIO_MYSQL_URL`.

## TypeScript quirks

- `strict` + `noUnusedLocals` + `noUnusedParameters`: unused locals/params fail `bun run build`.
- `vite.config.ts` imports `node:process` under `@ts-expect-error` because `@types/node` is not
  installed. Do not remove the directive; adding `@types/node` makes it an "unused directive" error.

## Internationalization (i18n)

- The frontend is localized with `react-i18next` (https://react.i18next.com/). Setup lives in
  `src/i18n/` (`index.ts` init, `resources.ts` loads the locale files) and translations in
  `src/i18n/locales/<language>.json5`.
- Locale files are **JSON5** (comments, trailing commas, unquoted keys). Vite does not parse
  JSON5, so `resources.ts` imports them with `?raw` and runs `json5.parse`. Add a language by
  creating `locales/<code>.json5` and adding the code to `supportedLanguages`.
- **All backend responses must be i18n keys, never user-facing prose.** Tauri commands and
  errors return stable keys (for example `errors.database.connectionFailed`); the frontend is
  responsible for mapping/looking up the key and translating it. Resolve them with
  `translateErrorKey` from `src/i18n/errors.ts` (falling back to `errors.unknown`) — never
  render a raw backend string or key.
- Never hard-code user-facing text in components or config; add a key to every locale file and
  resolve it with `useTranslation`. The sidebar labels/descriptions in
  `src/config/configureSidebar.tsx` are keys, not literals.
- Group keys by area (`app.*`, `navigation.*`, `common.*`, `errors.*`) and add every new key to
  all locales.

## Frontend component structure

- **One folder per component**: `<ComponentName>/<ComponentName>.tsx` beside an `index.ts`
  barrel that re-exports only the public surface (`export { X } from "./X"`). Import
  components through the folder, never the implementation file. This applies everywhere,
  including pages, layouts, modals and error boundaries.
- Non-component modules stay plain files: Zustand stores, hooks, registries, route tables,
  configs and helpers (`store/modalStore.ts`, `modals/useModal.ts`, `modals/registry.ts`,
  `config/configureSidebar.tsx`, `router/routes.tsx`).
- Global modals: register in `modals/registry.ts`, open via the `useModal` hook backed by
  `store/modalStore.ts`, and let `<ModalHost />` render them into a portal.

## Frontend <-> Rust boundary

- Rust entrypoint is `src-tauri/src/lib.rs`. `main.rs` only calls `dupe_studio_lib::run()` —
  edit `lib.rs`, not `main.rs`.
- New `#[tauri::command]` handlers must be registered in
  `.invoke_handler(tauri::generate_handler![...])` in `lib.rs` or `invoke` will fail at runtime.
- Frontend calls commands via `invoke` from `@tauri-apps/api/core`.
- Plugin permissions live in `src-tauri/capabilities/default.json`; a new plugin needs its
  permission added there (pattern: `opener:default`).
- `src-tauri/gen/schemas/` is generated; do not hand-edit.

## Database layer (Rust)

- `src-tauri/src/db/` implements a strategy pattern: `DatabaseStrategy` is the
  per-engine trait and `Database` is the façade the Tauri commands talk to. MySQL
  (`MySqlStrategy`, via `sqlx`) is implemented; other `DbKind` variants return
  `DbError::Unsupported`.
- Tauri commands `db_connect`, `db_disconnect`, `db_ping`, `db_execute`,
  `db_query` share a single connection held in `DbState` (`tokio::sync::RwLock`).
- New engines: add a `DbKind` variant, a `DatabaseStrategy` implementation, and a
  match arm in `Database::connect`. Keep `DbValue`/`QueryResult` as the shared
  data contract.

## Dev server / toolchain

- Vite is pinned to port `1420` with `strictPort: true`; `tauri.conf.json` `devUrl` depends on it.
- Vite ignores `**/src-tauri/**`; Rust edits trigger a Tauri rebuild, not HMR.
- `src-tauri/Cargo.toml` uses `edition = "2024"`, requiring a recent stable Rust toolchain.

## Temporary files

- Any scratch files, generated artifacts, or throwaway tests must go in `.opencode/tmp/`.
  Never write them to the repo root or tracked source directories. The directory is
  git-ignored, so nothing there is committed.

## Commit messages

Use Conventional Commits: `<type>(<scope>): <subject>`, e.g. `feat(core): add biome prettier and linter.`
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scope is optional and names the affected area (`core`, `ui`, `tauri`). Keep the subject imperative and lowercase.
