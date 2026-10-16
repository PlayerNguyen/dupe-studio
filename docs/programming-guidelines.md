# Programming Guidelines

Mandatory rules for all code in this repository. This file is wired into
`opencode.json` `instructions`, so OpenCode loads it at the start of **every**
session — follow it for every change, not just when asked.

## Documentation — required, library standard

Both the frontend and the backend must be documented to the same standard as a
published library. Treat each module's public surface as a public API: if a
consumer outside the module can see it, it must be documented.

### Frontend (TypeScript / React)

- Document every exported symbol with TSDoc blocks (`/** ... */`): modules,
  functions, hooks, components, contexts, types, and constants.
- This includes the thin wrappers around `invoke(...)` from
  `@tauri-apps/api/core` — document the command name, arguments, and the
  resolved/returned shape.
- Component docs state purpose, props, and side effects; hook docs state the
  returned tuple/object and any usage rules.
- Keep docs next to the code. Do not maintain separate prose docs that can
  drift from the implementation.
- Use `@param`, `@returns`, `@throws`, `@example` when they add information.

### Backend (Rust)

- Document every public item with rustdoc: `//!` for crate/module level and
  `///` for structs, enums, traits, functions, and each `#[tauri::command]`.
- For fallible items, add an `# Errors` section that says when `Err` is
  returned.
- Provide runnable `# Examples` for non-obvious public APIs.
- A `#[tauri::command]` doc comment must describe the arguments the frontend
  sends and the value returned over `invoke`.

### General

- Write for a reader who has never opened the file; explain the "why", not the
  "what".
- Update documentation in the same change as the code. A change that alters
  public behavior without updating docs is not done.
- Never leave placeholder or stale descriptions.

## Frontend structure

The `src/` directory mirrors Netcompany's reference business UI
(`src/reference/applications/business-ui` in AMPLIO) so navigation and ownership
stay predictable. One deliberate difference: **no Redux**. Server/async state is
owned by TanStack Query, and small synchronous client state lives in a Zustand
store.

```
src/
  app/          # Root <App> composition: providers (Mantine, Query, Router)
  assets/       # Static files imported by the bundle
  config/       # App-wide configuration (query client, env, feature flags)
  error/        # Error boundaries and error-handling helpers
  i18n/         # react-i18next setup and JSON5 locale bundles
  layouts/      # Persistent shells (sidebar + content); one folder per layout
  modals/       # Global modal registry, host, hook and modal bodies
  pages/        # One folder per page; feature code lives with its page
  rest/         # REST/HTTP clients, one folder per API domain (reserved)
  router/       # Route table and router provider
  services/     # Thin, documented wrappers around Tauri `invoke` commands
  store/        # Zustand stores for cross-cutting synchronous client state
  test/         # Vitest setup and shared test utilities
  theme/        # Mantine theme and design tokens
  types/        # Shared TypeScript types (mirrors of backend contracts)
  utils/        # Pure, framework-free helpers
  globals.css   # Tailwind entry + Mantine styles + brand tokens
  main.tsx      # Application bootstrap
```

Rules:

- **One folder per component.** A React component lives in
  `<ComponentName>/<ComponentName>.tsx` beside an `index.ts` barrel that
  re-exports only what is public (`export { X } from "./X"`). Import components
  through the folder (`./ComponentName`), never the implementation file. This
  applies everywhere, including pages, layouts, modals and error boundaries.
- Non-component modules stay as plain files: Zustand stores, hooks, registries,
  route tables, configs and helpers (`store/modalStore.ts`, `modals/useModal.ts`,
  `modals/registry.ts`, `config/configureSidebar.tsx`).
- `pages/<PageName>/` holds `<PageName>.tsx`, `index.ts`, plus optional
  `components/`, `api.ts` (data access), `types.ts`, and a co-located
  `*.test.tsx`.
- `layouts/<LayoutName>/` holds the persistent shell; `AppLayout` places the
  primary sidebar beside the routed content. Sidebar destinations are declared
  once in `config/configureSidebar.tsx` — add, remove or regroup entries there
  instead of editing the sidebar component.
- Global modals are registered in `modals/registry.ts` and opened through the
  `useModal` hook backed by the Zustand `store/modalStore.ts`; `<ModalHost />`
  renders the open ones into a portal. Do not render one-off `Modal`s inline in
  feature components.
- Components never call `invoke` directly; add a documented wrapper under
  `services/<domain>/`. HTTP endpoints, when they exist, belong under `rest/`.
- User-facing text is never hard-coded: add a key to every
  `src/i18n/locales/<language>.json5` and resolve it with `useTranslation`.
  Backend responses (Tauri commands and errors) return i18n keys only; translate
  them on the frontend via `translateErrorKey`.
- Do not add Redux. Use TanStack Query for async/server state and Zustand for
  small synchronous state.
- Import across features through the folder's public entry (`index.ts(x)`),
  not through deep internal paths.
- Tailwind utilities and Mantine components may be mixed; brand colors come from
  the `brand` scale shared by `src/globals.css` and `src/theme/theme.ts`.

## Definition of done

- Public frontend and backend APIs are documented as above.
- `bun run check:write`, `bun run test`, and `bun run build` pass; Rust changes
  also pass `cargo check` (see `AGENTS.md` for the full command reference).
