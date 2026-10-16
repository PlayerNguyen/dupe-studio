//! Reusable pagination primitives.
//!
//! The module supports two modes and is independent of any storage engine so it
//! can be reused by the application store today and by DBMS query results
//! later:
//!
//! * **Cursor (keyset)** — [`CursorPagination`] in, [`Page`] out. Stable and
//!   cheap on large, append-only tables (audit log). Bidirectional via
//!   `nextCursor` / `prevCursor`.
//! * **Limit/offset** — [`OffsetPagination`] in, [`Page`] out. Always reports
//!   `total`, captured in the same transaction as the rows.
//!
//! Both modes take a frontend-supplied [`SortSpec`]; repositories resolve it
//! against an allowlist (see [`sql`]), so sort field names can never inject SQL.
//!
//! # Examples
//!
//! ```no_run
//! use dupe_studio_lib::pagination::{CursorPagination, PageDirection, SortSpec};
//!
//! let request = CursorPagination {
//!     cursor: None,
//!     direction: PageDirection::Next,
//!     limit: 20,
//! };
//! let _sort = SortSpec::default();
//! # let _ = request;
//! ```

mod bounds;
mod cursor;
mod error;
mod offset;
mod page;
mod sort;
pub mod sql;

pub use bounds::{DEFAULT_LIMIT, MAX_LIMIT, clamp_limit, default_limit};
pub use cursor::{Cursor, CursorKey, CursorPagination, PageDirection};
pub use error::PaginationError;
pub use offset::OffsetPagination;
pub use page::{Page, PageInfo};
pub use sort::{SortDirection, SortField, SortSpec};

/// Read-side view of a cursor page request.
///
/// Repositories accept `impl CursorPageQuery` so callers can pass
/// [`CursorPagination`] directly, or a composite request struct that adds
/// filters and delegates these three accessors (the Rust equivalent of
/// "extending" the default pagination input).
pub trait CursorPageQuery {
    /// The opaque cursor, or `None` for the first page.
    fn cursor(&self) -> Option<&str>;
    /// Direction to page in.
    fn direction(&self) -> PageDirection;
    /// Effective (clamped) page size.
    fn limit(&self) -> u32;
}

impl CursorPageQuery for CursorPagination {
    fn cursor(&self) -> Option<&str> {
        self.cursor.as_deref()
    }

    fn direction(&self) -> PageDirection {
        self.direction
    }

    fn limit(&self) -> u32 {
        self.effective_limit()
    }
}

/// Read-side view of an offset page request.
///
/// See [`CursorPageQuery`] for the extension pattern.
pub trait OffsetPageQuery {
    /// Number of rows to skip.
    fn offset(&self) -> u64;
    /// Effective (clamped) page size.
    fn limit(&self) -> u32;
}

impl OffsetPageQuery for OffsetPagination {
    fn offset(&self) -> u64 {
        self.offset
    }

    fn limit(&self) -> u32 {
        self.effective_limit()
    }
}
