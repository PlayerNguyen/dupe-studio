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
  UpdateDatabaseInstance,
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
 * instance id, `secret_ref` and timestamps, trims the name/kind, and rejects
 * blank names or an out-of-range port with an i18n key. When `remember` is
 * `true` and `password` is set, the backend stores the password in the OS
 * credential store before inserting the row; `secret_ref` in `input` is
 * ignored.
 *
 * @param input - Instance metadata collected by the add-instance form.
 * @param password - Plaintext password, or `null` to leave it unset.
 * @param remember - Whether the backend should store the password.
 * @returns The stored connection, including its generated `id`, `secret_ref`
 *   and timestamps.
 * @throws {Error} With a localized message when the input is invalid, the
 *   credential store fails, or the insert fails.
 *
 * @example
 * ```ts
 * const created = await createInstance(input, "hunter2", true);
 * ```
 */
export async function createInstance(
  input: NewDatabaseInstance,
  password: string | null,
  remember: boolean,
): Promise<DatabaseInstance> {
  const result = await commands.storageCreateInstance(
    input,
    password,
    remember,
  );

  if (result.status === "error") {
    throw new Error(translateErrorKey(result.error));
  }

  return result.data;
}

/**
 * Updates a saved database connection and its stored password.
 *
 * Wraps the Rust `storage_update_instance` command. Passing `password` writes a
 * new credential; passing `remember: false` deletes the stored one and makes
 * the connection session-only.
 *
 * @param id - Instance id to update.
 * @param input - New metadata.
 * @param password - Replacement password, or `null` to keep the stored one.
 * @param remember - Whether the password should remain stored.
 * @returns The updated connection.
 * @throws {Error} With a localized message when the instance is missing, the
 *   credential store fails, or the update fails.
 */
export async function updateInstance(
  id: string,
  input: UpdateDatabaseInstance,
  password: string | null,
  remember: boolean,
): Promise<DatabaseInstance> {
  const result = await commands.storageUpdateInstance(
    id,
    input,
    password,
    remember,
  );

  if (result.status === "error") {
    throw new Error(translateErrorKey(result.error));
  }

  return result.data;
}

/**
 * Deletes a saved database connection and its stored password.
 *
 * Wraps the Rust `storage_delete_instance` command. The keychain removal is
 * best-effort; the row is the source of truth.
 *
 * @param id - Instance id to delete.
 * @returns `true` when a row was removed, `false` when it did not exist.
 * @throws {Error} With a localized message when the delete fails.
 */
export async function deleteInstance(id: string): Promise<boolean> {
  const result = await commands.storageDeleteInstance(id);

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
