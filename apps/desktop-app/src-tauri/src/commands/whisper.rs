use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const MODEL_NAME: &str = "ggml-small.bin";
const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";
const MODEL_SIZE: u64 = 488_304_832; // ~466MB

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ModelStatus {
    pub is_installed: bool,
    pub model_path: Option<String>,
    pub model_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub progress: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TranscriptionProgress {
    pub progress: f64,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TranscriptionResult {
    pub text: String,
    pub duration_ms: u64,
}

fn get_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(data_dir.join("models"))
}

fn get_model_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_models_dir(app)?.join(MODEL_NAME))
}

#[tauri::command]
#[specta::specta]
pub async fn check_whisper_model(app: AppHandle) -> Result<ModelStatus, String> {
    let model_path = get_model_path(&app)?;

    if model_path.exists() {
        let metadata = std::fs::metadata(&model_path)
            .map_err(|e| format!("Failed to read model metadata: {}", e))?;

        Ok(ModelStatus {
            is_installed: true,
            model_path: Some(model_path.to_string_lossy().to_string()),
            model_size: Some(metadata.len()),
        })
    } else {
        Ok(ModelStatus {
            is_installed: false,
            model_path: None,
            model_size: None,
        })
    }
}

// Global cancel flag for download
static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
#[specta::specta]
pub async fn download_whisper_model(app: AppHandle) -> Result<(), String> {
    use futures_util::StreamExt;

    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);

    let models_dir = get_models_dir(&app)?;
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    let model_path = models_dir.join(MODEL_NAME);
    let temp_path = models_dir.join(format!("{}.tmp", MODEL_NAME));

    // Remove any existing temp file
    let _ = std::fs::remove_file(&temp_path);

    let client = reqwest::Client::new();
    let response = client
        .get(MODEL_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    let total_size = response.content_length().unwrap_or(MODEL_SIZE);

    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
            drop(file);
            let _ = std::fs::remove_file(&temp_path);
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        use std::io::Write;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        let progress = DownloadProgress {
            downloaded,
            total: total_size,
            progress: (downloaded as f64 / total_size as f64) * 100.0,
        };

        let _ = app.emit("whisper-download-progress", progress);
    }

    // Rename temp file to final
    std::fs::rename(&temp_path, &model_path)
        .map_err(|e| format!("Failed to finalize download: {}", e))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn cancel_whisper_download() {
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);
}

#[tauri::command]
#[specta::specta]
pub async fn cleanup_partial_download(app: AppHandle) -> Result<(), String> {
    let models_dir = get_models_dir(&app)?;
    let temp_path = models_dir.join(format!("{}.tmp", MODEL_NAME));

    if temp_path.exists() {
        std::fs::remove_file(&temp_path)
            .map_err(|e| format!("Failed to remove partial download: {}", e))?;
    }

    Ok(())
}

// Supported audio formats
const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "wav", "m4a", "webm"];

#[tauri::command]
#[specta::specta]
pub fn validate_audio_file(file_path: String) -> Result<bool, String> {
    let path = PathBuf::from(&file_path);

    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .ok_or("File has no extension")?;

    if !SUPPORTED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!(
            "Unsupported file format: .{}. Supported formats: {}",
            extension,
            SUPPORTED_EXTENSIONS.join(", ")
        ));
    }

    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    Ok(true)
}

// Global cancel flag for transcription
static TRANSCRIPTION_CANCELLED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
#[specta::specta]
pub fn cancel_transcription() {
    TRANSCRIPTION_CANCELLED.store(true, Ordering::SeqCst);
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SavedRecordingInfo {
    pub file_path: String,
    pub file_size: u64,
}

fn get_recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(data_dir.join("recordings"))
}

#[tauri::command]
#[specta::specta]
pub async fn save_recorded_audio(app: AppHandle, audio_data: Vec<u8>) -> Result<SavedRecordingInfo, String> {
    let recordings_dir = get_recordings_dir(&app)?;
    std::fs::create_dir_all(&recordings_dir)
        .map_err(|e| format!("Failed to create recordings directory: {}", e))?;

    // Generate unique filename with timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_millis();

    let file_name = format!("recording_{}.webm", timestamp);
    let file_path = recordings_dir.join(&file_name);

    // Write audio data to file
    std::fs::write(&file_path, &audio_data)
        .map_err(|e| format!("Failed to save recording: {}", e))?;

    let file_size = audio_data.len() as u64;

    Ok(SavedRecordingInfo {
        file_path: file_path.to_string_lossy().to_string(),
        file_size,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn cleanup_recording(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove recording: {}", e))?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RecordingFile {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub created_at: u64, // Unix timestamp in seconds
}

#[tauri::command]
#[specta::specta]
pub async fn list_recordings(app: AppHandle) -> Result<Vec<RecordingFile>, String> {
    let recordings_dir = get_recordings_dir(&app)?;

    if !recordings_dir.exists() {
        return Ok(Vec::new());
    }

    let mut recordings: Vec<RecordingFile> = Vec::new();

    let entries = std::fs::read_dir(&recordings_dir)
        .map_err(|e| format!("Failed to read recordings directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if SUPPORTED_EXTENSIONS.contains(&ext_str.as_str()) {
                    if let Ok(metadata) = std::fs::metadata(&path) {
                        let created_at = metadata
                            .created()
                            .or_else(|_| metadata.modified())
                            .map(|t| {
                                t.duration_since(std::time::UNIX_EPOCH)
                                    .map(|d| d.as_secs())
                                    .unwrap_or(0)
                            })
                            .unwrap_or(0);

                        recordings.push(RecordingFile {
                            file_path: path.to_string_lossy().to_string(),
                            file_name: path
                                .file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_default(),
                            file_size: metadata.len(),
                            created_at,
                        });
                    }
                }
            }
        }
    }

    // Sort by created_at descending (newest first)
    recordings.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(recordings)
}

fn read_audio_file(file_path: &str) -> Result<Vec<f32>, String> {
    let path = PathBuf::from(file_path);
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .unwrap_or_default();

    // For WAV files, use hound directly
    if extension == "wav" {
        return read_wav_file(file_path);
    }

    // For other formats (mp3, m4a, webm, etc.), convert to WAV using ffmpeg
    let temp_wav = convert_to_wav_with_ffmpeg(file_path)?;
    let samples = read_wav_file(&temp_wav)?;

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_wav);

    Ok(samples)
}

fn read_wav_file(file_path: &str) -> Result<Vec<f32>, String> {
    let reader = hound::WavReader::open(file_path)
        .map_err(|e| format!("WAV 파일 열기 실패: {}", e))?;

    let spec = reader.spec();
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader
            .into_samples::<f32>()
            .filter_map(Result::ok)
            .collect(),
        hound::SampleFormat::Int => {
            let bits = spec.bits_per_sample;
            let max_val = (1 << (bits - 1)) as f32;
            reader
                .into_samples::<i32>()
                .filter_map(Result::ok)
                .map(|s| s as f32 / max_val)
                .collect()
        }
    };

    // Convert to mono if stereo
    let mono_samples = if spec.channels > 1 {
        samples
            .chunks(spec.channels as usize)
            .map(|chunk| chunk.iter().sum::<f32>() / chunk.len() as f32)
            .collect()
    } else {
        samples
    };

    // Resample to 16kHz if needed (Whisper expects 16kHz)
    if spec.sample_rate != 16000 {
        return Ok(resample_audio(&mono_samples, spec.sample_rate, 16000));
    }

    Ok(mono_samples)
}

fn convert_to_wav_with_ffmpeg(input_path: &str) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let output_path = temp_dir.join(format!("whisper_temp_{}.wav", timestamp));
    let output_str = output_path.to_string_lossy().to_string();

    eprintln!("Converting {} to WAV using ffmpeg...", input_path);

    let output = std::process::Command::new("ffmpeg")
        .args([
            "-i",
            input_path,
            "-ar",
            "16000",      // 16kHz sample rate (Whisper requirement)
            "-ac",
            "1",          // Mono
            "-f",
            "wav",
            "-y",         // Overwrite output file
            &output_str,
        ])
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "ffmpeg가 설치되어 있지 않습니다. WebM 파일 변환을 위해 ffmpeg를 설치해주세요.\n\nbrew install ffmpeg".to_string()
            } else {
                format!("ffmpeg 실행 실패: {}", e)
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("ffmpeg stderr: {}", stderr);
        return Err(format!("ffmpeg 변환 실패: {}", stderr));
    }

    eprintln!("Conversion complete: {}", output_str);
    Ok(output_str)
}

fn resample_audio(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    let ratio = from_rate as f32 / to_rate as f32;
    let new_len = (samples.len() as f32 / ratio) as usize;

    (0..new_len)
        .map(|i| {
            let src_idx = i as f32 * ratio;
            let idx = src_idx as usize;
            let frac = src_idx - idx as f32;
            if idx + 1 < samples.len() {
                samples[idx] * (1.0 - frac) + samples[idx + 1] * frac
            } else {
                samples[idx.min(samples.len() - 1)]
            }
        })
        .collect()
}

#[tauri::command]
#[specta::specta]
pub async fn transcribe_audio(app: AppHandle, file_path: String) -> Result<TranscriptionResult, String> {
    TRANSCRIPTION_CANCELLED.store(false, Ordering::SeqCst);

    // Validate file
    validate_audio_file(file_path.clone())?;

    // Check model exists
    let model_status = check_whisper_model(app.clone()).await?;
    if !model_status.is_installed {
        return Err("Whisper model not installed. Please download the model first.".to_string());
    }

    let model_path = model_status.model_path.ok_or("Model path not found")?;

    // Emit initial progress
    let _ = app.emit(
        "whisper-transcription-progress",
        TranscriptionProgress {
            progress: 0.0,
            message: Some("Loading audio file...".to_string()),
        },
    );

    // Read audio file
    let samples = read_audio_file(&file_path).map_err(|e| {
        eprintln!("Audio read error: {}", e);
        format!("오디오 파일 읽기 실패: {}", e)
    })?;

    eprintln!("Audio loaded: {} samples", samples.len());

    if TRANSCRIPTION_CANCELLED.load(Ordering::SeqCst) {
        return Err("Transcription cancelled".to_string());
    }

    // Emit progress
    let _ = app.emit(
        "whisper-transcription-progress",
        TranscriptionProgress {
            progress: 10.0,
            message: Some("Loading Whisper model...".to_string()),
        },
    );

    // Initialize Whisper
    let ctx = WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
        .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

    if TRANSCRIPTION_CANCELLED.load(Ordering::SeqCst) {
        return Err("Transcription cancelled".to_string());
    }

    // Emit progress
    let _ = app.emit(
        "whisper-transcription-progress",
        TranscriptionProgress {
            progress: 20.0,
            message: Some("Transcribing audio...".to_string()),
        },
    );

    // Set up transcription parameters
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("ko")); // Korean
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    // Create state and run transcription
    let mut state = ctx.create_state().map_err(|e| format!("Failed to create state: {}", e))?;

    let start_time = std::time::Instant::now();

    state
        .full(params, &samples)
        .map_err(|e| format!("Transcription failed: {}", e))?;

    if TRANSCRIPTION_CANCELLED.load(Ordering::SeqCst) {
        return Err("Transcription cancelled".to_string());
    }

    // Emit progress
    let _ = app.emit(
        "whisper-transcription-progress",
        TranscriptionProgress {
            progress: 90.0,
            message: Some("Collecting results...".to_string()),
        },
    );

    // Collect results
    let num_segments = state.full_n_segments().map_err(|e| format!("Failed to get segments: {}", e))?;
    let mut full_text = String::new();

    for i in 0..num_segments {
        if let Ok(segment) = state.full_get_segment_text(i) {
            full_text.push_str(&segment);
            full_text.push(' ');
        }
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;

    // Emit completion
    let _ = app.emit(
        "whisper-transcription-progress",
        TranscriptionProgress {
            progress: 100.0,
            message: Some("Transcription complete".to_string()),
        },
    );

    Ok(TranscriptionResult {
        text: full_text.trim().to_string(),
        duration_ms,
    })
}

// ============================================================================
// Real-time Transcription
// ============================================================================

/// Circular buffer for audio samples
struct CircularBuffer {
    data: Vec<f32>,
    write_pos: usize,
    capacity: usize,
}

impl CircularBuffer {
    fn new(capacity: usize) -> Self {
        Self {
            data: vec![0.0; capacity],
            write_pos: 0,
            capacity,
        }
    }

    fn push_samples(&mut self, samples: &[f32]) {
        for &sample in samples {
            self.data[self.write_pos] = sample;
            self.write_pos = (self.write_pos + 1) % self.capacity;
        }
    }

    fn get_last_n_samples(&self, n: usize) -> Vec<f32> {
        let n = n.min(self.capacity);
        let mut result = Vec::with_capacity(n);

        let start = if self.write_pos >= n {
            self.write_pos - n
        } else {
            self.capacity - (n - self.write_pos)
        };

        for i in 0..n {
            result.push(self.data[(start + i) % self.capacity]);
        }

        result
    }

    fn clear(&mut self) {
        self.data.fill(0.0);
        self.write_pos = 0;
    }
}

/// Real-time transcription session state
struct RealtimeSession {
    ctx: WhisperContext,
    audio_buffer: CircularBuffer,
    accumulated_text: String,
    last_processed_pos: usize,
    sample_count: usize,
}

/// Global state for real-time transcription
static REALTIME_SESSION: Mutex<Option<RealtimeSession>> = Mutex::new(None);
static REALTIME_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Real-time transcription configuration
const SAMPLE_RATE: u32 = 16000;
const CHUNK_DURATION_SECS: f32 = 3.0; // Process 3 seconds of audio
const OVERLAP_DURATION_SECS: f32 = 1.0; // 1 second overlap
const BUFFER_DURATION_SECS: f32 = 30.0; // 30 second circular buffer

const CHUNK_SAMPLES: usize = (SAMPLE_RATE as f32 * CHUNK_DURATION_SECS) as usize;
const OVERLAP_SAMPLES: usize = (SAMPLE_RATE as f32 * OVERLAP_DURATION_SECS) as usize;
const BUFFER_SAMPLES: usize = (SAMPLE_RATE as f32 * BUFFER_DURATION_SECS) as usize;

// Minimum samples needed before processing (approx 2 seconds)
const MIN_SAMPLES_FOR_PROCESSING: usize = (SAMPLE_RATE as f32 * 2.0) as usize;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RealtimeTranscriptionConfig {
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RealtimePartialResult {
    pub text: String,
    pub is_final: bool,
    pub segment_index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RealtimeStatus {
    pub status: String,
    pub message: Option<String>,
}

/// Calculate audio energy (RMS) for VAD
fn calculate_energy(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
    (sum_squares / samples.len() as f32).sqrt()
}

/// Simple Voice Activity Detection based on energy threshold
fn has_voice_activity(samples: &[f32], threshold: f32) -> bool {
    calculate_energy(samples) > threshold
}

#[tauri::command]
#[specta::specta]
pub async fn start_realtime_transcription(
    app: AppHandle,
    config: Option<RealtimeTranscriptionConfig>,
) -> Result<(), String> {
    // Check if already active
    if REALTIME_ACTIVE.load(Ordering::SeqCst) {
        return Err("Real-time transcription is already active".to_string());
    }

    // Check model exists
    let model_status = check_whisper_model(app.clone()).await?;
    if !model_status.is_installed {
        return Err("Whisper model not installed. Please download the model first.".to_string());
    }

    let model_path = model_status.model_path.ok_or("Model path not found")?;

    // Emit status
    let _ = app.emit(
        "realtime-transcription-status",
        RealtimeStatus {
            status: "initializing".to_string(),
            message: Some("Loading Whisper model...".to_string()),
        },
    );

    // Initialize Whisper context
    let ctx = WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
        .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

    // Create session
    let session = RealtimeSession {
        ctx,
        audio_buffer: CircularBuffer::new(BUFFER_SAMPLES),
        accumulated_text: String::new(),
        last_processed_pos: 0,
        sample_count: 0,
    };

    // Store session
    {
        let mut session_guard = REALTIME_SESSION
            .lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        *session_guard = Some(session);
    }

    REALTIME_ACTIVE.store(true, Ordering::SeqCst);

    // Emit ready status
    let _ = app.emit(
        "realtime-transcription-status",
        RealtimeStatus {
            status: "ready".to_string(),
            message: Some("Real-time transcription ready".to_string()),
        },
    );

    let _config = config; // Reserved for future use (language setting, etc.)

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn push_audio_chunk(
    app: AppHandle,
    samples: Vec<f32>,
) -> Result<Option<RealtimePartialResult>, String> {
    if !REALTIME_ACTIVE.load(Ordering::SeqCst) {
        return Err("Real-time transcription is not active".to_string());
    }

    let mut session_guard = REALTIME_SESSION
        .lock()
        .map_err(|e| format!("Failed to lock session: {}", e))?;

    let session = session_guard
        .as_mut()
        .ok_or("Session not initialized")?;

    // Add samples to buffer
    session.audio_buffer.push_samples(&samples);
    session.sample_count += samples.len();

    // Check if we have enough samples to process
    let samples_since_last = session.sample_count - session.last_processed_pos;

    if samples_since_last < MIN_SAMPLES_FOR_PROCESSING {
        return Ok(None);
    }

    // Get audio chunk for processing (with overlap)
    let chunk_size = CHUNK_SAMPLES;
    let audio_chunk = session.audio_buffer.get_last_n_samples(chunk_size);

    // Simple VAD check - skip if too quiet
    const VAD_THRESHOLD: f32 = 0.01;
    if !has_voice_activity(&audio_chunk, VAD_THRESHOLD) {
        session.last_processed_pos = session.sample_count;
        return Ok(None);
    }

    // Create Whisper state and run inference
    let mut state = session
        .ctx
        .create_state()
        .map_err(|e| format!("Failed to create state: {}", e))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("ko")); // Korean
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_single_segment(true); // Single segment for real-time

    // Run transcription
    if let Err(e) = state.full(params, &audio_chunk) {
        eprintln!("Transcription error: {}", e);
        return Ok(None);
    }

    // Get result
    let num_segments = state
        .full_n_segments()
        .map_err(|e| format!("Failed to get segments: {}", e))?;

    let mut segment_text = String::new();
    for i in 0..num_segments {
        if let Ok(text) = state.full_get_segment_text(i) {
            segment_text.push_str(&text);
        }
    }

    let segment_text = segment_text.trim().to_string();

    if segment_text.is_empty() {
        session.last_processed_pos = session.sample_count;
        return Ok(None);
    }

    // Update accumulated text (simple append, could be improved with deduplication)
    if !session.accumulated_text.is_empty() {
        session.accumulated_text.push(' ');
    }
    session.accumulated_text.push_str(&segment_text);

    session.last_processed_pos = session.sample_count;

    let result = RealtimePartialResult {
        text: segment_text,
        is_final: false,
        segment_index: (session.sample_count / CHUNK_SAMPLES) as u32,
    };

    // Emit partial result
    let _ = app.emit("realtime-transcription-partial", result.clone());

    Ok(Some(result))
}

#[tauri::command]
#[specta::specta]
pub async fn stop_realtime_transcription(app: AppHandle) -> Result<String, String> {
    if !REALTIME_ACTIVE.load(Ordering::SeqCst) {
        return Err("Real-time transcription is not active".to_string());
    }

    // Get final text before cleanup
    let final_text = {
        let session_guard = REALTIME_SESSION
            .lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;

        session_guard
            .as_ref()
            .map(|s| s.accumulated_text.clone())
            .unwrap_or_default()
    };

    // Cleanup
    {
        let mut session_guard = REALTIME_SESSION
            .lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        *session_guard = None;
    }

    REALTIME_ACTIVE.store(false, Ordering::SeqCst);

    // Emit stopped status
    let _ = app.emit(
        "realtime-transcription-status",
        RealtimeStatus {
            status: "stopped".to_string(),
            message: Some("Real-time transcription stopped".to_string()),
        },
    );

    // Emit final result
    let _ = app.emit(
        "realtime-transcription-partial",
        RealtimePartialResult {
            text: final_text.clone(),
            is_final: true,
            segment_index: 0,
        },
    );

    Ok(final_text)
}

#[tauri::command]
#[specta::specta]
pub fn is_realtime_transcription_active() -> bool {
    REALTIME_ACTIVE.load(Ordering::SeqCst)
}
