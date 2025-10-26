import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
};

export default function InputQuestion({
  question,
  testId,
  testType = 'input',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null
}: Props) {
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
      
      if (studentId) {
        // Load saved answer for student mode
        const loadSavedAnswer = async () => {
          try {
            const questionId = question.question_id || question.id;
            const savedAnswer = await AsyncStorage.getItem(`test_progress_${studentId}_${testType}_${testId}_${questionId}`);
            if (savedAnswer) {
              setAnswer(savedAnswer);
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
      setAnswer(studentAnswer);
    }
  }, [studentAnswer]);

  // Auto-save functionality
  useEffect(() => {
    const questionId = question.question_id || question.id;
    if (answer && testId && questionId && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        AsyncStorage.setItem(`test_progress_${studentId}_${testType}_${testId}_${questionId}`, answer);
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
    <View style={styles.container}>
      {/* no header or status in answer input container */}
      
      <TextInput
        ref={inputRef}
        style={[
          styles.textInput,
          !isValid && styles.invalidInput,
          isFocused && styles.focusedInput
        ]}
        placeholder="Enter your answer here..."
        value={answer}
        onChangeText={handleAnswerChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline={false}
        autoCapitalize="sentences"
        autoCorrect={false}
      />
      
      {showCorrectAnswers && question?.correct_answers && (
        <View style={styles.correctAnswersContainer}>
          <Text style={styles.correctAnswersTitle}>Correct Answers:</Text>
          {question.correct_answers.map((correctAnswer, index) => (
            <Text key={index} style={styles.correctAnswerText}>
              • {correctAnswer}
            </Text>
          ))}
        </View>
      )}
      
      {!isValid && validationMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{validationMessage}</Text>
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
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  savingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  questionText: {
    display: 'none' as any,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: 'white',
    minHeight: 48,
  },
  focusedInput: {
    borderColor: '#2563eb',
  },
  invalidInput: {
    borderColor: '#dc2626',
  },
  correctAnswersContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
  },
  correctAnswersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  correctAnswerText: {
    fontSize: 14,
    color: '#166534',
    marginBottom: 4,
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