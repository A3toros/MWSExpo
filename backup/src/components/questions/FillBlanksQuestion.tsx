import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  question: {
    id: string | number;
    question_text?: string;
    question?: string;
    blanks?: Array<{
      id: string | number;
      correct_answer: string;
      position: number;
    }>;
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionText, setQuestionText] = useState<string>('');
  const [blanks, setBlanks] = useState<Array<{id: string | number; correct_answer: string; position: number}>>([]);
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

  // Auto-save functionality
  useEffect(() => {
    if (Object.keys(answers).length > 0 && testId && question?.id && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        AsyncStorage.setItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`, JSON.stringify(answers));
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [answers, testId, testType, question?.id, studentId]);

  // Format question text with blanks
  const formatQuestionWithBlanks = (text: string, blanks: Array<{id: string | number; position: number}>) => {
    if (!blanks || blanks.length === 0) {
      return text;
    }
    
    // Sort blanks by position
    const sortedBlanks = [...blanks].sort((a, b) => a.position - b.position);
    
    let formattedText = text;
    sortedBlanks.forEach((blank, index) => {
      const blankPlaceholder = `[BLANK_${blank.id}]`;
      formattedText = formattedText.replace(blankPlaceholder, `___${index + 1}___`);
    });
    
    return formattedText;
  };

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.questionNumber}>
          Question {typeof displayNumber === 'number' ? displayNumber : question?.id}
        </Text>
        {isAutoSaving && (
          <View style={styles.savingContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.questionText}>
        {formatQuestionWithBlanks(questionText, blanks)}
      </Text>
      
      <View style={styles.blanksContainer}>
        {blanks.map((blank, index) => (
          <View key={blank.id} style={styles.blankItem}>
            <Text style={styles.blankLabel}>Blank {index + 1}:</Text>
            <TextInput
              style={[
                styles.blankInput,
                showCorrectAnswers && answers[String(blank.id)] === blank.correct_answer ? styles.correctInput : null,
                showCorrectAnswers && answers[String(blank.id)] !== blank.correct_answer && answers[String(blank.id)] ? styles.incorrectInput : null
              ]}
              placeholder="Enter your answer..."
              value={answers[String(blank.id)] || ''}
              onChangeText={(text) => handleBlankAnswerChange(blank.id, text)}
              autoCapitalize="sentences"
              autoCorrect={false}
            />
            {showCorrectAnswers && (
              <Text style={styles.correctAnswerText}>
                Correct: {blank.correct_answer}
              </Text>
            )}
          </View>
        ))}
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
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
  questionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 24,
  },
  blanksContainer: {
    gap: 16,
  },
  blankItem: {
    gap: 8,
  },
  blankLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  blankInput: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: 'white',
    minHeight: 48,
  },
  correctInput: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  incorrectInput: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  correctAnswerText: {
    fontSize: 12,
    color: '#10b981',
    fontStyle: 'italic',
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