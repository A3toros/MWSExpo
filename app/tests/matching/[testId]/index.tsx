/** @jsxImportSource nativewind */
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert, Image, Dimensions, AppState } from 'react-native';
import Svg, { Line, Polygon, G, Circle } from 'react-native-svg';
import { DraxProvider, DraxView } from 'react-native-drax';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSubmissionMethod } from '../../../../src/services/apiClient';
import { useAppSelector } from '../../../../src/store';
import TestHeader from '../../../../src/components/TestHeader';
import ExamTestHeader from '../../../../src/components/ExamTestHeader';
import { useExamTimer } from '../../../../src/hooks/useExamTimer';
import { SubmitModal } from '../../../../src/components/modals';
import { LoadingModal } from '../../../../src/components/modals/LoadingModal';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import { getRetestAssignmentId, markTestCompleted } from '../../../../src/utils/retestUtils';
import { useAntiCheatingDetection } from '../../../../src/hooks/useAntiCheatingDetection';
import { useExamNavigation } from '../../../../src/hooks/useExamNavigation';
import ExamNavFooter from '../../../../src/components/ExamNavFooter';

// Using Drax for drag and drop; no custom gesture math needed

export default function MatchingTestScreen() {
  const { testId, exam, examId } = useLocalSearchParams<{ testId: string; exam?: string; examId?: string }>();
  const inExamContext = useMemo(() => exam === '1' && !!examId, [exam, examId]);
  const submitAllowed = !inExamContext;
  const showExamNav = inExamContext && !!examId;
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
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [studentId, setStudentId] = useState<string | null>(null);

  // Prefill placedWords/arrows from cached exam data when in exam context
  useEffect(() => {
    if (!showExamNav || !studentId || !examId || !testId) return;
    const key = `exam_answer_${studentId}_${examId}_${testId}_matching_type`;
    const preloaded = cachedAnswers?.[key];
    if (preloaded) {
      if (preloaded.placedWords) setPlacedWords(preloaded.placedWords);
      if (preloaded.placedWordsHistory) setPlacedWordsHistory(preloaded.placedWordsHistory);
      if (preloaded.arrows) setArrows(preloaded.arrows);
      return;
    }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.placedWords) setPlacedWords(parsed.placedWords);
          if (parsed?.placedWordsHistory) setPlacedWordsHistory(parsed.placedWordsHistory);
          if (parsed?.arrows) setArrows(parsed.arrows);
        }
      } catch {
        // ignore
      }
    })();
  }, [showExamNav, studentId, examId, testId, cachedAnswers]);

  // Anti-cheating detection hook
  const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId || ''));
  const { caughtCheating, visibilityChangeTimes, clearCheatingKeys, textInputProps } = useAntiCheatingDetection({
    studentId: studentId || '',
    testType: 'matching_type',
    testId: testIdStr,
    enabled: !!studentId && !!testId && !inExamContext,
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
    currentTestType: 'matching_type',
    enabled: showExamNav,
    studentId,
  });
  const examTimeRemaining = useExamTimer({ examId, studentId, totalMinutes });
  
  // Timer refs to prevent re-initialization
  const timerInitializedRef = useRef<boolean>(false);
  const performSubmitRef = useRef<() => Promise<void>>();
  const remainingTimeRef = useRef<number>(0);
  const timerStartedAtRef = useRef<string>('');
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
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
  // IMPORTANT: Allow retests even if test is marked as completed
  const checkTestCompleted = useCallback(async () => {
    if (!testId) return false;
    
    try {
      // Enhanced student ID extraction with multiple fallbacks (same as other tests)
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
        console.warn('Student ID not found - cannot check completion');
        return false; // Allow test if we can't check
      }
      
      // Check for retest key first - if retest is available, allow access (web app pattern)
      const retestKey = `retest1_${studentId}_matching_type_${testId}`;
      const hasRetest = await AsyncStorage.getItem(retestKey);
      
      // If retest is available, allow access even if test is completed
      if (hasRetest === 'true') {
        console.log('🎓 Retest available - allowing access even if test is completed');
        return false; // Don't block retests
      }
      
      // Only check completion if no retest is available
      const completionKey = `test_completed_${studentId}_matching_type_${testId}`;
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
      console.log('📊 [MATCHING TEST DATA]', {
        test_id: test?.id || test?.test_id,
        test_name: test?.test_name,
        allowed_time: test?.allowed_time,
        time_limit: test?.time_limit,
        enableTimer: test?.enableTimer,
        timerMinutes: test?.timerMinutes,
        allKeys: Object.keys(test || {})
      });
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

  // Persist answers into exam-level key when in exam context
  useEffect(() => {
    if (!inExamContext || !studentId || !examId || !testId) return;
    const payload = { placedWords, arrows };
    const key = `exam_answer_${studentId}_${examId}_${testId}_matching_type`;
    AsyncStorage.setItem(key, JSON.stringify(payload)).catch(() => {});
  }, [arrows, examId, inExamContext, placedWords, studentId, testId]);

  // Handle word placement - match web app logic
  const handleWordPlacement = useCallback((wordId: string | number, blockId: string | number) => {
    const key = String(blockId);
    const val = String(wordId);
    setPlacedWords(prev => {
      const updated = {
        ...prev,
        [key]: val,
      };
      // Auto-save progress
      if (studentId) {
        const progressKey = `test_progress_${studentId}_matching_type_${testId}`;
        AsyncStorage.setItem(progressKey, JSON.stringify({
          placedWords: updated,
          savedAt: new Date().toISOString()
        })).catch(e => console.error('Auto-save failed:', e));
      }
      return updated;
    });
  }, [studentId, testId]);

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
    // Clear saved progress
    if (studentId) {
      const progressKey = `test_progress_${studentId}_matching_type_${testId}`;
      AsyncStorage.removeItem(progressKey).catch(e => console.error('Failed to clear progress:', e));
    }
    setShowResetModal(false);
    if (DEBUG_MATCHING) console.log('Matching RN: reset confirmed');
  }, [studentId, testId]);

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
      
      // Build answers object with ALL blocks - use null for unanswered blocks (like other tests)
      const answers: Record<string, string | null> = {};
      blocks.forEach(block => {
        const blockId = String(block.id);
        const placedWordId = placedWords[blockId];
        // Include null for blocks without words placed (unanswered)
        // Convert to string if it's a number, otherwise use null
        answers[blockId] = placedWordId ? String(placedWordId) : null;
      });
      
      // Get retest_assignment_id from AsyncStorage if this is a retest (web app pattern)
      const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
      const retestAssignmentId = await getRetestAssignmentId(studentId, 'matching_type', testIdStr);
      
      const submissionData = {
        test_id: parseInt(testId),
        test_name: testData.test_name,
        teacher_id: testData.teacher_id,
        subject_id: testData.subject_id,
        student_id: studentId,
        academic_period_id: academic_period_id,
        answers: answers,
        score: correctPlacements,
        maxScore: blocks.length,
        time_taken: timeElapsed,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: caughtCheating,
        visibility_change_times: visibilityChangeTimes,
        retest_assignment_id: retestAssignmentId,
        parent_test_id: parseInt(testId)
      };
      if (DEBUG_SUBMIT) console.log('Matching RN: submission payload', submissionData);

      const submitMethod = getSubmissionMethod('matching_type');
      const response = await submitMethod(submissionData);
      if (DEBUG_SUBMIT) console.log('Matching RN: submission response', response?.data);
      
      if (response.data.success) {
        // Clear anti-cheating keys on successful submission
        await clearCheatingKeys();
        
        // Mark test as completed and clear retest keys (web app pattern)
        const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
        await markTestCompleted(studentId, 'matching_type', testIdStr);
        
        // Cache the test results immediately after successful submission (web app pattern)
        const cacheKey = `student_results_table_${studentId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
        console.log('🎓 Matching test results cached with key:', cacheKey);
        
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
  }, [user?.student_id, testId, testData, blocks, placedWords, caughtCheating, visibilityChangeTimes, timeElapsed, clearCheatingKeys]);

  // Store performSubmit in ref to avoid dependency issues
  useEffect(() => {
    performSubmitRef.current = submitAllowed ? performSubmit : undefined;
  }, [performSubmit, submitAllowed]);

  // Extract student ID once on mount
  useEffect(() => {
    const extractStudentId = async () => {
      let id: string | number | null = user?.student_id || null;
      if (!id) {
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              id = payload.student_id || payload.id || null;
            }
          }
        } catch {}
      }
      if (!id) {
        try {
          const authUserStr = await AsyncStorage.getItem('auth_user');
          const authUser = authUserStr ? JSON.parse(authUserStr) : null;
          id = authUser?.student_id || authUser?.id || null;
        } catch {}
      }
      setStudentId(id ? String(id) : null);
      
      // Restore progress once studentId is available
      if (id && testId && blocks.length > 0) {
        try {
          const progressKey = `test_progress_${id}_matching_type_${testId}`;
          const savedProgress = await AsyncStorage.getItem(progressKey);
          if (savedProgress) {
            const parsed = JSON.parse(savedProgress);
            if (parsed.placedWords && typeof parsed.placedWords === 'object') {
              setPlacedWords(parsed.placedWords);
              if (DEBUG_MATCHING) console.log('Matching RN: restored progress from studentId effect', parsed.placedWords);
            }
          }
        } catch (e) {
          console.error('Failed to restore progress:', e);
        }
      }
    };
    extractStudentId();
  }, [user?.student_id, testId, blocks.length]);

  // Timer effect - only start if test has timer enabled
  useEffect(() => {
    console.log('⏰ [TIMER] Effect triggered', { 
      hasTestData: !!testData, 
      blocksLength: blocks.length, 
      studentId: studentId,
      testId 
    });
    
    if (!testData || !blocks.length || !studentId) {
      console.log('⏰ [TIMER] Skipping - missing requirements', { 
        testData: !!testData, 
        blocks: blocks.length, 
        studentId: !!studentId 
      });
      return;
    }
    
    // Only start timer if test has a time limit set
    const allowedTime = testData.allowed_time || testData.time_limit;
    console.log('⏰ [TIMER] Checking timer', { 
      allowedTime, 
      allowed_time: testData.allowed_time,
      time_limit: testData.time_limit,
      testDataKeys: Object.keys(testData || {}),
      timerInitialized: timerInitializedRef.current 
    });
    
    if (!submitAllowed) return;
    if (allowedTime && allowedTime > 0) {
      // Prevent multiple timer initializations
      if (timerInitializedRef.current) {
        console.log('⏰ [TIMER] Already initialized - skipping');
        return;
      }
      
      // CRITICAL: Set ref immediately before any async work to prevent race conditions
      timerInitializedRef.current = true;
      console.log('⏰ [TIMER] Starting timer initialization', { allowedTime });
      
      const timerKey = `test_timer_${studentId}_matching_type_${testId}`;
      console.log('⏰ [TIMER] Timer key:', timerKey);
      
      // Load cached timer state
      const loadTimerState = async () => {
        console.log('⏰ [TIMER] Loading timer state...');
        try {
          const cached = await AsyncStorage.getItem(timerKey);
          const now = Date.now();
          if (cached) {
            console.log('⏰ [TIMER] Found cached timer state');
            const parsed = JSON.parse(cached);
            const drift = Math.floor((now - new Date(parsed.lastTickAt).getTime()) / 1000);
            const cachedRemaining = Number(parsed.remainingSeconds || allowedTime);
            const remaining = Math.max(0, cachedRemaining - Math.max(0, drift));
            console.log('⏰ [TIMER] Cached state loaded', { remaining, drift, cachedRemaining });
            
            // If timer expired (remaining <= 0), start fresh timer instead
            if (remaining <= 0) {
              console.log('⏰ [TIMER] Cached timer expired - starting fresh timer');
              // Clear expired cache and start new timer
              const startedAt = new Date(now).toISOString();
              await AsyncStorage.setItem(timerKey, JSON.stringify({
                remainingSeconds: allowedTime,
                lastTickAt: new Date(now).toISOString(),
                startedAt: startedAt
              }));
              setTimeElapsed(0);
              return { remaining: allowedTime, startedAt };
            }
            
            setTimeElapsed(allowedTime - remaining);
            return { remaining, startedAt: parsed.startedAt || new Date(now).toISOString() };
          } else {
            console.log('⏰ [TIMER] No cached state - initializing new timer');
            // Initialize new timer
            const startedAt = new Date(now).toISOString();
            await AsyncStorage.setItem(timerKey, JSON.stringify({
              remainingSeconds: allowedTime,
              lastTickAt: new Date(now).toISOString(),
              startedAt: startedAt
            }));
            return { remaining: allowedTime, startedAt };
          }
        } catch (e) {
          console.error('Timer cache init error:', e);
          const startedAt = new Date().toISOString();
          return { remaining: allowedTime, startedAt };
        }
      };

      // Initialize timer state BEFORE starting interval
      loadTimerState().then(({ remaining, startedAt }) => {
        console.log('⏰ [TIMER] Timer state loaded, starting interval', { remaining, startedAt });
        remainingTimeRef.current = remaining;
        timerStartedAtRef.current = startedAt;
        setTimeElapsed(allowedTime - remaining);
        
        // Only start interval after timer state is loaded
        console.log('⏰ [TIMER] Creating interval...', { remaining, hasPerformSubmit: !!performSubmitRef.current });
        
        // If timer already expired, submit immediately
        if (remaining <= 0) {
          console.log('⏰ [TIMER] Timer already expired - submitting immediately');
          timerInitializedRef.current = false;
          performSubmitRef.current?.();
          return;
        }
        
        countdownTimerRef.current = setInterval(async () => {
          console.log('⏰ [TIMER] Tick', { remaining: remainingTimeRef.current });
          remainingTimeRef.current -= 1;
          setTimeElapsed(allowedTime - remainingTimeRef.current);
          
          // Save timer state (preserve startedAt from initialization)
          try {
            await AsyncStorage.setItem(timerKey, JSON.stringify({
              remainingSeconds: remainingTimeRef.current,
              lastTickAt: new Date().toISOString(),
              startedAt: timerStartedAtRef.current // Preserve original start time
            }));
          } catch (e) {
            console.error('Timer save error:', e);
          }
          
          // Auto-submit when time runs out - no popup, direct submission
          if (remainingTimeRef.current <= 0) {
            console.log('⏰ [TIMER] Time expired - submitting', { hasPerformSubmit: !!performSubmitRef.current });
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            timerInitializedRef.current = false; // Reset for retake
            // Directly submit without any confirmation
            if (performSubmitRef.current) {
              console.log('⏰ [TIMER] Calling performSubmit...');
              performSubmitRef.current();
            } else {
              console.error('⏰ [TIMER] performSubmitRef.current is null!');
            }
          }
        }, 1000);
      });

      return () => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        // Reset timerInitializedRef when testId or studentId changes (new test)
        timerInitializedRef.current = false;
      };
    }
    // If no timer, don't start anything
  }, [testData, blocks.length, studentId, testId]);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  // Anti-cheating tracking (like web app)

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
    
    // Calculate uniform scale to maintain aspect ratio (like web app)
    const scaleX = ren.width / nat.width;
    const scaleY = ren.height / nat.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, maintain aspect ratio
    
    // Calculate scaled dimensions
    const scaledWidth = nat.width * scale;
    const scaledHeight = nat.height * scale;
    
    // Calculate centering offset (image is centered in container with 'contain' mode)
    const offsetX = (ren.width - scaledWidth) / 2;
    const offsetY = (ren.height - scaledHeight) / 2;
    
    // Parse coordinates from natural image space
    const natX = parseCoord(coord.x, nat.width);
    const natY = parseCoord(coord.y, nat.height);
    const natW = parseCoord(coord.width, nat.width);
    const natH = parseCoord(coord.height, nat.height);
    
    // Transform to render space: scale then offset (like web app)
    return {
      left: offsetX + (natX * scale),
      top: offsetY + (natY * scale),
      width: natW * scale,
      height: natH * scale,
    };
  };

  const toNum = (v: any): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return isNaN(n) ? 0 : n;
  };

  const getArrowPoints = (arrow: any) => {
    const ren = imageRenderSize;
    const nat = imageNaturalSize;
    if (!ren || !nat || nat.width === 0 || nat.height === 0) return null;

    const color = arrow?.style?.color || '#dc3545';
    const thickness = arrow?.style?.thickness || 3;

    // Calculate uniform scale to maintain aspect ratio (like web app)
    const scaleX = ren.width / nat.width;
    const scaleY = ren.height / nat.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, maintain aspect ratio
    
    // Calculate scaled dimensions
    const scaledWidth = nat.width * scale;
    const scaledHeight = nat.height * scale;
    
    // Calculate centering offset (image is centered in container with 'contain' mode)
    const offsetX = (ren.width - scaledWidth) / 2;
    const offsetY = (ren.height - scaledHeight) / 2;

    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

    // Prefer relative coordinates when available (like web app)
    const hasRel = arrow?.rel_start_x != null && arrow?.rel_start_y != null && 
                   arrow?.rel_end_x != null && arrow?.rel_end_y != null &&
                   arrow?.image_width && arrow?.image_height &&
                   arrow.image_width > 0 && arrow.image_height > 0;

    if (hasRel) {
      // Use relative coordinates with original image dimensions
      const origW = Number(arrow.image_width) || nat.width;
      const origH = Number(arrow.image_height) || nat.height;
      const relScaleX = scaledWidth / origW;
      const relScaleY = scaledHeight / origH;
      x1 = offsetX + (Number(arrow.rel_start_x) / 100) * origW * relScaleX;
      y1 = offsetY + (Number(arrow.rel_start_y) / 100) * origH * relScaleY;
      x2 = offsetX + (Number(arrow.rel_end_x) / 100) * origW * relScaleX;
      y2 = offsetY + (Number(arrow.rel_end_y) / 100) * origH * relScaleY;
    } else if (arrow?.start_x != null && arrow?.start_y != null && arrow?.end_x != null && arrow?.end_y != null) {
      // Fallback to absolute coordinates
      const sx = toNum(arrow.start_x);
      const sy = toNum(arrow.start_y);
      const ex = toNum(arrow.end_x);
      const ey = toNum(arrow.end_y);
      
      // Check if coordinates are already in render space
      const alreadyRenderSpace = sx <= ren.width + 1 && ex <= ren.width + 1 && 
                                 sy <= ren.height + 1 && ey <= ren.height + 1;
      
      if (alreadyRenderSpace) {
        // Coordinates are already in render space → just offset by image position
        x1 = offsetX + sx;
        y1 = offsetY + sy;
        x2 = offsetX + ex;
        y2 = offsetY + ey;
      } else {
        // Coordinates are in original image space → scale then offset
        x1 = offsetX + (sx * scale);
        y1 = offsetY + (sy * scale);
        x2 = offsetX + (ex * scale);
        y2 = offsetY + (ey * scale);
      }
    } else if (arrow?.start && arrow?.end) {
      // Legacy format with start/end objects
      const sx = toNum(arrow.start.x);
      const sy = toNum(arrow.start.y);
      const ex = toNum(arrow.end.x);
      const ey = toNum(arrow.end.y);
      
      // Check if coordinates are already in render space
      const alreadyRenderSpace = sx <= ren.width + 1 && ex <= ren.width + 1 && 
                                 sy <= ren.height + 1 && ey <= ren.height + 1;
      
      if (alreadyRenderSpace) {
        // Coordinates are already in render space → just offset by image position
        x1 = offsetX + sx;
        y1 = offsetY + sy;
        x2 = offsetX + ex;
        y2 = offsetY + ey;
      } else {
        // Coordinates are in original image space → scale then offset
        x1 = offsetX + (sx * scale);
        y1 = offsetY + (sy * scale);
        x2 = offsetX + (ex * scale);
        y2 = offsetY + (ey * scale);
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
      {showExamNav ? (
        <ExamTestHeader
          themeMode={themeMode}
          examId={examId}
          examName={examName || 'Exam'}
          testName={testData?.test_name || 'Matching Test'}
          currentIndex={examTestIndex}
          total={examTestsTotal}
          timeSeconds={examTimeRemaining}
          onBack={() => router.back()}
        />
      ) : (
        <TestHeader 
          testName={testData.test_name}
          onExit={() => router.back()}
          showBackButton
        />
      )}
      <ScrollView className="flex-1">
        <Text className="text-base text-gray-600 text-center px-4 py-4">Drag words to the correct blocks on the image</Text>

        {/* Progress Tracker */}
        <ProgressTracker
          answeredCount={Object.keys(placedWords).length}
          totalQuestions={blocks.length}
          percentage={blocks.length > 0 ? Math.round((Object.keys(placedWords).length / blocks.length) * 100) : 0}
          timeRemaining={testData?.allowed_time > 0 ? Math.max(0, (testData.allowed_time || testData.time_limit) - timeElapsed) : undefined}
          onSubmitTest={submitAllowed ? submitTest : undefined}
          isSubmitting={submitAllowed ? isSubmitting : false}
          canSubmit={submitAllowed && isAllPlaced}
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
                    handleWordPlacement(wid, block.id);
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
                    imageRenderSize &&
                    [sx, sy, ex, ey].every(v => typeof v === 'number' && !isNaN(v))
                  ) {
                    // Calculate uniform scale and offset (like web app)
                    const scaleX = imageRenderSize.width / imageNaturalSize.width;
                    const scaleY = imageRenderSize.height / imageNaturalSize.height;
                    const scale = Math.min(scaleX, scaleY, 1);
                    const scaledWidth = imageNaturalSize.width * scale;
                    const scaledHeight = imageNaturalSize.height * scale;
                    const offsetX = (imageRenderSize.width - scaledWidth) / 2;
                    const offsetY = (imageRenderSize.height - scaledHeight) / 2;
                    
                    // Check if already in render space
                    const alreadyRenderSpace = sx <= imageRenderSize.width + 1 && ex <= imageRenderSize.width + 1 && 
                                             sy <= imageRenderSize.height + 1 && ey <= imageRenderSize.height + 1;
                    
                    const x1 = alreadyRenderSpace ? (offsetX + sx) : (offsetX + (sx * scale));
                    const y1 = alreadyRenderSpace ? (offsetY + sy) : (offsetY + (sy * scale));
                    const x2 = alreadyRenderSpace ? (offsetX + ex) : (offsetX + (ex * scale));
                    const y2 = alreadyRenderSpace ? (offsetY + ey) : (offsetY + (ey * scale));
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

      {!showExamNav && (
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
      )}
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

      {!showExamNav && (
        <SubmitModal
          visible={showSubmitModal}
          onConfirm={() => {
            setShowSubmitModal(false);
            performSubmit();
          }}
          onCancel={() => setShowSubmitModal(false)}
          testName={testData?.test_name || 'Test'}
        />
      )}

      <LoadingModal visible={isSubmitting} message={themeMode === 'cyberpunk' ? 'SUBMITTING…' : 'Submitting…'} />

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

      {/* No back modal; navigate directly */}
    </View>
  );
}