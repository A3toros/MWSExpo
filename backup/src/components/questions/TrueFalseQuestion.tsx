import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  question: {
    id: string | number;
    question_id?: string | number;
    question_text?: string;
    question?: string;
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

export default function TrueFalseQuestion({
  question,
  testId,
  testType = 'true_false',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null
}: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [questionText, setQuestionText] = useState<string>('');
  const [isValid, setIsValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Initialize question data
  useEffect(() => {
    if (question) {
      setQuestionText(question.question_text || '');
      
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
  const handleAnswerChange = useCallback((answer: string) => {
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
    <View style={styles.container}>
      <View style={styles.saveIndicator}>
        {isAutoSaving && (
          <View style={styles.savingContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
        {lastSaved && !isAutoSaving && (
          <Text style={styles.savedText}>
            ✓ Saved at {lastSaved}
          </Text>
        )}
      </View>
      
      <Text style={styles.questionText}>
        {formatQuestionText(questionText)}
      </Text>
      
      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.optionButton,
            selectedAnswer === 'true' && styles.selectedOption,
            showCorrectAnswers && question?.correct_answer === 'true' && styles.correctOption
          ]}
          onPress={() => handleAnswerChange('true')}
        >
          <View style={styles.optionContent}>
            <View style={[
              styles.radioButton,
              selectedAnswer === 'true' && styles.selectedRadioButton
            ]}>
              {selectedAnswer === 'true' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.optionText}>True</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.optionButton,
            selectedAnswer === 'false' && styles.selectedOption,
            showCorrectAnswers && question?.correct_answer === 'false' && styles.correctOption
          ]}
          onPress={() => handleAnswerChange('false')}
        >
          <View style={styles.optionContent}>
            <View style={[
              styles.radioButton,
              selectedAnswer === 'false' && styles.selectedRadioButton
            ]}>
              {selectedAnswer === 'false' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.optionText}>False</Text>
          </View>
        </TouchableOpacity>
      </View>
      
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
  correctOption: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginRight: 12,
  },
  selectedRadioButton: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
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