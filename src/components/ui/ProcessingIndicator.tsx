/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

interface ProcessingIndicatorProps {
  step: 'uploading' | 'transcribing' | 'analyzing' | 'complete';
  progress: number;
  isProcessing: boolean;
}

export default function ProcessingIndicator({
  step,
  progress,
  isProcessing,
}: ProcessingIndicatorProps) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const getStepInfo = () => {
    const getThemeColors = () => {
      if (themeMode === 'cyberpunk') {
        return {
          uploading: '#00ffd2', // cyan
          transcribing: '#00ff88', // green
          analyzing: '#ff6600', // orange
          complete: '#00ff88', // green
          default: '#ff0044' // red
        };
      } else if (themeMode === 'dark') {
        return {
          uploading: '#60A5FA', // blue
          transcribing: '#34D399', // green
          analyzing: '#A78BFA', // purple
          complete: '#34D399', // green
          default: '#9CA3AF' // gray
        };
      } else {
        return {
          uploading: '#2563eb', // blue
          transcribing: '#059669', // green
          analyzing: '#7c3aed', // purple
          complete: '#059669', // green
          default: '#6b7280' // gray
        };
      }
    };

    const colors = getThemeColors();
    
    switch (step) {
      case 'uploading':
        return {
          icon: 'cloud-upload-outline',
          title: themeMode === 'cyberpunk' ? 'UPLOADING AUDIO' : 'Uploading Audio',
          description: themeMode === 'cyberpunk' 
            ? 'UPLOADING YOUR RECORDING TO OUR SERVERS...' 
            : 'Uploading your recording to our servers...',
          color: colors.uploading,
        };
      case 'transcribing':
        return {
          icon: 'mic-outline',
          title: themeMode === 'cyberpunk' ? 'TRANSCRIBING AUDIO' : 'Transcribing Audio',
          description: themeMode === 'cyberpunk' 
            ? 'CONVERTING YOUR SPEECH TO TEXT...' 
            : 'Converting your speech to text...',
          color: colors.transcribing,
        };
      case 'analyzing':
        return {
          icon: 'analytics-outline',
          title: themeMode === 'cyberpunk' ? 'AI ANALYSIS' : 'AI Analysis',
          description: themeMode === 'cyberpunk' 
            ? 'ANALYZING PRONUNCIATION AND FLUENCY...' 
            : 'Analyzing pronunciation and fluency...',
          color: colors.analyzing,
        };
      case 'complete':
        return {
          icon: 'checkmark-circle-outline',
          title: themeMode === 'cyberpunk' ? 'ANALYSIS COMPLETE' : 'Analysis Complete',
          description: themeMode === 'cyberpunk' 
            ? 'YOUR RESULTS ARE READY!' 
            : 'Your results are ready!',
          color: colors.complete,
        };
      default:
        return {
          icon: 'hourglass-outline',
          title: themeMode === 'cyberpunk' ? 'PROCESSING' : 'Processing',
          description: themeMode === 'cyberpunk' 
            ? 'PLEASE WAIT...' 
            : 'Please wait...',
          color: colors.default,
        };
    }
  };

  const stepInfo = getStepInfo();

  return (
    <View className={`${themeClasses.surface} rounded-xl p-5 shadow-sm border ${themeClasses.border} ${themeMode === 'cyberpunk' ? 'border-cyan-400/30' : ''}`}>
      <View className="flex-row items-center mb-5">
        <View className={`w-12 h-12 rounded-full justify-center items-center mr-4 ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border border-cyan-400/30' 
            : 'bg-opacity-20'
        }`} style={{ backgroundColor: stepInfo.color + '20' }}>
          <Ionicons name={stepInfo.icon as any} size={24} color={stepInfo.color} />
        </View>
        <View className="flex-1">
          <Text className={`text-lg font-semibold ${themeClasses.text} mb-1 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {stepInfo.title}
          </Text>
          <Text className={`text-sm ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {stepInfo.description}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View className="mb-5">
        <View className={`h-2 ${themeMode === 'cyberpunk' ? 'bg-black border border-cyan-400/30' : 'bg-gray-200'} rounded-lg overflow-hidden mb-2`}>
          <View
            className="h-full rounded-lg"
            style={{ width: `${progress}%`, backgroundColor: stepInfo.color }}
          />
        </View>
        <Text className={`text-sm font-semibold ${themeClasses.text} text-right ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
          {progress}%
        </Text>
      </View>

      {/* Processing Steps */}
      <View className="flex-row justify-between mb-4">
        <View className="items-center flex-1">
          <View className={`w-8 h-8 rounded-full justify-center items-center mb-2 ${
            step === 'uploading' 
              ? (themeMode === 'cyberpunk' ? 'bg-cyan-400' : 'bg-blue-500')
              : (themeMode === 'cyberpunk' ? 'bg-gray-600' : 'bg-gray-300')
          }`}>
            <Ionicons
              name="cloud-upload-outline"
              size={16}
              color={step === 'uploading' ? 'white' : (themeMode === 'cyberpunk' ? '#9CA3AF' : '#6b7280')}
            />
          </View>
          <Text className={`text-xs text-center ${
            step === 'uploading' 
              ? `${themeClasses.text} font-semibold` 
              : themeClasses.textSecondary
          } ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'UPLOAD' : 'Upload'}
          </Text>
        </View>

        <View className="items-center flex-1">
          <View className={`w-8 h-8 rounded-full justify-center items-center mb-2 ${
            step === 'transcribing' 
              ? (themeMode === 'cyberpunk' ? 'bg-green-400' : 'bg-green-500')
              : (themeMode === 'cyberpunk' ? 'bg-gray-600' : 'bg-gray-300')
          }`}>
            <Ionicons
              name="mic-outline"
              size={16}
              color={step === 'transcribing' ? 'white' : (themeMode === 'cyberpunk' ? '#9CA3AF' : '#6b7280')}
            />
          </View>
          <Text className={`text-xs text-center ${
            step === 'transcribing' 
              ? `${themeClasses.text} font-semibold` 
              : themeClasses.textSecondary
          } ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'TRANSCRIBE' : 'Transcribe'}
          </Text>
        </View>

        <View className="items-center flex-1">
          <View className={`w-8 h-8 rounded-full justify-center items-center mb-2 ${
            step === 'analyzing' 
              ? (themeMode === 'cyberpunk' ? 'bg-orange-400' : 'bg-purple-500')
              : (themeMode === 'cyberpunk' ? 'bg-gray-600' : 'bg-gray-300')
          }`}>
            <Ionicons
              name="analytics-outline"
              size={16}
              color={step === 'analyzing' ? 'white' : (themeMode === 'cyberpunk' ? '#9CA3AF' : '#6b7280')}
            />
          </View>
          <Text className={`text-xs text-center ${
            step === 'analyzing' 
              ? `${themeClasses.text} font-semibold` 
              : themeClasses.textSecondary
          } ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'ANALYZE' : 'Analyze'}
          </Text>
        </View>

        <View className="items-center flex-1">
          <View className={`w-8 h-8 rounded-full justify-center items-center mb-2 ${
            step === 'complete' 
              ? (themeMode === 'cyberpunk' ? 'bg-green-400' : 'bg-green-500')
              : (themeMode === 'cyberpunk' ? 'bg-gray-600' : 'bg-gray-300')
          }`}>
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={step === 'complete' ? 'white' : (themeMode === 'cyberpunk' ? '#9CA3AF' : '#6b7280')}
            />
          </View>
          <Text className={`text-xs text-center ${
            step === 'complete' 
              ? `${themeClasses.text} font-semibold` 
              : themeClasses.textSecondary
          } ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'COMPLETE' : 'Complete'}
          </Text>
        </View>
      </View>

      {/* Loading Indicator */}
      {isProcessing && (
        <View className={`flex-row items-center justify-center pt-4 border-t ${themeClasses.border}`}>
          <ActivityIndicator size="small" color={stepInfo.color} />
          <Text className={`text-sm ${themeClasses.textSecondary} ml-2 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'PROCESSING...' : 'Processing...'}
          </Text>
        </View>
      )}
    </View>
  );
}


