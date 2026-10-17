//! Sort allowlist for saved database connections.

use super::AppDbError;
use crate::pagination::sql::{self, OrderedColumn, SortableColumn};
use crate::pagination::{SortDirection, SortSpec};

/// Columns the frontend may sort `database_instances` by.
const SORT_COLUMNS: &[SortableColumn] = &[
    SortableColumn {
        field: "name",
        expression: "name",
    },
    SortableColumn {
        field: "kind",
        expression: "kind",
    },
    SortableColumn {
        field: "isFavorite",
        expression: "is_favorite",
    },
    SortableColumn {
        field: "createdAt",
        expression: "created_at",
    },
    SortableColumn {
        field: "updatedAt",
        expression: "updated_at",
    },
];

/// Default order: favourites first, then name, then id.
fn default_order() -> Vec<OrderedColumn> {
    vec![
        OrderedColumn {
            expression: "is_favorite",
            direction: SortDirection::Desc,
        },
        OrderedColumn {
            expression: "name",
            direction: SortDirection::Asc,
        },
        OrderedColumn {
            expression: "id",
            direction: SortDirection::Asc,
        },
    ]
}

/// Resolves the requested sort, falling back to [`default_order`].
pub(super) fn resolve(sort: &SortSpec) -> Result<Vec<OrderedColumn>, AppDbError> {
    if sort.is_empty() {
        Ok(default_order())
    } else {
        Ok(sql::resolve_order(sort, SORT_COLUMNS, "id")?)
    }
}
