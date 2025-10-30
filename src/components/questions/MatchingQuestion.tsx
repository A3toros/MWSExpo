/** @jsxImportSource nativewind */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image, Alert } from 'react-native';
import Svg, { Line, Defs, Marker, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

type Props = {
  question: {
    id: string | number;
    question_text?: string;
    question?: string;
    image_url?: string;
    blocks?: Array<{
      id: string | number;
      coordinates: { x: number; y: number; width: number; height: number };
      word?: string;
    }>;
    words?: Array<{
      id: string | number;
      text: string;
    }>;
  };
  testId: string;
  testType?: string;
  displayNumber?: number;
  studentAnswer?: any;
  onAnswerChange?: (questionId: string | number, answer: any) => void;
  showCorrectAnswers?: boolean;
  studentId?: string | null;
};

export default function MatchingQuestion({
  question,
  testId,
  testType = 'matching',
  displayNumber,
  studentAnswer,
  onAnswerChange,
  showCorrectAnswers = false,
  studentId = null
}: Props) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [words, setWords] = useState<any[]>([]);
  const [placedWords, setPlacedWords] = useState<{[key: string]: string}>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Layout tracking for drawing arrows
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [wordBankOffset, setWordBankOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const blockCentersRef = useRef<Record<string, { x: number; y: number }>>({});
  const wordCentersRef = useRef<Record<string, { x: number; y: number }>>({});

  // Initialize question data
  useEffect(() => {
    if (question) {
      // Parse blocks and words from question data
      const questionBlocks = question.blocks || [];
      const questionWords = question.words || [];
      
      setBlocks(questionBlocks);
      setWords(questionWords);
      
      if (studentId) {
        // Load saved answer for student mode
        const loadSavedAnswer = async () => {
          try {
            const savedAnswer = await AsyncStorage.getItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`);
            if (savedAnswer) {
              const parsed = JSON.parse(savedAnswer);
              setPlacedWords(parsed || {});
            }
          } catch (e) {
            console.error('Failed to load saved answer:', e);
          }
        };
        loadSavedAnswer();
      }
    }
  }, [question, testId, testType, studentId]);

  // Sync with parent studentAnswer prop when it changes
  useEffect(() => {
    if (studentAnswer !== undefined && studentAnswer !== null) {
      setPlacedWords(studentAnswer || {});
    }
  }, [studentAnswer]);

  // Auto-save functionality
  useEffect(() => {
    if (Object.keys(placedWords).length > 0 && testId && question?.id && studentId) {
      const timeoutId = setTimeout(() => {
        setIsAutoSaving(true);
        AsyncStorage.setItem(`test_progress_${studentId}_${testType}_${testId}_${question.id}`, JSON.stringify(placedWords));
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [placedWords, testId, testType, question?.id, studentId]);

  // Handle word placement
  const handleWordTap = useCallback((wordId: string | number) => {
    const wordText = words.find(w => w.id === wordId)?.text || '';
    
    // Find first empty block
    const emptyBlock = blocks.find(block => !placedWords[String(block.id)]);
    if (emptyBlock) {
      const newPlacedWords = {
        ...placedWords,
        [String(emptyBlock.id)]: wordText
      };
      setPlacedWords(newPlacedWords);
      if (onAnswerChange) {
        onAnswerChange(question.id, newPlacedWords);
      }
    } else {
      Alert.alert('All blocks filled', 'All blocks already have words placed.');
    }
  }, [blocks, placedWords, words, onAnswerChange, question.id]);

  // Handle word removal from block
  const handleBlockTap = useCallback((blockId: string | number) => {
    if (placedWords[String(blockId)]) {
      const newPlacedWords = { ...placedWords };
      delete newPlacedWords[String(blockId)];
      setPlacedWords(newPlacedWords);
      if (onAnswerChange) {
        onAnswerChange(question.id, newPlacedWords);
      }
    }
  }, [placedWords, onAnswerChange, question.id]);

  return (
    <View className={`p-4 rounded-lg border ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-cyan-400/30' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border-gray-600' 
        : 'bg-white border-gray-200'
    }`}>
      <View className="mb-4">
        <Text className={`text-lg font-semibold mb-2 ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-white' 
            : 'text-gray-900'
        }`}>
          {themeMode === 'cyberpunk' ? 'QUESTION' : 'Question'} {typeof displayNumber === 'number' ? displayNumber : question?.id}
        </Text>
        <View className="mb-2">
          {isAutoSaving && (
            <View className="flex-row items-center gap-2 mb-2">
              <ActivityIndicator size="small" color={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#60A5FA' : '#2563eb'} />
              <Text className={`text-xs ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : themeMode === 'dark' 
                  ? 'text-gray-400' 
                  : 'text-gray-600'
              }`}>
                {themeMode === 'cyberpunk' ? 'SAVING...' : 'Saving...'}
              </Text>
            </View>
          )}
          {lastSaved && !isAutoSaving && (
            <Text className={`text-xs ${
              themeMode === 'cyberpunk' 
                ? 'text-green-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-green-400' 
                : 'text-green-600'
            }`}>
              ✓ {themeMode === 'cyberpunk' ? 'SAVED AT' : 'Saved at'} {lastSaved}
            </Text>
          )}
        </View>
      </View>
      
      <Text className={`text-lg mb-4 ${
        themeMode === 'cyberpunk' 
          ? 'text-cyan-400 tracking-wider' 
          : themeMode === 'dark' 
          ? 'text-white' 
          : 'text-gray-900'
      }`}>
        {question.question_text || 'Match the words to the correct positions on the image.'}
      </Text>
      
      {question.image_url && (
        <View style={styles.imageContainer} onLayout={(e) => {
          setImageOffset({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y });
          // container for arrows sizing
          const { width, height } = e.nativeEvent.layout;
          setContainerSize((prev) => ({ width: Math.max(prev.width, width), height: prev.height + height }));
        }}>
          <Image 
            source={{ uri: question.image_url }} 
            style={styles.image}
            resizeMode="contain"
          />
          {/* Render blocks as overlays */}
          {blocks.map((block, index) => (
            <TouchableOpacity
              key={block.id || `block-${index}`}
              style={[
                styles.block,
                {
                  left: block.coordinates?.x || 0,
                  top: block.coordinates?.y || 0,
                  width: block.coordinates?.width || 100,
                  height: block.coordinates?.height || 50,
                }
              ]}
              onPress={() => handleBlockTap(block.id)}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                blockCentersRef.current[String(block.id)] = {
                  x: imageOffset.x + x + (width / 2),
                  y: imageOffset.y + y + (height / 2),
                };
              }}
            >
              <Text style={styles.blockText}>
                {placedWords[String(block.id)] || 'Tap to place word'}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Arrows overlay for placed words -> blocks (drawn later as global overlay) */}
        </View>
      )}
      
      {/* Word bank */}
      <View className="mt-4" onLayout={(e) => {
        setWordBankOffset({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y });
        const { width, height } = e.nativeEvent.layout;
        setContainerSize((prev) => ({ width: Math.max(prev.width, width), height: prev.height + height }));
      }}>
        <Text className={`text-base font-semibold mb-3 ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-white' 
            : 'text-gray-700'
        }`}>
          {themeMode === 'cyberpunk' ? 'WORD BANK:' : 'Word Bank:'}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {words.map((word, index) => (
            <TouchableOpacity
              key={word.id || `word-${index}`}
              className={`px-4 py-2 rounded-lg border-2 ${
                themeMode === 'cyberpunk' 
                  ? 'bg-black border-cyan-400' 
                  : themeMode === 'dark' 
                  ? 'bg-gray-800 border-gray-600' 
                  : 'bg-white border-gray-300'
              }`}
              onPress={() => handleWordTap(word.id)}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                // Use word text as key; assumes distinct texts per question
                wordCentersRef.current[String(word.text)] = {
                  x: wordBankOffset.x + x + (width / 2),
                  y: wordBankOffset.y + y + (height / 2),
                };
              }}
            >
              <Text className={`text-base ${
                themeMode === 'cyberpunk' 
                  ? 'text-cyan-400 tracking-wider' 
                  : themeMode === 'dark' 
                  ? 'text-white' 
                  : 'text-gray-700'
              }`}>
                {word.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* SVG overlay connecting word bank chips to blocks */}
      {containerSize.width > 0 && containerSize.height > 0 && (
        <Svg
          pointerEvents="none"
          width={containerSize.width}
          height={containerSize.height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Defs>
            <Marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
              <Path d="M0,0 L8,4 L0,8 z" fill={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#60A5FA' : '#2563eb'} />
            </Marker>
          </Defs>
          {Object.entries(placedWords).map(([blockId, wordText]) => {
            const start = wordCentersRef.current[String(wordText)];
            const end = blockCentersRef.current[String(blockId)];
            if (!start || !end) return null;
            return (
              <Line
                key={`${blockId}-${wordText}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#60A5FA' : '#2563eb'}
                strokeWidth={3}
                markerEnd="url(#arrow)"
              />
            );
          })}
        </Svg>
      )}
      
      <View className="mt-4 p-3 rounded-lg border ${
        themeMode === 'cyberpunk' 
          ? 'bg-black border-cyan-400/30' 
          : themeMode === 'dark' 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-gray-50 border-gray-200'
      }">
        <Text className={`text-sm mb-1 ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-gray-300' 
            : 'text-gray-600'
        }`}>
          • {themeMode === 'cyberpunk' ? 'TAP A WORD TO PLACE IT IN THE FIRST AVAILABLE BLOCK' : 'Tap a word to place it in the first available block'}
        </Text>
        <Text className={`text-sm ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-400 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-gray-300' 
            : 'text-gray-600'
        }`}>
          • {themeMode === 'cyberpunk' ? 'TAP A BLOCK TO REMOVE THE PLACED WORD' : 'Tap a block to remove the placed word'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  savedText: {
    fontSize: 12,
    color: '#10b981',
  },
  questionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 300,
  },
  block: {
    position: 'absolute',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 30,
  },
  blockText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
    textAlign: 'center',
    padding: 4,
  },
  wordBank: {
    marginBottom: 16,
  },
  wordBankTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  wordText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  instructions: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    padding: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 4,
  },
});