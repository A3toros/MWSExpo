import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSubmissionMethod } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import { useAppSelector } from '../../../../src/store';
import TestHeader from '../../../../src/components/TestHeader';
import ProgressTracker from '../../../../src/components/ProgressTracker';

export default function WordMatchingTestScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [testResults, setTestResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if test is already completed (web app pattern)
  const checkTestCompleted = useCallback(async () => {
    if (!user?.student_id || !testId) return false;
    
    try {
      const completionKey = `test_completed_${user.student_id}_word_matching_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      const retestKey = `retest1_${user.student_id}_word_matching_${testId}`;
      const hasRetest = await AsyncStorage.getItem(retestKey);
      
      if (isCompleted === 'true' && hasRetest !== 'true') {
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

    if (await checkTestCompleted()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/api/get-word-matching-test', { 
        params: { test_id: testId } 
      });

      if (!response.data.success) {
        throw new Error(response.data.error || response.data.message || 'Failed to load test');
      }

      const test = response.data.data;
      setTestData(test);
      
    } catch (e: any) {
      console.error('Failed to load word matching test:', e?.message);
      setError('Failed to load test. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [testId, checkTestCompleted]);

  // Submit test
  const submitTest = useCallback(async () => {
    if (!user?.student_id || !testData) return;

    // Show confirmation dialog before submitting
    Alert.alert(
      'Submit Test',
      'Are you sure you want to submit your test? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', style: 'destructive', onPress: () => performSubmit() }
      ]
    );
  }, [user?.student_id, testData, testId]);

  // Actual submit function
  const performSubmit = useCallback(async () => {
    if (!user?.student_id || !testData) return;

    setIsSubmitting(true);
    try {
      // Get current academic period ID from academic calendar service
      await academicCalendarService.loadAcademicCalendar();
      const currentTerm = academicCalendarService.getCurrentTerm();
      const academic_period_id = currentTerm?.id;
      
      if (!academic_period_id) {
        console.error('❌ No current academic period found');
        Alert.alert('Error', 'No current academic period found');
        return;
      }
      
      console.log('📅 Current academic period ID:', academic_period_id);

      const submissionData = {
        test_id: parseInt(testId),
        test_name: testData.test_name,
        teacher_id: testData.teacher_id,
        subject_id: testData.subject_id,
        student_id: user?.student_id,
        academic_period_id: academic_period_id,
        score: 0, // Will be calculated by backend
        maxScore: testData.leftWords?.length || 0,
        answers: answers,
        time_taken: 0,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: false,
        visibility_change_times: 0,
        is_completed: true,
        answers_by_id: answers,
        question_order: testData.leftWords?.map((_: any, i: number) => i) || []
      };

      const submitMethod = getSubmissionMethod('word_matching');
      const response = await submitMethod(submissionData);
      
      if (response.data.success) {
        // Mark test as completed (web app pattern)
        const completionKey = `test_completed_${user.student_id}_word_matching_${testId}`;
        await AsyncStorage.setItem(completionKey, 'true');
        
        // Clear retest key if it exists
        const retestKey = `retest1_${user.student_id}_word_matching_${testId}`;
        await AsyncStorage.removeItem(retestKey);
        
        // Clear retest assignment key if it exists
        const retestAssignKey = `retest_assignment_id_${user.student_id}_word_matching_${testId}`;
        await AsyncStorage.removeItem(retestAssignKey);
        
        setTestResults(response.data);
        setShowResults(true);
      } else {
        throw new Error(response.data.message || 'Failed to submit test');
      }
    } catch (e: any) {
      console.error('Failed to submit test:', e?.message);
      Alert.alert('Error', 'Failed to submit test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.student_id, testId, testData, answers]);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading test...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadTestData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showResults && testResults) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Test Results</Text>
        <Text style={styles.scoreText}>
          Score: {testResults.score || 0}/{testResults.maxScore || testData.leftWords?.length}
        </Text>
        <Text style={styles.percentageText}>
          Percentage: {testResults.percentage || 0}%
        </Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!testData || !testData.leftWords || !testData.rightWords) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No test data available</Text>
      </View>
    );
  }

  const isAllAnswered = testData.leftWords.every((_: any, index: number) => answers[index] !== undefined);

  return (
    <View style={styles.container}>
      <TestHeader 
        testName={testData.test_name}
      />
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.subtitle}>Match the words correctly</Text>

        {/* Progress Tracker */}
        <ProgressTracker
          answeredCount={Object.keys(answers).filter(key => answers[key] !== undefined).length}
          totalQuestions={testData.leftWords?.length || 0}
          percentage={(testData.leftWords?.length || 0) > 0 ? Math.round((Object.keys(answers).filter(key => answers[key] !== undefined).length / (testData.leftWords?.length || 0)) * 100) : 0}
          timeElapsed={0} // TODO: Add timer
          onSubmitTest={submitTest}
          isSubmitting={isSubmitting}
          canSubmit={isAllAnswered}
        />

        <View style={styles.matchingContainer}>
          <View style={styles.leftColumn}>
            <Text style={styles.columnTitle}>Left Column</Text>
            {testData.leftWords.map((word: string, index: number) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.wordItem,
                  answers[index] !== undefined && styles.selectedWord
                ]}
                onPress={() => {
                  // Clear selection if already selected
                  if (answers[index] !== undefined) {
                    const newAnswers = { ...answers };
                    delete newAnswers[index];
                    setAnswers(newAnswers);
                  }
                }}
              >
                <Text style={styles.wordText}>{word}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.rightColumn}>
            <Text style={styles.columnTitle}>Right Column</Text>
            {testData.rightWords.map((word: string, index: number) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.wordItem,
                  Object.values(answers).includes(index) && styles.selectedWord
                ]}
                onPress={() => {
                  // Find which left word this right word is currently matched to
                  const currentLeftIndex = Object.keys(answers).find(
                    leftIndex => answers[parseInt(leftIndex)] === index
                  );
                  
                  if (currentLeftIndex !== undefined) {
                    // This right word is already matched, clear it
                    const newAnswers = { ...answers };
                    delete newAnswers[parseInt(currentLeftIndex)];
                    setAnswers(newAnswers);
                  } else {
                    // Find the first unmatched left word
                    const leftWords = testData.leftWords;
                    const unmatchedLeftIndex = leftWords.findIndex(
                      (_: any, leftIdx: number) => answers[leftIdx] === undefined
                    );
                    
                    if (unmatchedLeftIndex !== -1) {
                      // Match this right word to the first unmatched left word
                      setAnswers({
                        ...answers,
                        [unmatchedLeftIndex]: index
                      });
                    }
                  }
                }}
              >
                <Text style={styles.wordText}>{word}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isAllAnswered || isSubmitting) && styles.disabledButton
            ]}
            onPress={submitTest}
            disabled={!isAllAnswered || isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Test'}
            </Text>
          </TouchableOpacity>
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
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  matchingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    gap: 20,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  wordItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedWord: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  wordText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  submitContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  percentageText: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
