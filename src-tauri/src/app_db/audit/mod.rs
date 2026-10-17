//! Audit-log domain: models, sort allowlist and the [`AuditService`].
//!
//! Everything that reads or writes `audit_log` lives in this folder: the row
//! models ([`models`]), the columns the frontend may sort by ([`sort`]) and the
//! cursor arithmetic ([`query`]). Callers get a service from
//! [`AppDb::audit`](super::AppDb::audit) instead of reaching for the pool.

mod models;
mod query;
mod sort;

use super::{AppDb, AppDbError};
use crate::pagination::{CursorPageQuery, Page, PageDirection, SortSpec};

pub use models::{AuditLogEntry, AuditStatus, NewAuditLogEntry};

/// Read/write service for the audit log.
///
/// Cheap to clone: it only holds a handle to the shared connection pool, so
/// request one per call through [`AppDb::audit`](super::AppDb::audit).
#[derive(Debug, Clone)]
pub struct AuditService {
    db: AppDb,
}

impl AuditService {
    /// Binds the service to the shared [`AppDb`] handle.
    pub(super) fn new(db: AppDb) -> Self {
        Self { db }
    }

    /// Appends an audit event and returns its id.
    ///
    /// `entry` fields are stored as-is; the timestamp is filled in by SQLite.
    /// Audit events are append-only — there is no update or delete counterpart.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the insert fails.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use dupe_studio_lib::app_db::{AppDb, AuditStatus, NewAuditLogEntry};
    ///
    /// # async fn run() -> Result<(), dupe_studio_lib::app_db::AppDbError> {
    /// # let store = AppDb::open("dupe-studio.sqlite3").await?;
    /// let id = store
    ///     .audit()
    ///     .record(NewAuditLogEntry {
    ///         category: "app".into(),
    ///         action: "migrate".into(),
    ///         status: AuditStatus::Success,
    ///         instance_id: None,
    ///         message_key: Some("audit.app.migrate".into()),
    ///         detail: None,
    ///         duration_ms: None,
    ///     })
    ///     .await?;
    ///
    /// assert!(id > 0);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn record(&self, entry: NewAuditLogEntry) -> Result<i64, AppDbError> {
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
        .execute(self.db.pool())
        .await?;

        Ok(result.last_insert_rowid())
    }

    /// Returns one cursor-paginated page of audit events.
    ///
    /// `items` are always in the natural sort order; `nextCursor` /
    /// `prevCursor` page forward and backward. The cursor is bound to the sort
    /// order via a fingerprint, so a cursor from a different sort is rejected.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Pagination`] for a malformed/stale cursor or an
    /// unknown sort field, or [`AppDbError::Sqlx`] when a query fails.
    pub async fn query(
        &self,
        page: &impl CursorPageQuery,
        sort: &SortSpec,
    ) -> Result<Page<AuditLogEntry>, AppDbError> {
        let pool = self.db.pool();
        let limit = page.limit();
        let resolved = sort::resolve(sort)?;
        let fingerprint = sort.fingerprint();

        let Some(token) = page.cursor() else {
            // The first page has nothing before it, so the only cursor it can
            // hand out is the forward one.
            let fetched = query::first_page(pool, &resolved, limit).await?;
            let (next, _) = fetched.cursors(&resolved, &fingerprint, PageDirection::Next)?;

            return Ok(Page::cursor(
                fetched.rows,
                limit,
                fetched.has_more,
                next,
                None,
            ));
        };

        let direction = page.direction();
        let cursor = query::decode_cursor(token, &fingerprint)?;
        let fetched = query::keyset_page(pool, &resolved, &cursor, direction, limit).await?;
        let (next, prev) = fetched.cursors(&resolved, &fingerprint, direction)?;

        Ok(Page::cursor(
            fetched.rows,
            limit,
            fetched.has_more,
            next,
            prev,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pagination::{CursorPagination, SortDirection, SortField};

    async fn seed(store: &AppDb, count: i64) {
        for index in 0..count {
            store
                .audit()
                .record(NewAuditLogEntry {
                    category: "app".into(),
                    action: format!("action-{index}"),
                    status: AuditStatus::Success,
                    instance_id: None,
                    message_key: Some("audit.app.migrate".into()),
                    detail: None,
                    duration_ms: None,
                })
                .await
                .unwrap();
        }
    }

    fn next(cursor: Option<String>) -> CursorPagination {
        CursorPagination {
            cursor,
            direction: PageDirection::Next,
            limit: 2,
        }
    }

    #[tokio::test]
    async fn walks_forward_and_backward_without_gaps() {
        let store = AppDb::connect_in_memory().await.unwrap();
        seed(&store, 5).await;

        let first = store
            .audit()
            .query(&next(None), &SortSpec::default())
            .await
            .unwrap();
        assert_eq!(first.items.len(), 2);
        assert_eq!(first.items[0].id, 5);
        assert!(first.page_info.has_more);

        let second = store
            .audit()
            .query(
                &next(first.page_info.next_cursor.clone()),
                &SortSpec::default(),
            )
            .await
            .unwrap();
        assert_eq!(second.items[0].id, 3);

        // Walking back returns the first page again.
        let back = store
            .audit()
            .query(
                &CursorPagination {
                    cursor: second.page_info.prev_cursor.clone(),
                    direction: PageDirection::Prev,
                    limit: 2,
                },
                &SortSpec::default(),
            )
            .await
            .unwrap();
        assert_eq!(back.items[0].id, 5);
    }

    #[tokio::test]
    async fn rejects_cursor_from_a_different_sort() {
        let store = AppDb::connect_in_memory().await.unwrap();
        seed(&store, 3).await;

        let by_default = store
            .audit()
            .query(&next(None), &SortSpec::default())
            .await
            .unwrap();
        let cursor = by_default.page_info.next_cursor.clone();

        let err = store
            .audit()
            .query(
                &next(cursor),
                &SortSpec {
                    fields: vec![SortField {
                        column: "action".into(),
                        direction: SortDirection::Asc,
                    }],
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, AppDbError::Pagination(_)));
    }
}
