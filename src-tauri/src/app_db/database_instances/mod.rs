//! Saved-connection domain: models, sort allowlist and the
//! [`DatabaseInstanceService`].
//!
//! Everything that reads or writes `database_instances` lives in this folder.
//! Callers get a service from
//! [`AppDb::database_instances`](super::AppDb::database_instances) instead of
//! reaching for the pool.

mod models;
mod sort;

use uuid::Uuid;

use super::{AppDb, AppDbError};
use crate::keyring::{SecretStore, account_for};
use crate::pagination::sql;
use crate::pagination::{OffsetPageQuery, Page, SortSpec};

pub use models::{DatabaseInstance, NewDatabaseInstance, UpdateDatabaseInstance};

/// Read/write service for saved database connections.
///
/// Cheap to clone: it only holds a handle to the shared connection pool, so
/// request one per call through
/// [`AppDb::database_instances`](super::AppDb::database_instances).
#[derive(Debug, Clone)]
pub struct DatabaseInstanceService {
    db: AppDb,
}

impl DatabaseInstanceService {
    /// Binds the service to the shared [`AppDb`] handle.
    pub(super) fn new(db: AppDb) -> Self {
        Self { db }
    }

    /// Lists saved connections for one page, with a total count.
    ///
    /// The rows and the count are read inside a single transaction, so `total`
    /// always matches the returned `items`.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Pagination`] for an unknown sort field, or
    /// [`AppDbError::Sqlx`] when a query fails.
    pub async fn list(
        &self,
        page: &impl OffsetPageQuery,
        sort: &SortSpec,
    ) -> Result<Page<DatabaseInstance>, AppDbError> {
        let limit = page.limit();
        let offset = page.offset();
        let order = sql::order_by(&sort::resolve(sort)?);

        let mut tx = self.db.pool().begin().await?;

        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM database_instances")
            .fetch_one(&mut *tx)
            .await?;

        let items = sqlx::query_as::<_, DatabaseInstance>(&format!(
            "SELECT * FROM database_instances {order} LIMIT ? OFFSET ?"
        ))
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(Page::offset(items, limit, offset, total as u64))
    }

    /// Fetches a saved connection by id.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the query fails.
    pub async fn get(&self, id: &str) -> Result<Option<DatabaseInstance>, AppDbError> {
        let row =
            sqlx::query_as::<_, DatabaseInstance>("SELECT * FROM database_instances WHERE id = ?")
                .bind(id)
                .fetch_optional(self.db.pool())
                .await?;

        Ok(row)
    }

    /// Inserts a new saved connection and returns it.
    ///
    /// The UUID and timestamps are generated here / by SQLite; callers do not
    /// provide them. Names and kinds are trimmed before they are stored.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::InvalidInput`] when the name or kind is blank, or
    /// when an explicit port is outside `1..=65535`. Returns
    /// [`AppDbError::Sqlx`] when the insert fails.
    pub async fn create(&self, new: NewDatabaseInstance) -> Result<DatabaseInstance, AppDbError> {
        self.insert(Uuid::new_v4().to_string(), new).await
    }

    /// Inserts a new saved connection and stores its password first.
    ///
    /// The instance id and `secret_ref` are generated here: callers never
    /// choose the keychain account. When `password` is present (and non-empty)
    /// the secret is written to `store` **before** the row; if the insert then
    /// fails, the secret is deleted again so no dangling credential remains.
    /// Passing `None` creates a session-only connection whose `secret_ref`
    /// stays `NULL`.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Secret`] when the keychain write fails,
    /// [`AppDbError::InvalidInput`] for invalid metadata, or
    /// [`AppDbError::Sqlx`] when the insert fails.
    pub async fn create_with_secret(
        &self,
        store: &dyn SecretStore,
        new: NewDatabaseInstance,
        password: Option<&str>,
    ) -> Result<DatabaseInstance, AppDbError> {
        let id = Uuid::new_v4().to_string();
        let password = password.filter(|value| !value.is_empty());
        let secret_ref = password.map(|_| account_for(&id));

        if let (Some(account), Some(password)) = (&secret_ref, password) {
            store.set(account, password)?;
        }

        let mut new = new;
        new.secret_ref = secret_ref.clone();

        match self.insert(id, new).await {
            Ok(row) => Ok(row),
            Err(error) => {
                if let Some(account) = secret_ref {
                    let _ = store.delete(&account);
                }
                Err(error)
            }
        }
    }

    /// Updates a saved connection and keeps its keychain entry in sync.
    ///
    /// - `remember` + password: writes the secret and keeps/sets `secret_ref`.
    /// - `remember` without password: keeps the existing secret (if any).
    /// - `!remember`: clears `secret_ref` and deletes the entry after the row
    ///   update succeeds.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::NotFound`] when the id does not exist,
    /// [`AppDbError::Secret`] when the keychain write fails,
    /// [`AppDbError::InvalidInput`] for invalid metadata, or
    /// [`AppDbError::Sqlx`] when the update fails.
    pub async fn update_with_secret(
        &self,
        store: &dyn SecretStore,
        id: &str,
        changes: UpdateDatabaseInstance,
        password: Option<&str>,
        remember: bool,
    ) -> Result<DatabaseInstance, AppDbError> {
        let existing = self
            .get(id)
            .await?
            .ok_or_else(|| AppDbError::NotFound(id.to_string()))?;

        let mut changes = changes;
        changes.name = changes.name.trim().to_string();
        changes.kind = changes.kind.trim().to_string();
        Self::validate(&changes.name, &changes.kind, changes.port)?;

        let password = password.filter(|value| !value.is_empty());
        let mut newly_stored = None;

        let secret_ref = if remember {
            match (existing.secret_ref.clone(), password) {
                (Some(account), Some(password)) => {
                    store.set(&account, password)?;
                    Some(account)
                }
                (Some(account), None) => Some(account),
                (None, Some(password)) => {
                    let account = account_for(id);
                    store.set(&account, password)?;
                    newly_stored = Some(account.clone());
                    Some(account)
                }
                (None, None) => None,
            }
        } else {
            None
        };

        let previous_secret = if remember {
            None
        } else {
            existing.secret_ref.clone()
        };

        let result = sqlx::query_as::<_, DatabaseInstance>(
            "UPDATE database_instances \
                SET name = ?, kind = ?, host = ?, port = ?, database_name = ?, \
                    username = ?, secret_ref = ?, is_favorite = ?, \
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') \
              WHERE id = ? \
              RETURNING *",
        )
        .bind(changes.name)
        .bind(changes.kind)
        .bind(changes.host)
        .bind(changes.port)
        .bind(changes.database_name)
        .bind(changes.username)
        .bind(secret_ref)
        .bind(changes.is_favorite)
        .bind(id)
        .fetch_one(self.db.pool())
        .await;

        match result {
            Ok(row) => {
                if let Some(account) = previous_secret {
                    let _ = store.delete(&account);
                }
                Ok(row)
            }
            Err(error) => {
                if let Some(account) = newly_stored {
                    let _ = store.delete(&account);
                }
                Err(error.into())
            }
        }
    }

    /// Deletes a saved connection and removes its keychain entry.
    ///
    /// The row is deleted first; removing the credential is best-effort, so a
    /// keychain failure cannot leave a row pointing at a missing secret.
    ///
    /// # Returns
    ///
    /// `true` when a row was removed, `false` when the id did not exist.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the row lookup or delete fails.
    pub async fn delete_with_secret(
        &self,
        store: &dyn SecretStore,
        id: &str,
    ) -> Result<bool, AppDbError> {
        let Some(existing) = self.get(id).await? else {
            return Ok(false);
        };

        let removed = self.delete(id).await?;
        if removed && let Some(account) = existing.secret_ref {
            let _ = store.delete(&account);
        }

        Ok(removed)
    }

    /// Deletes a saved connection row.
    ///
    /// Prefer [`DatabaseInstanceService::delete_with_secret`] so the keychain
    /// entry is cleaned up too; this method is the row-only primitive.
    ///
    /// # Returns
    ///
    /// `true` when a row was removed, `false` when the id did not exist.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the delete fails.
    pub async fn delete(&self, id: &str) -> Result<bool, AppDbError> {
        let result = sqlx::query("DELETE FROM database_instances WHERE id = ?")
            .bind(id)
            .execute(self.db.pool())
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Inserts a row with an explicit id, generating `created_at`/`updated_at`.
    async fn insert(
        &self,
        id: String,
        mut new: NewDatabaseInstance,
    ) -> Result<DatabaseInstance, AppDbError> {
        new.name = new.name.trim().to_string();
        new.kind = new.kind.trim().to_string();
        Self::validate(&new.name, &new.kind, new.port)?;

        let row = sqlx::query_as::<_, DatabaseInstance>(
            "INSERT INTO database_instances \
               (id, name, kind, host, port, database_name, username, secret_ref, is_favorite) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \
             RETURNING *",
        )
        .bind(id)
        .bind(new.name)
        .bind(new.kind)
        .bind(new.host)
        .bind(new.port)
        .bind(new.database_name)
        .bind(new.username)
        .bind(new.secret_ref)
        .bind(new.is_favorite)
        .fetch_one(self.db.pool())
        .await?;

        Ok(row)
    }

    /// Validates normalized metadata shared by create and update.
    fn validate(name: &str, kind: &str, port: Option<i64>) -> Result<(), AppDbError> {
        if name.is_empty() {
            return Err(AppDbError::InvalidInput("name"));
        }
        if kind.is_empty() {
            return Err(AppDbError::InvalidInput("kind"));
        }
        if let Some(port) = port
            && !(1..=65535).contains(&port)
        {
            return Err(AppDbError::InvalidInput("port"));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keyring::{InMemorySecretStore, SecretStore, account_for};
    use crate::pagination::{OffsetPagination, SortDirection, SortField};

    async fn seed(store: &AppDb, count: usize) {
        for index in 0..count {
            store
                .database_instances()
                .create(NewDatabaseInstance {
                    name: format!("db-{index:02}"),
                    kind: "mysql".into(),
                    host: Some("127.0.0.1".into()),
                    port: Some(3306),
                    database_name: Some("app".into()),
                    username: Some("root".into()),
                    secret_ref: None,
                    is_favorite: index == 0,
                })
                .await
                .unwrap();
        }
    }

    #[tokio::test]
    async fn create_persists_generated_fields() {
        let store = AppDb::connect_in_memory().await.unwrap();

        let created = store
            .database_instances()
            .create(NewDatabaseInstance {
                name: "  local mysql  ".into(),
                kind: " mysql ".into(),
                host: Some("127.0.0.1".into()),
                port: Some(3306),
                database_name: Some("app".into()),
                username: Some("root".into()),
                secret_ref: None,
                is_favorite: true,
            })
            .await
            .unwrap();

        assert_eq!(created.name, "local mysql");
        assert_eq!(created.kind, "mysql");
        assert!(created.is_favorite);
        assert!(!created.id.is_empty());
        assert!(!created.created_at.is_empty());
        assert!(!created.updated_at.is_empty());

        let fetched = store
            .database_instances()
            .get(&created.id)
            .await
            .unwrap()
            .expect("created row should be readable");
        assert_eq!(fetched, created);
    }

    #[tokio::test]
    async fn create_rejects_invalid_input() {
        let store = AppDb::connect_in_memory().await.unwrap();
        let service = store.database_instances();
        let valid = || NewDatabaseInstance {
            name: "local".into(),
            kind: "mysql".into(),
            host: None,
            port: None,
            database_name: None,
            username: None,
            secret_ref: None,
            is_favorite: false,
        };

        let blank_name = service
            .create(NewDatabaseInstance {
                name: "   ".into(),
                ..valid()
            })
            .await
            .unwrap_err();
        assert!(matches!(blank_name, AppDbError::InvalidInput("name")));

        let bad_port = service
            .create(NewDatabaseInstance {
                port: Some(0),
                ..valid()
            })
            .await
            .unwrap_err();
        assert!(matches!(bad_port, AppDbError::InvalidInput("port")));
    }

    /// A valid create input shared by the credential tests.
    fn local_instance() -> NewDatabaseInstance {
        NewDatabaseInstance {
            name: "local".into(),
            kind: "mysql".into(),
            host: Some("127.0.0.1".into()),
            port: Some(3306),
            database_name: Some("app".into()),
            username: Some("root".into()),
            secret_ref: None,
            is_favorite: false,
        }
    }

    /// Update input derived from a saved row.
    fn update_for(instance: &DatabaseInstance) -> UpdateDatabaseInstance {
        UpdateDatabaseInstance {
            name: instance.name.clone(),
            kind: instance.kind.clone(),
            host: instance.host.clone(),
            port: instance.port,
            database_name: instance.database_name.clone(),
            username: instance.username.clone(),
            is_favorite: instance.is_favorite,
        }
    }

    #[tokio::test]
    async fn create_with_secret_stores_the_password_and_reference() {
        let db = AppDb::connect_in_memory().await.unwrap();
        let secrets = InMemorySecretStore::new();

        let created = db
            .database_instances()
            .create_with_secret(&secrets, local_instance(), Some("s3cr3t"))
            .await
            .unwrap();

        let account = created.secret_ref.clone().expect("secret_ref is set");
        assert_eq!(account, account_for(&created.id));
        assert_eq!(secrets.get(&account).unwrap(), Some("s3cr3t".into()));
    }

    #[tokio::test]
    async fn create_without_a_password_stays_session_only() {
        let db = AppDb::connect_in_memory().await.unwrap();
        let secrets = InMemorySecretStore::new();

        let created = db
            .database_instances()
            .create_with_secret(&secrets, local_instance(), None)
            .await
            .unwrap();

        assert_eq!(created.secret_ref, None);
        assert!(secrets.is_empty());
    }

    #[tokio::test]
    async fn create_with_secret_rolls_back_on_insert_failure() {
        let db = AppDb::connect_in_memory().await.unwrap();
        let secrets = InMemorySecretStore::new();

        let result = db
            .database_instances()
            .create_with_secret(
                &secrets,
                NewDatabaseInstance {
                    name: "   ".into(),
                    ..local_instance()
                },
                Some("s3cr3t"),
            )
            .await;

        assert!(matches!(result, Err(AppDbError::InvalidInput("name"))));
        assert!(secrets.is_empty());
    }

    #[tokio::test]
    async fn update_with_secret_replaces_and_clears_the_password() {
        let db = AppDb::connect_in_memory().await.unwrap();
        let secrets = InMemorySecretStore::new();
        let service = db.database_instances();

        let created = service
            .create_with_secret(&secrets, local_instance(), Some("old"))
            .await
            .unwrap();
        let account = created.secret_ref.clone().expect("secret_ref is set");

        let replaced = service
            .update_with_secret(
                &secrets,
                &created.id,
                update_for(&created),
                Some("new"),
                true,
            )
            .await
            .unwrap();
        assert_eq!(replaced.secret_ref.as_deref(), Some(account.as_str()));
        assert_eq!(secrets.get(&account).unwrap(), Some("new".into()));

        let cleared = service
            .update_with_secret(&secrets, &created.id, update_for(&created), None, false)
            .await
            .unwrap();
        assert_eq!(cleared.secret_ref, None);
        assert_eq!(secrets.get(&account).unwrap(), None);
    }

    #[tokio::test]
    async fn delete_with_secret_removes_the_credential() {
        let db = AppDb::connect_in_memory().await.unwrap();
        let secrets = InMemorySecretStore::new();
        let service = db.database_instances();

        let created = service
            .create_with_secret(&secrets, local_instance(), Some("s3cr3t"))
            .await
            .unwrap();
        let account = created.secret_ref.clone().expect("secret_ref is set");

        assert!(
            service
                .delete_with_secret(&secrets, &created.id)
                .await
                .unwrap()
        );

        assert_eq!(secrets.get(&account).unwrap(), None);
        assert!(service.get(&created.id).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn paginates_with_total_and_default_order() {
        let store = AppDb::connect_in_memory().await.unwrap();
        seed(&store, 5).await;

        let page = store
            .database_instances()
            .list(
                &OffsetPagination {
                    offset: 0,
                    limit: 2,
                },
                &SortSpec::default(),
            )
            .await
            .unwrap();

        assert_eq!(page.items.len(), 2);
        assert_eq!(page.page_info.total, Some(5));
        assert_eq!(page.page_info.offset, Some(0));
        assert!(page.page_info.has_more);
        // The favourite is first.
        assert!(page.items[0].is_favorite);

        let last = store
            .database_instances()
            .list(
                &OffsetPagination {
                    offset: 4,
                    limit: 2,
                },
                &SortSpec::default(),
            )
            .await
            .unwrap();
        assert_eq!(last.items.len(), 1);
        assert!(!last.page_info.has_more);
    }

    #[tokio::test]
    async fn applies_requested_sort() {
        let store = AppDb::connect_in_memory().await.unwrap();
        seed(&store, 3).await;

        let page = store
            .database_instances()
            .list(
                &OffsetPagination {
                    offset: 0,
                    limit: 10,
                },
                &SortSpec {
                    fields: vec![SortField {
                        column: "name".into(),
                        direction: SortDirection::Desc,
                    }],
                },
            )
            .await
            .unwrap();

        assert_eq!(page.items[0].name, "db-02");
    }

    #[tokio::test]
    async fn rejects_unknown_sort_field() {
        let store = AppDb::connect_in_memory().await.unwrap();

        let err = store
            .database_instances()
            .list(
                &OffsetPagination::default(),
                &SortSpec {
                    fields: vec![SortField {
                        column: "secret".into(),
                        direction: SortDirection::Asc,
                    }],
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, AppDbError::Pagination(_)));
    }
}
