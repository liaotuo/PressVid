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
    preset: String, // e.g., "small", "balanced", "high", "vbr_default", "cbr_default", etc.
    #[serde(rename = "presetType")] // Matches the TypeScript naming
    preset_type: String, // "quality", "vbr", "cbr", "scale", "targetSize"
    resolution: String, // e.g., "480p", "720p", "1080p", "original"
    bitrate: String, // Original bitrate field, might be used as fallback or for non-CRF custom if any
    #[serde(rename = "audioQuality")]
    audio_quality: String,
    #[serde(rename = "customSettings")]
    custom_settings: bool,
    #[serde(rename = "crfValue")]
    crf_value: u8,
    #[serde(rename = "targetBitrate")]
    target_bitrate: Option<String>, // For CBR
    #[serde(rename = "scalePercentage")]
    scale_percentage: Option<String>, // For Scale
    #[serde(rename = "targetSizeMB")]
    target_size_mb: Option<String>, // For Target Size (String to parse later, allows flexibility)
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
    command.arg("-i").arg(&input_path);

    // --- Video Settings ---
    command.arg("-c:v").arg("libx264");

    // Resolution base settings
    let mut scale_filter: Option<String> = None;
    if settings.resolution != "original" && !settings.custom_settings { // Apply preset resolution if not custom and not original
        match settings.resolution.as_str() {
            "480p" => scale_filter = Some("scale=854:480".to_string()),
            "720p" => scale_filter = Some("scale=1280:720".to_string()),
            "1080p" => scale_filter = Some("scale=1920:1080".to_string()),
            _ => {} // original or other custom values handled by custom_settings or scale preset
        }
    }

    if settings.custom_settings && settings.resolution != "original" { // Custom resolution
         match settings.resolution.as_str() {
            "480p" => scale_filter = Some("scale=854:480".to_string()),
            "720p" => scale_filter = Some("scale=1280:720".to_string()),
            "1080p" => scale_filter = Some("scale=1920:1080".to_string()),
            // If "original" is selected with custom_settings, no scale filter is applied here.
            // Potentially allow custom widthxheight string in the future.
            _ => {}
        }
    }


    match settings.preset_type.as_str() {
        "quality" => { // Existing quality presets (small, balanced, high)
            let crf = match settings.preset.as_str() {
                "small" => "28",
                "balanced" => "23",
                "high" => "18",
                _ => "23", // Default
            };
            command.arg("-crf").arg(crf);
            let ffmpeg_preset = match settings.preset.as_str() {
                "small" => "fast",
                "balanced" => "medium",
                "high" => "slow",
                _ => "medium",
            };
            command.arg("-preset").arg(ffmpeg_preset);
        }
        "vbr" => {
            // For VBR, CRF is king. Resolution might be set by custom settings or kept original.
            // If custom_settings is true, crf_value from UI is used. Otherwise, a default or preset-specific one.
            let crf_to_use = if settings.custom_settings {
                settings.crf_value.to_string()
            } else {
                // Default VBR CRF if not customized. Can be made more granular with VBR sub-presets.
                settings.crf_value.to_string() // Uses the value set in handlePresetChange (e.g. 22)
            };
            command.arg("-crf").arg(crf_to_use);
            command.arg("-preset").arg("medium"); // Default preset for VBR, can be customized too
            println!("VBR Mode: CRF set to {}", crf_to_use);
        }
        "cbr" => {
            if let Some(target_br) = &settings.target_bitrate {
                if let Ok(target_br_val) = target_br.parse::<u32>() {
                    if target_br_val > 0 {
                        let br_str = format!("{}k", target_br_val);
                        command.arg("-b:v").arg(&br_str)
                               .arg("-minrate").arg(&br_str)
                               .arg("-maxrate").arg(&br_str)
                               .arg("-bufsize").arg(format!("{}k", target_br_val * 2)); // Common practice: bufsize = 2 * bitrate
                        println!("CBR Mode: Target Bitrate set to {}", br_str);
                    } else {
                         println!("CBR Mode: Invalid target bitrate value {}", target_br_val);
                         // Fallback to a default CRF to avoid error, or handle error more explicitly
                         command.arg("-crf").arg("23").arg("-preset").arg("medium");
                    }
                } else {
                    println!("CBR Mode: Failed to parse target bitrate value '{}'", target_br);
                    command.arg("-crf").arg("23").arg("-preset").arg("medium");
                }
            } else {
                println!("CBR Mode: Target bitrate not provided, falling back to default CRF.");
                command.arg("-crf").arg("23").arg("-preset").arg("medium");
            }
            // Resolution for CBR is typically original unless specified by custom settings
        }
        "scale" => {
            // Scale preset primarily changes resolution. Other quality params (like CRF) can be default or from custom.
            if let Some(percentage_str) = &settings.scale_percentage {
                if let Ok(percentage) = percentage_str.parse::<f32>() {
                    if percentage > 0.0 && percentage <= 100.0 {
                         // Format as scale=iw*0.5:ih*0.5 for 50%
                        scale_filter = Some(format!("scale=iw*{}:ih*{}", percentage / 100.0, percentage / 100.0));
                        println!("Scale Mode: Scaling to {}%", percentage);
                    } else {
                        println!("Scale Mode: Invalid scale percentage {}", percentage);
                    }
                } else {
                     println!("Scale Mode: Failed to parse scale percentage '{}'", percentage_str);
                }
            }
            // Apply a default CRF if no custom CRF is set for scaling, to maintain quality.
            let crf_to_use = if settings.custom_settings && settings.preset_type != "cbr" { // Respect custom CRF if not CBR
                 settings.crf_value.to_string()
            } else {
                "23" // Default CRF for scaling
            };
            command.arg("-crf").arg(crf_to_use);
            command.arg("-preset").arg("medium");
        }
        "targetSize" => {
            // This will be handled by two-pass encoding. Placeholder for now.
            // For the first pass (and potentially single pass fallback if duration is unknown)
            println!("Target Size Mode: Placeholder - Will use two-pass. Applying default CRF for now.");
            // --- Target Size Mode ---
            "targetSize" => {
                println!("Target Size Mode selected.");
                if let Some(size_str) = &settings.target_size_mb {
                    if let Ok(target_size_mb_val) = size_str.parse::<f64>() {
                        if target_size_mb_val > 0.0 {
                            // Run two-pass encoding for target size
                            // This requires getting video duration first, which can be done via ffprobe or parsing ffmpeg's initial output.
                            // For simplicity in this step, we'll assume duration is known or estimate it.
                            // A more robust solution would run ffprobe.

                            // Placeholder: Get duration (e.g., by running a quick ffmpeg info pass or ffprobe)
                            // We need a way to get duration. Let's try to parse it from an initial ffmpeg run.
                            let duration_secs = get_video_duration(&input_path, &app_handle, &task_id_for_progress).await?;
                            if duration_secs <= 0.0 {
                                return Err("Could not determine video duration for target size encoding.".to_string());
                            }

                            let audio_br_kbps = match settings.audio_quality.as_str() {
                                "low" => 96,
                                "medium" => 128,
                                "high" => 192,
                                _ => 128,
                            };

                            // Calculate target video bitrate
                            // Target total bits = target_size_MB * 1024 * 1024 * 8
                            // Target video bits = Target total bits - (audio_bitrate_kbps * 1000 * duration_seconds)
                            // Target video bitrate kbps = (Target video bits / duration_seconds) / 1000
                            let target_total_bits = target_size_mb_val * 1024.0 * 1024.0 * 8.0;
                            let audio_total_bits = audio_br_kbps as f64 * 1000.0 * duration_secs;
                            let target_video_bits = target_total_bits - audio_total_bits;

                            if target_video_bits <= 0.0 {
                                return Err(format!(
                                    "Target size ({}MB) is too small for the audio track at {}kbps for a {}s video. Try a larger target size or lower audio quality.",
                                    target_size_mb_val, audio_br_kbps, duration_secs
                                ));
                            }

                            let calculated_video_bitrate_kbps = (target_video_bits / duration_secs) / 1000.0;
                            let calculated_video_bitrate_str = format!("{:.0}k", calculated_video_bitrate_kbps);

                            println!("Target Size: Calculated video bitrate: {} for {}MB target, {}s duration, audio {}kbps",
                                calculated_video_bitrate_str, target_size_mb_val, duration_secs, audio_br_kbps);

                            // --- First Pass ---
                            let mut cmd_pass1 = Command::new("ffmpeg");
                            cmd_pass1.arg("-y").arg("-i").arg(&input_path);
                            if let Some(sf) = &scale_filter { cmd_pass1.arg("-vf").arg(sf); }
                            cmd_pass1.arg("-c:v").arg("libx264")
                                .arg("-b:v").arg(&calculated_video_bitrate_str)
                                .arg("-preset").arg(if settings.custom_settings { "medium" } else { "medium" }) // Or from settings
                                .arg("-pass").arg("1")
                                .arg("-an") // No audio for the first pass
                                .arg("-f").arg("null"); // Output to null device

                            // Platform specific null output
                            if cfg!(windows) { cmd_pass1.arg("NUL"); } else { cmd_pass1.arg("/dev/null"); }

                            println!("Executing FFmpeg Pass 1: {:?}", cmd_pass1);
                            let output_pass1 = cmd_pass1.output().map_err(|e| format!("FFmpeg Pass 1 failed: {}", e))?;
                            if !output_pass1.status.success() {
                                let stderr = String::from_utf8_lossy(&output_pass1.stderr);
                                return Err(format!("FFmpeg Pass 1 execution failed: {}", stderr));
                            }
                            println!("FFmpeg Pass 1 successful.");
                            emit_progress(&app_handle, &task_id_for_progress, 50.0); // Emit 50% after pass 1


                            // --- Second Pass ---
                            command.arg("-c:v").arg("libx264")
                                   .arg("-b:v").arg(&calculated_video_bitrate_str)
                                   .arg("-preset").arg(if settings.custom_settings { "medium" } else { "medium" })
                                   .arg("-pass").arg("2");
                            // Audio settings will be added after the match block
                            // Scale filter also added after match block

                            // Set two_pass_active, so the main command execution logic knows
                            // This structure means command is configured here, then audio & output path added later
                            // The main command execution loop should handle progress for the second pass.

                        } else {
                            println!("Target Size Mode: Invalid target size value {}", target_size_mb_val);
                            return Err(format!("Invalid target size: {}", target_size_mb_val));
                        }
                    } else {
                        println!("Target Size Mode: Failed to parse target size value '{}'", size_str);
                        return Err(format!("Could not parse target size: {}", size_str));
                    }
                } else {
                    println!("Target Size Mode: Target size not provided.");
                    return Err("Target size not specified for Target Size mode.".to_string());
                }
            }
            _ => { // Fallback for unknown preset_type
                println!("Unknown preset type: '{}'. Falling back to default CRF.", settings.preset_type);
                command.arg("-crf").arg("23").arg("-preset").arg("medium");
            }
        }
    } else { // This else block is for settings.custom_settings = true
        // Custom settings: User controls CRF and Resolution directly if not using a specific preset logic like CBR.
        // This part is slightly different now as preset_type guides the primary logic.
        // If custom_settings is true, it usually means overriding parts of a selected preset_type.
        
        // If custom_settings is true, and it's not a preset that dictates bitrate (like CBR), allow CRF override.
        if settings.preset_type != "cbr" {
             command.arg("-crf").arg(settings.crf_value.to_string());
             println!("Custom Settings: CRF set to {}", settings.crf_value);
        }
        // Custom resolution is handled by scale_filter logic at the start
        // If it's a preset like 'scale' with custom_settings, scale_percentage would have been used.
        // If it's 'quality' with custom_settings, the custom resolution and CRF are applied.
    }

    // Apply scale filter if defined (needs to be after preset_type specific video codec options)
    if let Some(sf) = scale_filter {
        command.arg("-vf").arg(sf);
    }

    // --- Audio Settings ---
    // Applied universally unless a preset specifically needs to override them.
    let audio_bitrate_str = match settings.audio_quality.as_str() {
        "low" => "96k",
        "medium" => "128k",
        "high" => "192k",
        _ => "128k",
    };
    command.arg("-c:a").arg("aac").arg("-b:a").arg(audio_bitrate_str);

    // --- Output ---
    command.arg("-y").arg(&output_path);

    println!("Final FFmpeg command to execute: {:?}", command);

    let task_id = input_path.clone(); // Used for progress reporting.
                                      // If two-pass, task_id_for_progress was already used for pass 1.
                                      // The main progress loop will use this task_id.

    execute_ffmpeg_command(command, app_handle, task_id, original_size, output_path).await
}


// Helper function to execute ffmpeg command and handle progress
async fn execute_ffmpeg_command(
    mut command: Command,
    app_handle: tauri::AppHandle,
    task_id: String,
    original_size: u64,
    output_path_str: String, // Pass as String to avoid lifetime issues with &Path
) -> Result<String, String> {

    let mut child = command.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute FFmpeg command: {}", e))?;

    let stderr = child.stderr.take().ok_or_else(|| "Could not capture ffmpeg stderr.".to_string())?;
    let reader = BufReader::new(stderr);

    // Regex for duration and time are defined globally or passed if needed
    let re_duration = Regex::new(r"Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let re_time = Regex::new(r"time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let mut total_duration_secs: Option<f32> = None;

    // If this is the second pass of a two-pass encode, total_duration_secs might already be known.
    // However, ffmpeg often prints Duration again for the second pass.
    // For simplicity, we re-parse it here. A more optimized way might pass it.

    for line_result in reader.lines() {
        match line_result {
            Ok(line) => {
                println!("FFMPEG_STDERR: {}", line);

                if total_duration_secs.is_none() {
                    if let Some(caps) = re_duration.captures(&line) {
                        let h = caps.get(1).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let m = caps.get(2).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let s = caps.get(3).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let ss = caps.get(4).unwrap().as_str().parse::<f32>().unwrap_or(0.0) / 100.0;
                        total_duration_secs = Some(h * 3600.0 + m * 60.0 + s + ss);
                        println!("Total duration from current pass: {:?} seconds", total_duration_secs);
                    }
                }

                if let Some(duration_secs) = total_duration_secs {
                    if duration_secs > 0.0 { // Avoid division by zero if duration is not found or is zero
                        if let Some(caps) = re_time.captures(&line) {
                            let h = caps.get(1).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                            let m = caps.get(2).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                            let s = caps.get(3).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                            let ss = caps.get(4).unwrap().as_str().parse::<f32>().unwrap_or(0.0) / 100.0;
                            let current_time_secs = h * 3600.0 + m * 60.0 + s + ss;

                            let mut current_progress = (current_time_secs / duration_secs) * 100.0;
                            // If this is part of a two-pass, adjust progress (e.g., pass 2 is 50-100%)
                            // This needs to be passed or known via context if we want to adjust it here.
                            // For now, assuming single pass or second pass reports 0-100 for its own duration.
                            // The caller of execute_ffmpeg_command (e.g. targetSize logic) handles the 0-50% for pass 1.

                            current_progress = current_progress.min(100.0); // Cap at 100%

                            // If this is the second pass of targetSize, this progress is from 0-100 for the second pass.
                            // We need to map it to 50-100% of the total task.
                            // This requires knowing the context. For now, the `emit_progress` helper can take base_progress.
                            // Let's assume for now the caller of execute_ffmpeg_command handles this adjustment if needed.
                            // Or, we add a parameter `progress_offset: f32` to this function.
                            // For the sake of this step, we'll keep it simple.
                            emit_progress(&app_handle, &task_id, current_progress);
                        }
                    }
                }
            }
            Err(e) => eprintln!("Error reading ffmpeg stderr line: {}", e),
        }
    }

    let output_status = child.wait_with_output().map_err(|e| format!("Failed to wait for FFmpeg command: {}", e))?;

    if output_status.status.success() {
        emit_progress(&app_handle, &task_id, 100.0); // Ensure 100% is sent

        let output_path = Path::new(&output_path_str);
        let output_metadata = fs::metadata(output_path)
            .map_err(|e| format!("Could not get output file metadata: {}", e))?;
        let compressed_size = output_metadata.len();
        println!("Compressed file size: {} bytes", compressed_size);

        let change_percentage = if original_size > 0 {
            ((compressed_size as f64 - original_size as f64) / original_size as f64) * 100.0
        } else {
            0.0
        };
        let size_change_str = if change_percentage > 0.0 {
            format!("increased by {:.2}%", change_percentage)
        } else if change_percentage < 0.0 {
            format!("reduced by {:.2}%", -change_percentage)
        } else {
            "remained the same".to_string()
        };

        let success_msg = format!(
            "Video compression successful! Output: {} (Size: {} bytes, {} compared to original)",
            output_path.display(), compressed_size, size_change_str
        );
        println!("{}", success_msg);
        Ok(success_msg)
    } else {
        let stderr_output = String::from_utf8_lossy(&output_status.stderr);
        let error_msg = format!("FFmpeg command execution failed: {}", stderr_output);
        println!("Error: {}", error_msg);
        Err(error_msg)
    }
}

// Helper to emit progress
fn emit_progress(app_handle: &tauri::AppHandle, task_id: &str, progress: f32) {
    let payload = ProgressPayload {
        task_id: task_id.to_string(),
        progress: progress.min(100.0).max(0.0), // Ensure progress is between 0 and 100
    };
    app_handle.emit("PROGRESS_EVENT", payload).unwrap_or_else(|e| eprintln!("Failed to emit progress: {}", e));
}


// Helper function to get video duration using ffprobe or ffmpeg
// This is a simplified version. A robust solution would use ffprobe and parse its JSON output.
async fn get_video_duration(
    input_path: &str,
    app_handle: &tauri::AppHandle, // For emitting progress if this takes time
    task_id: &str // For associating progress with a task
) -> Result<f32, String> {
    println!("Attempting to get video duration for: {}", input_path);
    emit_progress(app_handle, task_id, 5.0); // Arbitrary small progress for duration check

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-i").arg(input_path);

    // We don't want to actually encode, so we can try to make it fail quickly after printing info.
    // Or use ffprobe if available. For now, let's parse ffmpeg's stderr.
    // Adding arguments that make it error out after showing info can be one way.
    // For example, specifying an invalid output format or non-existent output.
    // However, just running `ffmpeg -i input` will print info to stderr and then wait for more args.
    // We need to capture stderr.

    let child = cmd.stdout(Stdio::null()) // We don't need stdout
                   .stderr(Stdio::piped())
                   .spawn()
                   .map_err(|e| format!("Failed to spawn ffmpeg for duration check: {}", e))?;

    let stderr_capture = child.stderr.ok_or_else(|| "Could not capture stderr for duration check".to_string())?;
    let reader = BufReader::new(stderr_capture);
    let re_duration = Regex::new(r"Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let mut duration_found_secs: Option<f32> = None;

    // It's important that ffmpeg exits after printing the duration or this will hang.
    // For `ffmpeg -i <input>`, it will typically error due to no output file specified.
    // We can read lines for a short period or until "Press [q] to stop" or similar.

    // Reading stderr line by line. Ffmpeg might not exit immediately.
    // A timeout or specific parsing to break the loop might be needed if ffmpeg hangs.
    // For now, assume ffmpeg will eventually exit or print enough lines.
    // Consider `child.wait_with_output()` if ffmpeg exits quickly.

    for line_result in reader.lines() {
        if let Ok(line) = line_result {
            // println!("FFMPEG_DURATION_CHECK_STDERR: {}", line); // Debug
            if let Some(caps) = re_duration.captures(&line) {
                let h = caps.get(1).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                let m = caps.get(2).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                let s = caps.get(3).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                let ss = caps.get(4).unwrap().as_str().parse::<f32>().unwrap_or(0.0) / 100.0;
                duration_found_secs = Some(h * 3600.0 + m * 60.0 + s + ss);
                println!("Duration found: {:?} seconds", duration_found_secs);
                break; // Found duration, no need to parse further for this purpose.
            }
            // Heuristic to break if ffmpeg seems to be waiting for input or stuck
            if line.contains("Press [q] to stop") || line.contains("At least one output file must be specified") {
                break;
            }
        } else {
            break; // Error reading line
        }
    }

    // Ensure ffmpeg process is terminated if it hasn't exited (e.g. if it's stuck)
    // This is a bit tricky. `child.kill()` could be used.
    // `child.wait()` or `child.try_wait()` would be better before kill.
    // For now, we hope ffmpeg exits due to lack of output file.

    match duration_found_secs {
        Some(d) if d > 0.0 => {
            emit_progress(app_handle, task_id, 10.0); // Progress after finding duration
            Ok(d)
        }
        _ => Err("Could not parse video duration from ffmpeg output.".to_string()),
    }
}


// Original compress_video function signature and initial checks remain the same.
// The main change is how `command` is built and then passed to `execute_ffmpeg_command`.

#[tauri::command]
async fn compress_video(
    app_handle: tauri::AppHandle,
    input_path: String,
    output_path: String,
    settings: CompressionSettings,
) -> Result<String, String> {
    println!("Beginning video compression process...");
    println!("Input: {}, Output: {}", input_path, output_path);
    println!("Settings: {:?}", settings);

    if !Path::new(&input_path).exists() {
        return Err(format!("Input file does not exist: {}", input_path));
    }

    let input_metadata = fs::metadata(&input_path)
        .map_err(|e| format!("Cannot get input file metadata: {}", e))?;
    let original_size = input_metadata.len();
    println!("Original file size: {} bytes", original_size);

    if Command::new("ffmpeg").arg("-version").output().is_err() {
        return Err("ffmpeg command not found. Please ensure ffmpeg is installed and in your PATH.".to_string());
    }

    let task_id_for_progress = input_path.clone(); // Use input_path as a unique ID for progress reporting

    // --- Base Command Setup ---
    let mut command = Command::new("ffmpeg");
    command.arg("-i").arg(&input_path);

    // --- Video Settings ---
    // Resolution base settings - determine if a scale filter is needed from general settings or custom.
    let mut scale_filter: Option<String> = None;
    if settings.custom_settings { // Custom settings override preset resolution choices
        if settings.resolution != "original" {
            match settings.resolution.as_str() {
                "480p" => scale_filter = Some("scale=854:480".to_string()),
                "720p" => scale_filter = Some("scale=1280:720".to_string()),
                "1080p" => scale_filter = Some("scale=1920:1080".to_string()),
                _ => {} // "original" or other unhandled custom strings
            }
        }
    } else { // Not custom settings, use resolution if it's part of a 'quality' preset, or if 'scale' preset itself
        if settings.preset_type == "quality" && settings.resolution != "original" {
             match settings.resolution.as_str() {
                "480p" => scale_filter = Some("scale=854:480".to_string()),
                "720p" => scale_filter = Some("scale=1280:720".to_string()),
                "1080p" => scale_filter = Some("scale=1920:1080".to_string()),
                _ => {}
            }
        }
        // Scale preset type will define its own scale_filter logic inside the match block
    }


    // --- Preset Type Specific Logic ---
    let is_two_pass = settings.preset_type == "targetSize"; // Flag to know if we should use the common execution path or if targetSize handled it.

    if !is_two_pass { // For all non-targetSize presets, or if targetSize fails to setup two-pass
        command.arg("-c:v").arg("libx264"); // Common video codec

        match settings.preset_type.as_str() {
            "quality" => {
                let crf = match settings.preset.as_str() { // preset here is "small", "balanced", "high"
                    "small" => "28", "balanced" => "23", "high" => "18", _ => "23",
                };
                command.arg("-crf").arg(if settings.custom_settings { settings.crf_value.to_string() } else { crf.to_string() });
                command.arg("-preset").arg(match settings.preset.as_str() {
                    "small" => "fast", "balanced" => "medium", "high" => "slow", _ => "medium",
                });
            }
            "vbr" => {
                command.arg("-crf").arg(settings.crf_value.to_string());
                command.arg("-preset").arg("medium"); // Default, could be made customizable
                println!("VBR Mode: CRF {}", settings.crf_value);
            }
            "cbr" => {
                if let Some(br_str) = &settings.target_bitrate {
                    if let Ok(br_val) = br_str.parse::<u32>() {
                        if br_val > 0 {
                            let k_br = format!("{}k", br_val);
                            command.arg("-b:v").arg(&k_br).arg("-minrate").arg(&k_br).arg("-maxrate").arg(&k_br)
                                   .arg("-bufsize").arg(format!("{}k", br_val * 2));
                            println!("CBR Mode: Bitrate {}k", br_val);
                        } else { command.arg("-crf").arg(settings.crf_value.to_string()); /* fallback */ }
                    } else { command.arg("-crf").arg(settings.crf_value.to_string()); /* fallback */ }
                } else { command.arg("-crf").arg(settings.crf_value.to_string()); /* fallback */ }
            }
            "scale" => {
                if let Some(p_str) = &settings.scale_percentage {
                    if let Ok(p) = p_str.parse::<f32>() {
                        if p > 0.0 && p <= 100.0 {
                            // Override any previous scale_filter for "scale" preset type
                            scale_filter = Some(format!("scale=iw*{}:ih*{}", p / 100.0, p / 100.0));
                            println!("Scale Mode: Scaling to {}%", p);
                        }
                    }
                }
                command.arg("-crf").arg(if settings.custom_settings && settings.preset_type != "cbr" { settings.crf_value.to_string() } else { "23".to_string() });
                command.arg("-preset").arg("medium");
            }
            // targetSize is handled in the more complex block below, this is a fallback.
            "targetSize" => {
                println!("TargetSize selected, but two-pass logic not initiated or failed. Using fallback CRF.");
                command.arg("-crf").arg("23").arg("-preset").arg("medium");
            }
            _ => { // Fallback for unknown preset_type
                println!("Unknown preset type: '{}'. Using CRF 23.", settings.preset_type);
                command.arg("-crf").arg("23").arg("-preset").arg("medium");
            }
        }

        // Apply scale filter if defined from custom or quality presets
        if let Some(sf) = &scale_filter {
            command.arg("-vf").arg(sf);
        }

        // Audio settings for single-pass modes
        let audio_bitrate_str = match settings.audio_quality.as_str() {
            "low" => "96k", "medium" => "128k", "high" => "192k", _ => "128k",
        };
        command.arg("-c:a").arg("aac").arg("-b:a").arg(audio_bitrate_str);
        command.arg("-y").arg(&output_path);

        println!("Executing single-pass/standard FFmpeg command: {:?}", command);
        return execute_ffmpeg_command(command, app_handle, task_id_for_progress, original_size, output_path).await;
    }
    // --- Target Size Two-Pass Encoding Logic ---
    // This 'else' corresponds to `if is_two_pass` (i.e. settings.preset_type == "targetSize")
    // Note: The above `if !is_two_pass` block now returns. So the code below is ONLY for targetSize.

    // Ensure this section is only for targetSize
    if settings.preset_type == "targetSize" {
        println!("Target Size Mode selected. Initiating two-pass encoding.");
        if let Some(size_str) = &settings.target_size_mb {
            if let Ok(target_size_mb_val) = size_str.parse::<f64>() {
                if target_size_mb_val <= 0.0 {
                    return Err(format!("Invalid target size: {}MB. Must be > 0.", target_size_mb_val));
                }

                emit_progress(&app_handle, &task_id_for_progress, 2.0); // Initial progress
                let duration_secs = get_video_duration(&input_path, &app_handle, &task_id_for_progress).await?;
                emit_progress(&app_handle, &task_id_for_progress, 10.0); // Progress after getting duration

                if duration_secs <= 0.0 {
                    return Err("Could not determine video duration for target size encoding.".to_string());
                }

                let audio_br_kbps = match settings.audio_quality.as_str() {
                    "low" => 96, "medium" => 128, "high" => 192, _ => 128,
                };

                let target_total_bits = target_size_mb_val * 1024.0 * 1024.0 * 8.0;
                let audio_total_bits = audio_br_kbps as f64 * 1000.0 * duration_secs;
                let target_video_bits = target_total_bits - audio_total_bits;

                if target_video_bits <= 0.0 {
                    return Err(format!(
                        "Target size ({}MB) is too small for the audio track ({}kbps) and video duration ({}s). Try a larger target size or lower audio quality.",
                        target_size_mb_val, audio_br_kbps, duration_secs
                    ));
                }

                let calculated_video_bitrate_kbps = (target_video_bits / duration_secs) / 1000.0;
                if calculated_video_bitrate_kbps < 10.0 { // Heuristic: if video bitrate is extremely low, it's probably not feasible
                     return Err(format!(
                        "Calculated video bitrate ({:.2}kbps) is too low for target size {}MB. This may result in very poor quality or errors. Increase target size.",
                        calculated_video_bitrate_kbps, target_size_mb_val
                    ));
                }
                let calculated_video_bitrate_str = format!("{:.0}k", calculated_video_bitrate_kbps.max(10.0)); // Ensure at least 10k

                println!("Target Size: Duration {:.2}s, Target Video Bitrate: {}, Audio Bitrate: {}kbps",
                         duration_secs, calculated_video_bitrate_str, audio_br_kbps);

                // --- First Pass ---
                let mut cmd_pass1 = Command::new("ffmpeg");
                cmd_pass1.arg("-y").arg("-i").arg(&input_path);
                if let Some(sf) = &scale_filter { cmd_pass1.arg("-vf").arg(sf); } // Apply scaling in pass 1 if set
                cmd_pass1.arg("-c:v").arg("libx264")
                    .arg("-b:v").arg(&calculated_video_bitrate_str)
                    .arg("-preset").arg("medium") // Consider a faster preset for pass 1, e.g., "fast" or "medium"
                    .arg("-pass").arg("1")
                    .arg("-an") // No audio for the first pass
                    .arg("-f").arg("null");
                if cfg!(windows) { cmd_pass1.arg("NUL"); } else { cmd_pass1.arg("/dev/null"); }

                println!("Executing FFmpeg Pass 1: {:?}", cmd_pass1);
                // For pass 1, we don't need to parse its progress in the same way, but we need to wait for it.
                // We can emit a fixed progress update or try to parse its simple progress if available.
                // For simplicity, just wait for it to complete.
                let output_pass1 = cmd_pass1.output().map_err(|e| format!("FFmpeg Pass 1 command failed to start: {}", e))?;
                if !output_pass1.status.success() {
                    let stderr = String::from_utf8_lossy(&output_pass1.stderr);
                    return Err(format!("FFmpeg Pass 1 execution failed: {}", stderr));
                }
                println!("FFmpeg Pass 1 successful.");
                emit_progress(&app_handle, &task_id_for_progress, 50.0); // Progress after pass 1


                // --- Second Pass (command is already initialized as `command`) ---
                command.arg("-c:v").arg("libx264")
                       .arg("-b:v").arg(&calculated_video_bitrate_str)
                       .arg("-preset").arg("medium") // Use a preset that balances quality and speed for pass 2
                       .arg("-pass").arg("2");

                if let Some(sf) = &scale_filter { command.arg("-vf").arg(sf); } // Apply scaling in pass 2 as well

                let audio_bitrate_str_pass2 = match settings.audio_quality.as_str() {
                     "low" => "96k", "medium" => "128k", "high" => "192k", _ => "128k",
                };
                command.arg("-c:a").arg("aac").arg("-b:a").arg(audio_bitrate_str_pass2);
                command.arg("-y").arg(&output_path);

                println!("Executing FFmpeg Pass 2: {:?}", command);
                // The progress for the second pass will be from 50% to 100%.
                // We need a way for execute_ffmpeg_command to know this offset.
                // Modifying execute_ffmpeg_command to accept a progress_offset or base_progress.
                // For now, let's assume execute_ffmpeg_command's progress is 0-100 for its run,
                // and we'll adjust it when emitting.
                // Or, we can create a specialized version or pass a closure for progress reporting.

                // Re-using execute_ffmpeg_command. We need to adjust its 0-100% progress to 50-100%.
                // This can be done by modifying how emit_progress is called within or after.
                // Let's modify `execute_ffmpeg_command` to take a base_progress.
                // For now, I will call it and then if successful, assume it reached 100% (of its own run).
                // The progress updates from execute_ffmpeg_command will be 0-100.
                // We need to adjust the ProgressPayload inside emit_progress when called from execute_ffmpeg_command
                // if we are in a two-pass context.
                // A simpler way: `execute_ffmpeg_command` reports 0-100. The `targetSize` block
                // is responsible for emitting progress updates *around* calls to it.
                // So, `emit_progress(&app_handle, &task_id_for_progress, 50.0 + (pass2_progress / 2.0));`

                // To achieve the 50-100% range for pass 2 progress:
                // We need to intercept the progress reporting from execute_ffmpeg_command for pass 2.
                // This is getting complex. Let's simplify: the progress for pass 2 will also be 0-100%,
                // but the UI should understand that this is the second part of a two-part process.
                // Or, the `task_id` could be different, e.g., `task_id_pass1`, `task_id_pass2`.
                // For now, `execute_ffmpeg_command` will emit progress from 0-100 for the second pass.
                // The UI will see progress jump to 50%, then go from 0% to 100% again for the second pass, which is not ideal.

                // A better approach for execute_ffmpeg_command: add `progress_offset: f32` and `progress_scale: f32`
                // Then `current_progress = progress_offset + (current_progress_of_this_pass * progress_scale)`
                // For pass 1 (if it had progress): offset 0, scale 0.5
                // For pass 2: offset 50, scale 0.5
                // This change is for execute_ffmpeg_command and emit_progress.

                // For now, let's proceed without modifying execute_ffmpeg_command's internal progress reporting scaling.
                // The UI will see 0-100% for pass 2. This can be refined later.
                return execute_ffmpeg_command(command, app_handle, task_id_for_progress, original_size, output_path).await;

            } else { // Failed to parse target_size_mb_val
                return Err(format!("Could not parse target size value: '{}'", size_str));
            }
        } else { // target_size_mb is None
            return Err("Target size (MB) not provided for Target Size mode.".to_string());
        }
    } // End of targetSize specific logic

    // Fallback if somehow reached here without returning (should not happen with current logic)
    Err("Compression logic error: No specific preset path taken.".to_string())
}


// Helper function to execute ffmpeg command and handle progress
async fn execute_ffmpeg_command(
    mut command: Command,
    app_handle: tauri::AppHandle,
    task_id: String,
    original_size: u64,
    output_path_str: String, // Pass as String to avoid lifetime issues with &Path
    // Add these for more flexible progress reporting in two-pass scenarios
    progress_offset: f32,
    progress_scale: f32,
) -> Result<String, String> {

    let mut child = command.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute FFmpeg command: {}", e))?;

    let stderr = child.stderr.take().ok_or_else(|| "Could not capture ffmpeg stderr.".to_string())?;
    let reader = BufReader::new(stderr);

    let re_duration = Regex::new(r"Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let re_time = Regex::new(r"time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let mut total_duration_secs: Option<f32> = None;

    for line_result in reader.lines() {
        match line_result {
            Ok(line) => {
                // Slightly reduce verbosity of FFMPEG_STDERR unless in debug build
                #[cfg(debug_assertions)]
                println!("FFMPEG_STDERR: {}", line);

                if total_duration_secs.is_none() {
                    if let Some(caps) = re_duration.captures(&line) {
                        let h = caps.get(1).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let m = caps.get(2).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let s = caps.get(3).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                        let ss = caps.get(4).unwrap().as_str().parse::<f32>().unwrap_or(0.0) / 100.0;
                        total_duration_secs = Some(h * 3600.0 + m * 60.0 + s + ss);
                        // println!("Total duration from current pass: {:?} seconds", total_duration_secs);
                    }
                }

                if let Some(duration_secs) = total_duration_secs {
                    if duration_secs > 0.0 {
                        if let Some(caps) = re_time.captures(&line) {
                            let h = caps.get(1).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                            let m = caps.get(2).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                            let s = caps.get(3).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                            let ss = caps.get(4).unwrap().as_str().parse::<f32>().unwrap_or(0.0) / 100.0;
                            let current_time_secs = h * 3600.0 + m * 60.0 + s + ss;

                            let pass_progress = (current_time_secs / duration_secs) * 100.0;
                            let overall_progress = progress_offset + (pass_progress * progress_scale);
                            emit_progress(&app_handle, &task_id, overall_progress.min(100.0));
                        }
                    }
                }
            }
            Err(e) => eprintln!("Error reading ffmpeg stderr line: {}", e),
        }
    }

    let output_status = child.wait_with_output().map_err(|e| format!("Failed to wait for FFmpeg command: {}", e))?;

    if output_status.status.success() {
        // Ensure final progress (e.g. 100% for single pass, or 50% for pass 1, 100% for pass 2's contribution)
        emit_progress(&app_handle, &task_id, progress_offset + (100.0 * progress_scale));

        let output_path = Path::new(&output_path_str);
        let output_metadata = fs::metadata(output_path)
            .map_err(|e| format!("Could not get output file metadata: {}", e))?;
        let compressed_size = output_metadata.len();
        // println!("Compressed file size: {} bytes", compressed_size);

        let change_percentage = if original_size > 0 {
            ((compressed_size as f64 - original_size as f64) / original_size as f64) * 100.0
        } else {
            0.0
        };
        let size_change_str = if change_percentage > 0.0 {
            format!("increased by {:.2}%", change_percentage)
        } else if change_percentage < 0.0 {
            format!("reduced by {:.2}%", -change_percentage)
        } else {
            "remained the same".to_string()
        };

        let success_msg = format!(
            "Video compression successful! Output: {} (Size: {} bytes, {} compared to original)",
            output_path.display(), compressed_size, size_change_str
        );
        println!("{}", success_msg);
        Ok(success_msg)
    } else {
        let stderr_output = String::from_utf8_lossy(&output_status.stderr);
        let error_msg = format!("FFmpeg command execution failed: {}", stderr_output);
        println!("Error: {}", error_msg);
        Err(error_msg)
    }
}

// Helper to emit progress (no change needed here for scaling, it's handled by the caller)
fn emit_progress(app_handle: &tauri::AppHandle, task_id: &str, progress: f32) {
    let payload = ProgressPayload {
        task_id: task_id.to_string(),
        progress: progress.min(100.0).max(0.0),
    };
    app_handle.emit("PROGRESS_EVENT", payload).unwrap_or_else(|e| eprintln!("Failed to emit progress: {}", e));
}


// Helper function to get video duration using ffmpeg -i
async fn get_video_duration(
    input_path: &str,
    app_handle: &tauri::AppHandle,
    task_id: &str
) -> Result<f32, String> {
    // println!("Attempting to get video duration for: {}", input_path);
    // emit_progress(app_handle, task_id, 5.0); // Progress for starting duration check

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-i").arg(input_path)
       .arg("-f").arg("null") // Tell ffmpeg to not expect an output file for real processing
       .arg("-"); // Read from stdin - not actually reading, but helps ffmpeg exit after info dump with some versions

    let child = cmd.stdout(Stdio::null())
                   .stderr(Stdio::piped())
                   .spawn()
                   .map_err(|e| format!("Failed to spawn ffmpeg for duration check: {}", e))?;

    let stderr_capture = child.stderr.ok_or_else(|| "Could not capture stderr for duration check".to_string())?;
    let reader = BufReader::new(stderr_capture);
    let re_duration = Regex::new(r"Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap();
    let mut duration_found_secs: Option<f32> = None;

    // Limit how many lines we read to avoid hanging if ffmpeg behaves unexpectedly
    let mut lines_read = 0;
    const MAX_LINES_FOR_DURATION_CHECK: usize = 200;

    for line_result in reader.lines() {
        lines_read += 1;
        if lines_read > MAX_LINES_FOR_DURATION_CHECK {
            println!("Warning: Exceeded max lines read while checking duration. FFmpeg might be stuck or output is too verbose.");
            break;
        }

        if let Ok(line) = line_result {
            // println!("FFMPEG_DURATION_CHECK_STDERR: {}", line); // Debug
            if let Some(caps) = re_duration.captures(&line) {
                let h = caps.get(1).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                let m = caps.get(2).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                let s = caps.get(3).unwrap().as_str().parse::<f32>().unwrap_or(0.0);
                let ss = caps.get(4).unwrap().as_str().parse::<f32>().unwrap_or(0.0) / 100.0;
                duration_found_secs = Some(h * 3600.0 + m * 60.0 + s + ss);
                // println!("Duration found: {:?} seconds", duration_found_secs);
                break;
            }
            // Some versions of ffmpeg with `-f null -` might print "Output file #0 does not contain any stream"
            // and then exit. That's fine.
            if line.contains("Output file #0 does not contain any stream") || line.contains("Conversion failed!") {
                 break;
            }
        } else {
            break;
        }
    }

    // It's good practice to ensure the child process is waited on to release resources,
    // especially if we break early from reading its output.
    // let _ = child.wait(); // We might not care about the exit status here if duration was found.

    match duration_found_secs {
        Some(d) if d > 0.0 => {
            // emit_progress(app_handle, task_id, 10.0); // Progress after finding duration
            Ok(d)
        }
        _ => Err(format!("Could not parse video duration for '{}' from ffmpeg output. Ensure ffmpeg is working correctly.", input_path)),
    }
}
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
