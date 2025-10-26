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
  const [testResults, setTestResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [visibilityChangeTimes, setVisibilityChangeTimes] = useState(0);
  const [caughtCheating, setCaughtCheating] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Simple student ID extraction from JWT (like multiple-choice test)
  const getStudentIdFromToken = async (): Promise<string | null> => {
    try {
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

  useEffect(() => {
    // Check test completion
    (async () => {
      try {
        
        // Check if test is already completed (web app pattern)
        if (user?.student_id && testId && type) {
          const completionKey = `test_completed_${user.student_id}_${type}_${testId}`;
          const isCompleted = await AsyncStorage.getItem(completionKey);
          const retestKey = `retest1_${user.student_id}_${type}_${testId}`;
          const hasRetest = await AsyncStorage.getItem(retestKey);
          
        if (isCompleted === 'true' && hasRetest !== 'true') {
          Alert.alert('Test Completed', 'This test has already been completed', [
            { text: 'OK', onPress: () => router.back() }
          ]);
          return;
        }
        }
      } catch {}
    })();

    const load = async () => {
      setError(null);
      setLoading(true);
        try {
          console.log('Loading test questions for:', { test_type: type, test_id: testId });
          // Copy web app exactly - use get-test-questions for all test types
          const res = await api.get('/api/get-test-questions', { 
            params: { test_type: type, test_id: testId } 
          });
          console.log('API response:', res.data);
          
          if (res.data.success) {
            const qs = res.data.questions ?? [];
            setTestData(res.data.test_info || res.data.data);
            setQuestions(qs);
            const order = qs.map((q: any, idx: number) => q?.id ?? idx);
            dispatch(startTest({ testId: String(testId), type: String(type || ''), questionOrder: order }));

            // Attempt to restore saved progress using web app pattern
            try {
              // Use user from store for progress loading
              if (user?.student_id) {
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
              }
            } catch (restoreErr) {
              console.warn('Restore failed:', restoreErr);
            }
          } else {
            throw new Error(res.data.error || 'Failed to get test questions');
          }
        } catch (e: any) {
          console.error('Failed to load test questions:', e?.message);
          console.error('Full error:', e);
          console.error('Error response:', e?.response?.data);
          setError(`Failed to load test questions: ${e?.message || 'Unknown error'}`);
        } finally {
          setLoading(false);
        }
    };
    if (testId) load();
  }, [testId, type, user?.student_id]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (Object.keys(answers).length === 0) return;
    
    setIsSaving(true);
    try {
      // Use user from store
      if (!user?.student_id) return;
      
      // Save to AsyncStorage for offline persistence - use web app pattern
      const saveData = {
        testId,
        type,
        answers,
        timestamp: Date.now(),
        currentIndex,
        seconds,
        startedAt: Date.now() - (seconds * 1000)
      };
      const progressKey = `test_progress_${user.student_id}_${type}_${testId}`;
      await AsyncStorage.setItem(progressKey, JSON.stringify(saveData));
      setLastSaved(new Date());
      console.log('Auto-saved test progress');
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [answers, testId, type, currentIndex, seconds, user?.student_id]);

  useEffect(() => {
    if (!loading && !error) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
        dispatch(tickSecond());
      }, 1000);
      // Auto-save every 5 seconds
      autoSaveRef.current = setInterval(autoSave, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current as any);
    };
  }, [loading, error, autoSave]);

  // Anti-cheating tracking (like web app)
  useEffect(() => {
    const loadAntiCheatingData = async () => {
      try {
        const storageKey = `anti_cheating_input_${testId}`;
        const data = await AsyncStorage.getItem(storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          setVisibilityChangeTimes(parsed.visibility_change_times || 0);
          setCaughtCheating(parsed.caught_cheating || false);
        }
      } catch (e) {
        console.log('Error loading anti-cheating data:', e);
      }
    };

    if (testId) {
      loadAntiCheatingData();
    }
  }, [testId]);

  // Track app state changes for anti-cheating
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - increment visibility change count
        setVisibilityChangeTimes(prev => {
          const newCount = prev + 1;
          // Save to AsyncStorage
          const storageKey = `anti_cheating_input_${testId}`;
          AsyncStorage.setItem(storageKey, JSON.stringify({
            visibility_change_times: newCount,
            caught_cheating: newCount >= 2, // 2+ changes = cheating
            last_updated: new Date().toISOString()
          }));
          
          // Mark as cheating if 2+ changes
          if (newCount >= 2) {
            setCaughtCheating(true);
          }
          
          return newCount;
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [testId]);

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
      const qid = String(q.id ?? index);
      const value = answers[qid];
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
        correctAnswer = q.correct_answer || 'Correct answer'; // This would come from the question data
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
    router.push('/(tabs)');
  }, [router]);

  // Handle test submission
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
    
    try {
      
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
        score: 0, // Calculate score like multiple choice
        maxScore: questions.length,
        time_taken: 0, // Use 0 like multiple choice
        started_at: new Date().toISOString(), // Use current time like multiple choice
        submitted_at: new Date().toISOString(),
        caught_cheating: caughtCheating,
        visibility_change_times: visibilityChangeTimes,
        answers_by_id: questions.reduce((acc, q, index) => {
          const qid = q?.id ?? q?.question_id ?? `q_${index}`;
          acc[q.question_id] = answers[String(qid)] || '';
          return acc;
        }, {} as Record<string, string>),
        question_order: questions.map(q => q.question_id),
        retest_assignment_id: null,
        parent_test_id: testId
      };

      console.log('🔍 Input test submission payload:', JSON.stringify(payload, null, 2));
      console.log('🔍 testData:', testData);
      console.log('🔍 questions length:', questions.length);
      console.log('🔍 answers:', answers);
      console.log('🔍 testData.test_name:', testData?.test_name);
      console.log('🔍 testData.teacher_id:', testData?.teacher_id);
      console.log('🔍 testData.subject_id:', testData?.subject_id);
      
      
      // Submit directly to input test endpoint (like multiple-choice test)
      try {
        const response = await api.post('/api/submit-input-test', payload);
        
        if (response.data.success) {
          // Cache the test results immediately after successful submission (web app pattern)
          if (studentId) {
            const cacheKey = `student_results_table_${studentId}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
            console.log('🎓 Test results cached with key:', cacheKey);
          }
          
          setTestResults(response.data);
          setShowResults(true);
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
  }, [testId, type, questions, answers, seconds, isLoadingUser, user?.student_id, testData]);

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
            timeElapsed={seconds}
          />
        </View>
        
        {isSaving && (
          <View className="flex-row items-center justify-center bg-blue-50 mx-4 mb-4 p-3 rounded-lg">
            <ActivityIndicator size="small" color="#2563eb" />
            <Text className="text-blue-600 ml-2">Auto-saving...</Text>
          </View>
        )}
        {lastSaved && !isSaving && (
          <Text className="text-gray-500 text-center text-sm mb-4">
            Last saved: {lastSaved.toLocaleTimeString()}
          </Text>
        )}
        
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
              const onChange = (questionId: string | number, val: any) =>
                dispatch(setAnswer({ questionId: String(questionId), value: val }));
              
              
              return (
                <View key={`question_${qid}_${index}`} className="mb-6">
                  <QuestionRenderer
                    question={q}
                    testId={String(testId)}
                    testType={String(q?.question_type || type || '')}
                    displayNumber={index + 1}
                    studentId={user?.student_id || ''}
                    value={value}
                    onChange={onChange}
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
          console.log('🔍 SubmitModal onConfirm called');
          setShowSubmitModal(false);
          handleSubmit();
        }}
        onCancel={() => {
          console.log('🔍 SubmitModal onCancel called');
          setShowSubmitModal(false);
        }}
        testName={testData?.test_name || `Test #${testId}`}
      />
    </View>
  );
}