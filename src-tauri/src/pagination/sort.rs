//! Sort specification shared by cursor and offset pagination.

use serde::{Deserialize, Serialize};

/// Ascending or descending order for a sort field.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum SortDirection {
    /// Smallest value first.
    Asc,
    /// Largest value first.
    Desc,
}

/// One requested sort column.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SortField {
    /// Frontend-facing field name; resolved against an endpoint allowlist.
    pub column: String,
    /// Order to apply.
    pub direction: SortDirection,
}

/// The frontend-supplied sort, applied to both pagination modes.
///
/// Order is defined by the fields in sequence, then a stable tiebreaker (the
/// primary key) that the repositories append automatically.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SortSpec {
    /// Ordered sort fields. Empty means "use the endpoint default".
    pub fields: Vec<SortField>,
}

impl SortSpec {
    /// Returns `true` when no explicit sort was requested.
    pub fn is_empty(&self) -> bool {
        self.fields.is_empty()
    }

    /// Builds a stable signature for this sort, embedded in cursors so a cursor
    /// created for a different order is rejected instead of returning a wrong
    /// page.
    pub fn fingerprint(&self) -> String {
        self.fields
            .iter()
            .map(|field| {
                let dir = match field.direction {
                    SortDirection::Asc => "asc",
                    SortDirection::Desc => "desc",
                };
                format!("{}:{dir}", field.column)
            })
            .collect::<Vec<_>>()
            .join(",")
    }
}
