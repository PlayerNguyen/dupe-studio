//! Repository methods for the audit log.

use super::{AppDb, AppDbError, AuditLogEntry, NewAuditLogEntry};

impl AppDb {
    /// Appends an audit event and returns its id.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the insert fails.
    pub async fn record_audit(&self, entry: NewAuditLogEntry) -> Result<i64, AppDbError> {
        let result = sqlx::query(
            "INSERT INTO audit_log \
               (category, action, status, instance_id, message_key, detail, duration_ms) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(entry.category)
        .bind(entry.action)
        .bind(entry.status.as_str())
        .bind(entry.instance_id)
        .bind(entry.message_key)
        .bind(entry.detail)
        .bind(entry.duration_ms)
        .execute(self.pool())
        .await?;

        Ok(result.last_insert_rowid())
    }

    /// Lists the most recent audit events, newest first.
    ///
    /// # Arguments
    ///
    /// * `limit` - Maximum number of rows to return.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the query fails.
    pub async fn recent_audit(&self, limit: i64) -> Result<Vec<AuditLogEntry>, AppDbError> {
        let rows =
            sqlx::query_as::<_, AuditLogEntry>("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?")
                .bind(limit)
                .fetch_all(self.pool())
                .await?;

        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::super::AuditStatus;
    use super::*;

    #[tokio::test]
    async fn records_and_lists_audit_events() {
        let store = AppDb::connect_in_memory().await.unwrap();

        let id = store
            .record_audit(NewAuditLogEntry {
                category: "app".into(),
                action: "migrate".into(),
                status: AuditStatus::Success,
                instance_id: None,
                message_key: Some("audit.app.migrate".into()),
                detail: None,
                duration_ms: Some(12),
            })
            .await
            .unwrap();

        let second = store
            .record_audit(NewAuditLogEntry {
                category: "connection".into(),
                action: "connect".into(),
                status: AuditStatus::Failure,
                instance_id: None,
                message_key: Some("errors.database.connectionFailed".into()),
                detail: Some("{\"kind\":\"mysql\"}".into()),
                duration_ms: None,
            })
            .await
            .unwrap();

        assert!(second > id);

        let events = store.recent_audit(10).await.unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].action, "connect");
        assert_eq!(events[0].status, "failure");
        assert_eq!(events[1].status, "success");
    }
}
