interface ProgressBarProps {
  progress: number;
  infoText?: string; // Changed from 'status' to 'infoText' and made optional
}

export function ProgressBar({ progress, infoText }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
        <span>压缩进度</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-300 ease-out" // Consider making color a prop if more variance needed
          style={{ width: `${progress}%` }}
        />
      </div>
      {infoText && ( // Only render if infoText is provided
        <p className="text-xs text-gray-500 dark:text-gray-400">{infoText}</p>
      )}
    </div>
  );
} 