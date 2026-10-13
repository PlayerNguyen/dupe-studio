//! The strategy contract every backend implements.
//!
//! This is the heart of the multi-DBMS design: [`Database`](crate::db::Database)
//! owns a `Box<dyn DatabaseStrategy>` and forwards to it, so adding PostgreSQL,
//! SQLite or SQL Server later is a matter of implementing one trait and
//! registering it in the factory — no caller changes.

use async_trait::async_trait;

use super::config::DbKind;
use super::error::DbError;
use super::value::DbValue;

pub use super::value::{ColumnInfo, QueryResult};

/// Operations a database backend must provide.
///
/// All methods take `&self` and are safe to call concurrently; the concrete
/// implementation owns whatever pooling or locking it needs. Connecting is
/// deliberately *not* part of this trait: a strategy is only constructed after
/// a successful connection, which lets implementations hold a ready-to-use pool
/// with no interior mutability.
///
/// The trait is object safe, so implementations can be stored as
/// `Box<dyn DatabaseStrategy>` behind a single façade.
///
/// # Examples
///
/// ```no_run
/// use dupe_studio_lib::db::{DatabaseStrategy, DbValue, DbError, DbKind, QueryResult};
/// # use async_trait::async_trait;
///
/// struct InMemory;
///
/// #[async_trait]
/// impl DatabaseStrategy for InMemory {
///     fn kind(&self) -> DbKind { DbKind::Sqlite }
///     async fn ping(&self) -> Result<(), DbError> { Ok(()) }
///     async fn execute(&self, _sql: &str, _params: &[DbValue]) -> Result<u64, DbError> { Ok(0) }
///     async fn query(&self, _sql: &str, _params: &[DbValue]) -> Result<QueryResult, DbError> {
///         Ok(QueryResult { columns: vec![], rows: vec![], rows_affected: 0 })
///     }
///     async fn close(&self) -> Result<(), DbError> { Ok(()) }
/// }
/// ```
#[async_trait]
pub trait DatabaseStrategy: Send + Sync {
    /// Returns the backend this strategy talks to.
    fn kind(&self) -> DbKind;

    /// Verifies the connection is still usable.
    ///
    /// # Errors
    ///
    /// Returns [`DbError::Connection`] when the handshake fails.
    async fn ping(&self) -> Result<(), DbError>;

    /// Runs a statement and returns the number of affected rows.
    ///
    /// Use this for `INSERT` / `UPDATE` / `DELETE` / DDL. `params` are bound
    /// positionally to `?` (or the backend's equivalent) placeholders.
    ///
    /// # Errors
    ///
    /// Returns [`DbError::Query`] when the server rejects the statement, or
    /// [`DbError::Connection`] if the connection is gone.
    async fn execute(&self, sql: &str, params: &[DbValue]) -> Result<u64, DbError>;

    /// Runs a query and materialises every returned row.
    ///
    /// # Errors
    ///
    /// Returns [`DbError::Query`] when the statement fails and
    /// [`DbError::Decode`] when a returned cell cannot be mapped to JSON.
    async fn query(&self, sql: &str, params: &[DbValue]) -> Result<QueryResult, DbError>;

    /// Flushes and releases the underlying pool.
    ///
    /// # Errors
    ///
    /// Returns [`DbError::Connection`] if the pool could not be closed cleanly.
    async fn close(&self) -> Result<(), DbError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Stub;

    #[async_trait]
    impl DatabaseStrategy for Stub {
        fn kind(&self) -> DbKind {
            DbKind::Sqlite
        }
        async fn ping(&self) -> Result<(), DbError> {
            Ok(())
        }
        async fn execute(&self, _sql: &str, _params: &[DbValue]) -> Result<u64, DbError> {
            Ok(3)
        }
        async fn query(&self, _sql: &str, _params: &[DbValue]) -> Result<QueryResult, DbError> {
            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: 0,
            })
        }
        async fn close(&self) -> Result<(), DbError> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn trait_is_object_safe_and_dispatchable() {
        let strategy: Box<dyn DatabaseStrategy> = Box::new(Stub);
        assert_eq!(strategy.kind(), DbKind::Sqlite);
        assert!(strategy.ping().await.is_ok());
        assert_eq!(strategy.execute("SELECT 1", &[]).await.unwrap(), 3);
        assert_eq!(
            strategy.query("SELECT 1", &[]).await.unwrap().row_count(),
            0
        );
        assert!(strategy.close().await.is_ok());
    }
}
