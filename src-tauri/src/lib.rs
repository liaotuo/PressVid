// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// use tauri::Manager; // Commented out or remove if not used elsewhere
use std::path::Path;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::process::Stdio;
use tauri_plugin_dialog::DialogExt; // Added DialogExt

#[derive(Debug, Deserialize)]
struct CompressionSettings {
    preset: String,
    resolution: String,
    bitrate: String,
    audioQuality: String,
    customSettings: bool,
    crfValue: u8,
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
async fn select_video_file(app: tauri::AppHandle) -> Result<String, String> {
    println!("调用select_video_file命令");
    
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("视频文件", &["mp4", "mov", "avi", "mkv", "wmv", "flv"])
        .pick_file(move |file_path_option| {
            tx.send(file_path_option).unwrap_or_else(|e| eprintln!("Failed to send file_path_option: {}",e));
        });

    // Note: .recv() is blocking. For a truly async command, you might use tokio::sync::oneshot
    // or ensure this command is running in a way that blocking is acceptable (Tauri often handles this).
    match rx.recv() {
        Ok(Some(file_path_enum)) => {
            let path_str = match file_path_enum {
                tauri_plugin_dialog::FilePath::Path(pb) => pb.to_string_lossy().into_owned(),
                tauri_plugin_dialog::FilePath::Url(uri_str) => uri_str.to_string(),
            };
            println!("选择的文件路径: {}", path_str);
            Ok(path_str)
        },
        Ok(None) => {
            println!("用户取消了文件选择");
            Err("未选择文件".to_string())
        }
        Err(e) => {
            eprintln!("Failed to receive file path from channel: {}", e);
            Err("文件选择时发生内部错误".to_string())
        }
    }
}

#[tauri::command]
async fn handle_dropped_file(file_path: String) -> Result<String, String> {
    println!("处理拖放文件: {}", file_path);
    
    // 检查文件是否存在
    if !Path::new(&file_path).exists() {
        return Err(format!("文件不存在: {}", file_path));
    }
    
    // 返回文件路径
    Ok(file_path)
}

#[tauri::command]
async fn compress_video(
    input_path: String,
    output_path: String,
    settings: CompressionSettings,
) -> Result<String, String> {
    println!("开始压缩视频");
    println!("输入路径: {}", input_path);
    println!("输出路径: {}", output_path);
    println!("压缩设置: {:?}", settings);

    // 检查输入文件是否存在
    if !Path::new(&input_path).exists() {
        let error_msg = format!("输入文件不存在: {}", input_path);
        println!("错误: {}", error_msg);
        return Err(error_msg);
    }

    // 检查ffmpeg是否可用
    let ffmpeg_check = Command::new("ffmpeg")
        .arg("-version")
        .output();

    if let Err(e) = ffmpeg_check {
        let error_msg = format!("无法找到ffmpeg: {}", e);
        println!("错误: {}", error_msg);
        return Err(error_msg);
    }

    // 构建FFmpeg命令
    let mut command = Command::new("ffmpeg");
    command.arg("-i")
        .arg(&input_path)
        .arg("-c:v")
        .arg("libx264");
    
    // 根据设置选择编码模式
    if settings.customSettings {
        // 使用CRF模式
        command.arg("-crf")
            .arg(settings.crfValue.to_string());
        
        // 如果不是保持原始分辨率，则设置分辨率
        if settings.resolution != "original" {
            let resolution = match settings.resolution.as_str() {
                "480p" => "854:480",
                "720p" => "1280:720",
                "1080p" => "1920:1080",
                _ => "1280:720", // 默认720p
            };
            command.arg("-vf")
                .arg(format!("scale={}", resolution));
        }
    } else {
        // 使用预设模式
        match settings.preset.as_str() {
            "small" => {
                command.arg("-crf").arg("28")
                    .arg("-preset").arg("fast")
                    .arg("-vf").arg("scale=854:480");
            },
            "balanced" => {
                command.arg("-crf").arg("23")
                    .arg("-preset").arg("medium")
                    .arg("-vf").arg("scale=1280:720");
            },
            "high" => {
                command.arg("-crf").arg("18")
                    .arg("-preset").arg("slow")
                    .arg("-vf").arg("scale=1920:1080");
            },
            _ => {
                command.arg("-crf").arg("23")
                    .arg("-preset").arg("medium")
                    .arg("-vf").arg("scale=1280:720");
            }
        }
    }

    // 设置音频编码
    let audio_bitrate = match settings.audioQuality.as_str() {
        "low" => "96k",
        "medium" => "128k",
        "high" => "192k",
        _ => "128k", // 默认中等质量
    };
    command.arg("-c:a").arg("aac")
        .arg("-b:a").arg(audio_bitrate);

    // 添加输出文件路径和覆盖选项
    command.arg("-y") // 自动覆盖输出文件
        .arg(&output_path);

    println!("执行FFmpeg命令: {:?}", command);

    // 执行命令
    let output = match command.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output() {
            Ok(output) => output,
            Err(e) => {
                let error_msg = format!("执行FFmpeg命令失败: {}", e);
                println!("错误: {}", error_msg);
                return Err(error_msg);
            }
        };

    if output.status.success() {
        let success_msg = format!("视频压缩成功！输出文件: {}", output_path);
        println!("{}", success_msg);
        Ok(success_msg)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let error_msg = format!("FFmpeg命令执行失败: {}", stderr);
        println!("错误: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
async fn compress_audio(
    input_path: String,
    output_path: String,
    settings: AudioCompressionSettings,
) -> Result<String, String> {
    println!("Attempting to compress audio...");
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
    input_path: String,
    output_path: String,
    settings: ImageCompressionSettings,
) -> Result<String, String> {
    println!("Attempting to compress image...");
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
            greet,
            select_video_file,
            handle_dropped_file,
            compress_video,
            compress_audio,
            compress_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
