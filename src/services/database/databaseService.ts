import { invoke } from "@tauri-apps/api/core";

import { translateErrorKey } from "../../i18n/errors";
import type { ConnectionConfig } from "../../types/database";

/**
 * Opens a throwaway connection and verifies it answers a ping.
 *
 * Wraps the Rust `db_test_connection` command. The backend creates its own
 * connection, pings it and closes it, so this never replaces the active
 * connection held in `DbState` — it is the safe pre-save check behind the
 * add-instance form's "Test connection" action.
 *
 * The command is one of the `db_*` commands that are registered for invocation
 * but intentionally not exported to `src/generated/bindings.ts`, so this
 * service is the single place that knows the command name and argument shape.
 *
 * @param config - Backend kind plus connection fields or a full DSN.
 * @returns Resolves once the server answered the ping.
 * @throws {Error} With a localized message when the configuration is invalid or
 *   the connection cannot be reached.
 *
 * @example
 * ```ts
 * await testConnection({
 *   kind: "mysql",
 *   host: "127.0.0.1",
 *   port: 3306,
 *   username: "root",
 * });
 * ```
 */
export async function testConnection(config: ConnectionConfig): Promise<void> {
  try {
    await invoke("db_test_connection", { config });
  } catch (error) {
    throw new Error(
      translateErrorKey(typeof error === "string" ? error : null),
    );
  }
}
