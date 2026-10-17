//! Credential storage abstraction and its OS keychain implementation.
//!
//! [`SecretStore`] is the seam every other module depends on; production code
//! uses [`KeyringSecretStore`], while tests inject an in-memory store so
//! `cargo test` stays hermetic (CI Linux has no Secret Service daemon).

use super::KeyringError;

/// Service name used for every dupe-studio credential entry.
pub const DEFAULT_SERVICE: &str = "dupe-studio";

/// Builds the account key for a saved database instance.
///
/// The `instance:<uuid>` namespace keeps room for other secret kinds later
/// (`ssh_tunnel:<uuid>`, `oauth:<uuid>`, ...) without collisions in the OS
/// credential store. Store the result in `database_instances.secret_ref`.
///
/// # Examples
///
/// ```
/// use dupe_studio_lib::keyring::account_for;
///
/// assert_eq!(account_for("1b4e28ba"), "instance:1b4e28ba");
/// ```
pub fn account_for(instance_id: &str) -> String {
    format!("instance:{instance_id}")
}

/// Reads and writes secrets in a credential store.
///
/// Implementations must be `Send + Sync` because Tauri commands run on the
/// async runtime and share one store through managed state. A missing entry is
/// not an error: [`SecretStore::get`] returns `Ok(None)` so callers can tell
/// "never saved" apart from "store failed".
pub trait SecretStore: Send + Sync {
    /// Stores `secret` under `account`, replacing any previous value.
    ///
    /// # Errors
    ///
    /// Returns [`KeyringError::Unavailable`] when the platform store cannot be
    /// initialized, or [`KeyringError::Write`] when the store rejects the write.
    fn set(&self, account: &str, secret: &str) -> Result<(), KeyringError>;

    /// Returns the secret stored under `account`, or `None` when there is none.
    ///
    /// # Errors
    ///
    /// Returns [`KeyringError::Unavailable`] when the platform store cannot be
    /// initialized, or [`KeyringError::Read`] when the read fails for a reason
    /// other than a missing entry.
    fn get(&self, account: &str) -> Result<Option<String>, KeyringError>;

    /// Deletes the secret stored under `account`.
    ///
    /// Implementations treat a missing entry as success, so callers can delete
    /// idempotently.
    ///
    /// # Errors
    ///
    /// Returns [`KeyringError::Unavailable`] when the platform store cannot be
    /// initialized, or [`KeyringError::Write`] when the deletion fails.
    fn delete(&self, account: &str) -> Result<(), KeyringError>;
}

/// [`SecretStore`] backed by the operating system credential store.
///
/// Uses the platform default through the `keyring` crate: Windows Credential
/// Manager, macOS Keychain, or the \*nix Secret Service. On an environment
/// without a Secret Service daemon (minimal Linux window managers, WSL,
/// headless CI) the first access returns [`KeyringError::Unavailable`];
/// callers surface `errors.storage.secretStoreUnavailable` and let the user
/// continue in session-only mode.
#[derive(Debug, Clone)]
pub struct KeyringSecretStore {
    service: String,
}

impl KeyringSecretStore {
    /// Creates a store using [`DEFAULT_SERVICE`].
    pub fn new() -> Self {
        Self::with_service(DEFAULT_SERVICE)
    }

    /// Creates a store using a custom service name.
    ///
    /// Custom names are for tests and diagnostics; production uses
    /// [`KeyringSecretStore::new`].
    pub fn with_service(service: impl Into<String>) -> Self {
        Self {
            service: service.into(),
        }
    }

    /// Returns the service name this store writes under.
    pub fn service(&self) -> &str {
        &self.service
    }

    /// Reports whether the platform credential store can be initialized.
    ///
    /// Calls the underlying store once and caches the result, so it can be used
    /// for diagnostics without writing anything.
    pub fn is_available() -> bool {
        ::keyring::v1::Entry::store_status().is_ok()
    }

    /// Opens the credential entry for `account`.
    fn entry(&self, account: &str) -> Result<::keyring::v1::Entry, KeyringError> {
        ::keyring::v1::Entry::new(&self.service, account).map_err(KeyringError::Unavailable)
    }
}

impl Default for KeyringSecretStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SecretStore for KeyringSecretStore {
    fn set(&self, account: &str, secret: &str) -> Result<(), KeyringError> {
        self.entry(account)?
            .set_password(secret)
            .map_err(|source| KeyringError::Write {
                account: account.to_string(),
                source,
            })
    }

    fn get(&self, account: &str) -> Result<Option<String>, KeyringError> {
        match self.entry(account)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(::keyring::v1::Error::NoEntry) => Ok(None),
            Err(source) => Err(KeyringError::Read {
                account: account.to_string(),
                source,
            }),
        }
    }

    fn delete(&self, account: &str) -> Result<(), KeyringError> {
        match self.entry(account)?.delete_credential() {
            Ok(()) | Err(::keyring::v1::Error::NoEntry) => Ok(()),
            Err(source) => Err(KeyringError::Write {
                account: account.to_string(),
                source,
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    /// Hermetic [`SecretStore`] used to test the trait contract.
    ///
    /// The production [`KeyringSecretStore`] cannot be exercised in CI, so the
    /// behaviour every caller relies on (round-trip, overwrite, idempotent
    /// delete, missing entry) is asserted against this fake.
    #[derive(Default)]
    struct InMemorySecretStore {
        entries: Mutex<HashMap<String, String>>,
    }

    impl SecretStore for InMemorySecretStore {
        fn set(&self, account: &str, secret: &str) -> Result<(), KeyringError> {
            self.entries
                .lock()
                .expect("in-memory store lock poisoned")
                .insert(account.to_string(), secret.to_string());
            Ok(())
        }

        fn get(&self, account: &str) -> Result<Option<String>, KeyringError> {
            Ok(self
                .entries
                .lock()
                .expect("in-memory store lock poisoned")
                .get(account)
                .cloned())
        }

        fn delete(&self, account: &str) -> Result<(), KeyringError> {
            self.entries
                .lock()
                .expect("in-memory store lock poisoned")
                .remove(account);
            Ok(())
        }
    }

    #[test]
    fn account_uses_instance_namespace() {
        assert_eq!(account_for("abc-123"), "instance:abc-123");
    }

    #[test]
    fn stores_and_reads_a_secret() {
        let store = InMemorySecretStore::default();
        let account = account_for("abc-123");

        store.set(&account, "s3cr3t").unwrap();

        assert_eq!(store.get(&account).unwrap(), Some("s3cr3t".into()));
    }

    #[test]
    fn overwrites_a_secret() {
        let store = InMemorySecretStore::default();
        let account = account_for("abc-123");

        store.set(&account, "old").unwrap();
        store.set(&account, "new").unwrap();

        assert_eq!(store.get(&account).unwrap(), Some("new".into()));
    }

    #[test]
    fn missing_secret_reads_as_none() {
        let store = InMemorySecretStore::default();

        assert_eq!(store.get(&account_for("missing")).unwrap(), None);
    }

    #[test]
    fn delete_removes_the_secret_and_is_idempotent() {
        let store = InMemorySecretStore::default();
        let account = account_for("abc-123");
        store.set(&account, "s3cr3t").unwrap();

        store.delete(&account).unwrap();
        assert_eq!(store.get(&account).unwrap(), None);

        // Deleting a missing entry stays a success.
        store.delete(&account).unwrap();
    }

    #[test]
    fn keyring_store_reports_its_service() {
        assert_eq!(KeyringSecretStore::new().service(), DEFAULT_SERVICE);
        assert_eq!(
            KeyringSecretStore::with_service("custom").service(),
            "custom"
        );
    }
}
