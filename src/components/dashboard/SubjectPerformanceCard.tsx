/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { ThemeMode } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import { getPerformanceLevel, getPerformanceEmoji } from '../../utils/performanceColors';
import CircularProgress from './CircularProgress';
import ProgressBar from './ProgressBar';
import CyberpunkCircularProgress from './CyberpunkCircularProgress';
import { SubjectPerformance } from '../../utils/subjectPerformanceCalculator';

interface SubjectPerformanceCardProps {
  subject: SubjectPerformance;
  themeMode: ThemeMode;
  isActive: boolean;
  onPress: () => void;
}

export default function SubjectPerformanceCard({
  subject,
  themeMode,
  isActive,
  onPress,
}: SubjectPerformanceCardProps) {
  const themeClasses = getThemeClasses(themeMode);
  const performanceLevel = getPerformanceLevel(subject.averageScore);
  const performanceEmoji = getPerformanceEmoji(subject.averageScore);
  const screenWidth = Dimensions.get('window').width;


  const textColor = isActive
    ? themeMode === 'cyberpunk'
      ? 'text-cyan-400'
      : themeMode === 'dark'
      ? 'text-purple-300'
      : 'text-blue-600'
    : themeClasses.text;

  return (
    <View style={{ width: screenWidth - 32, marginHorizontal: 16 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          borderRadius: 12,
          padding: 12,
          backgroundColor: isActive 
            ? themeMode === 'cyberpunk'
              ? '#000000'
              : themeMode === 'dark'
              ? '#374151'
              : '#ffffff'
            : themeMode === 'cyberpunk'
            ? '#111111'
            : themeMode === 'dark'
            ? '#1f2937'
            : '#ffffff',
          borderWidth: isActive ? 2 : 1,
          borderColor: isActive
            ? themeMode === 'cyberpunk'
              ? '#00ffd2'
              : themeMode === 'dark'
              ? '#8b5cf6'
              : '#3b82f6'
            : themeMode === 'cyberpunk'
            ? '#00ffd2'
            : themeMode === 'dark'
            ? '#4b5563'
            : '#e5e7eb',
          shadowColor: isActive && themeMode === 'cyberpunk' ? '#00ffd2' : undefined,
          shadowOffset: isActive && themeMode === 'cyberpunk' ? { width: 0, height: 2 } : undefined,
          shadowOpacity: isActive && themeMode === 'cyberpunk' ? 0.5 : undefined,
          shadowRadius: isActive && themeMode === 'cyberpunk' ? 4 : undefined,
          elevation: isActive ? 4 : 1,
        }}
      >
      {/* Subject Header */}
      <View className="items-center mb-4">
        <Text className={`text-lg font-bold text-center ${textColor}`}>
          {subject.subject}
        </Text>
        <Text className={`text-sm ${themeClasses.textSecondary} mt-1`}>
          {subject.testCount} {subject.testCount === 1 ? 'test' : 'tests'}
        </Text>
      </View>

      {/* Progress Visualization */}
      <View className="items-center mb-4">
        {themeMode === 'cyberpunk' ? (
          <CyberpunkCircularProgress
            progress={subject.averageScore}
            size={150}
            animationDuration={2000}
            shouldAnimate={isActive}
          />
        ) : (
          <CircularProgress
            progress={subject.averageScore}
            size={100}
            strokeWidth={6}
            themeMode={themeMode}
            showPercentage={true}
            shouldAnimate={isActive}
          />
        )}
      </View>

      {/* Performance Info */}
      <View className="items-center">
        <View className="flex-row items-center mb-2">
          <Text className="text-2xl mr-2">{performanceEmoji}</Text>
          <Text className={`text-sm font-semibold ${textColor}`}>
            {performanceLevel}
          </Text>
        </View>
        
      </View>
      </TouchableOpacity>
    </View>
  );
}
