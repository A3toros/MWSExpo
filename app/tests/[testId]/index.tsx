/** @jsxImportSource nativewind */
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSubmissionMethod } from '../../../src/services/apiClient';
import QuestionRenderer from '../../../src/components/questions/QuestionRenderer';
import ProgressTracker from '../../../src/components/ProgressTracker';
import TestHeader from '../../../src/components/TestHeader';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { setAnswer, setIndex, startTest, hydrateFromStorage, tickSecond } from '../../../src/store/slices/testSlice';
import TestResults from '../../../src/components/TestResults';
import { LoadingModal } from '../../../src/components/modals/LoadingModal';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../src/utils/themeUtils';

export default function TestRunnerScreen() {
  const { testId, type } = useLocalSearchParams<{ testId: string; type?: string }>();
  const dispatch = useAppDispatch();
  const answers = useAppSelector((s) => s.testSession.answers);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [testResults, setTestResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [studentId, setStudentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // hydrate studentId and check test completion
    (async () => {
      try {
        const userRaw = await AsyncStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;
        const sid = user?.student_id || user?.id || '';
        setStudentId(String(sid));
        
        // Check if test is already completed (web app pattern)
        if (sid && testId && type) {
          const completionKey = `test_completed_${sid}_${type}_${testId}`;
          const isCompleted = await AsyncStorage.getItem(completionKey);
          const retestKey = `retest1_${sid}_${type}_${testId}`;
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
          // Copy web app exactly - use get-test-questions for all test types
          const res = await api.get('/api/get-test-questions', { 
            params: { test_type: type, test_id: testId } 
          });
          
          if (res.data.success) {
            const qs = res.data.questions ?? [];
            setQuestions(qs);
            const order = qs.map((q: any, idx: number) => q?.id ?? idx);
            dispatch(startTest({ testId: String(testId), type: String(type || ''), questionOrder: order }));

            // Attempt to restore saved progress using web app pattern
            try {
              const userRaw = await AsyncStorage.getItem('user');
              const user = userRaw ? JSON.parse(userRaw) : null;
              const studentId = user?.student_id || user?.id || '';
              const progressKey = `test_progress_${studentId}_${type}_${testId}`;
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
          } else {
            throw new Error(res.data.error || 'Failed to get test questions');
          }
        } catch (e: any) {
          console.error('Failed to load test questions:', e?.message);
          setError('Failed to load test questions. Please try again.');
        } finally {
          setLoading(false);
        }
    };
    if (testId) load();
  }, [testId, type]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (Object.keys(answers).length === 0) return;
    
    setIsSaving(true);
    try {
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
      const progressKey = `test_progress_${studentId}_${type}_${testId}`;
      await AsyncStorage.setItem(progressKey, JSON.stringify(saveData));
      setLastSaved(new Date());
      console.log('Auto-saved test progress');
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [answers, testId, type, currentIndex, seconds]);

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

  const total = questions.length || 1;
  const progress = useMemo(() => Math.round(((currentIndex + 1) / total) * 100), [currentIndex, total]);
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  
  // Calculate answered questions
  const answeredCount = useMemo(() => {
    return questions.filter((q: any) => {
      const qid = String(q.id ?? questions.indexOf(q));
      const value = answers[String(qid)];
      return value !== undefined && value !== null && value !== '';
    }).length;
  }, [questions, answers]);

  const isQuestionAnswered = (q: any): boolean => {
    if (!q) return false;
    const qid = String(q.id ?? currentIndex);
    const qtype = String(q.question_type || '');
    const value = answers[qid];
    if (qtype === 'true_false') return typeof value === 'boolean';
    if (qtype === 'multiple_choice') return typeof value === 'string' && value.length > 0;
    if (qtype === 'input') return typeof value === 'string' && value.trim().length > 0;
    if (qtype === 'fill_blanks') return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string' && v.trim().length > 0);
    if (qtype === 'matching') return Array.isArray(value) && value.length > 0;
    if (qtype === 'word_matching') return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
    if (qtype === 'speaking') return typeof value === 'object' && value !== null && (value as any).audioUri && (value as any).transcript;
    if (qtype === 'drawing') return typeof value === 'object' && value !== null && ((value as any).paths?.length > 0 || (value as any).textBoxes?.length > 0);
    // for unsupported types, consider not answered
    return false;
  };

  const allAnswered = useMemo(() => {
    if (!questions || questions.length === 0) return false;
    return questions.every((q: any) => isQuestionAnswered(q));
  }, [questions, answers]);

  // Handle test completion
  const handleTestComplete = useCallback(() => {
    // Calculate results
    const correctAnswers = questions.filter((q: any) => {
      const qid = String(q.id ?? questions.indexOf(q));
      const value = answers[qid];
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
    // This would use router.back() or navigation
  }, []);

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

  if (loading) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{
          backgroundColor:
            themeMode === 'cyberpunk'
              ? '#000000'
              : themeMode === 'dark'
              ? '#0f172a'
              : '#f8fafc',
        }}
      >
        <ActivityIndicator
          size="large"
          color={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#3b82f6' : '#2563eb'}
        />
        <Text
          className={`mt-3 ${
            themeMode === 'cyberpunk'
              ? 'text-cyan-400 tracking-wider'
              : themeMode === 'dark'
              ? 'text-gray-300'
              : 'text-gray-700'
          }`}
        >
          {themeMode === 'cyberpunk' ? 'LOADING TEST…' : 'Loading test…'}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1 p-4"
      style={{
        backgroundColor:
          themeMode === 'cyberpunk'
            ? '#000000'
            : themeMode === 'dark'
            ? '#0f172a'
            : '#f8fafc',
      }}
    >
      <View className="mb-4">
        <Text className={`text-2xl font-bold ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-white' 
            : 'text-gray-900'
        }`}>
          {themeMode === 'cyberpunk' ? `TEST #${testId}` : `Test #${testId}`}
        </Text>
        <Text className={`mt-1 ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-300 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-gray-300' 
            : 'text-gray-600'
        }`}>
          {themeMode === 'cyberpunk' ? `TYPE: ${(type || 'unknown').toUpperCase()}` : `Type: ${type || 'unknown'}`}
        </Text>
      </View>
      
      {/* Progress Tracker */}
      <ProgressTracker
        answeredCount={answeredCount}
        totalQuestions={questions.length}
        percentage={questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}
        timeElapsed={seconds}
        onSubmitTest={async () => {
          if (!allAnswered || isSubmitting) return;
          
          const confirmed = await new Promise<boolean>((resolve) => {
            Alert.alert('Submit test?', 'You cannot change answers after submission.', [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Submit', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
          if (!confirmed) return;
          
          setIsSubmitting(true);
          setSubmitError(null);
          
          try {
            // Copy web app submission logic exactly
            const userData = await AsyncStorage.getItem('user');
            const user = userData ? JSON.parse(userData) : null;
            
            const payload = {
              test_id: testId!,
              test_name: questions[0]?.test_name || `Test ${testId}`,
              test_type: String(type || ''),
              teacher_id: questions[0]?.teacher_id || null,
              subject_id: questions[0]?.subject_id || null,
              student_id: user?.student_id || user?.id,
              academic_period_id: 3, // TODO: Get from academic calendar
              answers: answers,
              score: null, // Will be calculated by backend
              maxScore: questions.length,
              time_taken: seconds,
              started_at: new Date(Date.now() - (seconds * 1000)).toISOString(),
              submitted_at: new Date().toISOString(),
              caught_cheating: false,
              visibility_change_times: 0,
              answers_by_id: null,
              question_order: questions.map(q => q.question_id),
              retest_assignment_id: null,
              parent_test_id: testId
            };
            
            // Use correct submission method based on test type
            try {
              const submitMethod = getSubmissionMethod(String(type || ''));
              const response = await submitMethod(payload);
              
              if (response.data.success) {
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
        }}
        isSubmitting={isSubmitting}
        canSubmit={allAnswered}
      />
      
      <View className={`flex-row justify-around rounded-xl p-4 mb-4 ${
        themeMode === 'cyberpunk' 
          ? 'bg-black border border-cyan-400/30' 
          : themeMode === 'dark' 
          ? 'bg-gray-800' 
          : 'bg-gray-100'
      }`}>
        <View className="items-center">
          <Text className={`text-xs font-medium mb-1 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-300 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-400' 
              : 'text-gray-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'TIME' : 'Time'}
          </Text>
          <Text className={`text-lg font-bold ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-white' 
              : 'text-gray-900'
          }`}>
            {minutes}:{secs}
          </Text>
        </View>
        <View className="items-center">
          <Text className={`text-xs font-medium mb-1 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-300 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-400' 
              : 'text-gray-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'PROGRESS' : 'Progress'}
          </Text>
          <Text className={`text-lg font-bold ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-white' 
              : 'text-gray-900'
          }`}>
            {answeredCount}/{total}
          </Text>
        </View>
        <View className="items-center">
          <Text className={`text-xs font-medium mb-1 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-300 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-400' 
              : 'text-gray-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'QUESTION' : 'Question'}
          </Text>
          <Text className={`text-lg font-bold ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-white' 
              : 'text-gray-900'
          }`}>
            {currentIndex + 1}/{total}
          </Text>
        </View>
      </View>
      
      {isSaving && (
        <View className="flex-row items-center justify-center my-2 gap-2">
          <ActivityIndicator 
            size="small" 
            color={themeMode === 'cyberpunk' ? '#00ffff' : themeMode === 'dark' ? '#3b82f6' : '#2563eb'} 
          />
          <Text className={`text-sm font-medium ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-blue-400' 
              : 'text-blue-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'AUTO-SAVING...' : 'Auto-saving...'}
          </Text>
        </View>
      )}
      {lastSaved && !isSaving && (
        <Text className={`text-xs text-center my-1 ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-300 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-gray-400' 
            : 'text-gray-600'
        }`}>
          {themeMode === 'cyberpunk' ? `LAST SAVED: ${lastSaved.toLocaleTimeString()}` : `Last saved: ${lastSaved.toLocaleTimeString()}`}
        </Text>
      )}
      {!loading && !error && (
        <View className={`h-2 rounded-lg overflow-hidden mb-3 ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-gray-700' 
            : 'bg-gray-200'
        }`}>
          <View 
            className={`h-full ${
              themeMode === 'cyberpunk' 
                ? 'bg-cyan-400' 
                : themeMode === 'dark' 
                ? 'bg-blue-500' 
                : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }} 
          />
        </View>
      )}
      
      {submitError && (
        <View className={`border rounded-lg p-3 mb-3 ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-red-400/30' 
            : themeMode === 'dark' 
            ? 'bg-red-900/20 border-red-500' 
            : 'bg-red-50 border-red-200'
        }`}>
          <Text className={`text-sm text-center ${
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
      <LoadingModal visible={isSubmitting} message={themeMode === 'cyberpunk' ? 'SUBMITTING…' : 'Submitting…'} />
      {error ? (
        <View className="flex-1 justify-center items-center">
          <Text className={`text-lg ${
            themeMode === 'cyberpunk' 
              ? 'text-red-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-red-300' 
              : 'text-red-600'
          }`}>
            {error}
          </Text>
        </View>
      ) : (
        <>
          <Text className={`mb-2 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-300 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-300' 
              : 'text-gray-600'
          }`}>
            {themeMode === 'cyberpunk' 
              ? `QUESTION ${currentIndex + 1} OF ${questions.length}` 
              : `Question ${currentIndex + 1} of ${questions.length}`}
          </Text>
          <View className={`rounded-xl p-4 mb-3 ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800' 
              : 'bg-gray-100'
          }`}>
            {(() => {
              const q = questions[currentIndex];
              const qid = q?.id ?? String(currentIndex);
              const value = answers[String(qid)] as any;
              const onChange = (questionId: string | number, val: any) =>
                dispatch(setAnswer({ questionId: String(questionId), value: val }));
              return (
                <QuestionRenderer
                  question={q}
                  testId={String(testId)}
                  testType={String(q?.question_type || type || '')}
                  displayNumber={currentIndex + 1}
                  studentId={studentId}
                  value={value}
                  onChange={onChange}
                />
              );
            })()}
          </View>
          <View className="flex-row justify-between gap-3 mb-3">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg items-center ${
                currentIndex === 0 
                  ? 'opacity-50' 
                  : themeMode === 'cyberpunk' 
                  ? 'bg-black border border-cyan-400/30' 
                  : themeMode === 'dark' 
                  ? 'bg-gray-700' 
                  : 'bg-gray-800'
              }`}
              disabled={currentIndex === 0}
              onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text className={`font-semibold ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : 'text-white'
              }`}>
                {themeMode === 'cyberpunk' ? 'PREV' : 'Prev'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg items-center ${
                currentIndex >= questions.length - 1 
                  ? 'opacity-50' 
                  : themeMode === 'cyberpunk' 
                  ? 'bg-black border border-cyan-400/30' 
                  : themeMode === 'dark' 
                  ? 'bg-gray-700' 
                  : 'bg-gray-800'
              }`}
              disabled={currentIndex >= questions.length - 1}
              onPress={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text className={`font-semibold ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : 'text-white'
              }`}>
                {themeMode === 'cyberpunk' ? 'NEXT' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}



