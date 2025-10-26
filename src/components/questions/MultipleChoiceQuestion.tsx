/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

type Props = {
  question: {
    id: string | number;
    question_id?: string | number;
    question_text?: string;
    question?: string;
    options?: string[];
    correct_answer?: string;
  };
  testId: string;
  testType?: string;
  displayNumber?: number;
  studentAnswer?: string | null;
  onAnswerChange?: (questionId: string | number, answer: string) => void;
  showCorrectAnswers?: boolean;
  studentId?: string | null;
};

export default function MultipleChoiceQuestion({
  question,
  testId,
  testType = 'multiple_choice',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null
}: Props) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']); // Default 4 options
  const [questionText, setQuestionText] = useState<string>('');
  const [isValid, setIsValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Initialize question data
  useEffect(() => {
    if (question) {
      setQuestionText(question.question_text || '');
      setOptions(question.options || ['', '', '', '']);
      
      if (studentId) {
        // Load saved answer for student mode
        const loadSavedAnswer = async () => {
          try {
            const questionId = question.question_id || question.id;
            const savedAnswer = await AsyncStorage.getItem(`test_progress_${studentId}_${testType}_${testId}_${questionId}`);
            if (savedAnswer) {
              setSelectedAnswer(savedAnswer);
            }
          } catch (e) {
            console.error('Failed to load saved answer:', e);
          }
        };
        loadSavedAnswer();
      }
    }
  }, [question, testId, testType, studentId]);

  // Sync with parent studentAnswer prop when it changes
  useEffect(() => {
    if (studentAnswer !== undefined && studentAnswer !== null) {
      setSelectedAnswer(studentAnswer);
    }
  }, [studentAnswer]);

  // Auto-save functionality
  useEffect(() => {
    if (selectedAnswer && testId && question?.id && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        const questionId = question.question_id || question.id;
        AsyncStorage.setItem(`test_progress_${studentId}_${testType}_${testId}_${questionId}`, selectedAnswer);
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedAnswer, testId, testType, question?.id, studentId]);

  // Format question text (simple version for React Native)
  const formatQuestionText = (text: string) => {
    return text.replace(/\n/g, '\n');
  };

  // Handle answer selection
  const handleAnswerSelect = useCallback((answer: string) => {
    setSelectedAnswer(answer);
    if (onAnswerChange) {
      const questionId = question.question_id || question.id;
      onAnswerChange(questionId, answer);
    }
  }, [onAnswerChange, question.question_id, question.id]);

  // Validate answer
  const validateAnswer = useCallback((answer: string) => {
    if (!answer) {
      setIsValid(false);
      setValidationMessage('Please select an answer');
      return;
    }
    
    setIsValid(true);
    
    // Enhanced validation with correctness feedback
    if (question?.correct_answer && answer === question.correct_answer) {
      setValidationMessage('✅ Correct answer!');
    } else if (question?.correct_answer) {
      setValidationMessage('❌ Incorrect answer');
    } else {
      setValidationMessage('Answer selected');
    }
  }, [question?.correct_answer]);

  // Validate answer when selection changes
  useEffect(() => {
    if (selectedAnswer) {
      validateAnswer(selectedAnswer);
    }
  }, [selectedAnswer, validateAnswer]);

  return (
    <View className={`p-4 rounded-lg border ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-cyan-400/30' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border-gray-600' 
        : 'bg-white border-gray-200'
    }`}>
      <View className="mb-4">
        {isAutoSaving && (
          <View className="flex-row items-center gap-2 mb-2">
            <ActivityIndicator size="small" color={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#60A5FA' : '#2563eb'} />
            <Text className={`text-xs ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-gray-400' 
                : 'text-gray-600'
            }`}>
              {themeMode === 'cyberpunk' ? 'SAVING...' : 'Saving...'}
            </Text>
          </View>
        )}
        {lastSaved && !isAutoSaving && (
          <Text className={`text-xs ${
            themeMode === 'cyberpunk' 
              ? 'text-green-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-green-400' 
              : 'text-green-600'
          }`}>
            ✓ {themeMode === 'cyberpunk' ? 'SAVED AT' : 'Saved at'} {lastSaved}
          </Text>
        )}
      </View>
      
      <Text className={`text-lg mb-4 ${
        themeMode === 'cyberpunk' 
          ? 'text-cyan-400 tracking-wider' 
          : themeMode === 'dark' 
          ? 'text-white' 
          : 'text-gray-900'
      }`}>
        {formatQuestionText(questionText)}
      </Text>
      
      <View style={styles.optionsContainer}>
        {options.map((option, index) => {
          const optionLetter = String.fromCharCode(65 + index);
          const isSelected = selectedAnswer === optionLetter;
          
          return (
            <TouchableOpacity
              key={index}
              className={`p-4 rounded-lg border-2 mb-3 ${
                isSelected 
                  ? (themeMode === 'cyberpunk' 
                      ? 'bg-black border-cyan-400' 
                      : themeMode === 'dark' 
                      ? 'bg-blue-600 border-blue-400' 
                      : 'bg-blue-50 border-blue-500')
                  : (themeMode === 'cyberpunk' 
                      ? 'bg-black border-gray-600' 
                      : themeMode === 'dark' 
                      ? 'bg-gray-800 border-gray-600' 
                      : 'bg-white border-gray-300')
              }`}
              onPress={() => handleAnswerSelect(optionLetter)}
            >
              <View className="flex-row items-center">
                <View className="mr-3">
                  <View className={`w-6 h-6 rounded-full border-2 ${
                    isSelected 
                      ? (themeMode === 'cyberpunk' 
                          ? 'border-cyan-400 bg-cyan-400' 
                          : themeMode === 'dark' 
                          ? 'border-blue-400 bg-blue-400' 
                          : 'border-blue-500 bg-blue-500')
                      : (themeMode === 'cyberpunk' 
                          ? 'border-gray-600' 
                          : themeMode === 'dark' 
                          ? 'border-gray-600' 
                          : 'border-gray-400')
                  }`}>
                    {isSelected && (
                      <View className={`w-3 h-3 rounded-full m-auto ${
                        themeMode === 'cyberpunk' ? 'bg-black' : 'bg-white'
                      }`} />
                    )}
                  </View>
                </View>
                <View className="mr-3">
                  <Text className={`text-lg font-bold ${
                    themeMode === 'cyberpunk' 
                      ? 'text-cyan-400 tracking-wider' 
                      : themeMode === 'dark' 
                      ? 'text-white' 
                      : 'text-gray-700'
                  }`}>
                    {optionLetter}
                  </Text>
                </View>
                <Text className={`flex-1 text-base ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-400 tracking-wider' 
                    : themeMode === 'dark' 
                    ? 'text-white' 
                    : 'text-gray-700'
                }`}>
                  {option || `Option ${optionLetter}`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {!isValid && validationMessage && (
        <View className={`mt-4 p-3 rounded-lg border ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-red-400' 
            : themeMode === 'dark' 
            ? 'bg-red-900/30 border-red-600' 
            : 'bg-red-50 border-red-200'
        }`}>
          <Text className={`text-sm ${
            themeMode === 'cyberpunk' 
              ? 'text-red-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-red-400' 
              : 'text-red-600'
          }`}>
            {validationMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  savedText: {
    fontSize: 12,
    color: '#10b981',
  },
  questionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 6,
  },
  optionsContainer: {
    gap: 6,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 8,
    backgroundColor: 'white',
  },
  selectedOption: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioContainer: {
    marginRight: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRadioButton: {
    borderColor: '#2563eb',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  optionLabel: {
    width: 32,
    height: 32,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionLetter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
  },
});