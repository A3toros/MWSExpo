/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, ActivityIndicator, ScrollView, TouchableOpacity, AppState, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { hydrateSuccess } from '../../../../src/store/slices/authSlice';
import { api } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QuestionRenderer from '../../../../src/components/questions/QuestionRenderer';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import TestHeader from '../../../../src/components/TestHeader';
import { SubmitModal } from '../../../../src/components/modals';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';

export default function TrueFalseTestScreen() {
  const { testId } = useLocalSearchParams();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: any) => state.auth.user);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [visibilityChangeTimes, setVisibilityChangeTimes] = useState(0);
  const [caughtCheating, setCaughtCheating] = useState(false);

  // Load user data from AsyncStorage if not in Redux
  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!user?.student_id) {
          // Enhanced student ID extraction with multiple fallbacks
          let userData = null;
          let tokenData = null;
          
          // Try JWT token first
          try {
            tokenData = await AsyncStorage.getItem('auth_token');
            if (tokenData) {
              const parts = tokenData.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                const studentId = payload.student_id || payload.id || payload.user_id || payload.username || payload.email;
                if (studentId) {
                  // Create user object from JWT payload
                  userData = JSON.stringify({
                    student_id: studentId,
                    id: studentId,
                    user_id: studentId,
                    username: payload.username || studentId,
                    email: payload.email || studentId
                  });
                }
              }
            }
          } catch (e) {
            console.log('JWT extraction failed:', e);
          }
          
          // Fallback to AsyncStorage
          if (!userData) {
            const [authUserData, userDataRaw] = await Promise.all([
              AsyncStorage.getItem('auth_user'),
              AsyncStorage.getItem('user')
            ]);
            
            if (authUserData) {
              userData = authUserData;
            } else if (userDataRaw) {
              userData = userDataRaw;
            }
          }
          
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
  }, []);

  // Check if test is already completed
  const checkTestCompleted = useCallback(async () => {
    if (!user?.student_id || !testId) return false;
    
    try {
      const completionKey = `test_completed_${user.student_id}_true_false_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      const retestKey = `retest1_${user.student_id}_true_false_${testId}`;
      const isRetest = await AsyncStorage.getItem(retestKey);
      
      if (isCompleted && !isRetest) {
        Alert.alert(
          'Test Already Completed',
          'This test has already been completed. You cannot retake it.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking test completion:', error);
      return false;
    }
  }, [user?.student_id, testId]);

  // Load test data
  const loadTestData = useCallback(async () => {
    if (!testId) {
      setError('Test ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const isCompleted = await checkTestCompleted();
      if (isCompleted) return;

      const [testResponse, questionsResponse] = await Promise.all([
        api.get('/api/get-test-questions', { 
          params: { test_type: 'true_false', test_id: testId } 
        }),
        api.get('/api/get-test-questions', {
          params: { test_type: 'true_false', test_id: testId }
        })
      ]);

      if (!testResponse.data.success) {
        throw new Error(testResponse.data.error || 'Failed to load test data');
      }

      if (!questionsResponse.data.success) {
        throw new Error(questionsResponse.data.error || 'Failed to load questions');
      }

      setTestData(testResponse.data.test_info || testResponse.data.data);
      
      // Apply question shuffling if enabled
      let finalQuestions = questionsResponse.data.questions || [];
      const testInfo = testResponse.data.test_info || testResponse.data.data;
      
      if (testInfo?.is_shuffled && user?.student_id) {
        try {
          const studentIdForSeed = user.student_id;
          const seedStr = `${studentIdForSeed}:true_false:${testId}`;
          const seed = Array.from(seedStr).reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0) >>> 0;
          const orderKey = `test_shuffle_order_${studentIdForSeed}_true_false_${testId}`;
          
          // Check for cached shuffle order
          const cachedOrder = await AsyncStorage.getItem(orderKey);
          if (cachedOrder) {
            const order = JSON.parse(cachedOrder);
            const byId = new Map(finalQuestions.map((q: any) => [q.question_id, q]));
            finalQuestions = order.map((id: any) => byId.get(id)).filter(Boolean);
          } else {
            // Generate deterministic shuffle using seeded RNG
            function mulberry32(a: number) {
              return function() {
                var t = a += 0x6D2B79F5;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
              };
            }
            const rng = mulberry32(seed);
            finalQuestions = [...finalQuestions];
            for (let i = finalQuestions.length - 1; i > 0; i--) {
              const j = Math.floor(rng() * (i + 1));
              [finalQuestions[i], finalQuestions[j]] = [finalQuestions[j], finalQuestions[i]];
            }
            
            // Cache the shuffle order
            const order = finalQuestions.map((q: any) => q.question_id);
            await AsyncStorage.setItem(orderKey, JSON.stringify(order));
          }
        } catch (e) {
          console.error('Shuffle error:', e);
        }
      }
      
      setQuestions(finalQuestions);
      
      // Initialize answers array
      const initialAnswers = new Array(finalQuestions.length).fill('');
      setAnswers(initialAnswers);

    } catch (error: any) {
      console.error('Error loading test data:', error);
      setError(error.message || 'Failed to load test data');
    } finally {
      setLoading(false);
    }
  }, [testId, checkTestCompleted]);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  // Anti-cheating tracking (like web app)
  useEffect(() => {
    const loadAntiCheatingData = async () => {
      try {
        const storageKey = `anti_cheating_true_false_${testId}`;
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
          const storageKey = `anti_cheating_true_false_${testId}`;
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

  // Timer effect - only start if test has timer enabled
  useEffect(() => {
    if (!testData || !questions.length || !user?.student_id) return;
    
    // Only start timer if test has a time limit set
    const allowedTime = testData.allowed_time || testData.time_limit;
    if (allowedTime && allowedTime > 0) {
      const timerKey = `test_timer_${user.student_id}_true_false_${testId}`;
      
      // Load cached timer state
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

      const timer = setInterval(async () => {
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
        
        // Auto-submit when time runs out
        if (remainingTime <= 0) {
          clearInterval(timer);
          Alert.alert(
            'Time Up!',
            'The test time has expired. Your answers will be submitted automatically.',
            [{ text: 'OK', onPress: () => handleSubmit() }]
          );
        }
      }, 1000);

      return () => {
        clearInterval(timer);
      };
    }
    // If no timer, don't start anything
  }, [testData, questions.length, user?.student_id]);

  // Handle answer change
  const handleAnswerChange = useCallback((questionId: string | number, answer: any) => {
    setAnswers(prev => {
      const newAnswers = [...prev];
      const questionIndex = questions.findIndex(q => q.question_id === questionId);
      if (questionIndex !== -1) {
        newAnswers[questionIndex] = String(answer);
      }
      return newAnswers;
    });
  }, [questions]);

  // Submit test
  const handleSubmit = useCallback(async () => {
    if (isLoadingUser) {
      Alert.alert('Please Wait', 'Loading user data...');
      return;
    }
    
    if (!user?.student_id) {
      Alert.alert('Error', 'User data not loaded. Please try again.');
      return;
    }
    
    if (!testData || !questions.length) {
      Alert.alert('Error', `Missing required data for submission:\n- Test Data: ${!!testData}\n- Questions: ${questions.length}`);
      return;
    }

    // Show SubmitModal instead of Alert.alert
    setShowSubmitModal(true);
  }, [user?.student_id, testData, questions, answers, testId]);

  // Actual submit function
  const submitTest = useCallback(async () => {
    if (isLoadingUser) {
      Alert.alert('Please Wait', 'Loading user data...');
      return;
    }
    
    if (!user?.student_id) {
      Alert.alert('Error', 'User data not loaded. Please try again.');
      return;
    }
    
    if (!testData || !questions.length) {
      Alert.alert('Error', `Missing required data for submission:\n- Test Data: ${!!testData}\n- Questions: ${questions.length}`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let correctAnswers = 0;
      questions.forEach((question, index) => {
        // Convert student answer to boolean (like web app)
        const studentAnswer = answers[index]?.trim().toLowerCase();
        const studentAnswerBool = studentAnswer === 'true';
        
        // Direct boolean comparison (like web app)
        if (studentAnswerBool === question.correct_answer) {
          correctAnswers++;
        }
      });

      const score = correctAnswers;
      const maxScore = questions.length;
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      const submissionData = {
        test_id: testId,
        test_name: testData.test_name || testData.title,
        test_type: 'true_false',
        teacher_id: testData.teacher_id,
        subject_id: testData.subject_id,
        student_id: user.student_id,
        academic_period_id: await (async () => {
          await academicCalendarService.loadAcademicCalendar();
          const currentTerm = academicCalendarService.getCurrentTerm();
          return currentTerm?.id || testData.academic_period_id;
        })(),
        answers: answers,
        score: score,
        maxScore: maxScore,
        time_taken: 0,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: caughtCheating,
        visibility_change_times: visibilityChangeTimes,
        answers_by_id: questions.reduce((acc, q, index) => {
          acc[q.question_id] = answers[index] || '';
          return acc;
        }, {} as Record<string, string>),
        question_order: questions.map(q => q.question_id),
        retest_assignment_id: null,
        parent_test_id: testId
      };

      const response = await api.post('/api/submit-true-false-test', submissionData);
      
      if (response.data.success) {
        const completionKey = `test_completed_${user.student_id}_true_false_${testId}`;
        await AsyncStorage.setItem(completionKey, 'true');
        
        const retestKey = `retest1_${user.student_id}_true_false_${testId}`;
        const retestAssignKey = `retest_assignment_id_${user.student_id}_true_false_${testId}`;
        await AsyncStorage.multiRemove([retestKey, retestAssignKey]);

        const detailedResults = {
          testName: testData.test_name || testData.title,
          score: score,
          maxScore: maxScore,
          percentage: percentage,
          questions: questions.map((question, index) => ({
            questionNumber: index + 1,
            questionText: question.question,
            correctAnswer: question.correct_answer || '',
            studentAnswer: answers[index] || '',
            isCorrect: ((answers[index]?.trim().toLowerCase() === 'true') === question.correct_answer)
          }))
        };
        
        setTestResults(detailedResults);
        setShowResults(true);
      } else {
        throw new Error(response.data.error || 'Failed to submit test');
      }

    } catch (error: any) {
      console.error('Error submitting test:', error);
      setSubmitError(error.message || 'Failed to submit test');
      Alert.alert(
        'Submission Error',
        error.message || 'Failed to submit test. Please try again.',
        [
          { text: 'Retry', onPress: () => handleSubmit() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.student_id, testData, questions, answers, testId]);

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-base text-gray-500 text-center mt-2">Loading test...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center px-4">
        <Text className="text-base text-red-600 text-center">{error}</Text>
      </View>
    );
  }

  if (!testData || !questions.length) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center px-4">
        <Text className="text-base text-red-600 text-center">No test data available</Text>
      </View>
    );
  }

  // Show results screen if test is completed
  if (showResults && testResults) {
    return (
      <View className={`flex-1 ${
        themeMode === 'cyberpunk' 
          ? 'bg-black' 
          : themeMode === 'dark' 
          ? 'bg-gray-900' 
          : 'bg-gray-50'
      }`}>
        <View className={`p-6 border-b ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-200'
        }`}>
          <Text className={`text-2xl font-bold text-center ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-white' 
              : 'text-gray-800'
          }`}>
            {themeMode === 'cyberpunk' ? 'TEST RESULTS' : 'Test Results'}
          </Text>
          <Text className={`text-lg text-center mt-2 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-300 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-300' 
              : 'text-gray-600'
          }`}>
            {testResults.testName}
          </Text>
        </View>

        <ScrollView className="flex-1">
          <View className={`m-4 p-6 rounded-xl border shadow-sm ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <View className={`p-6 rounded-lg mb-6 ${
              themeMode === 'cyberpunk' 
                ? 'bg-black border-2 border-cyan-400' 
                : themeMode === 'dark' 
                ? 'bg-blue-600' 
                : 'bg-[#8B5CF6]'
            }`}>
              <Text className={`text-xl font-bold text-center mb-2 ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : 'text-white'
              }`}>
                {themeMode === 'cyberpunk' ? 'YOUR SCORE' : 'Your Score'}
              </Text>
              <Text className={`text-3xl font-bold text-center ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : 'text-white'
              }`}>
                {testResults.score}/{testResults.maxScore} ({testResults.percentage}%)
              </Text>
            </View>

            <View className="mb-6">
              <Text className={`text-xl font-bold mb-4 ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : themeMode === 'dark' 
                  ? 'text-white' 
                  : 'text-gray-800'
              }`}>
                {themeMode === 'cyberpunk' ? 'QUESTION REVIEW' : 'Question Review'}
              </Text>
              {testResults.questions.map((result: any, index: number) => (
                <View key={index} className={`mb-4 p-4 rounded-lg border-2 ${
                  result.isCorrect 
                    ? (themeMode === 'cyberpunk' 
                        ? 'bg-green-900/20 border-green-400/30' 
                        : themeMode === 'dark' 
                        ? 'bg-green-900/30 border-green-600' 
                        : 'bg-green-50 border-green-200')
                    : (themeMode === 'cyberpunk' 
                        ? 'bg-red-900/20 border-red-400/30' 
                        : themeMode === 'dark' 
                        ? 'bg-red-900/30 border-red-600' 
                        : 'bg-red-50 border-red-200')
                }`}>
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className={`text-lg font-semibold ${
                      themeMode === 'cyberpunk' 
                        ? 'text-cyan-300 tracking-wider' 
                        : themeMode === 'dark' 
                        ? 'text-white' 
                        : 'text-gray-800'
                    }`}>
                      {themeMode === 'cyberpunk' ? `QUESTION ${result.questionNumber}` : `Question ${result.questionNumber}`}
                    </Text>
                    <View className={`px-3 py-1 rounded-full ${
                      result.isCorrect 
                        ? (themeMode === 'cyberpunk' 
                            ? 'bg-green-900/30 border border-green-400/30' 
                            : themeMode === 'dark' 
                            ? 'bg-green-800' 
                            : 'bg-green-100')
                        : (themeMode === 'cyberpunk' 
                            ? 'bg-red-900/30 border border-red-400/30' 
                            : themeMode === 'dark' 
                            ? 'bg-red-800' 
                            : 'bg-red-100')
                    }`}>
                      <Text className={`font-semibold ${
                        result.isCorrect 
                          ? (themeMode === 'cyberpunk' 
                              ? 'text-green-400' 
                              : themeMode === 'dark' 
                              ? 'text-green-200' 
                              : 'text-green-800')
                          : (themeMode === 'cyberpunk' 
                              ? 'text-red-400' 
                              : themeMode === 'dark' 
                              ? 'text-red-200' 
                              : 'text-red-800')
                      }`}>
                        {result.isCorrect 
                          ? (themeMode === 'cyberpunk' ? '✓ CORRECT' : '✓ Correct') 
                          : (themeMode === 'cyberpunk' ? '✗ INCORRECT' : '✗ Incorrect')
                        }
                      </Text>
                    </View>
                  </View>
                  
                  <View className="mb-4">
                    <Text className={`font-medium mb-2 ${
                      themeMode === 'cyberpunk' 
                        ? 'text-cyan-300 tracking-wider' 
                        : themeMode === 'dark' 
                        ? 'text-gray-300' 
                        : 'text-gray-600'
                    }`}>
                      {themeMode === 'cyberpunk' ? 'QUESTION:' : 'Question:'}
                    </Text>
                    <Text className={`p-3 rounded-lg ${
                      themeMode === 'cyberpunk' 
                        ? 'text-cyan-200 bg-black border border-cyan-400/30' 
                        : themeMode === 'dark' 
                        ? 'text-gray-200 bg-gray-700' 
                        : 'text-gray-700 bg-gray-50'
                    }`}>
                      {result.questionText}
                    </Text>
                  </View>
                  
                  <View className="space-y-2">
                    <View>
                      <Text className={`font-medium mb-2 ${
                        themeMode === 'cyberpunk' 
                          ? 'text-cyan-300 tracking-wider' 
                          : themeMode === 'dark' 
                          ? 'text-gray-300' 
                          : 'text-gray-600'
                      }`}>
                        {themeMode === 'cyberpunk' ? 'YOUR ANSWER:' : 'Your Answer:'}
                      </Text>
                      <Text className={`p-3 rounded-lg ${
                        result.isCorrect 
                          ? (themeMode === 'cyberpunk' 
                              ? 'bg-green-900/30 text-green-400 border border-green-400/30' 
                              : themeMode === 'dark' 
                              ? 'bg-green-800 text-green-200' 
                              : 'bg-green-100 text-green-800')
                          : (themeMode === 'cyberpunk' 
                              ? 'bg-red-900/30 text-red-400 border border-red-400/30' 
                              : themeMode === 'dark' 
                              ? 'bg-red-800 text-red-200' 
                              : 'bg-red-100 text-red-800')
                      }`}>
                        {result.studentAnswer || (themeMode === 'cyberpunk' ? 'NO ANSWER PROVIDED' : 'No answer provided')}
                      </Text>
                    </View>
                    
                    <View>
                      <Text className={`font-medium mb-2 ${
                        themeMode === 'cyberpunk' 
                          ? 'text-cyan-300 tracking-wider' 
                          : themeMode === 'dark' 
                          ? 'text-gray-300' 
                          : 'text-gray-600'
                      }`}>
                        {themeMode === 'cyberpunk' ? 'CORRECT ANSWER:' : 'Correct Answer:'}
                      </Text>
                      <Text className={`p-3 rounded-lg ${
                        themeMode === 'cyberpunk' 
                          ? 'bg-blue-900/30 text-blue-400 border border-blue-400/30' 
                          : themeMode === 'dark' 
                          ? 'bg-blue-800 text-blue-200' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {result.correctAnswer}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View className="pt-4">
              <TouchableOpacity
                className={`py-3 px-6 rounded-lg ${
                  themeMode === 'cyberpunk' 
                    ? 'bg-black border border-cyan-400/30' 
                    : themeMode === 'dark' 
                    ? 'bg-blue-600' 
                    : 'bg-[#8B5CF6]'
                }`}
                onPress={() => {
                  setTestResults(null);
                  setShowResults(false);
                  router.push('/(tabs)');
                }}
              >
                <Text className={`text-center font-semibold text-lg ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-400 tracking-wider' 
                    : 'text-white'
                }`}>
                  {themeMode === 'cyberpunk' ? '← BACK TO DASHBOARD' : '← Back to Dashboard'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      <TestHeader 
        testName={testData.test_name || testData.title}
      />
      
      {/* Test Info Button */}
      <ScrollView className="flex-1">

      <View className={`m-4 p-4 rounded-xl border shadow-sm ${
        themeMode === 'cyberpunk' 
          ? 'bg-black border-cyan-400/30' 
          : themeMode === 'dark' 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-white border-gray-200'
      }`}>
        <ProgressTracker
          answeredCount={answers.filter(answer => answer && answer.trim() !== '').length}
          totalQuestions={questions.length}
          percentage={questions.length > 0 ? Math.round((answers.filter(answer => answer && answer.trim() !== '').length / questions.length) * 100) : 0}
          timeRemaining={testData?.allowed_time > 0 ? Math.max(0, (testData.allowed_time || testData.time_limit) - timeElapsed) : undefined}
          onSubmitTest={handleSubmit}
          isSubmitting={isSubmitting}
          canSubmit={answers.filter(answer => answer && answer.trim() !== '').length === questions.length}
        />

        {questions.map((question, index) => (
          <View key={question.question_id || index} className="mb-6">
            <QuestionRenderer
              question={question}
              testId={testId as string}
              testType="true_false"
              displayNumber={index + 1}
              studentId={user?.student_id || ''}
              value={answers[index] || ''}
              onChange={handleAnswerChange}
            />
          </View>
        ))}

        <View className="mt-6">
          {themeMode === 'cyberpunk' ? (
            <TouchableOpacity
              onPress={() => setShowSubmitModal(true)}
              disabled={isLoadingUser || answers.filter(answer => answer && answer.trim() !== '').length !== questions.length || isSubmitting}
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
              className={`py-3 px-4 rounded-lg ${
                (answers.filter(answer => answer && answer.trim() !== '').length === questions.length && !isSubmitting) 
                  ? 'bg-[#8B5CF6]' 
                  : 'bg-gray-400'
              }`}
              disabled={isLoadingUser || answers.filter(answer => answer && answer.trim() !== '').length !== questions.length || isSubmitting}
              onPress={() => setShowSubmitModal(true)}
            >
              <Text className="text-white text-center font-semibold">
                {isLoadingUser ? 'Loading...' : isSubmitting ? 'Submitting...' : 'Submit Test'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {submitError && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <Text className="text-red-600 text-center">{submitError}</Text>
          </View>
        )}
      </View>
      </ScrollView>

      {/* Confirmation Modal (reused for submit and back) */}
      <SubmitModal
        visible={showSubmitModal}
        onConfirm={() => {
          setShowSubmitModal(false);
          submitTest();
        }}
        onCancel={() => setShowSubmitModal(false)}
        testName={testData?.test_name || 'Test'}
      />
    </View>
  );
}


