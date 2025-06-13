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
import { TaskList, Task, ActiveView } from './components/TaskList'; // Import TaskList and types

// ProgressPayload interface is still needed here for the listen function
interface ProgressPayload {
  task_id: string;
  progress: number;
}

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('video');
  const [inputFile, setInputFile] = useState<string | null>(null); // For selecting current file
  const [outputFile, setOutputFile] = useState<string | null>(null); // For selecting current file
  const [tasks, setTasks] = useState<Task[]>([]); // New task list state
  // const [isCompressing, setIsCompressing] = useState(false); // Replaced by task status
  // const [progress, setProgress] = useState(0); // Replaced by task progress
  // const [status, setStatus] = useState("准备就绪"); // Replaced by task status & general UI messages

  const [currentStatusMessage, setCurrentStatusMessage] = useState("准备就绪"); // For general messages

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

  useEffect(() => {
    const unlisten = listen<ProgressPayload>("PROGRESS_EVENT", (event) => {
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === event.payload.task_id
            ? { ...task, progress: event.payload.progress, status: event.payload.progress < 100 ? 'compressing' : 'finishing' }
            : task
        )
      );
    });

    return () => {
      unlisten.then(f => f()).catch(console.error);
    };
  }, []);

  const handleFileSelect = (filePath: string) => {
    setCurrentStatusMessage("已选择文件，准备开始。");
    // setProgress(0); // Task specific now
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

  // Helper to get filename from path
  const getFileName = (path: string) => path.split(/[\\/]/).pop() || path;

  const startVideoCompression = async () => {
    if (!inputFile || !outputFile) {
      setCurrentStatusMessage("请先选择输入和输出文件。");
      return;
    }
    if (tasks.find(task => task.id === inputFile && (task.status === 'compressing' || task.status === 'pending'))) {
      setCurrentStatusMessage(`任务 ${getFileName(inputFile)} 已在队列中或正在处理。`);
      return;
    }

    const taskId = inputFile; // Using inputFile as task ID, as per backend
    const newTask: Task = {
      id: taskId,
      inputFile,
      outputFile,
      status: 'pending',
      progress: 0,
      type: 'video',
    };
    setTasks(prevTasks => [newTask, ...prevTasks]); // Add to the beginning of the list
    setCurrentStatusMessage(`视频 ${getFileName(inputFile)} 已加入队列...`);

    try {
      // Update status to compressing right before invoke
      setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? {...t, status: 'compressing'} : t));
      const successMessage = await invoke<string>("compress_video", {
        inputPath: inputFile, // This is used as task_id in Rust
        outputPath: outputFile,
        settings: videoSettings,
      });
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: 'completed', progress: 100 } : task
        )
      );
      setCurrentStatusMessage(successMessage);
    } catch (error) {
      console.error("视频压缩处理失败:", error);
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: 'failed', error: String(error) } : task
        )
      );
      setCurrentStatusMessage(`视频 ${getFileName(inputFile)} 处理失败: ${String(error).substring(0,100)}`);
    }
  };

  const startAudioCompression = async () => {
    if (!inputFile || !outputFile) {
      setCurrentStatusMessage("请先选择输入和输出文件。");
      return;
    }
    if (tasks.find(task => task.id === inputFile && (task.status === 'compressing' || task.status === 'pending'))) {
      setCurrentStatusMessage(`任务 ${getFileName(inputFile)} 已在队列中或正在处理。`);
      return;
    }

    const taskId = inputFile;
    const newTask: Task = {
      id: taskId,
      inputFile,
      outputFile,
      status: 'pending',
      progress: 0,
      type: 'audio',
    };
    setTasks(prevTasks => [newTask, ...prevTasks]);
    setCurrentStatusMessage(`音频 ${getFileName(inputFile)} 已加入队列...`);

    try {
      setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? {...t, status: 'compressing'} : t));
      const successMessage = await invoke<string>("compress_audio", {
        inputPath: inputFile,
        outputPath: outputFile,
        settings: audioSettings,
      });
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: 'completed', progress: 100 } : task
        )
      );
      setCurrentStatusMessage(successMessage);
    } catch (error) {
      console.error("音频压缩处理失败:", error);
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: 'failed', error: String(error) } : task
        )
      );
      setCurrentStatusMessage(`音频 ${getFileName(inputFile)} 处理失败: ${String(error).substring(0,100)}`);
    }
  };

  const startImageCompression = async () => {
    if (!inputFile || !outputFile) {
      setCurrentStatusMessage("请先选择输入和输出文件。");
      return;
    }
    if (tasks.find(task => task.id === inputFile && (task.status === 'compressing' || task.status === 'pending'))) {
      setCurrentStatusMessage(`任务 ${getFileName(inputFile)} 已在队列中或正在处理。`);
      return;
    }

    const taskId = inputFile;
    const newTask: Task = {
      id: taskId,
      inputFile,
      outputFile,
      status: 'pending',
      progress: 0,
      type: 'image',
    };
    setTasks(prevTasks => [newTask, ...prevTasks]);
    setCurrentStatusMessage(`图片 ${getFileName(inputFile)} 已加入队列...`);

    try {
      setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? {...t, status: 'compressing'} : t));
      const successMessage = await invoke<string>("compress_image", {
        inputPath: inputFile, // Corrected, was: inputPath: inputFile,
        outputPath: outputFile,
        settings: imageSettings,
      });
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: 'completed', progress: 100 } : task
        )
      );
      setCurrentStatusMessage(successMessage);
    } catch (error) {
      console.error("图片压缩处理失败:", error);
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: 'failed', error: String(error) } : task
        )
      );
      setCurrentStatusMessage(`图片 ${getFileName(inputFile)} 处理失败: ${String(error).substring(0,100)}`);
    }
  };

  const baseLinkClass = "flex items-center px-4 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30";
  const activeLinkClass = "flex items-center px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-500 font-medium";

  // Find the task that corresponds to the currently selected inputFile for display in the main UI
  const currentFileTask = tasks.find(task => task.id === inputFile);
  // Disable start button if current file is already compressing or pending
  const isCurrentFileProcessing = !!currentFileTask && (currentFileTask.status === 'compressing' || currentFileTask.status === 'pending');


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
          
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveView('video'); setInputFile(null); setCurrentStatusMessage("准备就绪");}}
             className={activeView === 'video' ? activeLinkClass : baseLinkClass}>
            <svg className={`w-6 h-6 mr-3 ${activeView === 'video' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h18M3 16h18"></path>
            </svg>
            <span>视频压缩</span>
          </a>
          
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveView('audio'); setInputFile(null); setCurrentStatusMessage("准备就绪");}}
             className={activeView === 'audio' ? activeLinkClass : baseLinkClass}>
            <svg className={`w-6 h-6 mr-3 ${activeView === 'audio' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
            </svg>
            <span>音频压缩</span>
          </a>
          
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveView('image'); setInputFile(null); setCurrentStatusMessage("准备就绪");}}
             className={activeView === 'image' ? activeLinkClass : baseLinkClass}>
            <svg className={`w-6 h-6 mr-3 ${activeView === 'image' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span>图片压缩</span>
          </a>

          <div className="mt-8 px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">我的任务</div>
           <div className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400">
            进行中: {tasks.filter(t => t.status === 'compressing' || t.status === 'pending').length} |
            已完成: {tasks.filter(t => t.status === 'completed').length} |
            失败: {tasks.filter(t => t.status === 'failed').length}
          </div>
          {/* Basic task list in sidebar - could be expanded or moved to main view */}
          {tasks.slice(0,5).map(task => ( // Show first 5 tasks
             <div key={task.id} className="px-4 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30" title={task.inputFile}>
               {getFileName(task.inputFile)}: {task.status} ({task.progress.toFixed(0)}%)
             </div>
           ))}
        </nav>
      </aside>

      {/* 右侧内容区 */}
      <main className="flex-1 overflow-auto p-6">
        {/* Current file interaction UI */}
        {activeView === 'video' && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">视频压缩</h1>
               <p className="text-sm text-gray-600 dark:text-gray-400">{currentStatusMessage}</p>
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
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs" title={inputFile}>{getFileName(inputFile)}</p>
                          </div>
                          <button onClick={() => { setInputFile(null); setCurrentStatusMessage("准备就绪"); }} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">更换文件</button>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">压缩设置</h3>
                        <CompressionSettings onSettingsChange={handleVideoSettingsChange} />
                      </div>
                      {currentFileTask && (currentFileTask.status === 'compressing' || currentFileTask.status === 'pending' || currentFileTask.status === 'finishing') ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                          <ProgressBar progress={currentFileTask.progress} infoText={`${currentFileTask.status} - ${getFileName(currentFileTask.inputFile)}`} />
                        </div>
                      ) : (
                        <div className="flex justify-center mt-4">
                          <button onClick={startVideoCompression} disabled={isCurrentFileProcessing || !inputFile} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">开始压缩</button>
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
               <p className="text-sm text-gray-600 dark:text-gray-400">{currentStatusMessage}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden col-span-1 md:col-span-2 lg:col-span-3">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                   <div className="flex items-center">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
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
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs" title={inputFile}>{getFileName(inputFile)}</p>
                          </div>
                           <button onClick={() => { setInputFile(null); setCurrentStatusMessage("准备就绪"); }} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">更换文件</button>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">压缩设置</h3>
                        <AudioCompressionSettingsComponent onSettingsChange={handleAudioSettingsChange} initialQuality={audioSettings.quality} />
                      </div>
                      {currentFileTask && (currentFileTask.status === 'compressing' || currentFileTask.status === 'pending' || currentFileTask.status === 'finishing') ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                          <ProgressBar progress={currentFileTask.progress} infoText={`${currentFileTask.status} - ${getFileName(currentFileTask.inputFile)}`} />
                        </div>
                      ) : (
                        <div className="flex justify-center mt-4">
                          <button onClick={startAudioCompression} disabled={isCurrentFileProcessing || !inputFile} className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">开始压缩</button>
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
               <p className="text-sm text-gray-600 dark:text-gray-400">{currentStatusMessage}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden col-span-1 md:col-span-2 lg:col-span-3">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
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
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs" title={inputFile}>{getFileName(inputFile)}</p>
                          </div>
                          <button onClick={() => { setInputFile(null); setCurrentStatusMessage("准备就绪"); }} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">更换文件</button>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">压缩设置</h3>
                        <ImageCompressionSettingsComponent onSettingsChange={handleImageSettingsChange} initialQuality={imageSettings.quality} />
                      </div>
                      {currentFileTask && (currentFileTask.status === 'compressing' || currentFileTask.status === 'pending' || currentFileTask.status === 'finishing') ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                          <ProgressBar progress={currentFileTask.progress} infoText={`${currentFileTask.status} - ${getFileName(currentFileTask.inputFile)}`} />
                        </div>
                      ) : (
                        <div className="flex justify-center mt-4">
                          <button onClick={startImageCompression} disabled={isCurrentFileProcessing || !inputFile} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">开始压缩</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Task List Display Area */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">任务队列 ({tasks.length})</h2>
          <TaskList tasks={tasks} getFileName={getFileName} />
        </div>
    </main>
    </div>
  );
}

export default App;
