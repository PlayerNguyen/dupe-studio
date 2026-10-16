//! Error type for the application-owned SQLite store.
//!
//! Kept separate from [`crate::db::DbError`]: that one describes failures while
//! talking to the user's DBMS, while [`AppDbError`] covers dupe-studio's own
//! local metadata database.

use thiserror::Error;

use crate::pagination::PaginationError;

/// Everything that can go wrong while opening, migrating or querying the
/// application's SQLite database.
#[derive(Debug, Error)]
pub enum AppDbError {
    /// A filesystem operation failed, for example creating the data directory.
    #[error("storage filesystem error: {0}")]
    Io(#[from] std::io::Error),

    /// Applying or validating migrations failed.
    #[error("storage migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    /// A connection or query from `sqlx` failed.
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),

    /// A pagination input was invalid (bad cursor, unknown sort field).
    #[error(transparent)]
    Pagination(#[from] PaginationError),

    /// A requested record does not exist.
    #[error("`{0}` was not found in the application store")]
    NotFound(String),
}
