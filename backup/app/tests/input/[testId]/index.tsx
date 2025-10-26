import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSubmissionMethod } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import QuestionRenderer from '../../../../src/components/questions/QuestionRenderer';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import TestHeader from '../../../../src/components/TestHeader';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { setAnswer, setIndex, startTest, hydrateFromStorage, tickSecond } from '../../../../src/store/slices/testSlice';
import TestResults from '../../../../src/components/TestResults';

export default function TestRunnerScreen() {
  const { testId, type } = useLocalSearchParams<{ testId: string; type?: string }>();
  const dispatch = useAppDispatch();
  const answers = useAppSelector((s: any) => s.testSession.answers);
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
          console.log('Loading test questions for:', { test_type: type, test_id: testId });
          // Copy web app exactly - use get-test-questions for all test types
          const res = await api.get('/api/get-test-questions', { 
            params: { test_type: type, test_id: testId } 
          });
          console.log('API response:', res.data);
          
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
          console.error('Full error:', e);
          console.error('Error response:', e?.response?.data);
          setError(`Failed to load test questions: ${e?.message || 'Unknown error'}`);
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

  return (
    <View style={styles.container}>
      <TestHeader 
        testName={`Test #${testId}`}
      />
      
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
              academic_period_id: await (async () => {
                await academicCalendarService.loadAcademicCalendar();
                const currentTerm = academicCalendarService.getCurrentTerm();
                return currentTerm?.id || 3;
              })(),
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
        }}
        isSubmitting={isSubmitting}
        canSubmit={allAnswered}
      />
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Time</Text>
          <Text style={styles.statValue}>{minutes}:{secs}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Progress</Text>
          <Text style={styles.statValue}>{answeredCount}/{total}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Question</Text>
          <Text style={styles.statValue}>{currentIndex + 1}/{total}</Text>
        </View>
      </View>
      
      {isSaving && (
        <View style={styles.saveIndicator}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.saveText}>Auto-saving...</Text>
        </View>
      )}
      {lastSaved && !isSaving && (
        <Text style={styles.lastSavedText}>
          Last saved: {lastSaved.toLocaleTimeString()}
        </Text>
      )}
      {!loading && !error && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      )}
      
      {submitError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      )}
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={{ color: '#b91c1c' }}>{error}</Text>
      ) : (
        <>
          <Text style={{ marginBottom: 8 }}>Question {currentIndex + 1} of {questions.length}</Text>
          <View style={styles.questionBox}>
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
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { opacity: currentIndex === 0 ? 0.5 : 1 }]}
              disabled={currentIndex === 0}
              onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryText}>Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { opacity: currentIndex >= questions.length - 1 ? 0.5 : 1 }]}
              disabled={currentIndex >= questions.length - 1}
              onPress={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryText}>Next</Text>
      </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    color: '#1f2937',
    fontWeight: '700',
  },
  progressBar: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: '#2563eb' },
  questionBox: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, marginBottom: 12 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  primaryBtn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryText: { color: 'white', fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#111827', padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  secondaryText: { color: 'white', fontWeight: '600' },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    gap: 8,
  },
  saveText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  lastSavedText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 4,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
});


