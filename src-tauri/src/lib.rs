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

pub mod db;

use tauri::State;
use tokio::sync::RwLock;

use db::{ConnectionConfig, Database, DbError, DbValue, QueryResult};

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
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
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

/// Renders a [`DbError`] for the frontend.
fn stringify(error: DbError) -> String {
    error.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DbState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            db_connect,
            db_disconnect,
            db_ping,
            db_execute,
            db_query
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
