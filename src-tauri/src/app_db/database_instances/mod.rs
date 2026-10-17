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
use crate::pagination::sql;
use crate::pagination::{OffsetPageQuery, Page, SortSpec};

pub use models::{DatabaseInstance, NewDatabaseInstance};

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
    /// provide them.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the insert fails.
    pub async fn create(&self, new: NewDatabaseInstance) -> Result<DatabaseInstance, AppDbError> {
        let row = sqlx::query_as::<_, DatabaseInstance>(
            "INSERT INTO database_instances \
               (id, name, kind, host, port, database_name, username, secret_ref, is_favorite) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \
             RETURNING *",
        )
        .bind(Uuid::new_v4().to_string())
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

    /// Deletes a saved connection.
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
}

#[cfg(test)]
mod tests {
    use super::*;
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
