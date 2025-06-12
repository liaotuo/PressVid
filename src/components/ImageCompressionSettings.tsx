import { useState, useEffect } from 'react';

export interface ImageCompressionSettings {
  quality: number; // Typically 0-100 for images
}

interface ImageCompressionSettingsProps {
  onSettingsChange: (settings: ImageCompressionSettings) => void;
  initialQuality?: number;
}

export function ImageCompressionSettingsComponent({
  onSettingsChange,
  initialQuality = 75, // A common default quality
}: ImageCompressionSettingsProps) {
  const [quality, setQuality] = useState<number>(initialQuality);

  useEffect(() => {
    onSettingsChange({ quality });
  }, [quality, onSettingsChange]);

  const handleQualityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuality = parseInt(event.target.value, 10);
    if (!isNaN(newQuality) && newQuality >= 0 && newQuality <= 100) {
      setQuality(newQuality);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="imageQuality" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          图片质量 ({quality})
        </label>
        <input
          type="range"
          id="imageQuality"
          min="0"
          max="100"
          value={quality}
          onChange={handleQualityChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          选择期望的图片质量。较低的值会显著减小文件大小但可能降低图片清晰度。
        </p>
      </div>
    </div>
  );
}
