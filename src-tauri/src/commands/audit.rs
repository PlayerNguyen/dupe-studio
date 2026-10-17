//! Audit-log commands exposed to the frontend.

use tauri::State;

use crate::app_db::{AppDb, AuditLogEntry};
use crate::pagination::{CursorPagination, Page, SortSpec};

/// Returns one cursor-paginated page of audit events.
///
/// # Arguments
///
/// * `page` - Cursor/direction/limit request from the frontend.
/// * `sort` - Requested sort; fields are validated against an allowlist.
/// * `state` - Injected managed [`AppDb`].
///
/// # Returns
///
/// A [`Page`] of [`AuditLogEntry`] rows with `nextCursor` / `prevCursor`.
///
/// # Errors
///
/// Returns an i18n key string (`errors.storage.*`) when the cursor or sort is
/// invalid, or the query fails.
#[tauri::command]
#[specta::specta]
pub async fn storage_query_audit(
    page: CursorPagination,
    sort: SortSpec,
    state: State<'_, AppDb>,
) -> Result<Page<AuditLogEntry>, String> {
    state
        .audit()
        .query(&page, &sort)
        .await
        .map_err(|error| error.i18n_key().to_string())
}
