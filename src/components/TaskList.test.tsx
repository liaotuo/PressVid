import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TaskList, Task, ActiveView } from './TaskList'; // Adjust path as necessary
import { vi } from 'vitest'; // Or jest if using Jest

// Mock ProgressBar to simplify TaskList tests
vi.mock('./ProgressBar', () => ({
  ProgressBar: ({ progress, infoText }: { progress: number; infoText?: string }) => (
    <div data-testid="progressbar">
      <span>Progress: {progress}%</span>
      {infoText && <span>Info: {infoText}</span>}
    </div>
  ),
}));

const mockGetFileName = (path: string) => path.split(/[\\/]/).pop() || path;

describe('TaskList Component', () => {
  const tasksBase: Omit<Task, 'id' | 'type' | 'inputFile' | 'outputFile'> = {
    status: 'compressing',
    progress: 0,
  };

  test('renders "no tasks" message when tasks array is empty', () => {
    render(<TaskList tasks={[]} getFileName={mockGetFileName} />);
    expect(screen.getByText('当前没有任务。')).toBeInTheDocument();
  });

  const sampleTasks: Task[] = [
    { ...tasksBase, id: '1', inputFile: '/path/to/video.mp4', outputFile: '/path/to/video_compressed.mp4', type: 'video', status: 'compressing', progress: 50 },
    { ...tasksBase, id: '2', inputFile: '/path/to/audio.mp3', outputFile: '/path/to/audio_compressed.mp3', type: 'audio', status: 'completed', progress: 100 },
    { ...tasksBase, id: '3', inputFile: '/path/to/image.jpg', outputFile: '/path/to/image_compressed.jpg', type: 'image', status: 'failed', progress: 0, error: 'Compression failed' },
    { ...tasksBase, id: '4', inputFile: 'another_image.png', outputFile: 'another_image_compressed.png', type: 'image', status: 'pending', progress: 0 },
  ];

  test('renders a list of tasks', () => {
    render(<TaskList tasks={sampleTasks} getFileName={mockGetFileName} />);

    expect(screen.getByText('video.mp4 (video)')).toBeInTheDocument();
    expect(screen.getByText('audio.mp3 (audio)')).toBeInTheDocument();
    expect(screen.getByText('image.jpg (image)')).toBeInTheDocument();
    expect(screen.getByText('another_image.png (image)')).toBeInTheDocument();

    // Check for progress/info text from mocked ProgressBar
    // For task 1 (compressing)
    const task1Progress = screen.getAllByTestId('progressbar').find(el => el.textContent?.includes('Progress: 50%'));
    expect(task1Progress).toBeInTheDocument();
    expect(task1Progress).toHaveTextContent('Info: 50%');

    // For task 2 (completed)
    const task2Progress = screen.getAllByTestId('progressbar').find(el => el.textContent?.includes('Progress: 100%'));
    expect(task2Progress).toBeInTheDocument();
    expect(task2Progress).toHaveTextContent('Info: 100%');
    expect(screen.getByText('输出: audio_compressed.mp3')).toBeInTheDocument();

    // For task 3 (failed)
    expect(screen.getByText('错误: Compression failed...')).toBeInTheDocument(); // substring match due to truncation

    // For task 4 (pending) - ProgressBar might not be shown or show 0%
     const task4Container = screen.getByText('another_image.png (image)').closest('div');
     // Check that progressbar is not in the pending task container, or if it is, it shows 0% and no specific info text from progress.
     // Based on current TaskList logic: (task.status === 'compressing' || task.status === 'finishing' || task.status === 'completed')
     // So, pending tasks should not render the ProgressBar.
     const task4ProgressDiv = Array.from(task4Container?.querySelectorAll('[data-testid="progressbar"]') || []);
     expect(task4ProgressDiv.length).toBe(0);

  });

  test('displays correct status badges', () => {
    render(<TaskList tasks={sampleTasks} getFileName={mockGetFileName} />);
    expect(screen.getByText('compressing')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });
});
