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

## Definition of done

- Public frontend and backend APIs are documented as above.
- `bun run check:write` and `bun run build` pass, and Rust changes pass
  `cargo check` (see `AGENTS.md` for the full command reference).
