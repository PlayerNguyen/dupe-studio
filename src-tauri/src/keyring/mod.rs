//! Operating-system credential storage for saved database passwords.
//!
//! dupe-studio never writes secrets to its own SQLite store: a saved
//! connection's `database_instances.secret_ref` points at an entry kept by the
//! OS credential store (Windows Credential Manager, macOS Keychain, or the
//! \*nix Secret Service). This module is the single place that talks to that
//! store, so the rest of the backend depends on [`SecretStore`] and stays
//! testable with an in-memory implementation.
//!
//! # Account convention
//!
//! Credentials are namespaced per resource: an instance password is stored
//! under [`account_for`]`(instance_id)` → `instance:<uuid>`. Store that account
//! string in `secret_ref`; leave it `NULL` for session-only connections that do
//! not remember a password.
//!
//! # Example
//!
//! ```no_run
//! use dupe_studio_lib::keyring::{account_for, KeyringSecretStore, SecretStore};
//!
//! # fn main() -> Result<(), dupe_studio_lib::keyring::KeyringError> {
//! let store = KeyringSecretStore::new();
//! let account = account_for("1b4e28ba-9f4b-4d1e-9a3d-6c2f2f0e7a11");
//! store.set(&account, "hunter2")?;
//! assert_eq!(store.get(&account)?, Some("hunter2".to_string()));
//! store.delete(&account)?;
//! # Ok(())
//! # }
//! ```

mod error;
mod store;

use std::sync::Arc;

pub use error::KeyringError;
#[cfg(test)]
pub(crate) use store::InMemorySecretStore;
pub use store::{DEFAULT_SERVICE, KeyringSecretStore, SecretStore, account_for};

/// Managed Tauri state holding the process-wide secret store.
///
/// Production wires [`KeyringSecretStore`] in `run()`; unit tests can inject an
/// in-memory implementation instead, which keeps `cargo test` hermetic.
#[derive(Clone)]
pub struct SecretStoreState(Arc<dyn SecretStore>);

impl SecretStoreState {
    /// Wraps a credential store for managed state.
    pub fn new(store: Arc<dyn SecretStore>) -> Self {
        Self(store)
    }

    /// Borrows the store for a command.
    pub fn store(&self) -> &dyn SecretStore {
        self.0.as_ref()
    }
}
