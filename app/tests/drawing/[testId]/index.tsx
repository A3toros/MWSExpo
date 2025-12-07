/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Alert, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Image, AppState, Modal } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withSequence,
  withDelay
} from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get('window');
import { useLocalSearchParams, router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { api, getSubmissionMethod } from '../../../../src/services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestHeader from '../../../../src/components/TestHeader';
import ExamTestHeader from '../../../../src/components/ExamTestHeader';
import { useExamTimer } from '../../../../src/hooks/useExamTimer';
import ProgressTracker from '../../../../src/components/ProgressTracker';
import FullscreenCanvas, { FullscreenCanvasSnapshot } from '../../../../src/components/FullscreenCanvas';
import { Canvas as SkiaCanvas, Path as SkiaPath, Line as SkiaLine, Rect as SkiaRect, Circle as SkiaCircle, Text as SkiaText, Skia, useFont } from '@shopify/react-native-skia';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import { SubmitModal } from '../../../../src/components/modals';
import { LoadingModal } from '../../../../src/components/modals/LoadingModal';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';
import { getRetestAssignmentId, markTestCompleted } from '../../../../src/utils/retestUtils';
import { useAntiCheatingDetection } from '../../../../src/hooks/useAntiCheatingDetection';
import type { CanvasTool, Line, LegacyTextBox } from '../../../../src/types/drawing';
import { useExamNavigation } from '../../../../src/hooks/useExamNavigation';
import ExamNavFooter from '../../../../src/components/ExamNavFooter';

const previewFontSource = require('../../../../assets/fonts/SpaceMono-Regular.ttf');

interface DrawingPreviewProps {
  paths: any[];
  width: number;
  height: number;
  themeMode: string;
}

const buildPreviewPath = (points: any[]) => {
  const path = Skia.Path.Make();
  if (points?.length) {
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y);
    }
  }
  return path;
};

const DrawingPreview: React.FC<DrawingPreviewProps> = ({ paths = [], width, height, themeMode }) => {
  const font = useFont(previewFontSource, 16);
  const hasPaths = Array.isArray(paths) && paths.length > 0;
  const effectiveWidth = typeof width === 'number' ? width : screenWidth - 64;
  const canvasWidth = Math.max(0, effectiveWidth - 32);
  const containerStyles = themeMode === 'cyberpunk'
    ? { backgroundColor: '#050505', borderColor: 'rgba(45, 212, 191, 0.4)' }
    : themeMode === 'dark'
      ? { backgroundColor: '#111827', borderColor: '#374151' }
      : { backgroundColor: '#ffffff', borderColor: '#e5e7eb' };
  const helperTextColor = themeMode === 'cyberpunk'
    ? '#22d3ee'
    : themeMode === 'dark'
      ? '#e5e7eb'
      : '#1f2937';
  const placeholderColor = themeMode === 'cyberpunk'
    ? '#14b8a6'
    : themeMode === 'dark'
      ? '#9ca3af'
      : '#9ca3af';

  return (
    <View style={[{ borderWidth: 1, borderRadius: 20, padding: 16, width: effectiveWidth, marginTop: 12 }, containerStyles]}>
      <View style={{ borderRadius: 12, overflow: 'hidden', alignItems: 'center' }}>
        <View style={{ width: canvasWidth, height, position: 'relative' }}>
          <SkiaCanvas style={{ width: canvasWidth, height, backgroundColor: '#f9fafb' }}>
            {hasPaths && paths.map((item: any, index: number) => {
              if (Array.isArray(item)) {
                const path = buildPreviewPath(item);
                const isEraserStroke = item[0]?.tool === 'eraser';
                return (
                  <SkiaPath
                    key={`preview-stroke-${index}`}
                    path={path}
                    color={isEraserStroke ? '#f9fafb' : (item[0]?.color || '#111827')}
                    style="stroke"
                    strokeWidth={isEraserStroke ? (item[0]?.thickness || 1) * 7 : (item[0]?.thickness || 1)}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                );
              }
              if (item?.type === 'line') {
                return (
                  <SkiaLine
                    key={`preview-line-${index}`}
                    p1={{ x: item.startX, y: item.startY }}
                    p2={{ x: item.endX, y: item.endY }}
                    color={item.color || '#111827'}
                    style="stroke"
                    strokeWidth={item.thickness || 1}
                  />
                );
              }
              if (item?.type === 'rectangle' || item?.type === 'textBox') {
                const rectWidth = Math.abs(item.endX - item.startX);
                const rectHeight = Math.abs(item.endY - item.startY);
                const rectX = Math.min(item.startX, item.endX);
                const rectY = Math.min(item.startY, item.endY);
                return (
                  <SkiaRect
                    key={`preview-rect-${index}`}
                    x={rectX}
                    y={rectY}
                    width={rectWidth}
                    height={rectHeight}
                    color={item.color || '#111827'}
                    style="stroke"
                    strokeWidth={item.thickness || 1}
                  />
                );
              }
              if (item?.type === 'circle') {
                const centerX = (item.startX + item.endX) / 2;
                const centerY = (item.startY + item.endY) / 2;
                const radius = Math.sqrt(
                  Math.pow(item.endX - item.startX, 2) + Math.pow(item.endY - item.startY, 2)
                ) / 2;
                return (
                  <SkiaCircle
                    key={`preview-circle-${index}`}
                    cx={centerX}
                    cy={centerY}
                    r={radius}
                    color={item.color || '#111827'}
                    style="stroke"
                    strokeWidth={item.thickness || 1}
                  />
                );
              }
              if (item?.type === 'text' && font) {
                return (
                  <SkiaText
                    key={`preview-text-${index}`}
                    x={item.x}
                    y={item.y}
                    text={item.text}
                    color={item.color || '#111827'}
                    font={font}
                  />
                );
              }
              return null;
            })}
          </SkiaCanvas>
          {!hasPaths && (
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: placeholderColor, fontSize: 15 }}>
                No strokes yet - open the full canvas to start
              </Text>
            </View>
          )}
        </View>
      </View>
      <Text style={{ marginTop: 12, textAlign: 'center', fontSize: 16, fontWeight: '600', color: helperTextColor }}>
        Full canvas preview (updates automatically)
      </Text>
    </View>
  );
};

const generateLineId = (() => {
  let seed = 0;
  return (prefix = 'line') => {
    seed += 1;
    return `${prefix}-${Date.now()}-${seed}`;
  };
})();

const convertPathsToFullscreenData = (paths: any[]): { lines: Line[]; textBoxes: LegacyTextBox[] } => {
  const lines: Line[] = [];
  const textBoxes: LegacyTextBox[] = [];

  paths?.forEach((entry, index) => {
    if (Array.isArray(entry) && entry.length > 0) {
      const firstPoint = entry[0];
      lines.push({
        id: generateLineId('stroke'),
        tool: firstPoint.tool || 'pencil',
        color: firstPoint.color || '#111827',
        thickness: firstPoint.thickness || 2,
        points: entry.map((pt: any) => ({ x: pt.x, y: pt.y })),
      });
      return;
    }

    if (entry?.type === 'text' && entry?.text) {
      const fontSize = entry.fontSize || 24;
      const width = Math.max(fontSize * 4, (entry.text.length || 1) * fontSize * 0.6);
      const height = fontSize * 1.6;
      textBoxes.push({
        id: index + 1,
        x: entry.x || 0,
        y: (entry.y || 0) - fontSize,
        width,
        height,
        text: entry.text,
        fontSize,
        color: entry.color || '#111827',
        isEditing: false,
      });
      return;
    }

    if (entry?.type === 'line' || entry?.type === 'rectangle' || entry?.type === 'circle') {
      const shape = entry.type === 'circle' ? 'ellipse' : entry.type;
      const startX = entry.startX ?? entry.x1 ?? 0;
      const startY = entry.startY ?? entry.y1 ?? 0;
      const endX = entry.endX ?? entry.x2 ?? startX;
      const endY = entry.endY ?? entry.y2 ?? startY;
      lines.push({
        id: generateLineId('shape'),
        tool: shape === 'ellipse' ? 'ellipse' : shape,
        color: entry.color || '#111827',
        thickness: entry.thickness || 2,
        points: [
          { x: startX, y: startY },
          { x: endX, y: endY },
        ],
        shape: shape === 'ellipse' ? 'ellipse' : (shape as 'line' | 'rectangle'),
        bounds: {
          x1: startX,
          y1: startY,
          x2: endX,
          y2: endY,
        },
      });
    }
  });

  return { lines, textBoxes };
};

const convertSnapshotToPaths = (snapshot: FullscreenCanvasSnapshot): any[] => {
  const paths: any[] = [];

  snapshot.lines?.forEach((line) => {
    const shapeType = line.shape || (line.tool === 'ellipse' ? 'ellipse' : undefined);
    if (!shapeType && (line.tool === 'pencil' || line.tool === 'eraser' || !line.shape)) {
      // Format: array of points with x, y, color, thickness (NO tool field - web app doesn't expect it)
      const stroke = line.points.map((pt) => ({
        x: Math.round(pt.x * 100) / 100, // Round to 2 decimals like web app
        y: Math.round(pt.y * 100) / 100,
        color: line.tool === 'eraser' ? '#fafafa' : line.color,
        thickness: line.thickness,
        // NO tool field - web app format doesn't include it
      }));
      paths.push(stroke);
      return;
    }

    const bounds = line.bounds || {
      x1: line.points[0]?.x || 0,
      y1: line.points[0]?.y || 0,
      x2: line.points[line.points.length - 1]?.x || line.points[0]?.x || 0,
      y2: line.points[line.points.length - 1]?.y || line.points[0]?.y || 0,
    };

    paths.push({
      type: shapeType === 'ellipse' ? 'circle' : shapeType,
      startX: bounds.x1,
      startY: bounds.y1,
      endX: bounds.x2,
      endY: bounds.y2,
      color: line.color,
      thickness: line.thickness,
    });
  });

  snapshot.textBoxes?.forEach((box) => {
    paths.push({
      type: 'rectangle',
      startX: box.x,
      startY: box.y,
      endX: box.x + box.width,
      endY: box.y + box.height,
      color: box.color,
      thickness: 1,
    });
    paths.push({
      type: 'text',
      x: box.x,
      y: box.y + box.fontSize,
      text: box.text,
      color: box.color,
      fontSize: box.fontSize,
    });
  });

  return paths;
};

// Function to decode JWT and extract student_id
const getStudentIdFromToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return null;
    
    // Decode JWT payload (base64 decode the middle part)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export default function DrawingTestScreen() {
  const { testId, exam, examId } = useLocalSearchParams();
  const inExamContext = useMemo(() => exam === '1' && !!examId, [exam, examId]);
  const submitAllowed = !inExamContext;
  const showExamNav = inExamContext && !!examId;
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: any) => state.auth.user);
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [drawingPaths, setDrawingPaths] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmittingToAPI, setIsSubmittingToAPI] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showFullscreenCanvas, setShowFullscreenCanvas] = useState(false);

  // Anti-cheating detection hook
  const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId || ''));
  const { caughtCheating, visibilityChangeTimes, clearCheatingKeys, textInputProps } = useAntiCheatingDetection({
    studentId: studentId || '',
    testType: 'drawing',
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
    currentTestType: 'drawing',
    enabled: showExamNav,
  });
  const examTimeRemaining = useExamTimer({ examId, studentId, totalMinutes });
  
  // Timer refs to prevent re-initialization
  const timerInitializedRef = useRef<boolean>(false);
  const performSubmitRef = useRef<() => Promise<void>>();
  const remainingTimeRef = useRef<number>(0);
  const timerStartedAtRef = useRef<string>('');
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load student_id from JWT token
  useEffect(() => {
    const loadStudentId = async () => {
      const id = await getStudentIdFromToken();
      setStudentId(id);
    };
    loadStudentId();
  }, []);
  
  // Multiple question support
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]); // Store answers for all questions
  const [currentQuestionPaths, setCurrentQuestionPaths] = useState<any[]>([]); // Current question's drawing paths
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false); // Flag to prevent interference during question loading
  
  // Fullscreen canvas seed data (kept stable while modal is open)
  const [fullscreenInitialData, setFullscreenInitialData] = useState<{ lines: Line[]; textBoxes: LegacyTextBox[] }>(() => convertPathsToFullscreenData([]));
  const [fullscreenPrefs, setFullscreenPrefs] = useState<{ tool: CanvasTool; color: string; thickness: number }>({
    tool: 'pencil',
    color: '#111827',
    thickness: 4,
  });

  // Persist per-test answers into exam-level key when in exam context
  useEffect(() => {
    if (!inExamContext || !studentId || !examId || !testId || !questions.length) return;
    const payload: Record<string | number, any> = {};
    answers.forEach((ans, idx) => {
      const q = questions[idx];
      const qId = q?.question_id || q?.id || idx;
      const formatted = convertPathsToFullscreenData(Array.isArray(ans) ? ans : []);
      const lines = (formatted.lines || []).map((line) =>
        line.points.map((pt) => ({
          x: pt.x,
          y: pt.y,
          color: line.tool === 'eraser' ? '#fafafa' : line.color,
          thickness: line.thickness,
        })),
      );
      payload[qId] = { lines, textBoxes: formatted.textBoxes || [] };
    });
    const key = `exam_answer_${studentId}_${examId}_${testId}_drawing`;
    AsyncStorage.setItem(key, JSON.stringify(payload)).catch(() => {});
  }, [answers, inExamContext, studentId, examId, testId, questions]);

  // Prefill drawing answers from cached exam data when in exam context
  useEffect(() => {
    if (!showExamNav || !studentId || !examId || !testId) return;
    const key = `exam_answer_${studentId}_${examId}_${testId}_drawing`;
    const preloaded = cachedAnswers?.[key];
    const restoreFromPayload = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      const restored: any[] = [];
      questions.forEach((q, idx) => {
        const qId = q?.question_id || q?.id || idx;
        const entry = payload[qId];
        if (entry) {
          const lines = entry.lines || [];
          const textBoxes = entry.textBoxes || [];
          restored[idx] = { lines, textBoxes };
        }
      });
      setAnswers(restored);
    };
    if (preloaded) {
      restoreFromPayload(preloaded);
      return;
    }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          restoreFromPayload(parsed);
        }
      } catch {
        // ignore
      }
    })();
  }, [showExamNav, studentId, examId, testId, cachedAnswers, questions]);

  useEffect(() => {
    if (!showFullscreenCanvas) {
      setFullscreenInitialData(convertPathsToFullscreenData(currentQuestionPaths));
    }
  }, [showFullscreenCanvas, currentQuestionPaths]);


  // Check if test is already completed (web app pattern)
  // IMPORTANT: Allow retests even if test is marked as completed
  const checkTestCompleted = useCallback(async () => {
    if (!studentId || !testId) return false;
    
    try {
      // Check for retest key first - if retest is available, allow access (web app pattern)
      const retestKey = `retest1_${studentId}_drawing_${testId}`;
      const hasRetest = await AsyncStorage.getItem(retestKey);
      
      // If retest is available, allow access even if test is completed
      if (hasRetest === 'true') {
        return false; // Don't block retests
      }
      
      // Only check completion if no retest is available
      const completionKey = `test_completed_${studentId}_drawing_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      
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
  }, [studentId, testId]);

  // Load saved drawing data for current question
  const loadCurrentQuestionDrawing = useCallback(async () => {
    setIsLoadingQuestion(true);
    
    if (studentId && testId) {
      const storageKey = `drawing_${studentId}_${testId}_${currentQuestionIndex}`;
      try {
        const savedData = await AsyncStorage.getItem(storageKey);
        
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          
          // Handle new JSON format with root.children structure
          if (parsedData.root && parsedData.root.children && parsedData.root.children[0] && parsedData.root.children[0].children) {
            const drawingPaths = parsedData.root.children[0].children.map((child: any) => {
              try {
                return JSON.parse(child.text);
              } catch (e) {
                return null;
              }
            }).filter((path: any) => path !== null);
            
            setCurrentQuestionPaths(drawingPaths);
            
            // Update answers array
            setAnswers(prevAnswers => {
              const newAnswers = [...prevAnswers];
              newAnswers[currentQuestionIndex] = parsedData;
              return newAnswers;
            });
          } else {
            // Fallback: try to parse as old format
            setCurrentQuestionPaths(parsedData);
            setAnswers(prevAnswers => {
              const newAnswers = [...prevAnswers];
              newAnswers[currentQuestionIndex] = parsedData;
              return newAnswers;
            });
          }
        } else {
          // No saved data for this question, reset canvas
          setCurrentQuestionPaths([]);
        }
      } catch (error) {
        setCurrentQuestionPaths([]);
      }
    }
    
    // Add a small delay to ensure the canvas has time to initialize
    setTimeout(() => {
      setIsLoadingQuestion(false);
    }, 100);
  }, [currentQuestionIndex, studentId, testId]);

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

      // Check if already completed
      const isCompleted = await checkTestCompleted();
      if (isCompleted) return;

      // Load test info and questions
      const [testResponse, questionsResponse] = await Promise.all([
        api.get('/api/get-test-questions', { 
          params: { test_type: 'drawing', test_id: testId } 
        }),
        api.get('/api/get-test-questions', {
          params: { test_type: 'drawing', test_id: testId }
        })
      ]);

      if (!testResponse.data.success) {
        throw new Error(testResponse.data.error || 'Failed to load test data');
      }

      if (!questionsResponse.data.success) {
        throw new Error(questionsResponse.data.error || 'Failed to load questions');
      }

      setTestData(testResponse.data.test_info || testResponse.data.data);
      setQuestions(questionsResponse.data.questions || []);
      
      // Initialize answers array
      const questionsCount = questionsResponse.data.questions?.length || 0;
      setAnswers(new Array(questionsCount).fill(null));

    } catch (error: any) {
      console.error('Error loading test data:', error);
      setError(error.message || 'Failed to load test data');
    } finally {
      setLoading(false);
    }
  }, [testId, checkTestCompleted, studentId]);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  // Load drawing data when question changes
  useEffect(() => {
    if (questions.length > 0 && studentId) {
      loadCurrentQuestionDrawing();
    } else if (questions.length > 0 && !studentId) {
      setCurrentQuestionPaths([]);
    }
  }, [currentQuestionIndex, loadCurrentQuestionDrawing, questions.length, studentId]);

  // Load drawing data when studentId becomes available
  useEffect(() => {
    if (studentId && questions.length > 0) {
      loadCurrentQuestionDrawing();
    }
  }, [studentId, questions.length, currentQuestionIndex, loadCurrentQuestionDrawing]);

  // Save drawing data
  const saveDrawingData = useCallback(async (paths: any[]) => {
    if (studentId && testId) {
      await AsyncStorage.setItem(`drawing_${studentId}_${testId}`, JSON.stringify(paths));
    }
  }, [studentId, testId]);

  // Handle drawing change - store per question
  const handleDrawingChange = useCallback((paths: any[]) => {
    // Don't update if we're still loading a question
    if (isLoadingQuestion) {
      return;
    }

    // Defer state updates to avoid setState during render
    setTimeout(() => {
      setDrawingPaths(paths);
      setCurrentQuestionPaths(paths);
      
      // Update answers array for current question
      setAnswers(prevAnswers => {
        const newAnswers = [...prevAnswers];
        newAnswers[currentQuestionIndex] = paths;
        return newAnswers;
      });
    }, 0);
    
    // Save current question's drawing data in the correct JSON format
    if (studentId && testId) {
      const storageKey = `drawing_${studentId}_${testId}_${currentQuestionIndex}`;
      
      // Save in the same format that submission expects
      const drawingData = {
        root: {
          children: [
            {
              children: paths.map(path => ({
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: JSON.stringify(path),
                type: "text",
                version: 1
              })),
              direction: null,
              format: "",
              indent: 0,
              type: "paragraph",
              version: 1,
              textFormat: 0,
              textStyle: ""
            }
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "root",
          version: 1
        }
      };
      
      AsyncStorage.setItem(storageKey, JSON.stringify(drawingData));
    }
  }, [currentQuestionIndex, studentId, testId, isLoadingQuestion]);

  const handleOpenFullscreen = useCallback(() => {
    setFullscreenInitialData(convertPathsToFullscreenData(currentQuestionPaths));
    // Ensure tool is always pencil (brush), never pan when opening
    setFullscreenPrefs((prev) => ({
      ...prev,
      tool: prev.tool === 'pan' ? 'pencil' : prev.tool,
    }));
    setShowFullscreenCanvas(true);
  }, [currentQuestionPaths]);

  const handleFullscreenChange = useCallback((snapshot: FullscreenCanvasSnapshot) => {
    // Don't persist pan tool - keep current tool or default to pencil
    setFullscreenPrefs((prev) => ({
      tool: (snapshot.tool && snapshot.tool !== 'pan') ? snapshot.tool : prev.tool !== 'pan' ? prev.tool : 'pencil',
      color: snapshot.color || prev.color,
      thickness: snapshot.thickness || prev.thickness,
    }));
    handleDrawingChange(convertSnapshotToPaths(snapshot));
  }, [handleDrawingChange]);

  const handleFullscreenExit = useCallback((snapshot?: FullscreenCanvasSnapshot) => {
    if (snapshot) {
      // Reset tool to pencil (brush) when exiting - don't persist pan tool
      setFullscreenPrefs((prev) => ({
        tool: 'pencil', // Always reset to brush/pencil, never persist pan
        color: snapshot.color || prev.color,
        thickness: snapshot.thickness || prev.thickness,
      }));
      handleDrawingChange(convertSnapshotToPaths(snapshot));
    } else {
      // Even if no snapshot, reset tool to pencil
      setFullscreenPrefs((prev) => ({
        ...prev,
        tool: 'pencil',
      }));
    }
    setShowFullscreenCanvas(false);
  }, [handleDrawingChange]);

  // Question navigation with confirmation
  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      // Show confirmation prompt
      Alert.alert(
        'Move to Next Question',
        'Are you sure you want to move to the next question? Your current drawing will be saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Next Question', 
            onPress: async () => {
              // Store current drawing data in proper JSON format
              if (currentQuestionPaths.length > 0) {
                const drawingData = {
                  root: {
                    children: [
                      {
                        children: currentQuestionPaths.map(path => ({
                          detail: 0,
                          format: 0,
                          mode: "normal",
                          style: "",
                          text: JSON.stringify(path),
                          type: "text",
                          version: 1
                        })),
                        direction: null,
                        format: "",
                        indent: 0,
                        type: "paragraph",
                        version: 1,
                        textFormat: 0,
                        textStyle: ""
                      }
                    ],
                    direction: null,
                    format: "",
                    indent: 0,
                    type: "root",
                    version: 1
                  }
                };
                
                // Store in answers array
                setAnswers(prevAnswers => {
                  const newAnswers = [...prevAnswers];
                  newAnswers[currentQuestionIndex] = drawingData;
                  return newAnswers;
                });
                
                // Save to AsyncStorage
                if (studentId && testId) {
                  await AsyncStorage.setItem(`drawing_${studentId}_${testId}_${currentQuestionIndex}`, JSON.stringify(drawingData));
                }
              }
              
              // Move to next question
              setCurrentQuestionIndex(prev => prev + 1);
            }
          }
        ]
      );
    }
  }, [currentQuestionIndex, questions.length, currentQuestionPaths, studentId, testId]);

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      // Show confirmation prompt
      Alert.alert(
        'Move to Previous Question',
        'Are you sure you want to move to the previous question? Your current drawing will be saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Previous Question', 
            onPress: async () => {
              // Store current drawing data in proper JSON format
              if (currentQuestionPaths.length > 0) {
                const drawingData = {
                  root: {
                    children: [
                      {
                        children: currentQuestionPaths.map(path => ({
                          detail: 0,
                          format: 0,
                          mode: "normal",
                          style: "",
                          text: JSON.stringify(path),
                          type: "text",
                          version: 1
                        })),
                        direction: null,
                        format: "",
                        indent: 0,
                        type: "paragraph",
                        version: 1,
                        textFormat: 0,
                        textStyle: ""
                      }
                    ],
                    direction: null,
                    format: "",
                    indent: 0,
                    type: "root",
                    version: 1
                  }
                };
                
                // Store in answers array
                setAnswers(prevAnswers => {
                  const newAnswers = [...prevAnswers];
                  newAnswers[currentQuestionIndex] = drawingData;
                  return newAnswers;
                });
                
                // Save to AsyncStorage
                if (studentId && testId) {
                  await AsyncStorage.setItem(`drawing_${studentId}_${testId}_${currentQuestionIndex}`, JSON.stringify(drawingData));
                }
              }
              
              // Move to previous question
              setCurrentQuestionIndex(prev => prev - 1);
            }
          }
        ]
      );
    }
  }, [currentQuestionIndex, currentQuestionPaths, studentId, testId]);

  // Submit test
  const handleSubmit = useCallback(() => {
    if (!submitAllowed) return;
    if (!testData || !questions.length) {
      Alert.alert('Error', 'Missing required data for submission');
      return;
    }

    // Allow submission even without drawing data - will submit empty structures
    // Show confirmation modal
    setShowSubmitModal(true);
  }, [testData, questions, testId, user, submitAllowed]);

  // Actual submit function
  const performSubmit = useCallback(async () => {
    if (!submitAllowed) {
      setShowSubmitModal(false);
      return;
    }
    if (!testData || !questions.length) {
      Alert.alert('Error', 'Missing required data for submission');
      return;
    }

    // Don't check drawingPaths.length here - drawings are stored in AsyncStorage per question
    // The submission will load from AsyncStorage and check if there's actual drawing data

    setIsSubmittingToAPI(true);
    setSubmitError(null);

    try {
      // Try to get student ID from multiple sources (same as matching test)
      let studentId = await getStudentIdFromToken();
      
      if (!studentId) {
        // Fallback to AsyncStorage
        const userData = await AsyncStorage.getItem('user');
        const userFromStorage = userData ? JSON.parse(userData) : null;
        studentId = userFromStorage?.student_id || userFromStorage?.id;
      }
      
      if (!studentId) {
        // Fallback to Redux state
        studentId = user?.student_id || (user as any)?.id;
      }
      
      if (!studentId) {
        Alert.alert('Error', 'Missing student ID');
        return;
      }

      // Collect drawing data per question in the correct format
      const allDrawingData: string[] = [];
      
      for (let i = 0; i < questions.length; i++) {
        try {
          const storageKey = `drawing_${studentId}_${testId}_${i}`;
          const savedData = await AsyncStorage.getItem(storageKey);
          
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            
            // Extract drawing paths from the saved format
            let drawingPaths = [];
            if (parsedData.root && parsedData.root.children && parsedData.root.children[0] && parsedData.root.children[0].children) {
              drawingPaths = parsedData.root.children[0].children.map((child: any) => {
                try {
                  return JSON.parse(child.text);
                } catch (e) {
                  return null;
                }
              }).filter((path: any) => path !== null);
            } else if (Array.isArray(parsedData)) {
              drawingPaths = parsedData;
            }
            
            // Format as JSON string with "lines" and "textBoxes" structure (web app format)
            if (drawingPaths.length > 0) {
              // Separate strokes from text elements
              const strokes = drawingPaths.filter((path: any) => path.type !== 'text');
              const textBoxes = drawingPaths.filter((path: any) => path.type === 'text' && path.text);
              
              // Clean strokes: remove 'tool' field from points and ensure correct format
              // Web app expects: lines = [[{x, y, color, thickness}, ...], ...] (array of arrays)
              const cleanedStrokes = strokes.map((stroke: any) => {
                if (Array.isArray(stroke)) {
                  // Stroke is already an array of points - remove 'tool' field
                  return stroke.map((point: any) => {
                    const { tool, ...pointWithoutTool } = point;
                    return {
                      x: Math.round(point.x * 100) / 100, // Round to 2 decimals like web app
                      y: Math.round(point.y * 100) / 100,
                      color: point.color || '#000000',
                      thickness: point.thickness || 2,
                    };
                  });
                }
                // Shape object (line, rectangle, ellipse) - keep as is for now
                return stroke;
              });
              
              const formattedTextBoxes = textBoxes.map((textElement: any) => ({
                id: Date.now() + Math.random(),
                x: textElement.x,
                y: textElement.y,
                width: 150,
                height: 60,
                text: textElement.text,
                fontSize: textElement.fontSize || 14,
                color: textElement.color,
                isEditing: false
              }));

              // Format exactly as web app expects: {"lines":[[...points...]],"textBoxes":[]}
              const formattedData = {
                lines: cleanedStrokes, // Array of arrays (each inner array is a stroke/path)
                textBoxes: formattedTextBoxes
              };
              const jsonString = JSON.stringify(formattedData);
              allDrawingData.push(jsonString);
            } else {
              // Empty question - add empty structure
              allDrawingData.push('{"lines":[],"textBoxes":[]}');
            }
          } else {
            // No saved data for this question
            allDrawingData.push('{"lines":[],"textBoxes":[]}');
          }
        } catch (error) {
          // Add empty structure for failed questions
          allDrawingData.push('{"lines":[],"textBoxes":[]}');
        }
      }
      
      // Prepare submission data
      // Get current academic period ID from academic calendar service
      await academicCalendarService.loadAcademicCalendar();
      const currentTerm = academicCalendarService.getCurrentTerm();
      const academic_period_id = currentTerm?.id;
      
      if (!academic_period_id) {
        Alert.alert('Error', 'No current academic period found');
        return;
      }
      
      // Get retest_assignment_id from AsyncStorage if this is a retest (web app pattern)
      const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
      const retestAssignmentId = await getRetestAssignmentId(studentId, 'drawing', testIdStr);
      
      const submissionData = {
        test_id: testId,
        test_name: testData.test_name || testData.title,
        test_type: 'drawing',
        teacher_id: testData.teacher_id,
        subject_id: testData.subject_id,
        student_id: studentId,
        academic_period_id: academic_period_id,
        answers: allDrawingData, // Simple array of all drawing points from all questions
        score: 0, // Drawing tests are graded by teacher
        maxScore: questions.length,
        time_taken: timeElapsed,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: caughtCheating,
        visibility_change_times: visibilityChangeTimes,
        answers_by_id: {} as Record<string, any>, // Will be populated separately
        question_order: questions.map(q => q.question_id),
        retest_assignment_id: retestAssignmentId,
        parent_test_id: testId
      };

      // Populate answers_by_id with individual question data in correct format
      for (let i = 0; i < questions.length; i++) {
        try {
          const savedData = await AsyncStorage.getItem(`drawing_${studentId}_${testId}_${i}`);
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            let questionDrawingData: any[] = [];
            
            if (parsedData.root && parsedData.root.children && parsedData.root.children[0] && parsedData.root.children[0].children) {
              const drawingPaths = parsedData.root.children[0].children.map((child: any) => {
                try {
                  return JSON.parse(child.text);
                } catch (e) {
                  return null;
                }
              }).filter((path: any) => path !== null);
              
              questionDrawingData = drawingPaths;
            } else if (Array.isArray(parsedData)) {
              questionDrawingData = parsedData;
            }
            
            // Format as lines structure for answers_by_id
            submissionData.answers_by_id[questions[i].question_id] = {
              lines: questionDrawingData
            };
          } else {
            submissionData.answers_by_id[questions[i].question_id] = { lines: [] };
          }
        } catch (error) {
          submissionData.answers_by_id[questions[i].question_id] = { lines: [] };
        }
      }

      // Submit to API using the correct submission method
      const submitMethod = getSubmissionMethod('drawing');
      
      const response = await submitMethod(submissionData);
      
      if (response.data.success) {
        // Clear anti-cheating keys on successful submission
        await clearCheatingKeys();
        // Mark test as completed and clear retest keys (web app pattern)
        const testIdStr = Array.isArray(testId) ? testId[0] : (typeof testId === 'string' ? testId : String(testId));
        await markTestCompleted(studentId, 'drawing', testIdStr);
        
        // Cache the test results immediately after successful submission (web app pattern)
        const cacheKey = `student_results_table_${studentId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
        
        // Clear progress key (like matching test)
        const progressKey = `test_progress_${studentId}_drawing_${testId}`;
        await AsyncStorage.removeItem(progressKey);

        // Clear saved drawing data for all questions
        const removePromises = [];
        for (let i = 0; i < questions.length; i++) {
          removePromises.push(AsyncStorage.removeItem(`drawing_${studentId}_${testId}_${i}`));
        }
        await Promise.all(removePromises);

        // Navigate directly to dashboard without popup
        router.back();
      } else {
        throw new Error(response.data.error || 'Failed to submit test');
      }

    } catch (error: any) {
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
      setIsSubmittingToAPI(false);
    }
  }, [testData, questions, drawingPaths, testId, user, caughtCheating, visibilityChangeTimes, submitAllowed]);

  // Store performSubmit in ref to avoid dependency issues
  useEffect(() => {
    performSubmitRef.current = performSubmit;
  }, [performSubmit]);

  // Timer effect - only start if test has timer enabled and NOT in exam context
  useEffect(() => {
    if (!testData || !questions.length || !studentId || inExamContext) {
      return;
    }
    
    const allowedTime = testData.allowed_time || testData.time_limit;
    
    if (allowedTime && allowedTime > 0) {
      if (timerInitializedRef.current) {
        return;
      }
      
      timerInitializedRef.current = true;
      
      const timerKey = `test_timer_${studentId}_drawing_${testId}`;
      
      const loadTimerState = async () => {
        try {
          const cached = await AsyncStorage.getItem(timerKey);
          const now = Date.now();
          if (cached) {
            const parsed = JSON.parse(cached);
            const drift = Math.floor((now - new Date(parsed.lastTickAt).getTime()) / 1000);
            const remaining = Math.max(0, Number(parsed.remainingSeconds || allowedTime) - Math.max(0, drift));
            setTimeElapsed(allowedTime - remaining);
            return { remaining, startedAt: parsed.startedAt || new Date(now).toISOString() };
          } else {
            const startedAt = new Date(now).toISOString();
            await AsyncStorage.setItem(timerKey, JSON.stringify({
              remainingSeconds: allowedTime,
              lastTickAt: new Date(now).toISOString(),
              startedAt: startedAt
            }));
            return { remaining: allowedTime, startedAt };
          }
        } catch (e) {
          const startedAt = new Date().toISOString();
          return { remaining: allowedTime, startedAt };
        }
      };
      
      loadTimerState().then(({ remaining, startedAt }) => {
        remainingTimeRef.current = remaining;
        timerStartedAtRef.current = startedAt;
        setTimeElapsed(allowedTime - remaining);
        
        if (remaining <= 0) {
          timerInitializedRef.current = false;
          performSubmitRef.current?.();
          return;
        }
        
        countdownTimerRef.current = setInterval(async () => {
          remainingTimeRef.current -= 1;
          setTimeElapsed(allowedTime - remainingTimeRef.current);
          
          try {
            await AsyncStorage.setItem(timerKey, JSON.stringify({
              remainingSeconds: remainingTimeRef.current,
              lastTickAt: new Date().toISOString(),
              startedAt: timerStartedAtRef.current
            }));
          } catch (e) {}
          
          if (remainingTimeRef.current <= 0) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            timerInitializedRef.current = false;
            if (performSubmitRef.current) {
              performSubmitRef.current();
            }
          }
        }, 1000);
      });
      
      return () => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      };
    }
  }, [testData, questions.length, studentId, testId, inExamContext]);

  // Animation values
  const loadingOpacity = useSharedValue(0);
  const loadingScale = useSharedValue(0.8);

  useEffect(() => {
    if (loading) {
      loadingOpacity.value = withTiming(1, { duration: 300 });
      loadingScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    } else {
      loadingOpacity.value = withTiming(0, { duration: 200 });
      loadingScale.value = withTiming(0.8, { duration: 200 });
    }
  }, [loading]);

  const loadingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{ scale: loadingScale.value }],
  }));

  if (loading) {
    return (
      <View className={`flex-1 ${themeClasses.background}`}>
        <LoadingModal visible={true} message={themeMode === 'cyberpunk' ? 'LOADING…' : 'Loading…'} />
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center p-5`}>
        <Text className={`text-base ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-600'} text-center`}>{error}</Text>
      </View>
    );
  }

  if (!testData || !questions.length) {
    return (
      <View className={`flex-1 ${themeClasses.background} justify-center items-center p-5`}>
        <Text className={`text-base ${themeMode === 'cyberpunk' ? 'text-red-400' : 'text-red-600'} text-center`}>No test data available</Text>
      </View>
    );
  }

  // Extract text from question_json (Lexical editor format)
  const extractTextFromQuestionJson = (questionJson: string): string => {
    if (!questionJson) return '';
    
    try {
      const parsed = JSON.parse(questionJson);
      if (parsed.text) return parsed.text;
      if (parsed.content) return parsed.content;
      if (parsed.root && parsed.root.children) {
        // Extract text from Lexical format
        const extractTextFromNode = (node: any): string => {
          if (!node) return '';
          if (node.type === 'text') return node.text || '';
          if (node.children) {
            return node.children.map(extractTextFromNode).join('');
          }
          return '';
        };
        return parsed.root.children.map(extractTextFromNode).join('');
      }
    } catch (e) {
      // Failed to parse question_json - fallback to raw content
    }
    return questionJson; // Fallback to raw content
  };

  const currentQuestion = questions[currentQuestionIndex];
  const questionText = currentQuestion?.question_json 
    ? extractTextFromQuestionJson(currentQuestion.question_json)
    : currentQuestion?.question || currentQuestion?.question_text || currentQuestion?.text || currentQuestion?.title || currentQuestion?.name || currentQuestion?.prompt || testData.question || testData.question_text || testData.instructions || testData.title;

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      {showExamNav ? (
        <ExamTestHeader
          themeMode={themeMode}
          examId={examId}
          examName={examName || 'Exam'}
          testName={testData?.test_name || testData?.title}
          currentIndex={examTestIndex}
          total={examTestsTotal}
          timeSeconds={examTimeRemaining}
          onBack={() => router.back()}
        />
      ) : (
        <TestHeader 
          testName={testData.test_name || testData.title}
          onExit={() => router.back()}
          showBackButton
        />
      )}
      {/* Progress Tracker */}
      {!inExamContext && testData?.allowed_time > 0 && (
        <View className="mx-4 mt-4">
          <ProgressTracker
            answeredCount={questions.length}
            totalQuestions={questions.length}
            percentage={100}
            timeRemaining={Math.max(0, (testData.allowed_time || testData.time_limit) - timeElapsed)}
          />
        </View>
      )}
      <ScrollView 
        className="flex-1"
        scrollEnabled={!showFullscreenCanvas}
      >
        <View className={`m-4 p-4 rounded-xl border shadow-sm ${
          themeMode === 'cyberpunk' 
            ? 'bg-black border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-200'
        }`}>
          <View className="mb-4">
            <Text className={`text-base font-bold mb-2 ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-blue-300' 
                : 'text-blue-800'
            }`}>
              {themeMode === 'cyberpunk' ? 'INSTRUCTIONS:' : 'Instructions:'}
            </Text>
            <Text className={`text-sm leading-5 ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-300' 
                : themeMode === 'dark' 
                ? 'text-blue-200' 
                : 'text-blue-800'
            }`}>
              Create a drawing based on the question below. Use the drawing tools to create your artwork.
            </Text>
          </View>

          <View className="mb-4">
            <Text className={`text-lg font-bold mb-2 ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-white' 
                : 'text-gray-800'
            }`}>
              {themeMode === 'cyberpunk' ? `QUESTION ${currentQuestionIndex + 1} OF ${questions.length}` : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
            </Text>
            {!!questionText && <Text className={`text-base leading-6 ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-200' 
                : themeMode === 'dark' 
                ? 'text-gray-300' 
                : 'text-gray-700'
            }`}>{questionText}</Text>}
          </View>

          <View className="mb-4">
            <Text className={`text-lg font-bold mb-2 ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-white' 
                : 'text-gray-800'
            }`}>
              {themeMode === 'cyberpunk' ? 'WORKSPACE' : 'Workspace'}
            </Text>
            <Text className={`text-sm ${
              themeMode === 'cyberpunk'
                ? 'text-cyan-200'
                : themeMode === 'dark'
                ? 'text-gray-300'
                : 'text-gray-600'
            }`}>
              Tap the fullscreen button below to open the complete canvas with brushes, shapes, text, and pan/zoom. The preview updates automatically whenever you draw in fullscreen.
            </Text>
          </View>

          <View className="mt-6">
              <Text className={`text-lg font-bold mb-3 ${
                themeMode === 'cyberpunk'
                  ? 'text-cyan-400 tracking-wider'
                  : themeMode === 'dark'
                  ? 'text-white'
                  : 'text-gray-800'
              }`}>
                {themeMode === 'cyberpunk' ? 'CANVAS PREVIEW' : 'Canvas Preview'}
              </Text>
              <DrawingPreview
                paths={currentQuestionPaths}
                width={screenWidth - 64}
                height={220}
                themeMode={themeMode}
              />
              <TouchableOpacity
                className={`mt-4 py-3.5 rounded-xl items-center ${
                  themeMode === 'cyberpunk'
                    ? 'border border-cyan-400'
                    : themeMode === 'dark'
                    ? 'bg-blue-600'
                    : 'bg-header-blue'
                }`}
                style={themeMode === 'cyberpunk' ? { backgroundColor: '#f8ef02' } : {}}
                onPress={handleOpenFullscreen}
              >
                <Text className={`text-base font-semibold ${
                  themeMode === 'cyberpunk'
                    ? 'text-black'
                    : themeMode === 'dark'
                    ? 'text-white'
                    : 'text-white'
                }`}>
                  {themeMode === 'cyberpunk' ? 'OPEN FULL CANVAS' : 'Open Full Canvas'}
                </Text>
              </TouchableOpacity>
              <Text className={`text-xs mt-2 text-center ${
                themeMode === 'cyberpunk'
                  ? 'text-cyan-300'
                  : themeMode === 'dark'
                  ? 'text-gray-300'
                  : 'text-gray-500'
              }`}>
                {themeMode === 'cyberpunk'
                  ? 'All drawing happens inside the fullscreen workspace.'
                  : 'Open the full canvas to draw, pan, zoom, and manage layers.'}
              </Text>
            </View>

          {/* Question Navigation */}
          {questions.length > 1 && (
            <View className={`flex-row justify-between items-center px-5 py-4 border-t ${
              themeMode === 'cyberpunk' 
                ? 'bg-black border-cyan-400' 
                : themeMode === 'dark' 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <TouchableOpacity 
                className={`px-5 py-2.5 rounded-lg min-w-20 items-center ${
                  themeMode === 'cyberpunk' 
                    ? (currentQuestionIndex === 0 ? 'bg-gray-600' : 'border border-cyan-400') 
                    : themeMode === 'dark' 
                    ? (currentQuestionIndex === 0 ? 'bg-gray-600' : 'bg-blue-600')
                    : (currentQuestionIndex === 0 ? 'bg-gray-400' : 'bg-header-blue')
                }`}
                style={themeMode === 'cyberpunk' && currentQuestionIndex !== 0 ? { backgroundColor: '#f8ef02' } : {}}
                onPress={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                <Text className={`text-base font-medium ${
                  themeMode === 'cyberpunk' 
                    ? (currentQuestionIndex === 0 ? 'text-gray-400' : 'text-black') 
                    : themeMode === 'dark' 
                    ? (currentQuestionIndex === 0 ? 'text-gray-400' : 'text-white')
                    : (currentQuestionIndex === 0 ? 'text-gray-300' : 'text-white')
                }`}>
                  {themeMode === 'cyberpunk' ? 'PREVIOUS' : 'Previous'}
                </Text>
              </TouchableOpacity>
              
              <Text className={`text-base font-semibold ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400' 
                  : themeMode === 'dark' 
                  ? 'text-gray-300' 
                  : 'text-gray-700'
              }`}>
                {currentQuestionIndex + 1} of {questions.length}
              </Text>
              
              <TouchableOpacity 
                className={`px-5 py-2.5 rounded-lg min-w-20 items-center ${
                  themeMode === 'cyberpunk' 
                    ? (currentQuestionIndex === questions.length - 1 ? 'bg-gray-600' : 'border border-cyan-400') 
                    : themeMode === 'dark' 
                    ? (currentQuestionIndex === questions.length - 1 ? 'bg-gray-600' : 'bg-blue-600')
                    : (currentQuestionIndex === questions.length - 1 ? 'bg-gray-400' : 'bg-header-blue')
                }`}
                style={themeMode === 'cyberpunk' && currentQuestionIndex !== questions.length - 1 ? { backgroundColor: '#f8ef02' } : {}}
                onPress={handleNextQuestion}
                disabled={currentQuestionIndex === questions.length - 1}
              >
                <Text className={`text-base font-medium ${
                  themeMode === 'cyberpunk' 
                    ? (currentQuestionIndex === questions.length - 1 ? 'text-gray-400' : 'text-black') 
                    : themeMode === 'dark' 
                    ? (currentQuestionIndex === questions.length - 1 ? 'text-gray-400' : 'text-white')
                    : (currentQuestionIndex === questions.length - 1 ? 'text-gray-300' : 'text-white')
                }`}>
                  {themeMode === 'cyberpunk' ? 'NEXT' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!showExamNav && (
            <View className="p-5 items-center">
              {themeMode === 'cyberpunk' ? (
                <TouchableOpacity 
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  style={{ alignSelf: 'center' }}
                >
                  <Image 
                    source={require('../../../../assets/images/save-cyberpunk.png')} 
                    style={{ width: 40, height: 40 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : (
                <Animated.View
                  style={{
                    transform: [{ scale: isSubmitting ? 0.95 : 1 }],
                  }}
                >
                  <TouchableOpacity 
                    className={`py-3 px-4 rounded-lg self-center min-w-30 ${
                      isSubmitting ? 'bg-gray-400' : 'bg-[#8B5CF6]'
                    }`}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <Text className="text-white text-lg font-bold text-center">
                      {isSubmitting ? 'Submitting...' : 'Submit Drawing'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          )}

          {submitError && (
            <View className="p-5 bg-red-50 m-5 rounded-lg border border-red-200">
              <Text className="text-red-600 text-base text-center">{submitError}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Exam navigation vs submit */}
      {showExamNav ? (
        <ExamNavFooter
          themeMode={themeMode}
          loading={navLoading}
          currentIndex={examTestIndex}
          total={examTestsTotal}
          onPressPrev={navigatePrev}
          onPressNext={navigateNext}
          onPressReview={navigateReview}
        />
      ) : (
        <SubmitModal
          visible={showSubmitModal}
          onCancel={() => setShowSubmitModal(false)}
          onConfirm={performSubmit}
          testName="Drawing Test"
        />
      )}

      {/* Loading Spinner Modal */}
      <LoadingModal visible={isSubmittingToAPI} message={themeMode === 'cyberpunk' ? 'SUBMITTING…' : 'Submitting…'} />

      {/* Fullscreen Canvas Modal */}
      <Modal
        visible={showFullscreenCanvas}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => handleFullscreenExit()}
      >
        <View className="flex-1 bg-black">
          <FullscreenCanvas
            key={`fullscreen-canvas-${currentQuestionIndex}`}
            initialLines={fullscreenInitialData.lines}
            initialTextBoxes={fullscreenInitialData.textBoxes}
            initialTool={fullscreenPrefs.tool}
            initialColor={fullscreenPrefs.color}
            initialThickness={fullscreenPrefs.thickness}
            onChange={handleFullscreenChange}
            onExit={handleFullscreenExit}
          />
        </View>
      </Modal>
    </View>
  );
}