//! Helpers that turn pagination inputs into SQL fragments.
//!
//! All SQL expressions come from per-endpoint **allowlists** ([`SortableColumn`]),
//! never from user input, so building the query string cannot inject SQL.

use super::{Cursor, CursorKey, PageDirection, PaginationError, SortDirection, SortSpec};

/// A whitelisted, sortable column for an endpoint.
#[derive(Debug, Clone, Copy)]
pub struct SortableColumn {
    /// Field name accepted from the frontend.
    pub field: &'static str,
    /// Safe SQL expression (column, or `table.column`).
    pub expression: &'static str,
}

/// A resolved sort column: an allowlisted expression plus a direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OrderedColumn {
    /// Safe SQL expression.
    pub expression: &'static str,
    /// Sort direction.
    pub direction: SortDirection,
}

/// Resolves a [`SortSpec`] against an allowlist, appending `tiebreaker`
/// (ascending) so the total order is stable.
///
/// # Errors
///
/// Returns [`PaginationError::UnknownSortField`] when the request asks for a
/// field that is not in `columns`.
pub fn resolve_order(
    sort: &SortSpec,
    columns: &[SortableColumn],
    tiebreaker: &'static str,
) -> Result<Vec<OrderedColumn>, PaginationError> {
    let mut resolved = Vec::with_capacity(sort.fields.len() + 1);

    for field in &sort.fields {
        let column = columns
            .iter()
            .find(|candidate| candidate.field == field.column)
            .ok_or_else(|| PaginationError::UnknownSortField(field.column.clone()))?;
        resolved.push(OrderedColumn {
            expression: column.expression,
            direction: field.direction,
        });
    }

    resolved.push(OrderedColumn {
        expression: tiebreaker,
        direction: SortDirection::Asc,
    });

    Ok(resolved)
}

/// Returns `resolved` with every direction flipped (for backward keyset paging).
pub fn flip_directions(resolved: &[OrderedColumn]) -> Vec<OrderedColumn> {
    resolved
        .iter()
        .map(|column| OrderedColumn {
            expression: column.expression,
            direction: match column.direction {
                SortDirection::Asc => SortDirection::Desc,
                SortDirection::Desc => SortDirection::Asc,
            },
        })
        .collect()
}

/// Renders an `ORDER BY` clause for the resolved columns.
pub fn order_by(resolved: &[OrderedColumn]) -> String {
    let columns = resolved
        .iter()
        .map(|column| format!("{} {}", column.expression, direction_sql(column.direction)))
        .collect::<Vec<_>>()
        .join(", ");
    format!("ORDER BY {columns}")
}

/// Builds a keyset `WHERE` predicate for `cursor`, paging in `direction`.
///
/// Returns the predicate and the bind values in binding order. The predicate is
/// an expanded `(k0 OP v0) OR (k0 = v0 AND k1 OP v1) OR ...` because the sort
/// may mix ascending and descending columns (SQLite row-value comparison only
/// supports a uniform direction).
///
/// # Errors
///
/// Returns [`PaginationError::InvalidCursor`] when the cursor's key count does
/// not match the resolved sort.
pub fn keyset_predicate(
    resolved: &[OrderedColumn],
    cursor: &Cursor,
    direction: PageDirection,
) -> Result<(String, Vec<CursorKey>), PaginationError> {
    if cursor.keys.len() != resolved.len() {
        return Err(PaginationError::InvalidCursor(
            "cursor does not match the requested sort".into(),
        ));
    }

    let mut clauses = Vec::with_capacity(resolved.len());
    let mut binds = Vec::new();

    for index in 0..resolved.len() {
        let mut parts = Vec::with_capacity(index + 1);
        for (previous, column) in resolved.iter().enumerate().take(index) {
            parts.push(format!("{} = ?", column.expression));
            binds.push(cursor.keys[previous].clone());
        }
        let operator = comparison_operator(resolved[index].direction, direction);
        parts.push(format!("{} {operator} ?", resolved[index].expression));
        binds.push(cursor.keys[index].clone());
        clauses.push(format!("({})", parts.join(" AND ")));
    }

    Ok((format!("({})", clauses.join(" OR ")), binds))
}

/// Maps a sort direction and page direction to a comparison operator.
fn comparison_operator(sort: SortDirection, page: PageDirection) -> &'static str {
    match (sort, page) {
        (SortDirection::Asc, PageDirection::Next) | (SortDirection::Desc, PageDirection::Prev) => {
            ">"
        }
        (SortDirection::Asc, PageDirection::Prev) | (SortDirection::Desc, PageDirection::Next) => {
            "<"
        }
    }
}

/// Renders a sort direction as SQL.
fn direction_sql(direction: SortDirection) -> &'static str {
    match direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const COLUMNS: &[SortableColumn] = &[
        SortableColumn {
            field: "name",
            expression: "name",
        },
        SortableColumn {
            field: "createdAt",
            expression: "created_at",
        },
    ];

    #[test]
    fn resolves_and_appends_tiebreaker() {
        let sort = SortSpec {
            fields: vec![super::super::SortField {
                column: "name".into(),
                direction: SortDirection::Desc,
            }],
        };

        let resolved = resolve_order(&sort, COLUMNS, "id").unwrap();
        assert_eq!(resolved.len(), 2);
        assert_eq!(resolved[0].expression, "name");
        assert_eq!(resolved[0].direction, SortDirection::Desc);
        assert_eq!(resolved[1].expression, "id");
        assert_eq!(order_by(&resolved), "ORDER BY name DESC, id ASC");
    }

    #[test]
    fn rejects_unknown_field() {
        let sort = SortSpec {
            fields: vec![super::super::SortField {
                column: "password".into(),
                direction: SortDirection::Asc,
            }],
        };

        assert!(matches!(
            resolve_order(&sort, COLUMNS, "id"),
            Err(PaginationError::UnknownSortField(_))
        ));
    }

    #[test]
    fn builds_mixed_direction_predicate() {
        let resolved = vec![
            OrderedColumn {
                expression: "name",
                direction: SortDirection::Asc,
            },
            OrderedColumn {
                expression: "id",
                direction: SortDirection::Asc,
            },
        ];
        let cursor = Cursor::new("", vec![CursorKey::Text("a".into()), CursorKey::Int(3)]);

        let (sql, binds) = keyset_predicate(&resolved, &cursor, PageDirection::Next).unwrap();
        assert_eq!(sql, "((name > ?) OR (name = ? AND id > ?))");
        assert_eq!(binds.len(), 3);
    }
}
