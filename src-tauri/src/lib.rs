//! `dupe-studio` desktop backend.
//!
//! The crate exposes a small, backend-agnostic database layer (see [`db`]) and
//! wires it into Tauri commands. The database layer follows a *strategy*
//! pattern: [`db::DatabaseStrategy`] is the interface each engine implements,
//! and [`db::Database`] is the single façade the commands talk to. MySQL is the
//! first implementation; the remaining [`db::DbKind`] variants report
//! [`db::DbError::Unsupported`] until their strategies land.
//!
//! # State
//!
//! A single connection is held in [`DbState`] behind an async [`RwLock`]. The
//! `db_*` commands acquire it in read mode; `db_connect` / `db_disconnect`
//! acquire it in write mode.

pub mod app_db;
pub mod db;
pub mod pagination;

use tauri::{Manager, State};
use tokio::sync::RwLock;

use app_db::{AppDb, AppDbError, AuditLogEntry, DatabaseInstance};
use db::{ConnectionConfig, Database, DbError, DbValue, QueryResult};
use pagination::{CursorPagination, OffsetPagination, Page, PaginationError, SortSpec};

#[cfg(all(debug_assertions, not(test)))]
use specta_typescript::{BigIntExportBehavior, Typescript};
#[cfg(all(debug_assertions, not(test)))]
use tauri_specta::{Builder, collect_commands};

/// Managed Tauri state holding at most one live [`Database`] connection.
///
/// The lock is a [`tokio::sync::RwLock`] because command handlers are async and
/// hold the guard across `.await` points while a statement runs.
#[derive(Default)]
struct DbState {
    connection: RwLock<Option<Database>>,
}

/// Returns a static greeting, kept as a smoke test for the IPC bridge.
///
/// # Arguments
///
/// * `name` - Name to greet.
///
/// # Returns
///
/// A greeting `String`.
#[tauri::command]
#[specta::specta]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

/// Returns the running backend (Rust crate) version.
///
/// Released binaries are stamped at compile time with `DUPE_STUDIO_VERSION`,
/// which the release pipeline sets from the git tag, so the value matches the
/// frontend bundle version. Every other (local/dev) build falls back to the
/// crate version with a `-local` suffix so it is never mistaken for a release.
///
/// # Returns
///
/// The version string, for example `0.1.0` (release) or `0.1.0-local` (local).
#[tauri::command]
#[specta::specta]
fn app_version() -> String {
    match option_env!("DUPE_STUDIO_VERSION") {
        Some(version) if !version.is_empty() => version.to_string(),
        _ => format!("{}-local", env!("CARGO_PKG_VERSION")),
    }
}

/// Opens a connection and stores it in managed state, replacing any previous
/// connection.
///
/// # Arguments
///
/// * `config` - Backend kind plus connection fields or a full DSN.
/// * `state` - Injected managed [`DbState`].
///
/// # Returns
///
/// `Ok(())` once the connection is stored, otherwise a human readable error.
///
/// # Errors
///
/// Returns the stringified [`DbError`] when validation or connecting fails.
#[tauri::command]
async fn db_connect(config: ConnectionConfig, state: State<'_, DbState>) -> Result<(), String> {
    let database = Database::connect(config).await.map_err(stringify)?;
    let mut guard = state.connection.write().await;
    if let Some(previous) = guard.take() {
        let _ = previous.close().await;
    }
    *guard = Some(database);
    Ok(())
}

/// Closes and drops the active connection, if any.
///
/// # Arguments
///
/// * `state` - Injected managed [`DbState`].
///
/// # Returns
///
/// `Ok(())` even when nothing was connected.
///
/// # Errors
///
/// Returns the stringified [`DbError`] if closing the pool fails.
#[tauri::command]
async fn db_disconnect(state: State<'_, DbState>) -> Result<(), String> {
    let database = state.connection.write().await.take();
    if let Some(database) = database {
        database.close().await.map_err(stringify)?;
    }
    Ok(())
}

/// Verifies that the stored connection is still usable.
///
/// # Arguments
///
/// * `state` - Injected managed [`DbState`].
///
/// # Returns
///
/// `Ok(())` when the server answers, otherwise an error string.
///
/// # Errors
///
/// Returns [`DbError::NotConnected`] when no connection is stored, or
/// [`DbError::Connection`] when the ping fails.
#[tauri::command]
async fn db_ping(state: State<'_, DbState>) -> Result<(), String> {
    let guard = state.connection.read().await;
    let database = guard
        .as_ref()
        .ok_or(DbError::NotConnected)
        .map_err(stringify)?;
    database.ping().await.map_err(stringify)
}

/// Runs a DDL/DML statement against the stored connection.
///
/// # Arguments
///
/// * `sql` - Statement with `?` placeholders.
/// * `params` - Optional positional bind values.
/// * `state` - Injected managed [`DbState`].
///
/// # Returns
///
/// The number of affected rows.
///
/// # Errors
///
/// Returns [`DbError::NotConnected`] when no connection is stored, or
/// [`DbError::Query`] when the statement fails.
#[tauri::command]
async fn db_execute(
    sql: String,
    params: Option<Vec<DbValue>>,
    state: State<'_, DbState>,
) -> Result<u64, String> {
    let params = params.unwrap_or_default();
    let guard = state.connection.read().await;
    let database = guard
        .as_ref()
        .ok_or(DbError::NotConnected)
        .map_err(stringify)?;
    database.execute(&sql, &params).await.map_err(stringify)
}

/// Runs a query against the stored connection.
///
/// # Arguments
///
/// * `sql` - Query with `?` placeholders.
/// * `params` - Optional positional bind values.
/// * `state` - Injected managed [`DbState`].
///
/// # Returns
///
/// A [`QueryResult`] with column metadata and JSON rows.
///
/// # Errors
///
/// Returns [`DbError::NotConnected`] when no connection is stored,
/// [`DbError::Query`] when the statement fails, or [`DbError::Decode`] when a
/// returned cell cannot be mapped to JSON.
#[tauri::command]
async fn db_query(
    sql: String,
    params: Option<Vec<DbValue>>,
    state: State<'_, DbState>,
) -> Result<QueryResult, String> {
    let params = params.unwrap_or_default();
    let guard = state.connection.read().await;
    let database = guard
        .as_ref()
        .ok_or(DbError::NotConnected)
        .map_err(stringify)?;
    database.query(&sql, &params).await.map_err(stringify)
}

/// Returns one offset-paginated page of saved database connections.
///
/// # Arguments
///
/// * `page` - Offset/limit request from the frontend.
/// * `sort` - Requested sort; fields are validated against an allowlist.
/// * `state` - Injected managed [`AppDb`].
///
/// # Returns
///
/// A [`Page`] of [`DatabaseInstance`] rows, including `total`.
///
/// # Errors
///
/// Returns an i18n key string (`errors.storage.*`) when the request is invalid
/// or the query fails.
#[tauri::command]
#[specta::specta]
async fn storage_list_instances(
    page: OffsetPagination,
    sort: SortSpec,
    state: State<'_, AppDb>,
) -> Result<Page<DatabaseInstance>, String> {
    state
        .list_instances(&page, &sort)
        .await
        .map_err(storage_error_key)
}

/// Returns one cursor-paginated page of audit events.
///
/// # Arguments
///
/// * `page` - Cursor/direction/limit request from the frontend.
/// * `sort` - Requested sort; fields are validated against an allowlist.
/// * `state` - Injected managed [`AppDb`].
///
/// # Returns
///
/// A [`Page`] of [`AuditLogEntry`] rows with `nextCursor` / `prevCursor`.
///
/// # Errors
///
/// Returns an i18n key string (`errors.storage.*`) when the cursor or sort is
/// invalid, or the query fails.
#[tauri::command]
#[specta::specta]
async fn storage_query_audit(
    page: CursorPagination,
    sort: SortSpec,
    state: State<'_, AppDb>,
) -> Result<Page<AuditLogEntry>, String> {
    state
        .query_audit(&page, &sort)
        .await
        .map_err(storage_error_key)
}

/// Maps an [`AppDbError`] to the i18n key the frontend translates.
fn storage_error_key(error: AppDbError) -> String {
    match error {
        AppDbError::Pagination(PaginationError::InvalidCursor(_)) => {
            "errors.storage.invalidCursor".into()
        }
        AppDbError::Pagination(PaginationError::UnknownSortField(_)) => {
            "errors.storage.unknownSortField".into()
        }
        _ => "errors.storage.failed".into(),
    }
}

/// Renders a [`DbError`] for the frontend.
fn stringify(error: DbError) -> String {
    error.to_string()
}

/// Builds the specta command registry.
///
/// Only commands whose argument/return types derive `specta::Type` are
/// collected; the `db_*` commands are registered for invocation but not
/// exported yet.
#[cfg(all(debug_assertions, not(test)))]
fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        greet,
        app_version,
        storage_list_instances,
        storage_query_audit
    ])
}

/// Exports the TypeScript bindings for the annotated commands to `path`.
///
/// Compiled only for non-test debug builds. It is deliberately *not* compiled
/// into tests: linking the specta/tauri window runtime into the test binary
/// makes `cargo test` fail to load on Windows. `run()` calls this on every debug
/// launch, so `bun run tauri dev` is what regenerates `src/generated/bindings.ts`.
///
/// The file is marked `// @ts-nocheck` because tauri-specta emits a few
/// declarations (event helpers, channels) that are unused until a command needs
/// them, which trips `noUnusedLocals`. `i64`/`u64` values (row ids) are exported
/// as TypeScript `number`; the frontend never sees ids beyond `2^53`.
///
/// # Errors
///
/// Returns the underlying error message when writing the bindings file fails.
#[cfg(all(debug_assertions, not(test)))]
pub fn export_typescript_bindings(path: impl AsRef<std::path::Path>) -> Result<(), String> {
    let exporter = Typescript::default()
        .header("// @ts-nocheck")
        .bigint(BigIntExportBehavior::Number);
    specta_builder()
        .export(exporter, path)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(all(debug_assertions, not(test)))]
    export_typescript_bindings("../src/generated/bindings.ts")
        .expect("failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DbState::default())
        .setup(|app| {
            // Open the app-owned SQLite store and bring its schema up to date
            // before any command runs. Migrations are embedded and idempotent,
            // so an app update only applies the new ones.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("dupe-studio.sqlite3");

            let store: AppDb = tauri::async_runtime::block_on(async {
                let store = AppDb::open(&db_path).await?;
                store.migrate().await?;
                Ok::<AppDb, AppDbError>(store)
            })?;

            app.manage(store);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            app_version,
            db_connect,
            db_disconnect,
            db_ping,
            db_execute,
            db_query,
            storage_list_instances,
            storage_query_audit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
