import { useState, useEffect } from 'react';

export interface AudioCompressionSettings {
  quality: string;
}

interface AudioCompressionSettingsProps {
  onSettingsChange: (settings: AudioCompressionSettings) => void;
  initialQuality?: string;
}

export function AudioCompressionSettingsComponent({
  onSettingsChange,
  initialQuality = 'medium',
}: AudioCompressionSettingsProps) {
  const [quality, setQuality] = useState<string>(initialQuality);

  useEffect(() => {
    onSettingsChange({ quality });
  }, [quality, onSettingsChange]);

  const handleQualityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setQuality(event.target.value);
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="audioQuality" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          音频质量
        </label>
        <select
          id="audioQuality"
          value={quality}
          onChange={handleQualityChange}
          className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
        >
          <option value="low">低 (e.g., 96kbps)</option>
          <option value="medium">中 (e.g., 128kbps)</option>
          <option value="high">高 (e.g., 192kbps)</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          选择期望的音频质量。具体比特率可能因编码器而异。
        </p>
      </div>
    </div>
  );
}
