/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/themeUtils';

interface ProgressTrackerProps {
  answeredCount?: number;
  totalQuestions?: number;
  percentage?: number;
  timeElapsed?: number;
  timeRemaining?: number;
  onSubmitTest?: () => void;
  isSubmitting?: boolean;
  canSubmit?: boolean;
  className?: string;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  answeredCount = 0,
  totalQuestions = 0,
  percentage: propPercentage,
  timeElapsed = 0,
  timeRemaining,
  onSubmitTest,
  isSubmitting = false,
  canSubmit = false,
  className = ''
}) => {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const percentage = propPercentage !== undefined ? propPercentage : (totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0);
  const remainingQuestions = totalQuestions - answeredCount;
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Use timeRemaining if provided, otherwise fall back to timeElapsed
  const displayTime = timeRemaining !== undefined ? timeRemaining : timeElapsed;
  const isTimeRemaining = timeRemaining !== undefined;

  const getProgressColor = (percentage: number) => {
    if (themeMode === 'cyberpunk') {
      if (percentage >= 100) return '#00ffd2'; // cyan
      if (percentage >= 80) return '#00ff88'; // green
      if (percentage >= 60) return '#ffaa00'; // yellow
      if (percentage >= 40) return '#ff6600'; // orange
      return '#ff0044'; // red
    } else if (themeMode === 'dark') {
      if (percentage >= 100) return '#10B981'; // green
      if (percentage >= 80) return '#60A5FA'; // blue
      if (percentage >= 60) return '#FBBF24'; // yellow
      if (percentage >= 40) return '#FB923C'; // orange
      return '#F87171'; // red
    } else {
      if (percentage >= 100) return '#10B981'; // green
      if (percentage >= 80) return '#3B82F6'; // blue
      if (percentage >= 60) return '#F59E0B'; // yellow
      if (percentage >= 40) return '#F97316'; // orange
      return '#EF4444'; // red
    }
  };

  const getProgressTextColor = (percentage: number) => {
    if (themeMode === 'cyberpunk') {
      if (percentage >= 100) return '#00ffd2';
      if (percentage >= 80) return '#00ff88';
      if (percentage >= 60) return '#ffaa00';
      if (percentage >= 40) return '#ff6600';
      return '#ff0044';
    } else if (themeMode === 'dark') {
      if (percentage >= 100) return '#34D399';
      if (percentage >= 80) return '#93C5FD';
      if (percentage >= 60) return '#FCD34D';
      if (percentage >= 40) return '#FDBA74';
      return '#FCA5A5';
    } else {
      if (percentage >= 100) return '#059669';
      if (percentage >= 80) return '#2563EB';
      if (percentage >= 60) return '#D97706';
      if (percentage >= 40) return '#EA580C';
      return '#DC2626';
    }
  };

  return (
    <View className={`${themeClasses.surface} rounded-xl p-6 shadow-sm border ${themeClasses.border} ${themeMode === 'cyberpunk' ? 'border-cyan-400/30' : ''}`}>
      {/* Progress Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className={`text-lg font-semibold ${themeClasses.text} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
          {themeMode === 'cyberpunk' ? 'TEST PROGRESS' : 'Test Progress'}
        </Text>
        {displayTime !== undefined && displayTime > 0 && (
          <View className="flex-row items-center">
            <Text className={`text-sm font-mono ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
              {isTimeRemaining ? `Time Remaining: ${formatTime(displayTime)}` : `Time Elapsed: ${formatTime(displayTime)}`}
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View className="mb-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className={`text-sm font-medium ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'PROGRESS' : 'Progress'}
          </Text>
          <Text style={{ color: getProgressTextColor(percentage) }} className={`text-sm font-semibold ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {percentage}%
          </Text>
        </View>
        
        <View className={`w-full h-3 ${themeMode === 'cyberpunk' ? 'bg-black border border-cyan-400/30' : 'bg-gray-200'} rounded-lg overflow-hidden`}>
          <View 
            className="h-full rounded-lg"
            style={{ backgroundColor: getProgressColor(percentage), width: `${percentage}%` }} 
          />
        </View>
      </View>

      {/* Question Counter */}
      <View className="flex-row gap-2 mb-4">
        <View className={`flex-1 items-center p-3 rounded-lg ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-blue-900/30' 
            : 'bg-blue-50'
        }`}>
          <Text className={`text-lg font-bold mb-1 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400' 
              : themeMode === 'dark' 
              ? 'text-blue-400' 
              : 'text-blue-600'
          }`}>{answeredCount}</Text>
          <Text className={`text-xs ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-blue-400' 
              : 'text-blue-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'ANSWERED' : 'Answered'}
          </Text>
        </View>
        <View className={`flex-1 items-center p-3 rounded-lg ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border border-yellow-400/30' 
            : themeMode === 'dark' 
            ? 'bg-gray-700' 
            : 'bg-gray-100'
        }`}>
          <Text className={`text-lg font-bold mb-1 ${
            themeMode === 'cyberpunk' 
              ? 'text-yellow-400' 
              : themeMode === 'dark' 
              ? 'text-gray-300' 
              : 'text-gray-600'
          }`}>{remainingQuestions}</Text>
          <Text className={`text-xs ${
            themeMode === 'cyberpunk' 
              ? 'text-yellow-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-300' 
              : 'text-gray-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'REMAINING' : 'Remaining'}
          </Text>
        </View>
        <View className={`flex-1 items-center p-3 rounded-lg ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border border-purple-400/30' 
            : themeMode === 'dark' 
            ? 'bg-purple-900/30' 
            : 'bg-purple-50'
        }`}>
          <Text className={`text-lg font-bold mb-1 ${
            themeMode === 'cyberpunk' 
              ? 'text-purple-400' 
              : themeMode === 'dark' 
              ? 'text-purple-400' 
              : 'text-purple-600'
          }`}>{totalQuestions}</Text>
          <Text className={`text-xs ${
            themeMode === 'cyberpunk' 
              ? 'text-purple-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-purple-400' 
              : 'text-purple-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'TOTAL' : 'Total'}
          </Text>
        </View>
      </View>


    </View>
  );
};

export default ProgressTracker;
