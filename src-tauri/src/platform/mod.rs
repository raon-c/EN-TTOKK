pub mod error;
pub mod trace;

pub use error::{AppError, AppResult};
pub use trace::normalize_or_generate_trace_id;
