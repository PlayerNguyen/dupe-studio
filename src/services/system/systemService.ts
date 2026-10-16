import { invoke } from "@tauri-apps/api/core";

import type { GreetParameters } from "../../types/system";

/**
 * Calls the Rust `greet` Tauri command.
 *
 * Frontend components must not call `invoke` directly; every Tauri command gets
 * a thin, documented wrapper in `src/services` so the IPC surface stays typed
 * and mockable in tests.
 *
 * @param parameters - Arguments forwarded to the command.
 * @param parameters.name - Name to greet.
 * @returns The greeting string produced by the backend.
 * @throws If the command is not registered or the backend returns an error.
 *
 * @example
 * ```ts
 * const message = await greet({ name: "Ada" });
 * ```
 */
export async function greet({ name }: GreetParameters): Promise<string> {
  return invoke<string>("greet", { name });
}

/**
 * Calls the Rust `app_version` Tauri command.
 *
 * The backend reports its compiled-in version: the released git tag version, or
 * `<version>-local` for local/dev builds (see the `app_version` command in
 * `src-tauri/src/lib.rs`). It mirrors the frontend `FRONTEND_VERSION` from
 * `src/config/appInfo.ts`.
 *
 * @returns The backend version string, for example `0.1.0` or `0.1.0-local`.
 * @throws If the command is not registered or the backend returns an error.
 *
 * @example
 * ```ts
 * const backendVersion = await getAppVersion();
 * ```
 */
export async function getAppVersion(): Promise<string> {
  return invoke<string>("app_version");
}
