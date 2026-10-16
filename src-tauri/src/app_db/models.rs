//! Row and input models for the application store.
//!
//! These mirror the tables in `migrations/0001_init.sql`. Timestamps are
//! ISO-8601 UTC strings produced by SQLite.

use serde::{Deserialize, Serialize};

/// A saved database connection, without its secret.
///
/// The password/DSN secret is never stored here; [`DatabaseInstance::secret_ref`]
/// points at an OS keychain entry (see the future `keyring` integration).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
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

/// Input for [`create_instance`](crate::app_db::AppDb::create_instance).
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// A configuration entry stored as a key/JSON-value pair.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
pub struct AppSetting {
    /// Setting name.
    pub key: String,
    /// JSON-encoded value.
    pub value: String,
    /// Last update timestamp (ISO-8601 UTC).
    pub updated_at: String,
}

/// A recorded audit event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLogEntry {
    /// Auto-incrementing primary key.
    pub id: i64,
    /// When the event happened (ISO-8601 UTC).
    pub occurred_at: String,
    /// Event area, for example `connection` or `app`.
    pub category: String,
    /// Short verb, for example `connect`.
    pub action: String,
    /// Outcome of the action.
    pub status: String,
    /// Related saved connection, when applicable.
    pub instance_id: Option<String>,
    /// i18n key describing the event (never user-facing prose).
    pub message_key: Option<String>,
    /// Redacted JSON payload with extra context.
    pub detail: Option<String>,
    /// Wall-clock duration of the action, in milliseconds.
    pub duration_ms: Option<i64>,
}

/// Input for [`record_audit`](crate::app_db::AppDb::record_audit).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewAuditLogEntry {
    /// Event area, for example `connection` or `app`.
    pub category: String,
    /// Short verb, for example `connect`.
    pub action: String,
    /// Outcome of the action.
    pub status: AuditStatus,
    /// Related saved connection, when applicable.
    pub instance_id: Option<String>,
    /// i18n key describing the event.
    pub message_key: Option<String>,
    /// Redacted JSON payload with extra context.
    pub detail: Option<String>,
    /// Wall-clock duration of the action, in milliseconds.
    pub duration_ms: Option<i64>,
}

/// Outcome of an audited action.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuditStatus {
    /// The action completed successfully.
    Success,
    /// The action failed.
    Failure,
}

impl AuditStatus {
    /// Returns the lowercase string persisted in `audit_log.status`.
    ///
    /// # Examples
    ///
    /// ```
    /// use dupe_studio_lib::app_db::AuditStatus;
    ///
    /// assert_eq!(AuditStatus::Success.as_str(), "success");
    /// ```
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::Failure => "failure",
        }
    }
}
