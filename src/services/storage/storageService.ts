import { commands } from "../../generated/bindings";
import { translateErrorKey } from "../../i18n/errors";
import type {
  AuditLogEntry,
  CursorPagination,
  DatabaseInstance,
  NewDatabaseInstance,
  OffsetPagination,
  Page,
  SortSpec,
} from "../../types/storage";

/**
 * Reads one offset-paginated page of saved database connections.
 *
 * Wraps the Rust `storage_list_instances` command. Components never call
 * `invoke` (or the generated `commands`) directly; this wrapper unwraps the
 * command's `Result` and turns a backend error key into a localized message.
 *
 * @param page - Offset/limit request. Omit for the first page with defaults.
 * @param sort - Ordered sort fields; empty means the endpoint default order.
 * @returns The requested page of connections, including `pageInfo.total`.
 * @throws {Error} With a localized message when the request is invalid or the
 *   query fails.
 *
 * @example
 * ```ts
 * const page = await listInstances({ offset: 0, limit: 25 });
 * ```
 */
export async function listInstances(
  page: OffsetPagination = {},
  sort: SortSpec = { fields: [] },
): Promise<Page<DatabaseInstance>> {
  const result = await commands.storageListInstances(page, sort);

  if (result.status === "error") {
    throw new Error(translateErrorKey(result.error));
  }

  return result.data;
}

/**
 * Persists a new saved database connection.
 *
 * Wraps the Rust `storage_create_instance` command. The backend generates the
 * instance id and timestamps, trims the name/kind, and rejects blank names or
 * an out-of-range port with an i18n key. Passwords are not part of the payload:
 * `secret_ref` stays `null` until the OS keychain integration lands.
 *
 * @param input - Instance metadata collected by the add-instance form.
 * @returns The stored connection, including its generated `id` and timestamps.
 * @throws {Error} With a localized message when the input is invalid or the
 *   insert fails.
 *
 * @example
 * ```ts
 * const created = await createInstance({
 *   name: "Local MySQL",
 *   kind: "mysql",
 *   host: "127.0.0.1",
 *   port: 3306,
 *   database_name: "app",
 *   username: "root",
 *   secret_ref: null,
 *   is_favorite: false,
 * });
 * ```
 */
export async function createInstance(
  input: NewDatabaseInstance,
): Promise<DatabaseInstance> {
  const result = await commands.storageCreateInstance(input);

  if (result.status === "error") {
    throw new Error(translateErrorKey(result.error));
  }

  return result.data;
}

/**
 * Reads one cursor-paginated page of audit events.
 *
 * Wraps the Rust `storage_query_audit` command. Pass the `nextCursor` /
 * `prevCursor` from a previous page back as `page.cursor` with the matching
 * `page.direction` to walk the result set.
 *
 * @param page - Cursor, direction and limit. Omit for the first page.
 * @param sort - Ordered sort fields; empty means newest-first.
 * @returns The requested page of audit events with cursors for neighbours.
 * @throws {Error} With a localized message when the cursor or sort is invalid,
 *   or the query fails.
 *
 * @example
 * ```ts
 * const first = await queryAudit();
 * const next = await queryAudit({ cursor: first.pageInfo.nextCursor });
 * ```
 */
export async function queryAudit(
  page: CursorPagination = {},
  sort: SortSpec = { fields: [] },
): Promise<Page<AuditLogEntry>> {
  const result = await commands.storageQueryAudit(page, sort);

  if (result.status === "error") {
    throw new Error(translateErrorKey(result.error));
  }

  return result.data;
}
