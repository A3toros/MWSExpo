import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface TestQuestion {
  id: string;
  type: string;
  question: string;
  options?: string[];
  correct_answer?: string | string[];
  points: number;
  order: number;
  required: boolean;
  metadata?: any;
}

export interface Test {
  id: string;
  title: string;
  description?: string;
  subject: string;
  teacher_name: string;
  test_type: string;
  total_points: number;
  time_limit?: number;
  questions: TestQuestion[];
  created_at: string;
  due_date?: string;
  is_active: boolean;
}

export interface TestResult {
  id: string;
  test_id: string;
  student_id: string;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  submitted_at: string;
  answers: Record<string, any>;
  question_analysis: Array<{
    question_id: string;
    correct: boolean;
    points_earned: number;
    points_possible: number;
  }>;
  caught_cheating: boolean;
  visibility_change_times: number;
}

export interface TestProgress {
  testId: string;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  timeSpent: number;
  lastSaved: string;
  isCompleted: boolean;
}

// State interface
interface TestState {
  activeTests: Test[];
  currentTest: Test | null;
  testProgress: TestProgress | null;
  testResults: TestResult[];
  loading: boolean;
  error: string | null;
  lastSync: string | null;
}

// Action types
type TestAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_TESTS'; payload: Test[] }
  | { type: 'SET_CURRENT_TEST'; payload: Test | null }
  | { type: 'SET_TEST_PROGRESS'; payload: TestProgress | null }
  | { type: 'UPDATE_ANSWER'; payload: { questionId: string; answer: any } }
  | { type: 'SET_QUESTION_INDEX'; payload: number }
  | { type: 'SET_TEST_RESULTS'; payload: TestResult[] }
  | { type: 'ADD_TEST_RESULT'; payload: TestResult }
  | { type: 'SET_LAST_SYNC'; payload: string }
  | { type: 'RESET_TEST' }
  | { type: 'COMPLETE_TEST' };

// Initial state
const initialState: TestState = {
  activeTests: [],
  currentTest: null,
  testProgress: null,
  testResults: [],
  loading: false,
  error: null,
  lastSync: null,
};

// Reducer
function testReducer(state: TestState, action: TestAction): TestState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_ACTIVE_TESTS':
      return { ...state, activeTests: action.payload, loading: false };
    
    case 'SET_CURRENT_TEST':
      return { ...state, currentTest: action.payload };
    
    case 'SET_TEST_PROGRESS':
      return { ...state, testProgress: action.payload };
    
    case 'UPDATE_ANSWER':
      if (!state.testProgress) return state;
      return {
        ...state,
        testProgress: {
          ...state.testProgress,
          answers: {
            ...state.testProgress.answers,
            [action.payload.questionId]: action.payload.answer,
          },
          lastSaved: new Date().toISOString(),
        },
      };
    
    case 'SET_QUESTION_INDEX':
      if (!state.testProgress) return state;
      return {
        ...state,
        testProgress: {
          ...state.testProgress,
          currentQuestionIndex: action.payload,
        },
      };
    
    case 'SET_TEST_RESULTS':
      return { ...state, testResults: action.payload };
    
    case 'ADD_TEST_RESULT':
      return {
        ...state,
        testResults: [action.payload, ...state.testResults],
      };
    
    case 'SET_LAST_SYNC':
      return { ...state, lastSync: action.payload };
    
    case 'RESET_TEST':
      return {
        ...state,
        currentTest: null,
        testProgress: null,
      };
    
    case 'COMPLETE_TEST':
      if (!state.testProgress) return state;
      return {
        ...state,
        testProgress: {
          ...state.testProgress,
          isCompleted: true,
        },
      };
    
    default:
      return state;
  }
}

// Context
const TestContext = createContext<{
  state: TestState;
  dispatch: React.Dispatch<TestAction>;
  // Actions
  loadActiveTests: () => Promise<void>;
  startTest: (test: Test) => void;
  updateAnswer: (questionId: string, answer: any) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  saveProgress: () => Promise<void>;
  completeTest: (result: TestResult) => void;
  loadTestResults: () => Promise<void>;
  resetTest: () => void;
} | null>(null);

// Provider component
export function TestProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(testReducer, initialState);

  // Load test progress from storage
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const stored = await AsyncStorage.getItem('testProgress');
        if (stored) {
          const progress = JSON.parse(stored);
          dispatch({ type: 'SET_TEST_PROGRESS', payload: progress });
        }
      } catch (error) {
        console.error('Failed to load test progress:', error);
      }
    };
    loadProgress();
  }, []);

  // Save progress to storage whenever it changes
  useEffect(() => {
    if (state.testProgress) {
      AsyncStorage.setItem('testProgress', JSON.stringify(state.testProgress));
    }
  }, [state.testProgress]);

  // Actions
  const loadActiveTests = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // This would be replaced with actual API call
      // const tests = await testService.getActiveTests();
      // dispatch({ type: 'SET_ACTIVE_TESTS', payload: tests });
      dispatch({ type: 'SET_LAST_SYNC', payload: new Date().toISOString() });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load tests' });
    }
  };

  const startTest = (test: Test) => {
    dispatch({ type: 'SET_CURRENT_TEST', payload: test });
    const progress: TestProgress = {
      testId: test.id,
      currentQuestionIndex: 0,
      answers: {},
      timeSpent: 0,
      lastSaved: new Date().toISOString(),
      isCompleted: false,
    };
    dispatch({ type: 'SET_TEST_PROGRESS', payload: progress });
  };

  const updateAnswer = (questionId: string, answer: any) => {
    dispatch({ type: 'UPDATE_ANSWER', payload: { questionId, answer } });
  };

  const nextQuestion = () => {
    if (state.currentTest && state.testProgress) {
      const nextIndex = Math.min(
        state.testProgress.currentQuestionIndex + 1,
        state.currentTest.questions.length - 1
      );
      dispatch({ type: 'SET_QUESTION_INDEX', payload: nextIndex });
    }
  };

  const prevQuestion = () => {
    if (state.testProgress) {
      const prevIndex = Math.max(state.testProgress.currentQuestionIndex - 1, 0);
      dispatch({ type: 'SET_QUESTION_INDEX', payload: prevIndex });
    }
  };

  const saveProgress = async () => {
    if (state.testProgress) {
      try {
        await AsyncStorage.setItem('testProgress', JSON.stringify(state.testProgress));
        dispatch({ type: 'SET_LAST_SYNC', payload: new Date().toISOString() });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to save progress' });
      }
    }
  };

  const completeTest = (result: TestResult) => {
    dispatch({ type: 'ADD_TEST_RESULT', payload: result });
    dispatch({ type: 'COMPLETE_TEST' });
    // Clear progress after completion
    AsyncStorage.removeItem('testProgress');
  };

  const loadTestResults = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // This would be replaced with actual API call
      // const results = await resultService.getStudentResults();
      // dispatch({ type: 'SET_TEST_RESULTS', payload: results });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load results' });
    }
  };

  const resetTest = () => {
    dispatch({ type: 'RESET_TEST' });
    AsyncStorage.removeItem('testProgress');
  };

  const value = {
    state,
    dispatch,
    loadActiveTests,
    startTest,
    updateAnswer,
    nextQuestion,
    prevQuestion,
    saveProgress,
    completeTest,
    loadTestResults,
    resetTest,
  };

  return <TestContext.Provider value={value}>{children}</TestContext.Provider>;
}

// Hook to use the context
export function useTest() {
  const context = useContext(TestContext);
  if (!context) {
    throw new Error('useTest must be used within a TestProvider');
  }
  return context;
}
