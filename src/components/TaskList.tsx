import React from 'react';
import { ProgressBar } from './ProgressBar'; // Assuming ProgressBar is in the same directory

// Define Task and ActiveView types (can be moved to a shared types.ts later)
export type ActiveView = 'video' | 'audio' | 'image';

export interface Task {
  id: string;
  inputFile: string;
  outputFile: string;
  status: 'pending' | 'compressing' | 'completed' | 'failed' | 'finishing';
  progress: number;
  type: ActiveView;
  error?: string;
}

interface TaskListProps {
  tasks: Task[];
  getFileName: (path: string) => string; // Pass getFileName as a prop
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, getFileName }) => {
  if (tasks.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">当前没有任务。</p>;
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
      {tasks.map(task => (
        <div key={task.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-md" title={task.inputFile}>
              {getFileName(task.inputFile)} ({task.type})
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              task.status === 'completed' ? 'bg-green-100 dark:bg-green-700 text-green-700 dark:text-green-100' :
              task.status === 'failed' ? 'bg-red-100 dark:bg-red-700 text-red-700 dark:text-red-100' :
              task.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-700 text-yellow-700 dark:text-yellow-100' :
              'bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-100' // compressing or finishing
            }`}>
              {task.status}
            </span>
          </div>
          {(task.status === 'compressing' || task.status === 'finishing' || task.status === 'completed') && (
            <ProgressBar progress={task.progress} infoText={`${task.progress.toFixed(0)}%`} />
          )}
          {task.status === 'failed' && task.error && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1" title={task.error}>
              错误: {task.error.substring(0, 100)}{task.error.length > 100 ? '...' : ''}
            </p>
          )}
          {task.status === 'completed' && (
            <p className="text-xs text-green-500 dark:text-green-400 mt-1">
              输出: {getFileName(task.outputFile)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};
