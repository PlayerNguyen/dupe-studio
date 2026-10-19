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
//!
//! Storage commands live in [`commands`], one module per domain, and delegate
//! to the services in [`app_db`].

pub mod app_db;
pub mod commands;
pub mod db;
pub mod keyring;
pub mod pagination;

use std::sync::Arc;

use tauri::{Manager, State};
use tokio::sync::RwLock;

use app_db::{AppDb, AppDbError, DatabaseInstance};
use db::{ConnectionConfig, Database, DbError, DbKind, DbValue, QueryResult, Secret};
use keyring::{KeyringSecretStore, SecretStoreState};

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

/// Opens a throwaway connection, pings it and closes it.
///
/// Used by the add-instance form's "Test connection" action. Unlike
/// [`db_connect`], this never touches the active [`DbState`] connection, so a
/// failed test cannot drop the connection the user is already working with.
///
/// # Arguments
///
/// * `config` - Backend kind plus connection fields or a full DSN.
///
/// # Returns
///
/// `Ok(())` when the server answers the ping.
///
/// # Errors
///
/// Returns an i18n key (`errors.database.*`) when validation, connecting or the
/// ping fails; the frontend translates it with `translateErrorKey`.
#[tauri::command]
async fn db_test_connection(config: ConnectionConfig) -> Result<(), String> {
    let database = Database::connect(config)
        .await
        .map_err(|error| error.i18n_key().to_string())?;

    let ping = database.ping().await;
    let close = database.close().await;

    ping.map_err(|error| error.i18n_key().to_string())?;
    close.map_err(|error| error.i18n_key().to_string())
}

/// Builds a [`ConnectionConfig`] from a saved instance and its password.
///
/// # Errors
///
/// Returns [`DbError::Config`] when the stored kind is unknown or an explicit
/// port falls outside the `u16` range.
fn connection_config_from_instance(
    instance: &DatabaseInstance,
    password: Secret,
) -> Result<ConnectionConfig, DbError> {
    let kind: DbKind = instance.kind.parse()?;
    let mut config = ConnectionConfig::new(kind)
        .with_host(instance.host.clone().unwrap_or_default())
        .with_username(instance.username.clone().unwrap_or_default())
        .with_password(password);

    if let Some(port) = instance.port {
        let port = u16::try_from(port).map_err(|_| DbError::Config("port out of range".into()))?;
        config = config.with_port(port);
    }

    if let Some(database) = &instance.database_name {
        config = config.with_database(database.clone());
    }

    Ok(config)
}

/// Connects using a saved instance, resolving its password from the keychain.
///
/// Unlike [`db_connect`], the frontend does not send the stored password: it
/// sends the instance id, and this command reads the secret from the OS
/// credential store. A `password` argument is only used for session-only
/// instances whose `secret_ref` is `NULL`.
///
/// # Arguments
///
/// * `instance_id` - Saved instance to connect.
/// * `password` - Session-only password, when the instance does not remember
///   one.
/// * `state` - Injected managed [`DbState`].
/// * `app_db` - Injected managed [`AppDb`].
/// * `secrets` - Injected managed [`SecretStoreState`].
///
/// # Returns
///
/// `Ok(())` once the connection is stored in [`DbState`].
///
/// # Errors
///
/// Returns an i18n key when the instance is missing, the stored password is
/// missing (`errors.storage.secretMissing`), the credential store fails, or the
/// connection cannot be opened.
#[tauri::command]
async fn db_connect_instance(
    instance_id: String,
    password: Option<String>,
    state: State<'_, DbState>,
    app_db: State<'_, AppDb>,
    secrets: State<'_, SecretStoreState>,
) -> Result<(), String> {
    let instance = app_db
        .database_instances()
        .get(&instance_id)
        .await
        .map_err(|error| error.i18n_key().to_string())?
        .ok_or_else(|| "errors.storage.failed".to_string())?;

    let password = match &instance.secret_ref {
        Some(account) => secrets
            .store()
            .get(account)
            .map_err(|error| error.i18n_key().to_string())?
            .ok_or_else(|| "errors.storage.secretMissing".to_string())?,
        None => password.ok_or_else(|| "errors.storage.secretMissing".to_string())?,
    };

    let config = connection_config_from_instance(&instance, Secret::new(password))
        .map_err(|error| error.i18n_key().to_string())?;
    let database = Database::connect(config)
        .await
        .map_err(|error| error.i18n_key().to_string())?;

    let mut guard = state.connection.write().await;
    if let Some(previous) = guard.take() {
        let _ = previous.close().await;
    }
    *guard = Some(database);
    Ok(())
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
        commands::audit::storage_query_audit,
        commands::database_instances::storage_list_instances,
        commands::database_instances::storage_create_instance,
        commands::database_instances::storage_update_instance,
        commands::database_instances::storage_delete_instance
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
        .manage(SecretStoreState::new(Arc::new(KeyringSecretStore::new())))
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
            db_connect_instance,
            db_disconnect,
            db_ping,
            db_test_connection,
            db_execute,
            db_query,
            commands::audit::storage_query_audit,
            commands::database_instances::storage_list_instances,
            commands::database_instances::storage_create_instance,
            commands::database_instances::storage_update_instance,
            commands::database_instances::storage_delete_instance
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A saved-instance fixture for the resolution helper.
    fn instance(secret_ref: Option<&str>) -> DatabaseInstance {
        DatabaseInstance {
            id: "instance-1".into(),
            name: "local".into(),
            kind: "mysql".into(),
            host: Some("127.0.0.1".into()),
            port: Some(3306),
            database_name: Some("app".into()),
            username: Some("root".into()),
            secret_ref: secret_ref.map(str::to_string),
            is_favorite: false,
            created_at: "2026-01-01T00:00:00.000Z".into(),
            updated_at: "2026-01-01T00:00:00.000Z".into(),
        }
    }

    #[test]
    fn builds_a_connection_config_from_an_instance() {
        let config = connection_config_from_instance(&instance(None), Secret::new("pw")).unwrap();

        assert_eq!(config.resolved_port(), 3306);
        assert_eq!(config.url(), "mysql://root:pw@127.0.0.1:3306/app");
    }

    #[test]
    fn rejects_an_unknown_engine() {
        let mut row = instance(None);
        row.kind = "oracle".into();

        let error = connection_config_from_instance(&row, Secret::new("pw")).unwrap_err();

        assert!(matches!(error, DbError::Config(_)));
    }

    #[test]
    fn rejects_an_out_of_range_port() {
        let mut row = instance(None);
        row.port = Some(70_000);

        let error = connection_config_from_instance(&row, Secret::new("pw")).unwrap_err();

        assert!(matches!(error, DbError::Config(_)));
    }

    #[test]
    fn resolved_config_never_debugs_the_password() {
        let config = connection_config_from_instance(&instance(None), Secret::new("pw")).unwrap();

        assert!(!format!("{config:?}").contains("pw"));
    }
}
