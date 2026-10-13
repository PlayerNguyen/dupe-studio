/**
 * Arguments accepted by the Rust `greet` Tauri command.
 *
 * Mirrors the command signature in `src-tauri/src/lib.rs`; keep both in sync.
 */
export interface GreetParameters {
  /** Name to greet. */
  name: string;
}
