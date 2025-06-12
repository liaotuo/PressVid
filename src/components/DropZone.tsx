import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';

// 扩展File接口，添加Tauri特有的path属性
interface TauriFile extends File {
  path?: string;
}

interface DropZoneProps {
  onFileSelect: (filePath: string) => void;
  prompt: string;
}

export function DropZone({ onFileSelect, prompt }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  // 监听文件拖放事件
  useEffect(() => {
    // 设置文件拖放监听
    const handleFileDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0] as TauriFile;
        if (file.path) {
          handleDroppedFile(file.path);
        }
      }
    };

    // 添加全局拖放事件监听器
    document.addEventListener('drop', handleFileDrop);
    document.addEventListener('dragover', (e) => e.preventDefault());

    return () => {
      // 清理事件监听器
      document.removeEventListener('drop', handleFileDrop);
      document.removeEventListener('dragover', (e) => e.preventDefault());
    };
  }, [onFileSelect]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    // 在Tauri应用中处理拖放的文件
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0] as TauriFile;
      // 在Tauri中，我们可以通过file.path获取完整路径
      if (file.path) {
        handleDroppedFile(file.path);
      } else {
        console.error('无法获取文件路径，可能是浏览器安全限制');
        // 如果无法直接获取路径，回退到文件选择对话框
        await handleFileSelect();
      }
    }
  };

  const handleDroppedFile = async (filePath: string) => {
    try {
      // 调用Rust后端处理拖放的文件
      const result = await invoke<string>("handle_dropped_file", { filePath });
      if (result) {
        onFileSelect(result);
      }
    } catch (error) {
      console.error('处理拖放文件出错:', error);
    }
  };

  const handleFileSelect = async () => {
    if (isSelecting) return; // 防止重复点击
    
    try {
      setIsSelecting(true);
      // 使用Tauri的命令调用Rust端的文件选择功能
      const filePath = await invoke<string>("select_video_file");
      
      if (filePath) {
        onFileSelect(filePath);
      }
    } catch (error) {
      console.error('选择文件出错:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-center w-full h-56 border border-dashed rounded-md transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 bg-gray-50 dark:bg-gray-800/30 dark:border-gray-600'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-3 text-blue-500"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className="mb-2 text-sm text-center text-gray-700 dark:text-gray-300">
        <span className="font-medium">点击选择</span> 或拖放文件到这里
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {prompt}
      </p>
      <button
        onClick={handleFileSelect}
        disabled={isSelecting}
        className={`mt-3 px-4 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors ${
          isSelecting ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isSelecting ? '选择中...' : '选择文件'}
      </button>
    </div>
  );
} 