//! Errors returned by the operating system credential store.
//!
//! The variants stay high level on purpose: callers only need to know whether
//! the store was unavailable, a read failed, or a write/delete failed. The
//! underlying [`keyring`](https://docs.rs/keyring/latest/keyring/) error is
//! kept as the source for diagnostics.

use thiserror::Error;

/// Failures while reading or writing credentials in the OS keychain.
///
/// Commands never return the platform error to the frontend; they map the
/// variant through [`KeyringError::i18n_key`] and the frontend translates it.
#[derive(Debug, Error)]
pub enum KeyringError {
    /// The platform store could not be initialized: it is missing, locked, or
    /// the runtime platform has no supported store.
    #[error("credential store unavailable: {0}")]
    Unavailable(#[source] ::keyring::v1::Error),

    /// Reading an entry failed for a reason other than "not found".
    ///
    /// A missing entry is not an error: [`SecretStore::get`] returns `Ok(None)`
    /// for it. See [`SecretStore`](super::SecretStore).
    #[error("could not read credential `{account}`: {source}")]
    Read {
        /// Account key that was read.
        account: String,
        /// Platform error that caused the failure.
        #[source]
        source: ::keyring::v1::Error,
    },

    /// Writing or deleting an entry failed.
    #[error("could not write credential `{account}`: {source}")]
    Write {
        /// Account key that was written or deleted.
        account: String,
        /// Platform error that caused the failure.
        #[source]
        source: ::keyring::v1::Error,
    },
}

impl KeyringError {
    /// Returns the stable i18n key the frontend translates for this error.
    ///
    /// Backend responses never carry user-facing prose: the frontend resolves
    /// the key with `translateErrorKey`, falling back to `errors.unknown` for a
    /// key it does not know. Keep the keys in `errors.storage.*`.
    ///
    /// # Examples
    ///
    /// ```
    /// use dupe_studio_lib::keyring::KeyringError;
    ///
    /// let unavailable = KeyringError::Unavailable(::keyring::v1::Error::NoDefaultStore);
    /// assert_eq!(
    ///     unavailable.i18n_key(),
    ///     "errors.storage.secretStoreUnavailable"
    /// );
    /// ```
    pub fn i18n_key(&self) -> &'static str {
        match self {
            Self::Unavailable(_) | Self::Read { .. } => "errors.storage.secretStoreUnavailable",
            Self::Write { .. } => "errors.storage.secretWriteFailed",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_variants_to_storage_keys() {
        let unavailable = KeyringError::Unavailable(::keyring::v1::Error::NoDefaultStore);
        assert_eq!(
            unavailable.i18n_key(),
            "errors.storage.secretStoreUnavailable"
        );

        let read = KeyringError::Read {
            account: "instance:1".into(),
            source: ::keyring::v1::Error::NoEntry,
        };
        assert_eq!(read.i18n_key(), "errors.storage.secretStoreUnavailable");

        let write = KeyringError::Write {
            account: "instance:1".into(),
            source: ::keyring::v1::Error::NoEntry,
        };
        assert_eq!(write.i18n_key(), "errors.storage.secretWriteFailed");
    }
}
