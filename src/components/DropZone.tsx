import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface DropZoneProps {
  onFileSelect: (filePath: string) => void;
}

export function DropZone({ onFileSelect }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    // 在实际应用中，这里需要通过 Tauri API 处理文件路径
    // 这里只是一个示例
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // 由于浏览器安全限制，我们只能获取文件名，而不是完整路径
      // 实际应用中需要通过 Tauri API 处理
      onFileSelect(file.name);
    }
  };

  const handleFileSelect = async () => {
    try {
      // 使用 Tauri 的命令调用 Rust 端的文件选择功能
      // 注意：需要在 Rust 端实现 select_video_file 命令
      const filePath = await invoke<string>("select_video_file");
      
      if (filePath) {
        onFileSelect(filePath);
      }
    } catch (error) {
      console.error('选择文件出错:', error);
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
        <span className="font-medium">点击选择</span> 或拖放视频文件到这里
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        支持 MP4, MOV, AVI, MKV, WMV, FLV 格式
      </p>
      <button
        onClick={handleFileSelect}
        className="mt-3 px-4 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
      >
        选择视频
      </button>
    </div>
  );
} 