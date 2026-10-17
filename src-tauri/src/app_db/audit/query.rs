//! Cursor helpers for the audit log.
//!
//! Cursors are addresses into the ordered result set, not into memory: each one
//! carries the sort fingerprint it was minted for plus the sort values of the
//! row it points at (see [`Cursor`] for the wire format).

use super::AppDbError;
use super::AuditLogEntry;
use crate::pagination::sql::OrderedColumn;
use crate::pagination::{Cursor, CursorKey, PaginationError};

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
pub(super) fn encode_cursor(
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
