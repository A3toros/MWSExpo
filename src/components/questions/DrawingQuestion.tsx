/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

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
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
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
    <View className={`p-4 rounded-lg border ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-cyan-400/30' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border-gray-600' 
        : 'bg-white border-gray-200'
    }`}>
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
      
      <Text className={`text-lg mb-4 ${
        themeMode === 'cyberpunk' 
          ? 'text-cyan-400 tracking-wider' 
          : themeMode === 'dark' 
          ? 'text-white' 
          : 'text-gray-900'
      }`}>
        {questionText}
      </Text>
      
      {question?.image_url && (
        <View className="mb-4 p-3 rounded-lg border ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-gray-50 border-gray-200'
        }">
          <Text className={`text-sm font-medium mb-1 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-white' 
              : 'text-gray-700'
          }`}>
            {themeMode === 'cyberpunk' ? 'REFERENCE IMAGE:' : 'Reference Image:'}
          </Text>
          <Text className={`text-sm ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-300' 
              : 'text-gray-600'
          }`}>
            {question.image_url}
          </Text>
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
        
        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity
            className={`flex-1 py-3 px-4 rounded-lg border-2 ${
              themeMode === 'cyberpunk' 
                ? 'bg-black border-cyan-400' 
                : themeMode === 'dark' 
                ? 'bg-blue-600 border-blue-400' 
                : 'bg-blue-500 border-blue-500'
            }`}
            onPress={handleStartDrawing}
          >
            <Text className={`text-center font-semibold ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-400 tracking-wider' 
                : 'text-white'
            }`}>
              {drawingData 
                ? (themeMode === 'cyberpunk' ? 'EDIT DRAWING' : 'Edit Drawing')
                : (themeMode === 'cyberpunk' ? 'START DRAWING' : 'Start Drawing')
              }
            </Text>
          </TouchableOpacity>
          
          {drawingData && (
            <TouchableOpacity
              className={`flex-1 py-3 px-4 rounded-lg border-2 ${
                themeMode === 'cyberpunk' 
                  ? 'bg-black border-red-400' 
                  : themeMode === 'dark' 
                  ? 'bg-red-600 border-red-400' 
                  : 'bg-red-500 border-red-500'
              }`}
              onPress={handleClearDrawing}
            >
              <Text className={`text-center font-semibold ${
                themeMode === 'cyberpunk' 
                  ? 'text-red-400 tracking-wider' 
                  : 'text-white'
              }`}>
                {themeMode === 'cyberpunk' ? 'CLEAR DRAWING' : 'Clear Drawing'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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