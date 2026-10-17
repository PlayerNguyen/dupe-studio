//! Saved-connection commands exposed to the frontend.

use tauri::State;

use crate::app_db::{AppDb, AppDbError, DatabaseInstance, NewDatabaseInstance};
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

/// Creates a saved database connection.
///
/// # Arguments
///
/// * `input` - Instance metadata from the add-instance modal: display name,
///   engine kind, and the connection fields for that engine. Secrets are not
///   accepted here; `secret_ref` stays `None` until the OS keychain integration
///   lands.
/// * `state` - Injected managed [`AppDb`].
///
/// # Returns
///
/// The persisted [`DatabaseInstance`], including its generated `id` and
/// timestamps.
///
/// # Errors
///
/// Returns `errors.storage.invalidInput` when the name, kind or port is not
/// valid, or `errors.storage.saveFailed` when the insert fails.
#[tauri::command]
#[specta::specta]
pub async fn storage_create_instance(
    input: NewDatabaseInstance,
    state: State<'_, AppDb>,
) -> Result<DatabaseInstance, String> {
    state
        .database_instances()
        .create(input)
        .await
        .map_err(|error| match error {
            AppDbError::Sqlx(_) => "errors.storage.saveFailed".to_string(),
            other => other.i18n_key().to_string(),
        })
}
