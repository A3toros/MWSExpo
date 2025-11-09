/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import MathText from '../math/MathText';

type Props = {
  question: {
    id?: string | number;
    question_id?: string | number;
    question_text?: string;
    question?: string;
    correct_answers?: string[];
  };
  testId: string;
  testType?: string;
  displayNumber?: number;
  studentAnswer?: string | null;
  onAnswerChange?: (questionId: string | number, answer: string) => void;
  showCorrectAnswers?: boolean;
  studentId?: string | null;
  textInputProps?: {
    contextMenuHidden?: boolean;
    onFocus?: () => void;
    textContentType?: 'none';
    autoComplete?: 'off';
    autoCorrect?: boolean;
    spellCheck?: boolean;
  };
};

export default function InputQuestion({
  question,
  testId,
  testType = 'input',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null,
  textInputProps
}: Props) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [answer, setAnswer] = useState<string>('');
  const [questionText, setQuestionText] = useState<string>('');
  const [isValid, setIsValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Initialize question data
  useEffect(() => {
    if (question) {
      setQuestionText(question.question_text || question.question || '');
      
      // Only load from AsyncStorage if no parent value is provided
      if (studentId && studentAnswer === undefined) {
        const loadSavedAnswer = async () => {
          try {
            const questionId = question.question_id || question.id;
            const savedAnswer = await AsyncStorage.getItem(`test_progress_${studentId}_${testType}_${testId}_${questionId}`);
            if (savedAnswer) {
              setAnswer(savedAnswer);
              // Also notify parent of the loaded value
              if (onAnswerChange && questionId !== undefined) {
                onAnswerChange(questionId, savedAnswer);
              }
            }
          } catch (e) {
            console.error('Failed to load saved answer:', e);
          }
        };
        loadSavedAnswer();
      }
    }
  }, [question, testId, testType, studentId, studentAnswer, onAnswerChange]);

  // Sync with parent studentAnswer prop when it changes
  useEffect(() => {
    if (studentAnswer !== undefined && studentAnswer !== null) {
      setAnswer(studentAnswer);
    }
  }, [studentAnswer]);

  // Auto-save functionality
  useEffect(() => {
    const questionId = question.question_id || question.id;
    if (answer && testId && questionId && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        // Use a more specific key to avoid conflicts between questions
        const saveKey = `test_progress_${studentId}_${testType}_${testId}_${questionId}`;
        AsyncStorage.setItem(saveKey, answer);
        console.log('💾 Auto-save input answer', { saveKey, length: answer?.length ?? 0, answer });
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [answer, testId, testType, question?.question_id, question?.id, studentId]);

  // Format question text (simple version for React Native)
  const formatQuestion = (text: string) => {
    return text.replace(/\n/g, '\n');
  };

  // Handle answer change
  const handleAnswerChange = useCallback((text: string) => {
    setAnswer(text);
    try {
      const qid = question.question_id || question.id;
      console.log('📝 InputQuestion onChange', { qid, length: text?.length ?? 0, text });
    } catch {}
    if (onAnswerChange) {
      const questionId = question.question_id || question.id;
      if (questionId !== undefined) {
        onAnswerChange(questionId, text);
      }
    }
  }, [onAnswerChange, question.question_id, question.id]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Validate answer
  const validateAnswer = useCallback((text: string) => {
    if (!text || text.trim().length === 0) {
      setIsValid(false);
      setValidationMessage('Please enter an answer');
      return;
    }
    
    setIsValid(true);
    setValidationMessage('');
  }, []);

  // Validate answer when it changes
  useEffect(() => {
    if (answer) {
      validateAnswer(answer);
    }
  }, [answer, validateAnswer]);

  return (
    <View className={`p-4 rounded-lg border ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-cyan-400/30' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border-gray-600' 
        : 'bg-white border-gray-200'
    }`}>
      {/* no header or status in answer input container */}
      
      <TextInput
        ref={inputRef}
        className={`border rounded-lg p-3 text-base min-h-12 ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-cyan-400 text-cyan-400 placeholder-cyan-400/50' 
            : themeMode === 'dark' 
            ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
        } ${
          !isValid 
            ? (themeMode === 'cyberpunk' ? 'border-red-400' : 'border-red-500')
            : isFocused 
            ? (themeMode === 'cyberpunk' ? 'border-cyan-400' : themeMode === 'dark' ? 'border-blue-400' : 'border-blue-500')
            : ''
        } ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}
        placeholder={themeMode === 'cyberpunk' ? 'ENTER YOUR ANSWER HERE...' : 'Enter your answer here...'}
        placeholderTextColor={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#9CA3AF' : '#6B7280'}
        value={answer}
        onChangeText={handleAnswerChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline={false}
        autoCapitalize="sentences"
        autoCorrect={false}
      />
      
      {showCorrectAnswers && question?.correct_answers && (
        <View className={`mt-4 p-4 rounded-lg border ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-green-400' 
            : themeMode === 'dark' 
            ? 'bg-green-900/30 border-green-600' 
            : 'bg-green-50 border-green-200'
        }`}>
          <Text className={`text-sm font-semibold mb-2 ${
            themeMode === 'cyberpunk' 
              ? 'text-green-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-green-400' 
              : 'text-green-800'
          }`}>
            {themeMode === 'cyberpunk' ? 'CORRECT ANSWERS:' : 'Correct Answers:'}
          </Text>
          {question.correct_answers.map((correctAnswer, index) => (
            <View key={index} className="flex-row items-center mb-1">
              <Text className={`text-sm mr-2 ${
                themeMode === 'cyberpunk' 
                  ? 'text-green-400 tracking-wider' 
                  : themeMode === 'dark' 
                  ? 'text-green-300' 
                  : 'text-green-700'
              }`}>
                •
              </Text>
              <View className="flex-1">
                <MathText 
                  text={correctAnswer}
                  fontSize={14}
                />
              </View>
            </View>
          ))}
        </View>
      )}
      
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
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 0,
  },
});