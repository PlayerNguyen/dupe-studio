//! End-to-end tests for the MySQL strategy against a real server.
//!
//! These tests are **opt-in**: they run only when a MySQL connection string is
//! provided through the `DUPE_STUDIO_MYSQL_URL` (or, as a fallback,
//! `MYSQL_TEST_URL`) environment variable. When neither is set every test logs
//! a skip notice and returns success, so `cargo test` stays green on machines
//! without a database.
//!
//! The quickest way to get a server is Docker:
//!
//! ```text
//! docker run --rm -p 3306:3306 -e MYSQL_ROOT_PASSWORD=secret -e MYSQL_DATABASE=dupe_studio mysql:8
//! $env:DUPE_STUDIO_MYSQL_URL = "mysql://root:secret@127.0.0.1:3306/dupe_studio"
//! cargo test --test mysql_integration
//! ```
//!
//! Each test creates its own uniquely named table and drops it on the way out,
//! so the suite is safe to run repeatedly and in parallel.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use dupe_studio_lib::db::{ConnectionConfig, Database, DbError, DbKind, DbValue};
use serde_json::Value;

/// Monotonic counter that keeps generated table names unique within a run.
static TABLE_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Reads the integration-test DSN, or `None` when the suite should be skipped.
fn mysql_url() -> Option<String> {
    match std::env::var("DUPE_STUDIO_MYSQL_URL").or_else(|_| std::env::var("MYSQL_TEST_URL")) {
        Ok(url) if !url.trim().is_empty() => Some(url),
        _ => None,
    }
}

/// Connects to the test server, logging and returning `None` when unset.
async fn connect() -> Option<Database> {
    let url = match mysql_url() {
        Some(url) => url,
        None => {
            eprintln!("skipping MySQL integration test: set DUPE_STUDIO_MYSQL_URL to run it");
            return None;
        }
    };

    let config = ConnectionConfig::from_url(DbKind::MySql, url);
    Some(
        Database::connect(config)
            .await
            .expect("failed to connect to DUPE_STUDIO_MYSQL_URL"),
    )
}

/// Returns a collision-free table name for this process and call.
fn unique_table(prefix: &str) -> String {
    let counter = TABLE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    format!("{prefix}_{}_{nanos}_{counter}", std::process::id())
}

/// Drops `table`, ignoring any error so cleanup never masks a failure.
async fn drop_table(db: &Database, table: &str) {
    let _ = db
        .execute(&format!("DROP TABLE IF EXISTS {table}"), &[])
        .await;
}

#[tokio::test]
async fn connects_and_pings() {
    let Some(db) = connect().await else {
        return;
    };

    db.ping().await.expect("ping should succeed");
    db.close().await.expect("close should succeed");
}

#[tokio::test]
async fn creates_inserts_and_selects() {
    let Some(db) = connect().await else {
        return;
    };
    let table = unique_table("dupe_it_basic");
    drop_table(&db, &table).await;

    db.execute(
        &format!("CREATE TABLE {table} (id INT PRIMARY KEY, name VARCHAR(64) NOT NULL)"),
        &[],
    )
    .await
    .expect("create table");

    let inserted = db
        .execute(
            &format!("INSERT INTO {table} (id, name) VALUES (?, ?)"),
            &[DbValue::from(1_i64), DbValue::from("alice")],
        )
        .await
        .expect("insert row");
    assert_eq!(inserted, 1);

    let result = db
        .query(&format!("SELECT id, name FROM {table}"), &[])
        .await
        .expect("select rows");

    assert_eq!(result.column_names(), vec!["id", "name"]);
    assert_eq!(result.row_count(), 1);
    assert_eq!(result.rows[0][0], Value::from(1));
    assert_eq!(result.rows[0][1], Value::from("alice"));

    drop_table(&db, &table).await;
    db.close().await.expect("close");
}

#[tokio::test]
async fn binds_parameters_and_surfaces_affected_rows() {
    let Some(db) = connect().await else {
        return;
    };
    let table = unique_table("dupe_it_bind");
    drop_table(&db, &table).await;

    db.execute(
        &format!("CREATE TABLE {table} (id INT PRIMARY KEY, score DOUBLE)"),
        &[],
    )
    .await
    .expect("create table");

    for (id, score) in [(1_i64, 1.5_f64), (2, 2.5), (3, 3.5)] {
        db.execute(
            &format!("INSERT INTO {table} (id, score) VALUES (?, ?)"),
            &[DbValue::from(id), DbValue::from(score)],
        )
        .await
        .expect("insert");
    }

    let updated = db
        .execute(
            &format!("UPDATE {table} SET score = ? WHERE id >= ?"),
            &[DbValue::from(9.0_f64), DbValue::from(2_i64)],
        )
        .await
        .expect("update");
    assert_eq!(updated, 2);

    let filtered = db
        .query(
            &format!("SELECT id FROM {table} WHERE score = ?"),
            &[DbValue::from(9.0_f64)],
        )
        .await
        .expect("select");
    assert_eq!(filtered.row_count(), 2);

    drop_table(&db, &table).await;
    db.close().await.expect("close");
}

#[tokio::test]
async fn reports_sql_errors() {
    let Some(db) = connect().await else {
        return;
    };

    let err = db
        .query("SELECT * FROM table_that_does_not_exist_1234", &[])
        .await
        .expect_err("query should fail");

    assert!(
        matches!(err, DbError::Query(_)),
        "unexpected error: {err:?}"
    );
    db.close().await.expect("close");
}

#[tokio::test]
async fn keeps_columns_for_empty_result() {
    let Some(db) = connect().await else {
        return;
    };
    let table = unique_table("dupe_it_empty");
    drop_table(&db, &table).await;

    db.execute(
        &format!("CREATE TABLE {table} (id INT PRIMARY KEY, label VARCHAR(10))"),
        &[],
    )
    .await
    .expect("create table");

    let result = db
        .query(&format!("SELECT id, label FROM {table}"), &[])
        .await
        .expect("select");

    assert_eq!(result.row_count(), 0);
    assert_eq!(result.column_names(), vec!["id", "label"]);

    drop_table(&db, &table).await;
    db.close().await.expect("close");
}

#[tokio::test]
async fn decodes_common_scalar_types() {
    let Some(db) = connect().await else {
        return;
    };
    let table = unique_table("dupe_it_types");
    drop_table(&db, &table).await;

    db.execute(
        &format!(
            "CREATE TABLE {table} (
                id INT PRIMARY KEY,
                amount DECIMAL(10,2) NOT NULL,
                ratio DOUBLE NOT NULL,
                label VARCHAR(64) NOT NULL,
                payload JSON NOT NULL,
                blob_col VARBINARY(8),
                created DATETIME NOT NULL,
                big BIGINT UNSIGNED NOT NULL
            )"
        ),
        &[],
    )
    .await
    .expect("create table");

    let payload = r#"{"ok":true,"n":3}"#;
    db.execute(
        &format!(
            "INSERT INTO {table}
                (id, amount, ratio, label, payload, blob_col, created, big)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ),
        &[
            DbValue::from(1_i64),
            DbValue::from("12.50"),
            DbValue::from(1.25_f64),
            DbValue::from("hello"),
            DbValue::Text(payload.to_string()),
            DbValue::Bytes(vec![0xDE, 0xAD, 0xBE, 0xEF]),
            DbValue::from("2024-01-02 03:04:05"),
            DbValue::from(18_446_744_073_709_551_615_u64),
        ],
    )
    .await
    .expect("insert");

    let result = db
        .query(
            &format!(
                "SELECT id, amount, ratio, label, payload, blob_col, created, big FROM {table}"
            ),
            &[],
        )
        .await
        .expect("select");

    let row = &result.rows[0];
    assert_eq!(row[0], Value::from(1));
    assert_eq!(row[1], Value::from("12.50"));
    assert_eq!(row[2], Value::from(1.25));
    assert_eq!(row[3], Value::from("hello"));
    assert_eq!(row[4], serde_json::json!({"ok": true, "n": 3}));
    assert_eq!(row[5], serde_json::json!([0xDE, 0xAD, 0xBE, 0xEF]));
    assert_eq!(row[6], Value::from("2024-01-02 03:04:05"));
    assert_eq!(row[7], Value::from(u64::MAX));

    drop_table(&db, &table).await;
    db.close().await.expect("close");
}

#[tokio::test]
async fn decodes_null_values() {
    let Some(db) = connect().await else {
        return;
    };
    let table = unique_table("dupe_it_null");
    drop_table(&db, &table).await;

    db.execute(
        &format!("CREATE TABLE {table} (id INT PRIMARY KEY, note VARCHAR(32))"),
        &[],
    )
    .await
    .expect("create table");

    db.execute(
        &format!("INSERT INTO {table} (id, note) VALUES (?, ?)"),
        &[DbValue::from(1_i64), DbValue::Null],
    )
    .await
    .expect("insert");

    let result = db
        .query(&format!("SELECT note FROM {table}"), &[])
        .await
        .expect("select");

    assert_eq!(result.rows[0][0], Value::Null);

    drop_table(&db, &table).await;
    db.close().await.expect("close");
}

#[tokio::test]
async fn unsupported_backend_is_rejected_without_a_server() {
    let config = ConnectionConfig::new(DbKind::Postgres)
        .with_host("localhost")
        .with_username("postgres");

    let Err(err) = Database::connect(config).await else {
        panic!("expected unsupported backend error");
    };
    assert!(matches!(err, DbError::Unsupported(_)));
}
