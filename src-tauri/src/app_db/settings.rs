//! Repository methods for application configuration.

use super::{AppDb, AppDbError, AppSetting};

impl AppDb {
    /// Reads a configuration value by key.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the query fails.
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, AppDbError> {
        let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_settings WHERE key = ?")
            .bind(key)
            .fetch_optional(self.pool())
            .await?;

        Ok(row.map(|(value,)| value))
    }

    /// Inserts or updates a configuration value.
    ///
    /// `value` is stored verbatim; persist structured data as a JSON string.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the write fails.
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppDbError> {
        sqlx::query(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) \
             ON CONFLICT (key) DO UPDATE SET \
               value = excluded.value, \
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        )
        .bind(key)
        .bind(value)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Lists every configuration entry, ordered by key.
    ///
    /// # Errors
    ///
    /// Returns [`AppDbError::Sqlx`] when the query fails.
    pub async fn list_settings(&self) -> Result<Vec<AppSetting>, AppDbError> {
        let rows = sqlx::query_as::<_, AppSetting>("SELECT * FROM app_settings ORDER BY key ASC")
            .fetch_all(self.pool())
            .await?;

        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn upserts_and_lists_settings() {
        let store = AppDb::connect_in_memory().await.unwrap();

        assert_eq!(store.get_setting("locale").await.unwrap(), None);

        store.set_setting("locale", "\"en\"").await.unwrap();
        assert_eq!(
            store.get_setting("locale").await.unwrap(),
            Some("\"en\"".into())
        );

        store.set_setting("locale", "\"vi\"").await.unwrap();
        assert_eq!(
            store.get_setting("locale").await.unwrap(),
            Some("\"vi\"".into())
        );

        assert_eq!(store.list_settings().await.unwrap().len(), 1);
    }
}
