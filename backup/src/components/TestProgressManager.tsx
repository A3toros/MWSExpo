import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useTestProgress } from '../hooks/useTestProgress';
import { useTest } from '../contexts/TestContext';
import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TestProgressManagerProps {
  testId: string;
  isActive: boolean;
  onProgressSaved?: (progress: any) => void;
  onProgressRestored?: (progress: any) => void;
  onAutoSaveError?: (error: Error) => void;
}

export function TestProgressManager({
  testId,
  isActive,
  onProgressSaved,
  onProgressRestored,
  onAutoSaveError,
}: TestProgressManagerProps) {
  const { state: testState, updateAnswer, saveProgress } = useTest();
  const {
    progress,
    isSaving,
    hasUnsavedChanges,
    initializeProgress,
    updateAnswer: updateProgressAnswer,
    updateQuestionIndex: updateProgressQuestionIndex,
    manualSave,
    getProgressSummary,
  } = useTestProgress(testId, {
    enabled: true,
    interval: 30000, // 30 seconds
    onSave: async (progress) => {
      try {
        // Save to backend
        await saveProgress();
        onProgressSaved?.(progress);
        logger.info('Test progress auto-saved', 'test-progress', { testId, progress });
      } catch (error) {
        logger.error('Failed to auto-save test progress', 'test-progress', error);
        onAutoSaveError?.(error as Error);
      }
    },
    onError: (error) => {
      logger.error('Test progress auto-save error', 'test-progress', error);
      onAutoSaveError?.(error);
    },
  });

  const [appState, setAppState] = useState(AppState.currentState);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const appStateSubscription = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize progress when test starts
  useEffect(() => {
    if (isActive && !progress) {
      initializeProgress();
      logger.info('Test progress initialized', 'test-progress', { testId });
    }
  }, [isActive, progress, initializeProgress, testId]);

  // Handle app state changes for auto-save
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
      
      if (isActive && progress) {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          // Save immediately when app goes to background
          handleImmediateSave();
        } else if (nextAppState === 'active') {
          // Update activity when app becomes active
          updateActivity();
        }
      }
    };

    appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
      }
    };
  }, [isActive, progress]);

  // Handle immediate save
  const handleImmediateSave = useCallback(async () => {
    if (progress && hasUnsavedChanges) {
      try {
        await manualSave();
        setLastSaveTime(new Date().toISOString());
        setSaveError(null);
        logger.info('Test progress saved on app state change', 'test-progress', { testId });
      } catch (error) {
        setSaveError('Failed to save progress');
        logger.error('Failed to save progress on app state change', 'test-progress', error);
      }
    }
  }, [progress, hasUnsavedChanges, manualSave, testId]);

  // Update activity timestamp
  const updateActivity = useCallback(() => {
    if (progress) {
      // This would update the last activity timestamp
      logger.debug('Test activity updated', 'test-progress', { testId });
    }
  }, [progress, testId]);

  // Handle answer changes with debounced save
  const handleAnswerChange = useCallback((questionId: string, answer: any) => {
    // Update local state immediately
    updateAnswer(questionId, answer);
    updateProgressAnswer(questionId, answer);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await manualSave();
        setLastSaveTime(new Date().toISOString());
        setSaveError(null);
      } catch (error) {
        setSaveError('Failed to save progress');
        logger.error('Failed to save progress after answer change', 'test-progress', error);
      }
    }, 2000); // 2 second delay
  }, [updateAnswer, updateProgressAnswer, manualSave]);

  // Handle question index changes
  const handleQuestionIndexChange = useCallback((index: number) => {
    updateProgressQuestionIndex(index);
    
    // Save immediately when changing questions
    if (progress) {
      manualSave().catch(error => {
        setSaveError('Failed to save progress');
        logger.error('Failed to save progress after question change', 'test-progress', error);
      });
    }
  }, [updateProgressQuestionIndex, progress, manualSave]);

  // Restore progress on mount
  useEffect(() => {
    const restoreProgress = async () => {
      try {
        const stored = await AsyncStorage.getItem(`testProgress_${testId}`);
        if (stored) {
          const restoredProgress = JSON.parse(stored);
          onProgressRestored?.(restoredProgress);
          logger.info('Test progress restored', 'test-progress', { testId, progress: restoredProgress });
        }
      } catch (error) {
        logger.error('Failed to restore test progress', 'test-progress', error);
      }
    };

    if (isActive) {
      restoreProgress();
    }
  }, [isActive, testId, onProgressRestored]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Expose methods for parent components
  React.useImperativeHandle((null as unknown) as any, () => ({
    handleAnswerChange,
    handleQuestionIndexChange,
    saveProgress: manualSave,
    getProgressSummary,
    hasUnsavedChanges,
    isSaving,
    lastSaveTime,
    saveError,
  }));

  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      {isActive && progress && (
        <View style={styles.progressIndicator}>
          <Text style={styles.progressText}>
            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
          </Text>
          {lastSaveTime && (
            <Text style={styles.lastSaveText}>
              Last saved: {new Date(lastSaveTime).toLocaleTimeString()}
            </Text>
          )}
          {saveError && (
            <Text style={styles.errorText}>{saveError}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  progressIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  progressText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  lastSaveText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 10,
    marginTop: 2,
  },
});

// Hook for easy integration
export function useTestProgressIntegration(testId: string) {
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startTest = useCallback(() => {
    setIsActive(true);
    logger.info('Test started', 'test-progress', { testId });
  }, [testId]);

  const endTest = useCallback(() => {
    setIsActive(false);
    setProgress(null);
    setHasUnsavedChanges(false);
    setLastSaveTime(null);
    setSaveError(null);
    logger.info('Test ended', 'test-progress', { testId });
  }, [testId]);

  const updateProgress = useCallback((newProgress: any) => {
    setProgress(newProgress);
    setHasUnsavedChanges(true);
  }, []);

  const saveProgress = useCallback(async () => {
    if (!progress) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // This would be implemented with actual save logic
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate save
      
      setLastSaveTime(new Date().toISOString());
      setHasUnsavedChanges(false);
      logger.info('Test progress saved', 'test-progress', { testId, progress });
    } catch (error) {
      setSaveError('Failed to save progress');
      logger.error('Failed to save test progress', 'test-progress', error);
    } finally {
      setIsSaving(false);
    }
  }, [progress, testId]);

  const restoreProgress = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(`testProgress_${testId}`);
      if (stored) {
        const restoredProgress = JSON.parse(stored);
        setProgress(restoredProgress);
        logger.info('Test progress restored', 'test-progress', { testId, progress: restoredProgress });
        return restoredProgress;
      }
    } catch (error) {
      logger.error('Failed to restore test progress', 'test-progress', error);
    }
    return null;
  }, [testId]);

  const clearProgress = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(`testProgress_${testId}`);
      setProgress(null);
      setHasUnsavedChanges(false);
      setLastSaveTime(null);
      setSaveError(null);
      logger.info('Test progress cleared', 'test-progress', { testId });
    } catch (error) {
      logger.error('Failed to clear test progress', 'test-progress', error);
    }
  }, [testId]);

  return {
    isActive,
    progress,
    isSaving,
    hasUnsavedChanges,
    lastSaveTime,
    saveError,
    startTest,
    endTest,
    updateProgress,
    saveProgress,
    restoreProgress,
    clearProgress,
  };
}
