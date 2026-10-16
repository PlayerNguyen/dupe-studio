//! Cursor (keyset) pagination input and the opaque cursor token.

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};

use super::PaginationError;
use super::bounds::{clamp_limit, default_limit};

/// Version tag embedded in every cursor so the format can evolve.
const CURSOR_VERSION: u8 = 1;

/// Which way a cursor page is walking the ordered result set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum PageDirection {
    /// Forward, towards the end of the result set.
    #[default]
    Next,
    /// Backward, towards the start of the result set.
    Prev,
}

/// Cursor request as sent by the frontend.
///
/// `cursor` is opaque; pass back the `nextCursor`/`prevCursor` from a previous
/// page. `direction` selects forward or backward paging.
#[derive(Debug, Clone, Deserialize, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CursorPagination {
    /// Opaque cursor from a previous page, or `None` for the first page.
    #[serde(default)]
    pub cursor: Option<String>,
    /// Direction to page in. Defaults to [`PageDirection::Next`].
    #[serde(default)]
    pub direction: PageDirection,
    /// Requested page size (clamped in `limit()`).
    #[serde(default = "default_limit")]
    pub limit: u32,
}

impl CursorPagination {
    /// Returns the effective page size, clamped into the allowed range.
    pub fn effective_limit(&self) -> u32 {
        clamp_limit(self.limit)
    }
}

/// One value in a cursor: the sort key of the boundary row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CursorKey {
    /// Integer key.
    Int(i64),
    /// Text key.
    Text(String),
    /// Boolean key (stored as 0/1 in SQLite).
    Bool(bool),
}

/// Wire form of a cursor payload.
#[derive(Debug, Clone, Deserialize, Serialize)]
struct CursorPayload {
    v: u8,
    fingerprint: String,
    keys: Vec<CursorKey>,
}

/// A decoded cursor: the sort fingerprint plus the boundary row's sort keys.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cursor {
    /// Fingerprint of the sort this cursor belongs to.
    pub fingerprint: String,
    /// Sort key values, in sort order (including the tiebreaker).
    pub keys: Vec<CursorKey>,
}

impl Cursor {
    /// Creates a cursor from its sort fingerprint and key values.
    pub fn new(fingerprint: impl Into<String>, keys: Vec<CursorKey>) -> Self {
        Self {
            fingerprint: fingerprint.into(),
            keys,
        }
    }

    /// Encodes the cursor into an opaque, URL-safe token.
    ///
    /// # Errors
    ///
    /// Returns [`PaginationError::InvalidCursor`] if serialization fails.
    pub fn encode(&self) -> Result<String, PaginationError> {
        let payload = CursorPayload {
            v: CURSOR_VERSION,
            fingerprint: self.fingerprint.clone(),
            keys: self.keys.clone(),
        };
        let json = serde_json::to_vec(&payload)
            .map_err(|err| PaginationError::InvalidCursor(err.to_string()))?;
        Ok(URL_SAFE_NO_PAD.encode(json))
    }

    /// Decodes a token produced by [`Cursor::encode`].
    ///
    /// # Errors
    ///
    /// Returns [`PaginationError::InvalidCursor`] when the token is not valid
    /// base64, not valid JSON, or uses an unsupported version.
    pub fn decode(token: &str) -> Result<Self, PaginationError> {
        let bytes = URL_SAFE_NO_PAD
            .decode(token)
            .map_err(|err| PaginationError::InvalidCursor(err.to_string()))?;
        let payload: CursorPayload = serde_json::from_slice(&bytes)
            .map_err(|err| PaginationError::InvalidCursor(err.to_string()))?;

        if payload.v != CURSOR_VERSION {
            return Err(PaginationError::InvalidCursor(format!(
                "unsupported cursor version {}",
                payload.v
            )));
        }

        Ok(Self {
            fingerprint: payload.fingerprint,
            keys: payload.keys,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursor_round_trips() {
        let cursor = Cursor::new(
            "name:asc,id:asc",
            vec![CursorKey::Text("a".into()), CursorKey::Int(7)],
        );
        let token = cursor.encode().unwrap();
        let decoded = Cursor::decode(&token).unwrap();
        assert_eq!(decoded, cursor);
    }

    #[test]
    fn rejects_garbage_cursor() {
        assert!(matches!(
            Cursor::decode("not-a-cursor"),
            Err(PaginationError::InvalidCursor(_))
        ));
    }
}
