// T102: BacktestConfig component for time period selection
// Purpose: UI for configuring backtest parameters

import React, { useState } from 'react';

export interface BacktestConfigData {
  startTime: string;
  endTime: string;
  initialCapital: number;
  resolution: 'hour' | 'day' | 'week';
}

interface BacktestConfigProps {
  onStart: (config: BacktestConfigData) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const BacktestConfig: React.FC<BacktestConfigProps> = ({ onStart, isLoading, disabled }) => {
  const [config, setConfig] = useState<BacktestConfigData>({
    startTime: getDefaultStartTime(),
    endTime: getDefaultEndTime(),
    initialCapital: 1000,
    resolution: 'day',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!config.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!config.endTime) {
      newErrors.endTime = 'End time is required';
    }

    if (config.initialCapital <= 0) {
      newErrors.initialCapital = 'Initial capital must be greater than 0';
    }

    const start = new Date(config.startTime).getTime();
    const end = new Date(config.endTime).getTime();

    if (start >= end) {
      newErrors.endTime = 'End time must be after start time';
    }

    const now = Date.now();
    if (end > now) {
      newErrors.endTime = 'End time cannot be in the future';
    }

    // Minimum 7 days for meaningful backtest
    const minDuration = 7 * 24 * 60 * 60 * 1000;
    if (end - start < minDuration) {
      newErrors.startTime = 'Backtest period must be at least 7 days';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onStart(config);
  };

  const presetPeriods = [
    { label: '1 Month', months: 1 },
    { label: '3 Months', months: 3 },
    { label: '6 Months', months: 6 },
    { label: '1 Year', months: 12 },
  ];

  const handlePresetClick = (months: number) => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    setConfig({
      ...config,
      startTime: start.toISOString().split('T')[0],
      endTime: end.toISOString().split('T')[0],
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Configure Backtest
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quick presets */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Quick Select Period
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {presetPeriods.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetClick(preset.months)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm font-medium transition-colors"
                disabled={disabled || isLoading}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Start Date
            </label>
            <input
              type="date"
              id="startTime"
              value={config.startTime}
              onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={disabled || isLoading}
              max={config.endTime}
            />
            {errors.startTime && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startTime}</p>
            )}
          </div>

          <div>
            <label htmlFor="endTime" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              End Date
            </label>
            <input
              type="date"
              id="endTime"
              value={config.endTime}
              onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={disabled || isLoading}
              min={config.startTime}
              max={new Date().toISOString().split('T')[0]}
            />
            {errors.endTime && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endTime}</p>
            )}
          </div>
        </div>

        {/* Initial capital */}
        <div>
          <label htmlFor="initialCapital" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Initial Capital (USDC)
          </label>
          <input
            type="number"
            id="initialCapital"
            value={config.initialCapital}
            onChange={(e) => setConfig({ ...config, initialCapital: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={disabled || isLoading}
            min="1"
            step="1"
          />
          {errors.initialCapital && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.initialCapital}</p>
          )}
        </div>

        {/* Resolution */}
        <div>
          <label htmlFor="resolution" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Data Resolution
          </label>
          <select
            id="resolution"
            value={config.resolution}
            onChange={(e) => setConfig({ ...config, resolution: e.target.value as 'hour' | 'day' | 'week' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={disabled || isLoading}
          >
            <option value="hour">Hourly (more detailed)</option>
            <option value="day">Daily (recommended)</option>
            <option value="week">Weekly (faster)</option>
          </select>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Higher resolution provides more accurate results but takes longer to compute
          </p>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={disabled || isLoading}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors"
        >
          {isLoading ? 'Running Backtest...' : 'Run Backtest'}
        </button>
      </form>
    </div>
  );
};

// Helper functions
function getDefaultStartTime(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 3); // 3 months ago
  return date.toISOString().split('T')[0];
}

function getDefaultEndTime(): string {
  return new Date().toISOString().split('T')[0];
}

export default BacktestConfig;
