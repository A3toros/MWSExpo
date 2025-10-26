/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Image, AppState } from 'react-native';
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
import DrawingCanvas from '../../../../src/components/DrawingCanvas';
import DrawingControls from '../../../../src/components/DrawingControls';
import { convertAndroidDrawingToWebFormat, skiaToKonvaJSON } from '../../../../src/utils/SkiaDrawingToKonvaJSON';
import { academicCalendarService } from '../../../../src/services/AcademicCalendarService';
import { SubmitModal } from '../../../../src/components/modals';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { getThemeClasses } from '../../../../src/utils/themeUtils';

// Function to decode JWT and extract student_id
const getStudentIdFromToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    console.log('🔑 Raw token exists:', !!token);
    if (!token) return null;
    
    // Decode JWT payload (base64 decode the middle part)
    const parts = token.split('.');
    console.log('🔑 Token parts count:', parts.length);
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    console.log('🔑 JWT payload:', payload);
    console.log('🔑 Extracted student_id from sub:', payload.sub);
    return payload.sub || null;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export default function DrawingTestScreen() {
  const { testId } = useLocalSearchParams();
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

  // Anti-cheating state
  const [visibilityChangeTimes, setVisibilityChangeTimes] = useState(0);
  const [caughtCheating, setCaughtCheating] = useState(false);

  // Debug user state
  useEffect(() => {
    console.log('👤 User state changed:', user ? 'user object exists' : 'user is null');
    if (user) {
      console.log('👤 User details:', { student_id: user.student_id, id: user.id, name: user.name });
    }
  }, [user]);

  // Load student_id from JWT token
  useEffect(() => {
    const loadStudentId = async () => {
      console.log('🔑 Starting to load student_id from JWT...');
      const id = await getStudentIdFromToken();
      console.log('🔑 Loaded student_id from JWT:', id);
      setStudentId(id);
    };
    loadStudentId();
  }, []);

  // Debug studentId state changes
  useEffect(() => {
    console.log('🔑 StudentId state changed to:', studentId);
  }, [studentId]);
  
  // Multiple question support
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]); // Store answers for all questions
  const [currentQuestionPaths, setCurrentQuestionPaths] = useState<any[]>([]); // Current question's drawing paths
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false); // Flag to prevent interference during question loading
  
  // Drawing tools state
  const [currentTool, setCurrentTool] = useState('pencil');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentThickness, setCurrentThickness] = useState(2);
  const sliderWidthRef = React.useRef<number>(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Drawing state for scroll prevention
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Gesture state tracking
  const [isGestureActive, setIsGestureActive] = useState(false);
  
  // Scroll state management
  const [isScrolling, setIsScrolling] = useState(false);
  
  // Drawing controls state
  const [drawingControls, setDrawingControls] = useState<{
    undo: () => void;
    redo: () => void;
    reset: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    canUndo: boolean;
    canRedo: boolean;
    zoomLevel: number;
  } | null>(null);
  
  // Primary palette (8 colors, used in compact picker)
  const colors = [
    '#000000', // black
    '#FF0000', // red
    '#00FF00', // green
    '#0000FF', // blue
    '#FFFF00', // yellow
    '#FF00FF', // magenta
    '#00FFFF', // cyan
    '#FFA500', // orange
  ];

  // Anti-cheating: Track app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setVisibilityChangeTimes(prev => prev + 1);
        setCaughtCheating(true);
        console.log('🚨 App went to background/inactive, visibility change count:', visibilityChangeTimes + 1);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [visibilityChangeTimes]);

  // Check if test is already completed
  const checkTestCompleted = useCallback(async () => {
    if (!studentId || !testId) return false;
    
    try {
      const completionKey = `test_completed_${studentId}_drawing_${testId}`;
      const isCompleted = await AsyncStorage.getItem(completionKey);
      const retestKey = `retest1_${studentId}_drawing_${testId}`;
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
  }, [studentId, testId]);

  // Load saved drawing data for current question
  const loadCurrentQuestionDrawing = useCallback(async () => {
    console.log('🔄 Loading drawing for question:', currentQuestionIndex);
    console.log('🔄 Student ID from JWT:', studentId, 'testId:', testId);
    console.log('🔄 About to set isLoadingQuestion to true');
    setIsLoadingQuestion(true);
    
    if (studentId && testId) {
      const storageKey = `drawing_${studentId}_${testId}_${currentQuestionIndex}`;
      console.log('🔄 Storage key:', storageKey);
      try {
        const savedData = await AsyncStorage.getItem(storageKey);
        console.log('📁 Saved data for question', currentQuestionIndex, ':', savedData ? 'exists' : 'none');
        
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          console.log('📦 Parsed data structure:', Object.keys(parsedData));
          
          // Handle new JSON format with root.children structure
          if (parsedData.root && parsedData.root.children && parsedData.root.children[0] && parsedData.root.children[0].children) {
            const drawingPaths = parsedData.root.children[0].children.map((child: any) => {
              try {
                return JSON.parse(child.text);
              } catch (e) {
                console.error('Error parsing drawing path:', e);
                return null;
              }
            }).filter((path: any) => path !== null);
            
            console.log('🎨 Setting currentQuestionPaths to:', drawingPaths.length, 'paths');
            console.log('🎨 First path sample:', drawingPaths[0]);
            setCurrentQuestionPaths(drawingPaths);
            
            // Update answers array
            setAnswers(prevAnswers => {
              const newAnswers = [...prevAnswers];
              newAnswers[currentQuestionIndex] = parsedData;
              return newAnswers;
            });
          } else {
            // Fallback: try to parse as old format
            console.log('🎨 Setting currentQuestionPaths to (old format):', parsedData.length, 'paths');
            console.log('🎨 First path sample (old format):', parsedData[0]);
            setCurrentQuestionPaths(parsedData);
            setAnswers(prevAnswers => {
              const newAnswers = [...prevAnswers];
              newAnswers[currentQuestionIndex] = parsedData;
              return newAnswers;
            });
          }
        } else {
          // No saved data for this question, reset canvas
          console.log('🎨 No saved data, setting currentQuestionPaths to empty array');
          setCurrentQuestionPaths([]);
          console.log('🎨 currentQuestionPaths set to empty array for question:', currentQuestionIndex);
        }
      } catch (error) {
        console.error('Error loading saved drawing data for question:', currentQuestionIndex, error);
        setCurrentQuestionPaths([]);
      }
    }
    
    // Add a small delay to ensure the canvas has time to initialize
    setTimeout(() => {
      console.log('✅ Finished loading question', currentQuestionIndex, 'isLoadingQuestion set to false');
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
    console.log('🔄 Question changed to:', currentQuestionIndex, 'Total questions:', questions.length, 'Student ID available:', !!studentId);
    if (questions.length > 0 && studentId) {
      console.log('🔄 Calling loadCurrentQuestionDrawing for question:', currentQuestionIndex);
      loadCurrentQuestionDrawing();
    } else if (questions.length > 0 && !studentId) {
      console.log('🔄 Student ID not available yet, resetting canvas to empty for question:', currentQuestionIndex);
      setCurrentQuestionPaths([]);
    }
  }, [currentQuestionIndex, loadCurrentQuestionDrawing, questions.length, studentId]);

  // Load drawing data when studentId becomes available
  useEffect(() => {
    console.log('🔄 Student ID state changed:', studentId ? 'available' : 'not available');
    if (studentId && questions.length > 0) {
      console.log('🔄 Student ID became available, loading drawing for question:', currentQuestionIndex);
      loadCurrentQuestionDrawing();
    }
  }, [studentId, questions.length, currentQuestionIndex, loadCurrentQuestionDrawing]);

  // Debug log for DrawingCanvas rendering
  useEffect(() => {
    console.log('🎨 Rendering DrawingCanvas for question', currentQuestionIndex, 'with paths:', currentQuestionPaths.length, 'isLoading:', isLoadingQuestion);
  }, [currentQuestionIndex, currentQuestionPaths.length, isLoadingQuestion]);

  // Debug log for currentQuestionPaths changes
  useEffect(() => {
    console.log('🔄 currentQuestionPaths changed for question', currentQuestionIndex, ':', currentQuestionPaths.length, 'paths');
    if (currentQuestionPaths.length > 0) {
      console.log('🔄 First path in currentQuestionPaths:', currentQuestionPaths[0]);
    }
  }, [currentQuestionPaths, currentQuestionIndex]);

  // Save drawing data
  const saveDrawingData = useCallback(async (paths: any[]) => {
    if (studentId && testId) {
      await AsyncStorage.setItem(`drawing_${studentId}_${testId}`, JSON.stringify(paths));
    }
  }, [studentId, testId]);

  // Handle gesture state change
  const handleGestureStateChange = useCallback((isActive: boolean) => {
    setIsGestureActive(isActive);
  }, []);

  // Handle scroll state changes
  const handleScrollBegin = useCallback(() => {
    setIsScrolling(true);
  }, []);

  const handleScrollEnd = useCallback(() => {
    setIsScrolling(false);
  }, []);

  // Handle drawing change - store per question
  const handleDrawingChange = useCallback((paths: any[]) => {
    // Don't update if we're still loading a question
    if (isLoadingQuestion) {
      console.log('🚫 Ignoring drawing change during question loading');
      return;
    }
    
    console.log('🎨 Drawing change for question', currentQuestionIndex, ':', paths.length, 'paths');
    
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
      console.log('💾 Saving drawing for question', currentQuestionIndex, 'with', paths.length, 'paths to key:', storageKey);
      console.log('💾 Paths sample:', paths.slice(0, 2));
      console.log('💾 Text elements in paths:', paths.filter(p => p.type === 'text'));
      
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
    console.log('🔘 handleSubmit called');
    console.log('🔘 testData:', testData);
    console.log('🔘 questions.length:', questions.length);
    console.log('🔘 drawingPaths.length:', drawingPaths.length);
    
    if (!testData || !questions.length) {
      console.log('❌ Missing test data or questions');
      Alert.alert('Error', 'Missing required data for submission');
      return;
    }

    if (drawingPaths.length === 0) {
      console.log('❌ No drawing data');
      Alert.alert('No Drawing', 'Please create a drawing before submitting.');
      return;
    }

    // Show confirmation modal
    console.log('🔘 Showing confirmation modal');
    setShowSubmitModal(true);
  }, [testData, questions, drawingPaths, testId, user]);

  // Actual submit function
  const performSubmit = useCallback(async () => {
    console.log('🚀 performSubmit called');
    console.log('🚀 testData:', testData);
    console.log('🚀 questions.length:', questions.length);
    console.log('🚀 drawingPaths.length:', drawingPaths.length);
    
    if (!testData || !questions.length) {
      console.log('❌ Missing required data for submission');
      Alert.alert('Error', 'Missing required data for submission');
      return;
    }

    if (drawingPaths.length === 0) {
      console.log('❌ No drawing data to submit');
      Alert.alert('No Drawing', 'Please create a drawing before submitting.');
      return;
    }

    console.log('✅ Starting submission process');
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
        console.log('Drawing RN: userFromStorage:', userFromStorage);
      }
      
      if (!studentId) {
        // Fallback to Redux state
        studentId = user?.student_id || (user as any)?.id;
        console.log('Drawing RN: user from Redux:', user);
      }
      
      console.log('Drawing RN: studentId from token/AsyncStorage:', studentId);
      
      if (!studentId) {
        console.log('Drawing RN: No student ID available');
        Alert.alert('Error', 'Missing student ID');
        return;
      }

      console.log('📊 Collecting drawing data from AsyncStorage...');
      // Collect drawing data per question in the correct format
      const allDrawingData: string[] = [];
      
      for (let i = 0; i < questions.length; i++) {
        console.log(`📊 Loading data for question ${i}...`);
        try {
          const storageKey = `drawing_${studentId}_${testId}_${i}`;
          console.log(`📊 Storage key: ${storageKey}`);
          const savedData = await AsyncStorage.getItem(storageKey);
          console.log(`📊 Saved data exists for question ${i}:`, !!savedData);
          
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            console.log(`📊 Parsed data structure for question ${i}:`, Object.keys(parsedData));
            
            // Extract drawing paths from the saved format
            let drawingPaths = [];
            if (parsedData.root && parsedData.root.children && parsedData.root.children[0] && parsedData.root.children[0].children) {
              console.log(`📊 Using new format for question ${i}`);
              drawingPaths = parsedData.root.children[0].children.map((child: any) => {
                try {
                  return JSON.parse(child.text);
                } catch (e) {
                  console.error('Error parsing drawing path:', e);
                  return null;
                }
              }).filter((path: any) => path !== null);
            } else if (Array.isArray(parsedData)) {
              console.log(`📊 Using old format for question ${i}`);
              drawingPaths = parsedData;
            }
            
            console.log(`📊 Found ${drawingPaths.length} drawing paths for question ${i}`);
            console.log(`📊 Drawing paths sample:`, drawingPaths.slice(0, 2));
            console.log(`📊 Text elements in drawingPaths:`, drawingPaths.filter((path: any) => path.type === 'text'));
            
            // Format as JSON string with "lines" and "textBoxes" structure (web app format)
            if (drawingPaths.length > 0) {
              // Separate strokes from text elements - FIXED FILTERING
              console.log(`📊 All drawing paths:`, drawingPaths.map((p: any) => ({ type: p.type, hasText: !!p.text })));
              const strokes = drawingPaths.filter((path: any) => {
                const isText = path.type === 'text';
                console.log(`📊 Path type: ${path.type}, isText: ${isText}, included in strokes: ${!isText}`);
                return path.type !== 'text';
              });
              const textBoxes = drawingPaths.filter((path: any) => {
                const isText = path.type === 'text' && path.text;
                console.log(`📊 Path type: ${path.type}, hasText: ${!!path.text}, included in textBoxes: ${isText}`);
                return path.type === 'text' && path.text;
              });
              console.log(`📊 Text elements found after filtering:`, textBoxes);
              const formattedTextBoxes = textBoxes.map((textElement: any) => ({
                id: Date.now() + Math.random(), // Generate unique ID
                x: textElement.x,
                y: textElement.y,
                width: 150, // Default width
                height: 60, // Default height
                text: textElement.text,
                fontSize: textElement.fontSize || 14,
                color: textElement.color,
                isEditing: false
              }));
              console.log(`📊 Formatted text boxes:`, formattedTextBoxes);

              const formattedData = {
                lines: strokes,
                textBoxes: formattedTextBoxes
              };
              const jsonString = JSON.stringify(formattedData);
              allDrawingData.push(jsonString);
              console.log(`📊 Question ${i} formatted as:`, jsonString);
              console.log(`📊 Question ${i} has ${strokes.length} strokes and ${textBoxes.length} text boxes`);
              console.log(`📊 Question ${i} strokes:`, strokes);
              console.log(`📊 Question ${i} textBoxes:`, formattedTextBoxes);
            } else {
              // Empty question - add empty structure
              allDrawingData.push('{"lines":[],"textBoxes":[]}');
              console.log(`📊 Question ${i} has no data, added empty structure`);
            }
          } else {
            // No saved data for this question
            allDrawingData.push('{"lines":[],"textBoxes":[]}');
            console.log(`📊 Question ${i} has no saved data, added empty structure`);
          }
        } catch (error) {
          console.error(`Error loading drawing data for question ${i}:`, error);
          // Add empty structure for failed questions
          allDrawingData.push('{"lines":[],"textBoxes":[]}');
        }
      }
      
      console.log('📊 Total questions to submit:', allDrawingData.length);
      console.log('📊 Final submission data:', allDrawingData);
      console.log('📊 Sample drawing data format:', allDrawingData.slice(0, 2));
      
      // Prepare submission data
      console.log('📝 Preparing submission data...');
      
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
        time_taken: 0, // TODO: Implement timer
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        caught_cheating: caughtCheating,
        visibility_change_times: visibilityChangeTimes,
        answers_by_id: {} as Record<string, any>, // Will be populated separately
        question_order: questions.map(q => q.question_id),
        retest_assignment_id: null,
        parent_test_id: testId
      };
      
      console.log('📝 Submission data prepared:', {
        test_id: submissionData.test_id,
        test_name: submissionData.test_name,
        student_id: submissionData.student_id,
        answers_count: submissionData.answers.length,
        questions_count: submissionData.maxScore
      });

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
          console.error(`Error getting drawing data for question ${i}:`, error);
          submissionData.answers_by_id[questions[i].question_id] = { lines: [] };
        }
      }

      console.log('📊 Submission data prepared:', {
        totalQuestions: allDrawingData.length,
        questionsCount: questions.length,
        answersByIdKeys: Object.keys(submissionData.answers_by_id),
        sampleAnswerFormat: allDrawingData[0]?.substring(0, 100) + '...'
      });

      // Submit to API using the correct submission method
      console.log('🌐 Submitting to API...');
      const submitMethod = getSubmissionMethod('drawing');
      console.log('🌐 Submit method:', submitMethod);
      console.log('🌐 Full submission data:', JSON.stringify(submissionData, null, 2));
      
      const response = await submitMethod(submissionData);
      console.log('🌐 API Response:', response);
      
      if (response.data.success) {
        console.log('✅ Submission successful!');
        // Mark as completed
        const completionKey = `test_completed_${studentId}_drawing_${testId}`;
        await AsyncStorage.setItem(completionKey, 'true');
        console.log('✅ Marked test as completed');
        
        // Cache the test results immediately after successful submission (web app pattern)
        const cacheKey = `student_results_table_${studentId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
        console.log('🎓 Test results cached with key:', cacheKey);
        
        // Clear retest keys
        const retestKey = `retest1_${studentId}_drawing_${testId}`;
        const retestAssignKey = `retest_assignment_id_${studentId}_drawing_${testId}`;
        await AsyncStorage.multiRemove([retestKey, retestAssignKey]);
        console.log('✅ Cleared retest keys');
        
        // Clear progress key (like matching test)
        const progressKey = `test_progress_${studentId}_drawing_${testId}`;
        await AsyncStorage.removeItem(progressKey);
        console.log('✅ Cleared progress key');

        // Clear saved drawing data for all questions
        const removePromises = [];
        for (let i = 0; i < questions.length; i++) {
          removePromises.push(AsyncStorage.removeItem(`drawing_${studentId}_${testId}_${i}`));
        }
        await Promise.all(removePromises);
        console.log('✅ Cleared saved drawing data');

        Alert.alert(
          'Drawing Submitted Successfully!',
          'Your drawing has been submitted for teacher review.',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      } else {
        console.log('❌ Submission failed:', response.data.error);
        throw new Error(response.data.error || 'Failed to submit test');
      }

    } catch (error: any) {
      console.error('❌ Error submitting test:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
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
      console.log('🏁 Submission process finished');
      setIsSubmittingToAPI(false);
    }
  }, [testData, questions, drawingPaths, testId, user, caughtCheating, visibilityChangeTimes]);

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
      <Animated.View className={`flex-1 ${themeClasses.background} justify-center items-center`} style={loadingAnimatedStyle}>
        <ActivityIndicator size="large" color={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#60a5fa' : '#3B82F6'} />
        <Text className={`text-base ${themeClasses.textSecondary} text-center mt-2`}>Loading test...</Text>
      </Animated.View>
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
      console.log('Failed to parse question_json:', e);
    }
    return questionJson; // Fallback to raw content
  };

  const currentQuestion = questions[currentQuestionIndex];
  const questionText = currentQuestion?.question_json 
    ? extractTextFromQuestionJson(currentQuestion.question_json)
    : currentQuestion?.question || currentQuestion?.question_text || currentQuestion?.text || currentQuestion?.title || currentQuestion?.name || currentQuestion?.prompt || testData.question || testData.question_text || testData.instructions || testData.title;

  return (
    <View className={`flex-1 ${themeClasses.background}`}>
      <TestHeader 
        testName={testData.test_name || testData.title}
      />
      <ScrollView 
        className="flex-1"
        scrollEnabled={!isDrawing && !isGestureActive}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollBegin={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
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
            <Text className={`text-lg font-bold mb-4 ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-white' 
                : 'text-gray-800'
            }`}>
              {themeMode === 'cyberpunk' ? 'DRAWING TOOLS' : 'Drawing Tools'}
            </Text>
            
            {/* Drawing Tools */}
            <View className={`flex-row flex-wrap gap-4 mb-4 p-3 rounded-lg border relative ${
              themeMode === 'cyberpunk' 
                ? 'bg-black border-cyan-400/30' 
                : themeMode === 'dark' 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              {/* Tool Selection */}
              <View className="items-center min-w-20">
                <Text className={`text-xs mb-1 font-medium ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-300 tracking-wider' 
                    : themeMode === 'dark' 
                    ? 'text-gray-300' 
                    : 'text-gray-500'
                }`}>
                  {themeMode === 'cyberpunk' ? 'TOOL:' : 'Tool:'}
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className={`w-10 h-10 rounded-lg border-2 justify-center items-center ${
                      themeMode === 'cyberpunk' 
                        ? (currentTool === 'pencil' ? 'border-cyan-400 bg-red-400' : 'border-cyan-400/30') 
                        : themeMode === 'dark' 
                        ? (currentTool === 'pencil' ? 'border-blue-400 bg-blue-600' : 'border-gray-600 bg-gray-800')
                        : (currentTool === 'pencil' ? 'border-header-blue bg-blue-50' : 'border-gray-300 bg-white')
                    }`}
                    style={themeMode === 'cyberpunk' && currentTool !== 'pencil' ? { backgroundColor: '#f8ef02' } : {}}
                    onPress={() => setCurrentTool('pencil')}
                  >
                    <Image
                      source={require('../../../../assets/images/canvas/pencil.png')}
                      className="w-5 h-5"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`w-10 h-10 rounded-lg border-2 justify-center items-center ${
                      themeMode === 'cyberpunk' 
                        ? (currentTool === 'line' ? 'border-cyan-400 bg-red-400' : 'border-cyan-400/30') 
                        : themeMode === 'dark' 
                        ? (currentTool === 'line' ? 'border-blue-400 bg-blue-600' : 'border-gray-600 bg-gray-800')
                        : (currentTool === 'line' ? 'border-header-blue bg-blue-50' : 'border-gray-300 bg-white')
                    }`}
                    style={themeMode === 'cyberpunk' && currentTool !== 'line' ? { backgroundColor: '#f8ef02' } : {}}
                    onPress={() => setCurrentTool('line')}
                  >
                    <Image
                      source={require('../../../../assets/images/canvas/ruler.png')}
                      className="w-5 h-5"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`w-10 h-10 rounded-lg border-2 justify-center items-center ${
                      themeMode === 'cyberpunk' 
                        ? (currentTool === 'rectangle' ? 'border-cyan-400 bg-red-400' : 'border-cyan-400/30') 
                        : themeMode === 'dark' 
                        ? (currentTool === 'rectangle' ? 'border-blue-400 bg-blue-600' : 'border-gray-600 bg-gray-800')
                        : (currentTool === 'rectangle' ? 'border-header-blue bg-blue-50' : 'border-gray-300 bg-white')
                    }`}
                    style={themeMode === 'cyberpunk' && currentTool !== 'rectangle' ? { backgroundColor: '#f8ef02' } : {}}
                    onPress={() => setCurrentTool('rectangle')}
                  >
                    <Image
                      source={require('../../../../assets/images/canvas/square.png')}
                      className="w-5 h-5"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`w-10 h-10 rounded-lg border-2 justify-center items-center ${
                      themeMode === 'cyberpunk' 
                        ? (currentTool === 'circle' ? 'border-cyan-400 bg-red-400' : 'border-cyan-400/30') 
                        : themeMode === 'dark' 
                        ? (currentTool === 'circle' ? 'border-blue-400 bg-blue-600' : 'border-gray-600 bg-gray-800')
                        : (currentTool === 'circle' ? 'border-header-blue bg-blue-50' : 'border-gray-300 bg-white')
                    }`}
                    style={themeMode === 'cyberpunk' && currentTool !== 'circle' ? { backgroundColor: '#f8ef02' } : {}}
                    onPress={() => setCurrentTool('circle')}
                  >
                    <Image
                      source={require('../../../../assets/images/canvas/circle.png')}
                      className="w-5 h-5"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`w-10 h-10 rounded-lg border-2 justify-center items-center ${
                      themeMode === 'cyberpunk' 
                        ? (currentTool === 'eraser' ? 'border-cyan-400 bg-red-400' : 'border-cyan-400/30') 
                        : themeMode === 'dark' 
                        ? (currentTool === 'eraser' ? 'border-blue-400 bg-blue-600' : 'border-gray-600 bg-gray-800')
                        : (currentTool === 'eraser' ? 'border-header-blue bg-blue-50' : 'border-gray-300 bg-white')
                    }`}
                    style={themeMode === 'cyberpunk' && currentTool !== 'eraser' ? { backgroundColor: '#f8ef02' } : {}}
                    onPress={() => setCurrentTool('eraser')}
                  >
                    <Image
                      source={require('../../../../assets/images/canvas/eraser.png')}
                      className="w-5 h-5"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`w-10 h-10 rounded-lg border-2 justify-center items-center ${
                      themeMode === 'cyberpunk' 
                        ? (currentTool === 'text' ? 'border-cyan-400 bg-red-400' : 'border-cyan-400/30') 
                        : themeMode === 'dark' 
                        ? (currentTool === 'text' ? 'border-blue-400 bg-blue-600' : 'border-gray-600 bg-gray-800')
                        : (currentTool === 'text' ? 'border-header-blue bg-blue-50' : 'border-gray-300 bg-white')
                    }`}
                    style={themeMode === 'cyberpunk' && currentTool !== 'text' ? { backgroundColor: '#f8ef02' } : {}}
                    onPress={() => setCurrentTool('text')}
                  >
                    <Image
                      source={require('../../../../assets/images/canvas/text-box.png')}
                      className="w-5 h-5"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`w-10 h-10 rounded-lg border-2 justify-center items-center ${
                      themeMode === 'cyberpunk' 
                        ? (currentTool === 'pan' ? 'border-cyan-400 bg-red-400' : 'border-cyan-400/30') 
                        : themeMode === 'dark' 
                        ? (currentTool === 'pan' ? 'border-blue-400 bg-blue-600' : 'border-gray-600 bg-gray-800')
                        : (currentTool === 'pan' ? 'border-header-blue bg-blue-50' : 'border-gray-300 bg-white')
                    }`}
                    style={themeMode === 'cyberpunk' && currentTool !== 'pan' ? { backgroundColor: '#f8ef02' } : {}}
                    onPress={() => setCurrentTool('pan')}
                  >
                    <Image
                      source={require('../../../../assets/images/canvas/pan.png')}
                      className="w-5 h-5"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Color Picker */}
              <View className="items-center min-w-20">
                <Text className={`text-xs mb-1 font-medium ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-300 tracking-wider' 
                    : themeMode === 'dark' 
                    ? 'text-gray-300' 
                    : 'text-gray-500'
                }`}>
                  {themeMode === 'cyberpunk' ? 'COLOR:' : 'Color:'}
                </Text>
                <TouchableOpacity
                  className={`flex-row items-center px-2 py-1 rounded-md border ${
                    themeMode === 'cyberpunk' 
                      ? 'border-cyan-400/30 bg-black' 
                      : themeMode === 'dark' 
                      ? 'border-gray-600 bg-gray-800' 
                      : 'border-gray-300 bg-white'
                  }`}
                  onPress={() => setShowColorPicker(!showColorPicker)}
                >
                  <View className={`w-5 h-5 rounded border mr-1.5 ${
                    themeMode === 'cyberpunk' 
                      ? 'border-cyan-400/30' 
                      : themeMode === 'dark' 
                      ? 'border-gray-500' 
                      : 'border-gray-300'
                  }`} style={{ backgroundColor: currentColor }} />
                  <Text className={`text-xs ${
                    themeMode === 'cyberpunk' 
                      ? 'text-cyan-300' 
                      : themeMode === 'dark' 
                      ? 'text-gray-300' 
                      : 'text-gray-700'
                  }`}>
                    {themeMode === 'cyberpunk' ? 'COLOR' : 'Color'}
                  </Text>
                </TouchableOpacity>
                
                {showColorPicker && (
                  <View className={`absolute top-0 left-full rounded-lg border p-2.5 flex-row flex-wrap w-44 z-50 -mt-28 ml-2 ${
                    themeMode === 'cyberpunk' 
                      ? 'bg-black border-cyan-400/30' 
                      : themeMode === 'dark' 
                      ? 'bg-gray-800 border-gray-600' 
                      : 'bg-white border-gray-300'
                  }`}>
                    {colors.map(color => (
                      <TouchableOpacity
                        key={color}
                        className={`w-8 h-8 rounded-md m-1.5 border ${
                          currentColor === color ? 'border-2 border-gray-800' : 'border border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                        onPress={() => {
                          setCurrentColor(color);
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* Thickness Slider (thin line + movable dot) */}
              <View className="items-center">
                <Text className={`text-xs mb-1 font-medium ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-300 tracking-wider' 
                    : themeMode === 'dark' 
                    ? 'text-gray-300' 
                    : 'text-gray-500'
                }`}>
                  {themeMode === 'cyberpunk' ? `THICKNESS: ${currentThickness}px` : `Thickness: ${currentThickness}px`}
                </Text>
                <View
                  className="w-48 h-6 rounded-xl bg-transparent relative overflow-hidden mt-2"
                  onLayout={(e) => {
                    (sliderWidthRef as any).current = e.nativeEvent.layout.width;
                  }}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => {
                    const width = (sliderWidthRef as any).current || 1;
                    const x = e.nativeEvent.locationX;
                    const pct = Math.max(0, Math.min(1, x / width));
                    const value = Math.max(1, Math.round(1 + pct * (20 - 1)));
                    setCurrentThickness(value);
                  }}
                  onResponderMove={(e) => {
                    const width = (sliderWidthRef as any).current || 1;
                    const x = e.nativeEvent.locationX;
                    const pct = Math.max(0, Math.min(1, x / width));
                    const value = Math.max(1, Math.round(1 + pct * (20 - 1)));
                    setCurrentThickness(value);
                  }}
                >
                  {(() => {
                    const pct = Math.min(1, Math.max(0, (currentThickness - 1) / (20 - 1)));
                    const trackWidth = (sliderWidthRef as any).current || 200;
                    const thumbLeft = pct * trackWidth - 8; // center 16px thumb
                    return (
                      <>
                        <View className={`absolute top-2.5 left-0 right-0 h-0.5 ${
                          themeMode === 'cyberpunk' 
                            ? 'bg-cyan-400/50' 
                            : themeMode === 'dark' 
                            ? 'bg-gray-500' 
                            : 'bg-gray-400'
                        }`} />
                        <View className={`absolute top-1.5 w-4 h-4 rounded-full ${
                          themeMode === 'cyberpunk' 
                            ? 'bg-cyan-400' 
                            : themeMode === 'dark' 
                            ? 'bg-gray-300' 
                            : 'bg-gray-800'
                        }`} style={{ left: Math.max(-8, Math.min(trackWidth - 8, thumbLeft)) }} />
                      </>
                    );
                  })()}
                </View>
              </View>
            </View>

            {/* Drawing Controls */}
            {drawingControls && (
              <DrawingControls
                onUndo={drawingControls.undo}
                onRedo={drawingControls.redo}
                onReset={drawingControls.reset}
                onZoomIn={drawingControls.zoomIn}
                onZoomOut={drawingControls.zoomOut}
                canUndo={drawingControls.canUndo}
                canRedo={drawingControls.canRedo}
                zoomLevel={drawingControls.zoomLevel}
              />
            )}

            {/* Drawing Canvas - Force new instance for each question */}
            <View className="mt-4 items-center">
                <DrawingCanvas
                  key={`canvas-${currentQuestionIndex}`}
                  width={screenWidth - 64}
                  height={300}
                  currentColor={currentColor}
                  currentThickness={currentThickness}
                  currentTool={currentTool}
                  onDrawingChange={handleDrawingChange}
                  isDrawing={isDrawing}
                  onDrawingStateChange={setIsDrawing}
                  onGestureStateChange={handleGestureStateChange}
                  initialPaths={currentQuestionPaths}
                  onControlRef={setDrawingControls}
                />
            </View>
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

          {submitError && (
            <View className="p-5 bg-red-50 m-5 rounded-lg border border-red-200">
              <Text className="text-red-600 text-base text-center">{submitError}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submit Modal */}
      <SubmitModal
        visible={showSubmitModal}
        onCancel={() => setShowSubmitModal(false)}
        onConfirm={performSubmit}
        testName="Drawing Test"
      />

      {/* Loading Spinner Modal */}
      {isSubmittingToAPI && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center z-50">
          <View className={`rounded-xl p-6 items-center ${
            themeMode === 'cyberpunk' 
              ? 'bg-black border-cyan-400/30' 
              : themeMode === 'dark' 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text className="text-base text-gray-700 mt-3">Submitting drawing...</Text>
          </View>
        </View>
      )}
    </View>
  );
}