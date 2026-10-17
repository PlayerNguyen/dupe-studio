//! Tauri commands, grouped by the storage domain they serve.
//!
//! `lib.rs` only wires these into the Tauri builder. Each module owns the
//! commands for one domain and delegates to the matching service in
//! [`crate::app_db`], which is where the validation, SQL and error mapping
//! live.

pub mod audit;
pub mod database_instances;
