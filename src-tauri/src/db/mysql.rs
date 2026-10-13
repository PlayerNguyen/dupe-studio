//! MySQL / MariaDB strategy built on [`sqlx`].
//!
//! This is the reference implementation of
//! [`DatabaseStrategy`]. It owns a `sqlx` connection pool, binds
//! [`DbValue`] parameters positionally, and decodes each returned cell into a
//! [`serde_json::Value`] so results can cross the Tauri boundary untouched.

use std::time::Duration;

use async_trait::async_trait;
use serde_json::Value;
use sqlx::mysql::{MySqlArguments, MySqlPoolOptions, MySqlRow};
use sqlx::query::Query;
use sqlx::{Column, Executor, MySql, MySqlPool, Row, TypeInfo, ValueRef};

use super::config::{ConnectionConfig, DbKind};
use super::error::DbError;
use super::strategy::{ColumnInfo, DatabaseStrategy, QueryResult};
use super::value::DbValue;

/// Pool size used when `max_connections` is not supplied in the config.
const DEFAULT_MAX_CONNECTIONS: u32 = 5;
/// How long to wait for a free connection before giving up.
const DEFAULT_ACQUIRE_TIMEOUT: Duration = Duration::from_secs(30);

/// Strategy that talks to MySQL and MariaDB.
///
/// Construct it with [`MySqlStrategy::connect`], which validates the
/// configuration and opens a pool in one step. The instance is cheap to share:
/// clone the surrounding [`Database`](crate::db::Database) wrapper or move it
/// into managed state.
#[derive(Debug)]
pub struct MySqlStrategy {
    pool: MySqlPool,
}

impl MySqlStrategy {
    /// Validates `config`, opens a connection pool, and returns a ready
    /// strategy.
    ///
    /// The optional `max_connections` DSN parameter caps the pool size.
    ///
    /// # Errors
    ///
    /// Returns [`DbError::Config`] when `config` fails validation, or
    /// [`DbError::Connection`] when the pool cannot reach the server.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use dupe_studio_lib::db::{ConnectionConfig, DatabaseStrategy, DbKind, MySqlStrategy};
    /// # async fn run() -> Result<(), dupe_studio_lib::db::DbError> {
    /// let config = ConnectionConfig::new(DbKind::MySql)
    ///     .with_host("127.0.0.1")
    ///     .with_username("root")
    ///     .with_database("app");
    ///
    /// let strategy = MySqlStrategy::connect(&config).await?;
    /// strategy.close().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn connect(config: &ConnectionConfig) -> Result<Self, DbError> {
        config.validate()?;

        let max_connections = config
            .params
            .get("max_connections")
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(DEFAULT_MAX_CONNECTIONS);

        let pool = MySqlPoolOptions::new()
            .max_connections(max_connections)
            .acquire_timeout(DEFAULT_ACQUIRE_TIMEOUT)
            .connect(&config.url())
            .await
            .map_err(|err| DbError::Connection(err.to_string()))?;

        Ok(Self { pool })
    }

    /// Returns a reference to the underlying pool for advanced use.
    ///
    /// Prefer the [`DatabaseStrategy`] methods; this escape hatch exists for
    /// migrations or streaming, which the trait does not model.
    pub fn pool(&self) -> &MySqlPool {
        &self.pool
    }
}

#[async_trait]
impl DatabaseStrategy for MySqlStrategy {
    fn kind(&self) -> DbKind {
        DbKind::MySql
    }

    async fn ping(&self) -> Result<(), DbError> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map(|_| ())
            .map_err(|err| DbError::Connection(err.to_string()))
    }

    async fn execute(&self, sql: &str, params: &[DbValue]) -> Result<u64, DbError> {
        let query = bind_params(sqlx::query(sql), params);
        query
            .execute(&self.pool)
            .await
            .map(|result| result.rows_affected())
            .map_err(|err| DbError::Query(err.to_string()))
    }

    async fn query(&self, sql: &str, params: &[DbValue]) -> Result<QueryResult, DbError> {
        let described = (&self.pool)
            .describe(sql)
            .await
            .map_err(|err| DbError::Query(err.to_string()))?;

        let columns: Vec<ColumnInfo> = described
            .columns()
            .iter()
            .map(|column| ColumnInfo {
                name: column.name().to_string(),
                type_name: column.type_info().name().to_string(),
            })
            .collect();

        let rows = bind_params(sqlx::query(sql), params)
            .fetch_all(&self.pool)
            .await
            .map_err(|err| DbError::Query(err.to_string()))?;

        let mut decoded = Vec::with_capacity(rows.len());
        for row in &rows {
            decoded.push(decode_row(row)?);
        }

        Ok(QueryResult {
            columns,
            rows: decoded,
            rows_affected: 0,
        })
    }

    async fn close(&self) -> Result<(), DbError> {
        self.pool.close().await;
        Ok(())
    }
}

/// Binds every [`DbValue`] positionally onto a freshly built query.
fn bind_params<'q>(
    mut query: Query<'q, MySql, MySqlArguments>,
    params: &[DbValue],
) -> Query<'q, MySql, MySqlArguments> {
    for param in params {
        query = match param {
            DbValue::Null => query.bind(None::<String>),
            DbValue::Bool(value) => query.bind(*value),
            DbValue::Int(value) => query.bind(*value),
            DbValue::UInt(value) => query.bind(*value),
            DbValue::Float(value) => query.bind(*value),
            DbValue::Text(value) => query.bind(value.clone()),
            DbValue::Bytes(value) => query.bind(value.clone()),
        };
    }
    query
}

/// Decodes one full row into JSON values aligned with the column order.
fn decode_row(row: &MySqlRow) -> Result<Vec<Value>, DbError> {
    (0..row.len())
        .map(|index| decode_cell(row, index))
        .collect()
}

/// Decodes a single cell, dispatching on the server reported column type.
fn decode_cell(row: &MySqlRow, index: usize) -> Result<Value, DbError> {
    let raw = row
        .try_get_raw(index)
        .map_err(|err| DbError::decode(column_name(row, index), index, err.to_string()))?;

    if raw.is_null() {
        return Ok(Value::Null);
    }

    let type_name = raw.type_info().name().to_ascii_uppercase();
    let unsigned = type_name.ends_with(" UNSIGNED");
    let base = type_name.strip_suffix(" UNSIGNED").unwrap_or(&type_name);

    let column = column_name(row, index);
    let decode_error = |err: sqlx::Error| DbError::decode(column.clone(), index, err.to_string());

    let value = match base {
        "BOOLEAN" | "BOOL" => Value::Bool(row.try_get::<bool, _>(index).map_err(decode_error)?),
        "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" | "BIGINT" => {
            if unsigned {
                Value::from(row.try_get::<u64, _>(index).map_err(decode_error)?)
            } else {
                Value::from(row.try_get::<i64, _>(index).map_err(decode_error)?)
            }
        }
        "FLOAT" | "DOUBLE" => Value::from(row.try_get::<f64, _>(index).map_err(decode_error)?),
        "DECIMAL" | "NEWDECIMAL" => Value::String(
            row.try_get::<sqlx::types::Decimal, _>(index)
                .map_err(decode_error)?
                .to_string(),
        ),
        "JSON" => {
            row.try_get::<sqlx::types::Json<Value>, _>(index)
                .map_err(decode_error)?
                .0
        }
        "DATE" => Value::String(
            row.try_get::<sqlx::types::chrono::NaiveDate, _>(index)
                .map_err(decode_error)?
                .to_string(),
        ),
        "TIME" => Value::String(
            row.try_get::<sqlx::types::chrono::NaiveTime, _>(index)
                .map_err(decode_error)?
                .to_string(),
        ),
        "DATETIME" | "TIMESTAMP" => Value::String(
            row.try_get::<sqlx::types::chrono::NaiveDateTime, _>(index)
                .map_err(decode_error)?
                .to_string(),
        ),
        "BIT" => Value::from(row.try_get::<u64, _>(index).map_err(decode_error)?),
        "BLOB" | "TINYBLOB" | "MEDIUMBLOB" | "LONGBLOB" | "BINARY" | "VARBINARY" => {
            let bytes = row.try_get::<Vec<u8>, _>(index).map_err(decode_error)?;
            Value::Array(bytes.into_iter().map(Value::from).collect())
        }
        "VARCHAR" | "CHAR" | "STRING" | "VAR_STRING" | "TINYTEXT" | "TEXT" | "MEDIUMTEXT"
        | "LONGTEXT" | "ENUM" | "SET" => {
            Value::String(row.try_get::<String, _>(index).map_err(decode_error)?)
        }
        _ => decode_fallback(row, index, &column)?,
    };

    Ok(value)
}

/// Best-effort decode for types the match does not know about yet.
fn decode_fallback(row: &MySqlRow, index: usize, column: &str) -> Result<Value, DbError> {
    if let Ok(text) = row.try_get::<String, _>(index) {
        return Ok(Value::String(text));
    }
    if let Ok(bytes) = row.try_get::<Vec<u8>, _>(index) {
        return Ok(Value::Array(bytes.into_iter().map(Value::from).collect()));
    }
    Err(DbError::decode(
        column.to_string(),
        index,
        "unsupported column type",
    ))
}

/// Reads the column label at `index`.
fn column_name(row: &MySqlRow, index: usize) -> String {
    row.column(index).name().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn connect_rejects_invalid_config_without_network() {
        let config = ConnectionConfig::new(DbKind::MySql);
        let err = MySqlStrategy::connect(&config).await.unwrap_err();
        assert!(matches!(err, DbError::Config(_)));
    }

    #[tokio::test]
    async fn connect_rejects_blank_url() {
        let config = ConnectionConfig::from_url(DbKind::MySql, "   ");
        let err = MySqlStrategy::connect(&config).await.unwrap_err();
        assert!(matches!(err, DbError::Config(_)));
    }
}
