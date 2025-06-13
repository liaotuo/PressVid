// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// use tauri::Manager; // Add this line
use tauri::Emitter; // Add this line to bring emit into scope
use std::path::Path;
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use tauri_plugin_dialog::DialogExt; // Added DialogExt
// use tauri::Window; // Added for command signatures
use regex::Regex; // Added for video compression progress
use std::io::{BufRead, BufReader}; // Added for reading ffmpeg output
use std::fs; // Add this line for file system operations
// Note: tokio::time::sleep is used directly in the functions where needed.
// If used more broadly, 'use tokio::time::sleep;' could be added here.

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

#[derive(Debug, Serialize, Clone)]
struct ProgressPayload {
    task_id: String,
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
    app_handle: tauri::AppHandle,
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

    // 获取输入文件大小
    let input_metadata = fs::metadata(&input_path)
        .map_err(|e| format!("无法获取输入文件元数据: {}", e))?;
    let original_size = input_metadata.len();
    println!("原始文件大小: {} 字节", original_size);

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
        
        // 只有当用户明确选择了不同于"original"的分辨率时，才改变分辨率
        if settings.resolution != "original" {
            let resolution = match settings.resolution.as_str() {
                "480p" => "854:480",
                "720p" => "1280:720",
                "1080p" => "1920:1080",
                _ => "", // 默认不改变分辨率
            };
            
            if !resolution.is_empty() {
                command.arg("-vf")
                    .arg(format!("scale={}", resolution));
            }
        }
    } else {
        // 使用预设模式，但只改变比特率，不改变分辨率
        match settings.preset.as_str() {
            "small" => {
                command.arg("-crf").arg("28")
                    .arg("-preset").arg("fast");
            },
            "balanced" => {
                command.arg("-crf").arg("23")
                    .arg("-preset").arg("medium");
            },
            "high" => {
                command.arg("-crf").arg("18")
                    .arg("-preset").arg("slow");
            },
            _ => {
                command.arg("-crf").arg("23")
                    .arg("-preset").arg("medium");
            }
        }
        
        // 不再添加 -vf scale 参数，保持原始分辨率
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
    let mut child = command.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("执行FFmpeg命令失败: {}", e))?;

    let stderr = child.stderr.take().ok_or_else(|| "无法捕获 ffmpeg stderr".to_string())?;

    // BufReader and BufRead are now imported at the top
    // Arc was not used and has been removed.

    let reader = BufReader::new(stderr);
    let task_id = input_path.clone(); // Use input_path as a simple task_id

    // Regex to find duration and time
    // Duration: 00:00:20.02, start: 0.000000, bitrate: 1310 kb/s
    // frame=  299 fps= 29 q=-1.0 Lsize=    2627kB time=00:00:09.96 bitrate=2150.7kbits/s speed=0.976x
    let re_duration = regex::Regex::new(r"Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let re_time = regex::Regex::new(r"time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let mut total_duration_secs: Option<f32> = None;

    for line_result in reader.lines() {
        match line_result {
            Ok(line) => {
                println!("FFMPEG_STDERR: {}", line); // Log ffmpeg output for debugging

                if total_duration_secs.is_none() {
                    if let Some(caps) = re_duration.captures(&line) {
                        let hours = caps.get(1).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let minutes = caps.get(2).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let seconds = caps.get(3).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let subsecs = caps.get(4).unwrap().as_str().parse::<f32>().unwrap_or(0.0) / 100.0;
                        total_duration_secs = Some(hours * 3600.0 + minutes * 60.0 + seconds + subsecs);
                        println!("Total duration: {:?} seconds", total_duration_secs);
                    }
                }

                if let Some(duration_secs) = total_duration_secs {
                    if let Some(caps) = re_time.captures(&line) {
                        let hours = caps.get(1).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let minutes = caps.get(2).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let seconds = caps.get(3).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let subsecs = caps.get(4).unwrap().as_str().parse::<f32>().unwrap_or(0.0) / 100.0;
                        let current_time_secs = hours * 3600.0 + minutes * 60.0 + seconds + subsecs;

                        let progress = (current_time_secs / duration_secs) * 100.0;
                        let payload = ProgressPayload {
                            task_id: task_id.clone(),
                            progress: progress.min(100.0), // Cap progress at 100%
                        };
                        app_handle.emit("PROGRESS_EVENT", payload).unwrap_or_else(|e| eprintln!("Failed to emit progress: {}", e));
                    }
                }
            }
            Err(e) => {
                eprintln!("Error reading ffmpeg stderr line: {}", e);
            }
        }
    }

    let output = child.wait_with_output().map_err(|e| format!("等待FFmpeg命令完成失败: {}", e))?;

    if output.status.success() {
        // Ensure 100% progress is sent upon completion
        let payload = ProgressPayload {
            task_id: task_id.clone(),
            progress: 100.0,
        };
        app_handle.emit("PROGRESS_EVENT", payload).unwrap_or_else(|e| eprintln!("Failed to emit final progress: {}", e));

        // 获取输出文件大小
        let output_metadata = fs::metadata(&output_path)
            .map_err(|e| format!("无法获取输出文件元数据: {}", e))?;
        let compressed_size = output_metadata.len();
        println!("压缩后文件大小: {} 字节", compressed_size);

        // 计算压缩比例
        let change_percentage = if original_size > 0 {
            ((compressed_size as f64 - original_size as f64) / original_size as f64) * 100.0
        } else {
            0.0
        };

        let size_change_str = if change_percentage > 0.0 {
            format!("增加了 {:.2}%", change_percentage)
        } else if change_percentage < 0.0 {
            format!("减少了 {:.2}%", -change_percentage)
        } else {
            "保持不变".to_string()
        };
        
        let success_msg = format!(
            "视频压缩成功！输出文件: {} (大小: {} 字节, 相较原始文件{})",
            output_path, compressed_size, size_change_str
        );
        println!("{}", success_msg);
        Ok(success_msg)
    } else {
        let stderr_output = String::from_utf8_lossy(&output.stderr);
        let error_msg = format!("FFmpeg命令执行失败: {}", stderr_output);
        println!("错误: {}", error_msg);
        Err(error_msg)
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
    println!("Input Path: {}", input_path);
    println!("Output Path: {}", output_path);
    println!("Audio Settings: {:?}", settings);

    let task_id = input_path.clone(); // Use input_path as a simple task_id

    // Simulate progress
    for i in 0..=10 {
        let progress = i as f32 * 10.0;
        let payload = ProgressPayload {
            task_id: task_id.clone(),
            progress,
        };
        app_handle.emit("PROGRESS_EVENT", payload.clone()).unwrap_or_else(|e| eprintln!("Failed to emit progress for audio: {}", e));
         println!("Simulated audio progress: {}% for task {}", progress, task_id);
        // Simulate work being done
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await; // tokio::time::sleep is used directly
    }

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
    println!("Input Path: {}", input_path);
    println!("Output Path: {}", output_path);
    println!("Image Settings: {:?}", settings);

    let task_id = input_path.clone(); // Use input_path as a simple task_id

    // Simulate progress
    for i in 0..=10 {
        let progress = i as f32 * 10.0;
        let payload = ProgressPayload {
            task_id: task_id.clone(),
            progress,
        };
        app_handle.emit("PROGRESS_EVENT", payload.clone()).unwrap_or_else(|e| eprintln!("Failed to emit progress for image: {}", e));
         println!("Simulated image progress: {}% for task {}", progress, task_id);
        // Simulate work being done
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await; // tokio::time::sleep is used directly
    }

    Ok(format!(
        "Image processing stub: Successfully processed '{}' to '{}' with quality {}",
        input_path, output_path, settings.quality
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            select_video_file,
            handle_dropped_file,
            compress_video,
            compress_audio,
            compress_image
        ])
        .setup(|_app| {
            // Ensure `regex` crate is available if not already part of the project dependencies.
            // This is a placeholder comment; actual dependency management is in Cargo.toml.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
