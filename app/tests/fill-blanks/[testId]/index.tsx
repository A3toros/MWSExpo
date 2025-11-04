/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, ActivityIndicator, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { hydrateSuccess } from '../../../../src/store/slices/authSlice';
import { api } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QuestionRenderer from '../../../../src/components/questions/QuestionRenderer';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import TestHeader from '../../../../src/components/TestHeader';
import FillBlanksTestRenderer from '../../../../src/components/questions/fill-blanks/FillBlanksTestRenderer';
import TestResults from '../../../../src/components/TestResults';
import { SubmitModal } from '../../../../src/components/modals';
import { LoadingModal } from '../../../../src/components/modals/LoadingModal';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';
import { getRetestAssignmentId, markTestCompleted } from '../../../../src/utils/retestUtils';

export default function FillBlanksTestScreen() {
  const { testId } = useLocalSearchParams();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: any) => state.auth.user);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);

  // Helper function to decode JWT token and extract student ID
  const getStudentIdFromToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Fill-blanks RN: token exists?', !!token);
      if (!token) return null;
      
      // Decode JWT token (simple base64 decode of payload)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('Fill-blanks RN: invalid token format, parts:', parts.length);
        return null;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      console.log('Fill-blanks RN: token payload:', payload);
      console.log('Fill-blanks RN: payload.student_id:', payload.student_id);
      console.log('Fill-blanks RN: payload.id:', payload.id);
      console.log('Fill-blanks RN: payload.user_id:', payload.user_id);
      console.log('Fill-blanks RN: payload.username:', payload.username);
      console.log('Fill-blanks RN: payload.email:', payload.email);
      
      // Try multiple possible fields for student ID
      return payload.student_id || payload.id || payload.user_id || payload.username || payload.email || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };
  
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
    if (!testId) return false;
    
    try {
      // Enhanced student ID extraction with multiple fallbacks (same as submission)
      let studentId = await getStudentIdFromToken();
      
      if (!studentId) {
        // Fallback to AsyncStorage - try multiple keys
        let userFromStorage = null;
        
        // Try 'user' key first
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          userFromStorage = JSON.parse(userData);
        }
        
        // Try 'auth_user' key if 'user' is null
        if (!userFromStorage) {
          const authUserData = await AsyncStorage.getItem('auth_user');
          if (authUserData) {
            userFromStorage = JSON.parse(authUserData);
          }
        }
        
        studentId = userFromStorage?.student_id || userFromStorage?.id || userFromStorage?.user_id || userFromStorage?.username || userFromStorage?.email;
        console.log('Fill-blanks RN completion check: userFromStorage:', userFromStorage);
        console.log('Fill-blanks RN completion check: extracted studentId from storage:', studentId);
      }
      
      if (!studentId) {
        // Fallback to Redux state
        studentId = user?.student_id || (user as any)?.id;
        console.log('Fill-blanks RN completion check: user from Redux:', user);
      }
      
      if (!studentId) {
        console.log('Fill-blanks RN completion check: No student ID available');
        return false; // Can't check completion without student ID
      }
      
      // Check for retest key first - if retest is available, allow access (web app pattern)
      const retestKey = `retest1_${studentId}_fill_blanks_${testId}`;
      const hasRetest = await AsyncStorage.getItem(retestKey);
      
      console.log('🎓 Fill-blanks RN completion check:', {
        studentId,
        retestKey,
        hasRetest
      });
      
      // If retest is available, allow access even if test is completed
      if (hasRetest === 'true') {
        console.log('🎓 Retest available - allowing access even if test is completed');
        return false; // Don't block retests
      }
      
      // Only check completion if no retest is available
      const completionKey = `test_completed_${studentId}_fill_blanks_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      
      console.log('🎓 Fill-blanks RN completion check (no retest):', {
        studentId,
        completionKey,
        isCompleted
      });
      
      if (isCompleted === 'true') {
        Alert.alert(
          'Test Completed',
          'This test has already been completed',
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
          params: { test_type: 'fill_blanks', test_id: testId } 
        }),
        api.get('/api/get-test-questions', {
          params: { test_type: 'fill_blanks', test_id: testId }
        })
      ]);

      if (!testResponse.data.success) {
        throw new Error(testResponse.data.error || 'Failed to load test data');
      }

      if (!questionsResponse.data.success) {
        throw new Error(questionsResponse.data.error || 'Failed to load questions');
      }

      const testInfo = testResponse.data.test_info || testResponse.data.data;
      setTestData(testInfo);
      
      // Apply question shuffling if enabled
      let finalQuestions = questionsResponse.data.questions || [];
      
      // Transform fill-blanks question data to match component expectations
      console.log('🔍 Raw Questions Data:', finalQuestions);
      finalQuestions = finalQuestions.map((question: any) => {
        
        // Handle question_json - it might be a string or already parsed
        let questionText = '';
        try {
          if (typeof question.question_json === 'string') {
            // Try to parse as JSON first
            try {
              const parsed = JSON.parse(question.question_json);
              questionText = parsed.text || parsed.question || question.question_json;
            } catch {
              // If parsing fails, use the string directly
              questionText = question.question_json;
            }
          } else if (question.question_json && typeof question.question_json === 'object') {
            questionText = question.question_json.text || question.question_json.question || '';
          } else {
            questionText = question.question_json || '';
          }
        } catch (error) {
          console.error('Error parsing question_json:', error);
          questionText = question.question_json || '';
        }
        
        // Handle blank_positions - it might be an empty object or array
        let blankPositions = [];
        try {
          if (typeof question.blank_positions === 'string') {
            blankPositions = JSON.parse(question.blank_positions);
          } else if (Array.isArray(question.blank_positions)) {
            blankPositions = question.blank_positions;
          } else if (question.blank_positions && typeof question.blank_positions === 'object') {
            // If it's an object, convert to array
            blankPositions = Object.values(question.blank_positions);
          }
        } catch (error) {
          console.error('Error parsing blank_positions:', error);
          blankPositions = [];
        }
        
        // Handle blank_options
        let blankOptions = [];
        console.log('🔍 Raw blank_options for question:', question.question_id, question.blank_options);
        try {
          if (typeof question.blank_options === 'string') {
            blankOptions = JSON.parse(question.blank_options);
          } else if (Array.isArray(question.blank_options)) {
            blankOptions = question.blank_options;
          }
        } catch (error) {
          console.error('Error parsing blank_options:', error);
          blankOptions = [];
        }
        console.log('🔍 Parsed blank_options:', blankOptions);
        
        // Handle correct_answers
        let correctAnswers = [];
        console.log('🔍 Raw correct_answers for question:', question.question_id, question.correct_answers);
        try {
          if (typeof question.correct_answers === 'string') {
            correctAnswers = JSON.parse(question.correct_answers);
          } else if (Array.isArray(question.correct_answers)) {
            correctAnswers = question.correct_answers;
          }
        } catch (error) {
          console.error('Error parsing correct_answers:', error);
          correctAnswers = [];
        }
        console.log('🔍 Parsed correct_answers:', correctAnswers);
        
        // Create blanks array - if no positions, create based on correct answers count
        const blanks = [];
        const numBlanks = Math.max(blankPositions.length, correctAnswers.length);
        
        for (let i = 0; i < numBlanks; i++) {
          // Each blank should have ALL the options, not just one option per blank
          let options = blankOptions;
          if (!Array.isArray(options)) {
            options = options ? [options] : [];
          }
          
          const blankCorrectAnswer = correctAnswers[i] || '';
          console.log(`🔍 Blank ${i + 1} correct answer:`, blankCorrectAnswer);
          blanks.push({
            id: i + 1,
            position: i,
            correct_answer: blankCorrectAnswer,
            options: options
          });
        }
        
        return {
          id: question.question_id,
          question_id: question.question_id,
          question_text: questionText,
          blanks: blanks
        };
      });
      
      if (testInfo?.is_shuffled && user?.student_id) {
        try {
          const studentIdForSeed = user.student_id;
          const seedStr = `${studentIdForSeed}:fill_blanks:${testId}`;
          const seed = Array.from(seedStr).reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0) >>> 0;
          const orderKey = `test_shuffle_order_${studentIdForSeed}_fill_blanks_${testId}`;
          
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
      const perQuestion = questions.map((question, index) => {
        const studentAnswerRaw = answers[index] ?? '';
        const studentAnswer = String(studentAnswerRaw).trim().toLowerCase();
        const correctFromBlank = question?.blanks && question.blanks[0]?.correct_answer ? String(question.blanks[0].correct_answer) : '';
        const correctAnswer = (question.correct_answer ?? correctFromBlank ?? '').toString().trim().toLowerCase();
        const isCorrect = studentAnswer.length > 0 && correctAnswer.length > 0 && studentAnswer === correctAnswer;
        if (isCorrect) correctAnswers++;
        return { studentAnswer: studentAnswerRaw, correctAnswer: correctFromBlank || question.correct_answer || '' , isCorrect };
      });

      const score = correctAnswers;
      const maxScore = questions.length;
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      // Get retest_assignment_id from AsyncStorage if this is a retest (web app pattern)
      const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
      const retestAssignmentId = await getRetestAssignmentId(user.student_id, 'fill_blanks', testIdStr);
      
      const submissionData = {
        test_id: testId,
        test_name: testData.test_name || testData.title || `Test ${testId}`,
        test_type: 'fill_blanks',
        teacher_id: testData.teacher_id || null,
        subject_id: testData.subject_id || null,
        student_id: user.student_id,
        academic_period_id: await (async () => {
          await academicCalendarService.loadAcademicCalendar();
          const currentTerm = academicCalendarService.getCurrentTerm();
          return currentTerm?.id || testData.academic_period_id || 3;
        })(),
        answers: answers,
        score: score,
        maxScore: maxScore,
        time_taken: 0,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: false,
        visibility_change_times: 0,
        answers_by_id: questions.reduce((acc, q, index) => {
          acc[q.question_id] = answers[index] || '';
          return acc;
        }, {} as Record<string, string>),
        question_order: questions.map(q => q.question_id),
        retest_assignment_id: retestAssignmentId,
        parent_test_id: testId
      };

      const response = await api.post('/api/submit-fill-blanks-test', submissionData);
      
      if (response.data.success) {
        // Mark test as completed and clear retest keys (web app pattern)
        const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
        await markTestCompleted(user.student_id, 'fill_blanks', testIdStr);
        
        // Cache the test results immediately after successful submission (web app pattern)
        const cacheKey = `student_results_table_${user.student_id}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
        console.log('🎓 Fill-blanks test results cached with key:', cacheKey);
        
        // Clear progress key
        const progressKey = `test_progress_${user.student_id}_fill_blanks_${testId}`;
        await AsyncStorage.removeItem(progressKey);

        const detailedResults = {
          showResults: true,
          testInfo: {
            test_name: testData.test_name || testData.title,
            id: testId,
            test_id: testId
          },
          testType: 'fill_blanks',
          score: score,
          totalQuestions: questions.length,
          percentage: percentage,
          passed: percentage >= 60,
          questionAnalysis: questions.map((question, index) => ({
            questionNumber: index + 1,
            question: question.question_text || question.question || `Question ${index + 1}`,
            userAnswer: String(answers[index] || ''),
            correctAnswer: question?.blanks && question.blanks[0]?.correct_answer ? String(question.blanks[0].correct_answer) : (question.correct_answer || ''),
            isCorrect: perQuestion[index]?.isCorrect || false,
            score: perQuestion[index]?.isCorrect ? 1 : 0,
            maxScore: 1
          })),
          timestamp: new Date().toISOString()
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
  }, [user?.student_id, testData, questions, answers, testId, isLoadingUser, handleSubmit]);

  // Timer effect - only start if test has timer enabled
  useEffect(() => {
    if (!testData || !questions.length || !user?.student_id) return;
    
    // Only start timer if test has a time limit set
    const allowedTime = testData.allowed_time || testData.time_limit;
    if (allowedTime && allowedTime > 0) {
      const timerKey = `test_timer_${user.student_id}_fill_blanks_${testId}`;
      
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
          // Directly submit without any confirmation
          submitTest();
        }
      }, 1000);

      return () => {
        clearInterval(countdownTimer);
      };
    }
    // If no timer, don't start anything
  }, [testData, questions.length, user?.student_id, submitTest, testId]);

  if (loading) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center`}>
        <ActivityIndicator size="large" color={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#60a5fa' : '#3B82F6'} />
        <Text className={`text-base ${themeClasses.textSecondary} text-center mt-2`}>Loading test...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center px-4`}>
        <Text className={`text-base ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-600'} text-center`}>{error}</Text>
      </View>
    );
  }

  if (!testData || !questions.length) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center px-4`}>
        <Text className={`text-base ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-600'} text-center`}>No test data available</Text>
      </View>
    );
  }

  // Show results screen if test is completed
  if (showResults && testResults) {
    return (
      <TestResults
        testResults={testResults}
        onBackToCabinet={() => {
          setShowResults(false);
          setTestResults(null);
          router.push('/(tabs)');
        }}
        onRetakeTest={() => {
          setShowResults(false);
          setTestResults(null);
          // Reset test state for retake
          setAnswers([]);
        }}
        isLoading={false}
        caught_cheating={testResults.caught_cheating}
        visibility_change_times={testResults.visibility_change_times}
      />
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
          onSubmitTest={() => setShowSubmitModal(true)}
          isSubmitting={isSubmitting}
          canSubmit={answers.filter(answer => answer && answer.trim() !== '').length === questions.length}
        />

        {/* Fill Blanks Test - Following Web App Pattern */}
        <View className="mt-6">
          <FillBlanksTestRenderer
            testData={testData}
            questions={questions}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            themeMode={themeMode}
          />
        </View>

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

      {/* Submit Confirmation Modal */}
      <SubmitModal
        visible={showSubmitModal}
        onConfirm={() => {
          setShowSubmitModal(false);
          submitTest();
        }}
        onCancel={() => setShowSubmitModal(false)}
        testName={testData?.test_name || 'Test'}
      />

      {/* Submitting overlay */}
      <LoadingModal visible={isSubmitting} message={themeMode === 'cyberpunk' ? 'SUBMITTING…' : 'Submitting…'} />
    </View>
  );
}

