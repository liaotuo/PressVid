import { useState } from 'react';

interface CompressionSettingsProps {
  onSettingsChange: (settings: CompressionSettings) => void;
}

export type PresetType = 'quality' | 'vbr' | 'cbr' | 'scale' | 'targetSize';

export interface CompressionSettings {
  preset: string; // Existing preset names like 'small', 'balanced', 'high' or new ones
  presetType: PresetType; // To distinguish new preset categories
  resolution: string; // e.g., '480p', '720p', '1080p', 'original', or custom like '1280x720'
  bitrate: string; // For CBR or as a general quality indicator if not using CRF
  audioQuality: string;
  customSettings: boolean;
  crfValue: number; // For VBR/quality-based encoding
  targetBitrate: string; // For CBR preset
  scalePercentage: string; // For scale preset (e.g., "50%")
  targetSizeMB: string; // For target file size preset
}

export function CompressionSettings({ onSettingsChange }: CompressionSettingsProps) {
  const [settings, setSettings] = useState<CompressionSettings>({
    preset: 'balanced', // Default preset
    presetType: 'quality', // Default preset type
    resolution: '720p',
    bitrate: '2000',
    audioQuality: 'medium',
    customSettings: false,
    crfValue: 23,
    targetBitrate: '1000', // Default for CBR if selected
    scalePercentage: '50', // Default for scaling if selected
    targetSizeMB: '100', // Default for target size if selected
  });

  const handlePresetChange = (preset: string, presetType: PresetType = 'quality') => {
    let newSettings: CompressionSettings = {
      ...settings,
      preset,
      presetType,
      customSettings: false
    };

    // Reset specific fields based on preset type or apply defaults
    if (presetType === 'quality') {
      switch (preset) {
        case 'small':
          newSettings = {
            ...newSettings,
            resolution: '480p',
            audioQuality: 'low',
            crfValue: 28,
            bitrate: '1000', // Fallback/indicative
          };
          break;
        case 'balanced':
          newSettings = {
            ...newSettings,
            resolution: '720p',
            audioQuality: 'medium',
            crfValue: 23,
            bitrate: '2000', // Fallback/indicative
          };
          break;
        case 'high':
          newSettings = {
            ...newSettings,
            resolution: '1080p',
            audioQuality: 'high',
            crfValue: 18,
            bitrate: '4000', // Fallback/indicative
          };
          break;
      }
    } else if (presetType === 'vbr') {
        // For VBR, we primarily rely on CRF. We can have sub-presets for VBR.
        // Example: 'vbr_high_quality' (low CRF), 'vbr_balanced' (medium CRF)
        // For now, let's assume 'vbr' preset itself means user will set CRF, or we set a default.
        newSettings.crfValue = 22; // A good general VBR starting point
        newSettings.resolution = 'original';
    } else if (presetType === 'cbr') {
        newSettings.resolution = 'original';
        // targetBitrate will be set by user input, default is already in state
    } else if (presetType === 'scale') {
        // scalePercentage will be set by user input, resolution might be set to 'custom' or handled by backend
        newSettings.resolution = 'original'; // Or could be 'custom' and let user input exact dimensions
    } else if (presetType === 'targetSize') {
        newSettings.resolution = 'original';
        // targetSizeMB will be set by user input
    }
    
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleSettingChange = (key: keyof CompressionSettings, value: string | boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    // Ensure numeric fields are numbers
    if ((key === 'crfValue' || key === 'targetBitrate' || key === 'targetSizeMB' || key === 'scalePercentage') && typeof value === 'string') {
      // For scalePercentage, allow decimal, otherwise parseInt
      newSettings[key] = key === 'scalePercentage' ? parseFloat(value) : parseInt(value, 10);
    }
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">压缩模式</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* Quality Presets */}
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.presetType === 'quality' && settings.preset === 'small'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('small', 'quality')}
          >
            小体积
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.presetType === 'quality' && settings.preset === 'balanced'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('balanced', 'quality')}
          >
            均衡
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.presetType === 'quality' && settings.preset === 'high'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('high', 'quality')}
          >
            高质量
          </button>
           <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.presetType === 'vbr'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('vbr_default', 'vbr')}
          >
            可变比特率 (VBR)
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.presetType === 'cbr'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('cbr_default', 'cbr')}
          >
            固定比特率 (CBR)
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.presetType === 'scale'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('scale_default', 'scale')}
          >
            更改分辨率
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded text-center text-sm ${
              settings.presetType === 'targetSize'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => handlePresetChange('targetSize_default', 'targetSize')}
          >
            目标文件大小
          </button>
        </div>
      </div>

      {/* Conditional Inputs based on PresetType */}
      {settings.presetType === 'vbr' && (
        <div>
          <label htmlFor="crfValue" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            质量 (CRF Value) <span className="text-xs">(VBR)</span>
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
            CRF越低，质量越好，文件越大。0是无损。18-28是不错的范围。VBR模式处理较慢。
          </p>
        </div>
      )}

      {settings.presetType === 'cbr' && (
        <div>
          <label htmlFor="targetBitrate" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            目标视频比特率 (kbps) <span className="text-xs">(CBR)</span>
          </label>
          <input
            type="number"
            id="targetBitrate"
            value={settings.targetBitrate}
            onChange={(e) => handleSettingChange('targetBitrate', e.target.value)}
            className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
            min="100"
            step="100"
          />
           <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            恒定比特率，适用于对文件比特率有严格要求的场景。
          </p>
        </div>
      )}

      {settings.presetType === 'scale' && (
         <div>
          <label htmlFor="scalePercentage" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            缩放比例 (%) <span className="text-xs">(例如 50 表示缩小一半)</span>
          </label>
          <input
            type="number"
            id="scalePercentage"
            value={settings.scalePercentage}
            onChange={(e) => handleSettingChange('scalePercentage', e.target.value)}
            className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
            min="10"
            max="100" // Typically scaling down, but allow up to original size
            step="1"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            按百分比降低视频分辨率。例如输入50，则分辨率宽高各缩小一半。
          </p>
        </div>
        // TODO: Optionally add inputs for specific width/height if desired over percentage
      )}

      {settings.presetType === 'targetSize' && (
        <div>
          <label htmlFor="targetSizeMB" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            目标文件大小 (MB)
          </label>
          <input
            type="number"
            id="targetSizeMB"
            value={settings.targetSizeMB}
            onChange={(e) => handleSettingChange('targetSizeMB', e.target.value)}
            className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
            min="1"
            step="1"
          />
           <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            将视频文件压缩到指定大小。此模式处理时间可能较长。
          </p>
        </div>
      )}

      {/* Common settings like Audio Quality, shown if not a specific preset that overrides them, or if custom settings are on */}
      {settings.presetType === 'quality' || settings.presetType === 'vbr' || settings.presetType === 'cbr' || settings.customSettings ? (
      <div>
        <label htmlFor="audioQuality" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          音频质量
        </label>
        <select
          id="audioQuality"
          value={settings.audioQuality}
          onChange={(e) => handleSettingChange('audioQuality', e.target.value)}
          className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
          disabled={settings.customSettings && (settings.presetType === 'scale' || settings.presetType === 'targetSize')}
        >
          <option value="low">低 (96kbps)</option>
          <option value="medium">中 (128kbps)</option>
          <option value="high">高 (192kbps)</option>
        </select>
      </div>
      ) : null}


      <div className="flex items-center space-x-2 pt-2">
        <input
          type="checkbox"
          id="customSettings"
          checked={settings.customSettings}
          onChange={(e) => handleSettingChange('customSettings', e.target.checked)}
          className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
        />
        <label htmlFor="customSettings" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          自定义详细参数
        </label>
      </div>

      {settings.customSettings && (
        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">自定义参数将覆盖所选预设的部分默认行为。</p>
          <div>
            <label htmlFor="customResolution" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              自定义分辨率
            </label>
            <select
              id="customResolution"
              value={settings.resolution} // Still uses the main resolution state
              onChange={(e) => handleSettingChange('resolution', e.target.value)}
              className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
            >
              <option value="original">保持原始分辨率</option>
              <option value="480p">480p (854x480)</option>
              <option value="720p">720p (1280x720)</option>
              <option value="1080p">1080p (1920x1080)</option>
              {/* Consider adding a "custom" option to input width/height manually if needed */}
            </select>
          </div>

          {/* Show CRF slider if custom settings are on, AND current preset is NOT CBR */}
          {settings.presetType !== 'cbr' && (
            <div>
              <label htmlFor="customCrfValue" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                自定义质量 (CRF Value)
              </label>
              <input
                type="number"
                id="customCrfValue"
                value={settings.crfValue} // Still uses the main crfValue state
                onChange={(e) => handleSettingChange('crfValue', e.target.value)}
                className="w-full rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-1.5 text-sm"
                min="0"
                max="51"
                step="1"
                disabled={settings.presetType === 'cbr'} // Explicitly disable if CBR, even if somehow shown
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                数值越低，质量越好，文件越大。仅当预设模式不为“固定比特率(CBR)”时可用。
              </p>
            </div>
          )}

          {/* Audio quality can always be customized if customSettings is true */}
          <div>
            <label htmlFor="customAudioQuality" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              自定义音频质量
            </label>
            <select
              id="customAudioQuality"
              value={settings.audioQuality} // Still uses the main audioQuality state
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