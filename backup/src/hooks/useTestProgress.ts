import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TestProgress {
  testId: string;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  timeSpent: number;
  lastSaved: string;
  isCompleted: boolean;
  startTime: string;
  lastActivity: string;
  questionTimes: Record<string, number>; // time spent on each question
  autoSaveEnabled: boolean;
}

interface ProgressState {
  progress: TestProgress | null;
  isSaving: boolean;
  lastSaveTime: string | null;
  hasUnsavedChanges: boolean;
}

interface AutoSaveOptions {
  enabled: boolean;
  interval: number; // milliseconds
  onSave: (progress: TestProgress) => Promise<void>;
  onError: (error: Error) => void;
}

export function useTestProgress(
  testId: string,
  autoSaveOptions: AutoSaveOptions = {
    enabled: true,
    interval: 30000, // 30 seconds
    onSave: async () => {},
    onError: () => {},
  }
) {
  const [state, setState] = useState<ProgressState>({
    progress: null,
    isSaving: false,
    lastSaveTime: null,
    hasUnsavedChanges: false,
  });

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<string | null>(null);

  // Load progress from storage
  const loadProgress = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(`testProgress_${testId}`);
      if (stored) {
        const progress = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          progress,
          hasUnsavedChanges: false,
        }));
        return progress;
      }
    } catch (error) {
      console.error('Failed to load test progress:', error);
    }
    return null;
  }, [testId]);

  // Save progress to storage
  const saveProgress = useCallback(async (progress: TestProgress) => {
    setState(prev => ({ ...prev, isSaving: true }));
    
    try {
      await AsyncStorage.setItem(`testProgress_${testId}`, JSON.stringify(progress));
      setState(prev => ({
        ...prev,
        isSaving: false,
        lastSaveTime: new Date().toISOString(),
        hasUnsavedChanges: false,
      }));
      lastSaveRef.current = new Date().toISOString();
    } catch (error) {
      setState(prev => ({ ...prev, isSaving: false }));
      console.error('Failed to save test progress:', error);
      throw error;
    }
  }, [testId]);

  // Initialize progress
  const initializeProgress = useCallback(() => {
    const now = new Date().toISOString();
    const progress: TestProgress = {
      testId,
      currentQuestionIndex: 0,
      answers: {},
      timeSpent: 0,
      lastSaved: now,
      isCompleted: false,
      startTime: now,
      lastActivity: now,
      questionTimes: {},
      autoSaveEnabled: autoSaveOptions.enabled,
    };

    setState(prev => ({
      ...prev,
      progress,
      hasUnsavedChanges: true,
    }));

    return progress;
  }, [testId, autoSaveOptions.enabled]);

  // Update answer
  const updateAnswer = useCallback((questionId: string, answer: any) => {
    if (!state.progress) return;

    const updatedProgress: TestProgress = {
      ...state.progress,
      answers: {
        ...state.progress.answers,
        [questionId]: answer,
      },
      lastActivity: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      progress: updatedProgress,
      hasUnsavedChanges: true,
    }));
  }, [state.progress]);

  // Update question index
  const updateQuestionIndex = useCallback((index: number) => {
    if (!state.progress) return;

    const now = new Date().toISOString();
    const timeSpent = Date.now() - new Date(state.progress.startTime).getTime();
    
    const updatedProgress: TestProgress = {
      ...state.progress,
      currentQuestionIndex: index,
      timeSpent,
      lastActivity: now,
      questionTimes: {
        ...state.progress.questionTimes,
        [state.progress.currentQuestionIndex.toString()]: 
          Date.now() - new Date(state.progress.lastActivity).getTime(),
      },
    };

    setState(prev => ({
      ...prev,
      progress: updatedProgress,
      hasUnsavedChanges: true,
    }));
  }, [state.progress]);

  // Update time spent
  const updateTimeSpent = useCallback(() => {
    if (!state.progress) return;

    const timeSpent = Date.now() - new Date(state.progress.startTime).getTime();
    const updatedProgress: TestProgress = {
      ...state.progress,
      timeSpent,
      lastActivity: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      progress: updatedProgress,
    }));
  }, [state.progress]);

  // Complete test
  const completeTest = useCallback(() => {
    if (!state.progress) return;

    const updatedProgress: TestProgress = {
      ...state.progress,
      isCompleted: true,
      lastActivity: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      progress: updatedProgress,
      hasUnsavedChanges: true,
    }));
  }, [state.progress]);

  // Auto-save functionality
  const startAutoSave = useCallback(() => {
    if (!autoSaveOptions.enabled || !state.progress) return;

    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(async () => {
      if (state.hasUnsavedChanges && state.progress) {
        try {
          await saveProgress(state.progress);
          await autoSaveOptions.onSave(state.progress);
        } catch (error) {
          autoSaveOptions.onError(error as Error);
        }
      }
    }, autoSaveOptions.interval);
  }, [autoSaveOptions, state.hasUnsavedChanges, state.progress, saveProgress]);

  const stopAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  // Manual save
  const manualSave = useCallback(async () => {
    if (!state.progress) return;

    try {
      await saveProgress(state.progress);
      await autoSaveOptions.onSave(state.progress);
    } catch (error) {
      autoSaveOptions.onError(error as Error);
      throw error;
    }
  }, [state.progress, saveProgress, autoSaveOptions]);

  // Clear progress
  const clearProgress = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(`testProgress_${testId}`);
      setState({
        progress: null,
        isSaving: false,
        lastSaveTime: null,
        hasUnsavedChanges: false,
      });
    } catch (error) {
      console.error('Failed to clear test progress:', error);
    }
  }, [testId]);

  // Get progress summary
  const getProgressSummary = useCallback(() => {
    if (!state.progress) return null;

    const totalQuestions = Object.keys(state.progress.answers).length;
    const answeredQuestions = Object.values(state.progress.answers).filter(
      answer => answer !== null && answer !== undefined && answer !== ''
    ).length;

    return {
      totalQuestions,
      answeredQuestions,
      completionPercentage: totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0,
      timeSpent: state.progress.timeSpent,
      isCompleted: state.progress.isCompleted,
      lastSaved: state.progress.lastSaved,
    };
  }, [state.progress]);

  // Start auto-save when progress is available
  useEffect(() => {
    if (state.progress && autoSaveOptions.enabled) {
      startAutoSave();
    } else {
      stopAutoSave();
    }

    return () => stopAutoSave();
  }, [state.progress, autoSaveOptions.enabled, startAutoSave, stopAutoSave]);

  // Update time spent every minute
  useEffect(() => {
    const interval = setInterval(updateTimeSpent, 60000);
    return () => clearInterval(interval);
  }, [updateTimeSpent]);

  return {
    ...state,
    loadProgress,
    saveProgress,
    initializeProgress,
    updateAnswer,
    updateQuestionIndex,
    updateTimeSpent,
    completeTest,
    manualSave,
    clearProgress,
    getProgressSummary,
    startAutoSave,
    stopAutoSave,
  };
}
