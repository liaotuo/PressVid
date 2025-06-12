// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
use std::path::Path;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::process::Stdio;

#[derive(Debug, Deserialize)]
struct CompressionSettings {
    preset: String,
    resolution: String,
    bitrate: String,
    audio_quality: String,
    custom_settings: bool,
    crf_value: u8,
}

#[derive(Debug, Deserialize, Serialize)] // Added Serialize for settings to be passed from frontend if needed, and for println
struct AudioCompressionSettings {
    quality: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct ImageCompressionSettings {
    quality: u8, // Quality for images, typically 0-100
}

#[derive(Debug, Serialize)]
struct ProgressPayload {
    progress: f32,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn select_video_file(app_handle: tauri::AppHandle) -> Result<String, String> {
    let dialog = app_handle.dialog();
    let file_path = dialog
        .file()
        .add_filter("视频文件", &["mp4", "mov", "avi", "mkv", "wmv", "flv"])
        .pick_file()
        .map_err(|e| e.to_string())?;

    match file_path {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("未选择文件".to_string()),
    }
}

#[tauri::command]
async fn compress_video(
    app_handle: tauri::AppHandle,
    input_path: String,
    output_path: String,
    settings: CompressionSettings,
) -> Result<String, String> {
    // Construct the FFmpeg command
    let mut command = Command::new("ffmpeg");
    command.arg("-i")
        .arg(&input_path)
        .arg("-c:v")
        .arg("libx264")
        .arg("-crf")
        .arg(settings.crf_value.to_string())
        .arg("-c:a")
        .arg("copy")
        .arg(&output_path)
        .arg("-y"); // Automatically overwrite output file

    // Execute the command
    let output = command.output().map_err(|e| format!("Failed to execute FFmpeg command: {}", e))?;

    if output.status.success() {
        Ok(format!("Video compressed successfully. FFmpeg output:\n{}", String::from_utf8_lossy(&output.stdout)))
    } else {
        Err(format!("FFmpeg command failed with error:\n{}\nFFmpeg stderr:\n{}", output.status, String::from_utf8_lossy(&output.stderr)))
    }
}

#[tauri::command]
async fn compress_audio(
    app_handle: tauri::AppHandle,
    input_path: String,
    output_path: String,
    settings: AudioCompressionSettings,
) -> Result<String, String> {
    println!("Attempting to compress audio...");
    println!("App Handle: {:?}", app_handle.package_info().name); // Example of using app_handle
    println!("Input Path: {}", input_path);
    println!("Output Path: {}", output_path);
    println!("Audio Settings: {:?}", settings);

    // Simulate some work
    // In a real scenario, you would call an audio compression library or FFmpeg here

    Ok(format!(
        "Audio processing stub: Successfully processed '{}' to '{}' with quality '{}'",
        input_path, output_path, settings.quality
    ))
}

#[tauri::command]
async fn compress_image(
    app_handle: tauri::AppHandle,
    input_path: String,
    output_path: String,
    settings: ImageCompressionSettings,
) -> Result<String, String> {
    println!("Attempting to compress image...");
    println!("App Handle: {:?}", app_handle.package_info().name);
    println!("Input Path: {}", input_path);
    println!("Output Path: {}", output_path);
    println!("Image Settings: {:?}", settings);

    // Simulate image processing
    Ok(format!(
        "Image processing stub: Successfully processed '{}' to '{}' with quality {}",
        input_path, output_path, settings.quality
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            select_video_file,
            compress_video,
            compress_audio,
            compress_image // Added new command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
