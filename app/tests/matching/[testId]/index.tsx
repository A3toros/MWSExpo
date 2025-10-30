/** @jsxImportSource nativewind */
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert, Image, Dimensions, AppState } from 'react-native';
import Svg, { Line, Polygon, G, Circle } from 'react-native-svg';
import { DraxProvider, DraxView } from 'react-native-drax';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSubmissionMethod } from '../../../../src/services/apiClient';
import { useAppSelector } from '../../../../src/store';
import TestHeader from '../../../../src/components/TestHeader';
import { SubmitModal } from '../../../../src/components/modals';
import { LoadingModal } from '../../../../src/components/modals/LoadingModal';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';

// Using Drax for drag and drop; no custom gesture math needed

export default function MatchingTestScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [words, setWords] = useState<any[]>([]);
  const [placedWords, setPlacedWords] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [imageRenderSize, setImageRenderSize] = useState<{ width: number; height: number } | null>(null);
  const imageContainerRef = useRef<View>(null);
  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [arrows, setArrows] = useState<any[]>([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false); // confirms submission
  const [visibilityChangeTimes, setVisibilityChangeTimes] = useState(0);
  const [caughtCheating, setCaughtCheating] = useState(false);
  const DEBUG_MATCHING = true;
  const DROP_MARGIN = 12;
  const DEBUG_SUBMIT = true;

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

  // Check if test is already completed (web app pattern)
  const checkTestCompleted = useCallback(async () => {
    if (!user?.student_id || !testId) return false;
    
    try {
      const completionKey = `test_completed_${user.student_id}_matching_type_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      const retestKey = `retest1_${user.student_id}_matching_type_${testId}`;
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

      // Load test information - copy web app exactly
      const testResponse = await api.get('/api/get-matching-type-test', { 
        params: { test_id: testId } 
      });

      if (!testResponse.data.success) {
        throw new Error(testResponse.data.error || testResponse.data.message || 'Failed to load test');
      }

      const test = testResponse.data.data;
      setTestData(test);
      // Set arrows from test payload (mirror web app) with robust parsing
      try {
        let parsedArrows: any[] = [];
        if (Array.isArray(test?.arrows)) {
          parsedArrows = test.arrows;
        } else if (typeof test?.arrows === 'string') {
          try {
            const maybe = JSON.parse(test.arrows);
            if (Array.isArray(maybe)) parsedArrows = maybe;
          } catch {}
        }
        setArrows(parsedArrows);
        if (DEBUG_MATCHING) {
          console.log('Matching RN: arrows parsed', { count: parsedArrows.length });
          try { console.log('Matching RN: first arrows sample', parsedArrows.slice(0, 2)); } catch {}
        }
      } catch {}
      if (DEBUG_MATCHING) {
        console.log('Matching RN: loaded test', {
          id: test?.id,
          hasArrows: Array.isArray(test?.arrows) ? test.arrows.length : 0,
          image: test?.image_url,
        });
      }
      // Preload natural image size to match web scaling
      if (test?.image_url) {
        Image.getSize(
          test.image_url,
          (w, h) => {
            setImageNaturalSize({ width: w, height: h });
            if (DEBUG_MATCHING) console.log('Matching RN: imageNaturalSize', { width: w, height: h });
          },
          () => {}
        );
      }
      
      // Load test questions - copy web app exactly
      const questionsResponse = await api.get('/api/get-test-questions', {
        params: { test_id: testId, test_type: 'matching_type' }
      });

      if (!questionsResponse.data.success) {
        throw new Error(questionsResponse.data.error || 'Failed to load test questions');
      }

      const questionsData = questionsResponse.data.questions || [];
      if (DEBUG_MATCHING) console.log('Matching RN: questions data len', questionsData.length);
      
      // Process the data exactly like the web app does
      if (questionsData.length > 0) {
        const question = questionsData[0];
        if (DEBUG_MATCHING) console.log('Matching RN: processing first question keys', Object.keys(question || {}));
        
        if (Array.isArray(question.blocks)) {
          // New format with blocks array - process exactly like web app
          const processedBlocks = question.blocks.map((block: any, idx: number) => {
            // Determine coordinates from various possible shapes (exactly like web app)
            let coords = block.block_coordinates || block.coordinates || (typeof block.x === 'number' ? { x: block.x, y: block.y, width: block.width, height: block.height } : null);
            if (typeof coords === 'string') {
              try { coords = JSON.parse(coords); } catch { coords = null; }
            }
            if (!coords || typeof coords !== 'object') {
              coords = { x: 0, y: 0, width: 30, height: 10 };
            }
            coords = {
              x: (typeof coords.x === 'number' ? coords.x : Number(coords.x)) || 0,
              y: (typeof coords.y === 'number' ? coords.y : Number(coords.y)) || 0,
              width: (typeof coords.width === 'number' ? coords.width : Number(coords.width)) || 30,
              height: (typeof coords.height === 'number' ? coords.height : Number(coords.height)) || 10
            };
            
            return {
              id: block.block_id || block.question_id || block.id || idx + 1,
              word: block.word || `Word ${idx + 1}`,
              coordinates: coords,
              hasArrow: !!block.has_arrow,
              arrow: block.arrow || null
            };
          });
          setBlocks(processedBlocks);
          setWords(processedBlocks);
          if (DEBUG_MATCHING) console.log('Matching RN: processed blocks(new format)', processedBlocks);
          // Derive arrows from blocks if not provided at test level
          try {
            if (Array.isArray(question.arrows)) {
              if (arrows.length === 0) setArrows(question.arrows);
            } else {
              const derived = processedBlocks
                .map((b: any) => b.arrow)
                .filter(Boolean);
              if (derived.length && arrows.length === 0) setArrows(derived as any[]);
            }
          } catch {}
        } else {
          // Legacy flat format - process exactly like web app
          const processedBlocks = questionsData.map((q: any, idx: number) => {
            let coordinates;
            try {
              coordinates = typeof q.block_coordinates === 'string' 
                ? JSON.parse(q.block_coordinates) 
                : q.block_coordinates;
            } catch {
              coordinates = { x: 0, y: 0, width: 100, height: 100 };
            }
            if (!coordinates || typeof coordinates !== 'object') {
              coordinates = { x: 0, y: 0, width: 100, height: 100 };
            }
            coordinates = {
              x: (typeof coordinates.x === 'number' ? coordinates.x : Number(coordinates.x)) || 0,
              y: (typeof coordinates.y === 'number' ? coordinates.y : Number(coordinates.y)) || 0,
              width: (typeof coordinates.width === 'number' ? coordinates.width : Number(coordinates.width)) || 100,
              height: (typeof coordinates.height === 'number' ? coordinates.height : Number(coordinates.height)) || 100
            };
            
            return {
              id: q.question_id || q.block_id || q.id || idx + 1,
              word: q.word || `Word ${idx + 1}`,
              coordinates: coordinates,
              hasArrow: q.has_arrow,
              arrow: q.arrow
            };
          });
          setBlocks(processedBlocks);
          setWords(processedBlocks);
          if (DEBUG_MATCHING) console.log('Matching RN: processed blocks(legacy)', processedBlocks);
          // Derive arrows from legacy questions if present
          try {
            const derived = questionsData
              .map((q: any) => q.arrow)
              .filter(Boolean);
            if (derived.length && arrows.length === 0) setArrows(derived as any[]);
          } catch {}
        }
      }
      
    } catch (e: any) {
      console.error('Failed to load matching test:', e?.message);
      setError('Failed to load test. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [testId, checkTestCompleted]);

  // Handle word placement - match web app logic
  const handleWordPlacement = useCallback((wordId: string | number, blockId: string | number) => {
    const key = String(blockId);
    const val = String(wordId);
    setPlacedWords(prev => ({
      ...prev,
      [key]: val,
    }));
  }, []);

  // Handle word tap to place in first available block
  const handleWordTap = useCallback((wordId: string) => {
    // Find first available block
    const availableBlock = blocks.find(block => !placedWords[block.id]);
    if (availableBlock) {
      handleWordPlacement(wordId, availableBlock.id);
    }
  }, [blocks, placedWords, handleWordPlacement]);

  // Reset all word placements
  const handleReset = useCallback(() => {
    setShowResetModal(true);
  }, []);

  // Confirm reset
  const confirmReset = useCallback(() => {
    setPlacedWords({});
    setShowResetModal(false);
    if (DEBUG_MATCHING) console.log('Matching RN: reset confirmed');
  }, []);

  // Cancel reset
  const cancelReset = useCallback(() => {
    setShowResetModal(false);
  }, []);

  // Check if rectangles overlap (like web app)
  const rectsOverlap = useCallback((r1: any, r2: any) => {
    return !(
      r2.x > r1.x + r1.width ||
      r2.x + r2.width < r1.x ||
      r2.y > r1.y + r1.height ||
      r2.y + r2.height < r1.y
    );
  }, []);

  // Drax handles drop detection; we only place on receive

  // Submit test
  const submitTest = useCallback(async () => {
    if (!testData) return;

    // Show confirmation dialog before submitting
    if (DEBUG_SUBMIT) {
      console.log('Matching RN: submit pressed', {
        blocks: blocks.map(b => b.id),
        placedWords,
        placedCount: Object.keys(placedWords).length,
        required: blocks.length,
        isAllPlaced: blocks.every(b => placedWords[String(b.id)]),
      });
    }
    setShowSubmitModal(true);
  }, [user?.student_id, testData, blocks, placedWords, testId]);

  // Actual submit function
  const performSubmit = useCallback(async () => {
    if (!testData) return;

    setIsSubmitting(true);
    try {
      // Simple student ID extraction: JWT -> auth_user -> user
      let studentId: any = user?.student_id;
      if (!studentId) {
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              studentId = payload.student_id || payload.id || null;
            }
          }
        } catch {}
      }
      if (!studentId) {
        try {
          const authUserStr = await AsyncStorage.getItem('auth_user');
          const authUser = authUserStr ? JSON.parse(authUserStr) : null;
          studentId = authUser?.student_id || authUser?.id || null;
        } catch {}
      }
      if (!studentId) {
        try {
          const userStr = await AsyncStorage.getItem('user');
          const u = userStr ? JSON.parse(userStr) : null;
          studentId = u?.student_id || u?.id || null;
        } catch {}
      }
      if (!studentId) {
        Alert.alert('Error', 'Missing student ID');
        return;
      }
      if (DEBUG_SUBMIT) console.log('Matching RN: performSubmit start', { studentId, testId });
      
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
      
      // Calculate score like web app
      let correctPlacements = 0;
      blocks.forEach(block => {
        const placedWordId = placedWords[String(block.id)];
        if (placedWordId) {
          const placedWord = words.find(word => String(word.id) === String(placedWordId));
          if (placedWord && placedWord.word === block.word) {
            correctPlacements++;
          }
        }
      });
      
      const submissionData = {
        test_id: parseInt(testId),
        test_name: testData.test_name,
        teacher_id: testData.teacher_id,
        subject_id: testData.subject_id,
        student_id: studentId,
        academic_period_id: academic_period_id,
        answers: placedWords,
        score: correctPlacements,
        maxScore: blocks.length,
        time_taken: 0, // TODO: Add timer like web app
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: caughtCheating,
        visibility_change_times: visibilityChangeTimes,
        retest_assignment_id: null, // TODO: Get from AsyncStorage like web app
        parent_test_id: parseInt(testId)
      };
      if (DEBUG_SUBMIT) console.log('Matching RN: submission payload', submissionData);

      const submitMethod = getSubmissionMethod('matching_type');
      const response = await submitMethod(submissionData);
      if (DEBUG_SUBMIT) console.log('Matching RN: submission response', response?.data);
      
      if (response.data.success) {
        // Mark test as completed (web app pattern)
        const completionKey = `test_completed_${studentId}_matching_type_${testId}`;
        await AsyncStorage.setItem(completionKey, 'true');
        
        // Cache the test results immediately after successful submission (web app pattern)
        const cacheKey = `student_results_table_${studentId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
        console.log('🎓 Test results cached with key:', cacheKey);
        
        // Clear retest key if it exists
        const retestKey = `retest1_${studentId}_matching_type_${testId}`;
        await AsyncStorage.removeItem(retestKey);
        
        // Clear retest assignment key if it exists
        const retestAssignKey = `retest_assignment_id_${studentId}_matching_type_${testId}`;
        await AsyncStorage.removeItem(retestAssignKey);
        
        // Clear progress key (like input test)
        const progressKey = `test_progress_${studentId}_matching_type_${testId}`;
        await AsyncStorage.removeItem(progressKey);
        
        setTestResults(response.data);
        setShowResults(true);
      } else {
        if (DEBUG_SUBMIT) console.log('Matching RN: submission failed payload', response?.data);
        throw new Error(response.data.message || response.data.error || 'Failed to submit test');
      }
    } catch (e: any) {
      console.error('Failed to submit test:', e?.message);
      if (DEBUG_SUBMIT) console.log('Matching RN: submission error data', e?.response?.data);
      Alert.alert('Error', 'Failed to submit test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.student_id, testId, testData, blocks, placedWords]);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  // Anti-cheating tracking (like web app)
  useEffect(() => {
    const loadAntiCheatingData = async () => {
      try {
        const storageKey = `anti_cheating_matching_type_${testId}`;
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
          const storageKey = `anti_cheating_matching_type_${testId}`;
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

  if (loading) {
    return (
      <View className={`flex-1 justify-center items-center ${themeClasses.background}`}>
        <ActivityIndicator size="large" color={themeMode === 'cyberpunk' ? '#00ffff' : themeMode === 'dark' ? '#3b82f6' : '#3B82F6'} />
        <Text className={`mt-4 text-base text-center ${themeClasses.textSecondary}`}>
          {themeMode === 'cyberpunk' ? 'LOADING TEST...' : 'Loading test...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 justify-center items-center px-4 ${themeClasses.background}`}>
        <Text className={`text-base text-center mb-5 ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-600'}`}>{error}</Text>
        <TouchableOpacity 
          className={`${themeMode === 'cyberpunk' ? 'bg-black border border-cyan-400/30' : themeMode === 'dark' ? 'bg-blue-600' : 'bg-blue-500'} px-6 py-3 rounded-lg`}
          onPress={loadTestData}
        >
          <Text className={`${themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : 'text-white'} text-base font-semibold`}>{themeMode === 'cyberpunk' ? 'RETRY' : 'Retry'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showResults && testResults) {
    const { score, maxScore, percentage, passed } = testResults;
    const isPassed = typeof passed === 'boolean' ? passed : ((percentage || 0) >= 60);
    
    return (
      <View className={`flex-1 ${themeClasses.background}`}>
        <ScrollView className="flex-1">
          {/* Header */}
          <View className={`rounded-xl p-6 mb-4 shadow-sm border ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <Text className="text-3xl font-bold text-gray-800 mb-2">Test Results</Text>
            <Text className="text-xl text-gray-600 mb-1">{testData?.test_name || 'Test'}</Text>
            <Text className="text-sm text-gray-500 mb-4">Matching • Completed on {new Date().toLocaleDateString()}</Text>
            
            {/* Pass/Fail Status */}
            <View className={`self-start px-4 py-2 rounded-full border ${isPassed ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
              <Text className={`text-sm font-semibold ${isPassed ? 'text-green-800' : 'text-red-800'}`}>
                {isPassed ? '✓ PASSED' : '✗ FAILED'}
              </Text>
            </View>
          </View>

          {/* Score Summary */}
          <View className={`rounded-xl p-5 mb-4 shadow-sm border ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-3xl font-bold text-gray-800 mb-1">{score || 0}</Text>
                <Text className="text-sm text-gray-500">Correct Answers</Text>
              </View>
              <View className="items-center">
                <Text className="text-3xl font-bold text-gray-800 mb-1">{maxScore || blocks.length}</Text>
                <Text className="text-sm text-gray-500">Total Questions</Text>
              </View>
              <View className="items-center">
                <Text className={`text-3xl font-bold mb-1 ${percentage >= 80 ? 'text-green-500' : percentage >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {percentage || 0}%
                </Text>
                <Text className="text-sm text-gray-500">Score</Text>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View className={`rounded-xl p-5 mb-4 shadow-sm border ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <View className="h-3 bg-gray-200 rounded-lg overflow-hidden">
              <View 
                className="h-full rounded-lg"
                style={{ 
                  width: `${percentage || 0}%`,
                  backgroundColor: percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444'
                }}
              />
            </View>
          </View>

          {/* Question Analysis for Matching Test */}
          <View className={`rounded-xl p-5 mb-4 shadow-sm border ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <Text className={`text-xl font-bold mb-4 ${
              themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-800'
            }`}>
              {themeMode === 'cyberpunk' ? 'QUESTION REVIEW' : 'Question Review'}
            </Text>
            
            {blocks.map((block, index) => {
              const placedWordId = placedWords[String(block.id)];
              const placedWord = words.find(w => String(w.id) === String(placedWordId));
              const isCorrect = placedWord && placedWord.word === block.word;
              
              return (
                <View key={block.id} className={`p-4 rounded-lg mb-3 border-2 ${
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
                  
                  <View className="mb-3">
                    <Text className={`text-sm font-semibold mb-1 ${
                      themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-600'
                    }`}>
                      {themeMode === 'cyberpunk' ? 'BLOCK:' : 'Block:'}
                    </Text>
                    <Text className={`text-sm p-3 rounded-md ${
                      themeMode === 'cyberpunk' ? 'text-cyan-200 bg-black border border-cyan-400/30' : themeMode === 'dark' ? 'text-gray-300 bg-gray-700' : 'text-gray-500 bg-gray-100'
                    }`}>
                      {block.word}
                    </Text>
                  </View>
                  
                  <View className="flex-row gap-3">
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
                        {placedWord?.word || (themeMode === 'cyberpunk' ? 'NOT ANSWERED' : 'Not answered')}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm font-semibold mb-1 ${
                        themeMode === 'cyberpunk' ? 'text-cyan-300 tracking-wider' : themeMode === 'dark' ? 'text-white' : 'text-gray-600'
                      }`}>
                        {themeMode === 'cyberpunk' ? 'CORRECT ANSWER:' : 'Correct Answer:'}
                      </Text>
                      <Text className={`text-sm p-3 rounded-md ${
                        themeMode === 'cyberpunk' ? 'bg-blue-900/30 text-blue-400 border border-blue-400/30' : themeMode === 'dark' ? 'bg-blue-800 text-blue-300' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {block.word}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Summary Statistics */}
          <View className={`rounded-xl p-5 mb-4 shadow-sm border ${
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
                  {blocks.filter((_, i) => {
                    const placedWordId = placedWords[String(blocks[i].id)];
                    const placedWord = words.find(w => String(w.id) === String(placedWordId));
                    return placedWord && placedWord.word === blocks[i].word;
                  }).length}
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
                  {blocks.filter((_, i) => {
                    const placedWordId = placedWords[String(blocks[i].id)];
                    const placedWord = words.find(w => String(w.id) === String(placedWordId));
                    return !(placedWord && placedWord.word === blocks[i].word);
                  }).length}
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
                  {percentage || 0}%
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
                  {blocks.length}
                </Text>
                <Text className={`text-xs ${
                  themeMode === 'cyberpunk' ? 'text-purple-400' : themeMode === 'dark' ? 'text-purple-300' : 'text-purple-600'
                }`}>
                  {themeMode === 'cyberpunk' ? 'TOTAL' : 'Total'}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className={`rounded-xl p-5 shadow-sm border ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <TouchableOpacity 
              className={`px-6 py-3 rounded-lg ${
                themeMode === 'cyberpunk' 
                  ? 'bg-black border border-cyan-400/30' 
                  : themeMode === 'dark' 
                  ? 'bg-blue-600' 
                  : 'bg-blue-500'
              }`}
              onPress={() => router.back()}
            >
              <Text className={`text-base font-semibold text-center ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : 'text-white'
              }`}>
                {themeMode === 'cyberpunk' ? '← BACK TO DASHBOARD' : '← Back to Dashboard'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!testData || !blocks.length) {
    return (
      <View className={`flex-1 justify-center items-center px-4 ${themeClasses.background}`}>
        <Text className={`text-base text-center ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-600'}`}>No test data available</Text>
      </View>
    );
  }

  const isAllPlaced = blocks.length > 0 && blocks.every(block => placedWords[String(block.id)]);
  if (DEBUG_MATCHING) {
    try {
      console.log('Matching RN: render submit state', {
        placedCount: Object.keys(placedWords).length,
        blocksCount: blocks.length,
        isAllPlaced,
      });
    } catch {}
  }

  // Helpers to convert percentage string to pixels relative to natural size
  const parseCoord = (val: any, total: number): number => {
    if (typeof val === 'string' && val.trim().endsWith('%')) {
      const num = Number(val.trim().slice(0, -1));
      if (!isNaN(num)) return (num / 100) * total;
    }
    const n = typeof val === 'number' ? val : Number(val);
    return isNaN(n) ? 0 : n;
  };

  const getScaledCoords = (coord: any) => {
    const nat = imageNaturalSize;
    const ren = imageRenderSize;
    if (!coord || !nat || !ren || nat.width === 0 || nat.height === 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    // Backup logic: scale natural-space rect directly into render-space, no centering offsets
    const natX = parseCoord(coord.x, nat.width);
    const natY = parseCoord(coord.y, nat.height);
    const natW = parseCoord(coord.width, nat.width);
    const natH = parseCoord(coord.height, nat.height);
    const scaleX = ren.width / nat.width;
    const scaleY = ren.height / nat.height;
    return {
      left: natX * scaleX,
      top: natY * scaleY,
      width: natW * scaleX,
      height: natH * scaleY,
    };
  };

  const toNum = (v: any): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return isNaN(n) ? 0 : n;
  };

  const getArrowPoints = (arrow: any) => {
    const ren = imageRenderSize;
    const nat = imageNaturalSize;
    if (!ren) return null;

    const color = arrow?.style?.color || '#dc3545';
    const thickness = arrow?.style?.thickness || 3;

    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

    const hasRel = arrow?.rel_start_x != null && arrow?.rel_start_y != null && arrow?.rel_end_x != null && arrow?.rel_end_y != null;
    const hasStartEndScalars = (arrow?.start_x != null && arrow?.start_y != null && arrow?.end_x != null && arrow?.end_y != null);

    if (hasRel) {
      // Percent-based to render size (backup logic)
      x1 = (toNum(arrow.rel_start_x) / 100) * ren.width;
      y1 = (toNum(arrow.rel_start_y) / 100) * ren.height;
      x2 = (toNum(arrow.rel_end_x) / 100) * ren.width;
      y2 = (toNum(arrow.rel_end_y) / 100) * ren.height;
    } else if (hasStartEndScalars) {
      const sx = toNum(arrow.start_x);
      const sy = toNum(arrow.start_y);
      const ex = toNum(arrow.end_x);
      const ey = toNum(arrow.end_y);
      if (nat?.width && nat?.height) {
        const scaleX = ren.width / nat.width;
        const scaleY = ren.height / nat.height;
        const alreadyRenderSpace = sx <= ren.width + 1 && ex <= ren.width + 1 && sy <= ren.height + 1 && ey <= ren.height + 1;
        if (alreadyRenderSpace) {
          x1 = sx; y1 = sy; x2 = ex; y2 = ey;
        } else {
          x1 = sx * scaleX; y1 = sy * scaleY; x2 = ex * scaleX; y2 = ey * scaleY;
        }
      } else {
        x1 = sx; y1 = sy; x2 = ex; y2 = ey;
      }
    } else if (arrow?.start && arrow?.end) {
      const sx = toNum(arrow.start.x);
      const sy = toNum(arrow.start.y);
      const ex = toNum(arrow.end.x);
      const ey = toNum(arrow.end.y);
      if (nat?.width && nat?.height) {
        const scaleX = ren.width / nat.width;
        const scaleY = ren.height / nat.height;
        const alreadyRenderSpace = sx <= ren.width + 1 && ex <= ren.width + 1 && sy <= ren.height + 1 && ey <= ren.height + 1;
        if (alreadyRenderSpace) {
          x1 = sx; y1 = sy; x2 = ex; y2 = ey;
        } else {
          x1 = sx * scaleX; y1 = sy * scaleY; x2 = ex * scaleX; y2 = ey * scaleY;
        }
      } else {
        x1 = sx; y1 = sy; x2 = ex; y2 = ey;
      }
    } else {
      return null;
    }

    return { x1, y1, x2, y2, color, thickness };
  };

  const getArrowHeadPoints = (x1: number, y1: number, x2: number, y2: number, size = 10, headWidth = 10) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const baseX = x2 - size * Math.cos(angle);
    const baseY = y2 - size * Math.sin(angle);
    const leftX = baseX + (headWidth / 2) * Math.sin(angle);
    const leftY = baseY - (headWidth / 2) * Math.cos(angle);
    const rightX = baseX - (headWidth / 2) * Math.sin(angle);
    const rightY = baseY + (headWidth / 2) * Math.cos(angle);
    return `${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`;
  };

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      <TestHeader 
        testName={testData.test_name}
      />
      <ScrollView className="flex-1">
        <Text className="text-base text-gray-600 text-center px-4 py-4">Drag words to the correct blocks on the image</Text>

        {/* Progress Tracker */}
        <ProgressTracker
          answeredCount={Object.keys(placedWords).length}
          totalQuestions={blocks.length}
          percentage={blocks.length > 0 ? Math.round((Object.keys(placedWords).length / blocks.length) * 100) : 0}
          timeElapsed={0} // TODO: Add timer
          onSubmitTest={submitTest}
          isSubmitting={isSubmitting}
          canSubmit={isAllPlaced}
        />

        <DraxProvider>
        <View className="flex-1 p-5">
        {/* Test Image */}
        {testData.image_url && (
          <View
            ref={imageContainerRef}
            className={`relative mb-5 rounded-xl overflow-hidden shadow-lg border mx-2 ${
              themeMode === 'cyberpunk' 
                ? 'bg-black border-cyan-400/30' 
                : themeMode === 'dark' 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}
            style={{ padding: 0 }}
          >
            <Image
              source={{ uri: testData.image_url }}
              className="w-full"
              style={{ 
                resizeMode: 'contain',
                height: Dimensions.get('window').height * 0.5, // 50% of screen height
                minHeight: 400,
                maxHeight: 600
              }}
              onLoad={() => setImageLoaded(true)}
              onLayout={(e) => {
                const { width, height, x, y } = e.nativeEvent.layout;
                setImageRenderSize({ width, height });
                setImageOffset({ x, y });
                if (DEBUG_MATCHING) console.log('Matching RN: imageRenderSize', { width, height, x, y });
              }}
              onError={() => setError('Failed to load test image')}
            />
            
            {/* Render blocks on the image */}
            {imageLoaded && imageRenderSize && blocks.map((block, index) => {
              const coordinates = block.coordinates;
              const scaled = getScaledCoords(coordinates);
              const isPlaced = placedWords[String(block.id)];
              const placedWord = isPlaced ? words.find(w => String(w.id) === String(isPlaced)) : null;
              
              return (
                <DraxView
                  key={block.id || `block-${index}`}
                  style={[
                    {
                      position: 'absolute',
                      left: scaled.left - DROP_MARGIN,
                      top: scaled.top - DROP_MARGIN,
                      width: scaled.width + DROP_MARGIN * 2,
                      height: scaled.height + DROP_MARGIN * 2,
                    },
                  ]}
                  receptive
                  onReceiveDragDrop={({ dragged }) => {
                    const wid = String(dragged?.payload?.wordId ?? dragged?.payload);
                    if (DEBUG_MATCHING) console.log('Matching RN: drop on block', block.id, 'word', wid);
                    setPlacedWords(prev => ({ ...prev, [String(block.id)]: wid }));
                  }}
                >
                  <View
                    style={[
                      {
                        position: 'absolute',
                        left: DROP_MARGIN,
                        top: DROP_MARGIN,
                        width: scaled.width,
                        height: scaled.height,
                        borderWidth: 2,
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.15)',
                        borderRadius: 6,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                      isPlaced ? {
                        backgroundColor: 'rgba(40, 167, 69, 0.4)',
                        borderColor: '#28a745',
                        shadowColor: 'rgba(40, 167, 69, 0.3)',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.5,
                        shadowRadius: 10,
                        elevation: 4,
                      } : null,
                    ]}
                  >
                    {isPlaced && (
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: themeMode === 'cyberpunk' ? '#E0FFFF' : (themeMode === 'dark' ? '#FFFFFF' : '#111827'),
                        textAlign: 'center',
                        position: 'absolute',
                        top: '50%',
                        left: 5,
                        right: 5,
                        transform: [{ translateY: -10 }],
                        height: 20,
                        lineHeight: 20,
                        fontFamily: 'Arial',
                      }}>
                        {placedWord?.word ?? ''}
                      </Text>
                    )}
                  </View>
                </DraxView>
              );
            })}

            {/* Render arrows overlay using SVG */}
            {imageRenderSize && (
              <Svg
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, top: 0, zIndex: 2 }}
                width={imageRenderSize.width}
                height={imageRenderSize.height}
                viewBox={`0 0 ${imageRenderSize.width} ${imageRenderSize.height}`}
              >
                {/* Debug guide line to verify overlay renders */}
                {/* Debug diagonals removed */}
                {DEBUG_MATCHING ? (() => { try { console.log('Matching RN: drawing arrows overlay', { width: imageRenderSize.width, height: imageRenderSize.height, arrows: (arrows||[]).length }); } catch {}; return null; })() : null}
                {(() => {
                  let currentArrows: any[] = Array.isArray(arrows) && arrows.length ? arrows : [];
                  if (!currentArrows.length) {
                    try {
                      if (Array.isArray(testData?.arrows)) currentArrows = testData.arrows;
                      else if (typeof testData?.arrows === 'string') {
                        const maybe = JSON.parse(testData.arrows);
                        if (Array.isArray(maybe)) currentArrows = maybe;
                      }
                    } catch {}
                  }
                  if (DEBUG_MATCHING) {
                    try { console.log('Matching RN: using arrows for render', { count: currentArrows.length }); } catch {}
                  }
                  return currentArrows;
                })().map((arrow, idx) => {
                  const pts = getArrowPoints(arrow);
                  if (DEBUG_MATCHING && idx === 0) {
                    try { console.log('Matching RN: first arrow mapped points', pts); } catch {}
                  }
                  if (pts) {
                    const head = getArrowHeadPoints(pts.x1, pts.y1, pts.x2, pts.y2, 10, 10);
                    return (
                      <G key={`arrow-group-${idx}`}>
                        <Line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2} stroke={pts.color} strokeWidth={pts.thickness} strokeOpacity={1} />
                        <Polygon points={head} fill={pts.color} />
                        <Circle cx={pts.x1} cy={pts.y1} r={3} fill={pts.color} />
                        <Circle cx={pts.x2} cy={pts.y2} r={3} fill={pts.color} />
                      </G>
                    );
                  }
                  // Fallback: draw magenta using raw coords scaled by natural->render size
                  const sx = Number(arrow?.start_x ?? arrow?.start?.x);
                  const sy = Number(arrow?.start_y ?? arrow?.start?.y);
                  const ex = Number(arrow?.end_x ?? arrow?.end?.x);
                  const ey = Number(arrow?.end_y ?? arrow?.end?.y);
                  if (
                    imageNaturalSize &&
                    [sx, sy, ex, ey].every(v => typeof v === 'number' && !isNaN(v))
                  ) {
                    const x1 = (sx / imageNaturalSize.width) * imageRenderSize.width;
                    const y1 = (sy / imageNaturalSize.height) * imageRenderSize.height;
                    const x2 = (ex / imageNaturalSize.width) * imageRenderSize.width;
                    const y2 = (ey / imageNaturalSize.height) * imageRenderSize.height;
                    if (DEBUG_MATCHING && idx === 0) {
                      try { console.log('Matching RN: fallback points', { x1, y1, x2, y2 }); } catch {}
                    }
                    return (
                      <G key={`arrow-fallback-${idx}`}>
                        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={'#ff00ff'} strokeWidth={3} strokeOpacity={1} />
                        <Circle cx={x1} cy={y1} r={3} fill={'#ff00ff'} />
                        <Circle cx={x2} cy={y2} r={3} fill={'#ff00ff'} />
                      </G>
                    );
                  }
                  if (DEBUG_MATCHING) console.log('Matching RN: arrow ignored (no usable coords)', arrow);
                  return null;
                })}
              </Svg>
            )}
          </View>
        )}

        {/* Word bank */}
        <View className={`rounded-xl p-4 shadow-lg border ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-200'
        }`}>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-gray-800">Word Bank - Drag words to blocks</Text>
            <TouchableOpacity
              onPress={handleReset}
              className="bg-orange-500 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-semibold text-sm">Reset</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {words.map((word, index) => {
              const isPlaced = Object.values(placedWords).includes(String(word.id));
              
              // Don't render words that are already placed (like web app)
              if (isPlaced) {
                return null;
              }
              
              return (
                <DraxView
                  key={`word-${String(word.id)}`}
                  draggable
                  payload={{ wordId: String(word.id) }}
                  className="bg-gray-100 px-5 py-3 rounded-full border-2 border-gray-300"
                  style={{
                    minWidth: 80,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  draggingStyle={{
                    backgroundColor: '#fef3c7',
                    borderColor: '#f59e0b',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                    transform: [{ scale: 1.05 }],
                  }}
                  dragReleasedStyle={{
                    backgroundColor: '#f3f4f6',
                    borderColor: '#d1d5db',
                    transform: [{ scale: 1.0 }],
                  }}
                >
                  <Text className={`text-base font-semibold ${
                    themeMode === 'cyberpunk' ? 'text-cyan-200' : (themeMode === 'dark' ? 'text-white' : 'text-gray-900')
                  }`}>{word.word}</Text>
                </DraxView>
              );
            })}
          </View>
        </View>
      </View>
      </DraxProvider>

      <View className={`p-5 border-t ${
        themeMode === 'cyberpunk' 
          ? 'bg-black border-cyan-400/30' 
          : themeMode === 'dark' 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-white border-gray-200'
      }`}>
        {themeMode === 'cyberpunk' ? (
          <TouchableOpacity onPress={submitTest} disabled={!isAllPlaced || isSubmitting} style={{ alignSelf: 'center' }}>
            <Image 
              source={require('../../../../assets/images/save-cyberpunk.png')} 
              style={{ width: 40, height: 40 }} 
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className={`py-3 px-6 rounded-lg ${
              (!isAllPlaced || isSubmitting) 
                ? 'bg-gray-400' 
                : 'bg-green-500'
            }`}
            onPress={submitTest}
            disabled={!isAllPlaced || isSubmitting}
          >
            <Text className="text-white text-center font-semibold">
              {isSubmitting ? 'Submitting...' : 'Submit Test'}
            </Text>
          </TouchableOpacity>
        )}
        </View>
      </ScrollView>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <View className="absolute inset-0 bg-black bg-opacity-50 justify-center items-center z-50">
          <View className={`rounded-xl p-6 mx-4 shadow-xl ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <Text className="text-xl font-bold text-gray-800 mb-4 text-center">Reset Test</Text>
            <Text className="text-gray-600 mb-6 text-center">
              Are you sure you want to reset all word placements? This action cannot be undone.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={cancelReset}
                className="flex-1 bg-gray-300 py-3 rounded-lg"
              >
                <Text className="text-gray-700 text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmReset}
                className="flex-1 bg-orange-500 py-3 rounded-lg"
              >
                <Text className="text-white text-center font-semibold">Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Submit Confirmation Modal */}
      <SubmitModal
        visible={showSubmitModal}
        onConfirm={() => {
          setShowSubmitModal(false);
          performSubmit();
        }}
        onCancel={() => setShowSubmitModal(false)}
        testName={testData?.test_name || 'Test'}
      />

      <LoadingModal visible={isSubmitting} message={themeMode === 'cyberpunk' ? 'SUBMITTING…' : 'Submitting…'} />

      {/* No back modal; navigate directly */}
    </View>
  );
}