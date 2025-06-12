import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ThemeToggle } from "./components/ThemeToggle";
import { DropZone } from "./components/DropZone";
import { CompressionSettings, CompressionSettings as VideoCompressionSettingsType } from "./components/CompressionSettings";
import { AudioCompressionSettingsComponent, AudioCompressionSettings as AudioCompressionSettingsType }
  from "./components/AudioCompressionSettings";
import { ImageCompressionSettingsComponent, ImageCompressionSettings as ImageCompressionSettingsType }
  from "./components/ImageCompressionSettings";
import { ProgressBar } from "./components/ProgressBar";

type ActiveView = 'video' | 'audio' | 'image';

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('video');
  const [inputFile, setInputFile] = useState<string | null>(null);
  const [outputFile, setOutputFile] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("准备就绪");
  const [videoSettings, setVideoSettings] = useState<VideoCompressionSettingsType>({
    preset: 'balanced',
    resolution: '720p',
    bitrate: '2000',
    audioQuality: 'medium',
    customSettings: false,
    crfValue: 23,
  });
  const [audioSettings, setAudioSettings] = useState<AudioCompressionSettingsType>({
    quality: 'medium',
  });
  const [imageSettings, setImageSettings] = useState<ImageCompressionSettingsType>({
    quality: 75, // Default image quality
  });

  // Removed useEffect for compression:progress event listener

  const handleFileSelect = (filePath: string) => {
    // Reset status when a new file is selected for any view
    setStatus("已选择文件，准备开始。");
    setProgress(0);
    setInputFile(filePath);
    // 自动生成输出文件路径（在相同目录下添加 _compressed 后缀）
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      const newOutputPath = filePath.substring(0, lastDotIndex) + 
                           '_compressed' + 
                           filePath.substring(lastDotIndex);
      setOutputFile(newOutputPath);
    } else {
      setOutputFile(filePath + '_compressed');
    }
  };

  const handleVideoSettingsChange = (newSettings: VideoCompressionSettingsType) => {
    setVideoSettings(newSettings);
  };

  const handleAudioSettingsChange = (newSettings: AudioCompressionSettingsType) => {
    setAudioSettings(newSettings);
  };

  const handleImageSettingsChange = (newSettings: ImageCompressionSettingsType) => {
    setImageSettings(newSettings);
  };

  const startVideoCompression = async () => {
    if (!inputFile || !outputFile) {
      setStatus("请先选择输入和输出文件。");
      return;
    }

    setIsCompressing(true);
    setProgress(0);
    setStatus("视频处理中，请稍候...");

    try {
      const successMessage = await invoke<string>("compress_video", {
        inputPath: inputFile,
        outputPath: outputFile,
        settings: videoSettings,
      });
      setStatus(successMessage);
      setProgress(100);
    } catch (error) {
      console.error("视频压缩处理失败:", error);
      setStatus(`视频处理失败: ${error}`);
    } finally {
      setIsCompressing(false);
    }
  };

  const startAudioCompression = async () => {
    if (!inputFile || !outputFile) {
      setStatus("请先选择输入和输出文件。");
      return;
    }

    setIsCompressing(true);
    setProgress(0);
    setStatus("音频处理中，请稍候...");

    try {
      const successMessage = await invoke<string>("compress_audio", {
        inputPath: inputFile,
        outputPath: outputFile,
        settings: audioSettings,
      });
      setStatus(successMessage);
      setProgress(100);
    } catch (error) {
      console.error("音频压缩处理失败:", error);
      setStatus(`音频处理失败: ${error}`);
    } finally {
      setIsCompressing(false);
    }
  };

  const startImageCompression = async () => {
    if (!inputFile || !outputFile) {
      setStatus("请先选择输入和输出文件。");
      return;
    }

    setIsCompressing(true);
    setProgress(0);
    setStatus("图片处理中，请稍候...");

    try {
      const successMessage = await invoke<string>("compress_image", {
        inputPath: inputFile,
        outputPath: outputFile,
        settings: imageSettings,
      });
      setStatus(successMessage);
      setProgress(100);
    } catch (error) {
      console.error("图片压缩处理失败:", error);
      setStatus(`图片处理失败: ${error}`);
    } finally {
      setIsCompressing(false);
    }
  };

  const baseLinkClass = "flex items-center px-4 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30";
  const activeLinkClass = "flex items-center px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-500 font-medium";


  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* 左侧菜单 */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-blue-500 text-xl font-semibold">压一下</span>
          </div>
          <div>
            <ThemeToggle />
          </div>
        </div>
        
        <nav className="mt-4">
          <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">主页</div>
          
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveView('video'); setInputFile(null); setStatus("准备就绪");}}
             className={activeView === 'video' ? activeLinkClass : baseLinkClass}>
            <svg className={`w-6 h-6 mr-3 ${activeView === 'video' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h18M3 16h18"></path>
            </svg>
            <span>视频压缩</span>
          </a>
          
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveView('audio'); setInputFile(null); setStatus("准备就绪");}}
             className={activeView === 'audio' ? activeLinkClass : baseLinkClass}>
            <svg className={`w-6 h-6 mr-3 ${activeView === 'audio' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
            </svg>
            <span>音频压缩</span>
          </a>
          
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveView('image'); setInputFile(null); setStatus("准备就绪");}}
             className={activeView === 'image' ? activeLinkClass : baseLinkClass}>
            <svg className={`w-6 h-6 mr-3 ${activeView === 'image' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span>图片压缩</span>
          </a>

          <div className="mt-8 px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">我的任务</div>
          
          <a href="#" className="flex items-center px-4 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30">
            <svg className="w-6 h-6 text-gray-500 dark:text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
            </svg>
            <span>任务列表</span>
            <span className="ml-auto bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs rounded-full px-2 py-0.5">0</span>
          </a>
        </nav>
      </aside>

      {/* 右侧内容区 */}
      <main className="flex-1 overflow-auto p-6">
        {activeView === 'video' && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">视频压缩</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden col-span-1 md:col-span-2 lg:col-span-3">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <h2 className="ml-3 text-lg font-medium text-gray-800 dark:text-gray-200">压缩视频</h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">自定义视频压缩设置</p>
                </div>
                <div className="p-5">
                  {!inputFile ? (
                    <DropZone onFileSelect={handleFileSelect} prompt="拖放视频文件到此处，或点击选择文件" />
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">已选择文件</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{inputFile}</p>
                          </div>
                          <button onClick={() => setInputFile(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">更换文件</button>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">压缩设置</h3>
                        <CompressionSettings onSettingsChange={handleVideoSettingsChange} />
                      </div>
                      {isCompressing ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                          <ProgressBar progress={progress} status={status} />
                        </div>
                      ) : (
                        <div className="flex justify-center mt-4">
                          <button onClick={startVideoCompression} disabled={isCompressing || !inputFile} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">开始压缩</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeView === 'audio' && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">音频压缩</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden col-span-1 md:col-span-2 lg:col-span-3">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                   <div className="flex items-center">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"> {/* Changed color for audio */}
                      <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                      </svg>
                    </div>
                    <h2 className="ml-3 text-lg font-medium text-gray-800 dark:text-gray-200">压缩音频</h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">自定义音频压缩设置</p>
                </div>
                <div className="p-5">
                  {!inputFile ? (
                    <DropZone onFileSelect={handleFileSelect} prompt="拖放音频文件到此处，或点击选择文件" />
                  ) : (
                     <div className="space-y-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">已选择文件</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{inputFile}</p>
                          </div>
                           <button onClick={() => setInputFile(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">更换文件</button>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">压缩设置</h3>
                        <AudioCompressionSettingsComponent onSettingsChange={handleAudioSettingsChange} initialQuality={audioSettings.quality} />
                      </div>
                      {isCompressing ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                          <ProgressBar progress={progress} status={status} />
                        </div>
                      ) : (
                        <div className="flex justify-center mt-4">
                          <button onClick={startAudioCompression} disabled={isCompressing || !inputFile} className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">开始压缩</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeView === 'image' && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">图片压缩</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden col-span-1 md:col-span-2 lg:col-span-3">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"> {/* Changed color for image */}
                      <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <h2 className="ml-3 text-lg font-medium text-gray-800 dark:text-gray-200">压缩图片</h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">自定义图片压缩设置</p>
                </div>
                <div className="p-5">
                  {!inputFile ? (
                    <DropZone onFileSelect={handleFileSelect} prompt="拖放图片文件到此处，或点击选择文件" />
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">已选择文件</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{inputFile}</p>
                          </div>
                          <button onClick={() => setInputFile(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">更换文件</button>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">压缩设置</h3>
                        <ImageCompressionSettingsComponent onSettingsChange={handleImageSettingsChange} initialQuality={imageSettings.quality} />
                      </div>
                      {isCompressing ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                          <ProgressBar progress={progress} status={status} />
                        </div>
                      ) : (
                        <div className="flex justify-center mt-4">
                          <button onClick={startImageCompression} disabled={isCompressing || !inputFile} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">开始压缩</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
