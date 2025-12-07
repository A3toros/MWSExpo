/** @jsxImportSource nativewind */
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { SecureToken } from '../../utils/secureTokenStorage';
import { View, Text, ScrollView, Alert, ActivityIndicator, TouchableOpacity, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSpeakingTest } from '../../contexts/SpeakingTestContext';
import AudioRecorderNew from '../audio/AudioRecorderNew';
import ProcessingIndicator from '../ui/ProcessingIndicator';
import FeedbackDisplay from '../ui/FeedbackDisplay';
import TestHeader from '../TestHeader';
import { AIProcessingService } from '../../services/AIProcessingService';
import { AttemptStorageService } from '../../services/AttemptStorageService';
import { academicCalendarService } from '../../services/AcademicCalendarService';
import { ThemeMode } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import { getRetestAssignmentId, handleRetestCompletion } from '../../utils/retestUtils';
import { useAntiCheatingDetection } from '../../hooks/useAntiCheatingDetection';

interface SpeakingTestStudentProps {
  testId: string;
  testName: string;
  questions: any[];
  onTestComplete: (results: any) => void;
  onAnswerChange: (questionId: string, answer: any) => void;
  studentId?: string; // Optional - will be extracted from JWT if not provided
  showCorrectAnswers?: boolean;
  themeMode?: ThemeMode;
  antiCheatingEnabled?: boolean;
  initialTranscript?: string | null;
}

export default function SpeakingTestStudent({
  testId,
  testName,
  questions,
  onTestComplete,
  onAnswerChange,
  studentId: propStudentId,
  showCorrectAnswers = false,
  themeMode = 'light',
  antiCheatingEnabled = true,
  initialTranscript = null,
}: SpeakingTestStudentProps) {
  const { state, actions } = useSpeakingTest();
  const [extractedStudentId, setExtractedStudentId] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [prefilledTranscript] = useState<string | null>(initialTranscript || null);
  const themeClasses = getThemeClasses(themeMode);
  const hasLoggedStudentIdRef = useRef(false);

  // Helper function to decode JWT token and extract student ID
  const getStudentIdFromToken = async (): Promise<string | null> => {
    try {
      const token = await SecureToken.get();
      if (!token) return null;
      
      // Decode JWT token (simple base64 decode of payload)
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      
      // Try multiple possible fields for student ID
      return payload.student_id || payload.id || payload.user_id || payload.username || payload.email || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Extract student ID on mount
  useEffect(() => {
    const extractStudentId = async () => {
      const tokenStudentId = await getStudentIdFromToken();
      console.log('🎤 Extracted student ID from JWT:', tokenStudentId);
      setExtractedStudentId(tokenStudentId);
    };
    extractStudentId();
  }, []);

  // Use prop studentId if provided, otherwise use extracted from token
  const studentId = propStudentId || extractedStudentId || 'unknown';
  useEffect(() => {
    if (hasLoggedStudentIdRef.current) return;
    console.log('🎤 Using student ID:', studentId, '(prop:', propStudentId, ', extracted:', extractedStudentId, ')');
    hasLoggedStudentIdRef.current = true;
  }, [studentId, propStudentId, extractedStudentId]);

  // Anti-cheating detection hook
  const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId || ''));
  const { caughtCheating, visibilityChangeTimes, clearCheatingKeys, textInputProps } = useAntiCheatingDetection({
    studentId: studentId || '',
    testType: 'speaking',
    testId: testIdStr,
    enabled: !!studentId && !!testId && studentId !== 'unknown' && antiCheatingEnabled,
  });

  // Submit final results to database
  const submitFinalResults = async (audioUri: string, duration: number, analysis: any) => {
    if (hasSubmitted) {
      console.log('🎤 Submission already completed, skipping...');
      return;
    }
    
    try {
      console.log('🎤 Starting final submission process...');
      console.log('🎤 Audio URI:', audioUri);
      console.log('🎤 Test ID:', testId);
      console.log('🎤 Test Name:', testName);
      console.log('🎤 Student ID:', studentId);
      
      console.log('🎤 Converting audio to base64...');
      const audioBase64 = await AIProcessingService.convertAudioToBase64(audioUri);
      console.log('🎤 Audio base64 length:', audioBase64.length);
      
      // Copy exact payload structure from web app
      const endTime = new Date();
      const timeTaken = Math.round(duration);
      const startedAt = new Date(Date.now() - timeTaken * 1000).toISOString();
      
      // Get test data to extract teacher_id and subject_id (like other tests)
      const currentTest = questions[state.currentQuestionIndex];
      
      // Get current academic period ID from academic calendar service (like web app)
      await academicCalendarService.loadAcademicCalendar();
      const currentTerm = academicCalendarService.getCurrentTerm();
      const academic_period_id = currentTerm?.id;
      
      if (!academic_period_id) {
        throw new Error('No current academic period found');
      }
      
      // Get retest_assignment_id from AsyncStorage if this is a retest (web app pattern)
      const retestAssignmentId = await getRetestAssignmentId(studentId, 'speaking', testId);
      
      const submissionData = {
        test_id: testId,
        test_name: testName,
        teacher_id: currentTest?.teacher_id || null, // From question data like other tests
        subject_id: currentTest?.subject_id || null, // From question data like other tests
        student_id: studentId || 'unknown',
        academic_period_id: academic_period_id, // From academic calendar service like web app (number)
        question_id: questions[state.currentQuestionIndex]?.id || 1,
        audio_blob: audioBase64 || null, // Can be null like web app
        audio_duration: duration,
        time_taken: timeTaken,
        started_at: startedAt,
        submitted_at: endTime.toISOString(),
        caught_cheating: caughtCheating,
        visibility_change_times: visibilityChangeTimes,
        is_completed: true,
        retest_assignment_id: retestAssignmentId, // Get from AsyncStorage (web app pattern)
        parent_test_id: testId,
        // Include already processed results
        transcript: analysis.transcript,
        scores: analysis,
        final_submission: true // Flag to indicate this is the final submission
      };
      
      console.log('🎤 Submission data:', {
        test_id: submissionData.test_id,
        test_name: submissionData.test_name,
        teacher_id: submissionData.teacher_id,
        subject_id: submissionData.subject_id,
        student_id: submissionData.student_id,
        question_id: submissionData.question_id,
        has_audio_blob: !!submissionData.audio_blob,
        has_transcript: !!submissionData.transcript,
        has_scores: !!submissionData.scores,
        audio_duration: submissionData.audio_duration,
        time_taken: submissionData.time_taken,
        caught_cheating: submissionData.caught_cheating,
        visibility_change_times: submissionData.visibility_change_times,
        retest_assignment_id: submissionData.retest_assignment_id,
        parent_test_id: submissionData.parent_test_id,
        academic_period_id: submissionData.academic_period_id
      });
      
      console.log('🎤 Calling submitFinalResults...');
      console.log('🎤 ===== ANDROID APP PAYLOAD DEBUG =====');
      console.log('🎤 Submission data being sent:', JSON.stringify(submissionData, null, 2));
      console.log('🎤 Current question:', JSON.stringify(currentTest, null, 2));
      console.log('🎤 Academic period ID type:', typeof academic_period_id, 'value:', academic_period_id);
      console.log('🎤 Audio blob type:', typeof submissionData.audio_blob, 'length:', submissionData.audio_blob?.length || 0);
      console.log('🎤 Question ID type:', typeof submissionData.question_id, 'value:', submissionData.question_id);
      console.log('🎤 Retest assignment ID type:', typeof submissionData.retest_assignment_id, 'value:', submissionData.retest_assignment_id);
      console.log('🎤 ===== END ANDROID APP PAYLOAD DEBUG =====');
      await AIProcessingService.submitFinalResults(submissionData);
      
      console.log('🎤 Final results submitted successfully');
      setHasSubmitted(true);
      
      // Clear anti-cheating keys on successful submission
      await clearCheatingKeys();
      
      // Handle retest completion (backend is authoritative)
      const percentage = analysis?.overall_score || 0;
      await handleRetestCompletion(studentId, 'speaking', testId, {
        success: true,
        percentage: percentage,
        percentage_score: percentage
      });
      
      console.log('🎤 Test marked as completed in AsyncStorage');
    } catch (submitError: any) {
      console.error('🎤 Failed to submit final results:', submitError);
      console.error('🎤 Submit error details:', {
        message: submitError.message,
        stack: submitError.stack,
        response: submitError.response?.data
      });
      // Don't throw error - user can still see feedback
      // The attempt is saved locally, so they can retry later
    }
  };

  // Seeded random number generator (mulberry32) - same as web app
  const mulberry32 = useCallback((a: number) => {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }, []);

  // Function to select a random question deterministically (same as web app)
  const selectRandomQuestion = useCallback((questions: any[], testId: string, studentId: string) => {
    // If only one question, return it
    if (questions.length === 1) {
      return questions[0];
    }
    
    // Create deterministic seed from student ID and test ID (same as web app)
    const seedStr = `${studentId}:speaking:${testId}`;
    const seed = Array.from(seedStr).reduce((acc, c) => 
      ((acc << 5) - acc) + c.charCodeAt(0), 0) >>> 0;
    
    // Use seeded RNG for consistent selection
    const rng = mulberry32(seed);
    const randomIndex = Math.floor(rng() * questions.length);
    
    console.log('🎯 Selected question for student:', {
      studentId,
      testId,
      totalQuestions: questions.length,
      selectedQuestion: questions[randomIndex]?.id,
      selectedPrompt: questions[randomIndex]?.prompt?.substring(0, 50) + '...'
    });
    
    return questions[randomIndex];
  }, [mulberry32]);

  // Check if test is already completed (like word matching test)
  const checkTestCompleted = useCallback(async () => {
    if (!testId || !studentId) return false;
    
    try {
      const completionKey = `test_completed_${studentId}_speaking_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      const retestKey = `retest1_${studentId}_speaking_${testId}`;
      const hasRetest = await AsyncStorage.getItem(retestKey);
      
      if (isCompleted === 'true' && hasRetest !== 'true') {
        console.log('🎤 Test already completed, should show completion message');
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('Error checking test completion:', e);
      return false;
    }
  }, [studentId, testId]);

  // Initialize test when component mounts
  useEffect(() => {
    if (testId && testName && questions.length > 0 && studentId) {
      // Select random question deterministically (like web app)
      const selectedQuestion = selectRandomQuestion(questions, testId, studentId);
      
      // Initialize test with the selected question
      actions.initializeTest(testId, testName, [selectedQuestion]);
      
      // Check if test is already completed first
      const checkCompletion = async () => {
        const isCompleted = await checkTestCompleted();
        if (isCompleted) {
          // Test is completed, we could show a completion message or redirect
          console.log('🎤 Test already completed');
          return;
        }
      };
      
      checkCompletion();
      
      // Load attempts from storage (like web app)
      const loadAttempts = async () => {
        try {
          const attempts = await AttemptStorageService.getAttemptHistory(
            studentId || 'unknown',
            testId
          );
          
          if (attempts.length > 0) {
            actions.loadAttempts(attempts);
            console.log('🔄 Loaded attempts from storage:', attempts);
            
            // If we have attempts, restore the most recent feedback
            const mostRecentAttempt = attempts[attempts.length - 1];
            if (mostRecentAttempt && mostRecentAttempt.feedback) {
              actions.setFeedback(mostRecentAttempt.feedback);
              console.log('🔄 Restored feedback from most recent attempt');
              
              // Restore audioUri and transcript to context state for display
              if (mostRecentAttempt.audioUri) {
                actions.stopRecording(mostRecentAttempt.audioUri, 0);
              }
              if (mostRecentAttempt.analysis) {
                // CRITICAL FIX: Don't call completeProcessing during state restoration
                // This was causing auto-submission when returning to dashboard
                // Just restore the analysis data without triggering processing flow
                console.log('🔄 Restored analysis data without triggering processing flow');
              }
              
              console.log('🔄 Restored speaking test state from previous attempt');
            }
          }
        } catch (error) {
          console.error('Failed to load attempts:', error);
        }
      };
      
      // Load current state from storage
      const loadCurrentState = async () => {
        try {
          const savedState = await AttemptStorageService.loadSpeakingTestData(
            studentId || 'unknown',
            testId
          );
          
          if (savedState) {
            console.log('🔄 Loaded current speaking test state from storage:', savedState);
            // Restore the state if it's recent (within last 24 hours)
            const isRecent = Date.now() - savedState.timestamp < 24 * 60 * 60 * 1000;
            if (isRecent && savedState.feedback) {
              // Restore audioUri and transcript to context state
              if (savedState.audioUri) {
                actions.stopRecording(savedState.audioUri, savedState.audioDuration || 0);
              }
              if (savedState.transcript && savedState.feedback.analysis) {
                // CRITICAL FIX: Don't call completeProcessing during state restoration
                // This was causing auto-submission when returning to dashboard
                // Just restore the feedback without triggering processing flow
                console.log('🔄 Restored transcript and analysis data without triggering processing flow');
              }
              
              // Restore the feedback and current step
              actions.setFeedback(savedState.feedback);
              console.log('🔄 Restored speaking test state from storage');
            }
          }
        } catch (error) {
          console.error('Failed to load current state:', error);
        }
      };
      
      loadAttempts();
      loadCurrentState();
    }
  }, [testId, testName, questions.length, studentId]); // Remove actions dependency

  // Save current state to AsyncStorage
  const saveCurrentStateToStorage = async () => {
    try {
      if (studentId && testId) {
        const currentState = {
          audioUri: '', // Will be filled from current attempt if available
          transcript: state.feedback?.analysis?.transcript || '',
          analysis: state.feedback?.analysis || null,
          feedback: state.feedback,
          currentStep: state.currentStep,
          timestamp: Date.now(),
          // Additional state data
          currentQuestionIndex: state.currentQuestionIndex,
          attempts: state.attempts,
          attemptHistory: state.attemptHistory,
          isProcessing: state.isProcessing
        };
        
        await AttemptStorageService.saveSpeakingTestData(
          studentId.toString(),
          testId,
          currentState
        );
        
        console.log('💾 Saved current speaking test state to AsyncStorage');
      }
    } catch (error) {
      console.error('Failed to save current state:', error);
    }
  };

  // Save state when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        saveCurrentStateToStorage();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []); // Remove state dependencies to prevent infinite loop

  // Cleanup on unmount and save current state
  useEffect(() => {
    return () => {
      // Save current state when component unmounts
      saveCurrentStateToStorage();
    };
  }, []); // Remove state dependencies to prevent infinite loop

  // Handle recording start
  const handleRecordingStart = useCallback(() => {
    actions.startRecording();
  }, [actions]);

  // Handle recording time update (not used in new AudioRecorder)
  // const handleRecordingTimeUpdate = useCallback((time: number) => {
  //   actions.updateRecordingTime(time);
  // }, [actions]);

  // Handle recording stop
  const handleRecordingStop = useCallback(async (audioUri: string, duration: number) => {
    actions.stopRecording(audioUri, duration);
    
    // Start processing immediately
    actions.startProcessing();
    
    try {
      // Use real AI processing (like web app)
      actions.updateProcessing('uploading', 20);
      const analysis = await AIProcessingService.processCompleteWorkflow(
        audioUri,
        testId,
        testName,
        questions[state.currentQuestionIndex]?.id || '1',
        studentId || 'unknown',
        (progress) => {
          actions.updateProcessing(progress.step, progress.progress);
        }
      );
      
      console.log('🎤 AI Analysis complete:', analysis);
      
      // Complete processing with real AI results
      actions.completeProcessing(analysis.transcript, analysis);
      
      // Create feedback with real AI results
      const feedback = {
        score: analysis.overall_score,
        maxScore: 100,
        percentage: analysis.overall_score,
        passed: analysis.overall_score >= 60,
        analysis: analysis,
        transcript: analysis.transcript,
        wordCount: analysis.word_count,
        grammarScore: analysis.grammar_score,
        vocabularyScore: analysis.vocabulary_score,
        pronunciationScore: analysis.pronunciation_score,
        fluencyScore: analysis.fluency_score,
        contentScore: analysis.content_score,
        grammarMistakes: analysis.grammar_mistakes,
        vocabularyMistakes: analysis.vocabulary_mistakes,
        improvedTranscript: analysis.improved_transcript,
        grammarCorrections: analysis.grammar_corrections,
        vocabularyCorrections: analysis.vocabulary_corrections,
        languageUseCorrections: analysis.language_use_corrections,
        pronunciationCorrections: analysis.pronunciation_corrections,
        aiFeedback: analysis.ai_feedback
      };
      
      actions.setFeedback(feedback);
      
      // CRITICAL FIX: Don't auto-submit after each recording attempt
      // Submission will only happen when user clicks "Finish Test" button
      
      // Save attempt to storage (like web app)
      const attemptData = {
        attemptNumber: state.attempts,
        audioUri: audioUri,
        transcript: analysis.transcript,
        analysis: analysis,
        feedback: feedback,
        timestamp: Date.now()
      };
      
      await AttemptStorageService.saveAttempt(
        studentId || 'unknown',
        testId,
        attemptData
      );
      
      // Save to context
      actions.saveAttempt(attemptData);
      
      // Notify parent component
      const currentQuestion = state.questions[state.currentQuestionIndex];
      if (currentQuestion) {
        onAnswerChange(currentQuestion.id, {
          audioUri,
          transcript: analysis.transcript,
          analysis: analysis,
          feedback,
        });
      }
      
    } catch (error: any) {
      console.error('Processing error:', error);
      
      // Show specific error message based on the error type
      let errorMessage = 'Failed to process audio. Please try again.';
      
      if (error.message?.includes('Server error: 500')) {
        errorMessage = 'AI processing service is temporarily unavailable. Please try again later.';
      } else if (error.message?.includes('No response from server')) {
        errorMessage = 'No internet connection. Please check your network and try again.';
      } else if (error.message?.includes('Request failed')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      actions.setError(errorMessage);

      // Offer re-record / resend like web app
      Alert.alert(
        'Audio processing failed',
        errorMessage,
        [
          {
            text: 'Re-record',
            style: 'default',
            onPress: () => {
              actions.clearError();
              actions.retryAttempt();
            },
          },
          {
            text: 'Resend last attempt',
            style: 'default',
            onPress: async () => {
              try {
                actions.clearError();
                actions.startProcessing();
                const currentQuestionId = state.questions[state.currentQuestionIndex]?.id || '1';
                const analysis = await AIProcessingService.retryCachedPayload(
                  studentId || 'unknown',
                  testId,
                  String(currentQuestionId),
                  (progress) => actions.updateProcessing(progress.step, progress.progress)
                );

                actions.completeProcessing(analysis.transcript, analysis);

                const feedback = {
                  score: analysis.overall_score,
                  maxScore: 100,
                  percentage: analysis.overall_score,
                  passed: analysis.overall_score >= 60,
                  analysis: analysis,
                  transcript: analysis.transcript,
                  wordCount: analysis.word_count,
                  grammarScore: analysis.grammar_score,
                  vocabularyScore: analysis.vocabulary_score,
                  pronunciationScore: analysis.pronunciation_score,
                  fluencyScore: analysis.fluency_score,
                  contentScore: analysis.content_score,
                  grammarMistakes: analysis.grammar_mistakes,
                  vocabularyMistakes: analysis.vocabulary_mistakes,
                  improvedTranscript: analysis.improved_transcript,
                  grammarCorrections: analysis.grammar_corrections,
                  vocabularyCorrections: analysis.vocabulary_corrections,
                  languageUseCorrections: analysis.language_use_corrections,
                  pronunciationCorrections: analysis.pronunciation_corrections,
                  aiFeedback: analysis.ai_feedback
                };

                actions.setFeedback(feedback);

                const currentQuestion = state.questions[state.currentQuestionIndex];
                if (currentQuestion) {
                  onAnswerChange(currentQuestion.id, {
                    audioUri: state.audioUri || '',
                    transcript: analysis.transcript,
                    analysis: analysis,
                    feedback,
                  });
                }
              } catch (retryError: any) {
                console.error('Resend failed:', retryError);
                actions.setError('Resend failed. Please re-record and try again.');
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } finally {
      // Processing state is managed by context, no need to set local state
    }
  }, [actions, state.questions, state.currentQuestionIndex, onAnswerChange]);

  // Handle recording pause (not used in new AudioRecorder)
  // const handleRecordingPause = useCallback(() => {
  //   actions.pauseRecording();
  // }, [actions]);

  // Handle recording resume (not used in new AudioRecorder)
  // const handleRecordingResume = useCallback(() => {
  //   actions.resumeRecording();
  // }, [actions]);

  // Handle error
  const handleError = useCallback((error: string) => {
    actions.setError(error);
    Alert.alert('Recording Error', error, [{ text: 'OK' }]);
  }, [actions]);

  // Handle next question
  const handleNextQuestion = useCallback(async () => {
    if (state.currentQuestionIndex < state.questions.length - 1) {
      actions.nextQuestion();
    } else {
      // Test completed - submit final results (like web app)
      try {
        actions.startProcessing();
        
        // Get the current question data
        const currentQuestion = state.questions[state.currentQuestionIndex];
        const audioUri = state.audioUri;
        const transcript = state.transcript;
        const analysis = state.feedback?.analysis;
        
        console.log('🎤 ===== RECORDING STOP DEBUG =====');
        console.log('🎤 Audio URI:', audioUri);
        console.log('🎤 Transcript:', transcript);
        console.log('🎤 Analysis:', analysis);
        console.log('🎤 Current question:', currentQuestion);
        console.log('🎤 State feedback:', state.feedback);
        console.log('🎤 ===== END RECORDING STOP DEBUG =====');
        
        if (!audioUri || !transcript || !analysis) {
          console.error('🎤 Missing data check:');
          console.error('🎤 - audioUri:', !!audioUri, audioUri);
          console.error('🎤 - transcript:', !!transcript, transcript);
          console.error('🎤 - analysis:', !!analysis, analysis);
          throw new Error('Missing required data for submission');
        }
        
        // Use the existing submitFinalResults function for proper submission
        await submitFinalResults(audioUri, state.recordingTime, analysis);
        
        // Test completed successfully
        onTestComplete({
          testId: state.testId,
          testName: state.testName,
          questions: state.questions,
          completed: true,
          timestamp: new Date().toISOString(),
          result: { success: true },
          score: analysis.overall_score,
          maxScore: 100,
          percentage: analysis.overall_score
        });
        
      } catch (error) {
        console.error('Final submission error:', error);
        actions.setError('Failed to submit test. Please try again.');
      } finally {
        // Processing state is managed by context
      }
    }
  }, [state, actions, testId, testName, studentId, onTestComplete]);

  // Handle retry attempt
  const handleRetryAttempt = useCallback(() => {
    if (state.attempts < state.maxAttempts) {
      actions.retryAttempt();
    } else {
      Alert.alert(
        'Maximum Attempts Reached',
        'You have reached the maximum number of attempts for this question.',
        [{ text: 'OK' }]
      );
    }
  }, [actions, state.attempts, state.maxAttempts]);

  // Handle clear error
  const handleClearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  // Get current question
  const currentQuestion = state.questions[state.currentQuestionIndex];
  const isLastQuestion = state.currentQuestionIndex === state.questions.length - 1;

  if (!currentQuestion) {
    return (
      <View className={`flex-1 justify-center items-center ${themeClasses.background}`}>
        <Text className={`text-base text-center ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
          {themeMode === 'cyberpunk' ? 'NO QUESTIONS AVAILABLE' : 'No questions available'}
        </Text>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      <TestHeader
        testName={testName}
      />

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Attempt Information */}
        <View className={`rounded-lg p-3 mb-4 items-center ${
          themeMode === 'cyberpunk' 
            ? 'bg-cyan-400/10 border border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-blue-900/30 border border-blue-600' 
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <Text className={`text-base font-semibold mb-1 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-blue-300' 
              : 'text-blue-700'
          }`}>
            {themeMode === 'cyberpunk' ? 'ATTEMPT' : 'Attempt'} {state.attempts} {themeMode === 'cyberpunk' ? 'OF' : 'of'} {state.maxAttempts}
          </Text>
          {state.attemptHistory.length > 0 && (
            <Text className={`text-sm ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-300 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-blue-400' 
                : 'text-blue-600'
            }`}>
              {themeMode === 'cyberpunk' ? 'PREVIOUS ATTEMPTS:' : 'Previous attempts:'} {state.attemptHistory.length}
            </Text>
          )}
        </View>

        {/* Question Content */}
        <View className={`rounded-xl p-5 mb-4 shadow-sm ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-gray-800 border border-gray-600' 
            : 'bg-white border border-gray-100'
        }`}>
          <Text className={`text-lg font-semibold leading-7 mb-4 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-white' 
              : 'text-gray-800'
          }`}>
            {currentQuestion.question_text || (themeMode === 'cyberpunk' ? 'PLEASE RECORD YOUR ANSWER TO THE FOLLOWING PROMPT.' : 'Please record your answer to the following prompt.')}
          </Text>
          
          {currentQuestion.prompt && (
            <View className={`rounded-lg p-3 mb-4 ${
              themeMode === 'cyberpunk' 
                ? 'bg-cyan-400/10 border border-cyan-400/30' 
                : themeMode === 'dark' 
                ? 'bg-blue-900/30 border border-blue-600' 
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <Text className={`text-sm font-medium mb-2 ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : themeMode === 'dark' 
                  ? 'text-blue-300' 
                  : 'text-blue-800'
              }`}>
                {themeMode === 'cyberpunk' ? 'PROMPT:' : 'Prompt:'}
              </Text>
              <Text className={`text-sm leading-5 ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-300' 
                  : themeMode === 'dark' 
                  ? 'text-blue-200' 
                  : 'text-blue-700'
              }`}>
                {currentQuestion.prompt}
              </Text>
            </View>
          )}
          
          <View className={`rounded-lg p-3 ${
            themeMode === 'cyberpunk' 
              ? 'bg-gray-900/50 border border-gray-600' 
              : themeMode === 'dark' 
              ? 'bg-gray-700 border border-gray-500' 
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <Text className={`text-sm font-medium mb-2 ${
              themeMode === 'cyberpunk' 
                ? 'text-yellow-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-gray-300' 
                : 'text-gray-700'
            }`}>
              {themeMode === 'cyberpunk' ? 'REQUIREMENTS:' : 'Requirements:'}
            </Text>
            <Text className={`text-sm mb-1 ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-300' 
                : themeMode === 'dark' 
                ? 'text-gray-400' 
                : 'text-gray-600'
            }`}>
              • {themeMode === 'cyberpunk' ? 'MINIMUM WORDS:' : 'Minimum words:'} {currentQuestion.min_words || 10}
            </Text>
            <Text className={`text-sm ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-300' 
                : themeMode === 'dark' 
                ? 'text-gray-400' 
                : 'text-gray-600'
            }`}>
              • {themeMode === 'cyberpunk' ? 'MAXIMUM DURATION:' : 'Maximum duration:'} {Math.floor((currentQuestion.max_duration || 300) / 60)}:{(currentQuestion.max_duration || 300) % 60 < 10 ? '0' : ''}{(currentQuestion.max_duration || 300) % 60} {themeMode === 'cyberpunk' ? 'MINUTES' : 'minutes'}
            </Text>
          </View>
        </View>

        {/* Error Display */}
        {state.error && (
          <View className={`rounded-lg p-4 mb-4 ${
            themeMode === 'cyberpunk' 
              ? 'bg-red-900/30 border border-red-400' 
              : themeMode === 'dark' 
              ? 'bg-red-900/30 border border-red-600' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <Text className={`text-sm mb-3 ${
              themeMode === 'cyberpunk' 
                ? 'text-red-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-red-300' 
                : 'text-red-700'
            }`}>
              {themeMode === 'cyberpunk' ? state.error.toUpperCase() : state.error}
            </Text>
            <TouchableOpacity
              className={`px-4 py-2 rounded-md self-start ${
                themeMode === 'cyberpunk' 
                  ? 'bg-red-400 shadow-lg shadow-red-400/50' 
                  : themeMode === 'dark' 
                  ? 'bg-red-600' 
                  : 'bg-red-600'
              }`}
              onPress={handleClearError}
            >
              <Text className={`text-sm font-medium ${
                themeMode === 'cyberpunk' 
                  ? 'text-black tracking-wider' 
                  : 'text-white'
              }`}>
                {themeMode === 'cyberpunk' ? 'DISMISS' : 'Dismiss'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recording Section */}
        {state.currentStep === 'permission' || state.currentStep === 'recording' ? (
          <View className={`rounded-xl p-5 mb-4 shadow-sm ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border border-gray-600' 
              : 'bg-white border border-gray-100'
          }`}>
            <AudioRecorderNew
              onRecordingStart={handleRecordingStart}
              onRecordingStop={handleRecordingStop}
              onError={handleError}
              maxDuration={currentQuestion.max_duration || 300}
              minDuration={5}
              disabled={state.isProcessing}
              themeMode={themeMode}
            />
          </View>
        ) : null}

        {/* Processing Section */}
        {state.currentStep === 'processing' && (
          <View className={`rounded-xl p-5 mb-4 shadow-sm ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border border-gray-600' 
              : 'bg-white border border-gray-100'
          }`}>
            <ProcessingIndicator
              step={state.processingStep}
              progress={state.processingProgress}
              isProcessing={state.isProcessing}
            />
          </View>
        )}

        {/* Feedback Section */}
        {state.currentStep === 'feedback' && state.feedback && (
          <View className={`rounded-xl p-5 mb-4 shadow-sm ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border border-gray-600' 
              : 'bg-white border border-gray-100'
          }`}>
            <Text className={`text-lg font-bold mb-2 ${
              themeMode === 'cyberpunk' 
                ? 'text-yellow-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-blue-400' 
                : 'text-blue-600'
            }`}>
              🎯 {themeMode === 'cyberpunk' ? 'FEEDBACK DISPLAYED' : 'FEEDBACK DISPLAYED'}
            </Text>
            <FeedbackDisplay
              feedback={state.feedback}
              onNextQuestion={handleNextQuestion}
              onRetry={handleRetryAttempt}
              isLastQuestion={isLastQuestion}
              attempts={state.attempts}
              maxAttempts={state.maxAttempts}
            />
          </View>
        )}


        {/* Completed Section */}
        {state.currentStep === 'completed' && (
          <View className={`border rounded-xl p-5 mb-4 ${
            themeMode === 'cyberpunk' 
              ? 'bg-green-900/30 border-green-400' 
              : themeMode === 'dark' 
              ? 'bg-green-900/30 border-green-600' 
              : 'bg-green-50 border-green-200'
          }`}>
            <Text className={`text-lg font-semibold mb-2 text-center ${
              themeMode === 'cyberpunk' 
                ? 'text-green-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-green-300' 
                : 'text-green-800'
            }`}>
              {isLastQuestion ? (themeMode === 'cyberpunk' ? 'TEST COMPLETED!' : 'Test Completed!') : (themeMode === 'cyberpunk' ? 'QUESTION COMPLETED!' : 'Question Completed!')}
            </Text>
            <Text className={`text-sm text-center ${
              themeMode === 'cyberpunk' 
                ? 'text-green-300 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-green-200' 
                : 'text-green-700'
            }`}>
              {isLastQuestion 
                ? (themeMode === 'cyberpunk' ? 'YOU HAVE COMPLETED ALL QUESTIONS IN THIS TEST.' : 'You have completed all questions in this test.')
                : (themeMode === 'cyberpunk' ? 'YOU CAN NOW PROCEED TO THE NEXT QUESTION.' : 'You can now proceed to the next question.')
              }
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}