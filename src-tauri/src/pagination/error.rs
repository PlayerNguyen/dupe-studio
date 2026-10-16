//! Errors raised by the pagination primitives.

use thiserror::Error;

/// Everything that can go wrong turning a page request into a query.
#[derive(Debug, Error)]
pub enum PaginationError {
    /// The opaque cursor could not be decoded, or does not match the requested
    /// sort order.
    #[error("invalid pagination cursor: {0}")]
    InvalidCursor(String),

    /// A `sort` field was requested that the endpoint does not allow.
    #[error("unknown sort field `{0}`")]
    UnknownSortField(String),
}
