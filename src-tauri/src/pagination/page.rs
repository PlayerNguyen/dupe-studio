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
    /// transaction as `items`, so the two always agree.
    ///
    /// `has_more` is derived from the inputs:
    /// `total > offset + items.len()` — that is, the window did not reach the
    /// last row.
    ///
    /// # Examples
    ///
    /// ```
    /// use dupe_studio_lib::pagination::Page;
    ///
    /// // Two of five rows, starting at the first one.
    /// let page = Page::offset(vec!["a", "b"], 2, 0, 5);
    ///
    /// assert_eq!(page.items, vec!["a", "b"]);
    /// assert_eq!(page.page_info.limit, 2);
    /// assert_eq!(page.page_info.offset, Some(0));
    /// assert_eq!(page.page_info.total, Some(5));
    /// assert!(page.page_info.has_more);
    ///
    /// // The last row: nothing follows.
    /// let last = Page::offset(vec!["e"], 2, 4, 5);
    /// assert!(!last.page_info.has_more);
    /// ```
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
    ///
    /// `items` are always in **natural** sort order, even when the caller paged
    /// backwards, so the consumer never has to re-order a page.
    ///
    /// * `limit` — effective page size that was applied.
    /// * `has_more` — whether another row exists in the direction that was
    ///   requested. It says nothing about the opposite direction; that is what
    ///   `prev_cursor` / `next_cursor` are for.
    /// * `next_cursor` — token for the following page, or `None` when this page
    ///   reaches the end of the result set in the forward direction.
    /// * `prev_cursor` — token for the preceding page. Repositories pass `None`
    ///   on the first page and `Some` for every later page.
    ///
    /// # Examples
    ///
    /// ```
    /// use dupe_studio_lib::pagination::Page;
    ///
    /// // A full page with a following page and no predecessor.
    /// let page = Page::cursor(vec![9, 8], 2, true, Some("next-token".into()), None);
    ///
    /// assert_eq!(page.page_info.limit, 2);
    /// assert_eq!(page.page_info.next_cursor.as_deref(), Some("next-token"));
    /// assert!(page.page_info.prev_cursor.is_none());
    ///
    /// // The last page: no cursor to move forward with.
    /// let last = Page::cursor(vec![1], 2, false, None, Some("prev-token".into()));
    /// assert!(!last.page_info.has_more);
    /// assert!(last.page_info.next_cursor.is_none());
    /// ```
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
