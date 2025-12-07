/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getThemeClasses } from '../utils/themeUtils';

type Props = {
  themeMode: string;
  loading?: boolean;
  currentIndex?: number;
  total?: number;
  onPressPrev?: () => void;
  onPressNext?: () => void;
  onPressReview?: () => void;
  className?: string;
};

const ExamNavFooter: React.FC<Props> = ({
  themeMode,
  loading = false,
  currentIndex,
  total,
  onPressPrev,
  onPressNext,
  onPressReview,
  className = '',
}) => {
  const themeClasses = getThemeClasses(themeMode);
  const hasPrev = typeof currentIndex === 'number' && currentIndex > 0;
  const hasNext = typeof currentIndex === 'number' && typeof total === 'number' && currentIndex < total - 1;
  const isLast = typeof currentIndex === 'number' && typeof total === 'number' && currentIndex === total - 1;

  return (
    <View
      className={`border-t px-4 py-3 ${themeClasses.surface} ${themeClasses.border} ${className}`}
    >
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          disabled={!hasPrev || loading}
          onPress={onPressPrev}
          className={`px-4 py-2 rounded-lg ${
            !hasPrev || loading
              ? themeMode === 'cyberpunk'
                ? 'bg-gray-800'
                : themeMode === 'dark'
                ? 'bg-gray-700'
                : 'bg-gray-300'
              : themeMode === 'cyberpunk'
              ? 'bg-cyan-600'
              : themeMode === 'dark'
              ? 'bg-blue-600'
              : 'bg-header-blue'
          }`}
        >
          <Text
            className={
              themeMode === 'cyberpunk'
                ? 'text-black font-semibold'
                : 'text-white font-semibold'
            }
          >
            Previous
          </Text>
        </TouchableOpacity>

        <View className="items-center">
          {loading ? (
            <ActivityIndicator size="small" color={themeMode === 'cyberpunk' ? '#22d3ee' : '#2563eb'} />
          ) : (
            <Text
              className={`text-base font-semibold ${
                themeMode === 'cyberpunk'
                  ? 'text-cyan-300'
                  : themeMode === 'dark'
                  ? 'text-gray-200'
                  : 'text-gray-700'
              }`}
            >
              {typeof currentIndex === 'number' && typeof total === 'number'
                ? `${currentIndex + 1} / ${total}`
                : '--'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          disabled={(!hasNext && !isLast) || loading}
          onPress={isLast ? onPressReview : onPressNext}
          className={`px-4 py-2 rounded-lg ${
            (!hasNext && !isLast) || loading
              ? themeMode === 'cyberpunk'
                ? 'bg-gray-800'
                : themeMode === 'dark'
                ? 'bg-gray-700'
                : 'bg-gray-300'
              : themeMode === 'cyberpunk'
              ? 'bg-cyan-600'
              : themeMode === 'dark'
              ? 'bg-blue-600'
              : 'bg-header-blue'
          }`}
        >
          <Text
            className={
              themeMode === 'cyberpunk'
                ? 'text-black font-semibold'
                : 'text-white font-semibold'
            }
          >
            {isLast ? 'Review' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ExamNavFooter;

