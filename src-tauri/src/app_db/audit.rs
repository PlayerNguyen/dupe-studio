//! Repository methods for the audit log.

use super::{AppDb, AppDbError, AuditLogEntry, NewAuditLogEntry};
use crate::pagination::sql::{self, OrderedColumn, SortableColumn};
use crate::pagination::{
    Cursor, CursorKey, CursorPageQuery, Page, PageDirection, PaginationError, SortDirection,
    SortSpec,
};

/// Columns the frontend may sort the audit log by.
const SORT_COLUMNS: &[SortableColumn] = &[
    SortableColumn {
        field: "occurredAt",
        expression: "occurred_at",
    },
    SortableColumn {
        field: "category",
        expression: "category",
    },
    SortableColumn {
        field: "action",
        expression: "action",
    },
    SortableColumn {
        field: "status",
        expression: "status",
    },
];

/// Default order: newest first.
fn default_order() -> Vec<OrderedColumn> {
    vec![OrderedColumn {
        expression: "id",
        direction: SortDirection::Desc,
    }]
}

/// Resolves the requested sort, falling back to [`default_order`].
fn resolve(sort: &SortSpec) -> Result<Vec<OrderedColumn>, AppDbError> {
    if sort.is_empty() {
        Ok(default_order())
    } else {
        Ok(sql::resolve_order(sort, SORT_COLUMNS, "id")?)
    }
}

/// Reads the sort-key value of `expression` from an audit row.
fn key_of(row: &AuditLogEntry, expression: &str) -> CursorKey {
    match expression {
        "occurred_at" => CursorKey::Text(row.occurred_at.clone()),
        "category" => CursorKey::Text(row.category.clone()),
        "action" => CursorKey::Text(row.action.clone()),
        "status" => CursorKey::Text(row.status.clone()),
        // `id` (the tiebreaker) and anything else use the numeric id.
        _ => CursorKey::Int(row.id),
    }
}

/// Encodes the cursor pointing at `row`.
fn encode_cursor(
    fingerprint: &str,
    resolved: &[OrderedColumn],
    row: &AuditLogEntry,
) -> Result<String, AppDbError> {
    let keys = resolved
        .iter()
        .map(|column| key_of(row, column.expression))
        .collect();
    Ok(Cursor::new(fingerprint, keys).encode()?)
}

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
    pub async fn query_audit(
        &self,
        page: &impl CursorPageQuery,
        sort: &SortSpec,
    ) -> Result<Page<AuditLogEntry>, AppDbError> {
        let limit = page.limit();
        let direction = page.direction();
        let resolved = resolve(sort)?;
        let fingerprint = sort.fingerprint();

        let Some(token) = page.cursor() else {
            // First page: natural order, fetch one extra row to detect `hasMore`.
            let order = sql::order_by(&resolved);
            let mut rows = sqlx::query_as::<_, AuditLogEntry>(&format!(
                "SELECT * FROM audit_log {order} LIMIT ?"
            ))
            .bind((limit + 1) as i64)
            .fetch_all(self.pool())
            .await?;

            let has_more = rows.len() as u32 > limit;
            rows.truncate(limit as usize);

            let next_cursor = if has_more {
                match rows.last() {
                    Some(row) => Some(encode_cursor(&fingerprint, &resolved, row)?),
                    None => None,
                }
            } else {
                None
            };

            return Ok(Page::cursor(rows, limit, has_more, next_cursor, None));
        };

        let cursor = Cursor::decode(token)?;
        if cursor.fingerprint != fingerprint {
            return Err(AppDbError::Pagination(PaginationError::InvalidCursor(
                "cursor does not match the requested sort".into(),
            )));
        }

        let (predicate, binds) = sql::keyset_predicate(&resolved, &cursor, direction)?;
        let reversed = direction == PageDirection::Prev;
        let order_columns = if reversed {
            sql::flip_directions(&resolved)
        } else {
            resolved.clone()
        };
        let order = sql::order_by(&order_columns);

        let statement = format!("SELECT * FROM audit_log WHERE {predicate} {order} LIMIT ?");
        let mut query = sqlx::query_as::<_, AuditLogEntry>(&statement);
        for key in binds {
            query = match key {
                CursorKey::Int(value) => query.bind(value),
                CursorKey::Text(value) => query.bind(value),
                CursorKey::Bool(value) => query.bind(value),
            };
        }
        query = query.bind((limit + 1) as i64);

        let mut rows = query.fetch_all(self.pool()).await?;
        let has_more = rows.len() as u32 > limit;
        rows.truncate(limit as usize);
        if reversed {
            rows.reverse();
        }

        let (next_cursor, prev_cursor) = if reversed {
            let prev = if has_more {
                match rows.first() {
                    Some(row) => Some(encode_cursor(&fingerprint, &resolved, row)?),
                    None => None,
                }
            } else {
                None
            };
            let next = match rows.last() {
                Some(row) => Some(encode_cursor(&fingerprint, &resolved, row)?),
                None => None,
            };
            (next, prev)
        } else {
            let next = if has_more {
                match rows.last() {
                    Some(row) => Some(encode_cursor(&fingerprint, &resolved, row)?),
                    None => None,
                }
            } else {
                None
            };
            let prev = match rows.first() {
                Some(row) => Some(encode_cursor(&fingerprint, &resolved, row)?),
                None => None,
            };
            (next, prev)
        };

        Ok(Page::cursor(
            rows,
            limit,
            has_more,
            next_cursor,
            prev_cursor,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pagination::{CursorPagination, SortField};

    async fn seed(store: &AppDb, count: i64) {
        for index in 0..count {
            store
                .record_audit(NewAuditLogEntry {
                    category: "app".into(),
                    action: format!("action-{index}"),
                    status: super::super::AuditStatus::Success,
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
            .query_audit(&next(None), &SortSpec::default())
            .await
            .unwrap();
        assert_eq!(first.items.len(), 2);
        assert_eq!(first.items[0].id, 5);
        assert!(first.page_info.has_more);

        let second = store
            .query_audit(
                &next(first.page_info.next_cursor.clone()),
                &SortSpec::default(),
            )
            .await
            .unwrap();
        assert_eq!(second.items[0].id, 3);

        // Walking back returns the first page again.
        let back = store
            .query_audit(
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
            .query_audit(&next(None), &SortSpec::default())
            .await
            .unwrap();
        let cursor = by_default.page_info.next_cursor.clone();

        let err = store
            .query_audit(
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
