//! Row and input models for the audit log.
//!
//! These mirror the `audit_log` table in `migrations/0001_init.sql`.
//! Timestamps are ISO-8601 UTC strings produced by SQLite.

use serde::{Deserialize, Serialize};

/// A recorded audit event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow, specta::Type)]
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

/// Input for [`AuditService::record`](crate::app_db::AuditService::record).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
#[specta(rename_all = "lowercase")]
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
