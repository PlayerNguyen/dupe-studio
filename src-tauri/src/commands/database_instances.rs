//! Saved-connection commands exposed to the frontend.
//!
//! Passwords travel inbound only: the create/update commands accept the
//! plaintext once and hand it to the OS credential store, while every read
//! returns a [`DatabaseInstance`] whose `secret_ref` is just an account key.

use tauri::State;

use crate::app_db::{
    AppDb, AppDbError, DatabaseInstance, NewDatabaseInstance, UpdateDatabaseInstance,
};
use crate::keyring::SecretStoreState;
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
/// * `input` - Instance metadata from the add-instance modal. Its `secret_ref`
///   is ignored: the backend generates the keychain account.
/// * `password` - Plaintext password to remember, if any.
/// * `remember` - When `false`, the password is not stored and the instance is
///   session-only (`secret_ref` stays `NULL`).
/// * `state` - Injected managed [`AppDb`].
/// * `secrets` - Injected managed [`SecretStoreState`].
///
/// # Returns
///
/// The persisted [`DatabaseInstance`], including its generated `id`,
/// `secret_ref` and timestamps.
///
/// # Errors
///
/// Returns `errors.storage.invalidInput` for invalid metadata,
/// `errors.storage.secretWriteFailed` when the credential store rejects the
/// password, or `errors.storage.saveFailed` when the insert fails.
#[tauri::command]
#[specta::specta]
pub async fn storage_create_instance(
    input: NewDatabaseInstance,
    password: Option<String>,
    remember: bool,
    state: State<'_, AppDb>,
    secrets: State<'_, SecretStoreState>,
) -> Result<DatabaseInstance, String> {
    let password = if remember { password.as_deref() } else { None };

    state
        .database_instances()
        .create_with_secret(secrets.store(), input, password)
        .await
        .map_err(write_error)
}

/// Updates a saved database connection.
///
/// # Arguments
///
/// * `id` - Instance id to update.
/// * `input` - New metadata. `secret_ref` is not part of the input.
/// * `password` - Replacement plaintext password, or `None` to keep the stored
///   one.
/// * `remember` - When `false`, any stored password is removed and the instance
///   becomes session-only.
/// * `state` - Injected managed [`AppDb`].
/// * `secrets` - Injected managed [`SecretStoreState`].
///
/// # Returns
///
/// The updated [`DatabaseInstance`].
///
/// # Errors
///
/// Returns `errors.storage.invalidInput` for invalid metadata,
/// `errors.storage.secretStoreUnavailable` or `errors.storage.secretWriteFailed`
/// for credential-store failures, or `errors.storage.saveFailed` when the
/// update fails.
#[tauri::command]
#[specta::specta]
pub async fn storage_update_instance(
    id: String,
    input: UpdateDatabaseInstance,
    password: Option<String>,
    remember: bool,
    state: State<'_, AppDb>,
    secrets: State<'_, SecretStoreState>,
) -> Result<DatabaseInstance, String> {
    let password = if remember { password.as_deref() } else { None };

    state
        .database_instances()
        .update_with_secret(secrets.store(), &id, input, password, remember)
        .await
        .map_err(write_error)
}

/// Deletes a saved database connection and its stored password.
///
/// The credential removal is best-effort; the row is the source of truth.
///
/// # Arguments
///
/// * `id` - Instance id to delete.
/// * `state` - Injected managed [`AppDb`].
/// * `secrets` - Injected managed [`SecretStoreState`].
///
/// # Returns
///
/// `true` when a row was removed, `false` when the id did not exist.
///
/// # Errors
///
/// Returns `errors.storage.saveFailed` when the delete fails.
#[tauri::command]
#[specta::specta]
pub async fn storage_delete_instance(
    id: String,
    state: State<'_, AppDb>,
    secrets: State<'_, SecretStoreState>,
) -> Result<bool, String> {
    state
        .database_instances()
        .delete_with_secret(secrets.store(), &id)
        .await
        .map_err(write_error)
}

/// Maps a storage error to the key the frontend translates.
fn write_error(error: AppDbError) -> String {
    match error {
        AppDbError::Sqlx(_) => "errors.storage.saveFailed".to_string(),
        other => other.i18n_key().to_string(),
    }
}
