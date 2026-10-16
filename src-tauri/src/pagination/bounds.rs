//! Shared limits applied to every page request.

/// Page size used when the request does not specify one.
pub const DEFAULT_LIMIT: u32 = 20;

/// Hard upper bound for a single page.
pub const MAX_LIMIT: u32 = 200;

/// Clamps a requested page size into `1..=`[`MAX_LIMIT`].
///
/// # Examples
///
/// ```
/// use dupe_studio_lib::pagination::{clamp_limit, MAX_LIMIT};
///
/// assert_eq!(clamp_limit(0), 1);
/// assert_eq!(clamp_limit(10_000), MAX_LIMIT);
/// ```
pub fn clamp_limit(limit: u32) -> u32 {
    limit.clamp(1, MAX_LIMIT)
}

/// Returns the default page size (see [`DEFAULT_LIMIT`]).
pub fn default_limit() -> u32 {
    DEFAULT_LIMIT
}
