import { i18n } from ".";

/** Key rendered when a backend error key cannot be resolved. */
export const UNKNOWN_ERROR_KEY = "errors.unknown";

/**
 * Resolves a backend error key to a localized message.
 *
 * The Rust side never returns user-facing prose: commands and errors carry
 * stable i18n keys (for example `errors.database.connectionFailed`). The
 * frontend is responsible for translating them, so route every backend key
 * through this helper. When the key is missing or unknown, the
 * {@link UNKNOWN_ERROR_KEY} message is returned instead of leaking a raw key
 * to the user.
 *
 * @param key - The i18n key returned by the backend, if any.
 * @param fallbackKey - Key used when `key` is empty or not present in the
 *   loaded resources. Defaults to {@link UNKNOWN_ERROR_KEY}.
 * @returns The localized message for `key`, or the fallback message.
 *
 * @example
 * ```ts
 * // db_connect rejected with "errors.database.connectionFailed"
 * translateErrorKey(error); // "Could not connect to the database."
 * ```
 */
export function translateErrorKey(
  key: string | null | undefined,
  fallbackKey: string = UNKNOWN_ERROR_KEY,
): string {
  if (key && i18n.exists(key)) {
    return i18n.t(key);
  }

  return i18n.t(fallbackKey);
}
