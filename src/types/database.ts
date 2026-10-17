/**
 * Database-engine types shared by the frontend.
 *
 * The values mirror the lowercase serde representation of the Rust
 * `DbKind` enum (`src-tauri/src/db/config.rs`). Only engines with a backend
 * strategy are offered by the add-instance registry, but the union already
 * carries the planned engines so persisted rows stay forward compatible.
 */

/** Relational engine a saved database instance targets. */
export type DatabaseKind = "mysql" | "postgres" | "sqlite" | "mssql";

/**
 * Transport-neutral description of where to connect.
 *
 * Mirrors the Rust `ConnectionConfig` (`src-tauri/src/db/config.rs`). The
 * `db_*` commands accept this shape over `invoke`; either fill the discrete
 * fields or set `url` to a complete DSN, which wins over the discrete fields.
 */
export interface ConnectionConfig {
  /** Backend this configuration targets. */
  kind: DatabaseKind;
  /** Host name or IP address. Ignored when `url` is set. */
  host: string;
  /** TCP port; falls back to the backend default when omitted. */
  port?: number | null;
  /** Login user. Ignored when `url` is set. */
  username: string;
  /**
   * Login password. Empty until the OS keychain integration lands; the
   * add-instance form only uses it for a one-off test, never persists it.
   */
  password?: string;
  /** Optional default schema/database name. */
  database?: string | null;
  /** Extra DSN query parameters, for example `ssl-mode`. */
  params?: Record<string, string>;
  /** Complete connection string that overrides the discrete fields. */
  url?: string | null;
}
