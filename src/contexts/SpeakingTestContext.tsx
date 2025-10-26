import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { Alert } from 'react-native';

// Types
export interface SpeakingTestState {
  // Test data
  testId: string;
  testName: string;
  questions: SpeakingQuestion[];
  currentQuestionIndex: number;
  
  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioUri: string | null;
  audioQuality: 'good' | 'poor' | 'unknown';
  
  // Processing state
  isProcessing: boolean;
  processingStep: 'uploading' | 'transcribing' | 'analyzing' | 'complete';
  processingProgress: number;
  
  // Results
  transcript: string;
  aiAnalysis: AIAnalysis | null;
  feedback: Feedback | null;
  
  // Test flow
  currentStep: 'permission' | 'recording' | 'processing' | 'feedback' | 'completed';
  attempts: number;
  maxAttempts: number;
  attemptHistory: AttemptData[];
  
  // Error handling
  error: string | null;
  retryCount: number;
  testStartTime: number | null;
}

export interface AttemptData {
  attemptNumber: number;
  audioUri: string;
  transcript: string;
  analysis: AIAnalysis;
  feedback: Feedback;
  timestamp: number;
}

export interface SpeakingQuestion {
  id: string;
  question_text: string;
  prompt?: string;
  min_words: number;
  max_duration: number;
  expected_keywords?: string[];
}

export interface AIAnalysis {
  transcript: string;
  word_count: number;
  overall_score: number;
  grammar_score: number;
  vocabulary_score: number;
  pronunciation_score: number;
  fluency_score: number;
  content_score: number;
  grammar_mistakes: number;
  vocabulary_mistakes: number;
  feedback: string;
  improved_transcript: string;
  grammar_corrections: any[];
  vocabulary_corrections: any[];
  language_use_corrections: any[];
  pronunciation_corrections: any[];
  ai_feedback: any;
  keywords_found: string[];
  keywords_missing: string[];
  suggestions: string[];
}

export interface Feedback {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  analysis: AIAnalysis;
  teacher_feedback?: string;
}

// Action types
type SpeakingTestAction =
  | { type: 'INITIALIZE_TEST'; payload: { testId: string; testName: string; questions: SpeakingQuestion[] } }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING'; payload: { audioUri: string; duration: number } }
  | { type: 'PAUSE_RECORDING' }
  | { type: 'RESUME_RECORDING' }
  | { type: 'UPDATE_RECORDING_TIME'; payload: number }
  | { type: 'START_PROCESSING' }
  | { type: 'UPDATE_PROCESSING'; payload: { step: string; progress: number } }
  | { type: 'COMPLETE_PROCESSING'; payload: { transcript: string; analysis: AIAnalysis } }
  | { type: 'SET_FEEDBACK'; payload: Feedback }
  | { type: 'NEXT_QUESTION' }
  | { type: 'RETRY_ATTEMPT' }
  | { type: 'SAVE_ATTEMPT'; payload: AttemptData }
  | { type: 'LOAD_ATTEMPTS'; payload: AttemptData[] }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET_TEST' };

// Initial state
const initialState: SpeakingTestState = {
  testId: '',
  testName: '',
  questions: [],
  currentQuestionIndex: 0,
  isRecording: false,
  isPaused: false,
  recordingTime: 0,
  audioUri: null,
  audioQuality: 'unknown',
  isProcessing: false,
  processingStep: 'uploading',
  processingProgress: 0,
  transcript: '',
  aiAnalysis: null,
  feedback: null,
  currentStep: 'permission',
  attempts: 1,
  maxAttempts: 3,
  attemptHistory: [],
  error: null,
  retryCount: 0,
  testStartTime: null,
};

// Reducer
function speakingTestReducer(state: SpeakingTestState, action: SpeakingTestAction): SpeakingTestState {
  switch (action.type) {
    case 'INITIALIZE_TEST':
      return {
        ...state,
        testId: action.payload.testId,
        testName: action.payload.testName,
        questions: action.payload.questions,
        currentQuestionIndex: 0,
        currentStep: 'permission',
        attempts: 0,
        error: null,
      };

    case 'START_RECORDING':
      return {
        ...state,
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        audioUri: null,
        currentStep: 'recording',
        error: null,
      };

    case 'STOP_RECORDING':
      return {
        ...state,
        isRecording: false,
        isPaused: false,
        audioUri: action.payload.audioUri,
        recordingTime: action.payload.duration,
        currentStep: 'processing',
      };

    case 'PAUSE_RECORDING':
      return {
        ...state,
        isPaused: true,
      };

    case 'RESUME_RECORDING':
      return {
        ...state,
        isPaused: false,
      };

    case 'UPDATE_RECORDING_TIME':
      return {
        ...state,
        recordingTime: action.payload,
      };

    case 'START_PROCESSING':
      return {
        ...state,
        isProcessing: true,
        processingStep: 'uploading',
        processingProgress: 0,
        currentStep: 'processing',
      };

    case 'UPDATE_PROCESSING':
      return {
        ...state,
        processingStep: action.payload.step as any,
        processingProgress: action.payload.progress,
      };

    case 'COMPLETE_PROCESSING':
      return {
        ...state,
        isProcessing: false,
        transcript: action.payload.transcript,
        aiAnalysis: action.payload.analysis,
        currentStep: 'feedback',
      };

    case 'SET_FEEDBACK':
      return {
        ...state,
        feedback: action.payload,
        currentStep: 'feedback',
      };

    case 'NEXT_QUESTION':
      const nextIndex = state.currentQuestionIndex + 1;
      return {
        ...state,
        currentQuestionIndex: nextIndex,
        currentStep: nextIndex < state.questions.length ? 'permission' : 'completed',
        isRecording: false,
        isPaused: false,
        recordingTime: 0,
        audioUri: null,
        transcript: '',
        aiAnalysis: null,
        feedback: null,
        error: null,
      };

    case 'RETRY_ATTEMPT':
      return {
        ...state,
        attempts: state.attempts + 1,
        currentStep: 'recording',
        isRecording: false,
        isPaused: false,
        recordingTime: 0,
        audioUri: null,
        transcript: '',
        aiAnalysis: null,
        feedback: null,
        error: null,
      };
    
    case 'SAVE_ATTEMPT':
      return {
        ...state,
        attemptHistory: [...state.attemptHistory, action.payload],
      };
    
    case 'LOAD_ATTEMPTS':
      return {
        ...state,
        attemptHistory: action.payload,
        attempts: action.payload.length + 1,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isRecording: false,
        isProcessing: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'RESET_TEST':
      return {
        ...initialState,
        testId: state.testId,
        testName: state.testName,
        questions: state.questions,
      };

    default:
      return state;
  }
}

// Context
const SpeakingTestContext = createContext<{
  state: SpeakingTestState;
  dispatch: React.Dispatch<SpeakingTestAction>;
  actions: {
    initializeTest: (testId: string, testName: string, questions: SpeakingQuestion[]) => void;
    startRecording: () => void;
    stopRecording: (audioUri: string, duration: number) => void;
    pauseRecording: () => void;
    resumeRecording: () => void;
    updateRecordingTime: (time: number) => void;
    startProcessing: () => void;
    updateProcessing: (step: string, progress: number) => void;
    completeProcessing: (transcript: string, analysis: AIAnalysis) => void;
    setFeedback: (feedback: Feedback) => void;
    nextQuestion: () => void;
    retryAttempt: () => void;
    saveAttempt: (attemptData: AttemptData) => void;
    loadAttempts: (attempts: AttemptData[]) => void;
    setError: (error: string) => void;
    clearError: () => void;
    resetTest: () => void;
  };
} | null>(null);

// Provider
export function SpeakingTestProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(speakingTestReducer, initialState);

  const actions = React.useMemo(() => ({
    initializeTest: (testId: string, testName: string, questions: SpeakingQuestion[]) => {
      dispatch({ type: 'INITIALIZE_TEST', payload: { testId, testName, questions } });
    },

    startRecording: () => {
      dispatch({ type: 'START_RECORDING' });
    },

    stopRecording: (audioUri: string, duration: number) => {
      dispatch({ type: 'STOP_RECORDING', payload: { audioUri, duration } });
    },

    pauseRecording: () => {
      dispatch({ type: 'PAUSE_RECORDING' });
    },

    resumeRecording: () => {
      dispatch({ type: 'RESUME_RECORDING' });
    },

    updateRecordingTime: (time: number) => {
      dispatch({ type: 'UPDATE_RECORDING_TIME', payload: time });
    },

    startProcessing: () => {
      dispatch({ type: 'START_PROCESSING' });
    },

    updateProcessing: (step: string, progress: number) => {
      dispatch({ type: 'UPDATE_PROCESSING', payload: { step, progress } });
    },

    completeProcessing: (transcript: string, analysis: AIAnalysis) => {
      dispatch({ type: 'COMPLETE_PROCESSING', payload: { transcript, analysis } });
    },

    setFeedback: (feedback: Feedback) => {
      dispatch({ type: 'SET_FEEDBACK', payload: feedback });
    },

    nextQuestion: () => {
      dispatch({ type: 'NEXT_QUESTION' });
    },

    retryAttempt: () => {
      if (state.attempts >= state.maxAttempts) {
        Alert.alert(
          'Maximum Attempts Reached',
          'You have reached the maximum number of attempts for this question.',
          [{ text: 'OK' }]
        );
        return;
      }
      dispatch({ type: 'RETRY_ATTEMPT' });
    },

    setError: (error: string) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    },

    clearError: () => {
      dispatch({ type: 'CLEAR_ERROR' });
    },

    resetTest: () => {
      dispatch({ type: 'RESET_TEST' });
    },

    saveAttempt: (attemptData: AttemptData) => {
      dispatch({ type: 'SAVE_ATTEMPT', payload: attemptData });
    },

    loadAttempts: (attempts: AttemptData[]) => {
      dispatch({ type: 'LOAD_ATTEMPTS', payload: attempts });
    },
  }), [state.attempts, state.maxAttempts]);

  return (
    <SpeakingTestContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </SpeakingTestContext.Provider>
  );
}

// Hook
export function useSpeakingTest() {
  const context = useContext(SpeakingTestContext);
  if (!context) {
    throw new Error('useSpeakingTest must be used within a SpeakingTestProvider');
  }
  return context;
}

