/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import FillBlanksTextRenderer, { Blank } from './fill-blanks/FillBlanksTextRenderer';
import FillBlanksBlankRenderer from './fill-blanks/FillBlanksBlankRenderer';
import FillBlanksAnswerInput from './fill-blanks/FillBlanksAnswerInput';

type Props = {
  question: {
    id: string | number;
    question_text?: string;
    question?: string;
    blanks?: Blank[];
  };
  testId: string;
  testType?: string;
  displayNumber?: number;
  studentAnswer?: Record<string, string> | null;
  onAnswerChange?: (questionId: string | number, answer: Record<string, string>) => void;
  showCorrectAnswers?: boolean;
  studentId?: string | null;
};

export default function FillBlanksQuestion({
  question,
  testId,
  testType = 'fill_blanks',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null
}: Props) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionText, setQuestionText] = useState<string>('');
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [isValid, setIsValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Initialize question data
  useEffect(() => {
    if (question) {
      setQuestionText(question.question_text || '');
      setBlanks(question.blanks || []);
      
      if (studentId) {
        // Load saved answers for student mode
        const loadSavedAnswers = async () => {
          try {
            const savedAnswers = await AsyncStorage.getItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`);
            if (savedAnswers) {
              setAnswers(JSON.parse(savedAnswers));
            }
          } catch (e) {
            console.error('Failed to load saved answers:', e);
          }
        };
        loadSavedAnswers();
      }
    }
  }, [question, testId, testType, studentId]);

  // Sync with parent studentAnswer prop when it changes
  useEffect(() => {
    if (studentAnswer !== undefined && studentAnswer !== null) {
      setAnswers(studentAnswer);
    }
  }, [studentAnswer]);

  // Auto-save functionality - optimized to 5 seconds
  useEffect(() => {
    if (Object.keys(answers).length > 0 && testId && question?.id && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        AsyncStorage.setItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`, JSON.stringify(answers));
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 5000); // Changed from 1000ms to 5000ms (5 seconds)
      
      return () => clearTimeout(timeoutId);
    }
  }, [answers, testId, testType, question?.id, studentId]);

  // Simplified text processing - now handled by FillBlanksTextRenderer

  // Handle answer change for a specific blank
  const handleBlankAnswerChange = useCallback((blankId: string | number, answer: string) => {
    const newAnswers = { ...answers, [String(blankId)]: answer };
    setAnswers(newAnswers);
    if (onAnswerChange) {
      onAnswerChange(question.id, newAnswers);
    }
  }, [answers, onAnswerChange, question.id]);

  // Validate answers
  const validateAnswers = useCallback(() => {
    const requiredBlanks = blanks.length;
    const answeredBlanks = Object.values(answers).filter(answer => answer && answer.trim().length > 0).length;
    
    if (answeredBlanks < requiredBlanks) {
      setIsValid(false);
      setValidationMessage(`Please fill in all blanks (${answeredBlanks}/${requiredBlanks})`);
      return;
    }
    
    setIsValid(true);
    setValidationMessage('');
  }, [answers, blanks.length]);

  // Validate answers when they change
  useEffect(() => {
    validateAnswers();
  }, [validateAnswers]);

  // Debug logging
  console.log('🔍 FillBlanksQuestion render:', {
    questionText,
    blanks: blanks?.length,
    blanksData: blanks,
    answers: Object.keys(answers).length
  });

  return (
    <View className={`p-4 rounded-lg border ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-cyan-400/30' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border-gray-600' 
        : 'bg-white border-gray-200'
    }`}>
      {/* Question Header */}
      <View className="mb-4">
        <Text className={`text-lg font-semibold mb-2 ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-white' 
            : 'text-gray-900'
        }`}>
          {themeMode === 'cyberpunk' ? 'QUESTION' : 'Question'} {typeof displayNumber === 'number' ? displayNumber : question?.id}
        </Text>
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
      </View>
      
      {/* Question Text - Only show if this is the main question text, not individual blank text */}
      {questionText && questionText !== 'undefined' && (
        <View className="mb-4">
          <Text className={`text-base leading-relaxed ${themeClasses.text}`}>
            {questionText}
          </Text>
        </View>
      )}
      
      {/* Answer Inputs */}
      <View className="gap-4">
        {blanks.map((blank, index) => (
          <View key={blank.id} className="gap-2">
            <FillBlanksBlankRenderer
              blank={blank}
              index={index}
              themeMode={themeMode}
              isAnswered={!!answers[String(blank.id)]}
              isCorrect={showCorrectAnswers ? answers[String(blank.id)] === blank.correct_answer : false}
              showCorrectAnswers={showCorrectAnswers}
            />
            <FillBlanksAnswerInput
              blank={blank}
              value={answers[String(blank.id)] || ''}
              onChange={(value) => handleBlankAnswerChange(blank.id, value)}
              themeMode={themeMode}
              showCorrectAnswers={showCorrectAnswers}
              correctAnswer={blank.correct_answer}
              mode="separate"
            />
          </View>
        ))}
      </View>
      
      {/* Validation Error */}
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

// Styles now handled by NativeWind classes in specialized components