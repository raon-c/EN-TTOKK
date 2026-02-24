use serde::Serialize;

#[derive(Debug, Serialize, specta::Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
    pub trace_id: String,
    pub source: String,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn new(
        code: impl Into<String>,
        message: impl Into<String>,
        retryable: bool,
        trace_id: impl Into<String>,
        source: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retryable,
            trace_id: trace_id.into(),
            source: source.into(),
        }
    }

    pub fn internal(
        message: impl Into<String>,
        trace_id: impl Into<String>,
        source: impl Into<String>,
    ) -> Self {
        Self::new("internal_error", message, false, trace_id, source)
    }
}
