import { commands } from "../../generated/bindings";
import { translateErrorKey } from "../../i18n/errors";
import type {
  AuditLogEntry,
  CursorPagination,
  DatabaseInstance,
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
