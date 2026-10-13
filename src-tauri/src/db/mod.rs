//! Backend-agnostic database access.
//!
//! The entry point is [`Database`], a thin façade that owns a boxed
//! [`DatabaseStrategy`] and forwards calls to it. Pick a backend with
//! [`DbKind`]; today only [`DbKind::MySql`] has an implementation
//! ([`MySqlStrategy`]), and any other kind fails fast with
//! [`DbError::Unsupported`].
//!
//! # Design
//!
//! * [`DatabaseStrategy`] is the strategy interface: one trait, one
//!   implementation per engine.
//! * [`ConnectionConfig`] is the transport-neutral input.
//! * [`DbValue`] / [`QueryResult`] are the shared data contract, so callers and
//!   the frontend never see engine specific types.
//!
//! # Examples
//!
//! ```no_run
//! use dupe_studio_lib::db::{Database, ConnectionConfig, DbKind, DbValue};
//! # async fn run() -> Result<(), dupe_studio_lib::db::DbError> {
//! let config = ConnectionConfig::new(DbKind::MySql)
//!     .with_host("127.0.0.1")
//!     .with_username("root")
//!     .with_database("app");
//!
//! let db = Database::connect(config).await?;
//! db.execute("CREATE TABLE t (id INT PRIMARY KEY)", &[]).await?;
//! db.execute("INSERT INTO t (id) VALUES (?)", &[DbValue::from(1_i64)]).await?;
//!
//! let result = db.query("SELECT id FROM t", &[]).await?;
//! assert_eq!(result.row_count(), 1);
//! db.close().await?;
//! # Ok(())
//! # }
//! ```

mod config;
mod error;
mod mysql;
mod strategy;
mod value;

pub use config::{ConnectionConfig, DbKind};
pub use error::DbError;
pub use mysql::MySqlStrategy;
pub use strategy::DatabaseStrategy;
pub use value::{ColumnInfo, DbValue, QueryResult};

/// A live, backend-agnostic database connection.
///
/// `Database` is the only type callers need. Construction goes through
/// [`Database::connect`], which validates the configuration and selects the
/// strategy registered for the requested [`DbKind`].
pub struct Database {
    inner: Box<dyn DatabaseStrategy>,
}

impl Database {
    /// Connects to the backend described by `config`.
    ///
    /// # Errors
    ///
    /// * [`DbError::Config`] when `config` fails validation.
    /// * [`DbError::Unsupported`] when no strategy is registered for the
    ///   requested [`DbKind`].
    /// * [`DbError::Connection`] when the driver cannot reach the server.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use dupe_studio_lib::db::{Database, ConnectionConfig, DbKind};
    /// # async fn run() -> Result<(), dupe_studio_lib::db::DbError> {
    /// let db = Database::connect(ConnectionConfig::from_url(
    ///     DbKind::MySql,
    ///     "mysql://root@127.0.0.1:3306/app",
    /// ))
    /// .await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn connect(config: ConnectionConfig) -> Result<Self, DbError> {
        config.validate()?;

        let inner: Box<dyn DatabaseStrategy> = match config.kind {
            DbKind::MySql => Box::new(MySqlStrategy::connect(&config).await?),
            other => return Err(DbError::Unsupported(other.to_string())),
        };

        Ok(Self { inner })
    }

    /// Wraps an already-built strategy.
    ///
    /// Useful in tests, where a fake strategy stands in for a real server.
    pub fn from_strategy(strategy: impl DatabaseStrategy + 'static) -> Self {
        Self {
            inner: Box::new(strategy),
        }
    }

    /// Returns the backend this connection targets.
    pub fn kind(&self) -> DbKind {
        self.inner.kind()
    }

    /// Verifies the connection is still alive.
    ///
    /// # Errors
    ///
    /// Propagates [`DbError::Connection`] from the strategy.
    pub async fn ping(&self) -> Result<(), DbError> {
        self.inner.ping().await
    }

    /// Runs a statement and returns the number of affected rows.
    ///
    /// # Errors
    ///
    /// Propagates [`DbError`] from the strategy.
    pub async fn execute(&self, sql: &str, params: &[DbValue]) -> Result<u64, DbError> {
        self.inner.execute(sql, params).await
    }

    /// Runs a query and materialises the result set.
    ///
    /// # Errors
    ///
    /// Propagates [`DbError`] from the strategy.
    pub async fn query(&self, sql: &str, params: &[DbValue]) -> Result<QueryResult, DbError> {
        self.inner.query(sql, params).await
    }

    /// Closes the connection and releases its resources.
    ///
    /// # Errors
    ///
    /// Propagates [`DbError::Connection`] from the strategy.
    pub async fn close(&self) -> Result<(), DbError> {
        self.inner.close().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use serde_json::Value;

    struct Fake {
        kind: DbKind,
    }

    #[async_trait]
    impl DatabaseStrategy for Fake {
        fn kind(&self) -> DbKind {
            self.kind
        }
        async fn ping(&self) -> Result<(), DbError> {
            Ok(())
        }
        async fn execute(&self, _sql: &str, _params: &[DbValue]) -> Result<u64, DbError> {
            Ok(1)
        }
        async fn query(&self, _sql: &str, _params: &[DbValue]) -> Result<QueryResult, DbError> {
            Ok(QueryResult {
                columns: vec![ColumnInfo {
                    name: "answer".into(),
                    type_name: "INT".into(),
                }],
                rows: vec![vec![Value::from(42)]],
                rows_affected: 0,
            })
        }
        async fn close(&self) -> Result<(), DbError> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn factory_reports_unsupported_backend() {
        let config = ConnectionConfig::new(DbKind::Postgres)
            .with_host("localhost")
            .with_username("postgres");

        let Err(err) = Database::connect(config).await else {
            panic!("expected unsupported backend error");
        };
        assert!(matches!(err, DbError::Unsupported(_)));
    }

    #[tokio::test]
    async fn factory_validates_before_dispatch() {
        let config = ConnectionConfig::new(DbKind::Postgres);
        let Err(err) = Database::connect(config).await else {
            panic!("expected config error");
        };
        assert!(matches!(err, DbError::Config(_)));
    }

    #[tokio::test]
    async fn delegates_to_wrapped_strategy() {
        let db = Database::from_strategy(Fake {
            kind: DbKind::Sqlite,
        });

        assert_eq!(db.kind(), DbKind::Sqlite);
        assert!(db.ping().await.is_ok());
        assert_eq!(db.execute("irrelevant", &[]).await.unwrap(), 1);

        let result = db.query("irrelevant", &[]).await.unwrap();
        assert_eq!(result.column_names(), vec!["answer"]);
        assert_eq!(result.rows[0][0], Value::from(42));

        assert!(db.close().await.is_ok());
    }
}
