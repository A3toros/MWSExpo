/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text } from 'react-native';
import { ThemeMode } from '../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../utils/themeUtils';
import { Blank } from './FillBlanksTextRenderer';

interface FillBlanksBlankRendererProps {
  blank: Blank;
  index: number;
  themeMode: ThemeMode;
  isAnswered?: boolean;
  isCorrect?: boolean;
  showCorrectAnswers?: boolean;
}

export default function FillBlanksBlankRenderer({
  blank,
  index,
  themeMode,
  isAnswered = false,
  isCorrect = false,
  showCorrectAnswers = false
}: FillBlanksBlankRendererProps) {
  const themeClasses = getThemeClasses(themeMode);
  
  const getBlankClasses = () => {
    if (showCorrectAnswers) {
      if (isCorrect) {
        return themeMode === 'cyberpunk' 
          ? 'bg-green-400/20 text-green-400 border-green-400 tracking-wider' 
          : themeMode === 'dark' 
          ? 'bg-green-900 text-green-200 border-green-600' 
          : 'bg-green-100 text-green-800 border-green-400';
      } else {
        return themeMode === 'cyberpunk' 
          ? 'bg-red-400/20 text-red-400 border-red-400 tracking-wider' 
          : themeMode === 'dark' 
          ? 'bg-red-900 text-red-200 border-red-600' 
          : 'bg-red-100 text-red-800 border-red-400';
      }
    }
    
    if (isAnswered) {
      return themeMode === 'cyberpunk' 
        ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400 tracking-wider' 
        : themeMode === 'dark' 
        ? 'bg-blue-900 text-blue-200 border-blue-600' 
        : 'bg-blue-100 text-blue-800 border-blue-400';
    }
    
    return themeMode === 'cyberpunk' 
      ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400 tracking-wider' 
      : themeMode === 'dark' 
      ? 'bg-purple-900 text-purple-200 border-purple-600' 
      : 'bg-purple-100 text-purple-800 border-purple-400';
  };
  
  const getBlankText = () => {
    if (themeMode === 'cyberpunk') {
      return `[${index + 1}_________]`;
    }
    return `[${index + 1}_________]`;
  };
  
  const getLabelText = () => {
    if (themeMode === 'cyberpunk') {
      return `BLANK ${index + 1}:`;
    }
    return `Blank ${index + 1}:`;
  };
  
  return (
    <View className="space-y-2">
      <Text className={`text-base font-medium ${
        themeMode === 'cyberpunk' 
          ? 'text-cyan-400 tracking-wider' 
          : themeMode === 'dark' 
          ? 'text-white' 
          : 'text-gray-700'
      }`}>
        {getLabelText()}
      </Text>
      
      <View className={`inline-block px-3 py-1 mx-1 rounded-lg border-2 font-mono font-bold shadow-sm ${getBlankClasses()}`}>
        <Text className="font-mono">
          {getBlankText()}
        </Text>
      </View>
      
      {showCorrectAnswers && (
        <Text className={`text-sm ${
          themeMode === 'cyberpunk' 
            ? 'text-green-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-green-400' 
            : 'text-green-600'
        }`}>
          {themeMode === 'cyberpunk' ? 'CORRECT:' : 'Correct:'} {blank.correct_answer}
        </Text>
      )}
    </View>
  );
}
