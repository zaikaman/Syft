// T107: Loading progress during backtest simulation
// Purpose: Show user-friendly loading state while backtest runs

import React from 'react';

interface BacktestProgressProps {
  message?: string;
  details?: string;
  progress?: number; // 0-100
}

const BacktestProgress: React.FC<BacktestProgressProps> = ({
  message = 'Running backtest simulation...',
  details,
  progress,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Animated skeleton loader */}
        <div className="w-20 h-20 bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse"></div>

        {/* Main message */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{message}</h3>
          {details && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{details}</p>
          )}
        </div>

        {/* Progress bar (if progress is provided) */}
        {progress !== undefined && (
          <div className="w-full max-w-md space-y-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              {Math.round(progress)}% complete
            </p>
          </div>
        )}

        {/* Processing steps */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 w-full max-w-md">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Processing Steps:
          </p>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Fetching historical price data</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-blue-500 animate-pulse">●</span>
              <span>Simulating vault strategy</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-gray-400">○</span>
              <span>Calculating performance metrics</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-gray-400">○</span>
              <span>Generating reports</span>
            </li>
          </ul>
        </div>

        {/* Estimated time */}
        <p className="text-xs text-gray-500 dark:text-gray-500">
          This usually takes 10-30 seconds depending on the time period
        </p>
      </div>
    </div>
  );
};

export default BacktestProgress;
