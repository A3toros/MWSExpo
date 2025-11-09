/** @jsxImportSource nativewind */
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, AppState, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import QuestionRenderer from '../../../../src/components/questions/QuestionRenderer';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import TestHeader from '../../../../src/components/TestHeader';
import { SubmitModal } from '../../../../src/components/modals';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { hydrateSuccess } from '../../../../src/store/slices/authSlice';
import { setAnswer, setIndex, startTest, hydrateFromStorage, tickSecond } from '../../../../src/store/slices/testSlice';
import TestResults from '../../../../src/components/TestResults';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';
import { getRetestAssignmentId, markTestCompleted, handleRetestCompletion } from '../../../../src/utils/retestUtils';
import { useAntiCheatingDetection } from '../../../../src/hooks/useAntiCheatingDetection';

export default function TestRunnerScreen() {
  const { testId, type } = useLocalSearchParams<{ testId: string; type?: string }>();
  const dispatch = useAppDispatch();
  const answers = useAppSelector((s: any) => s.testSession.answers);
  const user = useAppSelector((state: any) => state.auth.user);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [testResults, setTestResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Anti-cheating detection hook
  const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId || ''));
  const { caughtCheating, visibilityChangeTimes, clearCheatingKeys, textInputProps } = useAntiCheatingDetection({
    studentId: user?.student_id || '',
    testType: 'input',
    testId: testIdStr,
    enabled: !!user?.student_id && !!testId,
  });
  const resultsCommittedRef = useRef<boolean>(false);
  const restorationDoneRef = useRef<string | null>(null); // Track which test was restored

  // Simple student ID extraction from JWT (like multiple-choice test)
  const getStudentIdFromToken = async (): Promise<string | null> => {
    try {
      // Compute score locally for input tests using correct_answers (case-insensitive)
      const computedScore = (() => {
        try {
          if (!Array.isArray(questions) || questions.length === 0) return 0;
          let correct = 0;
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const qid = String(q?.id ?? q?.question_id ?? i);
            const val = String(answers[qid] ?? '').trim().toLowerCase();
            const list = Array.isArray(q?.correct_answers) ? q.correct_answers : (q?.correct_answer ? [q.correct_answer] : []);
            const normalized = list.map((s: any) => String(s ?? '').trim().toLowerCase()).filter(Boolean);
            
            // Check if answer is correct
            if (val.length > 0 && normalized.length > 0) {
              const isCorrect = normalized.some((correctAns: string) => {
                // First check for exact match (backward compatibility)
                if (val === correctAns) {
                  return true;
                }
                
                // Then check if trimmed correct answer is present in trimmed student answer
                // This accepts answers with extra letters/numbers (e.g., "Paris123" contains "Paris")
                if (correctAns && val.includes(correctAns)) {
                  // For single character answers, only match if at start/end (to avoid false positives like "a" in "cat")
                  // For multi-character answers, accept any substring match
                  if (correctAns.length === 1) {
                    // Single character: must be at start or end of answer
                    return val.startsWith(correctAns) || val.endsWith(correctAns);
                  } else {
                    // Multi-character: accept substring match
                    return true;
                  }
                }
                
                return false;
              });
              
              if (isCorrect) {
                correct += 1;
              }
            }
          }
          return correct;
        } catch {
          return 0;
        }
      })();
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return null;
      
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload.student_id || payload.id || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Load user data from AsyncStorage (like multiple-choice test)
  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!user) {
          const [userData, tokenData] = await Promise.all([
            AsyncStorage.getItem('auth_user'),
            AsyncStorage.getItem('auth_token')
          ]);
          
          if (userData && tokenData) {
            const parsedUser = JSON.parse(userData);
            dispatch(hydrateSuccess({ 
              token: tokenData, 
              user: parsedUser 
            }));
          }
        }
        setIsLoadingUser(false);
      } catch (error) {
        console.error('Error loading user data:', error);
        setIsLoadingUser(false);
      }
    };

    loadUserData();
  }, [dispatch, user]);

  // Load test data - use ref to prevent multiple loads
  const loadTestDataRef = useRef<string | null>(null);
  const isLoadingRef = useRef<boolean>(false);
  
  // Track last loaded test to prevent re-loading
  const lastLoadedTestRef = useRef<string | null>(null);
  
  useEffect(() => {
    
    // Check test completion
    (async () => {
      try {
        // Check if test is already completed (web app pattern)
        // IMPORTANT: Allow retests even if test is marked as completed
        if (user?.student_id && testId && type) {
          // Check for retest key first - if retest is available, allow access (web app pattern)
          const retestKey = `retest1_${user.student_id}_${type}_${testId}`;
          const hasRetest = await AsyncStorage.getItem(retestKey);
          
          // If retest is available, allow access even if test is completed
          if (hasRetest === 'true') {
            console.log('🎓 Retest available - allowing access even if test is completed');
            return; // Don't block retests
          }
          
          // Only check completion if no retest is available
          const completionKey = `test_completed_${user.student_id}_${type}_${testId}`;
          const isCompleted = await AsyncStorage.getItem(completionKey);
          
          if (isCompleted === 'true') {
            Alert.alert('Test Completed', 'This test has already been completed', [
              { text: 'OK', onPress: () => router.back() }
            ]);
            return;
          }
        }
      } catch {}
    })();

    // Prevent multiple loads for the same test - check if already loaded
    const testKey = testId && type ? `${testId}_${type}` : null;
    if (!testId || !type || !testKey) {
      return;
    }
    
    // CRITICAL: Atomic check-and-set to prevent race conditions
    // If ref is already set, skip. Otherwise, set it atomically.
    if (lastLoadedTestRef.current === testKey) {
      return;
    }
    
    // If already loading or loaded for this test, skip
    if (loadTestDataRef.current === testKey || isLoadingRef.current) {
      return;
    }

    // ATOMIC: Set ref immediately - prevents concurrent executions
    // If another execution is running, it will see this ref and skip
    lastLoadedTestRef.current = testKey;
    loadTestDataRef.current = testKey;
    isLoadingRef.current = true;
    
    // DO NOT reset restoration ref here - it causes the loop!
    // Only reset when testId/type actually changes (handled elsewhere)
    // The ref should persist across multiple load() calls for the same test

    const load = async () => {
      // CRITICAL: Check if already loaded for this test BEFORE any async operations
      const currentTestId = String(testId);
      const restoreTestKey = `${currentTestId}_${type}`;
      if (restorationDoneRef.current === restoreTestKey && testData && questions.length > 0) {
        return;
      }
      
      try {
        setError(null);
        setLoading(true);
        
        const res = await api.get('/api/get-test-questions', { 
          params: { test_type: type, test_id: testId } 
        });
        
        if (res.data.success) {
          const qs = res.data.questions ?? [];
          setTestData(res.data.test_info || res.data.data);
          setQuestions(qs);
          const order = qs.map((q: any, idx: number) => q?.id ?? idx);
          dispatch(startTest({ testId: String(testId), type: String(type || ''), questionOrder: order }));

          // Restore saved progress - ONLY ONCE per test load
          // restoreTestKey is already calculated above
          
          // ATOMIC: Check and set restoration ref to prevent race conditions
          // If already restored, skip. Otherwise, set ref immediately.
          if (restorationDoneRef.current === restoreTestKey) {
            // Already restored
          } else {
            // ATOMIC: Set ref IMMEDIATELY before any async work
            // This prevents concurrent restoration attempts
            restorationDoneRef.current = restoreTestKey;
            
            if (user?.student_id) {
              // Restore asynchronously - ref already set, so concurrent calls will skip
              (async () => {
                try {
                  const progressKey = `test_progress_${user.student_id}_${type}_${testId}`;
                  const savedRaw = await AsyncStorage.getItem(progressKey);
                  
                  if (savedRaw) {
                    const saved = JSON.parse(savedRaw);
                    if (saved?.answers) {
                      dispatch(hydrateFromStorage({
                        answers: saved.answers,
                        currentIndex: saved.currentIndex ?? 0,
                        elapsedSeconds: saved.seconds ?? 0,
                        startedAt: saved.startedAt ?? null,
                        questionOrder: order,
                        lastPersistedAt: saved.timestamp ?? null,
                      }));
                    }
                  }
                } catch (restoreErr) {
                  console.warn('Restore failed:', restoreErr);
                }
              })();
            }
          }
        } else {
          throw new Error(res.data.error || 'Failed to get test questions');
        }
      } catch (e: any) {
        console.error('Failed to load test questions:', e?.message);
        console.error('Full error:', e);
        console.error('Error response:', e?.response?.data);
        setError(`Failed to load test questions: ${e?.message || 'Unknown error'}`);
        // On error, allow retry by clearing the ref
        if (lastLoadedTestRef.current === testKey) {
          lastLoadedTestRef.current = null;
        }
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    };
    
    load();
    // Only depend on testId and type - user is checked inside but not in deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, type]);

  // Auto-save functionality - use ref to avoid dependency issues
  const autoSaveRefCallback = useRef<() => Promise<void>>();
  
  const autoSave = useCallback(async () => {
    if (Object.keys(answers).length === 0) return;
    
    setIsSaving(true);
    try {
      // Use user from store
      if (!user?.student_id) return;
      
      // Save to AsyncStorage for offline persistence - use web app pattern
      // Use seconds from state directly (not from dependency)
      const saveData = {
        testId,
        type,
        answers,
        timestamp: Date.now(),
        currentIndex,
        seconds, // Use current seconds value
        startedAt: Date.now() - (seconds * 1000)
      };
      const progressKey = `test_progress_${user.student_id}_${type}_${testId}`;
      await AsyncStorage.setItem(progressKey, JSON.stringify(saveData));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [answers, testId, type, currentIndex, user?.student_id]);
  
  // Update ref with latest callback
  useEffect(() => {
    autoSaveRefCallback.current = autoSave;
  }, [autoSave]);

  // Elapsed time timer (only if no countdown timer)
  useEffect(() => {
    if (!loading && !error) {
      // Only run elapsed time timer if there's no countdown timer
      const allowedTime = testData?.allowed_time || testData?.time_limit;
      if (!allowedTime || allowedTime <= 0) {
        // No countdown timer, so track elapsed time
        timerRef.current = setInterval(() => {
          setSeconds((s) => s + 1);
          dispatch(tickSecond());
        }, 1000);
      }
      // Auto-save every 5 seconds (use ref to avoid dependency issues)
      autoSaveRef.current = setInterval(() => {
        autoSaveRefCallback.current?.();
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current as any);
    };
  }, [loading, error, testData]);


  const total = questions.length || 1;
  const progress = useMemo(() => Math.round(((currentIndex + 1) / total) * 100), [currentIndex, total]);
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  
  // Calculate answered questions - COPY FROM WEB APP
  const answeredCount = useMemo(() => {
    if (!answers || Object.keys(answers).length === 0) {
      return 0;
    }

    // Count non-empty answers - EXACT COPY FROM WEB APP
    const answeredCount = Object.values(answers).filter(answer => {
      if (answer === null || answer === undefined) return false;
      if (typeof answer === 'string') return answer.trim() !== '';
      if (typeof answer === 'object') return Object.keys(answer).length > 0;
      return true;
    }).length;

    return answeredCount;
  }, [answers]);

  const allAnswered = useMemo(() => {
    if (!questions || questions.length === 0) return false;
    return answeredCount === questions.length;
  }, [answeredCount, questions.length]);

  // Handle test completion
  const handleTestComplete = useCallback(() => {
    if (resultsCommittedRef.current) {
      return; // Prevent overwriting already committed results
    }
    // Calculate results
    const correctAnswers = questions.filter((q: any, index: number) => {
      const qid = q?.id ?? q?.question_id ?? `q_${index}`;
      const value = answers[String(qid)];
      const qtype = String(q.question_type || '');
      
      // Simple scoring logic - this would need to be more sophisticated in real implementation
      if (qtype === 'true_false') return typeof value === 'boolean';
      if (qtype === 'multiple_choice') return typeof value === 'string' && value.length > 0;
      if (qtype === 'input') return typeof value === 'string' && value.trim().length > 0;
      if (qtype === 'fill_blanks') return Array.isArray(value) && value.length > 0;
      if (qtype === 'matching') return Array.isArray(value) && value.length > 0;
      if (qtype === 'word_matching') return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
      if (qtype === 'speaking') return typeof value === 'object' && value !== null && (value as any).audioUri && (value as any).transcript;
      if (qtype === 'drawing') return typeof value === 'object' && value !== null && ((value as any).paths?.length > 0 || (value as any).textBoxes?.length > 0);
      return false;
    }).length;

    const totalQuestions = questions.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = percentage >= 60;

    // Create question analysis
    const questionAnalysis = questions.map((q: any, index: number) => {
      const qid = String(q?.id ?? q?.question_id ?? index);
      // Robust lookup: string key, numeric key, and raw question_id
      const value =
        answers?.[qid] ??
        answers?.[q?.id as any] ??
        answers?.[q?.question_id as any] ??
        answers?.[String(q?.question_id)] ?? '';
      const qtype = String(q.question_type || '');
      
      let isCorrect = false;
      let userAnswer = '';
      let correctAnswer = '';

      if (qtype === 'true_false') {
        isCorrect = typeof value === 'boolean';
        userAnswer = value ? 'True' : 'False';
        correctAnswer = 'True'; // This would come from the question data
      } else if (qtype === 'multiple_choice') {
        isCorrect = typeof value === 'string' && value.length > 0;
        userAnswer = String(value) || 'No answer';
        correctAnswer = q.correct_answer || 'A'; // This would come from the question data
      } else if (qtype === 'input') {
        isCorrect = typeof value === 'string' && value.trim().length > 0;
        userAnswer = String(value) || 'No answer';
        const fromArray = Array.isArray(q.correct_answers) ? q.correct_answers.join(', ') : undefined;
        correctAnswer = fromArray || q.correct_answer || 'Correct answer';
      } else if (qtype === 'fill_blanks') {
        isCorrect = Array.isArray(value) && value.length > 0;
        userAnswer = Array.isArray(value) ? value.join(', ') : 'No answer';
        correctAnswer = 'Correct answers'; // This would come from the question data
      } else if (qtype === 'matching') {
        isCorrect = Array.isArray(value) && value.length > 0;
        userAnswer = Array.isArray(value) ? `${value.length} matches` : 'No matches';
        correctAnswer = 'Correct matches'; // This would come from the question data
      } else if (qtype === 'word_matching') {
        isCorrect = typeof value === 'object' && value !== null && Object.keys(value).length > 0;
        userAnswer = typeof value === 'object' && value !== null ? `${Object.keys(value).length} mappings` : 'No mappings';
        correctAnswer = 'Correct mappings'; // This would come from the question data
      } else if (qtype === 'speaking') {
        isCorrect = typeof value === 'object' && value !== null && (value as any).audioUri && (value as any).transcript;
        userAnswer = (value as any)?.transcript || 'No recording';
        correctAnswer = 'Speaking test completed';
      } else if (qtype === 'drawing') {
        isCorrect = typeof value === 'object' && value !== null && ((value as any).paths?.length > 0 || (value as any).textBoxes?.length > 0);
        userAnswer = 'Drawing submitted';
        correctAnswer = 'Drawing test completed';
      }

      return {
        questionNumber: index + 1,
        question: q.question_text || `Question ${index + 1}`,
        userAnswer,
        correctAnswer,
        isCorrect,
        score: isCorrect ? 1 : 0,
        maxScore: 1
      };
    });

    const testResultsData = {
      showResults: true,
      testInfo: {
        test_name: `Test ${testId}`,
        id: testId,
        test_id: testId
      },
      testType: type || 'unknown',
      score: correctAnswers,
      totalQuestions,
      percentage,
      passed,
      questionAnalysis,
      timestamp: new Date().toISOString(),
      caught_cheating: false,
      visibility_change_times: 0
    };

    setTestResults(testResultsData);
    setShowResults(true);
  }, [questions, answers, testId, type]);

  // Handle back to cabinet
  const handleBackToCabinet = useCallback(() => {
    setTestResults(null);
    setShowResults(false);
    // Navigate back to dashboard
    requestAnimationFrame(() => {
      router.replace('/(tabs)');
    });
  }, [router]);

  // Helper: build local results from a provided answers snapshot
  const buildLocalResults = useCallback((answersSnapshot: Record<string, any>) => {
    const total = questions.length;
    const questionAnalysis = questions.map((q: any, index: number) => {
      const qid = String(q?.id ?? q?.question_id ?? index);
      const value = answersSnapshot?.[qid] ?? answersSnapshot?.[q?.question_id as any] ?? answersSnapshot?.[String(q?.question_id)] ?? '';
      const userAnswer = String(value || '');
      const list = Array.isArray(q?.correct_answers) ? q.correct_answers : (q?.correct_answer ? [q.correct_answer] : []);
      const normalized = list.map((s: any) => String(s ?? '').trim().toLowerCase()).filter(Boolean);
      
      // Check if answer is correct using partial match logic (same as web app)
      const trimmedUserAnswer = userAnswer.trim().toLowerCase();
      const isCorrect = trimmedUserAnswer.length > 0 && normalized.length > 0 && normalized.some((correctAns: string) => {
        // First check for exact match (backward compatibility)
        if (trimmedUserAnswer === correctAns) {
          return true;
        }
        
        // Then check if trimmed correct answer is present in trimmed student answer
        // This accepts answers with extra letters/numbers (e.g., "Paris123" contains "Paris")
        if (correctAns && trimmedUserAnswer.includes(correctAns)) {
          // For single character answers, only match if at start/end (to avoid false positives like "a" in "cat")
          // For multi-character answers, accept any substring match
          if (correctAns.length === 1) {
            // Single character: must be at start or end of answer
            return trimmedUserAnswer.startsWith(correctAns) || trimmedUserAnswer.endsWith(correctAns);
          } else {
            // Multi-character: accept substring match
            return true;
          }
        }
        
        return false;
      });
      return {
        questionNumber: index + 1,
        question: q.question_text || q.question || `Question ${index + 1}`,
        userAnswer,
        correctAnswer: normalized.join(', '),
        isCorrect,
        score: isCorrect ? 1 : 0,
        maxScore: 1,
      };
    });
    const correctCount = questionAnalysis.filter(q => q.isCorrect).length;
    setTestResults({
      showResults: true,
      testInfo: { test_name: testData?.test_name || testData?.title || `Test ${testId}`, id: testId as any, test_id: testId as any },
      testType: String('input'),
      score: correctCount,
      totalQuestions: total,
      percentage: total > 0 ? Math.round((correctCount / total) * 100) : 0,
      passed: total > 0 ? (Math.round((correctCount / total) * 100) >= 60) : false,
      questionAnalysis,
      timestamp: new Date().toISOString(),
      caught_cheating: caughtCheating,
      visibility_change_times: visibilityChangeTimes,
    });
    resultsCommittedRef.current = true;
    setShowResults(true);
  }, [questions, testData, testId, caughtCheating, visibilityChangeTimes]);

  // Handle test submission
  // Memoize handleAnswerChange to prevent QuestionRenderer useEffect from running repeatedly
  const handleAnswerChange = useCallback((questionId: string | number, val: any) => {
    dispatch(setAnswer({ questionId: String(questionId), value: val }));
  }, [dispatch]);

  const handleSubmit = useCallback(async () => {
    if (isLoadingUser) {
      Alert.alert('Please Wait', 'Loading user data...');
      return;
    }
    
    // Get student ID from user or JWT token (like multiple-choice test)
    let studentId = user?.student_id;
    if (!studentId) {
      studentId = await getStudentIdFromToken();
    }
    
    if (!studentId) {
      Alert.alert('Error', 'Missing student ID');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError(null);

    // Pre-compute score for input questions using correct_answers
    const computedScore = (() => {
      try {
        if (!Array.isArray(questions) || questions.length === 0) return 0;
        let correct = 0;
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const qid = String(q?.id ?? q?.question_id ?? i);
          const val = String(answers[qid] ?? '').trim().toLowerCase();
          const list = Array.isArray(q?.correct_answers) ? q.correct_answers : (q?.correct_answer ? [q.correct_answer] : []);
          const normalized = list.map((s: any) => String(s ?? '').trim().toLowerCase()).filter(Boolean);
          
          // Check if answer is correct
          if (val.length > 0 && normalized.length > 0) {
            const isCorrect = normalized.some((correctAns: string) => {
              // First check for exact match (backward compatibility)
              if (val === correctAns) {
                return true;
              }
              
              // Then check if trimmed correct answer is present in trimmed student answer
              // This accepts answers with extra letters/numbers (e.g., "Paris123" contains "Paris")
              if (correctAns && val.includes(correctAns)) {
                // For single character answers, only match if at start/end (to avoid false positives like "a" in "cat")
                // For multi-character answers, accept any substring match
                if (correctAns.length === 1) {
                  // Single character: must be at start or end of answer
                  return val.startsWith(correctAns) || val.endsWith(correctAns);
                } else {
                  // Multi-character: accept substring match
                  return true;
                }
              }
              
              return false;
            });
            
            if (isCorrect) {
              correct += 1;
            }
          }
        }
        return correct;
      } catch {
        return 0;
      }
    })();

    try {
      // Get retest_assignment_id from AsyncStorage if this is a retest (web app pattern)
      const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
      const retestAssignmentId = await getRetestAssignmentId(studentId, 'input', testIdStr);
      
      const payload = {
        test_id: testId,
        test_name: testData.test_name || testData.title,
        test_type: 'input',
        teacher_id: testData.teacher_id,
        subject_id: testData.subject_id,
        student_id: studentId,
        academic_period_id: await (async () => {
          await academicCalendarService.loadAcademicCalendar();
          const currentTerm = academicCalendarService.getCurrentTerm();
          return currentTerm?.id || testData.academic_period_id;
        })(),
        answers: answers,
        score: computedScore,
        maxScore: questions.length,
        time_taken: seconds, 
        started_at: new Date(Date.now() - (seconds * 1000)).toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: caughtCheating,
        visibility_change_times: visibilityChangeTimes,
        answers_by_id: questions.reduce((acc, q, index) => {
          const qid = q?.id ?? q?.question_id ?? `q_${index}`;
          acc[q.question_id] = answers[String(qid)] || '';
          return acc;
        }, {} as Record<string, string>),
        question_order: questions.map(q => q.question_id),
        retest_assignment_id: retestAssignmentId,
        parent_test_id: testId
      };

      // Submit directly to input test endpoint (like multiple-choice test)
      try {
        const response = await api.post('/api/submit-input-test', payload);
        
        if (response.data.success) {
          // Clear anti-cheating keys on successful submission
          await clearCheatingKeys();
          
          // Handle retest completion (backend is authoritative)
          if (studentId) {
            const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
            const percentage = Math.round((computedScore / questions.length) * 100);
            
            // Use handleRetestCompletion for retests (sets completion key, backend handles attempt tracking)
            await handleRetestCompletion(studentId, 'input', testIdStr, {
              success: true,
              percentage: percentage,
              percentage_score: percentage
            });
            
            // Also mark test as completed using markTestCompleted for consistency
            await markTestCompleted(studentId, 'input', testIdStr);
            
            // Cache the test results immediately after successful submission (web app pattern)
            const cacheKey = `student_results_table_${studentId}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
          }
          
          // Build local detailed analysis from the exact snapshot we submitted
          buildLocalResults(answers);
        } else {
          throw new Error(response.data.error || response.data.message || 'Test submission failed');
        }
      } catch (apiError: any) {
        console.error('API submission failed:', apiError);
        
        // Show user-friendly error message
        const errorMessage = apiError.response?.data?.error || 
                             apiError.response?.data?.message || 
                             apiError.message || 
                             'Test submission failed. Please try again.';
        
        setSubmitError(errorMessage);
        
        Alert.alert(
          'Submission Error', 
          errorMessage,
          [
            { text: 'Retry', onPress: () => {
              // Retry submission - reset state and try again
              setIsSubmitting(false);
              setSubmitError(null);
            }},
            { text: 'Show Local Results', onPress: () => {
              handleTestComplete();
              setIsSubmitting(false);
            }}
          ]
        );
        return; // Don't show results immediately
      }
      
      // Success - mark as completed and show results
      if (studentId) {
        const completionKey = `test_completed_${studentId}_${type}_${testId}`;
        await AsyncStorage.setItem(completionKey, 'true');
        
        // Clear retest key if it exists
        const retestKey = `retest1_${studentId}_${type}_${testId}`;
        await AsyncStorage.removeItem(retestKey);
        
        // Clear progress key
        const progressKey = `test_progress_${studentId}_${type}_${testId}`;
        await AsyncStorage.removeItem(progressKey);
      }
      
      handleTestComplete();
    } catch (error: any) {
      console.error('Test submission error:', error);
      setSubmitError(error.message || 'Test submission failed');
      Alert.alert('Error', error.message || 'Test submission failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [testId, type, questions, answers, seconds, isLoadingUser, user?.student_id, testData, caughtCheating, visibilityChangeTimes, clearCheatingKeys]);

  // Use ref for handleSubmit to avoid timer effect re-running
  const handleSubmitRef = useRef<() => Promise<void>>();
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Timer effect - only start if test has timer enabled
  const timerInitializedRef = useRef(false);
  useEffect(() => {
    if (!testData || !questions.length || !user?.student_id) return;
    
    // Only start timer if test has a time limit set
    const allowedTime = testData.allowed_time || testData.time_limit;
    if (allowedTime && allowedTime > 0) {
      // Prevent multiple timer initializations
      if (timerInitializedRef.current) return;
      timerInitializedRef.current = true;
      
      const timerKey = `test_timer_${user.student_id}_input_${testId}`;
      
      // Load cached timer state (only once)
      const loadTimerState = async () => {
        try {
          const cached = await AsyncStorage.getItem(timerKey);
          const now = Date.now();
          if (cached) {
            const parsed = JSON.parse(cached);
            const drift = Math.floor((now - new Date(parsed.lastTickAt).getTime()) / 1000);
            const remaining = Math.max(0, Number(parsed.remainingSeconds || allowedTime) - Math.max(0, drift));
            setTimeElapsed(allowedTime - remaining);
            return remaining;
          } else {
            // Initialize new timer
            await AsyncStorage.setItem(timerKey, JSON.stringify({
              remainingSeconds: allowedTime,
              lastTickAt: new Date(now).toISOString(),
              startedAt: new Date(now).toISOString()
            }));
            return allowedTime;
          }
        } catch (e) {
          console.error('Timer cache init error:', e);
          return allowedTime;
        }
      };

      let remainingTime = allowedTime;
      loadTimerState().then(remaining => {
        remainingTime = remaining;
      });

      const countdownTimer = setInterval(async () => {
        remainingTime -= 1;
        setTimeElapsed(allowedTime - remainingTime);
        
        // Save timer state
        try {
          await AsyncStorage.setItem(timerKey, JSON.stringify({
            remainingSeconds: remainingTime,
            lastTickAt: new Date().toISOString(),
            startedAt: new Date().toISOString()
          }));
        } catch (e) {
          console.error('Timer save error:', e);
        }
        
        // Auto-submit when time runs out - no popup, direct submission
        if (remainingTime <= 0) {
          clearInterval(countdownTimer);
          timerInitializedRef.current = false; // Reset for retake
          // Directly submit without any confirmation
          handleSubmitRef.current?.();
        }
      }, 1000);

      return () => {
        clearInterval(countdownTimer);
        timerInitializedRef.current = false; // Reset when effect cleans up
      };
    }
    // If no timer, don't start anything
  }, [testData, questions.length, user?.student_id, testId]);

  // Show test results if available
  if (showResults && testResults) {
    return (
      <TestResults
        testResults={testResults}
        onBackToCabinet={handleBackToCabinet}
        onRetakeTest={() => {
          setTestResults(null);
          setShowResults(false);
          // Reset test state
          setCurrentIndex(0);
          setSeconds(0);
        }}
        isLoading={false}
      />
    );
  }

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      <TestHeader 
        testName={testData?.test_name || testData?.title || `Test #${testId}`}
        onExit={() => router.back()}
      />
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Progress Tracker */}
        <View className="mx-4 mt-4">
          <ProgressTracker
            answeredCount={answeredCount}
            totalQuestions={questions.length}
            percentage={questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}
            timeRemaining={testData?.allowed_time > 0 ? Math.max(0, (testData.allowed_time || testData.time_limit) - timeElapsed) : undefined}
          />
        </View>
        
        
        {submitError && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-4 mx-4 mb-4">
            <Text className="text-red-600 text-center">{submitError}</Text>
          </View>
        )}
        {loading || isLoadingUser ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-600 mt-2">
              {isLoadingUser ? 'Loading user data...' : 'Loading test...'}
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center px-4">
            <Text className="text-red-600 text-center">{error}</Text>
          </View>
        ) : (
          <View className="px-4">
            <Text className="text-lg font-semibold text-gray-800 mb-4 text-center">All Questions ({questions.length} total)</Text>
            {questions.map((q, index) => {
              // Ensure each question has a unique ID
              const qid = q?.id ?? q?.question_id ?? `q_${index}`;
              const value = answers[String(qid)] as any;
              
              return (
                <View key={`question_${qid}_${index}`} className="mb-6">
                  <QuestionRenderer
                    question={q}
                    testId={String(testId)}
                    testType={String(q?.question_type || type || '')}
                    displayNumber={index + 1}
                    studentId={user?.student_id || ''}
                    value={value}
                    onChange={handleAnswerChange}
                    textInputProps={textInputProps}
                  />
                </View>
              );
            })}

            {/* Submit Button */}
            <View className="mt-6 mb-4">
              {themeMode === 'cyberpunk' ? (
                <TouchableOpacity
                  onPress={() => setShowSubmitModal(true)}
                  disabled={!allAnswered || isSubmitting}
                  style={{ alignSelf: 'center' }}
                >
                  <Image 
                    source={require('../../../../assets/images/save-cyberpunk.png')} 
                    style={{ width: 40, height: 40 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowSubmitModal(true)}
                  disabled={!allAnswered || isSubmitting}
                  className={`w-full py-4 px-6 rounded-lg ${
                    allAnswered && !isSubmitting
                      ? 'bg-violet-600 active:bg-violet-700'
                      : 'bg-gray-300'
                  }`}
                >
                  <View className="flex-row items-center justify-center">
                    {isSubmitting ? (
                      <>
                        <ActivityIndicator size="small" color="white" className="mr-2" />
                        <Text className="text-white font-semibold text-lg">Submitting...</Text>
                      </>
                    ) : (
                      <Text className={`font-semibold text-lg ${
                        allAnswered ? 'text-white' : 'text-gray-500'
                      }`}>
                        Submit Test
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Submit Confirmation Modal */}
      <SubmitModal
        visible={showSubmitModal}
        onConfirm={() => {
          setShowSubmitModal(false);
          handleSubmit();
        }}
        onCancel={() => {
          setShowSubmitModal(false);
        }}
        testName={testData?.test_name || `Test #${testId}`}
      />
    </View>
  );
}