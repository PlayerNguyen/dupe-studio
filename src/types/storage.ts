/**
 * Storage domain types.
 *
 * These are re-exported from the tauri-specta bindings in
 * `src/generated/bindings.ts`, which is generated from the Rust commands (run
 * the app in dev, or see AGENTS.md "Generated TypeScript bindings"). Do not edit
 * the generated file. Re-exporting here gives the rest of the app a stable
 * import path that does not depend on the generated file's layout.
 */
export type {
  AuditLogEntry,
  CursorPagination,
  DatabaseInstance,
  OffsetPagination,
  Page,
  PageDirection,
  PageInfo,
  SortDirection,
  SortField,
  SortSpec,
} from "../generated/bindings";
