use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TRACE_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn generate_trace_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    let sequence = TRACE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("ent-{}-{:x}", timestamp, sequence)
}

pub fn normalize_or_generate_trace_id(input: Option<String>) -> String {
    if let Some(trace_id) = input {
        let trimmed = trace_id.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    generate_trace_id()
}
