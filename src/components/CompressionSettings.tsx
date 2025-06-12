import { useState } from 'react';

interface CompressionSettingsProps {
  onSettingsChange: (settings: CompressionSettings) => void;
}

export interface CompressionSettings {
  preset: string;
  resolution: string;
  bitrate: string;
  audioQuality: string;
  customSettings: boolean;
  crfValue: number;
}

export function CompressionSettings({ onSettingsChange }: CompressionSettingsProps) {
  const [settings, setSettings] = useState<CompressionSettings>({
    preset: 'balanced',
    resolution: '720p',
    bitrate: '2000', // Retain for non-custom or as a fallback if needed
    audioQuality: 'medium',
    customSettings: false,
    crfValue: 23, // Default CRF value
  });

  const handlePresetChange = (preset: string) => {
    const newSettings = { ...settings, preset, customSettings: false }; // Presets disable custom settings
    
    // 根据预设自动调整其他参数
    switch (preset) {
      case 'small':
        newSettings.resolution = '480p';
        newSettings.bitrate = '1000'; // Bitrate might be ignored by backend if CRF is used, but set for consistency
        newSettings.audioQuality = 'low';
        newSettings.crfValue = 28;
        break;
      case 'balanced':
        newSettings.resolution = '720p';
        newSettings.bitrate = '2000';
        newSettings.audioQuality = 'medium';
        newSettings.crfValue = 23;
        break;
      case 'high':
        newSettings.resolution = '1080p';
        newSettings.bitrate = '4000';
        newSettings.audioQuality = 'high';
        newSettings.crfValue = 18;
        break;
    }
    
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleSettingChange = (key: keyof CompressionSettings, value: string | boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    // Ensure crfValue is a number
    if (key === 'crfValue' && typeof value === 'string') {
      newSettings.crfValue = parseInt(value, 10);
    }
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">压缩预设</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.preset === 'small'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('small')}
          >
            小体积
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.preset === 'balanced'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('balanced')}
          >
            均衡
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.preset === 'high'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('high')}
          >
            高质量
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="customSettings"
          checked={settings.customSettings}
          onChange={(e) => handleSettingChange('customSettings', e.target.checked)}
          className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
        />
        <label htmlFor="customSettings" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          自定义设置
        </label>
      </div>

      {settings.customSettings && (
        <div className="space-y-3 pt-2">
          <div>
            <label htmlFor="resolution" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              分辨率
            </label>
            <select
              id="resolution"
              value={settings.resolution}
              onChange={(e) => handleSettingChange('resolution', e.target.value)}
              className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
            >
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="original">保持原始分辨率</option>
            </select>
          </div>

          <div>
            <div>
              <label htmlFor="crfValue" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Quality (CRF Value)
              </label>
              <input
                type="number"
                id="crfValue"
                value={settings.crfValue}
                onChange={(e) => handleSettingChange('crfValue', e.target.value)}
                className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
                min="0"
                max="51"
                step="1"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Lower values mean better quality and larger file size. 0 is lossless. 18-28 is a good range.
              </p>
            </div>

            {/* Bitrate input is hidden when custom settings and CRF are active */}
            {!settings.customSettings && ( // Or some other logic if bitrate is still relevant
            <div>
              <label htmlFor="bitrate" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                视频码率 (kbps) - (Will be ignored if CRF is used)
              </label>
              <input
                type="number"
                id="bitrate"
                value={settings.bitrate}
                onChange={(e) => handleSettingChange('bitrate', e.target.value)}
                className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
                min="500"
                max="10000"
                step="100"
              />
            </div>
            )

          <div>
            <label htmlFor="audioQuality" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              音频质量
            </label>
            <select
              id="audioQuality"
              value={settings.audioQuality}
              onChange={(e) => handleSettingChange('audioQuality', e.target.value)}
              className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
            >
              <option value="low">低 (96kbps)</option>
              <option value="medium">中 (128kbps)</option>
              <option value="high">高 (192kbps)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
} 