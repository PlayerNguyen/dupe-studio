//! Cursor helpers for the audit log.
//!
//! Cursors are addresses into the ordered result set, not into memory: each one
//! carries the sort fingerprint it was minted for plus the sort values of the
//! row it points at (see [`Cursor`] for the wire format).
//!
//! The functions here keep [`AuditService::query`](super::AuditService::query)
//! small. They own the statement building, the keyset predicate and the cursor
//! arithmetic; the service only orchestrates a request.

use sqlx::SqlitePool;

use super::{AppDbError, AuditLogEntry};
use crate::pagination::sql::{self, OrderedColumn};
use crate::pagination::{Cursor, CursorKey, PageDirection, PaginationError};

/// Rows fetched for one page, plus whether another page follows.
pub(super) struct FetchedPage {
    /// Rows in natural sort order.
    pub(super) rows: Vec<AuditLogEntry>,
    /// Whether the fetch found one row more than the page size.
    pub(super) has_more: bool,
}

impl FetchedPage {
    /// Returns this page's `(next, prev)` cursors for `direction`.
    ///
    /// `has_more` always refers to the direction that was paged in, so the
    /// cursor pointing further that way only exists while rows remain; the
    /// cursor pointing back is always there (except on an empty page, or before
    /// the first page, which the caller handles).
    pub(super) fn cursors(
        &self,
        resolved: &[OrderedColumn],
        fingerprint: &str,
        direction: PageDirection,
    ) -> Result<(Option<String>, Option<String>), AppDbError> {
        let last = encode_row(self.rows.last(), resolved, fingerprint)?;
        let first = encode_row(self.rows.first(), resolved, fingerprint)?;

        Ok(match direction {
            PageDirection::Next => (if self.has_more { last } else { None }, first),
            PageDirection::Prev => (last, if self.has_more { first } else { None }),
        })
    }
}

/// Fetches the first page in natural sort order.
///
/// One row more than `limit` is requested, so the caller can tell whether
/// another page exists.
pub(super) async fn first_page(
    pool: &SqlitePool,
    resolved: &[OrderedColumn],
    limit: u32,
) -> Result<FetchedPage, AppDbError> {
    let order = sql::order_by(resolved);
    let statement = format!("SELECT * FROM audit_log {order} LIMIT ?");
    let fetch = sqlx::query_as::<_, AuditLogEntry>(&statement);
    let rows = fetch.bind(probe_size(limit)).fetch_all(pool).await?;

    Ok(truncate(rows, limit))
}

/// Fetches one keyset page in `direction`.
///
/// Rows always come back in natural sort order: a backward page is read with
/// the flipped order (to grab the rows just before the cursor) and reversed
/// afterwards.
pub(super) async fn keyset_page(
    pool: &SqlitePool,
    resolved: &[OrderedColumn],
    cursor: &Cursor,
    direction: PageDirection,
    limit: u32,
) -> Result<FetchedPage, AppDbError> {
    let (predicate, binds) = sql::keyset_predicate(resolved, cursor, direction)?;
    let reversed = direction == PageDirection::Prev;
    let order = if reversed {
        sql::order_by(&sql::flip_directions(resolved))
    } else {
        sql::order_by(resolved)
    };

    let statement = format!("SELECT * FROM audit_log WHERE {predicate} {order} LIMIT ?");
    let mut fetch = sqlx::query_as::<_, AuditLogEntry>(&statement);
    for key in binds {
        fetch = match key {
            CursorKey::Int(value) => fetch.bind(value),
            CursorKey::Text(value) => fetch.bind(value),
            CursorKey::Bool(value) => fetch.bind(value),
        };
    }
    fetch = fetch.bind(probe_size(limit));

    let mut page = truncate(fetch.fetch_all(pool).await?, limit);
    if reversed {
        page.rows.reverse();
    }

    Ok(page)
}

/// Decodes `token` and rejects a cursor minted for a different sort.
pub(super) fn decode_cursor(token: &str, fingerprint: &str) -> Result<Cursor, AppDbError> {
    let cursor = Cursor::decode(token)?;
    if cursor.fingerprint != fingerprint {
        return Err(AppDbError::Pagination(PaginationError::InvalidCursor(
            "cursor does not match the requested sort".into(),
        )));
    }

    Ok(cursor)
}

/// Row count to request so that the extra row signals a following page.
fn probe_size(limit: u32) -> i64 {
    i64::from(limit) + 1
}

/// Trims a probe-sized fetch down to `limit` rows.
///
/// The extra row is what reveals that another page exists, so its presence is
/// reported instead of being dropped silently.
fn truncate(mut rows: Vec<AuditLogEntry>, limit: u32) -> FetchedPage {
    let has_more = rows.len() as u32 > limit;
    rows.truncate(limit as usize);
    FetchedPage { rows, has_more }
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

/// Encodes `row` into a cursor when there is one.
fn encode_row(
    row: Option<&AuditLogEntry>,
    resolved: &[OrderedColumn],
    fingerprint: &str,
) -> Result<Option<String>, AppDbError> {
    row.map(|row| encode_cursor(fingerprint, resolved, row))
        .transpose()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pagination::SortDirection;

    fn entry(id: i64) -> AuditLogEntry {
        AuditLogEntry {
            id,
            occurred_at: "2026-01-01T00:00:00Z".into(),
            category: "app".into(),
            action: "run".into(),
            status: "success".into(),
            instance_id: None,
            message_key: None,
            detail: None,
            duration_ms: None,
        }
    }

    fn order() -> Vec<OrderedColumn> {
        vec![OrderedColumn {
            expression: "id",
            direction: SortDirection::Desc,
        }]
    }

    /// Runs the cursor calculation for `page` over the test sort.
    fn cursors(page: &FetchedPage, direction: PageDirection) -> (Option<String>, Option<String>) {
        page.cursors(&order(), "id:desc", direction).unwrap()
    }

    /// Decodes a cursor token back into its key values.
    fn keys(cursor: Option<String>) -> Vec<CursorKey> {
        Cursor::decode(&cursor.expect("expected a cursor"))
            .unwrap()
            .keys
    }

    #[test]
    fn next_page_exposes_both_boundaries() {
        let page = FetchedPage {
            rows: vec![entry(9), entry(8)],
            has_more: true,
        };

        let (next, prev) = cursors(&page, PageDirection::Next);

        // Forward points past the last row, backwards at the first one.
        assert_eq!(keys(next), vec![CursorKey::Int(8)]);
        assert_eq!(keys(prev), vec![CursorKey::Int(9)]);
    }

    #[test]
    fn previous_page_mirrors_the_cursors() {
        let page = FetchedPage {
            rows: vec![entry(5), entry(4)],
            has_more: true,
        };

        let (next, prev) = cursors(&page, PageDirection::Prev);

        // Paging backwards mirrors the same rule: the page's last row is still
        // the one that comes next, and only `prev` depends on `has_more`.
        assert_eq!(keys(next), vec![CursorKey::Int(4)]);
        assert_eq!(keys(prev), vec![CursorKey::Int(5)]);
    }

    #[test]
    fn last_page_has_no_forward_cursor() {
        let page = FetchedPage {
            rows: vec![entry(2)],
            has_more: false,
        };

        let (next, prev) = cursors(&page, PageDirection::Next);

        assert!(next.is_none());
        // A single row still yields a backwards cursor.
        assert_eq!(keys(prev), vec![CursorKey::Int(2)]);
    }

    #[test]
    fn empty_page_has_no_cursors() {
        let page = FetchedPage {
            rows: Vec::new(),
            has_more: false,
        };

        let (next, prev) = cursors(&page, PageDirection::Next);

        assert!(next.is_none());
        assert!(prev.is_none());
    }
}
