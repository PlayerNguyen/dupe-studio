//! Error type shared by every database backend.
//!
//! The database layer is deliberately backend agnostic, so [`DbError`] owns the
//! single vocabulary of failure modes that the rest of the application (and the
//! Tauri commands in `lib.rs`) can rely on regardless of which concrete
//! [`DatabaseStrategy`](crate::db::DatabaseStrategy) is active.

use thiserror::Error;

/// Everything that can go wrong while configuring, connecting to, or talking to
/// a database.
///
/// The variants are intentionally high level: callers should not need to know
/// whether the failure came from `sqlx`, a hand-rolled driver, or a validation
/// rule. The original driver error is preserved in [`DbError::Driver`] and
/// surfaced through [`DbError::source`](std::error::Error::source) when the
/// `sqlx` feature is enabled.
///
/// # Examples
///
/// ```
/// use dupe_studio_lib::db::DbError;
///
/// let err = DbError::NotConnected;
/// assert_eq!(err.to_string(), "no active database connection");
/// ```
#[derive(Debug, Error)]
pub enum DbError {
    /// The requested [`DbKind`](crate::db::DbKind) has no strategy yet.
    ///
    /// The strategy registry is additive, so this is the expected error for
    /// backends that are planned but not implemented.
    #[error("database backend `{0}` is not supported yet")]
    Unsupported(String),

    /// The [`ConnectionConfig`](crate::db::ConnectionConfig) is malformed, e.g.
    /// a required field is empty.
    #[error("invalid connection configuration: {0}")]
    Config(String),

    /// The connection could not be established or was lost.
    #[error("failed to reach the database: {0}")]
    Connection(String),

    /// The statement was rejected by the server or failed to run.
    #[error("query failed: {0}")]
    Query(String),

    /// A command was invoked before [`Database`](crate::db::Database) was
    /// connected, or after it was disconnected.
    #[error("no active database connection")]
    NotConnected,

    /// A value returned by the driver could not be converted into JSON.
    #[error("column `{column}` at index {index} could not be decoded: {message}")]
    Decode {
        /// Name of the offending column, as reported by the server.
        column: String,
        /// Zero based position of the column in the result set.
        index: usize,
        /// Human readable reason from the driver.
        message: String,
    },

    /// An error bubbled up from `sqlx` itself.
    #[error(transparent)]
    Driver(#[from] sqlx::Error),
}

impl DbError {
    /// Convenience constructor for [`DbError::Decode`].
    ///
    /// # Examples
    ///
    /// ```
    /// use dupe_studio_lib::db::DbError;
    ///
    /// let err = DbError::decode("age", 2, "out of range");
    /// assert!(err.to_string().contains("age"));
    /// ```
    pub fn decode(column: impl Into<String>, index: usize, message: impl Into<String>) -> Self {
        Self::Decode {
            column: column.into(),
            index,
            message: message.into(),
        }
    }
}
