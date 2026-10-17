//! Sort allowlist for the audit log.

use super::AppDbError;
use crate::pagination::sql::{self, OrderedColumn, SortableColumn};
use crate::pagination::{SortDirection, SortSpec};

/// Columns the frontend may sort the audit log by.
const SORT_COLUMNS: &[SortableColumn] = &[
    SortableColumn {
        field: "occurredAt",
        expression: "occurred_at",
    },
    SortableColumn {
        field: "category",
        expression: "category",
    },
    SortableColumn {
        field: "action",
        expression: "action",
    },
    SortableColumn {
        field: "status",
        expression: "status",
    },
];

/// Default order: newest first.
fn default_order() -> Vec<OrderedColumn> {
    vec![OrderedColumn {
        expression: "id",
        direction: SortDirection::Desc,
    }]
}

/// Resolves the requested sort, falling back to [`default_order`].
pub(super) fn resolve(sort: &SortSpec) -> Result<Vec<OrderedColumn>, AppDbError> {
    if sort.is_empty() {
        Ok(default_order())
    } else {
        Ok(sql::resolve_order(sort, SORT_COLUMNS, "id")?)
    }
}
