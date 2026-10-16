//! Repository methods for saved database connections.

use uuid::Uuid;

use super::{AppDb, AppDbError, DatabaseInstance, NewDatabaseInstance};

impl AppDb {
    /// Lists saved connections, favourites first and then by name.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the query fails.
    pub async fn list_instances(&self) -> Result<Vec<DatabaseInstance>, AppDbError> {
        let rows = sqlx::query_as::<_, DatabaseInstance>(
            "SELECT * FROM database_instances \
             ORDER BY is_favorite DESC, name COLLATE NOCASE ASC",
        )
        .fetch_all(self.pool())
        .await?;

        Ok(rows)
    }

    /// Fetches a saved connection by id.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the query fails.
    pub async fn get_instance(&self, id: &str) -> Result<Option<DatabaseInstance>, AppDbError> {
        let row =
            sqlx::query_as::<_, DatabaseInstance>("SELECT * FROM database_instances WHERE id = ?")
                .bind(id)
                .fetch_optional(self.pool())
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
    pub async fn create_instance(
        &self,
        new: NewDatabaseInstance,
    ) -> Result<DatabaseInstance, AppDbError> {
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
        .fetch_one(self.pool())
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
    pub async fn delete_instance(&self, id: &str) -> Result<bool, AppDbError> {
        let result = sqlx::query("DELETE FROM database_instances WHERE id = ?")
            .bind(id)
            .execute(self.pool())
            .await?;

        Ok(result.rows_affected() > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn creates_lists_and_deletes_instances() {
        let store = AppDb::connect_in_memory().await.unwrap();

        let created = store
            .create_instance(NewDatabaseInstance {
                name: "Local MySQL".into(),
                kind: "mysql".into(),
                host: Some("127.0.0.1".into()),
                port: Some(3306),
                database_name: Some("app".into()),
                username: Some("root".into()),
                secret_ref: Some("keyring:local-mysql".into()),
                is_favorite: true,
            })
            .await
            .unwrap();

        assert_eq!(created.name, "Local MySQL");
        assert!(created.is_favorite);
        assert!(!created.id.is_empty());
        assert!(!created.created_at.is_empty());

        assert_eq!(store.list_instances().await.unwrap().len(), 1);
        assert_eq!(
            store.get_instance(&created.id).await.unwrap().unwrap().id,
            created.id
        );

        assert!(store.delete_instance(&created.id).await.unwrap());
        assert!(!store.delete_instance(&created.id).await.unwrap());
        assert!(store.list_instances().await.unwrap().is_empty());
    }
}
