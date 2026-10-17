//! Row and input models for saved database connections.
//!
//! These mirror the `database_instances` table in `migrations/0001_init.sql`.
//! Timestamps are ISO-8601 UTC strings produced by SQLite.

use serde::{Deserialize, Serialize};

/// A saved database connection, without its secret.
///
/// The password/DSN secret is never stored here; [`DatabaseInstance::secret_ref`]
/// points at an OS keychain entry (see the future `keyring` integration).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow, specta::Type)]
pub struct DatabaseInstance {
    /// Primary key (UUID v4).
    pub id: String,
    /// Display name chosen by the user.
    pub name: String,
    /// Backend kind, for example `mysql`.
    pub kind: String,
    /// Host name or address.
    pub host: Option<String>,
    /// TCP port.
    pub port: Option<i64>,
    /// Default database/schema name.
    pub database_name: Option<String>,
    /// Login user.
    pub username: Option<String>,
    /// Keychain reference for the secret (never the secret itself).
    pub secret_ref: Option<String>,
    /// Whether the user pinned the connection.
    pub is_favorite: bool,
    /// Creation timestamp (ISO-8601 UTC).
    pub created_at: String,
    /// Last update timestamp (ISO-8601 UTC).
    pub updated_at: String,
}

/// Input for [`DatabaseInstanceService::create`](crate::app_db::DatabaseInstanceService::create).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct NewDatabaseInstance {
    /// Display name chosen by the user.
    pub name: String,
    /// Backend kind, for example `mysql`.
    pub kind: String,
    /// Host name or address.
    pub host: Option<String>,
    /// TCP port.
    pub port: Option<i64>,
    /// Default database/schema name.
    pub database_name: Option<String>,
    /// Login user.
    pub username: Option<String>,
    /// Keychain reference for the secret.
    pub secret_ref: Option<String>,
    /// Whether the user pinned the connection. Defaults to `false`.
    #[serde(default)]
    pub is_favorite: bool,
}
