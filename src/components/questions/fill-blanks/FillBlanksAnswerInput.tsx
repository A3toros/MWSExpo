/** @jsxImportSource nativewind */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { ThemeMode } from '../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../utils/themeUtils';
import { Blank } from './FillBlanksTextRenderer';

interface FillBlanksAnswerInputProps {
  blank: Blank;
  value: string;
  onChange: (value: string) => void;
  themeMode: ThemeMode;
  showCorrectAnswers?: boolean;
  correctAnswer?: string;
  mode?: 'separate' | 'inline';
}

export default function FillBlanksAnswerInput({
  blank,
  value,
  onChange,
  themeMode,
  showCorrectAnswers = false,
  correctAnswer,
  mode = 'separate'
}: FillBlanksAnswerInputProps) {
  const themeClasses = getThemeClasses(themeMode);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Debug logging
  console.log('🔍 FillBlanksAnswerInput render:', {
    blankId: blank.id,
    blankOptions: blank.options,
    hasOptions: Array.isArray(blank.options) && blank.options.length > 0,
    value,
    correctAnswer
  });
  
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
  };
  
  const handleOptionSelect = (option: string) => {
    onChange(option);
    setShowDropdown(false);
  };
  
  const getInputClasses = () => {
    let baseClasses = `border rounded-lg p-3 text-base font-medium ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-cyan-400 text-cyan-400' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border-gray-600 text-white' 
        : 'bg-white border-gray-300 text-gray-900'
    }`;
    
    if (showCorrectAnswers) {
      if (value === correctAnswer) {
        baseClasses += themeMode === 'cyberpunk' 
          ? ' border-green-400' 
          : ' border-green-500';
      } else if (value && value !== correctAnswer) {
        baseClasses += themeMode === 'cyberpunk' 
          ? ' border-red-400' 
          : ' border-red-500';
      }
    }
    
    return baseClasses;
  };
  
  const getPlaceholder = () => {
    if (themeMode === 'cyberpunk') {
      return 'ENTER YOUR ANSWER...';
    }
    return 'Enter your answer...';
  };
  
  const getButtonClasses = () => {
    return `px-3 py-2 rounded-lg border-2 font-bold ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-cyan-400 text-cyan-400' 
        : themeMode === 'dark' 
        ? 'bg-gray-700 border-gray-600 text-white' 
        : 'bg-blue-500 border-blue-600 text-white'
    }`;
  };
  
  const getModalClasses = () => {
    return `flex-1 justify-center items-center ${
      themeMode === 'cyberpunk' 
        ? 'bg-black/80' 
        : themeMode === 'dark' 
        ? 'bg-black/50' 
        : 'bg-black/50'
    }`;
  };
  
  const getModalContainerClasses = () => {
    return `rounded-lg p-6 max-w-md w-full mx-4 ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-2 border-cyan-400' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border border-gray-600' 
        : 'bg-white border border-gray-200'
    }`;
  };
  
  if (mode === 'separate') {
    // Separate mode: Show radio buttons for multiple choice
    return (
      <View>
        <View className="gap-3">
          {(Array.isArray(blank.options) ? blank.options : []).filter(option => option && option.trim().length > 0).map((option, optIndex) => {
            const optionLetter = String.fromCharCode(65 + optIndex); // A, B, C, D...
            const isSelected = value === optionLetter;
            
            return (
              <TouchableOpacity
                key={optIndex}
                onPress={() => handleInputChange(optionLetter)}
                className={`flex-row items-center gap-3 p-3 rounded-lg border-2 ${
                  isSelected 
                    ? (themeMode === 'cyberpunk' 
                        ? 'bg-yellow-400/20 border-yellow-400' 
                        : themeMode === 'dark' 
                        ? 'bg-blue-900/30 border-blue-600' 
                        : 'bg-blue-50 border-blue-500')
                    : (themeMode === 'cyberpunk' 
                        ? 'bg-black border-cyan-400/30' 
                        : themeMode === 'dark' 
                        ? 'bg-gray-800 border-gray-600' 
                        : 'bg-white border-gray-300')
                }`}
              >
                {/* Radio Button Circle */}
                <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  isSelected 
                    ? (themeMode === 'cyberpunk' 
                        ? 'border-yellow-400 bg-yellow-400' 
                        : themeMode === 'dark' 
                        ? 'border-blue-600 bg-blue-600' 
                        : 'border-blue-500 bg-blue-500')
                    : (themeMode === 'cyberpunk' 
                        ? 'border-cyan-400' 
                        : themeMode === 'dark' 
                        ? 'border-gray-600' 
                        : 'border-gray-400')
                }`}>
                  {isSelected && (
                    <View className={`w-3 h-3 rounded-full ${
                      themeMode === 'cyberpunk' 
                        ? 'bg-black' 
                        : 'bg-white'
                    }`} />
                  )}
                </View>
                
                {/* Option Letter */}
                <View className={`w-6 h-6 rounded-full items-center justify-center ${
                  themeMode === 'cyberpunk' 
                    ? 'bg-black border border-cyan-400' 
                    : themeMode === 'dark' 
                    ? 'bg-gray-700 border border-gray-600' 
                    : 'bg-gray-100 border border-gray-400'
                }`}>
                  <Text className={`text-sm font-semibold ${
                    themeMode === 'cyberpunk' 
                      ? 'text-cyan-400' 
                      : themeMode === 'dark' 
                      ? 'text-gray-300' 
                      : 'text-gray-600'
                  }`}>
                    {optionLetter}
                  </Text>
                </View>
                
                {/* Option Text */}
                <Text className={`flex-1 text-base ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-400' 
                    : themeMode === 'dark' 
                    ? 'text-white' 
                    : 'text-gray-900'
                }`}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Inline mode: Show dropdown button (for use in inline text)
  return (
    <View>
      <TouchableOpacity
        onPress={() => setShowDropdown(true)}
        className={`px-3 py-2 rounded-lg border-2 ${
          value 
            ? (themeMode === 'cyberpunk' 
                ? 'bg-green-400/20 border-green-400' 
                : themeMode === 'dark' 
                ? 'bg-green-900/30 border-green-600' 
                : 'bg-green-50 border-green-500')
            : (themeMode === 'cyberpunk' 
                ? 'bg-yellow-400/20 border-yellow-400' 
                : themeMode === 'dark' 
                ? 'bg-purple-900 border-purple-600' 
                : 'bg-purple-100 border-purple-400')
        }`}
      >
        <Text className={`font-bold ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-white' 
            : 'text-gray-900'
        }`}>
          {value ? value : 'Select'}
        </Text>
      </TouchableOpacity>
      
      {/* Options Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <View className={getModalClasses()}>
          <View className={getModalContainerClasses()}>
            <Text className={`text-lg font-semibold mb-4 ${
              themeMode === 'cyberpunk' 
                ? 'text-yellow-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-white' 
                : 'text-gray-900'
            }`}>
              {themeMode === 'cyberpunk' ? 'SELECT ANSWER' : 'Select Answer'}
            </Text>
            
            <View>
              {(Array.isArray(blank.options) ? blank.options : []).filter(option => option && option.trim().length > 0).map((option, optIndex) => (
                <TouchableOpacity
                  key={optIndex}
                  onPress={() => handleOptionSelect(option)}
                  className={`w-full text-left px-4 py-2 rounded-lg border mb-2 ${
                    themeMode === 'cyberpunk' 
                      ? 'bg-black border-cyan-400' 
                      : themeMode === 'dark' 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text className={`font-semibold ${
                    themeMode === 'cyberpunk' 
                      ? 'text-cyan-400 tracking-wider' 
                      : themeMode === 'dark' 
                      ? 'text-white' 
                      : 'text-gray-900'
                  }`}>
                    <Text className={`font-bold ${
                      themeMode === 'cyberpunk' 
                        ? 'text-yellow-400' 
                        : themeMode === 'dark' 
                        ? 'text-blue-400' 
                        : 'text-blue-600'
                    }`}>
                      {String.fromCharCode(65 + optIndex)})
                    </Text>
                    {' '}{option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View className="mt-4 flex justify-end">
              <TouchableOpacity
                onPress={() => setShowDropdown(false)}
                className={`px-4 py-2 rounded-lg ${
                  themeMode === 'cyberpunk' 
                    ? 'bg-black border-2 border-red-400' 
                    : themeMode === 'dark' 
                    ? 'bg-gray-600' 
                    : 'bg-gray-400'
                }`}
              >
                <Text className={`text-sm font-bold ${
                  themeMode === 'cyberpunk' 
                    ? 'text-red-400 tracking-wider' 
                    : 'text-white'
                }`}>
                  {themeMode === 'cyberpunk' ? 'CANCEL' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Correct Answer Display */}
      {showCorrectAnswers && (
        <Text className={`text-sm mt-2 ${
          themeMode === 'cyberpunk' 
            ? 'text-green-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-green-400' 
            : 'text-green-600'
        }`}>
          {themeMode === 'cyberpunk' ? 'CORRECT:' : 'Correct:'} {correctAnswer}
        </Text>
      )}
    </View>
  );
}
