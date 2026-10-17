//! Limit/offset pagination input.

use serde::{Deserialize, Serialize};

use super::bounds::{PAGINATION_DEFAULT_LIMIT, clamp_limit};

/// Offset request as sent by the frontend.
///
/// Always paired with a `total` count in the response (see
/// [`PageInfo`](super::PageInfo)).
#[derive(Debug, Clone, Deserialize, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct OffsetPagination {
    /// Number of rows to skip. Defaults to `0`.
    #[serde(default)]
    pub offset: u64,
    /// Requested page size (clamped in `effective_limit()`).
    #[serde(default = "super::bounds::default_limit")]
    pub limit: u32,
}

impl Default for OffsetPagination {
    fn default() -> Self {
        Self {
            offset: 0,
            limit: PAGINATION_DEFAULT_LIMIT,
        }
    }
}

impl OffsetPagination {
    /// Returns the effective page size, clamped into the allowed range.
    pub fn effective_limit(&self) -> u32 {
        clamp_limit(self.limit)
    }
}
