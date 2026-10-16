//! Paginated response envelope returned to the frontend.

use serde::Serialize;

/// Metadata describing a returned page.
///
/// Fields not relevant to the active pagination mode are omitted from the JSON
/// (`null` is never sent).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PageInfo {
    /// Effective page size that was applied.
    pub limit: u32,
    /// Whether more rows exist beyond this page (in the request's direction).
    pub has_more: bool,
    /// Cursor for the next page, in cursor mode.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    /// Cursor for the previous page, in cursor mode.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prev_cursor: Option<String>,
    /// Echoed offset, in offset mode.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<u64>,
    /// Total row count, in offset mode.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
}

/// A page of results plus its [`PageInfo`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Page<T> {
    /// Rows for this page.
    pub items: Vec<T>,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

impl<T> Page<T> {
    /// Builds a limit/offset page.
    ///
    /// `total` is the row count for the same filters, captured in the same
    /// transaction as `items`.
    pub fn offset(items: Vec<T>, limit: u32, offset: u64, total: u64) -> Self {
        let has_more = total > offset + items.len() as u64;
        Self {
            items,
            page_info: PageInfo {
                limit,
                has_more,
                next_cursor: None,
                prev_cursor: None,
                offset: Some(offset),
                total: Some(total),
            },
        }
    }

    /// Builds a cursor page.
    pub fn cursor(
        items: Vec<T>,
        limit: u32,
        has_more: bool,
        next_cursor: Option<String>,
        prev_cursor: Option<String>,
    ) -> Self {
        Self {
            items,
            page_info: PageInfo {
                limit,
                has_more,
                next_cursor,
                prev_cursor,
                offset: None,
                total: None,
            },
        }
    }
}
