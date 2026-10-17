//! Shared limits applied to every page request.

/// Page size used when the request does not specify one.
pub const PAGINATION_DEFAULT_LIMIT: u32 = 20;

/// Hard upper bound for a single page.
pub const PAGINATION_MAX_LIMIT: u32 = 200;

/// Clamps a requested page size into `1..=`[`PAGINATION_MAX_LIMIT`].
///
/// # Examples
///
/// ```
/// use dupe_studio_lib::pagination::{clamp_limit, PAGINATION_MAX_LIMIT};
///
/// assert_eq!(clamp_limit(0), 1);
/// assert_eq!(clamp_limit(10_000), PAGINATION_MAX_LIMIT);
/// ```
pub fn clamp_limit(limit: u32) -> u32 {
    limit.clamp(1, PAGINATION_MAX_LIMIT)
}

/// Returns the default page size (see [`PAGINATION_DEFAULT_LIMIT`]).
pub fn default_limit() -> u32 {
    PAGINATION_DEFAULT_LIMIT
}
