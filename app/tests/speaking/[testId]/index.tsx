/** @jsxImportSource nativewind */
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../../../src/services/apiClient';
import { useAppSelector } from '../../../../src/store';
import { SpeakingTestProvider } from '../../../../src/contexts/SpeakingTestContext';
import SpeakingTestStudent from '../../../../src/components/test/SpeakingTestStudent';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';
import { markTestCompleted } from '../../../../src/utils/retestUtils';

export default function SpeakingTestScreen() {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const [studentId, setStudentId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [questionsData, setQuestionsData] = useState<any[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  // Helper function to decode JWT token and extract student ID
  const getStudentIdFromToken = async (): Promise<string | number | null> => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Speaking RN: token exists?', !!token);
      if (!token) return null;
      
      // Decode JWT token (simple base64 decode of payload)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('Speaking RN: invalid token format, parts:', parts.length);
        return null;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      console.log('Speaking RN: token payload:', payload);
      console.log('Speaking RN: payload.student_id:', payload.student_id);
      console.log('Speaking RN: payload.id:', payload.id);
      console.log('Speaking RN: payload.user_id:', payload.user_id);
      console.log('Speaking RN: payload.username:', payload.username);
      console.log('Speaking RN: payload.email:', payload.email);
      
      // Try multiple possible fields for student ID
      return payload.student_id || payload.id || payload.user_id || payload.username || payload.email || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Seeded random number generator (mulberry32) - copy web app exactly
  const mulberry32 = (a: number) => {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  };

  // Function to select a random question deterministically - copy web app exactly
  const selectRandomQuestion = (questions: any[], testId: string, studentId: string) => {
    // If only one question, return it
    if (questions.length === 1) {
      return questions[0];
    }
    
    // Create deterministic seed from student ID and test ID
    const seedStr = `${studentId}:speaking:${testId}`;
    const seed = Array.from(seedStr).reduce((acc, c) => 
      ((acc << 5) - acc) + c.charCodeAt(0), 0) >>> 0;
    
    // Use seeded RNG for consistent selection
    const rng = mulberry32(seed);
    const randomIndex = Math.floor(rng() * questions.length);
    
    return questions[randomIndex];
  };

  // Check if test is already completed (web app pattern)
  const checkTestCompleted = useCallback(async () => {
    if (!testId) return false;
    
    try {
      // Enhanced student ID extraction with multiple fallbacks (same as submission)
      let sid = await getStudentIdFromToken();
      
      if (!sid) {
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
        
        sid = userFromStorage?.student_id || userFromStorage?.id || userFromStorage?.user_id || userFromStorage?.username || userFromStorage?.email;
        console.log('Speaking RN completion check: userFromStorage:', userFromStorage);
        console.log('Speaking RN completion check: extracted studentId from storage:', sid);
      }
      
      if (!sid) {
        // Fallback to Redux state
        sid = user?.student_id || studentId;
        console.log('Speaking RN completion check: user from Redux:', user);
      }
      
      if (!sid) {
        console.log('Speaking RN completion check: No student ID available');
        return false; // Can't check completion without student ID
      }
      
      // Check for retest key first - if retest is available, allow access (web app pattern)
      const retestKey = `retest1_${sid}_speaking_${testId}`;
      const hasRetest = await AsyncStorage.getItem(retestKey);
      
      console.log('🎓 Speaking RN completion check:', {
        studentId: sid,
        retestKey,
        hasRetest
      });
      
      // If retest is available, allow access even if test is completed
      if (hasRetest === 'true') {
        console.log('🎓 Retest available - allowing access even if test is completed');
        return false; // Don't block retests
      }
      
      // Only check completion if no retest is available
      const completionKey = `test_completed_${sid}_speaking_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      
      console.log('🎓 Speaking RN completion check (no retest):', {
        studentId: sid,
        completionKey,
        isCompleted
      });
      
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
  }, [user?.student_id, studentId, testId]);

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

      // Ensure studentId is available (fallback to AsyncStorage)
      try {
        if (!user?.student_id) {
          // Enhanced student ID extraction with multiple fallbacks
          let studentId = '';
          
          // Try JWT token first
          try {
            const token = await AsyncStorage.getItem('auth_token');
            if (token) {
              const parts = token.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                studentId = payload.student_id || payload.id || payload.user_id || payload.username || payload.email || '';
              }
            }
          } catch (e) {
            console.log('JWT extraction failed:', e);
          }
          
          // Fallback to AsyncStorage
          if (!studentId) {
            const raw = await AsyncStorage.getItem('user');
            const parsed = raw ? JSON.parse(raw) : null;
            studentId = parsed?.student_id || parsed?.id || parsed?.user_id || parsed?.username || parsed?.email || '';
          }
          
          // Try auth_user key if still no ID
          if (!studentId) {
            const authUserRaw = await AsyncStorage.getItem('auth_user');
            const authUser = authUserRaw ? JSON.parse(authUserRaw) : null;
            studentId = authUser?.student_id || authUser?.id || authUser?.user_id || authUser?.username || authUser?.email || '';
          }
          
          if (studentId) setStudentId(String(studentId));
        } else {
          setStudentId(String(user.student_id));
        }
      } catch {}

      // Load test data - copy web app exactly
      const testResponse = await api.get('/api/get-speaking-test-new', { 
        params: { action: 'test', test_id: testId } 
      });

      if (!testResponse.data.success) {
        throw new Error(testResponse.data.error || testResponse.data.message || 'Failed to load speaking test');
      }

      const test = testResponse.data.test || testResponse.data.data;
      setTestData(test);
      
      // Load questions - copy web app exactly
      const questionsResponse = await api.get('/api/get-speaking-test-new', {
        params: { action: 'questions', test_id: testId }
      });

      if (!questionsResponse.data.success) {
        throw new Error(questionsResponse.data.error || 'Failed to load test questions');
      }

      const questionsData = questionsResponse.data.questions || [];
      setQuestionsData(questionsData);

      // Select question: prefer deterministic if we have a student id; otherwise first item.
      const sid = user?.student_id || studentId || 'unknown';
      if (questionsData.length > 0) {
        const randomQuestion = user?.student_id || studentId
          ? selectRandomQuestion(questionsData, testId, String(sid))
          : questionsData[0];
        setSelectedQuestion(randomQuestion);
      } else if (test?.prompt) {
        // Web sometimes shows prompt even if questions endpoint empty; synthesize a single question
        setSelectedQuestion({ id: 1, prompt: test.prompt });
      }

    } catch (e: any) {
      console.error('Failed to load speaking test:', e?.message);
      setError('Failed to load test. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [testId, checkTestCompleted, user?.student_id, studentId]);

  // Note: Recording and submission logic is now handled by the new SpeakingTestStudent component

  // Convert test data to new format
  const questions = selectedQuestion ? [{
    id: String(selectedQuestion.id || 1),
    question_text: testData?.prompt || selectedQuestion?.prompt || 'Please record your answer.',
    prompt: testData?.prompt || selectedQuestion?.prompt,
    min_words: testData?.min_words || 50,
    max_duration: testData?.max_duration || 600,
    expected_keywords: selectedQuestion?.expected_keywords || [],
  }] : [];

  const handleTestComplete = useCallback(async (results: any) => {
    try {
      // Mark test as completed using helper (web app pattern)
      if (user?.student_id) {
        await markTestCompleted(user.student_id, 'speaking', testId);
      }
      
      // Store result for caching (web app pattern)
      await AsyncStorage.setItem(`speaking_test_result_${testId}`, JSON.stringify(results));
      
      setTestResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Failed to complete test:', error);
      setError('Failed to complete test. Please try again.');
    }
  }, [user?.student_id, testId]);

  const handleAnswerChange = useCallback((questionId: string, answer: any) => {
    // Handle answer updates if needed
    console.log('Answer changed:', questionId, answer);
  }, []);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  if (loading) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center`}>
        <ActivityIndicator 
          size="large" 
          color={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#60a5fa' : '#2563eb'} 
        />
        <Text className={`text-base text-center mt-2 ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
          {themeMode === 'cyberpunk' ? 'LOADING TEST...' : 'Loading test...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center px-4`}>
        <Text className={`text-base text-center mb-4 ${themeMode === 'cyberpunk' ? 'text-red-400 tracking-wider' : 'text-red-600'}`}>
          {themeMode === 'cyberpunk' ? error.toUpperCase() : error}
        </Text>
        <TouchableOpacity 
          className={`py-3 px-6 rounded-lg ${themeMode === 'cyberpunk' 
            ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50' 
            : themeMode === 'dark' 
            ? 'bg-blue-600' 
            : 'bg-[#8B5CF6]'
          }`}
          onPress={loadTestData}
        >
          <Text className={`text-center font-semibold ${themeMode === 'cyberpunk' 
            ? 'text-black tracking-wider' 
            : 'text-white'
          }`}>
            {themeMode === 'cyberpunk' ? 'RETRY' : 'Retry'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showResults && testResults) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center px-4`}>
        <Text className={`text-3xl font-bold mb-4 ${themeClasses.text} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
          {themeMode === 'cyberpunk' ? 'TEST RESULTS' : 'Test Results'}
        </Text>
        <Text className={`text-xl mb-2 ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
          {themeMode === 'cyberpunk' ? 'SCORE:' : 'Score:'} {testResults.score || 0}/{testResults.maxScore || 1}
        </Text>
        <Text className={`text-lg mb-6 ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
          {themeMode === 'cyberpunk' ? 'PERCENTAGE:' : 'Percentage:'} {testResults.percentage || 0}%
        </Text>
        <TouchableOpacity 
          className={`py-3 px-6 rounded-lg ${themeMode === 'cyberpunk' 
            ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50' 
            : themeMode === 'dark' 
            ? 'bg-blue-600' 
            : 'bg-[#8B5CF6]'
          }`}
          onPress={() => router.back()}
        >
          <Text className={`text-center font-semibold ${themeMode === 'cyberpunk' 
            ? 'text-black tracking-wider' 
            : 'text-white'
          }`}>
            {themeMode === 'cyberpunk' ? 'BACK TO DASHBOARD' : 'Back to Dashboard'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!testData || !selectedQuestion) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center px-4`}>
        <Text className={`text-base text-center ${themeMode === 'cyberpunk' ? 'text-red-400 tracking-wider' : 'text-red-600'}`}>
          {themeMode === 'cyberpunk' ? 'NO TEST DATA AVAILABLE' : 'No test data available'}
        </Text>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      <SpeakingTestProvider>
        <SpeakingTestStudent
          testId={testId}
          testName={testData.test_name}
          questions={questions}
          onTestComplete={handleTestComplete}
          onAnswerChange={handleAnswerChange}
          studentId={String(user?.student_id || studentId)}
          showCorrectAnswers={false}
          themeMode={themeMode}
        />
      </SpeakingTestProvider>
    </View>
  );
}

