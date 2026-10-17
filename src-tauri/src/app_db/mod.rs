//! Application-owned SQLite store.
//!
//! dupe-studio persists its own metadata — saved database instances and an
//! audit log — in a local SQLite file. This is separate from [`crate::db`],
//! which talks to the DBMS the user connects to. (Preferences are stored as
//! JSON files, not here.)
//!
//! [`AppDb`] owns the connection pool and is the single entry point: open it
//! once at startup (see `src/lib.rs`) and call [`AppDb::migrate`] to bring the
//! schema up to date. Every table is then read and written through the domain
//! service that owns it, which is where that domain's models, sort allowlist
//! and SQL live:
//!
//! * [`AppDb::audit`] → [`AuditService`] for `audit_log`.
//! * [`AppDb::database_instances`] → [`DatabaseInstanceService`] for
//!   `database_instances`.
//!
//! Services only hold a handle to the shared pool, so they are cheap to build
//! per call — ask [`AppDb`] for one instead of caching it.
//!
//! # Migrations
//!
//! SQL files live in `src-tauri/migrations/` and are embedded into the binary
//! at compile time via [`sqlx::migrate!`]. Running them on every launch is
//! idempotent: already-applied migrations are skipped, so an app update only
//! applies the new ones.
//!
//! # Examples
//!
//! ```no_run
//! use dupe_studio_lib::app_db::AppDb;
//! use dupe_studio_lib::pagination::{
//!     CursorPagination, OffsetPagination, PageDirection, SortSpec,
//! };
//!
//! # async fn run() -> Result<(), dupe_studio_lib::app_db::AppDbError> {
//! let store = AppDb::open("dupe-studio.sqlite3").await?;
//! store.migrate().await?;
//!
//! let instances = store
//!     .database_instances()
//!     .list(&OffsetPagination::default(), &SortSpec::default())
//!     .await?;
//!
//! let events = store
//!     .audit()
//!     .query(
//!         &CursorPagination {
//!             cursor: None,
//!             direction: PageDirection::Next,
//!             limit: 20,
//!         },
//!         &SortSpec::default(),
//!     )
//!     .await?;
//! # let _ = (instances, events);
//! # Ok(())
//! # }
//! ```

mod audit;
mod database_instances;
mod error;

use std::path::Path;
use std::time::Duration;

use sqlx::SqlitePool;
use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};

pub use audit::{AuditLogEntry, AuditService, AuditStatus, NewAuditLogEntry};
pub use database_instances::{DatabaseInstance, DatabaseInstanceService, NewDatabaseInstance};
pub use error::AppDbError;

/// Migrations embedded into the binary at compile time (`migrations/`).
static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Handle to the application's SQLite database.
///
/// Cheap to clone: it wraps a [`SqlitePool`]. Store one instance in Tauri's
/// managed state and share it across commands; ask it for the domain service
/// the command needs ([`AppDb::audit`], [`AppDb::database_instances`]).
#[derive(Debug, Clone)]
pub struct AppDb {
    pool: SqlitePool,
}

impl AppDb {
    /// Opens the SQLite database at `path`, creating the file if needed.
    ///
    /// Enables WAL journaling, foreign keys and a busy timeout so a write in
    /// flight does not make concurrent readers fail.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the file cannot be opened or the
    /// connection options are rejected.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// # use dupe_studio_lib::app_db::AppDb;
    /// # async fn run() -> Result<(), dupe_studio_lib::app_db::AppDbError> {
    /// let store = AppDb::open("dupe-studio.sqlite3").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn open(path: impl AsRef<Path>) -> Result<Self, AppDbError> {
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .foreign_keys(true)
            .busy_timeout(Duration::from_secs(5));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;

        Ok(Self { pool })
    }

    /// Applies every pending migration.
    ///
    /// Safe to call on every launch: migrations already recorded in
    /// `_sqlx_migrations` are skipped, so upgrading the app runs only the new
    /// ones.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Migration`] when a migration fails to apply or a
    /// previously applied migration's checksum no longer matches.
    pub async fn migrate(&self) -> Result<(), AppDbError> {
        MIGRATOR.run(&self.pool).await?;
        Ok(())
    }

    /// Returns the underlying connection pool.
    ///
    /// Intended for advanced callers; prefer the domain services.
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Returns the audit-log service bound to this database handle.
    ///
    /// # Examples
    ///
    /// ```
    /// # use dupe_studio_lib::app_db::AppDb;
    /// # async fn run() -> Result<(), dupe_studio_lib::app_db::AppDbError> {
    /// # let store = AppDb::open("dupe-studio.sqlite3").await?;
    /// let audit = store.audit();
    /// # let _ = audit;
    /// # Ok(())
    /// # }
    /// ```
    pub fn audit(&self) -> AuditService {
        AuditService::new(self.clone())
    }

    /// Returns the saved-connection service bound to this database handle.
    pub fn database_instances(&self) -> DatabaseInstanceService {
        DatabaseInstanceService::new(self.clone())
    }

    /// Opens an isolated, migrated in-memory database for tests.
    ///
    /// A single connection is kept alive so the in-memory schema survives
    /// across queries.
    #[cfg(test)]
    pub(crate) async fn connect_in_memory() -> Result<Self, AppDbError> {
        let options = SqliteConnectOptions::new()
            .in_memory(true)
            .foreign_keys(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .idle_timeout(None)
            .max_lifetime(None)
            .connect_with(options)
            .await?;

        let db = Self { pool };
        db.migrate().await?;
        Ok(db)
    }
}
