//! Saved-connection commands exposed to the frontend.

use tauri::State;

use crate::app_db::{AppDb, DatabaseInstance};
use crate::pagination::{OffsetPagination, Page, SortSpec};

/// Returns one offset-paginated page of saved database connections.
///
/// # Arguments
///
/// * `page` - Offset/limit request from the frontend.
/// * `sort` - Requested sort; fields are validated against an allowlist.
/// * `state` - Injected managed [`AppDb`].
///
/// # Returns
///
/// A [`Page`] of [`DatabaseInstance`] rows, including `total`.
///
/// # Errors
///
/// Returns an i18n key string (`errors.storage.*`) when the request is invalid
/// or the query fails.
#[tauri::command]
#[specta::specta]
pub async fn storage_list_instances(
    page: OffsetPagination,
    sort: SortSpec,
    state: State<'_, AppDb>,
) -> Result<Page<DatabaseInstance>, String> {
    state
        .database_instances()
        .list(&page, &sort)
        .await
        .map_err(|error| error.i18n_key().to_string())
}
