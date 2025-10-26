import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { hydrateSuccess } from '../../../../src/store/slices/authSlice';
import { api } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QuestionRenderer from '../../../../src/components/questions/QuestionRenderer';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import TestHeader from '../../../../src/components/TestHeader';

export default function FillBlanksTestScreen() {
  const { testId } = useLocalSearchParams();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: any) => state.auth.user);
  
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

  // Check if test is already completed
  const checkTestCompleted = useCallback(async () => {
    if (!user?.student_id || !testId) return false;
    
    try {
      const completionKey = `test_completed_${user.student_id}_fill_blanks_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      const retestKey = `retest1_${user.student_id}_fill_blanks_${testId}`;
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

      setTestData(testResponse.data.test_info || testResponse.data.data);
      
      // Apply question shuffling if enabled
      let finalQuestions = questionsResponse.data.questions || [];
      const testInfo = testResponse.data.test_info || testResponse.data.data;
      
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
            const byId = new Map(finalQuestions.map(q => [q.question_id, q]));
            finalQuestions = order.map(id => byId.get(id)).filter(Boolean);
          } else {
            // Generate deterministic shuffle using seeded RNG
            function mulberry32(a) {
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
            const order = finalQuestions.map(q => q.question_id);
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

  // Timer effect
  useEffect(() => {
    if (!testData || !questions.length) return;
    
    const allowedTime = testData.allowed_time || testData.time_limit;
    if (allowedTime && allowedTime > 0) {
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [testData, questions.length]);

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

    // Show confirmation dialog before submitting
    Alert.alert(
      'Submit Test',
      'Are you sure you want to submit your test? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', style: 'destructive', onPress: () => submitTest() }
      ]
    );
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
        const studentAnswer = answers[index]?.trim().toLowerCase();
        const correctAnswer = question.correct_answer?.trim().toLowerCase();
        if (studentAnswer === correctAnswer) {
          correctAnswers++;
        }
      });

      const score = correctAnswers;
      const maxScore = questions.length;
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      const submissionData = {
        test_id: testId,
        test_name: testData.test_name || testData.title,
        test_type: 'fill_blanks',
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
        caught_cheating: false,
        visibility_change_times: 0,
        answers_by_id: questions.reduce((acc, q, index) => {
          acc[q.question_id] = answers[index] || '';
          return acc;
        }, {} as Record<string, string>),
        question_order: questions.map(q => q.question_id),
        retest_assignment_id: null,
        parent_test_id: testId
      };

      const response = await api.post('/api/submit-fill-blanks-test', submissionData);
      
      if (response.data.success) {
        const completionKey = `test_completed_${user.student_id}_fill_blanks_${testId}`;
        await AsyncStorage.setItem(completionKey, 'true');
        
        const retestKey = `retest1_${user.student_id}_fill_blanks_${testId}`;
        const retestAssignKey = `retest_assignment_id_${user.student_id}_fill_blanks_${testId}`;
        await AsyncStorage.multiRemove([retestKey, retestAssignKey]);

        const detailedResults = {
          testName: testData.test_name || testData.title,
          score: score,
          maxScore: maxScore,
          percentage: percentage,
          questions: questions.map((question, index) => ({
            questionNumber: index + 1,
            questionText: question.question,
            correctAnswer: question.correct_answer,
            studentAnswer: answers[index] || '',
            isCorrect: (answers[index]?.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase())
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
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading test...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!testData || !questions.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No test data available</Text>
      </View>
    );
  }

  // Show results screen if test is completed
  if (showResults && testResults) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Test Results</Text>
          <Text style={styles.subtitle}>{testResults.testName}</Text>
        </View>

        <View style={styles.paper}>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreTitle}>Your Score</Text>
            <Text style={styles.scoreText}>
              {testResults.score}/{testResults.maxScore} ({testResults.percentage}%)
            </Text>
          </View>

          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Question Review</Text>
            {testResults.questions.map((result: any, index: number) => (
              <View key={index} style={styles.questionResult}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Question {result.questionNumber}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: result.isCorrect ? '#10B981' : '#EF4444' }
                  ]}>
                    <Text style={styles.statusText}>
                      {result.isCorrect ? 'Correct' : 'Incorrect'}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.questionText}>{result.questionText}</Text>
                
                <View style={styles.answerContainer}>
                  <View style={styles.answerRow}>
                    <Text style={styles.answerLabel}>Your Answer:</Text>
                    <Text style={[
                      styles.answerText,
                      { color: result.isCorrect ? '#10B981' : '#EF4444' }
                    ]}>
                      {result.studentAnswer || 'No answer'}
                    </Text>
                  </View>
                  
                  <View style={styles.answerRow}>
                    <Text style={styles.answerLabel}>Correct Answer:</Text>
                    <Text style={styles.correctAnswerText}>{result.correctAnswer}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TestHeader 
        testName={testData.test_name || testData.title}
      />
      <ScrollView style={styles.scrollContainer}>

      <View style={styles.paper}>
        <ProgressTracker
          answeredCount={answers.filter(answer => answer && answer.trim() !== '').length}
          totalQuestions={questions.length}
          percentage={questions.length > 0 ? Math.round((answers.filter(answer => answer && answer.trim() !== '').length / questions.length) * 100) : 0}
          timeElapsed={testData?.allowed_time > 0 ? timeElapsed : undefined}
          onSubmitTest={handleSubmit}
          isSubmitting={isSubmitting}
          canSubmit={answers.filter(answer => answer && answer.trim() !== '').length === questions.length}
        />

        {questions.map((question, index) => (
          <View key={question.question_id || index} style={styles.questionBlock}>
            <QuestionRenderer
              question={question}
              testId={testId as string}
              testType="fill_blanks"
              displayNumber={index + 1}
              studentId={user?.student_id || ''}
              value={answers[index] || ''}
              onChange={handleAnswerChange}
            />
          </View>
        ))}

        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                opacity: (answers.filter(answer => answer && answer.trim() !== '').length === questions.length && !isSubmitting) ? 1 : 0.6,
                backgroundColor: isSubmitting ? '#6b7280' : '#8B5CF6'
              }
            ]}
            disabled={isLoadingUser || answers.filter(answer => answer && answer.trim() !== '').length !== questions.length || isSubmitting}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>
              {isLoadingUser ? 'Loading...' : isSubmitting ? 'Submitting...' : 'Submit Test'}
            </Text>
          </TouchableOpacity>
        </View>

        {submitError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#3B82F6',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 10,
  },
  paper: {
    margin: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  questionBlock: {
    marginBottom: 16,
  },
  submitContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 120,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FEF2F2',
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
    textAlign: 'center',
  },
  scoreContainer: {
    backgroundColor: '#F3F4F6',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  },
  resultsContainer: {
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 16,
  },
  questionResult: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  answerContainer: {
    gap: 8,
  },
  answerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  answerText: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  correctAnswerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
    flex: 1,
    textAlign: 'right',
  },
  actionContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 150,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
