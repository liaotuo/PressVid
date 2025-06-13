import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App'; // Adjust path as necessary
import { vi } from 'vitest'; // Or jest

// Mock Tauri APIs
const mockInvoke = vi.fn();
let eventListeners: Record<string, ((event: any) => void)[]> = {};
const mockListen = vi.fn((eventKey: string, callback: (event: any) => void) => {
  if (!eventListeners[eventKey]) {
    eventListeners[eventKey] = [];
  }
  eventListeners[eventKey].push(callback);
  return Promise.resolve(() => { // Return an unlisten function
    eventListeners[eventKey] = eventListeners[eventKey].filter(cb => cb !== callback);
  });
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, handler: (event: any) => void) => mockListen(event, handler),
}));

// Mock child components that are not the focus of this integration test
vi.mock('./components/ThemeToggle', () => ({ ThemeToggle: () => <div data-testid="theme-toggle-mock">ThemeToggle</div> }));
vi.mock('./components/DropZone', () => ({ DropZone: ({onFileSelect}: {onFileSelect: (path: string) => void}) => <button data-testid="dropzone-mock" onClick={() => onFileSelect("/test/dummy-video.mp4")}>Select File</button> }));
vi.mock('./components/CompressionSettings', () => ({ CompressionSettings: () => <div data-testid="video-settings-mock">VideoSettings</div> }));
vi.mock('./components/AudioCompressionSettings', () => ({ AudioCompressionSettingsComponent: () => <div data-testid="audio-settings-mock">AudioSettings</div> }));
vi.mock('./components/ImageCompressionSettings', () => ({ ImageCompressionSettingsComponent: () => <div data-testid="image-settings-mock">ImageSettings</div> }));
// ProgressBar is part of TaskList, which we will observe indirectly through App's state affecting TaskList's props.

// Helper to simulate progress event emission
const emitProgressEvent = (taskId: string, progress: number) => {
  if (eventListeners['PROGRESS_EVENT']) {
    eventListeners['PROGRESS_EVENT'].forEach(callback => {
      callback({
        event: 'PROGRESS_EVENT',
        payload: { task_id: taskId, progress },
        windowLabel: 'main', // or appropriate window label
        id: Math.random(), // event ID
      });
    });
  }
};


describe('App Component - Integration Tests (Task Management & Progress Reporting)', () => {
  beforeEach(() => {
    // Reset mocks and listeners before each test
    mockInvoke.mockReset();
    eventListeners = {};
    // Mock successful initial file selection dialog if any component tries to use it on render
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "select_video_file" || cmd === "select_audio_file" || cmd === "select_image_file") {
        return Promise.resolve("/test/dummy-initial.file");
      }
      return Promise.resolve("Mocked success");
    });
  });

  test('should add a task, simulate progress, and complete a video compression task', async () => {
    render(<App />);

    // 1. Select video view (it's default, but good to be explicit if it changes)
    // (Assuming video is the default view and no click is needed)

    // 2. Simulate file selection via DropZone mock
    await act(async () => {
      fireEvent.click(screen.getByTestId('dropzone-mock'));
    });

    // Check if file is selected (App's inputFile state)
    // We can't directly check App's state, so we look for UI changes.
    // The "Start Compression" button for video should become enabled or visible.
    // And the selected file name should appear.
    expect(screen.getByText('dummy-video.mp4 (video)')).toBeInTheDocument(); // This is in TaskList, check after starting
    // Let's check for the "Start Compression" button for video
    const startButton = screen.getByRole('button', { name: /开始压缩/i }); // General "Start Compression"
    expect(startButton).not.toBeDisabled();

    // 3. Mock successful invocation for compress_video
    mockInvoke.mockResolvedValueOnce("Video compression successful!");

    // 4. Click "Start Compression"
    await act(async () => {
      fireEvent.click(startButton);
    });

    // Verify 'compress_video' was called
    expect(mockInvoke).toHaveBeenCalledWith("compress_video", expect.objectContaining({
      inputPath: "/test/dummy-video.mp4",
      // other params like outputPath, settings
    }));

    // Check if task appears in the task list (rendered by TaskList via App's state)
    // TaskList will show the file name and type.
    expect(screen.getByText('dummy-video.mp4 (video)')).toBeInTheDocument();
    // Initial status should be 'compressing' or 'pending' then 'compressing'
    expect(screen.getByText((content, element) => {
        // Allow matching 'pending' or 'compressing' for the initial state after clicking start
        return (content.includes('compressing') || content.includes('pending')) && element?.tagName.toLowerCase() === 'span';
    })).toBeInTheDocument();


    // 5. Simulate progress events
    await act(async () => {
      emitProgressEvent("/test/dummy-video.mp4", 30);
    });
    // TaskList uses ProgressBar, which gets infoText from progress.
    // The mocked ProgressBar in TaskList.test.tsx shows "Info: 30%"
    // Here, the real ProgressBar is used by TaskList. It has its own structure.
    // We check for the progress bar value if possible, or the status text update.
    // The TaskList itself shows "30%" as part of its infoText to ProgressBar
    expect(screen.getByText('30%')).toBeInTheDocument();


    await act(async () => {
      emitProgressEvent("/test/dummy-video.mp4", 70);
    });
    expect(screen.getByText('70%')).toBeInTheDocument();

    // 6. Simulate completion (invoke promise resolves)
    // The mockInvoke for compress_video is already set to resolve.
    // We need to wait for the state updates after the promise resolution.
    await waitFor(() => {
      // Status should be 'completed'
      expect(screen.getByText('completed')).toBeInTheDocument();
      // Progress should be 100%
      expect(screen.getByText('100%')).toBeInTheDocument();
      // Success message from invoke might be displayed as currentStatusMessage
      expect(screen.getByText("Video compression successful!")).toBeInTheDocument();
      // TaskList should show output file
      expect(screen.getByText('输出: dummy-video_compressed.mp4')).toBeInTheDocument();
    });
  });

  test('should handle a failed compression task', async () => {
    render(<App />);

    // Simulate file selection
    await act(async () => {
      fireEvent.click(screen.getByTestId('dropzone-mock'));
    });

    // Mock failed invocation for compress_video
    mockInvoke.mockRejectedValueOnce("ffmpeg error");

    // Click "Start Compression"
    const startButton = screen.getByRole('button', { name: /开始压缩/i });
    await act(async () => {
      fireEvent.click(startButton);
    });

    // Wait for failure state
    await waitFor(() => {
      expect(screen.getByText('failed')).toBeInTheDocument();
      // Error message from invoke (or a generic one)
      expect(screen.getByText(/处理失败: ffmpeg error/i)).toBeInTheDocument(); // currentStatusMessage
      // TaskList should show the error for the task
      expect(screen.getByText('错误: ffmpeg error...')).toBeInTheDocument(); // Task error (substring)
    });
  });
});
