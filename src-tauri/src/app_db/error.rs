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

    /// A write input was rejected before it reached SQLite.
    ///
    /// The payload is a field name, not user-facing prose; the frontend
    /// translates [`AppDbError::i18n_key`] instead.
    #[error("invalid input for `{0}`")]
    InvalidInput(&'static str),
}

impl AppDbError {
    /// Returns the stable i18n key the frontend translates for this error.
    ///
    /// Backend responses never carry user-facing prose: the frontend resolves
    /// the key with `translateErrorKey`, falling back to `errors.unknown` for
    /// a key it does not know. Keep the keys in `errors.storage.*`.
    ///
    /// # Examples
    ///
    /// ```
    /// use dupe_studio_lib::app_db::AppDbError;
    /// use dupe_studio_lib::pagination::PaginationError;
    ///
    /// let stale = AppDbError::Pagination(PaginationError::InvalidCursor("stale".into()));
    /// assert_eq!(stale.i18n_key(), "errors.storage.invalidCursor");
    ///
    /// let missing = AppDbError::NotFound("instance-1".into());
    /// assert_eq!(missing.i18n_key(), "errors.storage.failed");
    /// ```
    pub fn i18n_key(&self) -> &'static str {
        match self {
            Self::Pagination(PaginationError::InvalidCursor(_)) => "errors.storage.invalidCursor",
            Self::Pagination(PaginationError::UnknownSortField(_)) => {
                "errors.storage.unknownSortField"
            }
            Self::InvalidInput(_) => "errors.storage.invalidInput",
            Self::Io(_) | Self::Migration(_) | Self::Sqlx(_) | Self::NotFound(_) => {
                "errors.storage.failed"
            }
        }
    }
}
