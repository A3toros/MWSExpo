import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert, Image, Dimensions } from 'react-native';
import Svg, { Line, Polygon, G } from 'react-native-svg';
import { DraxProvider, DraxView } from 'react-native-drax';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSubmissionMethod } from '../../../../src/services/apiClient';
import { useAppSelector } from '../../../../src/store';
import TestHeader from '../../../../src/components/TestHeader';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';

// Using Drax for drag and drop; no custom gesture math needed

export default function MatchingTestScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const user = useAppSelector((state) => state.auth.user);
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
  const [arrows, setArrows] = useState<any[]>([]);
  const DEBUG_MATCHING = true;
  const DROP_MARGIN = 12;
  const DEBUG_SUBMIT = true;

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
      // Set arrows from test payload (mirror web app)
      setArrows(Array.isArray(test?.arrows) ? test.arrows : []);
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
          (w, h) => setImageNaturalSize({ width: w, height: h }),
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
    Alert.alert(
      'Submit Test',
      'Are you sure you want to submit your test? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { if (DEBUG_SUBMIT) console.log('Matching RN: submit cancelled'); } },
        { text: 'Submit', style: 'destructive', onPress: () => { if (DEBUG_SUBMIT) console.log('Matching RN: submit confirmed'); performSubmit(); } }
      ]
    );
  }, [user?.student_id, testData, blocks, placedWords, testId]);

  // Helper function to decode JWT token and extract student ID
  const getStudentIdFromToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Matching RN: token exists?', !!token);
      if (!token) return null;
      
      // Decode JWT token (simple base64 decode of payload)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('Matching RN: invalid token format, parts:', parts.length);
        return null;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      console.log('Matching RN: token payload:', payload);
      console.log('Matching RN: payload.student_id:', payload.student_id);
      console.log('Matching RN: payload.id:', payload.id);
      
      return payload.student_id || payload.id || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Actual submit function
  const performSubmit = useCallback(async () => {
    if (!testData) return;

    setIsSubmitting(true);
    try {
      // Try to get student ID from multiple sources
      let studentId = await getStudentIdFromToken();
      
      if (!studentId) {
        // Fallback to AsyncStorage
        const userData = await AsyncStorage.getItem('user');
        const userFromStorage = userData ? JSON.parse(userData) : null;
        studentId = userFromStorage?.student_id || userFromStorage?.id;
        console.log('Matching RN: userFromStorage:', userFromStorage);
      }
      
      if (!studentId) {
        // Fallback to Redux state
        studentId = user?.student_id || (user as any)?.id;
        console.log('Matching RN: user from Redux:', user);
      }
      
      console.log('Matching RN: studentId from token/AsyncStorage:', studentId);
      
      if (!studentId) {
        console.log('Matching RN: No student ID available');
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
        caught_cheating: false,
        visibility_change_times: 0,
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
    const { score, maxScore, percentage, passed } = testResults;
    
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Test Results</Text>
            <Text style={styles.testName}>{testData?.test_name || 'Test'}</Text>
            <Text style={styles.testType}>Matching • Completed on {new Date().toLocaleDateString()}</Text>
            
            {/* Pass/Fail Status */}
            <View style={[styles.statusBadge, passed ? styles.passedBadge : styles.failedBadge]}>
              <Text style={[styles.statusText, passed ? styles.passedText : styles.failedText]}>
                {passed ? '✓ PASSED' : '✗ FAILED'}
              </Text>
            </View>
          </View>

          {/* Score Summary */}
          <View style={styles.scoreSummary}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreNumber}>{score || 0}</Text>
              <Text style={styles.scoreLabel}>Correct Answers</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreNumber}>{maxScore || blocks.length}</Text>
              <Text style={styles.scoreLabel}>Total Questions</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreNumber, percentage >= 80 ? styles.greenScore : percentage >= 60 ? styles.yellowScore : styles.redScore]}>
                {percentage || 0}%
              </Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${percentage || 0}%`,
                    backgroundColor: percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444'
                  }
                ]} 
              />
            </View>
          </View>

          {/* Question Analysis for Matching Test */}
          <View style={styles.questionAnalysis}>
            <Text style={styles.analysisTitle}>Question Review</Text>
            
            {blocks.map((block, index) => {
              const placedWordId = placedWords[String(block.id)];
              const placedWord = words.find(w => String(w.id) === String(placedWordId));
              const isCorrect = placedWord && placedWord.word === block.word;
              
              return (
                <View key={block.id} style={[styles.questionItem, isCorrect ? styles.correctQuestion : styles.incorrectQuestion]}>
                  <View style={styles.questionHeader}>
                    <Text style={styles.questionNumber}>Question {index + 1}</Text>
                    <View style={[styles.correctnessBadge, isCorrect ? styles.correctBadge : styles.incorrectBadge]}>
                      <Text style={[styles.correctnessText, isCorrect ? styles.correctText : styles.incorrectText]}>
                        {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.questionContent}>
                    <Text style={styles.questionLabel}>Block:</Text>
                    <Text style={styles.questionText}>{block.word}</Text>
                  </View>
                  
                  <View style={styles.answerGrid}>
                    <View style={styles.answerItem}>
                      <Text style={styles.answerLabel}>Your Answer:</Text>
                      <Text style={[styles.answerText, isCorrect ? styles.correctAnswer : styles.incorrectAnswer]}>
                        {placedWord?.word || 'Not answered'}
                      </Text>
                    </View>
                    <View style={styles.answerItem}>
                      <Text style={styles.answerLabel}>Correct Answer:</Text>
                      <Text style={styles.correctAnswerText}>{block.word}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Summary Statistics */}
          <View style={styles.summaryStats}>
            <Text style={styles.summaryTitle}>Summary Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{blocks.filter((_, i) => {
                  const placedWordId = placedWords[String(blocks[i].id)];
                  const placedWord = words.find(w => String(w.id) === String(placedWordId));
                  return placedWord && placedWord.word === blocks[i].word;
                }).length}</Text>
                <Text style={styles.statLabel}>Correct</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{blocks.filter((_, i) => {
                  const placedWordId = placedWords[String(blocks[i].id)];
                  const placedWord = words.find(w => String(w.id) === String(placedWordId));
                  return !(placedWord && placedWord.word === blocks[i].word);
                }).length}</Text>
                <Text style={styles.statLabel}>Incorrect</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{percentage || 0}%</Text>
                <Text style={styles.statLabel}>Accuracy</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{blocks.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>← Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!testData || !blocks.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No test data available</Text>
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
    // First, normalize to natural pixel space (support percentage values)
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

    // Default style
    const color = arrow?.style?.color || '#dc3545';
    const thickness = arrow?.style?.thickness || 3;

    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

    const hasRel = arrow?.rel_start_x != null && arrow?.rel_start_y != null && arrow?.rel_end_x != null && arrow?.rel_end_y != null;
    const hasOrigDims = arrow?.image_width && arrow?.image_height;

    if (hasRel) {
      // Percent-based relative to original; scale to render size.
      x1 = (toNum(arrow.rel_start_x) / 100) * ren.width;
      y1 = (toNum(arrow.rel_start_y) / 100) * ren.height;
      x2 = (toNum(arrow.rel_end_x) / 100) * ren.width;
      y2 = (toNum(arrow.rel_end_y) / 100) * ren.height;
    } else if (arrow?.start && arrow?.end) {
      if (nat?.width && nat?.height) {
        // Assume absolute coordinates in original image px → scale to render
        const sx = toNum(arrow.start.x);
        const sy = toNum(arrow.start.y);
        const ex = toNum(arrow.end.x);
        const ey = toNum(arrow.end.y);
        const scaleX = ren.width / nat.width;
        const scaleY = ren.height / nat.height;
        // Heuristic: if values are already <= render size, treat as render space
        const alreadyRenderSpace = sx <= ren.width + 1 && ex <= ren.width + 1 && sy <= ren.height + 1 && ey <= ren.height + 1;
        if (alreadyRenderSpace) {
          x1 = sx; y1 = sy; x2 = ex; y2 = ey;
        } else {
          x1 = sx * scaleX; y1 = sy * scaleY; x2 = ex * scaleX; y2 = ey * scaleY;
        }
      } else {
        // No natural size; best effort use as-is
        x1 = toNum(arrow.start.x); y1 = toNum(arrow.start.y); x2 = toNum(arrow.end.x); y2 = toNum(arrow.end.y);
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
    <View style={styles.container}>
      <TestHeader 
        testName={testData.test_name}
      />
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.subtitle}>Drag words to the correct blocks on the image</Text>

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
        <View style={styles.testContainer}>
        {/* Test Image */}
        {testData.image_url && (
          <View
            ref={imageContainerRef}
            style={styles.imageContainer}
            
          >
            <Image
              source={{ uri: testData.image_url }}
              style={styles.testImage}
              onLoad={() => setImageLoaded(true)}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setImageRenderSize({ width, height });
                if (DEBUG_MATCHING) console.log('Matching RN: imageRenderSize', { width, height });
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
                    styles.dropZone,
                    {
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
                      styles.block,
                      {
                        position: 'absolute',
                        left: DROP_MARGIN,
                        top: DROP_MARGIN,
                        width: scaled.width,
                        height: scaled.height,
                      },
                      isPlaced ? styles.placedBlock : null,
                    ]}
                  >
                    {isPlaced && (
                      <Text style={styles.placedWordText}>
                        {placedWord?.word ?? ''}
                      </Text>
                    )}
                  </View>
                </DraxView>
              );
            })}

            {/* Render arrows overlay using SVG */}
            {imageRenderSize && arrows.length > 0 && (
              <Svg
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, top: 0 }}
                width={imageRenderSize.width}
                height={imageRenderSize.height}
                viewBox={`0 0 ${imageRenderSize.width} ${imageRenderSize.height}`}
              >
                {arrows.map((arrow, idx) => {
                  const pts = getArrowPoints(arrow);
                  if (!pts) return null;
                  const head = getArrowHeadPoints(pts.x1, pts.y1, pts.x2, pts.y2, 10, 10);
                  return (
                    <G key={`arrow-group-${idx}`}>
                      <Line
                        x1={pts.x1}
                        y1={pts.y1}
                        x2={pts.x2}
                        y2={pts.y2}
                        stroke={pts.color}
                        strokeWidth={pts.thickness}
                      />
                      <Polygon
                        points={head}
                        fill={pts.color}
                      />
                    </G>
                  );
                })}
              </Svg>
            )}
          </View>
        )}

        {/* Word bank */}
        <View style={styles.wordBank}>
          <Text style={styles.wordBankTitle}>Word Bank - Drag words to blocks</Text>
          <View style={styles.wordsContainer}>
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
                  style={styles.wordItem}
                  draggingStyle={styles.draggingWord}
                  dragReleasedStyle={styles.wordItem}
                >
                  <Text style={styles.wordText}>{word.word}</Text>
                </DraxView>
              );
            })}
          </View>
        </View>
      </View>
      </DraxProvider>

      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!isAllPlaced || isSubmitting) && styles.disabledButton
          ]}
          onPress={submitTest}
          disabled={!isAllPlaced || isSubmitting}
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
  testContainer: {
    flex: 1,
    padding: 20,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  testImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  block: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#007bff',
    backgroundColor: 'rgba(0, 123, 255, 0.15)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropZone: {
    position: 'absolute',
  },
  placedBlock: {
    backgroundColor: 'rgba(40, 167, 69, 0.4)',
    borderColor: '#28a745',
    shadowColor: 'rgba(40, 167, 69, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  placedWordText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    position: 'absolute',
    top: '50%',
    left: 5,
    right: 5,
    transform: [{ translateY: -10 }],
    height: 20,
    lineHeight: 20,
    fontFamily: 'Arial',
  },
  wordBank: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  wordBankTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordItem: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  placedWord: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  draggingWord: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  wordText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
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
  // Results screen styles
  resultsHeader: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  testName: {
    fontSize: 20,
    color: '#374151',
    marginBottom: 4,
  },
  testType: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  passedBadge: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  failedBadge: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  passedText: {
    color: '#166534',
  },
  failedText: {
    color: '#dc2626',
  },
  scoreSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  greenScore: {
    color: '#10b981',
  },
  yellowScore: {
    color: '#f59e0b',
  },
  redScore: {
    color: '#ef4444',
  },
  progressBarContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
  },
  questionAnalysis: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  analysisTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  questionItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
  },
  correctQuestion: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  incorrectQuestion: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  correctnessBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  correctBadge: {
    backgroundColor: '#dcfce7',
  },
  incorrectBadge: {
    backgroundColor: '#fef2f2',
  },
  correctnessText: {
    fontSize: 12,
    fontWeight: '600',
  },
  correctText: {
    color: '#166534',
  },
  incorrectText: {
    color: '#dc2626',
  },
  questionContent: {
    marginBottom: 12,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  questionText: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 6,
  },
  answerGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  answerItem: {
    flex: 1,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    padding: 12,
    borderRadius: 6,
  },
  correctAnswer: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  incorrectAnswer: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
  },
  correctAnswerText: {
    fontSize: 14,
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: 12,
    borderRadius: 6,
  },
  summaryStats: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButtons: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});