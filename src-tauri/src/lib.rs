// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct CompressionSettings {
    preset: String,
    resolution: String,
    bitrate: String,
    audio_quality: String,
    custom_settings: bool,
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
) -> Result<(), String> {
    // 这里只是模拟压缩过程，实际应用中需要调用 FFmpeg
    // 在实际应用中，您需要使用 FFmpeg 库或命令行工具来处理视频
    
    let window = app_handle.get_window("main").unwrap();
    
    for i in 0..=100 {
        // 模拟进度
        std::thread::sleep(std::time::Duration::from_millis(50));
        
        // 发送进度更新
        window.emit("compression:progress", ProgressPayload { progress: i as f32 })
            .map_err(|e| e.to_string())?;
    }
    
    // 在实际应用中，这里应该是真正的视频压缩逻辑
    println!("压缩设置: {:?}", settings);
    println!("输入文件: {}", input_path);
    println!("输出文件: {}", output_path);
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            select_video_file,
            compress_video
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
