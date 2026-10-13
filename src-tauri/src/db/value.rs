//! Backend-neutral bind values and result shapes.
//!
//! Every strategy speaks the same vocabulary so callers can write code once and
//! swap the backend later. [`DbValue`] is what flows *into* a statement;
//! [`ColumnInfo`] and [`QueryResult`] are what flows *out*.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// A single scalar that can be bound to a placeholder in a SQL statement.
///
/// The set is deliberately small and maps cleanly onto both MySQL's wire types
/// and JSON, which keeps the frontend boundary lossless. Use [`DbValue::Null`]
/// for an explicit `NULL`.
///
/// # Examples
///
/// ```
/// use dupe_studio_lib::db::DbValue;
///
/// let value: DbValue = 42_i64.into();
/// assert_eq!(value, DbValue::Int(42));
/// assert_eq!(<DbValue as From<&str>>::from("id"), DbValue::Text("id".into()));
/// ```
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "lowercase")]
pub enum DbValue {
    /// SQL `NULL`.
    Null,
    /// Boolean literal.
    Bool(bool),
    /// Signed integer (`TINYINT` .. `BIGINT`).
    Int(i64),
    /// Unsigned integer, used for `BIGINT UNSIGNED` and `BIT`.
    UInt(u64),
    /// Floating point (`FLOAT`, `DOUBLE`).
    Float(f64),
    /// UTF-8 text (`CHAR`, `VARCHAR`, `TEXT`, `ENUM`, `SET`).
    Text(String),
    /// Raw bytes (`BINARY`, `VARBINARY`, `BLOB`).
    Bytes(Vec<u8>),
}

impl From<bool> for DbValue {
    fn from(value: bool) -> Self {
        DbValue::Bool(value)
    }
}

impl From<i64> for DbValue {
    fn from(value: i64) -> Self {
        DbValue::Int(value)
    }
}

impl From<i32> for DbValue {
    fn from(value: i32) -> Self {
        DbValue::Int(i64::from(value))
    }
}

impl From<u64> for DbValue {
    fn from(value: u64) -> Self {
        DbValue::UInt(value)
    }
}

impl From<f64> for DbValue {
    fn from(value: f64) -> Self {
        DbValue::Float(value)
    }
}

impl From<String> for DbValue {
    fn from(value: String) -> Self {
        DbValue::Text(value)
    }
}

impl From<&str> for DbValue {
    fn from(value: &str) -> Self {
        DbValue::Text(value.to_owned())
    }
}

impl From<Vec<u8>> for DbValue {
    fn from(value: Vec<u8>) -> Self {
        DbValue::Bytes(value)
    }
}

impl<T> From<Option<T>> for DbValue
where
    T: Into<DbValue>,
{
    fn from(value: Option<T>) -> Self {
        match value {
            Some(inner) => inner.into(),
            None => DbValue::Null,
        }
    }
}

/// Describes one column of a result set.
///
/// `type_name` is the driver's own label (for MySQL, values such as `VARCHAR`
/// or `BIGINT UNSIGNED`). It is best-effort and meant for display, not for
/// driving application logic.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ColumnInfo {
    /// Column label exactly as returned by the server.
    pub name: String,
    /// Server reported type name.
    pub type_name: String,
}

/// The outcome of a `SELECT`.
///
/// Rows are positional: `rows[row][col]` lines up with [`QueryResult::columns`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct QueryResult {
    /// Column metadata in select order.
    pub columns: Vec<ColumnInfo>,
    /// Row values, each inner vector aligned with `columns`.
    pub rows: Vec<Vec<Value>>,
    /// Rows changed by the statement; `0` for pure `SELECT`s.
    pub rows_affected: u64,
}

impl QueryResult {
    /// Returns the column labels in select order.
    pub fn column_names(&self) -> Vec<&str> {
        self.columns.iter().map(|c| c.name.as_str()).collect()
    }

    /// Returns the number of rows in the result set.
    pub fn row_count(&self) -> usize {
        self.rows.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn db_value_from_impls() {
        assert_eq!(DbValue::from(true), DbValue::Bool(true));
        assert_eq!(DbValue::from(7_i32), DbValue::Int(7));
        assert_eq!(DbValue::from(7_u64), DbValue::UInt(7));
        assert_eq!(DbValue::from(1.5_f64), DbValue::Float(1.5));
        assert_eq!(DbValue::from("x"), DbValue::Text("x".into()));
        assert_eq!(DbValue::from(vec![1_u8, 2]), DbValue::Bytes(vec![1, 2]));
        assert_eq!(DbValue::from(None::<i64>), DbValue::Null);
        assert_eq!(DbValue::from(Some(3_i64)), DbValue::Int(3));
    }

    #[test]
    fn query_result_helpers() {
        let result = QueryResult {
            columns: vec![ColumnInfo {
                name: "id".into(),
                type_name: "BIGINT".into(),
            }],
            rows: vec![vec![Value::from(1)]],
            rows_affected: 0,
        };

        assert_eq!(result.column_names(), vec!["id"]);
        assert_eq!(result.row_count(), 1);
    }
}
