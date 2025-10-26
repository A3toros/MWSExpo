import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  question: {
    id: string | number;
    question_text?: string;
    question?: string;
    image_url?: string;
  };
  testId: string;
  testType?: string;
  displayNumber?: number;
  studentAnswer?: string | null;
  onAnswerChange?: (questionId: string | number, answer: string) => void;
  showCorrectAnswers?: boolean;
  studentId?: string | null;
};

export default function DrawingQuestion({
  question,
  testId,
  testType = 'drawing',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null
}: Props) {
  const [drawingData, setDrawingData] = useState<string>('');
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
        // Load saved drawing for student mode
        const loadSavedDrawing = async () => {
          try {
            const savedDrawing = await AsyncStorage.getItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`);
            if (savedDrawing) {
              setDrawingData(savedDrawing);
            }
          } catch (e) {
            console.error('Failed to load saved drawing:', e);
          }
        };
        loadSavedDrawing();
      }
    }
  }, [question, testId, testType, studentId]);

  // Sync with parent studentAnswer prop when it changes
  useEffect(() => {
    if (studentAnswer !== undefined && studentAnswer !== null) {
      setDrawingData(studentAnswer);
    }
  }, [studentAnswer]);

  // Auto-save functionality
  useEffect(() => {
    if (drawingData && testId && question?.id && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        AsyncStorage.setItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`, drawingData);
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [drawingData, testId, testType, question?.id, studentId]);

  // Handle drawing data change
  const handleDrawingChange = useCallback((data: string) => {
    setDrawingData(data);
    if (onAnswerChange) {
      onAnswerChange(question.id, data);
    }
  }, [onAnswerChange, question.id]);

  // Validate drawing
  const validateDrawing = useCallback(() => {
    if (!drawingData || drawingData.trim().length === 0) {
      setIsValid(false);
      setValidationMessage('Please create a drawing');
      return;
    }
    
    setIsValid(true);
    setValidationMessage('');
  }, [drawingData]);

  // Validate drawing when it changes
  useEffect(() => {
    validateDrawing();
  }, [validateDrawing]);

  // Handle drawing actions
  const handleStartDrawing = () => {
    Alert.alert(
      'Drawing Test',
      'This is a drawing test. You will need to create a drawing based on the question. The drawing functionality will be implemented with a proper drawing canvas.',
      [
        { text: 'OK', onPress: () => {
          // For now, just set a placeholder drawing data
          handleDrawingChange('drawing_placeholder');
        }}
      ]
    );
  };

  const handleClearDrawing = () => {
    Alert.alert(
      'Clear Drawing',
      'Are you sure you want to clear your drawing?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          handleDrawingChange('');
        }}
      ]
    );
  };

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
        {questionText}
      </Text>
      
      {question?.image_url && (
        <View style={styles.imageContainer}>
          <Text style={styles.imageLabel}>Reference Image:</Text>
          <Text style={styles.imageUrl}>{question.image_url}</Text>
        </View>
      )}
      
      <View style={styles.drawingContainer}>
        <View style={styles.drawingCanvas}>
          {drawingData ? (
            <View style={styles.drawingPlaceholder}>
              <Text style={styles.drawingText}>Drawing Created</Text>
              <Text style={styles.drawingSubtext}>Drawing functionality will be implemented</Text>
            </View>
          ) : (
            <View style={styles.emptyCanvas}>
              <Text style={styles.emptyCanvasText}>Start Drawing</Text>
              <Text style={styles.emptyCanvasSubtext}>Tap the button below to begin</Text>
            </View>
          )}
        </View>
        
        <View style={styles.drawingControls}>
          <TouchableOpacity
            style={styles.drawingButton}
            onPress={handleStartDrawing}
          >
            <Text style={styles.drawingButtonText}>
              {drawingData ? 'Edit Drawing' : 'Start Drawing'}
            </Text>
          </TouchableOpacity>
          
          {drawingData && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearDrawing}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
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
  imageContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  imageUrl: {
    fontSize: 12,
    color: '#6b7280',
  },
  drawingContainer: {
    gap: 16,
  },
  drawingCanvas: {
    height: 300,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawingPlaceholder: {
    alignItems: 'center',
  },
  drawingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  drawingSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyCanvas: {
    alignItems: 'center',
  },
  emptyCanvasText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  emptyCanvasSubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  drawingControls: {
    flexDirection: 'row',
    gap: 12,
  },
  drawingButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  drawingButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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