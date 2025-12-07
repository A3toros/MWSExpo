/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Alert, ActivityIndicator, ScrollView, TouchableOpacity, AppState, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { hydrateSuccess } from '../../../../src/store/slices/authSlice';
import { api } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QuestionRenderer from '../../../../src/components/questions/QuestionRenderer';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import { SubmitModal } from '../../../../src/components/modals';
import { LoadingModal } from '../../../../src/components/modals/LoadingModal';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';
import TestHeader from '../../../../src/components/TestHeader';
import ExamTestHeader from '../../../../src/components/ExamTestHeader';
import { useExamTimer } from '../../../../src/hooks/useExamTimer';
import { getRetestAssignmentId, markTestCompleted } from '../../../../src/utils/retestUtils';
import MathText from '../../../../src/components/math/MathText';
import { useAntiCheatingDetection } from '../../../../src/hooks/useAntiCheatingDetection';
import { useExamNavigation } from '../../../../src/hooks/useExamNavigation';
import ExamNavFooter from '../../../../src/components/ExamNavFooter';

export default function MultipleChoiceTestScreen() {
  const { testId, exam, examId } = useLocalSearchParams();
  const inExamContext = useMemo(() => exam === '1' && !!examId, [exam, examId]);
  const showExamNav = inExamContext && !!examId;
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: any) => state.auth.user);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  
  const [loading, setLoading] = useState(true);
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
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Prefill answers from cached exam data when in exam context
  useEffect(() => {
    if (!showExamNav || !user?.student_id || !examId || !testId) return;
    const key = `exam_answer_${user.student_id}_${examId}_${testId}_multiple_choice`;
    const preloaded = cachedAnswers?.[key];
    if (preloaded && Array.isArray(preloaded)) {
      setAnswers(preloaded as any[]);
      return;
    }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setAnswers(parsed as any[]);
        }
      } catch {
        // ignore
      }
    })();
  }, [showExamNav, user?.student_id, examId, testId, cachedAnswers]);

  // Anti-cheating detection hook
  const { caughtCheating, visibilityChangeTimes, clearCheatingKeys, textInputProps } = useAntiCheatingDetection({
    studentId: user?.student_id || '',
    testType: 'multiple_choice',
    testId: testId || '',
    enabled: !!user?.student_id && !!testId,
  });

  const {
    loading: navLoading,
    currentIndex: examTestIndex,
    total: examTestsTotal,
    navigatePrev,
    navigateNext,
    navigateReview,
    examName,
    totalMinutes,
  cachedAnswers,
  } = useExamNavigation({
    examId,
    currentTestId: testId,
    currentTestType: 'multiple_choice',
    enabled: showExamNav,
  studentId: user?.student_id,
  });
  const examTimeRemaining = useExamTimer({ examId, studentId: user?.student_id, totalMinutes });

  // Simple student ID extraction
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

  // Load user data from AsyncStorage if not in Redux
  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!user?.student_id) {
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
  }, []);

  // Persist answers into exam-level key when in exam context
  useEffect(() => {
    if (!inExamContext || !user?.student_id || !examId || !testId || !questions.length) return;
    const payload: Record<string | number, any> = {};
    answers.forEach((ans, idx) => {
      const q = questions[idx];
      const qId = q?.question_id || q?.id || idx;
      payload[qId] = ans ?? '';
    });
    const key = `exam_answer_${user.student_id}_${examId}_${testId}_multiple_choice`;
    AsyncStorage.setItem(key, JSON.stringify(payload)).catch(() => {});
  }, [answers, examId, inExamContext, questions, testId, user?.student_id]);

  // Check if test is already completed (web app pattern)
  // IMPORTANT: Allow retests even if test is marked as completed
  const checkTestCompleted = useCallback(async () => {
    if (!user?.student_id || !testId) return false;
    
    try {
      // Check for retest key first - if retest is available, allow access (web app pattern)
      const retestKey = `retest1_${user.student_id}_multiple_choice_${testId}`;
      const hasRetest = await AsyncStorage.getItem(retestKey);
      
      // If retest is available, allow access even if test is completed
      if (hasRetest === 'true') {
        console.log('🎓 Retest available - allowing access even if test is completed');
        return false; // Don't block retests
      }
      
      // Only check completion if no retest is available
      const completionKey = `test_completed_${user.student_id}_multiple_choice_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      
      if (isCompleted === 'true') {
        Alert.alert('Test Completed', 'This test has already been completed', [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('Error checking test completion:', e);
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
          params: { test_type: 'multiple_choice', test_id: testId } 
        }),
        api.get('/api/get-test-questions', {
          params: { test_type: 'multiple_choice', test_id: testId }
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
          const seedStr = `${studentIdForSeed}:multiple_choice:${testId}`;
          const seed = Array.from(seedStr).reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0) >>> 0;
          const orderKey = `test_shuffle_order_${studentIdForSeed}_multiple_choice_${testId}`;
          
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

  // Submit test (open custom modal only)
  const handleSubmit = useCallback(() => {
    if (isLoadingUser || !user?.student_id || !testData || !questions.length) {
      return;
    }
    setShowSubmitModal(true);
  }, [isLoadingUser, user?.student_id, testData, questions.length]);

  // Actual submit function
  const submitTest = useCallback(async () => {
    if (isLoadingUser) {
      Alert.alert('Please Wait', 'Loading user data...');
      return;
    }
    
    if (!testData || !questions.length) {
      Alert.alert('Error', `Missing required data for submission:\n- Test Data: ${!!testData}\n- Questions: ${questions.length}`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!user?.student_id) {
        Alert.alert('Error', 'Missing student ID');
        return;
      }
      
      const studentId = user.student_id;

      let correctAnswers = 0;
      questions.forEach((question, index) => {
        const studentAnswer = answers[index]?.trim().toLowerCase();
        const correctAnswer = question.correct_answer?.trim()?.toLowerCase() || '';
        if (studentAnswer === correctAnswer) {
          correctAnswers++;
        }
      });

      const score = correctAnswers;
      const maxScore = questions.length;
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      // Helper to resolve an answer letter to its option text for a given question
      const getOptionText = (question: any, answerLetter: string): string => {
        if (!answerLetter) return '';
        const key = String(answerLetter).trim().toUpperCase();
        // 1) options: [{ value: 'A', text: '...' }] or [{ key:'A', label:'...' }]
        if (Array.isArray(question?.options)) {
          const byKey = question.options.find((o: any) => (
            (String(o?.value || o?.key || o?.id || '').toUpperCase() === key) ||
            (String(o?.letter || '').toUpperCase() === key)
          ));
          if (byKey) return byKey.text || byKey.label || byKey.value || byKey.key || '';
          // If plain array of strings, map A->0, B->1 ...
          if (question.options.length && typeof question.options[0] === 'string') {
            const idx = Math.max(0, key.charCodeAt(0) - 'A'.charCodeAt(0));
            return question.options[idx] || '';
          }
        }
        // 2) object with option_a/option_b...
        const mapKey = {
          'A': question?.option_a || question?.a,
          'B': question?.option_b || question?.b,
          'C': question?.option_c || question?.c,
          'D': question?.option_d || question?.d,
          'E': (question?.option_e || question?.e)
        } as any;
        if (mapKey[key]) return String(mapKey[key]);
        // 3) choices JSON in question.choices or question.answers
        try {
          const choices = typeof question?.choices === 'string' ? JSON.parse(question.choices) : question?.choices;
          if (Array.isArray(choices)) {
            const idx = Math.max(0, key.charCodeAt(0) - 'A'.charCodeAt(0));
            if (typeof choices[0] === 'string') return choices[idx] || '';
            const byKey2 = choices.find((o: any) => String(o?.value || o?.key || '').toUpperCase() === key);
            if (byKey2) return byKey2.text || byKey2.label || '';
          }
        } catch {}
        return '';
      };

      // Get retest_assignment_id from AsyncStorage if this is a retest (web app pattern)
      const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
      const retestAssignmentId = await getRetestAssignmentId(studentId, 'multiple_choice', testIdStr);
      
      console.log('🎓 [MULTIPLE_CHOICE] Retest submission payload debug:', {
        studentId,
        testId: testIdStr,
        retestAssignmentId,
        retestAssignmentIdType: typeof retestAssignmentId,
        retestAssignmentIdValue: retestAssignmentId,
        isRetest: !!retestAssignmentId
      });
      
      const submissionData = {
        test_id: testId,
        test_name: testData.test_name || testData.title,
        test_type: 'multiple_choice',
        teacher_id: testData.teacher_id,
        subject_id: testData.subject_id,
        student_id: studentId,
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
        retest_assignment_id: retestAssignmentId,
        parent_test_id: testId
      };

      console.log('🎓 [MULTIPLE_CHOICE] Full submission payload:', {
        ...submissionData,
        retest_assignment_id: submissionData.retest_assignment_id,
        retest_assignment_id_type: typeof submissionData.retest_assignment_id,
        hasRetestAssignmentId: !!submissionData.retest_assignment_id
      });

      const response = await api.post('/api/submit-multiple-choice-test', submissionData);
      
      if (response.data.success) {
        // Clear anti-cheating keys on successful submission
        await clearCheatingKeys();
        
        // Mark test as completed and clear retest keys (web app pattern)
        const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
        await markTestCompleted(studentId, 'multiple_choice', testIdStr);
        
        // Cache the test results immediately after successful submission (web app pattern)
        const cacheKey = `student_results_table_${studentId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
        console.log('🎓 Test results cached with key:', cacheKey);
        
        // Clear progress key
        const progressKey = `test_progress_${studentId}_multiple_choice_${testId}`;
        await AsyncStorage.removeItem(progressKey);

        const detailedResults = {
          testName: testData.test_name || testData.title,
          score: score,
          maxScore: maxScore,
          percentage: percentage,
          questions: questions.map((question, index) => {
            const letterCorrect = question.correct_answer || '';
            const letterUser = answers[index] || '';
            return {
              questionNumber: index + 1,
              questionText: question.question,
              correctAnswer: letterCorrect,
              correctAnswerText: getOptionText(question, letterCorrect),
              studentAnswer: letterUser,
              studentAnswerText: getOptionText(question, letterUser),
              isCorrect: (letterUser?.trim()?.toLowerCase() === (letterCorrect?.trim()?.toLowerCase() || ''))
            };
          })
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
          { text: 'Retry', onPress: () => setShowSubmitModal(true) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.student_id, testData, questions, answers, testId, caughtCheating, visibilityChangeTimes, isLoadingUser, clearCheatingKeys]);

  // Timer effect - only start if test has timer enabled
  useEffect(() => {
    if (!testData || !questions.length || !user?.student_id) return;
    
    // Only start timer if test has a time limit set
    const allowedTime = testData.allowed_time || testData.time_limit;
    if (allowedTime && allowedTime > 0) {
      const timerKey = `test_timer_${user.student_id}_multiple_choice_${testId}`;
      
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
        
        // Auto-submit when time runs out - no popup, direct submission
        if (remainingTime <= 0) {
          clearInterval(timer);
          // Directly submit without any confirmation
          submitTest();
        }
      }, 1000);

      return () => {
        clearInterval(timer);
      };
    }
    // If no timer, don't start anything
  }, [testData, questions.length, user?.student_id, submitTest, testId]);

  if (loading) {
    return (
      <View className={`flex-1 justify-center items-center ${
        themeMode === 'cyberpunk' 
          ? 'bg-black' 
          : themeMode === 'dark' 
          ? 'bg-gray-900' 
          : 'bg-gray-50'
      }`}>
        <ActivityIndicator 
          size="large" 
          color={themeMode === 'cyberpunk' ? '#00ffff' : themeMode === 'dark' ? '#3b82f6' : '#3B82F6'} 
        />
        <Text className={`text-base text-center mt-2 ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-300 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-gray-300' 
            : 'text-gray-500'
        }`}>
          {themeMode === 'cyberpunk' ? 'LOADING TEST...' : 'Loading test...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 justify-center items-center px-4 ${
        themeMode === 'cyberpunk' 
          ? 'bg-black' 
          : themeMode === 'dark' 
          ? 'bg-gray-900' 
          : 'bg-gray-50'
      }`}>
        <Text className={`text-base text-center ${
          themeMode === 'cyberpunk' 
            ? 'text-red-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-red-300' 
            : 'text-red-600'
        }`}>
          {error}
        </Text>
      </View>
    );
  }

  if (!testData || !questions.length) {
    return (
      <View className={`flex-1 justify-center items-center px-4 ${
        themeMode === 'cyberpunk' 
          ? 'bg-black' 
          : themeMode === 'dark' 
          ? 'bg-gray-900' 
          : 'bg-gray-50'
      }`}>
        <Text className={`text-base text-center ${
          themeMode === 'cyberpunk' 
            ? 'text-red-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-red-300' 
            : 'text-red-600'
        }`}>
          {themeMode === 'cyberpunk' ? 'NO TEST DATA AVAILABLE' : 'No test data available'}
        </Text>
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
                ? 'bg-black border border-cyan-400/30'
                : themeMode === 'dark'
                ? 'bg-gray-800 border border-gray-600'
                : 'bg-[#8B5CF6]'
            }`}>
              <Text className={`text-xl font-bold text-center mb-2 ${
                themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : 'text-white'
              }`}>Your Score</Text>
              <Text className={`text-3xl font-bold text-center ${
                themeMode === 'cyberpunk' ? 'text-cyan-300' : 'text-white'
              }`}>
                {testResults.score}/{testResults.maxScore} ({testResults.percentage}%)
              </Text>
            </View>

            <View className="mb-6">
              <Text className="text-xl font-bold text-gray-800 mb-4">Question Review</Text>
              {testResults.questions.map((result: any, index: number) => (
                <View key={index} className={`mb-4 p-4 rounded-lg border ${
                  themeMode === 'cyberpunk' 
                    ? 'bg-black border-cyan-400/30' 
                    : themeMode === 'dark' 
                    ? 'bg-gray-800 border-gray-600' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className={`text-lg font-semibold ${
                      themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-800'
                    }`}>Question {result.questionNumber}</Text>
                    <View className={`px-3 py-1 rounded-full ${
                      result.isCorrect ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <Text className={`font-semibold ${
                        result.isCorrect ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {result.isCorrect ? 'Correct' : 'Incorrect'}
                      </Text>
                    </View>
                  </View>
                  
                  <View className="mb-4">
                    <MathText 
                      text={result.questionText || result.question || ''}
                      fontSize={16}
                    />
                  </View>
                  
                  <View className="space-y-2">
                    <View className="flex-row justify-between">
                      <Text className={`font-semibold ${
                        themeMode === 'cyberpunk' ? 'text-cyan-300' : themeMode === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>Your Answer:</Text>
                      <View className="flex-1 ml-2 items-end">
                        {result.studentAnswerText ? (
                          <View className="flex-row items-center">
                            <Text className={`mr-2 font-medium ${
                              result.isCorrect ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {result.studentAnswer || 'No answer'} —
                            </Text>
                            <View className="flex-1">
                              <MathText 
                                text={result.studentAnswerText}
                                fontSize={14}
                              />
                            </View>
                          </View>
                        ) : (
                          <Text className={`font-medium ${
                            result.isCorrect ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {result.studentAnswer || 'No answer'}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    <View className="flex-row justify-between">
                      <Text className={`font-semibold ${
                        themeMode === 'cyberpunk' ? 'text-cyan-300' : themeMode === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>Correct Answer:</Text>
                      <View className="flex-1 ml-2 items-end">
                        {result.correctAnswerText ? (
                          <View className="flex-row items-center">
                            <Text className={`mr-2 font-medium ${
                              themeMode === 'cyberpunk' ? 'text-cyan-200' : themeMode === 'dark' ? 'text-gray-100' : 'text-gray-800'
                            }`}>
                              {result.correctAnswer} —
                            </Text>
                            <View className="flex-1">
                              <MathText 
                                text={result.correctAnswerText}
                                fontSize={14}
                              />
                            </View>
                          </View>
                        ) : (
                          <Text className={`font-medium ${
                            themeMode === 'cyberpunk' ? 'text-cyan-200' : themeMode === 'dark' ? 'text-gray-100' : 'text-gray-800'
                          }`}>
                            {result.correctAnswer}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View className="pt-4">
              <TouchableOpacity
                className={`py-3 px-6 rounded-lg ${
                  themeMode === 'cyberpunk' 
                    ? 'bg-cyan-400' 
                    : themeMode === 'dark' 
                    ? 'bg-blue-600' 
                    : 'bg-[#8B5CF6]'
                }`}
                onPress={() => router.back()}
              >
                <Text className={`text-center font-semibold text-lg ${
                  themeMode === 'cyberpunk' 
                    ? 'text-black tracking-wider' 
                    : 'text-white'
                }`}>
                  {themeMode === 'cyberpunk' ? 'BACK TO DASHBOARD' : 'Back to Dashboard'}
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
      {showExamNav ? (
        <ExamTestHeader
          themeMode={themeMode}
          examId={examId}
          examName={examName || 'Exam'}
          testName={testData?.test_name || testData?.title}
          currentIndex={examTestIndex}
          total={examTestsTotal}
          timeSeconds={examTimeRemaining}
          onBack={() => router.back()}
        />
      ) : (
        <TestHeader 
          testName={testData.test_name || testData.title}
          onExit={() => router.back()}
          showBackButton
        />
      )}
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
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
          onSubmitTest={!showExamNav ? () => setShowSubmitModal(true) : undefined}
          isSubmitting={!showExamNav ? isSubmitting : false}
          canSubmit={!showExamNav && answers.filter(answer => answer && answer.trim() !== '').length === questions.length}
        />

        {questions.map((question, index) => (
          <View key={question.question_id || index} className="mb-6">
            <QuestionRenderer
              question={question}
              testId={testId as string}
              testType="multiple_choice"
              displayNumber={index + 1}
              studentId={user?.student_id || ''}
              value={answers[index] || ''}
              onChange={handleAnswerChange}
            />
          </View>
        ))}

        {!showExamNav && (
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
                    ? themeMode === 'dark' 
                      ? 'bg-blue-600' 
                      : 'bg-[#8B5CF6]'
                    : 'bg-gray-400'
                }`}
                disabled={isLoadingUser || answers.filter(answer => answer && answer.trim() !== '').length !== questions.length || isSubmitting}
                onPress={handleSubmit}
              >
                <Text className="text-white text-center font-semibold">
                  {isLoadingUser ? 'Loading...' : isSubmitting ? 'Submitting...' : 'Submit Test'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!showExamNav && submitError && (
          <View className={`border rounded-lg p-4 mt-4 ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-red-400/30' 
              : themeMode === 'dark' 
              ? 'bg-red-900/20 border-red-500' 
              : 'bg-red-50 border-red-200'
          }`}>
            <Text className={`text-center ${
              themeMode === 'cyberpunk' 
                ? 'text-red-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-red-300' 
                : 'text-red-600'
            }`}>
              {submitError}
            </Text>
          </View>
        )}
      </View>
      </ScrollView>
      {showExamNav && (
        <ExamNavFooter
          themeMode={themeMode}
          loading={navLoading}
          currentIndex={examTestIndex}
          total={examTestsTotal}
          onPressPrev={navigatePrev}
          onPressNext={navigateNext}
          onPressReview={navigateReview}
        />
      )}
      {!showExamNav && (
        <>
          {/* Submit Confirmation Modal */}
          <SubmitModal
            visible={showSubmitModal}
            onConfirm={() => {
              setShowSubmitModal(false);
              submitTest();
            }}
            onCancel={() => setShowSubmitModal(false)}
            testName={testData?.test_name || testData?.title || 'Test'}
          />
          <LoadingModal visible={isSubmitting} message={themeMode === 'cyberpunk' ? 'SUBMITTING…' : 'Submitting…'} />
        </>
      )}
    </View>
  );
}

