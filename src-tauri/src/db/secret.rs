//! In-memory secret handling for connection credentials.

use std::fmt;

use serde::{Deserialize, Deserializer};
use zeroize::Zeroizing;

/// A password kept in memory.
///
/// The value is wrapped in [`Zeroizing`], so its bytes are overwritten when the
/// secret is dropped, and its [`fmt::Debug`] output is always `Secret(***)`.
/// `Secret` intentionally does **not** implement `serde::Serialize`: a
/// [`ConnectionConfig`](super::ConnectionConfig) may be deserialized from the
/// frontend, but it can never be serialized back out to IPC, an event, or a
/// log with the password attached.
///
/// # Examples
///
/// ```
/// use dupe_studio_lib::db::Secret;
///
/// let secret = Secret::new("hunter2");
/// assert_eq!(format!("{secret:?}"), "Secret(***)");
/// assert!(!secret.is_empty());
/// ```
#[derive(Clone, Default)]
pub struct Secret(Zeroizing<String>);

impl Secret {
    /// Wraps a plaintext password.
    pub fn new(value: impl Into<String>) -> Self {
        Self(Zeroizing::new(value.into()))
    }

    /// Returns whether the secret is empty.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Exposes the plaintext to the connection code.
    ///
    /// Deliberately crate-private: only the database layer builds a DSN or
    /// hands the password to a driver, and none of those results are returned
    /// to the frontend.
    pub(crate) fn expose_secret(&self) -> &str {
        self.0.as_str()
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Secret(***)")
    }
}

impl PartialEq for Secret {
    fn eq(&self, other: &Self) -> bool {
        self.expose_secret() == other.expose_secret()
    }
}

impl Eq for Secret {}

impl From<String> for Secret {
    fn from(value: String) -> Self {
        Self::new(value)
    }
}

impl From<&str> for Secret {
    fn from(value: &str) -> Self {
        Self::new(value)
    }
}

impl<'de> Deserialize<'de> for Secret {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        String::deserialize(deserializer).map(Self::new)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_redacts_the_password() {
        let secret = Secret::new("s3cr3t");

        let rendered = format!("{secret:?}");

        assert_eq!(rendered, "Secret(***)");
        assert!(!rendered.contains("s3cr3t"));
    }

    #[test]
    fn default_secret_is_empty() {
        assert!(Secret::default().is_empty());
        assert!(!Secret::new("pw").is_empty());
    }

    #[test]
    fn compares_by_value() {
        assert_eq!(Secret::new("pw"), Secret::new("pw"));
        assert_ne!(Secret::new("pw"), Secret::new("other"));
    }

    #[test]
    fn deserializes_from_a_plain_string() {
        let secret: Secret = serde_json::from_str("\"hunter2\"").unwrap();

        assert_eq!(secret, Secret::new("hunter2"));
    }
}
