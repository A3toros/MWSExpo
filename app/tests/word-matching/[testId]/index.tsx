/** @jsxImportSource nativewind */
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { DraxProvider, DraxView } from 'react-native-drax';
import Svg, { Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSubmissionMethod } from '../../../../src/services/apiClient';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import { useAppSelector } from '../../../../src/store';
import TestHeader from '../../../../src/components/TestHeader';
import { SubmitModal } from '../../../../src/components/modals';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';
import ProgressTracker from '../../../../src/components/ProgressTracker';

export default function WordMatchingTestScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [testResults, setTestResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [leftLayouts, setLeftLayouts] = useState<Record<number, { x: number; y: number; w: number; h: number }>>({});
  const [rightLayouts, setRightLayouts] = useState<Record<number, { x: number; y: number; w: number; h: number }>>({});
  const [showResetModal, setShowResetModal] = useState(false);
  const [isSubmittingToAPI, setIsSubmittingToAPI] = useState(false);

  // Check if test is already completed (web app pattern)
  const checkTestCompleted = useCallback(async () => {
    if (!testId) return false;
    
    try {
      // Enhanced student ID extraction with multiple fallbacks
      let studentId = user?.student_id;
      
      if (!studentId) {
        // Try JWT token first
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              studentId = payload.student_id || payload.id || payload.user_id || payload.username || payload.email;
            }
          }
        } catch (e) {
          console.log('JWT extraction failed:', e);
        }
        
        // Fallback to AsyncStorage
        if (!studentId) {
          const userData = await AsyncStorage.getItem('user');
          const userFromStorage = userData ? JSON.parse(userData) : null;
          studentId = userFromStorage?.student_id || userFromStorage?.id || userFromStorage?.user_id || userFromStorage?.username || userFromStorage?.email;
        }
        
        // Try auth_user key if still no ID
        if (!studentId) {
          const authUserData = await AsyncStorage.getItem('auth_user');
          const authUser = authUserData ? JSON.parse(authUserData) : null;
          studentId = authUser?.student_id || authUser?.id || authUser?.user_id || authUser?.username || authUser?.email;
        }
      }
      
      if (!studentId) return false;
      
      const completionKey = `test_completed_${studentId}_word_matching_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      const retestKey = `retest1_${studentId}_word_matching_${testId}`;
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
    setShowSubmitModal(true);
  }, []);

  // Actual submit function
  const performSubmit = useCallback(async () => {
    if (!testData) return;

    setIsSubmitting(true);
    setIsSubmittingToAPI(true);
    try {
      // Enhanced student ID extraction with multiple fallbacks
      let studentId = user?.student_id;
      
      if (!studentId) {
        // Try JWT token first
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              studentId = payload.student_id || payload.id || payload.user_id || payload.username || payload.email;
            }
          }
        } catch (e) {
          console.log('JWT extraction failed:', e);
        }
        
        // Fallback to AsyncStorage
        if (!studentId) {
          const userData = await AsyncStorage.getItem('user');
          const userFromStorage = userData ? JSON.parse(userData) : null;
          studentId = userFromStorage?.student_id || userFromStorage?.id || userFromStorage?.user_id || userFromStorage?.username || userFromStorage?.email;
        }
        
        // Try auth_user key if still no ID
        if (!studentId) {
          const authUserData = await AsyncStorage.getItem('auth_user');
          const authUser = authUserData ? JSON.parse(authUserData) : null;
          studentId = authUser?.student_id || authUser?.id || authUser?.user_id || authUser?.username || authUser?.email;
        }
      }
      
      if (!studentId) {
        Alert.alert('Error', 'Missing student ID');
        return;
      }
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

      // Calculate score based on correct matches
      let correctMatches = 0;
      if (testData.leftWords && testData.rightWords) {
        Object.entries(answers).forEach(([leftIndex, rightIndex]) => {
          const leftWord = testData.leftWords[parseInt(leftIndex)];
          const rightWord = testData.rightWords[rightIndex];
          if (leftWord === rightWord) {
            correctMatches++;
          }
        });
      }

      const submissionData = {
        test_id: parseInt(testId),
        test_name: testData.test_name,
        teacher_id: testData.teacher_id,
        subject_id: testData.subject_id,
        student_id: studentId,
        academic_period_id: academic_period_id,
        score: correctMatches,
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
        const completionKey = `test_completed_${studentId}_word_matching_${testId}`;
        await AsyncStorage.setItem(completionKey, 'true');
        
        // Clear retest key if it exists
        const retestKey = `retest1_${studentId}_word_matching_${testId}`;
        await AsyncStorage.removeItem(retestKey);
        
        // Clear retest assignment key if it exists
        const retestAssignKey = `retest_assignment_id_${studentId}_word_matching_${testId}`;
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
      setIsSubmittingToAPI(false);
    }
  }, [user?.student_id, testId, testData, answers]);

  // Reset function
  const handleReset = useCallback(() => {
    setShowResetModal(true);
  }, []);

  const confirmReset = useCallback(() => {
    setAnswers({});
    setLeftLayouts({});
    setRightLayouts({});
    setShowResetModal(false);
  }, []);

  const cancelReset = useCallback(() => {
    setShowResetModal(false);
  }, []);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-base text-gray-500 text-center mt-2">Loading test...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center px-4">
        <Text className="text-base text-red-600 text-center mb-4">{error}</Text>
        <TouchableOpacity className="bg-[#8B5CF6] py-3 px-6 rounded-lg" onPress={loadTestData}>
          <Text className="text-white text-center font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showResults && testResults) {
    return (
      <View className={`flex-1 ${themeClasses.background}`}>
        <TestHeader 
          testName={testData.test_name}
        />
        
        <ScrollView className="flex-1">
          <View className="p-4">
            {/* Header */}
            <View className={`${themeClasses.surface} rounded-xl p-6 mb-4 border ${themeClasses.border}`}>
              <Text className={`text-2xl font-bold text-center mb-4 ${
                themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-800'
              }`}>
                {themeMode === 'cyberpunk' ? 'TEST RESULTS' : 'Test Results'}
              </Text>
              
              {/* Score Summary */}
              <View className={`rounded-lg p-4 mb-4 ${
                themeMode === 'cyberpunk' 
                  ? 'bg-black border border-cyan-400/30' 
                  : themeMode === 'dark' 
                  ? 'bg-gray-700 border border-gray-600' 
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <Text className={`text-lg font-semibold text-center mb-2 ${
                  themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-700'
                }`}>
                  {themeMode === 'cyberpunk' ? 'SCORE SUMMARY' : 'Score Summary'}
                </Text>
                <Text className={`text-3xl font-bold text-center mb-1 ${
                  themeMode === 'cyberpunk' ? 'text-cyan-400' : themeMode === 'dark' ? 'text-white' : 'text-gray-800'
                }`}>
                  {testResults.score || 0}/{testResults.maxScore || testData.leftWords?.length}
                </Text>
                <Text className={`text-lg text-center ${
                  themeMode === 'cyberpunk' ? 'text-cyan-300' : themeMode === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {themeMode === 'cyberpunk' ? 'PERCENTAGE:' : 'Percentage:'} {testResults.percentage || 0}%
                </Text>
              </View>

              {/* Question Review */}
              <View className="mb-4">
                <Text className={`text-lg font-bold mb-3 ${
                  themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-800'
                }`}>
                  {themeMode === 'cyberpunk' ? 'QUESTION REVIEW' : 'Question Review'}
                </Text>
                
                {testData.leftWords?.map((leftWord: string, index: number) => {
                  const rightIndex = answers[index];
                  const rightWord = rightIndex !== undefined ? testData.rightWords[rightIndex] : null;
                  const isCorrect = leftWord === rightWord;
                  
                  return (
                    <View key={index} className={`p-4 rounded-lg mb-3 border-2 ${
                      isCorrect 
                        ? (themeMode === 'cyberpunk' ? 'bg-green-900/20 border-green-400/30' : themeMode === 'dark' ? 'bg-green-900/30 border-green-600' : 'bg-green-50 border-green-200')
                        : (themeMode === 'cyberpunk' ? 'bg-red-900/20 border-red-400/30' : themeMode === 'dark' ? 'bg-red-900/30 border-red-600' : 'bg-red-50 border-red-200')
                    }`}>
                      <View className="flex-row justify-between items-center mb-3">
                        <Text className={`text-base font-semibold ${
                          themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-800'
                        }`}>
                          {themeMode === 'cyberpunk' ? `QUESTION ${index + 1}` : `Question ${index + 1}`}
                        </Text>
                        <View className={`px-3 py-1 rounded-xl ${
                          isCorrect 
                            ? (themeMode === 'cyberpunk' ? 'bg-green-900/30 border border-green-400/30' : themeMode === 'dark' ? 'bg-green-800' : 'bg-green-100')
                            : (themeMode === 'cyberpunk' ? 'bg-red-900/30 border border-red-400/30' : themeMode === 'dark' ? 'bg-red-800' : 'bg-red-100')
                        }`}>
                          <Text className={`text-xs font-semibold ${
                            isCorrect 
                              ? (themeMode === 'cyberpunk' ? 'text-green-400' : themeMode === 'dark' ? 'text-green-300' : 'text-green-800')
                              : (themeMode === 'cyberpunk' ? 'text-red-400' : themeMode === 'dark' ? 'text-red-300' : 'text-red-800')
                          }`}>
                            {isCorrect ? (themeMode === 'cyberpunk' ? '✓ CORRECT' : '✓ Correct') : (themeMode === 'cyberpunk' ? '✗ INCORRECT' : '✗ Incorrect')}
                          </Text>
                        </View>
                      </View>
                      
                      <View className="flex-row gap-3">
                        <View className="flex-1">
                          <Text className={`text-sm font-semibold mb-1 ${
                            themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-600'
                          }`}>
                            {themeMode === 'cyberpunk' ? 'LEFT WORD:' : 'Left Word:'}
                          </Text>
                          <Text className={`text-sm p-3 rounded-md ${
                            themeMode === 'cyberpunk' ? 'text-cyan-200 bg-black border border-cyan-400/30' : themeMode === 'dark' ? 'text-gray-300 bg-gray-700' : 'text-gray-500 bg-gray-100'
                          }`}>
                            {leftWord}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className={`text-sm font-semibold mb-1 ${
                            themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-600'
                          }`}>
                            {themeMode === 'cyberpunk' ? 'YOUR ANSWER:' : 'Your Answer:'}
                          </Text>
                          <Text className={`text-sm p-3 rounded-md ${
                            isCorrect 
                              ? (themeMode === 'cyberpunk' ? 'bg-green-900/30 text-green-400 border border-green-400/30' : themeMode === 'dark' ? 'bg-green-800 text-green-300' : 'bg-green-100 text-green-800')
                              : (themeMode === 'cyberpunk' ? 'bg-red-900/30 text-red-400 border border-red-400/30' : themeMode === 'dark' ? 'bg-red-800 text-red-300' : 'bg-red-100 text-red-800')
                          }`}>
                            {rightWord || (themeMode === 'cyberpunk' ? 'NOT ANSWERED' : 'Not answered')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Summary Statistics */}
              <View className={`rounded-xl p-5 mb-4 border ${
                themeMode === 'cyberpunk' 
                  ? 'bg-black border-cyan-400/30' 
                  : themeMode === 'dark' 
                  ? 'bg-gray-800 border-gray-600' 
                  : 'bg-white border-gray-200'
              }`}>
                <Text className={`text-xl font-bold mb-4 ${
                  themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-800'
                }`}>
                  {themeMode === 'cyberpunk' ? 'SUMMARY STATISTICS' : 'Summary Statistics'}
                </Text>
                <View className="flex-row flex-wrap gap-3">
                  <View className={`flex-1 min-w-[45%] items-center p-4 rounded-lg ${
                    themeMode === 'cyberpunk' ? 'bg-green-900/30 border border-green-400/30' : themeMode === 'dark' ? 'bg-green-800' : 'bg-green-100'
                  }`}>
                    <Text className={`text-xl font-bold mb-1 ${
                      themeMode === 'cyberpunk' ? 'text-green-400' : themeMode === 'dark' ? 'text-green-300' : 'text-green-600'
                    }`}>
                      {testData.leftWords?.filter((leftWord: string, index: number) => {
                        const rightIndex = answers[index];
                        const rightWord = rightIndex !== undefined ? testData.rightWords[rightIndex] : null;
                        return leftWord === rightWord;
                      }).length || 0}
                    </Text>
                    <Text className={`text-xs ${
                      themeMode === 'cyberpunk' ? 'text-green-400' : themeMode === 'dark' ? 'text-green-300' : 'text-green-600'
                    }`}>
                      {themeMode === 'cyberpunk' ? 'CORRECT' : 'Correct'}
                    </Text>
                  </View>
                  <View className={`flex-1 min-w-[45%] items-center p-4 rounded-lg ${
                    themeMode === 'cyberpunk' ? 'bg-red-900/30 border border-red-400/30' : themeMode === 'dark' ? 'bg-red-800' : 'bg-red-100'
                  }`}>
                    <Text className={`text-xl font-bold mb-1 ${
                      themeMode === 'cyberpunk' ? 'text-red-400' : themeMode === 'dark' ? 'text-red-300' : 'text-red-600'
                    }`}>
                      {testData.leftWords?.filter((leftWord: string, index: number) => {
                        const rightIndex = answers[index];
                        const rightWord = rightIndex !== undefined ? testData.rightWords[rightIndex] : null;
                        return leftWord !== rightWord;
                      }).length || 0}
                    </Text>
                    <Text className={`text-xs ${
                      themeMode === 'cyberpunk' ? 'text-red-400' : themeMode === 'dark' ? 'text-red-300' : 'text-red-600'
                    }`}>
                      {themeMode === 'cyberpunk' ? 'INCORRECT' : 'Incorrect'}
                    </Text>
                  </View>
                  <View className={`flex-1 min-w-[45%] items-center p-4 rounded-lg ${
                    themeMode === 'cyberpunk' ? 'bg-gray-800 border border-cyan-400/30' : themeMode === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <Text className={`text-xl font-bold mb-1 ${
                      themeMode === 'cyberpunk' ? 'text-cyan-400' : themeMode === 'dark' ? 'text-cyan-300' : 'text-gray-600'
                    }`}>
                      {testResults.percentage || 0}%
                    </Text>
                    <Text className={`text-xs ${
                      themeMode === 'cyberpunk' ? 'text-cyan-400' : themeMode === 'dark' ? 'text-cyan-300' : 'text-gray-600'
                    }`}>
                      {themeMode === 'cyberpunk' ? 'ACCURACY' : 'Accuracy'}
                    </Text>
                  </View>
                  <View className={`flex-1 min-w-[45%] items-center p-4 rounded-lg ${
                    themeMode === 'cyberpunk' ? 'bg-purple-900/30 border border-purple-400/30' : themeMode === 'dark' ? 'bg-purple-800' : 'bg-purple-100'
                  }`}>
                    <Text className={`text-xl font-bold mb-1 ${
                      themeMode === 'cyberpunk' ? 'text-purple-400' : themeMode === 'dark' ? 'text-purple-300' : 'text-purple-600'
                    }`}>
                      {testData.leftWords?.length || 0}
        </Text>
                    <Text className={`text-xs ${
                      themeMode === 'cyberpunk' ? 'text-purple-400' : themeMode === 'dark' ? 'text-purple-300' : 'text-purple-600'
                    }`}>
                      {themeMode === 'cyberpunk' ? 'TOTAL' : 'Total'}
        </Text>
                  </View>
                </View>
              </View>

              {/* Back to Dashboard Button */}
        <TouchableOpacity 
                onPress={() => router.push('/(tabs)')}
                className={`px-4 py-3 rounded-lg items-center flex-row justify-center ${
                  themeMode === 'cyberpunk'
                    ? 'bg-black border border-cyan-400/30'
                    : themeMode === 'dark'
                    ? 'bg-blue-600'
                    : 'bg-header-blue'
                }`}
              >
                <Text className={`text-base font-semibold ml-2 ${
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

  if (!testData || !testData.leftWords || !testData.rightWords) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center px-4">
        <Text className="text-base text-red-600 text-center">No test data available</Text>
      </View>
    );
  }

  const isAllAnswered = (() => {
    if (!testData.leftWords || testData.leftWords.length === 0) return false;
    return Object.values(answers).filter((answer: any) => {
      if (answer === null || answer === undefined) return false;
      if (typeof answer === 'string') return answer.trim() !== '';
      if (typeof answer === 'object') return Object.keys(answer).length > 0;
      return true;
    }).length === testData.leftWords.length;
  })();

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      <TestHeader 
        testName={testData.test_name}
      />
      
      {/* Test Info Button */}
      <ScrollView className="flex-1">
        <View className="flex-row justify-between items-center mb-4 mt-4">
          <Text className={`text-lg font-semibold pl-4 ${
            themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-800'
          }`}>
            {themeMode === 'cyberpunk' ? 'MATCH THE WORDS CORRECTLY' : 'Match the words correctly'}
          </Text>
          <TouchableOpacity
            className={`px-4 py-2 rounded-lg ${
              themeMode === 'cyberpunk' 
                ? 'bg-black border border-orange-400/30' 
                : themeMode === 'dark' 
                ? 'bg-orange-600' 
                : 'bg-orange-500'
            }`}
            onPress={handleReset}
          >
            <Text className={`font-semibold ${
              themeMode === 'cyberpunk' ? 'text-orange-400 tracking-wider' : 'text-white'
            }`}>
              {themeMode === 'cyberpunk' ? 'RESET' : 'Reset'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress Tracker */}
        <ProgressTracker
          answeredCount={Object.values(answers).filter((answer: any) => {
            if (answer === null || answer === undefined) return false;
            if (typeof answer === 'string') return answer.trim() !== '';
            if (typeof answer === 'object') return Object.keys(answer).length > 0;
            return true;
          }).length}
          totalQuestions={testData.leftWords?.length || 0}
          percentage={(testData.leftWords?.length || 0) > 0 ? Math.round((Object.values(answers).filter((answer: any) => {
            if (answer === null || answer === undefined) return false;
            if (typeof answer === 'string') return answer.trim() !== '';
            if (typeof answer === 'object') return Object.keys(answer).length > 0;
            return true;
          }).length / (testData.leftWords?.length || 0)) * 100) : 0}
          timeElapsed={0} // TODO: Add timer
          onSubmitTest={submitTest}
          isSubmitting={isSubmitting}
          canSubmit={isAllAnswered}
        />

        <DraxProvider>
        <View className="p-4">
          <View className="flex-row" onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainerSize({ width, height });
          }}>
            {/* Left items (Draggable) */}
            <View className="flex-1 mr-2">
            {testData.leftWords.map((word: string, index: number) => (
              <DraxView
                key={index}
                dragPayload={index}
                className="rounded-lg shadow-sm"
                style={{
                  backgroundColor: answers[index] !== undefined 
                    ? (themeMode === 'cyberpunk' ? '#00ffff' : themeMode === 'dark' ? '#8B5CF6' : '#8B5CF6')
                    : (themeMode === 'cyberpunk' ? '#1f2937' : themeMode === 'dark' ? '#374151' : '#F3F4F6'),
                  borderWidth: 2,
                  borderColor: answers[index] !== undefined 
                    ? (themeMode === 'cyberpunk' ? '#00ffff' : themeMode === 'dark' ? '#8B5CF6' : '#8B5CF6')
                    : (themeMode === 'cyberpunk' ? '#374151' : themeMode === 'dark' ? '#4B5563' : '#D1D5DB'),
                  paddingHorizontal: 4,
                  paddingVertical: 8,
                  marginBottom: 16,
                  marginHorizontal: 12
                }}
                draggingStyle={{ opacity: 0.8 }}
                onLayout={(e) => {
                  const { x, y, width, height } = e.nativeEvent.layout;
                  setLeftLayouts(prev => ({ ...prev, [index]: { x, y, w: width, h: height } }));
                }}
              >
                <Text className={`text-center font-medium ${
                  answers[index] !== undefined 
                    ? (themeMode === 'cyberpunk' ? 'text-black' : 'text-white')
                    : (themeMode === 'cyberpunk' ? 'text-cyan-300' : themeMode === 'dark' ? 'text-gray-200' : 'text-gray-800')
                }`}>{word}</Text>
              </DraxView>
            ))}
            </View>

            {/* Right items (Droppable) */}
            <View className="flex-1 ml-2">
            {testData.rightWords.map((word: string, index: number) => {
              const leftKey = Object.keys(answers).find(l => answers[parseInt(l)] === index);
              const leftIdx = leftKey !== undefined ? parseInt(leftKey) : null;
              const draggedLabel = leftIdx !== null && leftIdx !== undefined ? testData.leftWords[leftIdx] : '';
              const isAssigned = leftIdx !== null && leftIdx !== undefined;
              return (
                <DraxView
                  key={index}
                  receptive
                  className="rounded-lg shadow-sm"
                  style={{
                    backgroundColor: isAssigned 
                      ? (themeMode === 'cyberpunk' ? '#00ffff' : themeMode === 'dark' ? '#8B5CF6' : '#8B5CF6')
                      : (themeMode === 'cyberpunk' ? '#1f2937' : themeMode === 'dark' ? '#374151' : '#F3F4F6'),
                    borderWidth: 2,
                    borderColor: isAssigned 
                      ? (themeMode === 'cyberpunk' ? '#00ffff' : themeMode === 'dark' ? '#8B5CF6' : '#8B5CF6')
                      : (themeMode === 'cyberpunk' ? '#374151' : themeMode === 'dark' ? '#4B5563' : '#D1D5DB'),
                    paddingHorizontal: 4,
                    paddingVertical: 8,
                    marginBottom: 16,
                    marginHorizontal: 12
                  }}
                  onLayout={(e) => {
                    const { x, y, width, height } = e.nativeEvent.layout;
                    setRightLayouts(prev => ({ ...prev, [index]: { x, y, w: width, h: height } }));
                  }}
                  onReceiveDragDrop={({ dragged }) => {
                    const leftIndex = dragged?.payload as number;
                    if (typeof leftIndex !== 'number') return;
                    // If this right is already used, clear previous mapping
                    const prevLeft = Object.keys(answers).find(l => answers[parseInt(l)] === index);
                    const newAnswers = { ...answers } as Record<string, number>;
                    if (prevLeft !== undefined) {
                      delete newAnswers[parseInt(prevLeft)];
                    }
                    newAnswers[leftIndex] = index;
                    setAnswers(newAnswers);
                  }}
                >
                  <View className="items-center">
                    <Text className={`text-center font-medium ${
                      isAssigned 
                        ? (themeMode === 'cyberpunk' ? 'text-black' : 'text-white')
                        : (themeMode === 'cyberpunk' ? 'text-cyan-300' : themeMode === 'dark' ? 'text-gray-200' : 'text-gray-800')
                    }`}>{word}</Text>
                    <Text className={`text-center mt-1 ${
                      isAssigned 
                        ? (themeMode === 'cyberpunk' ? 'text-black font-semibold' : 'text-white font-semibold')
                        : (themeMode === 'cyberpunk' ? 'text-cyan-400' : themeMode === 'dark' ? 'text-gray-400' : 'text-gray-400')
                    }`}>
                      {isAssigned ? draggedLabel : ''}
                    </Text>
                  </View>
                </DraxView>
              );
            })}
            </View>

            {/* Arrow overlay */}
            <View className="absolute inset-0 pointer-events-none">
              <Svg width={containerSize.width} height={containerSize.height}>
                {Object.entries(answers).map(([lStr, rIndex]) => {
                  const l = parseInt(lStr);
                  const left = leftLayouts[l];
                  const right = rightLayouts[rIndex as number];
                  if (!left || !right) return null;
                  const x1 = left.x + left.w; // right edge center of left item
                  const y1 = left.y + left.h / 2;
                  const x2 = right.x; // left edge center of right item
                  const y2 = right.y + right.h / 2;
                  return (
                    <Line key={`conn-${l}-${rIndex}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8B5CF6" strokeWidth={3} strokeLinecap="round" />
                  );
                })}
              </Svg>
            </View>
          </View>
        </View>
        </DraxProvider>

        <View className="p-4">
          {themeMode === 'cyberpunk' ? (
            <TouchableOpacity
              onPress={submitTest}
              disabled={!isAllAnswered || isSubmitting}
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
            className={`py-3 px-6 rounded-lg ${
              !isAllAnswered || isSubmitting 
                ? 'bg-gray-400' 
                : 'bg-[#8B5CF6]'
            }`}
            onPress={submitTest}
            disabled={!isAllAnswered || isSubmitting}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {isSubmitting ? 'Submitting...' : 'Submit Test'}
            </Text>
          </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Submit Confirmation Modal */}
      <SubmitModal
        visible={showSubmitModal}
        onCancel={() => setShowSubmitModal(false)}
        onConfirm={performSubmit}
        testName="Word Matching Test"
      />

      {/* Reset Confirmation Modal */}
      <SubmitModal
        visible={showResetModal}
        onCancel={cancelReset}
        onConfirm={confirmReset}
        testName="Reset Test"
      />

      {/* API Submission Loading Modal */}
      {isSubmittingToAPI && (
        <View className="absolute inset-0 bg-black bg-opacity-50 justify-center items-center z-50">
          <View className={`rounded-xl p-6 items-center ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text className="text-lg font-semibold text-gray-800 mt-4">Submitting Test...</Text>
            <Text className="text-sm text-gray-600 mt-2 text-center">Please wait while we process your answers</Text>
          </View>
        </View>
      )}
    </View>
  );
}


