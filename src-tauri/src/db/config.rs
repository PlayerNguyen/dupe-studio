//! Backend kind and connection configuration.
//!
//! [`ConnectionConfig`] is the transport-neutral description of *where* to
//! connect. A [`DatabaseStrategy`](crate::db::DatabaseStrategy) implementation
//! takes one of these and turns it into a live pool/connection. This module is
//! also where the identifier and URL/DSN helpers live, which keeps every
//! strategy free of string manipulation.

use std::collections::BTreeMap;
use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

use super::error::DbError;
use super::secret::Secret;

/// The relational engine a connection targets.
///
/// Only [`DbKind::MySql`] has an implemented strategy today. The remaining
/// variants exist so the factory in [`Database`](crate::db::Database) can report
/// a precise [`DbError::Unsupported`] and so callers can already model their
/// target without a breaking change when new strategies land.
///
/// # Examples
///
/// ```
/// use dupe_studio_lib::db::DbKind;
///
/// assert_eq!(DbKind::MySql.as_str(), "mysql");
/// assert_eq!("mysql".parse::<DbKind>().unwrap(), DbKind::MySql);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DbKind {
    /// MySQL / MariaDB.
    MySql,
    /// PostgreSQL.
    Postgres,
    /// SQLite.
    Sqlite,
    /// Microsoft SQL Server.
    Mssql,
}

impl DbKind {
    /// Returns the canonical lowercase identifier for the backend.
    ///
    /// The value is stable and safe to persist; it is also what
    /// [`DbKind::from_str`] accepts back.
    pub fn as_str(&self) -> &'static str {
        match self {
            DbKind::MySql => "mysql",
            DbKind::Postgres => "postgres",
            DbKind::Sqlite => "sqlite",
            DbKind::Mssql => "mssql",
        }
    }

    /// Returns the URL scheme used to build a DSN for this backend.
    pub fn url_scheme(&self) -> &'static str {
        match self {
            DbKind::MySql => "mysql",
            DbKind::Postgres => "postgres",
            DbKind::Sqlite => "sqlite",
            DbKind::Mssql => "mssql",
        }
    }

    /// Returns the port to use when the caller does not specify one.
    pub fn default_port(&self) -> u16 {
        match self {
            DbKind::MySql => 3306,
            DbKind::Postgres => 5432,
            DbKind::Sqlite => 0,
            DbKind::Mssql => 1433,
        }
    }
}

impl fmt::Display for DbKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for DbKind {
    type Err = DbError;

    /// Parses a case-insensitive backend identifier.
    ///
    /// # Errors
    ///
    /// Returns [`DbError::Config`] when the string is not one of the known
    /// identifiers.
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "mysql" => Ok(DbKind::MySql),
            "postgres" | "postgresql" => Ok(DbKind::Postgres),
            "sqlite" | "sqlite3" => Ok(DbKind::Sqlite),
            "mssql" | "sqlserver" => Ok(DbKind::Mssql),
            other => Err(DbError::Config(format!(
                "unknown database backend `{other}`"
            ))),
        }
    }
}

/// Everything a strategy needs in order to open a connection.
///
/// Either provide the discrete fields (`host`, `port`, `username`, ...) or set
/// [`url`](ConnectionConfig::url) to a complete DSN. When `url` is set it wins
/// and the discrete fields are ignored, which is useful for tests and for
/// connection strings pasted by users.
///
/// The password is a [`Secret`]: it can be deserialized from the frontend, but
/// the type deliberately does not implement `Serialize`, so a config can never
/// be serialized back out with the password attached.
///
/// # Examples
///
/// ```
/// use dupe_studio_lib::db::{ConnectionConfig, DbKind};
///
/// let config = ConnectionConfig::new(DbKind::MySql)
///     .with_host("127.0.0.1")
///     .with_username("root")
///     .with_database("app");
///
/// assert_eq!(config.resolved_port(), 3306);
/// assert_eq!(config.url(), "mysql://root@127.0.0.1:3306/app");
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ConnectionConfig {
    /// Backend this configuration targets.
    pub kind: DbKind,
    /// Hostname or IP address. Ignored when [`url`](Self::url) is set.
    #[serde(default)]
    pub host: String,
    /// TCP port. Defaults to [`DbKind::default_port`] when omitted.
    #[serde(default)]
    pub port: Option<u16>,
    /// Login user. Ignored when [`url`](Self::url) is set.
    #[serde(default)]
    pub username: String,
    /// Login password. Ignored when [`url`](Self::url) is set.
    ///
    /// Held as a [`Secret`] so it is zeroized on drop and never serialized.
    #[serde(default)]
    pub password: Secret,
    /// Optional default schema/database name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub database: Option<String>,
    /// Extra DSN query parameters, e.g. `ssl-mode`.
    #[serde(default)]
    pub params: BTreeMap<String, String>,
    /// Complete connection string that overrides the discrete fields.
    #[serde(default)]
    pub url: Option<String>,
}

impl ConnectionConfig {
    /// Creates an empty configuration for `kind`.
    ///
    /// All fields default to empty; use the `with_*` builders to fill them in.
    pub fn new(kind: DbKind) -> Self {
        Self {
            kind,
            host: String::new(),
            port: None,
            username: String::new(),
            password: Secret::default(),
            database: None,
            params: BTreeMap::new(),
            url: None,
        }
    }

    /// Wraps an existing DSN, ignoring every discrete field.
    ///
    /// # Examples
    ///
    /// ```
    /// use dupe_studio_lib::db::{ConnectionConfig, DbKind};
    ///
    /// let config = ConnectionConfig::from_url(DbKind::MySql, "mysql://root@localhost/db");
    /// assert_eq!(config.url(), "mysql://root@localhost/db");
    /// ```
    pub fn from_url(kind: DbKind, url: impl Into<String>) -> Self {
        Self {
            url: Some(url.into()),
            ..Self::new(kind)
        }
    }

    /// Sets the host. Consumes and returns `self` for chaining.
    pub fn with_host(mut self, host: impl Into<String>) -> Self {
        self.host = host.into();
        self
    }

    /// Sets the port. Consumes and returns `self` for chaining.
    pub fn with_port(mut self, port: u16) -> Self {
        self.port = Some(port);
        self
    }

    /// Sets the username. Consumes and returns `self` for chaining.
    pub fn with_username(mut self, username: impl Into<String>) -> Self {
        self.username = username.into();
        self
    }

    /// Sets the password. Consumes and returns `self` for chaining.
    ///
    /// Accepts anything convertible into a [`Secret`], e.g. `&str` or `String`.
    pub fn with_password(mut self, password: impl Into<Secret>) -> Self {
        self.password = password.into();
        self
    }

    /// Sets the default database. Consumes and returns `self` for chaining.
    pub fn with_database(mut self, database: impl Into<String>) -> Self {
        self.database = Some(database.into());
        self
    }

    /// Inserts a single DSN query parameter. Consumes and returns `self`.
    pub fn with_param(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.params.insert(key.into(), value.into());
        self
    }

    /// Returns the port to connect on, falling back to the backend default.
    ///
    /// # Examples
    ///
    /// ```
    /// use dupe_studio_lib::db::{ConnectionConfig, DbKind};
    ///
    /// let config = ConnectionConfig::new(DbKind::MySql).with_port(4000);
    /// assert_eq!(config.resolved_port(), 4000);
    /// ```
    pub fn resolved_port(&self) -> u16 {
        self.port.unwrap_or_else(|| self.kind.default_port())
    }

    /// Builds a DSN from the discrete fields, or returns
    /// [`url`](Self::url) verbatim when it is set.
    ///
    /// User, password, database and parameter values are percent-encoded, so
    /// passwords containing `@`, `/` or `:` are safe to embed.
    pub fn url(&self) -> String {
        if let Some(url) = &self.url {
            return url.clone();
        }

        let mut dsn = format!("{}://", self.kind.url_scheme());

        if !self.username.is_empty() {
            dsn.push_str(&encode_component(&self.username));
            if !self.password.is_empty() {
                dsn.push(':');
                dsn.push_str(&encode_component(self.password.expose_secret()));
            }
            dsn.push('@');
        }

        dsn.push_str(&self.host);
        dsn.push(':');
        dsn.push_str(&self.resolved_port().to_string());

        if let Some(database) = &self.database {
            dsn.push('/');
            dsn.push_str(&encode_component(database));
        }

        if !self.params.is_empty() {
            dsn.push('?');
            let mut first = true;
            for (key, value) in &self.params {
                if !first {
                    dsn.push('&');
                }
                first = false;
                dsn.push_str(&encode_component(key));
                dsn.push('=');
                dsn.push_str(&encode_component(value));
            }
        }

        dsn
    }

    /// Checks the configuration before a strategy tries to use it.
    ///
    /// # Errors
    ///
    /// Returns [`DbError::Config`] when an explicit `url` is blank, when the
    /// host is empty, or when a networked backend is missing a username. A
    /// configuration that carries a non-empty `url` is always considered valid.
    pub fn validate(&self) -> Result<(), DbError> {
        if let Some(url) = &self.url {
            return if url.trim().is_empty() {
                Err(DbError::Config("connection url must not be empty".into()))
            } else {
                Ok(())
            };
        }

        if self.host.trim().is_empty() {
            return Err(DbError::Config("host must not be empty".into()));
        }

        if self.kind != DbKind::Sqlite && self.username.trim().is_empty() {
            return Err(DbError::Config("username must not be empty".into()));
        }

        Ok(())
    }
}

/// Percent-encodes a single DSN component using the RFC 3986 unreserved set.
///
/// Unreserved characters (`A-Z a-z 0-9 - _ . ~`) are passed through; everything
/// else becomes `%XX` with uppercase hex digits.
pub(crate) fn encode_component(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => {
                out.push('%');
                out.push_str(&format!("{byte:02X}"));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_displays_kind() {
        assert_eq!(DbKind::from_str("MySQL").unwrap(), DbKind::MySql);
        assert_eq!(DbKind::from_str("postgresql").unwrap(), DbKind::Postgres);
        assert_eq!(DbKind::from_str(" sqlite3 ").unwrap(), DbKind::Sqlite);
        assert_eq!(DbKind::from_str("sqlserver").unwrap(), DbKind::Mssql);
        assert_eq!(DbKind::MySql.to_string(), "mysql");
        assert!(DbKind::from_str("oracle").is_err());
    }

    #[test]
    fn kind_default_ports() {
        assert_eq!(DbKind::MySql.default_port(), 3306);
        assert_eq!(DbKind::Postgres.default_port(), 5432);
        assert_eq!(DbKind::Mssql.default_port(), 1433);
    }

    #[test]
    fn builds_dsn_from_fields() {
        let config = ConnectionConfig::new(DbKind::MySql)
            .with_host("db.internal")
            .with_port(3307)
            .with_username("app")
            .with_password("s3cr3t")
            .with_database("orders")
            .with_param("ssl-mode", "REQUIRED");

        assert_eq!(
            config.url(),
            "mysql://app:s3cr3t@db.internal:3307/orders?ssl-mode=REQUIRED"
        );
    }

    #[test]
    fn percent_encodes_special_characters() {
        let config = ConnectionConfig::new(DbKind::MySql)
            .with_host("localhost")
            .with_username("user@host")
            .with_password("p@ss:word/with");
        assert_eq!(
            config.url(),
            "mysql://user%40host:p%40ss%3Aword%2Fwith@localhost:3306"
        );
    }

    #[test]
    fn debug_redacts_the_password() {
        let config = ConnectionConfig::new(DbKind::MySql)
            .with_host("localhost")
            .with_username("root")
            .with_password("s3cr3t");

        let rendered = format!("{config:?}");

        assert!(rendered.contains("Secret(***)"));
        assert!(!rendered.contains("s3cr3t"));
    }

    #[test]
    fn explicit_url_wins_over_fields() {
        let config = ConnectionConfig::from_url(DbKind::MySql, "mysql://root@localhost/app")
            .with_host("ignored")
            .with_port(9999);
        assert_eq!(config.url(), "mysql://root@localhost/app");
    }

    #[test]
    fn validate_rejects_missing_fields() {
        assert!(ConnectionConfig::new(DbKind::MySql).validate().is_err());

        let missing_user = ConnectionConfig::new(DbKind::MySql).with_host("localhost");
        assert!(missing_user.validate().is_err());

        let valid = ConnectionConfig::new(DbKind::MySql)
            .with_host("localhost")
            .with_username("root");
        assert!(valid.validate().is_ok());
    }

    #[test]
    fn validate_accepts_blank_url_as_invalid() {
        let config = ConnectionConfig::from_url(DbKind::MySql, "   ");
        assert!(config.validate().is_err());
    }

    #[test]
    fn validate_allows_url_without_fields() {
        let config = ConnectionConfig::from_url(DbKind::MySql, "mysql://root@localhost/db");
        assert!(config.validate().is_ok());
    }
}
